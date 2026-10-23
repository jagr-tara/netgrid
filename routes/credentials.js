const express = require('express');
const router = express.Router();
const db = require('../db');
const vault = require('../utils/vault');

// Allowed standard network infrastructure protocols
const ALLOWED_PROTOCOLS = ['ssh', 'snmpv3', 'https', 'netconf', 'restconf', 'telnet', 'console'];

// GET /credentials - Render credentials inventory with zero-exposure masked payloads
router.get('/', async (req, res) => {
  try {
    const credentialsQuery = `
      SELECT 
        c.id, 
        c.device_id, 
        c.username, 
        c.protocol,
        d.hostname AS device_hostname,
        d.device_role,
        host(d.management_ip) AS device_management_ip
      FROM credentials c
      LEFT JOIN devices d ON c.device_id = d.id
      ORDER BY c.id DESC;
    `;

    const devicesQuery = `
      SELECT id, hostname, device_role, host(management_ip) AS management_ip
      FROM devices
      ORDER BY hostname ASC;
    `;

    const [credsResult, devicesResult] = await Promise.all([
      db.query(credentialsQuery),
      db.query(devicesQuery),
    ]);

    // Zero-Exposure Policy: Do NOT pass encrypted_payload or decrypted secrets to the view.
    const maskedCredentials = credsResult.rows.map(cred => ({
      id: cred.id,
      device_id: cred.device_id,
      device_hostname: cred.device_hostname || 'Unbound / Global Node',
      device_role: cred.device_role || null,
      device_management_ip: cred.device_management_ip || null,
      username: cred.username,
      protocol: (cred.protocol || 'ssh').toUpperCase(),
      masked_payload: vault.maskPayload(),
    }));

    res.render('credentials', {
      title: 'Credentials Vault',
      currentPath: '/credentials',
      credentials: maskedCredentials,
      devices: devicesResult.rows,
      protocols: ALLOWED_PROTOCOLS,
      query: req.query,
    });
  } catch (err) {
    console.error('Error fetching credentials:', err.message);
    res.status(500).render('error', {
      title: 'Database Error',
      message: 'Failed to retrieve vault records from database.',
      currentPath: '/credentials',
    });
  }
});

// POST /credentials - Securely store a new credential with AES-256-GCM encryption
router.post('/', async (req, res) => {
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  try {
    let { device_id, username, password, payload, protocol } = req.body;
    const rawSecret = password || payload;

    if (!username || !username.trim()) {
      const errorMsg = 'Username is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/credentials?error=${encodeURIComponent(errorMsg)}`);
    }

    if (!rawSecret || !rawSecret.trim()) {
      const errorMsg = 'Password / Secret payload is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/credentials?error=${encodeURIComponent(errorMsg)}`);
    }

    // Zero-Exposure: Encrypt secret immediately using native crypto AES-256-GCM
    const encryptedPayload = vault.encryptPayload(rawSecret.trim());

    // Validate Device Binding
    let validatedDeviceId = null;
    if (device_id && device_id !== '' && device_id !== 'none') {
      const parsedDevId = parseInt(device_id, 10);
      if (!isNaN(parsedDevId) && parsedDevId > 0) {
        const devCheck = await db.query('SELECT id FROM devices WHERE id = $1', [parsedDevId]);
        if (devCheck.rows.length === 0) {
          const errorMsg = 'Specified device does not exist in inventory.';
          if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
          return res.redirect(`/credentials?error=${encodeURIComponent(errorMsg)}`);
        }
        validatedDeviceId = parsedDevId;
      }
    }

    let validatedProtocol = 'ssh';
    if (protocol && protocol.trim()) {
      const lower = protocol.trim().toLowerCase();
      if (ALLOWED_PROTOCOLS.includes(lower)) {
        validatedProtocol = lower;
      }
    }

    const insertQuery = `
      INSERT INTO credentials (device_id, username, encrypted_payload, protocol)
      VALUES ($1, $2, $3, $4)
      RETURNING id, device_id, username, protocol;
    `;

    // Strictly execute insertion without logging raw secret
    const result = await db.query(insertQuery, [
      validatedDeviceId,
      username.trim(),
      encryptedPayload,
      validatedProtocol,
    ]);

    if (isJsonRequest) {
      return res.json({
        success: true,
        credential: {
          id: result.rows[0].id,
          device_id: result.rows[0].device_id,
          username: result.rows[0].username,
          protocol: result.rows[0].protocol,
          masked_payload: vault.maskPayload(),
        },
      });
    }

    res.redirect('/credentials?success=created');
  } catch (err) {
    // Zero-Exposure: Never log request body or sensitive payload
    console.error('Error creating encrypted credential:', err.message);
    const errorMsg = 'Failed to securely encrypt and store credential.';
    if (isJsonRequest) return res.status(500).json({ success: false, error: errorMsg });
    res.redirect(`/credentials?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /credentials/:id/delete - Delete a credential entry
router.post('/:id/delete', async (req, res) => {
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    const errorMsg = 'Invalid credential ID.';
    if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
    return res.redirect(`/credentials?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const result = await db.query('DELETE FROM credentials WHERE id = $1 RETURNING id;', [id]);
    if (result.rowCount === 0) {
      const errorMsg = 'Credential record not found.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/credentials?error=${encodeURIComponent(errorMsg)}`);
    }

    if (isJsonRequest) {
      return res.json({ success: true });
    }
    res.redirect('/credentials?success=deleted');
  } catch (err) {
    console.error('Error deleting credential record:', err.message);
    const errorMsg = 'Failed to delete credential record.';
    if (isJsonRequest) return res.status(500).json({ success: false, error: errorMsg });
    res.redirect(`/credentials?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /credentials/:id/reveal - Secure on-demand authenticated decryption for authorized UI copy/reveal
router.post('/:id/reveal', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid credential ID.' });
  }

  try {
    const result = await db.query('SELECT encrypted_payload FROM credentials WHERE id = $1;', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Credential not found.' });
    }

    const decrypted = vault.decryptPayload(result.rows[0].encrypted_payload);
    // Never write decrypted payload to any log
    res.json({ success: true, payload: decrypted });
  } catch (err) {
    console.error('Error during secure decryption reveal:', err.message);
    res.status(500).json({ success: false, error: 'Decryption failed. Integrity check error.' });
  }
});

module.exports = router;
