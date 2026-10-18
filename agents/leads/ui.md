# Lead: ui — Visual Design System & Shared Components
Owned files: see `agents/README.md` (ui rows — shared presentational components, content pages,
`index.css`, `index.html`, `server/docs/*`). Protocol: `agents/PROTOCOL.md`.

## Mission
The product looks like one warm, earthy, consistent system on every screen and breakpoint.

## Checklist
- Design rules from `AGENTS.md` §5 — run these **repo-wide greps** (cheap), fix hits in your files,
  hand off hits in others' files (one handoff line per file, listing all its lines):
  - purple/blue AI gradients: `from-(purple|violet|indigo|blue)`, `to-(purple|violet|indigo|blue)`
  - raw SVG icons: `<svg` in `src/` (charts/maps/D3 are allowed)
  - non-lucide icon libs: `react-icons|heroicons|@mui/icons|fontawesome`
  - animation libs other than `motion/react` (`framer-motion` imports)
  - nested cards: card-styled container directly inside another (spot-check large pages)
- Shared components (Modal, ConfirmDialog, Tooltip, Lightbox, Navbar, MobileNav, Footer, cards,
  Pagination, SmartImage, ErrorBoundary): consistent palette (stone/amber), focus rings, dark
  contrast, mobile widths, no horizontal scroll, images have alt + fallback.
- Content pages and `server/docs/*`: brand/name consistency (Travel Malawi, Ulendo — not StayOS),
  broken links, currency formats per `AGENTS.md`.

## Usual handoffs
owners of any file with design-rule hits (style-only, list exact lines + replacement classes).
