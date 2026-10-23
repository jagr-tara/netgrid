const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to validate basic CIDR notation format
function isValidCIDR(cidr) {
  if (!cidr || typeof cidr !== 'string') return false;
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) return false;
  const prefix = parseInt(parts[1], 10);
  if (isNaN(prefix)) return false;
  if (parts[0].includes('.')) {
    return prefix >= 0 && prefix <= 32;
  } else if (parts[0].includes(':')) {
    return prefix >= 0 && prefix <= 128;
  }
  return false;
}

// GET /ipam - List all subnets and associated VLANs
router.get('/', async (req, res) => {
  try {
    const subnetsQuery = `
      SELECT 
        s.id, 
        s.network::text AS cidr,
        host(s.network) AS host_address,
        masklen(s.network) AS prefix_len,
        host(broadcast(s.network)) AS broadcast_address,
        s.vlan_id, 
        s.description, 
        v.vlan_id AS vlan_tag, 
        v.name AS vlan_name,
        COUNT(ip.id)::int AS ip_count
      FROM subnets s
      LEFT JOIN vlans v ON s.vlan_id = v.id
      LEFT JOIN ip_addresses ip ON ip.subnet_id = s.id
      GROUP BY s.id, v.vlan_id, v.name
      ORDER BY s.network ASC;
    `;
    const vlansQuery = `
      SELECT id, vlan_id AS tag, name 
      FROM vlans 
      ORDER BY vlan_id ASC;
    `;

    const [subnetsRes, vlansRes] = await Promise.all([
      db.query(subnetsQuery),
      db.query(vlansQuery),
    ]);

    res.render('ipam', {
      title: 'IP Address Management (IPAM)',
      subnets: subnetsRes.rows,
      vlans: vlansRes.rows,
      currentPath: '/ipam',
      query: req.query,
    });
  } catch (err) {
    console.error('Error fetching IPAM subnets:', err);
    res.status(500).render('error', {
      title: 'System Error',
      message: 'Failed to retrieve subnet records from database.',
      currentPath: '/ipam',
    });
  }
});

// POST /ipam - Add new subnet
router.post('/', async (req, res) => {
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  try {
    let { network, description, vlan_id } = req.body;

    if (!network || !network.trim()) {
      const errorMsg = 'Network CIDR is required (e.g. 10.0.0.0/24).';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/ipam?error=${encodeURIComponent(errorMsg)}`);
    }

    network = network.trim();
    description = description && description.trim() ? description.trim() : null;
    const vlanIdNum = vlan_id && !isNaN(parseInt(vlan_id, 10)) ? parseInt(vlan_id, 10) : null;

    if (!isValidCIDR(network)) {
      const errorMsg = 'Invalid CIDR format. Please provide a valid IP and subnet mask (e.g., 192.168.1.0/24).';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/ipam?error=${encodeURIComponent(errorMsg)}`);
    }

    // Insert into subnets using PostgreSQL cidr type
    const insertQuery = `
      INSERT INTO subnets (network, description, vlan_id)
      VALUES ($1::cidr, $2, $3)
      RETURNING id, network::text AS cidr, description, vlan_id;
    `;

    const result = await db.query(insertQuery, [network, description, vlanIdNum]);
    const newSubnet = result.rows[0];

    if (isJsonRequest) {
      return res.status(201).json({
        success: true,
        message: 'Subnet created successfully.',
        subnet: newSubnet,
      });
    }

    res.redirect('/ipam?success=1');
  } catch (err) {
    console.error('Error inserting subnet:', err);
    let errorMsg = 'Failed to create subnet.';

    if (err.code === '23505') {
      errorMsg = 'A subnet with this CIDR network prefix already exists.';
    } else if (err.code === '22P02' || (err.message && err.message.includes('cidr'))) {
      errorMsg = 'Invalid CIDR network value: Ensure host bits to the right of the mask are zero (e.g., 10.0.1.0/24, not 10.0.1.5/24).';
    } else if (err.code === '23503') {
      errorMsg = 'Specified VLAN does not exist in the database.';
    }

    if (isJsonRequest) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    res.redirect(`/ipam?error=${encodeURIComponent(errorMsg)}`);
  }
});

module.exports = router;
