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
- `GET /ipam`, `POST /ipam`: Subnet dashboard, CIDR validation, and creation modal (with dynamic VLAN dropdown integration).
- `GET /ipam/subnets/:id`: Subnet detail view with interactive 'Space Map' grid and allocated IP table.
- `POST /ipam/subnets/:id/ips`: IP allocation endpoint with CIDR boundary check, duplicate validation, and device binding.
- `POST /ipam/subnets/:id/ips/:ipId/delete`: Release IP allocation endpoint.
- `GET /vlans`: 802.1Q VLAN inventory dashboard, telemetry metrics, and search filter.
- `GET /vlans/api`: Asynchronous JSON endpoint for dynamic VLAN queries in modal forms.
- `POST /vlans`: Create VLAN tag with standard 802.1Q range validation (1 - 4094) and duplicate protection.
- `POST /vlans/:id/edit`: Edit existing VLAN tag identifier and descriptive name.
- `POST /vlans/:id/delete`: Delete VLAN tag with safe subnet unbinding.
- `GET /devices`: Network hardware inventory with SQL LEFT JOIN counts for bound credentials and IP allocations.
- `GET /devices/api`: Asynchronous JSON endpoint for device querying.
- `POST /devices`: Register hardware with strict HTML <select> role whitelist constraint and optional management IP.
- `POST /devices/:id/edit`: Update device parameters with strict role validation.
- `POST /devices/:id/delete`: Delete hardware node with cascading credential cleanup and IP unbinding.

## Current Task
- Completed Device Registry Module (`/devices`). Next: Build Credentials Vault module (`/credentials`) or Topology Graph (`/topology`).