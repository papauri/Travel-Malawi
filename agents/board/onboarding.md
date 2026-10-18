# Board — onboarding (Wave 1)

- [onboarding-1] P0 FIXED  server.ts:/api/onboarding/send-welcome — any signed-in user could provision accounts + email credentials to any address → non-admin/marketing callers must manage `hotelId` (canManageHotel) and every recipient must be one of the hotel's own emails or the caller's
- [onboarding-2] P0 FIXED  server.ts:/api/onboarding/send-welcome — email links built from client `Origin` header (phishing links next to a real temp password) → uses the serving host
- [onboarding-3] P0 FIXED  server/onboardingEmail.ts:resolveBaseUrl — base URL for welcome + password-reset emails now allowlisted (platform domain + subdomains, localhost, APP_URL host); anything else falls back to https://ulendomalawi.com
- [onboarding-4] P0 FIXED  src/components/LinkDescriptionModal.tsx:23 — `if (!isOpen) return null` ran before hooks while ManageHotel keeps it mounted → "Rendered more hooks" crash on open; moved after hooks
- [onboarding-5] P2 FIXED  server/onboardingEmail.ts:generateTempPassword — emailed temp password had ~29 bits of entropy → 4 random bytes (~45 bits)
- [onboarding-6] P1 FIXED  server/onboardingEmail.ts:356 — placeholder hotelId 'host-onboarding' produced dead /hotel/host-onboarding + /dashboard/hotel/host-onboarding links → falls back to /dashboard; hotelId URL-encoded
- [onboarding-7] P1 FIXED  src/pages/ListProperty.tsx:3936/3947 — Listing Plan "Selected"/"Upgrade" buttons had no handler (dead buttons when premium plans enabled) → static badge + mailto "Ask about Premium"
- [onboarding-8] P2 FIXED  src/lib/localPropertyParser.ts:14 + src/pages/ListProperty.tsx:61 — USD→MWK conversions rounded to MK 5,000 (AGENTS §4 says 1,000); ListProperty's duplicate converter removed and imports the shared one; MK input step 5000→1000
- [onboarding-9] P2 FIXED  src/components/PropertyDocumentImporter.tsx — file input `accept` omitted .xlsx/.xls though the importer supports them; local parse that finds nothing now shows an error instead of an empty step 2; rooms dropped for missing names are reported via toast
- [onboarding-10] P2 FIXED src/components/MenuImporter.tsx:279 — scanner prices kept as strings/zeros ("14,000") and written to menus → coerced to positive numbers; `{price && …}` rendered a stray "0"
- [onboarding-11] P2 FIXED src/components/ReviewListingModal.tsx:75 — Math.min over unpriced rooms = Infinity → "Configured from $Infinity"; review scraper used legacy `hotel.category` → now `categories[0]` first
- [onboarding-12] P3 FIXED src/pages/ListProperty.tsx:844 — AI-suggested rooms could get baseGuests > maxGuests → clamped
- [onboarding-13] P2 LOGGED server/onboardingEmail.ts:host vault — temp passwords are stored reversibly (AES-GCM) in data/host_credentials.json and re-emailed; key falls back to project id when ENCRYPTION_SECRET unset. Design change (move to reset links only) is out of scope for a minimal fix
- [onboarding-14] P3 LOGGED server/onboardingEmail.ts — hosts can still trigger account provisioning for any owner/manager email they type into their own listing (feature: list on behalf of owner); now limited to the listing's own addresses + rate limit
- [onboarding-15] OK  local parsers — server/localMenuParser.ts re-exports src/lib/localMenuParser.ts; no divergence
- [onboarding-16] OK  wizard: per-step validation, back/next keeps state, per-user draft persistence, final whole-draft validation + duplicate guard, disabled submit while sending
- [onboarding-17] OK  AccessRequestModal is device-permissions prefs (not approval); no defects found
- Open risk: on hosts other than ulendomalawi.com/localhost (e.g. *.run.app without APP_URL) credential-email links point to https://ulendomalawi.com
- tsc: no errors in onboarding files (server.ts errors at ~1799-1815 are in /api/admin/scrape-reviews, not ours)

- [H-platform-c1] DONE wizard writes managerId=uid (listing.ts:459), so creators keep access without the email match; send-welcome already verified by onboarding-1
status: done

