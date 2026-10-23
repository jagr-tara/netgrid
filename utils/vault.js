const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes recommended for AES-GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Retrieves and validates the 32-byte master encryption key from environment.
 * @returns {Buffer} 32-byte master key
 */
function getMasterKey() {
  const keyHex = process.env.VAULT_MASTER_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('VAULT_MASTER_KEY must be a valid 32-byte hex string (64 characters) in .env');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a plain-text credential payload using AES-256-GCM.
 * Zero-exposure policy: The plain text is never logged or cached.
 * 
 * @param {string} plainText The raw secret/password to encrypt
 * @returns {string} Combined format: "ivHex:authTagHex:encryptedHex"
 */
function encryptPayload(plainText) {
  if (typeof plainText !== 'string' || plainText.length === 0) {
    throw new Error('Credential payload must be a non-empty string.');
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload and verifies authentication tag integrity.
 * 
 * @param {string} combinedPayload Format: "ivHex:authTagHex:encryptedHex"
 * @returns {string} Plain-text secret
 */
function decryptPayload(combinedPayload) {
  if (!combinedPayload || typeof combinedPayload !== 'string') {
    throw new Error('Invalid encrypted payload format.');
  }

  const parts = combinedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload format. Expected iv:tag:data');
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks a payload for safe display in views without exposing sensitive bytes.
 * @returns {string} Standard masked string
 */
function maskPayload() {
  return '••••••••';
}

module.exports = {
  encryptPayload,
  decryptPayload,
  maskPayload,
};
