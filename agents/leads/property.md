# Lead: property — Manager Workspace (rooms, rates, menus, promotions, media)
Owned files: see `agents/README.md` (property rows). Protocol: `agents/PROTOCOL.md`.

## Mission
Everything a property manager edits saves correctly, shows correctly, and never corrupts
another property's data.

## Checklist
- Saves: every editable field round-trips (edit → save → reload shows the same value); no lost
  fields from partial `setDoc` without `merge`; numeric inputs stored as numbers.
- Bulk Room & Rate Editor: % discounts/price drops compute correctly, never negative, rounding per
  `AGENTS.md`; batch writes **preserve `hotelId`** (Firestore rule invariant); selection state
  correct after filter.
- Unsaved-changes guard: no false positives on tab switch, does fire on real edits.
- Tenant safety: manager can only load/edit hotels they own (query filters, not just UI hiding).
- Menus, opening hours, conference rooms, promotions: validation (end > start, required fields),
  delete confirms, empty states.
- Image/gallery upload: size/type checks, progress & failure states, orphaned uploads on cancel,
  reorder/delete persists.
- ManagerDashboard metrics agree with underlying bookings (same status filter as booking lead).
- Legacy "StayOS" naming in user-facing text → "Ulendo" (component/file names stay).

## Usual handoffs
booking (rates/blocked dates consumed by availability), onboarding (listing shape),
ai (action-proposal payloads applied in ManageHotel), platform (rules).
