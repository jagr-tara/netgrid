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

## UI/UX Redesign (Medical Dashboard Aesthetic)
- Complete rewrite of `/opt/netgrid/public/css/style.css`, `header.ejs`, `navbar.ejs`, and `footer.ejs`.
- Color system extracted from reference dashboard:
  - Medical stone beige canvas (`#E6E4DD`) with dark slate workstation frame (`#2B2E30`)
  - Dark charcoal floating containers, action panels, and docks (`#1E2123`)
  - Neon yellow active indicators, highlights, and pulsing telemetry dots (`#DFFF28`)
  - Crisp high-contrast text (`#17191A`), muted slate labels (`#686C6A`), and clean dividers (`#DCD8CB`)
  - Former coral palette completely removed across all stylesheets and views.
- Geometry & Radii:
  - Extreme layout canvas border radius (`36px`)
  - Layout containers, cards, and modal dialogs (`24px` - `28px`)
  - All navigation items, action buttons, search inputs, and status badges strictly pill-shaped (`9999px`)
- Navigation Architecture:
  - Floating pill-shaped header with console circle action button and bold module title
  - Pill navigation cluster with icons and neon active state indicators
  - Dark charcoal telemetry dock displaying live PostgreSQL 15 status and 3,072 MB RAM constraint
- Data Density:
  - `/ipam`, `/vlans`, and `/devices` data tables retain rigorous tabular density and high legibility with monospace values.
  - Subnet Space Map matrix updated with dark charcoal allocated cells and glowing neon yellow hovers.

## Client-Side Sliding Page Transitions (Swup.js)
- Transition Engine: Local `swup.umd.js` (v4.10.0) and `@swup/scripts-plugin` (v2.1.0) bundled into `/public/js/`.
- Container Layout: `#swup` with `.transition-slide` wrapping page content, modals, and dynamic scripts between navbar and footer.
- Animation Logic:
  - `html.is-animating.is-leaving .transition-slide`: Outgoing view fades out and slides up (`-8px`) over 220ms.
  - `html.is-animating.is-rendering .transition-slide`: Incoming view enters from slightly lower position (`+10px`) and slides into place.
  - Top neon progress bar (`#netgrid-nav-progress`) illuminates during client fetch and transitions.
- Idempotent Re-mount Architecture:
  - Each module exports dedicated initialization functions (`initDashboardPage`, `initIpamPage`, `initVlansPage`, `initDevicesPage`, `initSubnetDetailPage`) with `dataset.initialized` guards.
  - Swup hooks (`page:view` and `content:replace`) trigger `remountActivePageScripts()` to restore Space Map hovers, modal event listeners, and dynamic dropdown fetching.
  - Header navigation active pill states and module scope tags dynamically sync on route change.

## Current Task
- Completed Swup.js sliding page transitions and script re-mounting. Next: Build Credentials Vault module (`/credentials`) or Topology Graph (`/topology`).