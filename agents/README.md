# Department Leads — roster, ownership & run playbook

Tool-agnostic. Any agent can be a lead or the orchestrator. Leads follow `agents/PROTOCOL.md`.
Claude Code also exposes each lead as a subagent (`.claude/agents/lead-*.md`, thin wrappers that
load the same briefs).

## Roster
| Lead | Brief | Domain | Suggested model tier |
|---|---|---|---|
| `booking` | leads/booking.md | booking engine, availability, pricing math, iCal, reminders, guest booking pages | top |
| `property` | leads/property.md | manager workspace: rooms, rates, bulk editor, menus, promos, galleries | top |
| `onboarding` | leads/onboarding.md | listing wizard, document/menu importers, parsers, listing approval | top |
| `ai` | leads/ai.md | Ulendo, provider routing, model registry, prompts, AI settings | top |
| `messaging` | leads/messaging.md | guest↔manager chat, calls, notifications, broadcasts, templates | top |
| `settings` | leads/settings.md | admin console, email/WhatsApp config, logs, traffic, docs hub, reviews, profile | mid |
| `platform` | leads/platform.md | auth, roles, Firestore/Storage rules, server middleware, shared types, build config | top |
| `ui` | leads/ui.md | design system, shared presentational components, content pages | mid |
| `ux` | leads/ux.md | routing, discovery/home, maps, offline, a11y, loading/empty/error states | mid |
| `cleanup` | leads/cleanup.md | dead code, duplicates, stale names, stray files — runs last | mid |

## Write-ownership map (first match wins)
| Path | Owner |
|---|---|
| `firestore.rules`, `storage.rules`, `firebase*.json`, `.firebaserc`, `vite.config.ts`, `tsconfig.json`, `package.json`, `server/auth.ts`, `server/envSanitizer.ts`, `src/types.ts`, `src/lib/{firebase,roles,handleFirestoreError}.ts`, `src/contexts/{AuthContext,AuthDialogContext}.tsx`, `src/components/AuthDialog.tsx`, `scripts/{admin,seed-accounts,repair-data,inspect-data,provision-storage,repair_images,test-approval-lifecycle}.mjs` | platform |
| `server/{aiService,aiConfig,aiSwarm,modelRegistry,opsPrompt,promptUtils}.ts`, `src/components/{OperationsCopilot,TripAIInsights,AIAssistantButton,ShadowManagerModal,ShadowBanner,AdminAISettings,TypewriterCredit}.tsx`, `src/hooks/useAIAssistant.ts`, `src/lib/{assistantMemory,queryIntent,malawiHospitalityRegistry}.ts`, `scripts/swarm-flow-check.ts` | ai |
| `server/{icalService,reminders}.ts`, `src/lib/{availability,booking,bookingWrites,dates,depositInfo,ical,transactions,validateBooking,offlineBookingsDB,currency,promotions}.ts`, `src/hooks/{useConfirmBooking,useOfflineBookings}.ts`, `src/components/{AvailabilityCalendar,DatePicker,EditBookingModal,StayVoucherModal,OfflineBookingsQueue,IcalSyncManager,PriceMismatchNotice,PriceDisplay}.tsx`, `src/pages/{HotelDetails,MyBookings}.tsx`, `scripts/{backfill-booking-slots.mjs,test-ical-sync.ts}` | booking |
| `src/pages/{ManageHotel,ManagerDashboard}.tsx`, `src/components/{BulkRoomEditor,ConferenceManager,MenuEditor,MenuTemplates,OpeningHoursEditor,PromotionsManager,PromotionIcon,GalleryUpload,ImageUpload,RoomGallery,EditableSection,SectionCard,StayOSManager}.tsx`, `src/lib/{validateRoom,listing,hours,uploadImage,images,managerHabits}.ts`, `src/hooks/useUnsavedChanges.ts`, `scripts/seed-restaurants.mjs` | property |
| `src/pages/ListProperty.tsx`, `src/components/{PropertyDocumentImporter,MenuImporter,LinkDescriptionModal,AccessRequestModal,ReviewListingModal}.tsx`, `src/lib/{localPropertyParser,localMenuParser,descriptionAnalyzer}.ts`, `server/{localMenuParser,onboardingEmail}.ts`, `scripts/test-onboarding-scraper.ts` | onboarding |
| `src/components/{BookingChat,PropertyChat,ActiveChatsMenu,CallModal,NotificationBell,GlobalNotificationManager,BroadcastManager,ManagerMessageTemplatesHub,ReminderTemplatesModal}.tsx`, `src/contexts/{ChatModalContext,UnreadMessagesContext}.tsx`, `src/hooks/{useUnreadMessages,useUnreadBroadcasts,usePresence}.ts`, `src/lib/{chatDeletion,contact,notificationSound,useWebRTC,reminderTemplates,shareLinks}.ts`, `server/notifications.ts` | messaging |
| `src/pages/{AdminDashboard,Profile}.tsx`, `src/components/{AdminEmailSettings,AdminWhatsAppSettings,AdminDocsHub,AdminIcalMonitor,AdminLogs,AdminTrafficMonitor,AdminReviewScraper,ReviewModal,DocEditorModal,DocQuickEditButton}.tsx`, `src/hooks/{useSystemSettings,useWhatsAppSettings,useDocContent}.ts`, `src/lib/{logger,trafficMonitor,docUtils,reviewDates,spam}.ts`, `server/{emailConfig,whatsappConfig,docUtils,trafficTracker}.ts`, `scripts/test-scraped-reviews.ts` | settings |
| `src/App.tsx`, `src/main.tsx`, `src/pages/{Home,SavedProperties}.tsx`, `src/components/{InteractiveMap,DirectionsPanel,LocationPicker,OfflineMapManager,OfflineIndicator,TripPlannerD3,WalkthroughTooltip,CompareWidget,PriceRangeFilter,SEOHead}.tsx`, `src/contexts/{CompareContext,WishlistContext}.tsx`, `src/hooks/{useWishlist,useNetworkStatus,useBodyScrollLock,useModalScrollIsolation}.ts`, `src/lib/{geo,mapCache,dynamicSeo,utils}.ts`, `server/seo.ts` | ux |
| everything else under `src/components/`, `src/pages/`, `src/index.css`, `index.html`, `server/docs/*`, `scripts/take-*.mjs`, `scripts/check-validation.ts` | ui |
| `server.ts` | route bodies by prefix: `/api/ai/*`, `/api/admin/ai-*`, `/api/admin/*live-models*`, `/api/ai/parse-*` → ai · `/api/calendar/*`, `/api/reminders/*` (except `send-whatsapp`) → booking · `/api/whatsapp/*`, `/api/reminders/send-whatsapp` → messaging · `/api/admin/{email,whatsapp}-*`, `/api/admin/{docs,traffic,surveys,scrape-reviews}*`, `/api/docs/*`, `/api/telemetry/*`, `/api/client-telemetry` → settings · `/api/menu/*`, `/api/onboarding/*` → onboarding · everything else → platform |

