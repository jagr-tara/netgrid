const express = require('express');
const router = express.Router();
const db = require('../db');

// Strict whitelist of allowed network hardware roles
const ALLOWED_ROLES = [
  'Core Router',
  'Edge Router',
  'Distribution Switch',
  'Access Switch',
  'Firewall',
  'Load Balancer',
];

// Helper to validate IP address format (IPv4 or IPv6)
function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  // IPv4 check
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(trimmed)) {
    const octets = trimmed.split('.').map(Number);
    return octets.every(octet => octet >= 0 && octet <= 255);
  }
  // IPv6 check
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return trimmed.includes(':') && ipv6Regex.test(trimmed);
}

// GET /devices - List all registered devices with credential and IP allocation counts
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        d.id, 
        d.hostname, 
        d.device_role, 
        host(d.management_ip) AS management_ip,
        COUNT(DISTINCT c.id)::int AS credential_count,
        COUNT(DISTINCT ip.id)::int AS ip_count
      FROM devices d
      LEFT JOIN credentials c ON c.device_id = d.id
      LEFT JOIN ip_addresses ip ON ip.device_id = d.id
      GROUP BY d.id, d.hostname, d.device_role, d.management_ip
      ORDER BY d.hostname ASC;
    `;

    const result = await db.query(query);

    res.render('devices', {
      title: 'Device Registry',
      devices: result.rows,
      roles: ALLOWED_ROLES,
      currentPath: '/devices',
      query: req.query,
    });
  } catch (err) {
    console.error('Error fetching devices:', err);
    res.status(500).render('error', {
      title: 'Database Error',
      message: 'Failed to retrieve device records from database.',
      currentPath: '/devices',
    });
  }
});

// GET /devices/api - Dynamic JSON endpoint for device list
router.get('/api', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, hostname, device_role, host(management_ip) AS management_ip FROM devices ORDER BY hostname ASC;'
    );
    res.json({ success: true, devices: result.rows });
  } catch (err) {
    console.error('Error fetching devices API:', err);
    res.status(500).json({ success: false, error: 'Failed to load devices list.' });
  }
});

// POST /devices - Create a new network device
router.post('/', async (req, res) => {
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  try {
    let { hostname, device_role, management_ip } = req.body;

    if (!hostname || !hostname.trim()) {
      const errorMsg = 'Hostname is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
    }

    hostname = hostname.trim();

    // Strict role validation
    if (!device_role || !ALLOWED_ROLES.includes(device_role.trim())) {
      const errorMsg = `Invalid device role. Role must be strictly one of: ${ALLOWED_ROLES.join(', ')}.`;
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
    }

    const validatedRole = device_role.trim();

    let mgmtIp = null;
    if (management_ip && management_ip.trim()) {
      mgmtIp = management_ip.trim();
      if (!isValidIp(mgmtIp)) {
        const errorMsg = 'Invalid Management IP address format.';
        if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
        return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
      }
    }

    const insertQuery = `
      INSERT INTO devices (hostname, device_role, management_ip)
      VALUES ($1, $2, $3::inet)
      RETURNING id, hostname, device_role, host(management_ip) AS management_ip;
    `;

    const result = await db.query(insertQuery, [hostname, validatedRole, mgmtIp]);
    const newDevice = result.rows[0];

    if (isJsonRequest) {
      return res.status(201).json({
        success: true,
        message: `Device ${newDevice.hostname} registered successfully.`,
        device: newDevice,
      });
    }

    res.redirect('/devices?success=created');
  } catch (err) {
    console.error('Error creating device:', err);
    let errorMsg = 'Failed to register device.';

    if (err.code === '23505') {
      errorMsg = `Device hostname "${req.body.hostname}" already exists in the registry.`;
    } else if (err.code === '22P02' || (err.message && err.message.includes('inet'))) {
      errorMsg = 'Invalid Management IP address syntax.';
    }

    if (isJsonRequest) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /devices/:id/edit - Update existing device
router.post('/:id/edit', async (req, res) => {
  const deviceId = parseInt(req.params.id, 10);
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  if (isNaN(deviceId)) {
    const errorMsg = 'Invalid device ID.';
    if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
    return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    let { hostname, device_role, management_ip } = req.body;

    if (!hostname || !hostname.trim()) {
      const errorMsg = 'Hostname is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
    }

    hostname = hostname.trim();

    // Strict role validation
    if (!device_role || !ALLOWED_ROLES.includes(device_role.trim())) {
      const errorMsg = `Invalid device role. Role must be strictly one of: ${ALLOWED_ROLES.join(', ')}.`;
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
    }

    const validatedRole = device_role.trim();

    let mgmtIp = null;
    if (management_ip && management_ip.trim()) {
      mgmtIp = management_ip.trim();
      if (!isValidIp(mgmtIp)) {
        const errorMsg = 'Invalid Management IP address format.';
        if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
        return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
      }
    }

    const updateQuery = `
      UPDATE devices
      SET hostname = $1, device_role = $2, management_ip = $3::inet
      WHERE id = $4
      RETURNING id, hostname, device_role, host(management_ip) AS management_ip;
    `;

    const result = await db.query(updateQuery, [hostname, validatedRole, mgmtIp, deviceId]);

    if (result.rows.length === 0) {
      const errorMsg = 'Device record not found.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
    }

    const updatedDevice = result.rows[0];

    if (isJsonRequest) {
      return res.json({
        success: true,
        message: `Device ${updatedDevice.hostname} updated successfully.`,
        device: updatedDevice,
      });
    }

    res.redirect('/devices?success=updated');
  } catch (err) {
    console.error('Error updating device:', err);
    let errorMsg = 'Failed to update device.';

    if (err.code === '23505') {
      errorMsg = `Device hostname "${req.body.hostname}" is already taken by another record.`;
    } else if (err.code === '22P02' || (err.message && err.message.includes('inet'))) {
      errorMsg = 'Invalid Management IP address syntax.';
    }

    if (isJsonRequest) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /devices/:id/delete - Delete device
router.post('/:id/delete', async (req, res) => {
  const deviceId = parseInt(req.params.id, 10);
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  if (isNaN(deviceId)) {
    const errorMsg = 'Invalid device database ID.';
    if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
    return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const deleteQuery = `
      DELETE FROM devices
      WHERE id = $1
      RETURNING id, hostname;
    `;

    const result = await db.query(deleteQuery, [deviceId]);

    if (result.rows.length === 0) {
      const errorMsg = 'Device record not found.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/devices?error=${encodeURIComponent(errorMsg)}`);
    }

    const deletedDevice = result.rows[0];

    if (isJsonRequest) {
      return res.json({
        success: true,
        message: `Device ${deletedDevice.hostname} successfully deleted.`,
      });
    }

    res.redirect('/devices?success=deleted');
  } catch (err) {
    console.error('Error deleting device:', err);
    if (isJsonRequest) return res.status(500).json({ success: false, error: 'Database error deleting device.' });
    res.redirect(`/devices?error=${encodeURIComponent('Failed to delete device.')}`);
  }
});

module.exports = router;
