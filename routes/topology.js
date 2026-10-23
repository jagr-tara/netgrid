const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /topology - Topology visualization view
router.get('/', async (req, res) => {
  try {
    const devicesCount = await db.query('SELECT COUNT(*)::int AS count FROM devices;');
    const subnetsCount = await db.query('SELECT COUNT(*)::int AS count FROM subnets;');
    const linksCount = await db.query('SELECT COUNT(*)::int AS count FROM ip_addresses WHERE device_id IS NOT NULL AND subnet_id IS NOT NULL;');

    res.render('topology', {
      title: 'Topology Graph',
      currentPath: '/topology',
      metrics: {
        devices: devicesCount.rows[0].count,
        subnets: subnetsCount.rows[0].count,
        links: linksCount.rows[0].count,
      },
    });
  } catch (err) {
    console.error('Error rendering topology view:', err);
    res.status(500).render('error', {
      title: 'Database Error',
      message: 'Failed to retrieve topology data from database.',
      currentPath: '/topology',
    });
  }
});

// GET /topology/api - Dynamic JSON endpoint returning structured nodes and edges
router.get('/api', async (req, res) => {
  try {
    const devicesQuery = `
      SELECT 
        d.id, 
        d.hostname, 
        d.device_role, 
        host(d.management_ip) AS management_ip
      FROM devices d
      ORDER BY d.id ASC;
    `;

    const subnetsQuery = `
      SELECT 
        s.id, 
        s.network::text, 
        s.vlan_id, 
        s.description,
        v.vlan_id AS vlan_tag,
        v.name AS vlan_name
      FROM subnets s
      LEFT JOIN vlans v ON s.vlan_id = v.id
      ORDER BY s.id ASC;
    `;

    const ipQuery = `
      SELECT 
        ip.id, 
        host(ip.address) AS address, 
        ip.subnet_id, 
        ip.device_id, 
        ip.port_name, 
        ip.description,
        d.hostname AS device_hostname,
        s.network::text AS subnet_network
      FROM ip_addresses ip
      JOIN devices d ON ip.device_id = d.id
      JOIN subnets s ON ip.subnet_id = s.id
      ORDER BY ip.id ASC;
    `;

    const [devicesResult, subnetsResult, ipsResult] = await Promise.all([
      db.query(devicesQuery),
      db.query(subnetsQuery),
      db.query(ipQuery),
    ]);

    // Structured JSON array for nodes: combining devices and subnets with distinct types
    const nodes = [];

    // Device Nodes (Stark Black #0F1115 with crisp white text)
    devicesResult.rows.forEach(device => {
      nodes.push({
        id: `device-${device.id}`,
        rawId: device.id,
        label: device.hostname,
        type: 'device',
        role: device.device_role || 'Hardware Node',
        management_ip: device.management_ip || null,
        title: `Device: ${device.hostname}\nRole: ${device.device_role || 'N/A'}\nMgmt IP: ${device.management_ip || 'None'}`,
        color: {
          background: '#0F1115',
          border: '#22252A',
          highlight: {
            background: '#22252A',
            border: '#0F1115',
          },
          hover: {
            background: '#1E2229',
            border: '#0F1115',
          },
        },
        font: {
          color: '#FFFFFF',
          face: 'Poppins, system-ui, sans-serif',
          size: 13,
          strokeWidth: 0,
        },
        shape: 'box',
        margin: 12,
        borderWidth: 2,
        shapeProperties: {
          borderRadius: 12,
        },
      });
    });

    // Subnet Nodes (Pastel Mint #D4F0EB with dark teal #0F5144 text)
    subnetsResult.rows.forEach(subnet => {
      nodes.push({
        id: `subnet-${subnet.id}`,
        rawId: subnet.id,
        label: subnet.network,
        type: 'subnet',
        vlan_id: subnet.vlan_id || null,
        vlan_tag: subnet.vlan_tag || null,
        vlan_name: subnet.vlan_name || null,
        description: subnet.description || '',
        title: `Subnet: ${subnet.network}\nVLAN: ${subnet.vlan_tag ? `VLAN ${subnet.vlan_tag} (${subnet.vlan_name || 'VLAN'})` : 'Untagged'}\nDesc: ${subnet.description || 'N/A'}`,
        color: {
          background: '#D4F0EB',
          border: '#BFE5DD',
          highlight: {
            background: '#C6ECE5',
            border: '#0F5144',
          },
          hover: {
            background: '#C6ECE5',
            border: '#0F5144',
          },
        },
        font: {
          color: '#0F5144',
          face: 'JetBrains Mono, monospace',
          size: 13,
          strokeWidth: 0,
        },
        shape: 'box',
        margin: 12,
        borderWidth: 2,
        shapeProperties: {
          borderRadius: 12,
        },
      });
    });

    // Structured JSON array for edges: mapping ip_addresses connections between devices and subnets
    const edges = ipsResult.rows.map(ip => {
      const edgeLabel = ip.port_name ? `${ip.address} [${ip.port_name}]` : ip.address;
      return {
        id: `edge-${ip.id}`,
        rawId: ip.id,
        from: `device-${ip.device_id}`,
        to: `subnet-${ip.subnet_id}`,
        label: edgeLabel,
        ip: ip.address,
        port_name: ip.port_name || null,
        description: ip.description || null,
        device_hostname: ip.device_hostname,
        subnet_network: ip.subnet_network,
        title: `IP: ${ip.address}\nPort: ${ip.port_name || 'N/A'}\nDevice: ${ip.device_hostname}\nSubnet: ${ip.subnet_network}`,
        color: {
          color: '#94A3B8',
          highlight: '#0F1115',
          hover: '#0F5144',
        },
        width: 2,
        font: {
          color: '#475569',
          size: 11,
          face: 'JetBrains Mono, monospace',
          background: '#FFFFFF',
          strokeWidth: 0,
        },
        smooth: {
          type: 'dynamic',
          roundness: 0.5,
        },
      };
    });

    res.json({
      success: true,
      nodes,
      edges,
      metrics: {
        devices: devicesResult.rows.length,
        subnets: subnetsResult.rows.length,
        links: edges.length,
      },
    });
  } catch (err) {
    console.error('Error generating topology API payload:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve topology dataset.',
    });
  }
});

module.exports = router;
