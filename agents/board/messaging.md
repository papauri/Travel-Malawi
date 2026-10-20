status: in-progress
- [messaging-1] P1 FIXED  src/components/BookingChat.tsx:441 — first-confirmation email used stale snapshot arrivalPin (undefined) → uses freshly written PIN
- [messaging-2] P2 FIXED  src/components/BroadcastManager.tsx:41 — double-click sent the same broadcast twice → isSending guard + disabled button
- [messaging-3] P2 FIXED  src/components/CallModal.tsx:64 — mute/camera/speaker toggles carried into next call → reset per localStream
- [messaging-4] P1 FIXED  src/components/CallModal.tsx:71 — incoming call in the open chat never rang → start/stopRinging tied to incomingCall id
- [messaging-5] P2 FIXED  src/components/ReminderTemplatesModal.tsx:86 — fake +265 999 000 000 manager phone sent to guests → falls back to template wording
- [messaging-6] P1 FIXED  src/components/ReminderTemplatesModal.tsx:272 — 0-prefixed local numbers broke wa.me link → whatsappDigits() normalises to 265…
- [messaging-7] P1 FIXED  src/lib/reminderTemplates.ts:234 — {managerPhone} default was a fake number → 'our front desk'
- [messaging-8] P1 FIXED  src/contexts/ChatModalContext.tsx:69,133 — closing a chat ran sessionStorage.clear() (wiped auth/shadow/Ulendo state) → removes only chat-prefixed keys
- [messaging-9] P1 FIXED  src/hooks/useUnreadBroadcasts.ts:62 — broadcasts listener replaced without unsubscribing on each bookings snapshot → leak + duplicate toasts; now unsubbed first
- [messaging-10] P2 FIXED src/hooks/useUnreadBroadcasts.ts:11 — hook mounted 3x announced each broadcast 3x → module-level announced set + toast id
- [messaging-11] P2 FIXED src/hooks/useUnreadBroadcasts.ts:121 — corrupt seenBroadcasts JSON crashed the count → safe reader
- [messaging-12] P2 FIXED src/hooks/useUnreadMessages.ts:98 — initial-load flag cleared after first listener → backlog of 2nd-4th listeners buzzed on every load; waits for all listeners
- [messaging-13] P1 FIXED src/lib/notificationSound.ts:153 — ringer kept ringing after user muted → checks preference each ring
- [messaging-14] P1 FIXED src/lib/notificationSound.ts:250 — new Notification() throws on Android Chrome, aborting snapshot handler → try/catch
- [messaging-15] P1 FIXED src/components/PropertyChat.tsx:98 — manager opening chat overwrote guest's name with manager's own name → manager side uses passed/stored guest name only
- [messaging-16] P1 FIXED src/components/PropertyChat.tsx:279 — listeners attached before chat doc existed were permission-denied and never retried (first inquiry blank) → attach after ensure
- [messaging-17] P1 FIXED src/lib/useWebRTC.ts:215,255 — startCall/answerCall failure left camera/mic running → try/catch + cleanup + toast
- [messaging-18] P2 FIXED src/lib/useWebRTC.ts:105,296 — ICE candidate signalling docs left behind on end/reject → deleteCandidates
- [messaging-19] P1 FIXED src/components/GlobalNotificationManager.tsx:140 — booking-chat calls never rang when chat closed; call listener read stale chat data → shared watchCalls for hotel_chats + live bookings with latest context
- [messaging-20] P2 FIXED src/components/GlobalNotificationManager.tsx:222 — ended-call backlog of a newly watched chat stopped ringing for another chat → only stop for ringing/modified calls
- [messaging-21] P2 FIXED src/components/GlobalNotificationManager.tsx:581 — guest got chime+toast for their own cancellation / chime on every status change → skip own cancel, chime only on announced changes
- [messaging-22] P1 FIXED src/hooks/usePresence.ts:95 — manager's manual away/offline was overwritten by the 2-min heartbeat/visibility change (override flag never set) → manualStatus ref honoured
- [messaging-23] P1 FIXED src/lib/contact.ts:183 — whatsappDigits left 00265…, +265 0991… and bare 9-digit 991… numbers unusable for wa.me → normalised to 265XXXXXXXXX
- [messaging-24] P3 FIXED src/lib/contact.ts:137 — email-pattern comment split by unrelated constants → rejoined
- [messaging-25] P2 FIXED src/hooks/useUnreadMessages.ts:221,286,355,423 — a failed listener never 'reported', so initial-load stayed on forever and the badge never buzzed for new messages → errors count as reported
- [messaging-26] P1 FIXED src/components/ManagerMessageTemplatesHub.tsx:113 — switching property kept previous property's templates in state; next save overwrote the new property → reset on hotel.id change
- [messaging-27] P1 FIXED src/components/ManagerMessageTemplatesHub.tsx:258 — "apply to all" queried the signed-in user's hotels (admin overwrote own listings, not the owner's) and miscounted → uses hotel.managerId, counts updated docs
status: done
status: in-progress
- [messaging-28] P2 FIXED src/components/BookingChat.tsx — dark header/menus/closed banner → white stone chrome; emerald/amber dark voucher+PIN cards → light cards; emoji deposit icons → lucide; buttons → tm-btn; gradient avatar, shadow-2xl, eyebrow removed; sentence-case labels (D2)
- [messaging-29] P2 FIXED src/components/PropertyChat.tsx — dark header/options menu → white stone chrome; emoji deposit icons → lucide; ended-chat buttons → tm-btn; 'Live' pill, pulses, eyebrow, shadow-2xl removed; plainer confirm-dialog and empty-state copy (D2)
- [messaging-30] P2 FIXED src/components/ActiveChatsMenu.tsx — dark header/open-chat banner/item menu → light stone; nested bordered chat cards → flat divided rows; buttons → tm-btn; glass/blur, ping/pulse dots, 'Live sync' footer, eyebrow removed; shorter empty states (D2)
- [messaging-31] P2 FIXED src/components/CallModal.tsx — gray/blue/green call UI → stone; incoming-call card uses tm-h2/tm-btn; blur overlays, shadow-2xl, pulses removed; local preview fits 360px (D2)
- [messaging-32] P2 FIXED src/components/NotificationBell.tsx — dark header/sound toggle → light stone + tm-btn; bordered item cards inside dropdown → flat rows; eyebrow list headers, ping halos, glass/blur, 'Live real-time sync' removed; calmer empty states (D2)
- [messaging-33] P2 FIXED src/components/GlobalNotificationManager.tsx — dark call/message/booking toasts (blue/emerald/amber neon text) → white stone toasts; eyebrows, pulses, boxed quotes, shadow-2xl removed; buttons → tm-btn; 'Booking Confirmed!'/'Live notifications enabled!' de-exclaimed (D2)
- [messaging-34] P2 FIXED src/components/BroadcastManager.tsx — form panel and broadcast cards nested in SectionCard → flat divider/rows; inputs/buttons → tm-label/tm-input/tm-btn; form stacks at 360px; blue icon, eyebrow type label, rounded-full pills removed; 'Broadcast' wording → 'announcement'; toasts de-exclaimed (also chat toasts) (D2)
- [messaging-35] P2 FIXED src/components/ManagerMessageTemplatesHub.tsx — editor card and template cards nested in panel → divider sections/flat rows; form → tm-label/tm-input/tm-btn, grid stacks at 360px; blue/green accents, eyebrows, 'Default' footer badge → inline tm-tag; plainer copy (D2)
- [messaging-36] P2 FIXED src/components/ReminderTemplatesModal.tsx — bordered editor panel inside modal → column with divider; selectable template cards → flat rows; indigo PIN/emerald accents → stone/amber; inputs/buttons → kit (one primary); eyebrow, 'Dispatching...' wording, exclaimed toasts removed; font-mono kept only on booking ref + PIN (D2)
- [messaging-37] P2 FIXED src/contexts/ChatModalContext.tsx — minimised chat button: neon emerald icon, heavy custom shadow, backdrop-blur, scale hover removed; open window rounded-3xl/shadow-2xl → rounded-xl/shadow-sm (D2)
- [messaging-38] P2 FIXED src/components/CallModal.tsx — emerald-300 signal icons on video overlay → stone (new D2 neon-green rule) (D2)
- [H-orch-D2] DONE 10 messaging screens restyled to the D2 kit (messaging-28..38); d2.mjs 34 → 3 hits, all font-mono on booking ref/arrival PIN (legitimate); behaviour unchanged; tsc clean in owned files
status: done
status: in-progress
- [messaging-39] P1 FIXED src/contexts/ChatModalContext.tsx — directory mode: openInquiryChat/openBookingChat (and toggles) no-op with one deduped toast, open chat closed on switch, dock never mounts, no presence listener (D3)
- [messaging-40] P1 FIXED src/hooks/useUnreadMessages.ts — directory mode: no hotel_chats/bookings unread listeners open, counts reset to 0 (so UnreadMessagesProvider, badges and ActiveChatsMenu stay empty) (D3)
- [messaging-41] P1 FIXED src/components/GlobalNotificationManager.tsx — directory mode: no hotel_chats/bookings/calls listeners, no ringing, no notification-permission prompt; ringing call toasts now dismissed when the listeners tear down (D3)
- [messaging-42] P1 FIXED server.ts /api/reminders/send-whatsapp — behind requireBookingMode after requireAuth (403 directory_mode); /api/whatsapp/status and admin-only generic /api/whatsapp/send left on (no guest/booking coupling, admin→host comms) (D3)
- [messaging-43] P1 FIXED server/notifications.ts — sendOfflineNotification sends nothing in directory mode (all callers are booking/chat notices; /api/notify already gated by platform) (D3)
- [messaging-44] P1 FIXED src/components/NotificationBell.tsx — directory mode: bell not rendered (all its content is chat/call/booking alerts and booking-linked lodge announcements); booking mode unchanged (D3)
- [messaging-45] P1 FIXED src/hooks/useUnreadBroadcasts.ts — directory mode: no bookings/broadcasts listener, count 0 (Navbar/MobileNav dots stay clear) (D3)
- [messaging-46] P1 FIXED src/hooks/usePresence.ts — directory mode: no presence listener, no heartbeat/visibility writes, manual status no-op; useManagerPresence returns null (D3)
- [messaging-47] P1 FIXED src/components/{BookingChat,PropertyChat,ReminderTemplatesModal,ManagerMessageTemplatesHub,BroadcastManager}.tsx — mode-gated wrapper default export: in directory mode the body (listeners, WebRTC, writes) never mounts; chats/reminders render nothing, templates/announcements show one plain line; booking mode renders the unchanged body (D3)
- [messaging-48] P1 FIXED src/components/ActiveChatsMenu.tsx — directory mode: menu not rendered (ref.openMenu stays safe) (D3)
- [H-orch-D3] DONE directory mode gates every chat/call/unread/presence/broadcast listener and mount in messaging files (messaging-39..48); openChat no-op + deduped toast; /api/reminders/send-whatsapp + offline notices off; booking mode unchanged; d3.mjs 20 → 0 hits; tsc clean in owned files
status: done
