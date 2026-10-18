# Lead: settings — Admin Console, Configuration, Logs & Reviews
Owned files: see `agents/README.md` (settings rows). Protocol: `agents/PROTOCOL.md`.

## Mission
Every setting an admin or user changes is saved, reloaded, validated and access-controlled; admin
tooling shows true data.

## Checklist
- Settings round-trip: save → reload shows same value (email, WhatsApp, system settings, docs,
  profile); secrets masked on read and not overwritten by the mask on save.
- Admin-only screens and `/api/admin/*` routes in your prefixes check admin role server-side.
- Test buttons (email/WhatsApp test) report real success/failure.
- Logs & traffic monitor: pagination/filters correct, clear actions confirm, no unbounded
  listeners or memory growth, PII minimised.
- Docs hub & doc editor: edit/reset persist, public `/api/docs/:id` serves only published docs.
- Reviews: scraper validation, date parsing (`reviewDates`), spam filter, ratings aggregated the
  same way wherever shown; guest ReviewModal validation.
- Profile: changes persist, role cannot be self-escalated from the client.
- AdminDashboard tabs: no false unsaved-changes warnings, counts match underlying data.

## Usual handoffs
ai (AI settings), onboarding (listing approvals UI ↔ flow), platform (admin auth, rules).
