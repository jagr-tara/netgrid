const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to validate 802.1Q VLAN tag (1 - 4094)
function isValidVlanTag(tag) {
  const num = parseInt(tag, 10);
  return !isNaN(num) && num >= 1 && num <= 4094;
}

// GET /vlans - List all 802.1Q VLANs
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        v.id, 
        v.vlan_id AS tag, 
        v.name,
        COUNT(s.id)::int AS subnet_count
      FROM vlans v
      LEFT JOIN subnets s ON s.vlan_id = v.id
      GROUP BY v.id, v.vlan_id, v.name
      ORDER BY v.vlan_id ASC;
    `;

    const result = await db.query(query);

    res.render('vlans', {
      title: '802.1Q VLAN Inventory',
      vlans: result.rows,
      currentPath: '/vlans',
      query: req.query,
    });
  } catch (err) {
    console.error('Error fetching VLANs:', err);
    res.status(500).render('error', {
      title: 'Database Error',
      message: 'Failed to retrieve VLAN records from database.',
      currentPath: '/vlans',
    });
  }
});

// GET /vlans/api - Dynamic JSON endpoint for IPAM modal integration
router.get('/api', async (req, res) => {
  try {
    const result = await db.query('SELECT id, vlan_id AS tag, name FROM vlans ORDER BY vlan_id ASC;');
    res.json({ success: true, vlans: result.rows });
  } catch (err) {
    console.error('Error fetching VLANs API:', err);
    res.status(500).json({ success: false, error: 'Failed to load VLAN list.' });
  }
});

// POST /vlans - Add a new VLAN
router.post('/', async (req, res) => {
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  try {
    let { vlan_id, name } = req.body;

    if (!vlan_id || !isValidVlanTag(vlan_id)) {
      const errorMsg = 'VLAN ID must be an integer between 1 and 4094 (standard 802.1Q range).';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
    }

    if (!name || !name.trim()) {
      const errorMsg = 'VLAN name is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
    }

    const tagNum = parseInt(vlan_id, 10);
    const nameStr = name.trim();

    const insertQuery = `
      INSERT INTO vlans (vlan_id, name)
      VALUES ($1, $2)
      RETURNING id, vlan_id AS tag, name;
    `;

    const result = await db.query(insertQuery, [tagNum, nameStr]);
    const newVlan = result.rows[0];

    if (isJsonRequest) {
      return res.status(201).json({
        success: true,
        message: `VLAN ${newVlan.tag} (${newVlan.name}) created successfully.`,
        vlan: newVlan,
      });
    }

    res.redirect('/vlans?success=created');
  } catch (err) {
    console.error('Error adding VLAN:', err);
    let errorMsg = 'Failed to create VLAN.';

    if (err.code === '23505') {
      errorMsg = `VLAN ID ${req.body.vlan_id} already exists in the database.`;
    }

    if (isJsonRequest) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /vlans/:id/edit - Edit existing VLAN
router.post('/:id/edit', async (req, res) => {
  const vlanId = parseInt(req.params.id, 10);
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  if (isNaN(vlanId)) {
    const errorMsg = 'Invalid VLAN database ID.';
    if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
    return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    let { vlan_id, name } = req.body;

    if (!vlan_id || !isValidVlanTag(vlan_id)) {
      const errorMsg = 'VLAN ID must be an integer between 1 and 4094.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
    }

    if (!name || !name.trim()) {
      const errorMsg = 'VLAN name is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
    }

    const tagNum = parseInt(vlan_id, 10);
    const nameStr = name.trim();

    const updateQuery = `
      UPDATE vlans
      SET vlan_id = $1, name = $2
      WHERE id = $3
      RETURNING id, vlan_id AS tag, name;
    `;

    const result = await db.query(updateQuery, [tagNum, nameStr, vlanId]);

    if (result.rows.length === 0) {
      const errorMsg = 'VLAN record not found.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
    }

    const updatedVlan = result.rows[0];

    if (isJsonRequest) {
      return res.json({
        success: true,
        message: `VLAN ${updatedVlan.tag} updated successfully.`,
        vlan: updatedVlan,
      });
    }

    res.redirect('/vlans?success=updated');
  } catch (err) {
    console.error('Error updating VLAN:', err);
    let errorMsg = 'Failed to update VLAN.';

    if (err.code === '23505') {
      errorMsg = `VLAN ID ${req.body.vlan_id} is already in use by another record.`;
    }

    if (isJsonRequest) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /vlans/:id/delete - Delete VLAN
router.post('/:id/delete', async (req, res) => {
  const vlanId = parseInt(req.params.id, 10);
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  if (isNaN(vlanId)) {
    const errorMsg = 'Invalid VLAN database ID.';
    if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
    return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const deleteQuery = `
      DELETE FROM vlans
      WHERE id = $1
      RETURNING id, vlan_id AS tag, name;
    `;

    const result = await db.query(deleteQuery, [vlanId]);

    if (result.rows.length === 0) {
      const errorMsg = 'VLAN record not found.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/vlans?error=${encodeURIComponent(errorMsg)}`);
    }

    const deletedVlan = result.rows[0];

    if (isJsonRequest) {
      return res.json({
        success: true,
        message: `VLAN ${deletedVlan.tag} (${deletedVlan.name}) successfully deleted.`,
      });
    }

    res.redirect('/vlans?success=deleted');
  } catch (err) {
    console.error('Error deleting VLAN:', err);
    if (isJsonRequest) return res.status(500).json({ success: false, error: 'Database error deleting VLAN.' });
    res.redirect(`/vlans?error=${encodeURIComponent('Failed to delete VLAN.')}`);
  }
});

module.exports = router;
