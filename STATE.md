# NETGRID STATE TRACKER

## Database Schema (Active)
- `devices`: id, hostname, device_role, management_ip
- `vlans`: id, vlan_id, name
- `subnets`: id, network (cidr), vlan_id, description
- `ip_addresses`: id, address (inet), subnet_id, device_id, port_name, description
- `credentials`: id, device_id, username, encrypted_payload, protocol
- `flow_matrix`: id, source_subnet_id, destination_subnet_id, target_port, protocol, description

## Completed Routes & Views
- `GET /`: System status and database connection check.
- `GET /ipam`, `POST /ipam`: Subnet dashboard, CIDR validation, and creation modal.
- `GET /ipam/subnets/:id`: Subnet detail view with interactive 'Space Map' grid and allocated IP table.
- `POST /ipam/subnets/:id/ips`: IP allocation endpoint with CIDR boundary check, duplicate validation, and device binding.
- `POST /ipam/subnets/:id/ips/:ipId/delete`: Release IP allocation endpoint.

## Current Task
- Completed IPAM Subnet Detail View & Space Map. Ready for VLAN management module (`/vlans`) or Device inventory (`/devices`).