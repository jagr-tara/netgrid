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

// IPv4 mathematical conversion helpers
function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

// Generate visual Space Map grid
function generateSpaceMap(subnet, allocatedIps, blockIndex = 0) {
  const isIPv4 = !subnet.cidr.includes(':');
  if (!isIPv4) {
    return {
      isIPv4: false,
      cells: [],
      totalUsable: 0,
      allocatedCount: allocatedIps.length,
      freeCount: 0,
      utilizationPct: 0,
      totalBlocks: 1,
      currentBlock: 0,
    };
  }

  const prefix = subnet.prefix_len;
  const baseInt = ipToInt(subnet.host_address);
  const totalSubnetIps = Math.pow(2, 32 - prefix);

  // If subnet is <= /24, display all IPs. If larger, chunk into /24 blocks for strict memory control.
  const windowSize = Math.min(256, totalSubnetIps);
  const totalBlocks = Math.max(1, Math.ceil(totalSubnetIps / 256));

  let validBlock = parseInt(blockIndex, 10);
  if (isNaN(validBlock) || validBlock < 0 || validBlock >= totalBlocks) {
    validBlock = 0;
  }

  const startOffset = validBlock * 256;
  const currentBaseInt = (baseInt + startOffset) >>> 0;

  const allocMap = new Map();
  allocatedIps.forEach(ip => {
    allocMap.set(ip.address, ip);
  });

  const cells = [];
  for (let i = 0; i < windowSize; i++) {
    const currentIpInt = (currentBaseInt + i) >>> 0;
    const ipStr = intToIp(currentIpInt);
    const globalOffset = startOffset + i;

    let type = 'free';
    const isNetwork = (globalOffset === 0) && (prefix < 31);
    const isBroadcast = (globalOffset === totalSubnetIps - 1) && (prefix < 31);

    let allocData = null;
    if (isNetwork) {
      type = 'network';
    } else if (isBroadcast) {
      type = 'broadcast';
    } else if (allocMap.has(ipStr)) {
      type = 'used';
      allocData = allocMap.get(ipStr);
    }

    const lastOctet = ipStr.split('.')[3];

    cells.push({
      ip: ipStr,
      offset: globalOffset,
      lastOctet: '.' + lastOctet,
      type,
      data: allocData,
    });
  }

  const usable = prefix >= 31 ? totalSubnetIps : Math.max(0, totalSubnetIps - 2);
  const allocatedCount = allocatedIps.length;
  const freeCount = Math.max(0, usable - allocatedCount);
  const utilizationPct = usable > 0 ? ((allocatedCount / usable) * 100).toFixed(1) : 0;

  return {
    isIPv4: true,
    cells,
    windowSize,
    totalBlocks,
    currentBlock: validBlock,
    currentBlockCidr: `${intToIp(currentBaseInt)}/24`,
    totalSubnetIps,
    totalUsable: usable,
    allocatedCount,
    freeCount,
    utilizationPct,
  };
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

// GET /ipam/subnets/:id - Subnet IP details and Space Map view
router.get('/subnets/:id', async (req, res) => {
  const subnetId = parseInt(req.params.id, 10);
  if (isNaN(subnetId)) {
    return res.status(400).render('error', {
      title: 'Invalid Subnet Identifier',
      message: 'The requested subnet ID must be a numeric integer.',
      currentPath: '/ipam',
    });
  }

  try {
    const subnetQuery = `
      SELECT 
        s.id, 
        s.network::text AS cidr,
        host(s.network) AS host_address,
        masklen(s.network) AS prefix_len,
        host(broadcast(s.network)) AS broadcast_address,
        s.vlan_id, 
        s.description, 
        v.vlan_id AS vlan_tag, 
        v.name AS vlan_name
      FROM subnets s
      LEFT JOIN vlans v ON s.vlan_id = v.id
      WHERE s.id = $1;
    `;

    const ipsQuery = `
      SELECT 
        ip.id, 
        host(ip.address) AS address,
        ip.subnet_id, 
        ip.device_id, 
        ip.port_name, 
        ip.description,
        d.hostname AS device_hostname,
        d.device_role AS device_role
      FROM ip_addresses ip
      LEFT JOIN devices d ON ip.device_id = d.id
      WHERE ip.subnet_id = $1
      ORDER BY ip.address ASC;
    `;

    const devicesQuery = `
      SELECT id, hostname, device_role, host(management_ip) AS management_ip
      FROM devices 
      ORDER BY hostname ASC;
    `;

    const [subRes, ipsRes, devRes] = await Promise.all([
      db.query(subnetQuery, [subnetId]),
      db.query(ipsQuery, [subnetId]),
      db.query(devicesQuery),
    ]);

    if (subRes.rows.length === 0) {
      return res.status(404).render('error', {
        title: 'Subnet Not Found',
        message: `No subnet record found matching ID ${subnetId}.`,
        currentPath: '/ipam',
      });
    }

    const subnet = subRes.rows[0];
    const allocatedIps = ipsRes.rows;
    const devices = devRes.rows;

    const blockIndex = req.query.block ? parseInt(req.query.block, 10) : 0;
    const spaceMap = generateSpaceMap(subnet, allocatedIps, blockIndex);

    res.render('subnet-detail', {
      title: `${subnet.cidr} - IP Allocations & Space Map`,
      subnet,
      allocatedIps,
      devices,
      spaceMap,
      currentPath: '/ipam',
      query: req.query,
    });
  } catch (err) {
    console.error('Error fetching subnet details:', err);
    res.status(500).render('error', {
      title: 'Database Error',
      message: 'Failed to retrieve subnet details and host IP allocations.',
      currentPath: '/ipam',
    });
  }
});

// POST /ipam/subnets/:id/ips - Assign new IP to subnet
router.post('/subnets/:id/ips', async (req, res) => {
  const subnetId = parseInt(req.params.id, 10);
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  if (isNaN(subnetId)) {
    const errorMsg = 'Invalid subnet ID.';
    if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
    return res.redirect(`/ipam?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const subRes = await db.query(
      'SELECT id, network::text AS cidr, host(network) AS host_address, masklen(network) AS prefix_len FROM subnets WHERE id = $1',
      [subnetId]
    );

    if (subRes.rows.length === 0) {
      const errorMsg = 'Subnet does not exist.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/ipam?error=${encodeURIComponent(errorMsg)}`);
    }

    const subnet = subRes.rows[0];
    let { address, device_id, port_name, description } = req.body;

    if (!address || !address.trim()) {
      const errorMsg = 'IP address is required.';
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/ipam/subnets/${subnetId}?error=${encodeURIComponent(errorMsg)}`);
    }

    address = address.trim();
    description = description && description.trim() ? description.trim() : null;
    port_name = port_name && port_name.trim() ? port_name.trim() : null;
    const deviceIdNum = device_id && !isNaN(parseInt(device_id, 10)) ? parseInt(device_id, 10) : null;

    // Validate IP containment and network/broadcast address rules via PostgreSQL
    const containmentCheck = await db.query(
      'SELECT ($1::cidr >>= $2::inet) AS is_contained, host(broadcast($1::cidr)) AS broadcast_ip, host($1::cidr) AS network_ip;',
      [subnet.cidr, address]
    );

    if (!containmentCheck.rows[0].is_contained) {
      const errorMsg = `IP address ${address} does not belong within subnet prefix ${subnet.cidr}.`;
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/ipam/subnets/${subnetId}?error=${encodeURIComponent(errorMsg)}`);
    }

    const { broadcast_ip, network_ip } = containmentCheck.rows[0];
    if (subnet.prefix_len < 31 && (address === network_ip || address === broadcast_ip)) {
      const errorMsg = `Address ${address} is reserved as the ${address === network_ip ? 'network identifier' : 'broadcast address'} for this CIDR block.`;
      if (isJsonRequest) return res.status(400).json({ success: false, error: errorMsg });
      return res.redirect(`/ipam/subnets/${subnetId}?error=${encodeURIComponent(errorMsg)}`);
    }

    const insertQuery = `
      INSERT INTO ip_addresses (address, subnet_id, device_id, port_name, description)
      VALUES ($1::inet, $2, $3, $4, $5)
      RETURNING id, host(address) AS address, subnet_id, device_id, port_name, description;
    `;

    const insertRes = await db.query(insertQuery, [address, subnetId, deviceIdNum, port_name, description]);
    const newIp = insertRes.rows[0];

    if (isJsonRequest) {
      return res.status(201).json({
        success: true,
        message: `IP address ${address} successfully assigned.`,
        ip: newIp,
      });
    }

    res.redirect(`/ipam/subnets/${subnetId}?success=1`);
  } catch (err) {
    console.error('Error assigning IP address:', err);
    let errorMsg = 'Failed to assign IP address.';

    if (err.code === '23505') {
      errorMsg = `IP address ${req.body.address} is already allocated.`;
    } else if (err.code === '22P02' || (err.message && err.message.includes('inet'))) {
      errorMsg = 'Invalid IP address syntax.';
    } else if (err.code === '23503') {
      errorMsg = 'Specified device does not exist.';
    }

    if (isJsonRequest) {
      return res.status(400).json({ success: false, error: errorMsg });
    }

    res.redirect(`/ipam/subnets/${subnetId}?error=${encodeURIComponent(errorMsg)}`);
  }
});

