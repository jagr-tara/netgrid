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
- **Spacing & Grid:** Enforce a strict 4-point or 8-point spacing rhythm for all margins, padding, and gaps. Zero random spacing values.
- **Typography:** Follow existing heading font and body font. Define a strict size/line-height scale.
- **Color & Styling:** Stick to the existing coral, minimal, purposeful color palette. NO sparkles, random emojis, unnecessary purple gradients, or neon effects.
- **Consistency:** All interactive elements MUST share exact border-radius, shadow styles, and padding logic. Do not mix component styles.
- **Interactions:** Hover effects and animations must be subtle, predictable, and tied to user intent. Ensure all functional states (loading, active, disabled) are visually distinct.
- **State Management:** All async actions must have visual loading states (spinners or skeletons). Never load heavy relational data instantly without a transition.
- **Completeness:** Output production-ready markup. Include page titles, meta descriptions, correct footers, functional links, and flawless mobile responsiveness. No placeholder text.