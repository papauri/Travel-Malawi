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

## Firebase Storage is not enabled

Verified on 2026-08-27: the project has **no storage buckets at all**. The app
has always uploaded to `promanaged-it.firebasestorage.app`, so every photo
upload — property images, galleries, room photos, menu logos — has failed since
the feature was written.

Enabling it is one click that needs an account with permission to turn on
Google Cloud APIs (the Admin service account does not have it):

1. Firebase Console -> Build -> Storage -> **Get started**, accepting the
   default bucket name.
2. Then, from this repo:

```
node scripts/provision-storage.mjs --apply   # no-op if the console did it
npx firebase deploy --only storage           # publishes storage.rules
```

`storage.rules` allows public reads (every image is on a public listing) and
restricts writes to signed-in users, image content types, files under 8 MB, and
the five folders the app actually uses.

Until Storage is enabled the upload UI now says so explicitly rather than
reporting "Failed to upload image".

## Spam and abuse on the booking form

Guest checkout is open to anyone with the URL and writes straight to Firestore,
so `src/lib/spam.ts` scores each submission. Signals a person cannot trip by
accident — a filled honeypot, a web address in the guest name, injected markup
— block the write. Softer signals — a submission completed in under three
seconds, a throwaway email domain, marketing wording, a placeholder phone
number, several bookings from one browser in ten minutes — let the booking
through but set `flagged`, `flagReasons` and `flagScore` on it so the property
sees why to look twice.

Blocking is deliberately narrow: a false positive costs a real guest their
booking, which is worse than a manager reading one junk request.

The rules enforce the same bounds as `src/lib/validateBooking.ts`, since anyone
can post to the collection directly without going through the form.

## Roles are a set, not a single value

An account holds a list of roles in `roles`, with `role` retained as the first
entry so documents written before this still work. Read through `userRoles()` in
`src/lib/roles.ts` rather than either field directly.

Rules enforce two things:

- A user may not grant themselves a role. `create` restricts the self-assignable
  set to `traveller` and `hotel_manager`; `update` requires `role` and `roles`
  to be unchanged unless the caller is an admin.
- `admin` can only be written out of band — from `scripts/seed-accounts.mjs`,
  which uses the Admin SDK and bypasses rules, or by hand in the console.

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
