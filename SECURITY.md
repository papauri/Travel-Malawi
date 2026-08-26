# Security notes

## Open issue: booking documents are world-readable

`firestore.rules` grants `allow read: if true` on the `bookings` collection.
Booking documents contain `guestName`, `guestEmail`, `guestPhone` and
`guestWhatsapp`, so **any guest's contact details can be read by anyone who
knows the project ID**.

The rule cannot simply be tightened, because two flows read bookings while the
visitor is signed out:

- `src/components/AvailabilityCalendar.tsx` — reads bookings for a hotel to
  shade the calendar.
- `src/pages/HotelDetails.tsx` (`checkRoomAvailability`) — re-checks inventory
  immediately before writing a booking.

Firestore rules cannot restrict a read to a subset of fields: granting the read
grants the whole document.

### Recommended fix (pick one)

1. **Derived availability collection.** A Cloud Function mirrors each booking
   into `availability/{hotelId}` holding only `roomTypeId`, `checkIn`,
   `checkOut`, `quantity` and `status`. Make that collection public-read and
   change the two call sites above to read it. Then restrict `bookings` reads
   to the owning guest, the hotel's manager, and admins.
2. **Anonymous auth.** Sign guests in with Firebase Anonymous Authentication so
   every reader is authenticated, then scope `bookings` reads to the guest and
   the owning manager. Cheaper to implement, but a signed-in guest could still
   enumerate other guests' bookings unless combined with option 1.

## The rules in this file are NOT what is deployed

Verified against the live project on 2026-08-27 by loading the app signed out:

- reading `hotels` and `room_types` succeeds;
- reading `bookings` fails with `Missing or insufficient permissions`;
- reading `reviews` fails (the collection has no rule deployed at all).

So the deployed ruleset is stricter than `firestore.rules` in this repo, and two
things are broken in production as a result:

1. **The availability calendar has never worked for signed-out visitors.** It
   reads `bookings` and silently logs the permission error, so every date
   renders from stated inventory only.
2. **The pre-booking availability re-check cannot run**, for the same reason.

The client no longer treats either as fatal: the property page loads its rooms,
occupancy, and reviews as three independent reads, and the pre-write
availability check allows the booking through if the verification query itself
is refused (a booking is a *request*; the property re-checks inventory before
confirming). Deploying the rules in this file restores the real checks.

### Deploy before anything else

```
firebase deploy --only firestore:rules
```

Then re-test signed out: open a property page and confirm the calendar shades
dates, and that a guest booking submits.

## New in these rules

- **`reviews`** — a guest-written review collection. Creation requires the
  review to reference one of the author's own `confirmed` bookings at the hotel
  being reviewed, with a rating of 1–5. Whether the stay has actually finished
  is enforced in the UI, because rules have no clock to compare `checkOut`
  against.
- **Managers can delete bookings.** The dashboard has always had a delete
  button, but the rule only permitted the guest and admins, so every
  manager-side delete failed with a permission error.
- **Guests can only cancel.** The previous update rule let anyone signed in
  write any status to their own booking, so a guest could set their own booking
  to `confirmed` without the property ever seeing it. Guests may now only move a
  booking to `cancelled`; the owning manager may confirm, reject or cancel.
- **Dates, room and price are immutable after creation** for both parties, so a
  confirmed booking cannot be quietly rewritten.
- **Managers cannot approve their own listing.** The `hotels` update rule now
  pins `status` and `managerId` for non-admins.

## Fixed in the current rules

- `hotels` and `room_types` allowed `create: if true`, so anyone could create
  listings without an account. Creation now requires authentication and, for
  rooms, ownership of the parent hotel.
- `bookings` allowed `create: if true` with a completely arbitrary payload. The
  payload is now constrained (status must be `pending`, dates ordered, guest and
  quantity counts positive, totals non-negative) and an authenticated booker
  cannot file a booking under another account's `guestId`.
- `users` allowed `read: if true`, exposing every registered email address.
  Reads are now limited to the account owner and admins.
- Users could set their own `role`, including `admin`, on signup, and could
  change it later. Self-assignment is now limited to `traveller` and
  `hotel_manager`, and role changes on update are rejected. **Admin accounts
  must be provisioned manually** by editing the user document in the Firebase
  console.
- Admins could not approve or reject listings: the previous `hotels` update rule
  only permitted the owning manager, so the admin dashboard's approve/reject
  wrote nothing. Admins now have moderation rights.

## Deploying

Rules changes take effect only once deployed:

```
firebase deploy --only firestore:rules
```

Test the guest (signed-out) booking flow immediately after deploying — it is the
flow most sensitive to these changes.
