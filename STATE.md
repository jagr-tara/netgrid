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
- `GET /topology`: Interactive dynamic client-side network topology graphing engine (`views/topology.ejs`).
- `GET /topology/api`: Asynchronous JSON endpoint returning structured `nodes` (devices in `#0F1115` stark black, subnets in `#D4F0EB` pastel mint) and `edges` (mapping `ip_addresses` connections between devices and subnets).
- `GET /credentials`: Credentials Vault dashboard displaying hardware authentication keys with zero-exposure masked payloads (`views/credentials.ejs`).
- `POST /credentials`: Secure credential storage with native Node.js `crypto` AES-256-GCM encryption and active device binding.
- `POST /credentials/:id/delete`: Cryptographic record deletion endpoint.
- `POST /credentials/:id/reveal`: On-demand secure authenticated decryption endpoint for clipboard copying.
- `GET /flows`: Network Flow Matrix dashboard displaying Layer-3/4 traffic rules with dual SQL `LEFT JOIN`s on `subnets` (`views/flows.ejs`).
- `GET /flows/api`: Asynchronous JSON endpoint for dynamic flow matrix queries.
- `POST /flows`: Create traffic flow rule with strict protocol restriction (TCP, UDP, ICMP), port bounds, and subnet foreign key validation.
- `POST /flows/:id/delete`: Delete traffic flow rule endpoint.

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
  - `/ipam`, `/vlans`, `/devices`, `/credentials`, and `/flows` retain high-density tabular presentation with compact padding and monospace values
  - Subnet Space Map styled with stark black allocated blocks (`#0F1115`) on clean panels with mint hover effects
- Swup.js Transitions & Dynamic Engines:
  - Streamlined Swup transition engine: eliminated vertical translate jumps (`translateY(-6px)` / `translateY(8px)`) which caused font subpixel rasterization jitter and card layout jumping; updated to a clean, silky 140ms opacity cross-fade.
  - Resolved multiple Swup instantiations and script re-execution: added `data-swup-ignore-script` to all footer libraries (`vis-network`, `swup`, `swup-scripts-plugin`, and main footer script) to prevent duplicate execution during navigation.
  - Removed redundant `vis-network` CDN loads and `document.write` fallback that caused document stream interruptions and white flashes.
  - Synchronized navbar active indicators immediately on `visit:start` with target path, eliminating the delay and sudden snap on transition end.
  - Idempotency guards (`dataset.initialized`) enforced across all pages (`ipam`, `vlans`, `devices`, `credentials`, `flows`, `subnet-detail`) to guarantee zero duplicate event listener attachments.
  - Teardown safety: Canvas network instances explicitly destroyed on Swup `visit:start` to eliminate memory leaks during rapid navigation.
  - Universal modal interactions: Dismissal enabled on backdrop click and Escape key press globally across all modules.

## Relational Audit & Validation Status
- **Relational Stress Test**: Injected full dependency chain (VLAN -> Subnet -> Device -> IP Assignment -> Bound Credential -> Flow Matrix Rule). All foreign keys validated and queryable.
- **Cascade Deletion Audit**:
  - Deleted root Device: Successfully triggered PostgreSQL `ON DELETE CASCADE` on `credentials` and `ON DELETE SET NULL` on `ip_addresses` (`device_id = NULL`).
  - Deleted root VLAN: Successfully triggered PostgreSQL `ON DELETE SET NULL` on `subnets` (`vlan_id = NULL`). Zero server errors or unhandled exceptions.
- **Lifecycle & Swup Audit**: Verified client-side remounting across all 7 routes (`/`, `/ipam`, `/vlans`, `/devices`, `/topology`, `/credentials`, `/flows`). Memory stable under rapid navigation with automatic canvas teardown.
- **Theme Polish**: Pixel-perfect alignment of modal backdrops, table padding, search input focus states, and navbar indicators in the Soft Light Dashboard theme.
- **Current State**: Host RAM at 1,364 MB / 3,072 MB (44%), PM2 process at 63.7 MB. All core infrastructure modules production-ready.