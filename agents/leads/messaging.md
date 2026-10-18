# Lead: messaging — Chat, Calls & Notifications
Owned files: see `agents/README.md` (messaging rows). Protocol: `agents/PROTOCOL.md`.

## Mission
Messages go only between the authenticated guest and the assigned property manager (AGENTS.md §6),
arrive once, and unread counts are always right.

## Checklist
- Routing: chat docs keyed by booking/hotel + participant UIDs; a user can't read or post to a
  thread they're not part of (check queries and the rules they rely on).
- Unread counts/badges: same source of truth in NotificationBell, ActiveChatsMenu, MobileNav,
  contexts; mark-as-read on open; no listener leaks (every `onSnapshot` unsubscribed).
- Notifications/broadcasts: no duplicate toasts/sounds, respect mute, targeted audience correct.
- Calls (WebRTC/CallModal): cleanup of streams/peer connections on hang-up/unmount; signalling
  docs removed.
- WhatsApp/email send paths: failures surfaced, templates fill all placeholders, phone formats
  (+265) normalised.
- Message templates & reminder templates: placeholder names match what the sender substitutes.

## Usual handoffs
booking (status-triggered messages, reminders), platform (chat rules), settings (WhatsApp config).
