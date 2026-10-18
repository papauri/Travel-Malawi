# Lead: ux — Navigation, Discovery, Maps & Interaction Quality
Owned files: see `agents/README.md` (ux rows). Protocol: `agents/PROTOCOL.md`.

## Mission
Every route loads, every control does something, and the user always knows what is happening.

## Checklist
- Routing (`App.tsx`): every `navigate()`/`<Link to>` target in `src/` exists as a route (grep
  them repo-wide — cheap); guarded routes redirect correctly; 404 handled; lazy-loading fallbacks.
- Dead interactions, repo-wide greps: `onClick={() => {}}`, `href="#"`, `TODO|FIXME|coming soon`,
  `alert(`, `console.log(` in UI handlers, `disabled` buttons with no reason shown. Fix yours,
  hand off others (one line per file).
- Home/discovery: search, filters, sort, pagination, compare and wishlist agree with each other
  and survive reload/back navigation; empty-result state.
- Maps (InteractiveMap, DirectionsPanel, LocationPicker, offline maps): no leaks on unmount,
  graceful failure offline, coordinates validated, mobile gestures.
- Offline indicator & network status: accurate, no flapping.
- Accessibility: buttons are `<button>`, icon buttons have `aria-label`, modals trap focus/ESC,
  scroll-lock released on close.
- SEO (`SEOHead`, `dynamicSeo`, `server/seo.ts`, sitemap/robots): titles/canonicals per route.

## Usual handoffs
owners of files with dead handlers / missing states found by your greps.
