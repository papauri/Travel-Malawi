# platform — Wave 1 log

- [platform-1] P0 FIXED  firestore.rules:57 — isOwner() matched token email without email_verified → an unverified email/password account using an owner address became global admin in rules; now requires verifiedEmail() (server already did)
- [platform-2] P0 FIXED  firestore.rules:111,127 — isManager()/isManagerAfter() matched managerEmail/ownerEmail/contactEmail without verification (comment claimed otherwise) → signing up with a listing's public contactEmail gave full manager rights (guest PII, edits, delete); now verifiedEmail()
- [platform-3] P1 FIXED  firestore.rules:245 — system/content & system/settings writable only by global admin, but Content/Destinations/Featured-mode controls are shown to admin+marketing → dead buttons; admin/marketing may now write those two docs
- [platform-4] P1 FIXED  firestore.rules:562 — host_onboarding_submissions (HostStarterPack) had no rule → every submission denied and silently lost; added public write-only create in the form's shape, admin/marketing read
- [platform-5] P1 FIXED  firestore.rules:623 — reviews update allowed only the author → AdminReviewScraper inline edit always denied; admin/marketing may moderate (guest/hotel/booking ids still immutable)
- [platform-6] P2 FIXED  firestore.rules:547,555 — conference_rooms/broadcasts update let a manager move a doc onto another hotel; hotelId now pinned for managers
- [platform-7] P3 FIXED  firestore.rules:347 — hotel create could self-set featured:true; must now be false
- [platform-8] P2 FIXED  server/auth.ts:178 — server role strip ignored status 'deactivated' (rules + User type use it); aligned
- [platform-9] P2 FIXED  server/auth.ts:258 — canManageHotel ignored ownerId/createdBy/contactEmail that rules accept → rule-allowed hosts got 403 from archive-images/notify/reminders/onboarding; aligned with rules isManager
- [platform-10] P1 FIXED server.ts:124,1296 — public /api/auth/notify-password-reset put the caller's Origin header into credential/reset email links (phishing via our SMTP); new trustedOrigin() ignores a cross-site Origin
- [platform-11] P2 FIXED server.ts:1306 — /api/onboarding/send-welcome (provisions accounts, sends mail) had no rate limit; added notifyUserLimiter (onboarding added recipient checks in the body)
- [platform-12] P2 FIXED server.ts:1448 — /api/admin/delete-user: non-SafeId uid skipped the admin-protection read; owner accounts without a profile doc deletable by plain admins; 500 leaked err.message → isSafeId, owner-email check via Admin SDK, sendError
- [platform-13] P2 FIXED server.ts:~2002 — no error middleware: malformed/oversized JSON and multer limits returned Express HTML (stack in dev) on /api; added JSON error handler (400/413/500, no stack)
- [platform-14] P2 FIXED src/contexts/AuthContext.tsx:108 — client treated only 'suspended' as locked out; 'revoked'/'deactivated' now sign out too (matches rules/server)
- [platform-15] P2 FIXED src/contexts/AuthContext.tsx:150,406 — follow-up to platform-2: sign-up sends a verification email; hosts matched to a hotel by an unverified email get one verification link per session + toast
- [platform-16] P2 FIXED .env.example — added APP_URL, GEMINI_API_KEY, FIREBASE_PROJECT_ID/API_KEY, ENCRYPTION_SECRET, PORT, NODE_ENV, REMINDERS_STORE, SMTP_ALLOW_INVALID_CERTS, DISABLE_HMR, GOOGLE_APPLICATION_CREDENTIALS
- [platform-17] P2 LOGGED tsconfig.json — no "strict": true despite AGENTS.md "strict mode"; enabling it surfaces errors in every department's files — needs its own wave
- [platform-18] P3 LOGGED src/types.ts:514 — BookingStatus is pending|confirmed|cancelled|rejected; rules accept completed/checked_in/checked_out/no_show and icalService queries completed/checked_in; nothing writes the extra values today
- [platform-19] P3 LOGGED firestore.rules:270 — surveys `allow create: if true` has no shape/size limits (write-only, read restricted)
- [platform-20] P3 LOGGED server.ts:~390 — GET /api/client-telemetry (settings) makes an outbound ipapi.co call per request with no limiter
- [platform-21] P3 LOGGED package.json — name "react-example"
- Checked OK: storage.rules (browser writes only users/{uid}, image type/size); vite.config.ts no `define`/secrets; envSanitizer imported first; express.json 200kb; upload mime allowlist + 16MB + folder allowlist + CSP on /images; no CORS middleware (same-origin; Bearer header forces preflight); /api/admin/* behind adminOnly/requireRole except the deliberately public docs GET; public POSTs (notify, telemetry, surveys, reset) rate-limited; build script matches AGENTS.md; system_logs keys match logger.ts; booking create rule matches HotelDetails payload; .gitignore covers .env*, data/, service accounts.
- Contract change: rules email-based manager match now needs email_verified (handoffs to onboarding, property, ai, booking). email_verified reaches rules only after the ID token refreshes (re-sign-in or ≤1h).
- tsc: no errors in platform-owned code; server.ts:1791-1815 errors are in settings' /api/admin/scrape-reviews edit (handed off).

## Inbox
- [H-onboarding-4] DONE APP_URL added to .env.example

status: done
- [H-booking-2] DONE firestore.rules room_locks — managers may now lock synthetic 'entire-<hotelId>' ids (matches + replace → isManager); applied by orchestrator in wave 2
status: done
status: in-progress
- [platform-22] P1 FIXED  scripts/repair_images.mjs:39-80 — name-keyed plan assigned kaya/pumulani /hotels photos + stock galleries to real lodges → removed; dead main image now cleared to placeholder, no galleries invented (D1)
- [platform-23] P1 FIXED  vite.config.ts:14 — PWA includeAssets precached 'hotels/*.jpg' lodge photos → removed (D1)
- [platform-24] P1 FIXED  scripts/repair-data.mjs:36-57 — OWNERSHIP map named real lodges (Kaya Mawa, Pumulani, Sunbird, Mvuu, Blue Zebra) → removed; orphaned listings go to the fallback test account (D1)
- [H-orch-D1] DONE repair_images.mjs + repair-data.mjs no longer name or picture real properties
- [H-ui-4] DONE vite.config.ts hotels/*.jpg includeAssets and repair_images.mjs /hotels map removed
status: done
status: in-progress
- [platform-25] P2 FIXED src/components/AuthDialog.tsx — restyled with tm-btn/tm-input/tm-label/tm-link/tm-divider; dropped field icons, dark selected tiles and the feature-breakdown box; shorter calm copy and error messages; auth logic unchanged (D2)
- [H-orch-D2] DONE AuthDialog restyled with the tm-* kit, d2 check 0 hits, tsc clean for the file
status: done
