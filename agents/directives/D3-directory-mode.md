# D3 — Directory mode: one switch turns off bookings and in-app chat (owner directive, P1)

The Malawi Department of Tourism (Tourism Act, 2025) is monitoring the platform. The owner wants
Travel Malawi to run as a **pure information directory** unless an admin deliberately switches the
booking platform back on. Directory mode is the default.

## Contract (already in place — consume it, don't re-implement it)
| Where | Use |
|---|---|
| Firestore | `system/settings.platformMode`: `'directory'` \| `'booking'`. Missing/unreadable = `'directory'`. |
| Client | `usePlatformMode()` from `src/contexts/PlatformModeContext.tsx` → `{ mode, bookingsEnabled, loading }`. Provider is mounted in `App.tsx` `RootLayout`. While loading, `bookingsEnabled` is false (no flash of booking UI). |
| Server | `server/platformMode.ts` → `getPlatformMode()`, `bookingsEnabled()`, `invalidatePlatformMode()`, Express guard `requireBookingMode` (403 `{code:'directory_mode'}`). 30 s cache. |
| Docs | Markdown blocks `<!-- booking-only -->…<!-- /booking-only -->` and `<!-- directory-only -->…<!-- /directory-only -->`. Server strips the block that does not match the mode before serving (settings owns the filter). |
| Gate | `node agents/checks/d3.mjs [files]` — lists booking/chat surfaces in files that never reference the switch, and doc wording outside `booking-only` blocks. Heuristic: review each hit. |

## In directory mode (bookingsEnabled === false)
**OFF — not rendered, not subscribed, not callable:**
1. Bookings: booking panels/forms, Book/Reserve/Check availability CTAs, availability calendars used
   for booking, My Bookings, vouchers, edit/cancel booking, deposits, payment instructions, offline
   booking queue, price-mismatch notices, booking reminders (routes + scheduler), iCal sync/feeds,
   booking emails/WhatsApp, booking counts/revenue/occupancy in manager and admin dashboards.
2. In-app chat and calls: BookingChat, PropertyChat (`hotel_chats`), CallModal/WebRTC, ActiveChatsMenu,
   unread-message badges and listeners, chat notifications, guest message/reminder templates.
3. Money: no payments, deposits, commissions, paid/premium placement or listing fees shown anywhere.
4. Ulendo: never offers to book, check availability, hold rooms or message a host; points travellers
   to the property's own contact details. Ops copilot drops booking context and booking actions.

**ON — the directory:** listings, photos, rooms (indicative "from" rates), menus, amenities, maps,
directions, saved/compare, displaying reviews, Ulendo trip planning, host onboarding and listing
management, admin moderation, admin→host broadcasts, the host enquiry form, surveys.

**How a traveller reaches a property:** the listing shows the property's own `contactPhone`,
`contactWhatsapp` (wa.me link), `contactEmail` and social links under "Contact the property", with one
line: "Travel Malawi does not take bookings or payments. Arrangements are made directly with the
property." Travel Malawi takes no part in the exchange.

**Wording:** in directory mode no UI, SEO meta/JSON-LD, email, AI reply or document says book,
booking, reserve, reservation, in-app chat, message the host, deposit or payment (when it means a
platform flow). Use: discover, plan, contact, enquire directly, stay. Static surfaces that cannot read
the mode (`index.html`, manifest, OG tags, sitemap, emails built without the mode) always use
directory wording.

**Direct URLs** to booking-only screens (/my-bookings, chat deep links, vouchers) show one line
("Bookings and in-app messages are switched off. Contact properties directly from their listing.")
plus a link home — never a crash or a blank page.

**Data:** never delete or migrate booking/chat data. Switching back to `'booking'` restores every
flow exactly as before. All booking code stays; it is gated, not removed.

## Compliance support (P2)
- Optional `tourismLicenceNumber?: string` on `Hotel` (platform adds the type). Onboarding collects it
  (optional, next to the existing Tourism Act note); ReviewListingModal and ManageHotel show/edit it;
  HotelDetails shows "Tourism licence no. X (provided by the property)" when present. Never a
  "verified/approved by the Ministry" badge — we have not verified it.
