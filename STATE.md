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

## UI/UX Redesign ("Soft Light Dashboard" Aesthetic)
- Complete overhaul of `/opt/netgrid/public/css/style.css`, `header.ejs`, `navbar.ejs`, and `footer.ejs`.
- Color system extracted from reference dashboard:
  - Cool light-grey outer canvas backdrop (`#EBEEF2`)
  - Crisp pure white workstation card surface (`#FFFFFF`) with diffuse shadows
  - Pastel Mint data panels and active navigation fills (`#D4F0EB`, border: `#BFE5DD`, contrast text: `#0F5144`)
  - Pastel Cyan badges and scope tags (`#E0F2FE`, border: `#BAE6FD`, text: `#0369A1`)
  - Stark Black interactive primary buttons and controls (`#0F1115`, hover: `#22252A`, text: `#FFFFFF`)
  - High-contrast text hierarchy: Deep slate (`#0F172A`), body text (`#1E293B`), refined slate muted (`#64748B`), and clean borders (`#E2E8F0`)
  - Complete removal of former dark charcoal, beige, and neon yellow tokens.
- Geometry & Radii:
  - Softer rounded corners (`20px - 24px`) for layout cards, data tables, and modals
  - Strict pill-shapes (`9999px`) for buttons, toggles, badges, and search inputs
- Typography:
  - Imported Google Font `Poppins` (geometric modern sans-serif) for all UI headings, controls, and labels
  - Preserved `JetBrains Mono` for tabular and network data
- Navigation Architecture:
  - Clean, white, floating header bar preserved at top (not moved to sidebar)
  - Interactive pill cluster with active pastel mint background (`.nav-pill.active`)
  - Telemetry pill with emerald status indicator dot (`#10B981`)
- Data Tables Density:
  - `/ipam`, `/vlans`, and `/devices` retain high-density tabular presentation with compact padding and monospace values
  - Subnet Space Map styled with stark black allocated blocks (`#0F1115`) on clean panels with mint hover effects
- Swup.js Transitions:
  - `#swup` transition container and sliding animations (`200ms` cubic-bezier) preserved and fully functional.

## Current Task
- Completed Soft Light Dashboard aesthetic overhaul. Next: Build Credentials Vault module (`/credentials`) or Topology Graph (`/topology`).