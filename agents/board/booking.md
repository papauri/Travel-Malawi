status: in-progress
# booking board (wave 1, resumed run — items 1-24 were applied by the interrupted run, logged from git diff)
- [booking-1] P1 FIXED  server/icalService.ts:46 — addDaysToStr used local-time new Date('YYYY-MM-DD') → UTC calendar stepping
- [booking-2] P0 FIXED  server/icalService.ts:78,187 — export feed with token configured was served when token omitted → returns null without matching token
- [booking-3] P0 FIXED  server/icalService.ts:117,216 — public .ics feed leaked guest name/phone/email → summary/description carry no PII; b.bookingRef → b.reference
- [booking-4] P1 FIXED  server/icalService.ts:311 — import window judged by start date dropped long stays begun >30d ago → judged by end date
- [booking-5] P0 FIXED  server/icalService.ts:353-420 — fetchExternalIcal SSRF (private/metadata hosts, redirects) + unbounded size → public-host check per hop, 5MB cap
- [booking-6] P0 FIXED  server/icalService.ts:479 — syncRoomIcal accepted a room of another hotel → room.hotelId must equal authorised hotelId
- [booking-7] P0 FIXED  server/icalService.ts:526,608 — failed feed fetch wiped last-known iCal blocks (reopened OTA-booked nights) → kept on failure
- [booking-8] P1 FIXED  server/reminders.ts:570 — stale pass list could fire a reminder cancelled/rescheduled mid-pass → re-read before deliver
- [booking-9] P1 FIXED  server.ts:1015 (/api/reminders/auto-generate) — reminders (arrival PIN/deposit) generated for non-confirmed bookings → 409 unless confirmed
- [booking-10] P1 FIXED src/lib/booking.ts:133-170 — entire-place synthetic room duplicated with fake default rates (120 USD / 210k MWK) → shared entirePlaceRoom(), only set rates, unsellable without a rate
- [booking-11] P0 FIXED src/lib/booking.ts:172 — confirm availability check ignored property-wide manual/iCal blocks → withPropertyBlocks()
- [booking-12] P0 FIXED src/lib/bookingWrites.ts:60 — offline replay created new doc each retry (duplicate bookings) → optional fixed bookingId
- [booking-13] P1 FIXED src/lib/ical.ts:161 — client .ics range expansion used local-time Date (TZ drift) → nightsInRange
- [booking-14] P0 FIXED src/lib/validateBooking.ts:101 — validation ignored room iCal-imported blocks → allBlockedDatesForRoom
- [booking-15] P0 FIXED src/lib/offlineBookingsDB.ts:255-300 — replay not idempotent, 'syncing' records stranded after tab close, lock not released on throw → fixed doc id + permission-denied/exists check, syncing retried, try/finally
- [booking-16] P1 FIXED src/lib/offlineBookingsDB.ts:300 — /api/notify body shape differed from online booking (manager never notified) → same shape
- [booking-17] P1 FIXED src/lib/transactions.ts:97-118 — price check ignored child rates → false PriceMismatch on bookings with children
- [booking-18] P1 FIXED src/lib/transactions.ts:151-171 — confirming an entire-place booking threw ROOM_NOT_FOUND; property blocks not applied → synthetic room + withPropertyBlocks
- [booking-19] P1 FIXED src/components/EditBookingModal.tsx:48-74 — check-in could be moved into the past; saving stuck on throw → rejected; try/finally
- [booking-20] P1 FIXED src/components/StayVoucherModal.tsx:65-83 — UTC "today" + PIN unlocked for any status; QR said 'confirmed' always → local date, confirmed-only, real status
- [booking-21] P0 FIXED src/pages/HotelDetails.tsx:557,585 — property iCal blocks not shown/enforced on guest widget → included; entire-place uses shared entirePlaceRoom
- [booking-22] P1 FIXED src/pages/HotelDetails.tsx:1016 — rules/validation rejections queued offline and replayed forever → only network codes queued
- [booking-23] P2 FIXED src/pages/MyBookings.tsx:734,744 — approve/decline clickable while a request was in flight (double submit) → disabled while busy
- [booking-24] P1 FIXED src/pages/MyBookings.tsx:1267 — quick edit saved blank name/invalid email and overwrote separate WhatsApp number → validated; WhatsApp kept
- [booking-25] P2 FIXED server/icalService.ts:82,145 — room .ics feed omitted property-wide closures (OTA could sell a closed property's room) → hotel blockedDates included
- [booking-26] P2 FIXED server.ts:279-370 (/api/calendar/*) — unvalidated ids reached Firestore paths/headers; server-side URL fetch (test-feed/sync) unthrottled → isSafeId checks + ical-fetch rate limit
- [booking-27] P1 FIXED server/reminders.ts:543-565 — reminders (arrival PIN, deposit) still fired for a cancelled/declined booking when the client's best-effort cancel call failed → booking status re-checked before delivery (Firestore store)
- [booking-28] P2 FIXED src/hooks/useOfflineBookings.ts:34 — record left 'syncing' (tab closed mid-sync) was dropped from the pending count though the sync lib retries it → counted as pending
- [booking-29] P2 FIXED src/lib/depositInfo.ts:50 — deposit amount rounded to the unit (e.g. MWK 42,466) against AGENTS.md rounding → roundPrice (MWK nearest 1,000, USD whole)
- [booking-30] P2 FIXED src/pages/MyBookings.tsx:110-135 — host tab ignored ownerId/createdBy (rules grant them) and silently showed nothing for unverified email-matched managers → filter mirrors rules; clear verify-email toast
- [H-platform-c1] DONE booking-owned flow that grants manager access by email is MyBookings host tab → verified users unchanged, unverified now told to verify (booking-30); other email-match screens are property/ai-owned
- [booking-31] P1 LOGGED src/pages/ManageHotel.tsx updateBookingDetails — date edit misses property blocks/child pricing/entire-place → handoff H-booking-1 (property-owned)
- [booking-32] P1 LOGGED firestore.rules:335 room_locks — managers cannot confirm entire-place bookings (synthetic room id has no room_types doc) → handoff H-booking-2 (platform)
- [booking-33] P3 FIXED src/components/AvailabilityCalendar.tsx:134 — no hotelId (unsaved listing) left the calendar in its loading state forever → loading cleared
- [booking-34] P2 FIXED src/components/DatePicker.tsx:19-37 — the first blocked/booked night was disabled as a check-out day, so a stay ending the day another begins could not be picked → allowed as check-out when the nights before it are free
- [booking-35] P2 FIXED src/components/IcalSyncManager.tsx:131,318 — a sync where feeds failed toasted 'Synchronized!' and test-feed errors (400/429 {error}) showed a generic message → failed feeds named in an error toast; server error text shown
status: done
status: in-progress
- [booking-36] P1 FIXED src/pages/HotelDetails.tsx:1211,1217 — schema.org price range put a legacy USD `price` into the MWK range (e.g. "MK 120") → roomPrice(r, 'MWK'|'USD'), manual prices only
- [booking-37] P2 FIXED src/pages/MyBookings.tsx:913 — total fallback used room.price (legacy primary currency) under booking.currency → manual price for that currency, nothing shown when none
- [booking-38] P1 LOGGED onboarding listing wizard/importer/parser invent missing-currency room prices via fixed 1,750 MWK/USD rate → handoff H-booking-3; ManageHotel/BulkRoomEditor/HotelCard/Home checked: no conversion (manual prices via roomPrice/lowestPrice)
status: done
