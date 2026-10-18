# Lead: booking — Booking Engine & Inventory
Owned files: see `agents/README.md` (booking rows). Protocol: `agents/PROTOCOL.md`.

## Mission
A guest can never be double-booked, charged the wrong amount, or shown a status that disagrees with
what the manager sees.

## Checklist
- Date validation everywhere a booking is created/edited: `checkOut > checkIn`, no past check-in,
  timezone-safe day maths (no `new Date('YYYY-MM-DD')` UTC drift), nights count consistent across
  HotelDetails, EditBookingModal, voucher, MyBookings, reminders.
- Overbooking: availability check + slot/date-block write are atomic (transaction), cover room
  units, iCal-imported blocks and manual blocks; cancelled bookings free their slots.
- Booking status enum: same values in every reader/writer (pending/confirmed/cancelled/…);
  transitions valid; UI badges map every value.
- Pricing: nightly × nights, promotions/discounts applied once, deposits, MWK rounded to nearest
  1,000 and USD to whole/5 per `AGENTS.md`; currency conversion consistent; PriceDisplay and
  totals agree with what is saved.
- Offline bookings queue: replay is idempotent, conflicts surfaced, no duplicate submits.
- iCal export/import: valid VEVENT dates (DTEND exclusive), dedupe on UID, sync errors logged
  not swallowed; feed endpoints don't leak guest PII.
- Reminders: scheduled for correct booking, cancelled when booking is cancelled, no duplicate sends.
- Guest pages (HotelDetails booking widget, MyBookings): loading/empty/error states, disabled
  submit while pending, cancel/modify flows actually persist.

## Usual handoffs
property (room/rate field shapes, blocked dates), messaging (status-change notifications),
platform (rules for bookings/slots collections).