- Listing approval requires at least one direct contact (phone, WhatsApp or email), since that is
  the only way travellers reach the property in directory mode.

## Per lead (only your owned files; cross-file needs → handoff)
- **platform**: `firestore.rules` — `function bookingMode()` reading `system/settings`
  (`get(...).data.get('platformMode','directory') == 'booking'`); require it on **create** of
  `bookings`, `booking_slots`, `bookings/*/messages`, `bookings/*/calls` (+candidates),
  `hotel_chats`, `hotel_chats/*/messages`, `hotel_chats/*/calls` (+candidates). Updates/deletes of
  existing docs stay as they are (wind-down). Changing `platformMode` on `system/settings` requires
  `isAdmin()` (marketing may still edit other settings fields). Types: `tourismLicenceNumber`.
  Any unclaimed `server.ts` route that creates bookings/chats → `requireBookingMode`.
- **booking**: HotelDetails (booking panel → "Contact the property" panel in directory mode; licence
  line), MyBookings notice, all booking components, `server/reminders.ts` scheduler skips while
  directory, `server/icalService.ts`, `/api/calendar/*` and `/api/reminders/*` routes behind
  `requireBookingMode` (keep auth guards).
- **property**: ManageHotel / ManagerDashboard / StayOSManager — hide bookings, calendars, iCal,
  revenue, offline queue, guest messages and reminder-template entry points; keep listing/content
  editing; contact details easy to find; licence number field.
- **onboarding**: ListProperty wording (no promises of bookings, guest chat or calls), licence
  field, require ≥1 direct contact, `server/onboardingEmail.ts` wording (directory wording always),
  ReviewListingModal shows licence + contact.
- **ai**: directory-mode prompt module for Ulendo (trip chat, insights) and ops copilot; booking
  context and booking action proposals dropped server-side via `getPlatformMode()`; UI copy in
  TripAIInsights/AIAssistantButton/OperationsCopilot.
- **messaging**: every chat/call component, context and hook mounts nothing and opens no Firestore
  listener in directory mode; `openChat` becomes a no-op with a short toast; NotificationBell keeps
  non-chat notifications/broadcasts; `server/notifications.ts` sends no chat/booking notices;
  `/api/whatsapp/*` guest/booking sends and `/api/reminders/send-whatsapp` behind `requireBookingMode`.
- **settings**: AdminDashboard — one switch "Bookings and in-app chat" (Off = directory) with a
  confirm dialog, admin-only, writes `platformMode` with merge, logs to system_logs, shows the
  current mode plainly; hide booking tabs/stats and premium plans in directory mode. Docs filter in
  `server/docUtils.ts` + `/api/docs/*` and `/api/admin/docs/:id` read routes (editors still get the
  raw markers when editing). AdminIcalMonitor hidden; ReviewModal/Profile booking bits gated.
- **ui**: rewrite `server/docs/*.md` (and matching `.html`) so booking/chat content sits in
  `booking-only` blocks with `directory-only` replacements; content pages (Terms, Privacy, Refunds,
  HowHostingWorks, StayOwnerLeaflet, MarketingDeck, OperationsStarterPack, PlatformGuideUat,
  HostStarterPack, PropertyListingGuide, ConceptValidationSurvey), Footer (Refunds link only in
  booking mode), Navbar/MobileNav (My Bookings, chats), HotelCard/CompactHotelCard CTAs ("View"),
  `index.html` meta in directory wording.
- **ux**: Home (hero, search — no check-in/out booking wording in directory mode), App routes notice
  pages, `SEOHead`/`dynamicSeo`/`server/seo.ts` (no booking actions/offers in JSON-LD; directory
  wording), `geo.ts` strings, Compare/Saved/TripPlanner/Walkthrough copy.

Log fixes as `[<lead>-n] P1 FIXED <file> — what (D3)`; mark `[H-orch-D3] DONE` in your board.
