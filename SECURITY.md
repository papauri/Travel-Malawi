# Security notes

How access is controlled in Travel Malawi, and what is still open.

## Layers

| Layer | File | What it protects |
| --- | --- | --- |
| Firestore rules | `firestore.rules` | Every read and write the browser makes to the database |
| Storage rules | `storage.rules` | The Firebase Storage bucket (not used for uploads; see below) |
| Server auth | `server/auth.ts`, `server.ts` | Every `/api/*` route: AI, email, WhatsApp, reminders, uploads, admin settings |

Rules only take effect once deployed. See "Deploy order" in `BUILD.md`.

## Accounts and roles

- An account holds a list of roles in `roles`. `role` is kept as the first entry for older documents. Read both through `userRoles()` in `src/lib/roles.ts`.
- New accounts may only be `traveller` and/or `hotel_manager`.
- A user may turn hosting on or off for themselves. Any other role they hold must stay exactly as it is.
- Marketing may only switch hosting on or off, and only for ordinary accounts.
- Admins may grant up to `admin`, never `global_admin`, and cannot edit a global admin's record.
- Only a global admin can create another global admin. The owner emails in `OWNER_EMAILS` (`src/lib/roles.ts`) count as global admin only when the address is verified.
- Suspension: an admin sets `accessRevoked: true` or `status: 'suspended'`. The rules treat a suspended account as signed out for every write (`isActive()`), the server gives it no roles, and the user cannot change these fields on their own profile.

## Hotels and managers

- A hotel's manager is `managerId`. A verified email that matches the listing's `managerEmail` or `ownerEmail` also counts.
- A hotel with no manager (`''`, `null` or `'unassigned'`) has no manager. Only admins can manage it and assign one.
- Managers cannot change `managerId`, `status`, `featured` or `adminChatEnabled`. Only admins assign a manager.
- A room can never be moved to another hotel (`room_types.hotelId` is fixed).

## Bookings are private; availability is public

Bookings contain guest names, emails and phone numbers. They can be read only by:

- the guest (`guestId`);
- the manager stored on the booking (`managerId`);
- whoever currently manages the hotel;
- admins and marketing.

Queries must be filtered so the rules can prove access: `guestId == uid`, `managerId == uid`, or `hotelId == <a hotel you manage>`. Admins may list everything.

Availability is computed from **`booking_slots/{bookingId}`**. It is a public mirror holding only `hotelId`, `roomTypeId`, `checkIn`, `checkOut`, `quantity`, `status` and `updatedAt`. The rules require every slot write to happen in the same batch or transaction as its booking, with the fields exactly matching the booking after the write. A slot cannot be invented or altered on its own. All client booking writes go through `src/lib/bookingWrites.ts`, which keeps the two in step.

Existing bookings need a slot before the new rules go live. Run `npm run data:backfill-slots` (see `BUILD.md`).

### Who can change a booking

| Who | Can change |
| --- | --- |
| Guest | Cancel only, their own contact details, and chat bookkeeping fields |
| Hotel manager | Status, PIN, voucher, dates, guests, quantity, total, contact details. Never the guest, hotel, room or creation time. `managerId` may only be set to the hotel's current manager. Edited dates and numbers must still be valid. |
| Admin | Anything |

Signed-out guest checkout still works. A new booking must be `pending`, pass the same bounds as `src/lib/validateBooking.ts`, be filed under the booker's own uid (or `anonymous` when signed out), and carry the hotel's current manager.

Overbooking: confirmation runs in a transaction that bumps `room_locks/{roomTypeId}` and re-checks the slots. Only the room's manager or an admin can touch the lock.

## Chats

- **Booking chats** (`bookings/{id}/messages`, `calls`, `presence`): only the booking's guest, its manager, the hotel's current manager and admins. A sender must be themselves (`senderId == uid`), and message fields must match the booking.
- **Inquiry chats** (`hotel_chats/{hotelId}_{guestUid}`): participants are the guest and manager stored on the chat, plus the hotel's current manager. The chat id must match the hotel and guest. `guestId` and `hotelId` cannot change, and `managerId` can only be moved to the hotel's current manager. Only a participant can post.
- Deleting or clearing a chat is per user (`deletedBy`, `clearedFor`, `chatDeletedBy`, `chatClearedFor`). Shared messages are never deleted from a browser; only admins can delete them.

## Server API

Every `/api/*` route checks the Firebase ID token the browser sends (`src/main.tsx` adds it to same-origin `/api/*` requests). The caller's role is read from their own `users` document. The full route list is in `server.ts`. In short:

- Public: health, docs downloads, survey submit (rate limited), password-reset notice (rate limited).
- Signed in: AI, uploads (image types only, allowlisted folders).
- Hotel manager or admin: reminders and image archiving for that hotel.
- Admin: AI/email/WhatsApp settings, WhatsApp send, account-status emails.
- `/api/notify`: signed out, it can only email the hotel's own contact. Signed in, the recipient must be the booking's guest or the hotel's contact.

All user-supplied text in emails is HTML-escaped. SMTP TLS certificates are verified, and the saved SMTP password is never reused for a different host, port or user.

## Storage

Uploads go to Cloudinary (`src/lib/uploadImage.ts`) and the server's `/api/upload`, not to Firebase Storage. `storage.rules` keeps existing images readable and blocks browser writes to the app folders. The previous rule let any signed-in user replace or delete any property's photos. Only `users/{uid}/` is writable, by that user, for images under 10 MB.

## System logs

`system_logs` accepts entries in the shape `src/lib/logger.ts` writes, with size limits, and only under the writer's own uid (or none). Only admins can read or delete them.

## Known remaining risks

1. **Rate limits are in memory, per server instance.** With several Cloud Run instances, each counts separately and limits reset on restart. Move to a shared store (Redis or Firestore counters) if abuse appears.
2. **Booking totals are calculated in the browser.** The rules check that a total is a non-negative number, not that it is correct. The manager's confirmation step recalculates the price and flags a mismatch, so do not confirm a booking whose total is flagged.
3. **Reminders default to a local JSON file.** They are lost when the container's disk is wiped (Cloud Run redeploys). Set `REMINDERS_STORE=firestore` in production.
4. **Spam on the open booking form.** `src/lib/spam.ts` blocks clear abuse and flags softer signals for the manager. Signed-out bookings are still possible by design.
5. **The Firebase web API key is public by design.** Restrict it by HTTP referrer in Google Cloud.

## Spam and abuse on the booking form

`src/lib/spam.ts` scores each guest submission:

- **Blocked:** signals a real person can't trip by accident (a filled honeypot, a URL in the name, injected markup).
- **Allowed but flagged:** softer signals such as a very fast submission, a throwaway email domain or repeated bookings. The booking goes through with `flagged`, `flagReasons` and `flagScore` set, so the property knows to look twice.

Blocking is deliberately narrow: losing a real guest's booking is worse than a manager reading one junk request.
