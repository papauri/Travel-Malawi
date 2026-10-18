# Lead: onboarding — Listing Wizard, Importers & Approval
Owned files: see `agents/README.md` (onboarding rows). Protocol: `agents/PROTOCOL.md`.

## Mission
A new host can list a property end to end, and what the wizard writes is exactly what the
manager workspace and public pages expect.

## Checklist
- Wizard steps: validation per step, back/next keeps state, draft persistence, final submit
  writes the same document shape `ManageHotel`/`HotelDetails` read (compare field names).
- Mobile layout of the wizard; no dead buttons or placeholder handlers.
- Document/menu/link importers: failures surfaced to the user, partial results not silently
  dropped, large files rejected with a message, parsed prices respect currency rules.
- Local parsers (`src/lib/localMenuParser.ts` vs `server/localMenuParser.ts`): behaviour
  consistent; if they diverge, log it (cleanup decides dedupe).
- Approval flow (ReviewListingModal, AccessRequestModal): status values consistent with rules
  and admin dashboard; welcome/notification emails fire once and only on the right transition.
- Onboarding email templates: correct links, no PII beyond the recipient's own.

## Usual handoffs
property (listing shape), settings (admin approval UI), platform (rules for pending listings),
ai (`/api/ai/parse-*` contract).
