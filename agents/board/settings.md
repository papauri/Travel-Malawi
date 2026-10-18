status: in-progress
- [H-platform-c2] DONE server.ts:1799 scrape-reviews tsc errors — express Response type shadowed fetch Response; typed resp as Awaited<ReturnType<typeof fetch>>
- [settings-1] P1 FIXED  server/docUtils.ts:507 — saveAdminDoc accepted non-string/empty/oversized content → type, length and non-empty validation added
- [settings-2] P2 FIXED  server/docUtils.ts:611 — resetAdminDoc on never-edited doc returned blank content → returns original file text
- [settings-3] P1 FIXED  server/emailConfig.ts:78 — form echoes (hasPassword/isConfigured/lastTest*) persisted & Clear kept stale password → allow-list of fields, test fields only via recordTest, blank host clears password
- [settings-4] P1 FIXED  server/whatsappConfig.ts:85 — same allow-list/coercion, provider+country code validation, Clear removes token, lastTest* only from test routine
- [settings-5] P1 FIXED  server/whatsappConfig.ts:311 — test reported success when test message undelivered → now success:false/'failed'
- [settings-6] P0 FIXED  server/trafficTracker.ts:321 — client-claimed ip/userId/email/role trusted → identity from verified req.authUser, ip from connection, all fields clipped/validated
- [settings-7] P2 FIXED  server/trafficTracker.ts:121 — unbounded sessions/geoCache/steps growth → 24h prune, geoCache cap, steps cap 60
- [settings-8] P2 FIXED  src/components/AdminEmailSettings.tsx:61, AdminWhatsAppSettings.tsx:57 — silent load failure → error toast
- [settings-9] P2 FIXED  src/pages/Profile.tsx:104 — no name/bio validation, untrimmed → validated (2-80 chars, bio 600) and trimmed
- [settings-10] P2 FIXED  src/components/AdminDocsHub.tsx:75,103 — failed doc load cached as blank doc / silent survey failure → error toast, no cache of failure
- [settings-11] P2 FIXED  src/components/DocEditorModal.tsx:45,90 — save allowed before doc loaded (could blank doc) → stale meta cleared, save blocked until loaded
- [settings-12] P1 FIXED  src/components/AdminLogs.tsx:166 — page index stale after filter/delete; CSV via data: URI truncated at '#' and formula injection → page clamp/reset, Blob URL, formula neutralisation
- [settings-13] P1 FIXED  src/components/AdminTrafficMonitor.tsx:268 — CSV formula injection/'#' truncation → same fix; clear button hidden for non-global-admin; load failure toast
- [settings-14] P1 FIXED  src/components/AdminReviewScraper.tsx:624-911 — unrated reviews counted as 5 stars in average → ratingAverage() numeric ratings only
- [settings-15] P1 FIXED  src/lib/reviewDates.ts:34 — "a month ago"/hours/years unparsed, US dates rolled into wrong year → relative regex extended, impossible d/m/y rejected
- [settings-16] P1 FIXED  src/components/ReviewModal.tsx:63 — guest could review same stay twice; undefined title written to Firestore → reviewed bookings excluded, title omitted when empty
- [settings-17] P2 FIXED  src/hooks/useSystemSettings.ts:26 — snapshot error left loading=true forever → error handler clears loading
- [settings-18] P2 FIXED  src/pages/AdminDashboard.tsx:984 — role-hidden tabs reachable via ?tab= → canViewTab guard on traffic/users/ai/logs/settings
- [settings-19] P2 FIXED  src/pages/AdminDashboard.tsx:397 + server.ts /api/admin/email-listing-status — host got no email on approve/reject → new admin-only route + email sent once per real status change
- [H-onboarding-3] DONE host emailed via new POST /api/admin/email-listing-status (body: email,name,hotelName,status,reason) from handleUpdateStatus only when status actually changes
- [H-settings-1] sent to ui (HostStarterPack download 404)
- [settings-20] P3 FIXED  src/lib/spam.ts:80 — substring spam-phrase match ('seo' in 'Seoul') → whole-word match
status: done
- [settings-21] P1 FIXED  server/docUtils.ts + server.ts /api/admin/docs/:id, /api/docs/:id — all docs readable by anyone → per-doc audience (public: concept-validation-survey, stay-owner-leaflet, host-onboarding-pack; host: property-listing-guide; admin: marketing-presentation, operations-starter-pack, platform-guide-uat; unset = admin), optionalAuth verifies token, non-visible docs answer 404; docs list stays admin/marketing-only
- [H-settings-2] sent to ui (download links need token for admin/host docs); [H-settings-3] sent to ux (publicly routed pages whose docs are now restricted)
status: done
- [settings-22] P1 FIXED  scripts/test-scraped-reviews.ts:7,27,42 — fixtures named a real hotel (Sunbird Mount Soche) and real reserve camp → fictional "Example Lakeside Cottage / Safari Camp / City Hotel" (D1)
- [settings-23] P1 LOGGED server/docUtils.ts + server/docs/* — checked with the D1 grep and a capitalised-name scan: no real property names/photos (only generic "lodge/cottage" wording and the fictional "Baobab Family Cottage" example); nothing to change (D1)
- [H-orch-D1] DONE
- [settings-24] P1 FIXED  src/hooks/useDocContent.ts:12 — /api/docs fetch sent no token and never re-ran after sign-in, so admin/host docs showed defaults → Bearer token sent when signed in, refetch on uid change
- [settings-25] P1 FIXED  src/lib/reviewDates.ts:145-170 — URL heuristics hard-coded real properties (rosalyns-beach, soul-rebel, esthers-guest, /groups/malawitravel/rosalyn…) → property-agnostic rules (TripAdvisor /review- path; any Facebook /groups/*/permalink|posts/ path; Booking slug rule dropped, generic URLs unchanged) (D1)
status: done