// POST /ipam/subnets/:id/ips/:ipId/delete - Release allocated IP
router.post('/subnets/:id/ips/:ipId/delete', async (req, res) => {
  const subnetId = parseInt(req.params.id, 10);
  const ipId = parseInt(req.params.ipId, 10);
  const isJsonRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.is('json');

  try {
    const deleteRes = await db.query(
      'DELETE FROM ip_addresses WHERE id = $1 AND subnet_id = $2 RETURNING id, host(address) AS address;',
      [ipId, subnetId]
    );

    if (deleteRes.rows.length === 0) {
      const errorMsg = 'IP address record not found.';
      if (isJsonRequest) return res.status(404).json({ success: false, error: errorMsg });
      return res.redirect(`/ipam/subnets/${subnetId}?error=${encodeURIComponent(errorMsg)}`);
    }

    if (isJsonRequest) {
      return res.json({
        success: true,
        message: `IP address ${deleteRes.rows[0].address} successfully released.`,
      });
    }

    res.redirect(`/ipam/subnets/${subnetId}?success=released`);
  } catch (err) {
    console.error('Error releasing IP address:', err);
    if (isJsonRequest) return res.status(500).json({ success: false, error: 'Database error releasing IP.' });
    res.redirect(`/ipam/subnets/${subnetId}?error=${encodeURIComponent('Failed to release IP.')}`);
  }
});

module.exports = router;
