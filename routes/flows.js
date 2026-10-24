const express = require('express');
const router = express.Router();
const db = require('../db');

// Protocol whitelist strictly restricted to TCP, UDP, ICMP
const ALLOWED_PROTOCOLS = ['TCP', 'UDP', 'ICMP'];

// GET /flows - Render Flow Matrix dashboard with two SQL LEFT JOINs resolving subnets
router.get('/', async (req, res) => {
  try {
    const flowsQuery = `
      SELECT 
        f.id,
        f.source_subnet_id,
        f.destination_subnet_id,
        f.target_port,
        UPPER(f.protocol) AS protocol,
        f.description,
        src_sub.network::text AS source_subnet,
        src_sub.description AS source_description,
        dst_sub.network::text AS destination_subnet,
        dst_sub.description AS destination_description
      FROM flow_matrix f
      LEFT JOIN subnets src_sub ON f.source_subnet_id = src_sub.id
      LEFT JOIN subnets dst_sub ON f.destination_subnet_id = dst_sub.id
      ORDER BY f.id DESC;
    `;

    const subnetsQuery = `
      SELECT id, network::text, description 
      FROM subnets 
      ORDER BY network ASC;
    `;

    const [flowsResult, subnetsResult] = await Promise.all([
      db.query(flowsQuery),
      db.query(subnetsQuery),
    ]);

    res.render('flows', {
      title: 'Network Flow Matrix',
      currentPath: '/flows',
      flows: flowsResult.rows,
      subnets: subnetsResult.rows,
      protocols: ALLOWED_PROTOCOLS,
      query: req.query,
    });
  } catch (err) {
    console.error('Error fetching flow matrix:', err.message);
    res.status(500).render('error', {
      title: 'Database Error',
      message: 'Failed to retrieve flow matrix records from database.',
      currentPath: '/flows',
    });
  }
});

// GET /flows/api - Asynchronous JSON endpoint for dynamic rule querying
router.get('/api', async (req, res) => {
  try {
    const flowsQuery = `
      SELECT 
        f.id,
        f.source_subnet_id,
        f.destination_subnet_id,
        f.target_port,
        UPPER(f.protocol) AS protocol,
        f.description,
        src_sub.network::text AS source_subnet,
        dst_sub.network::text AS destination_subnet
      FROM flow_matrix f
      LEFT JOIN subnets src_sub ON f.source_subnet_id = src_sub.id
      LEFT JOIN subnets dst_sub ON f.destination_subnet_id = dst_sub.id
      ORDER BY f.id DESC;
    `;
    const result = await db.query(flowsQuery);
    res.json({ success: true, flows: result.rows });
  } catch (err) {
    console.error('Error fetching flow matrix API:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve flow rules.' });
  }
});

// POST /flows - Create a new network flow rule with validation
router.post('/', async (req, res) => {
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  try {
    let { source_subnet_id, destination_subnet_id, protocol, target_port, description } = req.body;

    // Validate Protocol
    if (!protocol || typeof protocol !== 'string') {
      const errorMsg = 'Protocol is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
    }

    const normalizedProtocol = protocol.trim().toUpperCase();
    if (!ALLOWED_PROTOCOLS.includes(normalizedProtocol)) {
      const errorMsg = `Invalid protocol. Must be one of: ${ALLOWED_PROTOCOLS.join(', ')}.`;
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
    }

    // Validate Target Port (PostgreSQL column is integer NOT NULL)
    let parsedPort = 0;
    if (normalizedProtocol === 'ICMP') {
      if (target_port !== undefined && target_port !== null && String(target_port).trim() !== '') {
        const p = parseInt(target_port, 10);
        parsedPort = isNaN(p) ? 0 : p;
      } else {
        parsedPort = 0; // Standard default for ICMP any
      }
    } else {
      // TCP or UDP requires valid destination port (1 - 65535)
      if (target_port === undefined || target_port === null || String(target_port).trim() === '') {
        const errorMsg = `Target port is required for ${normalizedProtocol} traffic rules.`;
        if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
        return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
      }
      parsedPort = parseInt(target_port, 10);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        const errorMsg = 'Target port must be a valid integer between 1 and 65535.';
        if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
        return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
      }
    }

    // Validate Source Subnet
    let parsedSourceId = null;
    if (source_subnet_id && source_subnet_id !== '' && source_subnet_id !== 'none') {
      const srcId = parseInt(source_subnet_id, 10);
      if (!isNaN(srcId) && srcId > 0) {
        const srcCheck = await db.query('SELECT id FROM subnets WHERE id = $1', [srcId]);
        if (srcCheck.rows.length === 0) {
          const errorMsg = 'Selected source subnet does not exist.';
          if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
          return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
        }
        parsedSourceId = srcId;
      }
    }

    // Validate Destination Subnet
    let parsedDestId = null;
    if (destination_subnet_id && destination_subnet_id !== '' && destination_subnet_id !== 'none') {
      const dstId = parseInt(destination_subnet_id, 10);
      if (!isNaN(dstId) && dstId > 0) {
        const dstCheck = await db.query('SELECT id FROM subnets WHERE id = $1', [dstId]);
        if (dstCheck.rows.length === 0) {
          const errorMsg = 'Selected destination subnet does not exist.';
          if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
          return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
        }
        parsedDestId = dstId;
      }
    }

    const trimmedDesc = description && typeof description === 'string' ? description.trim() : null;

    const insertQuery = `
      INSERT INTO flow_matrix (source_subnet_id, destination_subnet_id, target_port, protocol, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, source_subnet_id, destination_subnet_id, target_port, protocol, description;
    `;

    const result = await db.query(insertQuery, [
      parsedSourceId,
      parsedDestId,
      parsedPort,
      normalizedProtocol.toLowerCase(),
      trimmedDesc,
    ]);

    if (isJsonRequest) {
      return res.json({ success: true, flow: result.rows[0] });
    }

    res.redirect('/flows?success=created');
  } catch (err) {
    console.error('Error creating flow rule:', err.message);
    const errorMsg = 'Failed to record flow rule in database.';
    if (isJsonRequest) return res.status(500).json({ success: false, error: errorMsg });
    res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /flows/:id/delete - Delete a flow rule
router.post('/:id/delete', async (req, res) => {
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    const errorMsg = 'Invalid flow rule ID.';
    if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
    return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const result = await db.query('DELETE FROM flow_matrix WHERE id = $1 RETURNING id;', [id]);
    if (result.rowCount === 0) {
      const errorMsg = 'Flow rule record not found.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
    }

    if (isJsonRequest) {
      return res.json({ success: true });
    }
    res.redirect('/flows?success=deleted');
  } catch (err) {
    console.error('Error deleting flow rule:', err.message);
    const errorMsg = 'Failed to delete flow rule.';
    if (isJsonRequest) return res.status(500).json({ success: false, error: errorMsg });
    res.redirect(`/flows?error=${encodeURIComponent(errorMsg)}`);
  }
});

module.exports = router;