# Wave 2 — reset links instead of temp passwords
status: in-progress
- [onboarding-18] P0 FIXED  server/onboardingEmail.ts — welcome emails mailed temp passwords → new accounts get a random 256-bit throwaway password (never stored/emailed); every welcome (new or existing account) carries an Admin SDK generatePasswordResetLink set-your-password link with continueUrl = dashboard on resolveBaseUrl's allowlisted base; without Admin creds Firebase sends its own reset email and ours links to /?auth=reset (resolves onboarding-13)
- [onboarding-19] P0 FIXED  server/onboardingEmail.ts — reversible vault (data/host_credentials.json AES encrypt/decrypt, stored-password sign-in, password rotation + re-email) removed; existing vault file ignored, not deleted. Forgot-password email now reset-link only (no OOB duplicate when link generated). No UI/API displayed stored passwords (grep: none outside this file)
- [onboarding-20] P2 FIXED  server/onboardingEmail.ts — exported pure builders buildWelcomeEmail/buildPasswordResetEmail + resolveBaseUrl/welcomeEmailLinks; senders take optional injected deps (sendEmail, provisionAccount, generateResetLink, findHotelByEmail). server.ts send-welcome comments updated; ListProperty toast "Login credentials" → "Set-your-password link"
- [onboarding-21] TEST     scripts/test-onboarding-reset-links.ts (npx tsx) — 23/23 checks pass: reset link present, continueUrl on allowlisted host, no password, forged Origin → https://ulendomalawi.com, no-Admin-SDK fallback
- [onboarding-22] P1 FIXED  src/lib/localPropertyParser.ts + src/components/PropertyDocumentImporter.tsx — missing currency invented at 1 USD = 1,750 MWK → convertUsdToMwk/convertMwkToUsd removed; new roomPriceFields() keeps only priced currencies (both offered, unpriced, when none found); importer price inputs no longer auto-fill the other currency and show empty instead of 0 (H-booking-3; supersedes onboarding-8 rounding)
- [onboarding-23] P1 FIXED  src/pages/ListProperty.tsx — 1,750 conversions + invented defaults (60/65/70/75/120000, entire-place 120/210000) removed: AI/curated suggested rooms keep only priced currencies, ±price buttons and inputs no longer sync the other currency, rate advisor shows/apply only suggested currencies (no $75 fallback), currency ticks no longer auto-fill and unticking drops that price, "Calc MK from USD"/"Auto-calculate" buttons + "Benchmark ~1,750" badges removed, new rooms start unpriced (H-booking-3)
- [H-booking-3] DONE onboarding-22/23; remaining entire-place defaults live in property's listing.ts/ManageHotel → handed off H-onboarding-1
- [onboarding-24] P1 FIXED  src/pages/ListProperty.tsx:128,1796 — category inference keyed on "kaya mawa"/"pumulani" and name placeholder named Kaya Mawa / Sunbird Capital → names dropped, placeholder "Example Lakeside Lodge" (D1)
- [onboarding-25] P1 FIXED  src/pages/ListProperty.tsx — empty "Popular:" showcase block removed; always-missing registry lookups (handleSelectMalawiPlace regMatch, instant registry match in AI lookup with invented +265 991 234 567 / reservations@property.mw contacts) removed; import dropped (D1, H-ai-1)
- [onboarding-26] P1 FIXED  src/components/PropertyDocumentImporter.tsx:617,720 — placeholders "Kaya Mawa Lodge" / "Cape Maclear Lakeside Lodge" → "Example Lakeside Lodge", sample email → example.com (D1)
- [onboarding-27] P1 FIXED  scripts/test-onboarding-scraper.ts — fixtures Kaya Mawa / Sunbird Capital / Mvuu Camp / kayamawa.com / sunbirdhotels.com → Example Beach Stay / Example City Hotel / Example Safari Camp / example-*.com; 15/15 pass (D1)
- [onboarding-28] OK  src/lib/localPropertyParser.ts, src/lib/descriptionAnalyzer.ts — D1 grep hits are only "kayak" (activity), no property names (D1)
- [H-orch-D1] DONE onboarding-24..28
- [H-ui-2] DONE onboarding-24/26
- [H-ai-1] DONE onboarding-25
- tsc: 0 errors project-wide
status: done
