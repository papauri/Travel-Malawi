status: in-progress
- [ai-1] P2 FIXED  server/aiService.ts:1764 — executeAIGeneration served curated template text when AI off/no provider/all failed → now throws honest error (reviews return empty)
- [ai-2] P2 FIXED  server/aiService.ts:1777 — override-provider path hid errors except for a magic test string → errors bubble to caller
- [ai-3] P1 FIXED  server/aiService.ts:2543 — connection test could be served from 20-min cache of old key → clearProviderCaches() before test
- [ai-4] P2 FIXED  server/aiService.ts:690 — OpenAI-compatible JSON tasks had no JSON mode → response_format json_object (auto-retry without on 400)
- [ai-5] P2 FIXED  server/aiService.ts:1001 — empty vision extraction got cached per file hash → throws so next model tries
- [ai-6] P2 FIXED  server/aiService.ts:1730 — responseCache unbounded → capped at 300 entries
- [ai-7] P2 FIXED  server/aiService.ts:2303 — small-talk cap 300 → 380 tokens per AGENTS.md
- [ai-8] P1 FIXED  server/aiService.ts:2375 — "all rooms at X" widened proposal to every property → explicit all-properties regex only
- [ai-9] P2 FIXED  server/aiService.ts:3188 — route Q&A returned a scripted M1/M3 answer on AI failure → honest notice
- [ai-10] P2 FIXED server/aiSwarm.ts:337 — liveDataAnswer had canned scope/onboarding/marketing/review scripts and invented default policies → removed / "not set"
- [ai-11] P0 FIXED server/opsPrompt.ts:197 — Wi-Fi password sent in every utilities prompt → only when question mentions Wi-Fi/password; invented defaults → "not set"
- [ai-12] P1 FIXED src/components/OperationsCopilot.tsx:197 — AI proposals applied unvalidated (default "Breakfast Included"/"Standard", fake success) → proposalProblem() validation before any write
- [ai-13] P2 FIXED src/components/TripAIInsights.tsx:554 — scripted route answer/local blueprint on AI failure → toast/notice, aiNotice rendered
- [ai-14] P2 FIXED src/hooks/useAIAssistant.ts:356 — synthesizeClientFallback faked drafts/lookup data (fake phone/email) on errors → removed, honest error toasts
- [ai-15] P2 FIXED server/modelRegistry.ts:240,388 — provider replacement hint (e.g. "use gemini-4.x") was stored/auto-picked though excluded → hints filtered by isExcludedModel
- [ai-16] P1 FIXED server/aiService.ts:2511 — /api/admin/ai-test persisted any submitted key, incl. a masked "abcd••••wxyz" echo, overwriting the real key; unknown provider id crashed → masked keys ignored, provider id validated
- [ai-17] P1 FIXED server.ts:723 — POST /api/admin/ai-config accepted pid "__proto__"/"constructor" (prototype pollution of every object's enabled/model) and null updates crashed → own-key provider id check
- [ai-18] P2 FIXED server/aiService.ts:476 — 5xx retries backed off from 2000ms, below the 4500ms base in AGENTS.md → all transient retries use backoffMs()
- [ai-19] P2 FIXED server/aiService.ts:1648 — scraped reviews with no date got invented months (Feb 2025…) and defaulted to verified:true → date left empty, verified only when reported
- [ai-20] P2 FIXED server/aiService.ts:2238 — small-talk system prompt interpolated per-turn history flag and display name, breaking provider prefix caching → volatile values live only in the user prompt (already there)
- [ai-21] P1 FIXED src/components/OperationsCopilot.tsx:425 — unverified users were given email-matched properties that the rules now deny (bookings silently empty, writes failing) → email match only when verified, clear "verify your email" toast
- [ai-22] P2 FIXED src/components/OperationsCopilot.tsx:1092 — apply-action auth check ignored contactEmail and email verification (rules honour both) → same verified manager/owner/contact match as rules
- [H-platform-c1] DONE Copilot property load + apply check now require emailVerified for email matches and tell unverified users to verify (ai-21, ai-22)
- [ai-23] P2 FIXED src/components/OperationsCopilot.tsx:1279 — AI rate proposals wrote raw prices (e.g. MK 84,932, $94.6) → MWK rounded to nearest 1,000, USD to whole dollars
- [ai-24] P1 FIXED src/components/OperationsCopilot.tsx:1430 — scrape_reviews proposal: 403 for managers / network error still posted "Applied Successfully" and "zero reviews found"; no existingReviews sent so duplicates appended → resp.ok checked, failures return, existing reviews passed for dedupe
- [ai-25] P2 FIXED src/lib/assistantMemory.ts:44 — removing the last learned directive re-seeded the defaults on next read, so deletions never stuck → seed only when nothing was ever stored
- [ai-26] P3 LOGGED server/aiService.ts:4180 — handleCuratedActionFallback's non-review branches and generateCuratedMalawi* templates are now unreachable from routes (only scripts/test-*.ts import two of them) → removal >5 lines, left for cleanup
- checklist verified: key masking + masked-save guard (server.ts:760), Gemini 4000ms queue, 4500ms jittered backoff, 429/503/504 → next model + cooldown, auto model + EXCLUDED_MODELS in candidates/live lists, 404 retire persisted, routed opsPrompt + Anthropic cache_control, 20-min call cache + in-flight dedupe, caps 380/900/1400, JSON mode, vision hash cache, guest contact only on contacts topic
- npx tsc --noEmit: clean
status: in-progress
- [ai-27] P1 FIXED src/lib/malawiHospitalityRegistry.ts:38,1894 — ~140 real lodges/hotels (names, prices, phones) hard-coded for search/auto-fill + 12-name "Popular" showcase → registry and showcase emptied, types/functions kept so geo.ts/ListProperty.tsx compile (D1); H-ai-1 → onboarding for the empty showcase label
- [ai-28] P1 FIXED src/components/TripAIInsights.tsx:87-178 — route-region classifier keyed on real lodge names (Kaya Mawa, Mvuu, Pumulani, Makokola, Blue Zebra, Chelinda, Tongole, Mkulumadzi…) → place names only (D1)
- [ai-29] P1 FIXED server/aiService.ts:190-196,2539,2989 — lookup prompt examples named Kaya Mawa, Sunbird, Makokola, Latitude 13°, Protea Ryalls, Mvuu, Pumulani, Chelinda…; connection test used "Sunbird Livingstonia Beach"; Zomba blueprint sent guests to "Sunbird Ku Chawe" → fictional/place-only wording (D1)
- [ai-30] P1 FIXED server/aiService.ts:3064,3160 — trip-insights and trip-chat prompts did not stop the model recommending lodges outside the itinerary → explicit "only the traveller's stops" rule (D1)
- [ai-31] P1 FIXED server/opsPrompt.ts:47,58,65,104 — core prompt lacked a "only properties in context" rule; examples named Kaya Mawa/Esthers; Satemwa (estate lodge) in food lines → rule added to core + Malawi module, fictional examples, "Thyolo tea" (D1)
- [H-orch-D1] DONE registry/showcase emptied, TripAIInsights/aiService/opsPrompt cleaned, prompts restrict naming to context properties (ai-27..31)
- [H-ui-3] DONE same change as ai-28: TripAIInsights matches place keywords only (likoma, chizumulu, mangochi…)
- npx tsc --noEmit: no errors in ai files (4 errors in onboarding files: localPropertyParser convertUsdToMwk/convertMwkToUsd, onboarding in progress)
- [ai-32] P1 FIXED server/aiService.ts — removed dead fabricators generateCuratedMalawiReviews/PropertyDraft/PropertyLookup/detectMalawiRegion (~750 lines; only tests used them; fake reviews/listings violate D1) (orchestrator, verify)
status: done
status: in-progress
- [ai-33] P2 FIXED src/components/TypewriterCredit.tsx — typing/deleting loop, font-mono, blinking emerald cursor and 4 rotating slogans → one static quiet 'Website by ProManaged IT' line (D2)
- [ai-34] P2 FIXED src/components/ShadowBanner.tsx — near-black bar with emerald pinging dot, uppercase 'Shadow Mode Active' + pill, mono email → calm amber notice 'You're viewing the site as X', kit button 'Back to my account' (D2)
- [ai-35] P2 FIXED src/components/AIAssistantButton.tsx — writing helper: provider-name badge, backdrop-blur, shadow-2xl, rounded-3xl, hand-rolled buttons/input, duplicate Regenerate CTA → kit panel/buttons/input, plain labels ('Write from my details', 'Tidy it up', 'Use this text'), one Try again (D2)
- [ai-36] P2 FIXED src/components/ShadowManagerModal.tsx — host cards nested inside the modal, pill chips, one primary per row, mono emails, 'Security Notice' wording → divided list, kit chips/buttons/tags, 'View as a host' / 'View as host' wording, one-line empty/error text (D2)
- [ai-37] P2 FIXED src/components/TripAIInsights.tsx — route planner: rounded-3xl cards with nested cards, eyebrow pills, emerald accents, 4-tile stat wall (two hard-coded 'M1/M3/M5'/'0% Comm.'), 'Blueprint/Intelligence/Curate' copy → 4 kit panels (plan with divided day list, local tips, before-you-go with packing collapsed, Ask Ulendo chat), plain labels, nights · distance line (D2)
- [ai-38] P2 FIXED src/components/OperationsCopilot.tsx — Ulendo chat: cartoon bellhop avatar on dark gradient → plain 'U' initial; dark blurred launcher with glow → white button; near-black header/menu → light; 'Ulendo Concierge · Live Data' bars, uppercase eyebrows, nested gradient habit cards, 'Confirmation Required'/'Confirm & Apply' wording, dark code block, shadow-xl/2xl → kit buttons/inputs/tags, 'What Ulendo remembers' with habits collapsed, 'Needs your OK' / 'Yes, apply to …', 'Ulendo asks before changing anything' (D2)
- [ai-39] P2 FIXED src/components/AdminAISettings.tsx — AI settings: 'Engine Operational'/'Kill Switch'/'Query All Catalogs'/'Matrix' jargon, dark selected chips, nested live-model box, uppercase table head, mono on labels/errors, 3-column architecture blurb → kit panel/buttons/inputs/tags, plain wording ('AI is on', 'Turn AI off', 'Use this provider', 'Test key'), mono only on keys/model IDs, notes collapsed under 'How this works' (D2)
- [H-orch-D2] DONE 7 Ulendo/AI screens moved to the tm-* kit with plain wording (ai-33..39); D2 check 29 → 11, all 11 legitimate font-mono on API keys, model/provider IDs and inline code
- npx tsc --noEmit: clean
status: done
status: in-progress
- [ai-40] P1 FIXED server/promptUtils.ts — added DIRECTORY_MODE_TRAVELLER / DIRECTORY_MODE_OPS prompt modules (no book/reserve/availability/message-the-host; point to the listing's own contact details) (D3)
- [ai-41] P1 FIXED server/opsPrompt.ts — buildOperationsChatPrompts takes bookingsOn: in directory mode drops BOOKINGS section and booking topic, maps frontdesk agent → coordinator, omits update_booking_status from action schemas, adds DIRECTORY_MODE_OPS module (D3)
- [ai-42] P1 FIXED server/aiService.ts:executeOperationsAssistantChat — reads getPlatformMode(); in directory mode strips context.bookings before any prompt/fallback, small-talk prompt gets directory wording + DIRECTORY_MODE_OPS, update_booking_status proposals dropped server-side (D3)
- [ai-43] P1 FIXED server/aiService.ts:generateTripInsights/executeTripConciergeChat — DIRECTORY_MODE_TRAVELLER appended in directory mode (no book/availability/message host; contact the property directly); fallback "cards accepted at all lodges" claim → confirm with each property (D3)
- [ai-44] P2 FIXED server/aiService.ts SYSTEM_PROMPT — generated listing copy never adds book-now/reserve/check-availability CTAs (stored copy outlives a mode switch) (D3)
- [ai-45] P1 FIXED server/aiSwarm.ts — plain-data fallback answers arrivals/check-outs only in booking mode; onboarding prompt "0% commission, direct WhatsApp messaging" → travellers contact the property directly (D3)
- [ai-46] P1 FIXED src/components/OperationsCopilot.tsx — usePlatformMode(): directory mode loads no bookings (admin + per-hotel queries skipped), sends none to Ulendo, hides arrivals/out bar, refuses update_booking_status apply, no stayos→bookings link rewrite; directory starter prompts, placeholders and front-desk wording on online/offline cards (D3)
- [ai-47] P2 FIXED src/components/TripAIInsights.tsx — single-stop summary "Book directly with your host, with no platform commission" → "Arrange your stay directly with the property"; copied plan footer "book direct with 0% fees" only in booking mode, directory: "contact each property directly" (D3)
- [ai-48] P3 FIXED src/lib/assistantMemory.ts:27 — default learned directive spoke of "domestic resident reservations" (sent to every ops prompt) → "enquiries" (D3)
- [ai-49] P3 FIXED src/components/AIAssistantButton.tsx:70 — toast always said "Applied to description" whatever field was written → uses fieldLabel; helper copy has no booking/chat wording (D3 checked)
- [ai-50] P2 CHECKED server.ts:621-700 — /api/ai/{status,generate,operations-chat,trip-insights,trip-chat} create no bookings/chats and stay on in directory mode (Ulendo is a directory feature); gating happens inside the service via getPlatformMode() (ai-42/43) → no requireBookingMode needed
- [H-orch-D3] DONE directory-mode prompt modules, ops booking context/agent/proposals dropped server-side via getPlatformMode(), Copilot/TripAIInsights/AIAssistantButton copy gated or directory-safe, /api/ai/* reviewed (ai-40..50); d3.mjs on all ai files: 0 hits
- npx tsc --noEmit: clean
status: done
