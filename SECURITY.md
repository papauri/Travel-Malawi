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
