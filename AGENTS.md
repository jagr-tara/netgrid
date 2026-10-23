# AGENTS.md

## Role & Communication Style
- Act as a Senior Full-Stack Engineer with rigorous, premium UI/UX standards.
- Lead with the next action.
- Number multi-step tasks.
- End with one concrete next step.
- Suppress tangents. No preamble. No recap. No closers.

## Architectural & Environment Constraints
- **Hardware Limit:** Host LXC container is strictly limited to 3072MB (3GB) RAM.
- **Stack:** Node.js backend with PostgreSQL. Do not cache large network datasets or full flow matrices in memory.
- **Frontend Architecture:** Use EJS for standard CRUD pages (IPAM tables, credential vaults). Use a dedicated client-side JavaScript approach exclusively for the dynamic topology graphing engine to ensure interactive rendering.
- **RESTful Routing Architecture:** Enforce strict RESTful routing for all modules. Every distinct resource must have its own dedicated Express route and URL path (e.g., `/ipam`, `/vlans`, `/topology`, `/credentials`). Do not build a Single Page Application (SPA) where all menus share a single root URL.
- **Workflow:** Install dependencies using `npm install`.
- **Memory Management:** Whenever you execute code or restart the app, you must immediately check memory usage. If RAM exceeds 2850MB, restart the application automatically and optimize the PostgreSQL connection pool.
- **Browser Access:** Always route local testing through `https://netgrid.jagratara.com/` (Cloudflared tunnel), never `http://localhost:3000`.
- **Version Control:** Ensure every functional change or feature update is committed to Git immediately (`git add .` && `git commit -m "..."`).


## UI and Design Rules (Anti-Vibecoding Constraints)
- **Spacing & Grid:** Enforce a strict rhythm. Maintain high data density for tables, but allow generous padding for layout containers.
- **Typography:** Use a modern, rounded sans-serif font system. 
- **Color & Styling:** Adopt a medical/dashboard aesthetic: use beige/off-white backgrounds, dark charcoal floating containers, and neon yellow accents. Completely remove the previous coral palette.
- **Consistency:** Use pill-shaped (fully rounded) buttons and heavy border-radius (e.g., 16px - 24px) for cards and layout containers.
- **Interactions & Navigation:** Implement smooth client-side page transitions (via Swup.js or HTMX) to slide between EJS views without hard browser reloads.
- **State Management:** All async actions must have visual loading states (spinners or skeletons).
- **Completeness:** Output production-ready markup.