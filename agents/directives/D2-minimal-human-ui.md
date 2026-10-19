# D2 — Minimal, uniform, human UI (owner directive, P2)

People must feel *this is easy*. Keep the warm stone/amber theme, cut everything else back.
The app must not look AI-generated. Apply to every screen you own; behaviour stays the same.

## 1. Use the design kit (src/index.css, `tm-*` utilities)
| Need | Use |
|---|---|
| page width | `tm-page` |
| page title / section title / intro / small grey text | `tm-h1` / `tm-h2` / `tm-lead` / `tm-muted` |
| the one container level | `tm-panel` (never a panel inside a panel) · separators `tm-divider` |
| buttons | `tm-btn` + one of `tm-btn-primary` (one per view) · `tm-btn-secondary` · `tm-btn-quiet` · `tm-btn-danger`; small: add `tm-btn-sm` |
| button rows | `tm-actions` (wraps, never overflows) |
| forms | `tm-label`, `tm-input` (also select/textarea) |
| status | `tm-tag` (+ `tm-tag-good` / `tm-tag-warn` / `tm-tag-bad`) |
| inline link | `tm-link` |
Replace hand-rolled equivalents with these. Extra layout utilities (grid, gap, flex) are fine.

## 2. Ban the "AI look"
- No black/near-black panels with green, cyan, lime or neon text; no terminal/console styling;
  `font-mono` only for real codes (booking refs, IDs).
- No gradients, glows, glassmorphism/backdrop-blur cards, heavy shadows (max `shadow-sm`),
  sparkle/✨/🚀 emoji or Sparkles icons as decoration, rainbow badge sets.
- No tiny `uppercase tracking-widest` eyebrow labels everywhere — at most one per page.
- No purple/indigo/violet/teal/cyan accents. Colour = stone neutrals + amber-700/800 accent.
  Green/amber/red only to mean success/warning/error.
- Dark surfaces only where they already belong (e.g. footer, photo overlays).
- Rounded: `rounded-lg` controls, `rounded-xl` panels. No `rounded-3xl` pills on everything.

## 3. Less, calmer content
- One idea per section. Remove repeated explanations, stat walls, decorative cards, duplicate
  CTAs and "why this matters" blocks. If two components show the same thing, keep one.
- Long help/detail → collapsed (`<details>` styled with the kit) or removed.
- Show the 3–5 things a person needs; the rest behind "More" / a tab / a collapse.
- Guides: numbered steps, ≤7 steps, each ≤15 words, one optional "Details" collapse per step.
- Dashboards/admin: summary row (≤4 numbers) → main list/table → actions. Tables scroll inside
  `overflow-x-auto`; long text `truncate`/`break-words`; containers `min-w-0`; nothing may overflow
  its container at 360px width.

## 4. Human wording
- Plain, short, warm, sentence case. Say what happens: "Save rates", "Send to guest", "Add room".
- Ban: seamless, effortless, elevate, unlock, leverage, empower, robust, cutting-edge,
  revolutionary, curated, AI-powered, smart (as hype), supercharge, game-changer, delve,
  "in today's…", exclamation marks in UI chrome.
- Helper text ≤1 sentence. Empty states: one line + one action. Errors: what happened + what to do.
- Keep Chichewa touches sparingly (e.g. "Zikomo" on a thank-you), never as decoration.

## 5. Done means
Each owned screen uses the kit, has no banned look/words, has no nested panels, and holds at
360px and 1280px. Log per screen: `[<lead>-n] P2 FIXED <file> — what was simplified (D2)`.
Don't change behaviour, data flow or routes; don't delete features — collapse or merge them.