## Who talks to whom (expected handoff lanes)
- **booking ↔ property** — room/rate fields, promotions, blocked dates.
- **booking ↔ messaging** — booking status changes that trigger chats/notifications/reminders.
- **onboarding ↔ property** — listing shape produced by the wizard vs what ManageHotel edits.
- **ai ↔ settings** — AI config persistence; **ai ↔ property/onboarding** — action proposals & importers.
- **platform ↔ everyone** — any rules/type/auth contract change (platform must notify consumers).
- **ui / ux → owners** — cross-file design or UX defects they find but do not own.
- **cleanup** talks to no one; it only removes what it can prove is unused.

## Run playbook (orchestrator — any agent)
1. Clear the board: `rm -rf agents/board && mkdir -p agents/board/inbox`.
2. **Wave 1 (parallel):** start every lead except `cleanup` with: *"You are lead `<x>`. Read
   agents/PROTOCOL.md and agents/leads/<x>.md. Run a full audit-and-patch of your owned files,
   write agents/board/<x>.md, send handoffs per §3."*
3. **Wave 2 (parallel, only leads with a non-empty inbox):** *"Process agents/board/inbox/<x>.md."*
   Prefer resuming the wave-1 session (it already holds the files). Repeat until inboxes are empty
   (normally one pass).
4. **Wave 3:** start `cleanup` alone.
5. **Verify:** `npm run lint`, `npm run build`, `npm run check:validation`. Route any failure to its
   owner by the map above. Then commit + push per `AGENTS.md`.
6. Single-domain bug later? Call just that lead with the bug as its task — no wave needed.
