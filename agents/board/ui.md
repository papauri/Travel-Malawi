# ui — Wave 1 log
Greps: gradients purple/violet/indigo/blue/sky/cyan = 0 hits; icon libs = 0; framer-motion = 0; raw `<svg` = only illustrations/maps/brand mark (allowed): HostStarterPack, HowHostingWorks diagrams, InteractiveMap markers/popups, AuthDialog Google "G" logo, images.ts placeholder data-URI. No handoffs needed.
- [ui-1] P2 FIXED src/components/Footer.tsx — "Follow Us" social links were `href="#"` dead placeholders → column removed, grid 4-col (no social URL setting exists)
- [ui-2] P2 FIXED src/components/MobileNav.tsx — sheet had no Escape/dialog role, close buttons unlabeled, 85vh → dvh
- [ui-3] P2 FIXED src/components/ConfirmDialog.tsx — no aria-labelledby, buttons not type=button, no initial focus (now Cancel)
- [ui-4] P2 FIXED src/components/Tooltip.tsx — hover-only (no keyboard/touch), could overflow narrow screens → button trigger, focus/Esc/tap, role=tooltip, max-w clamp
- [ui-5] P1 FIXED src/components/Lightbox.tsx — arrows with 1 image / index beyond shrunk list; nav/thumb buttons unlabeled; thumbnail strip clipped left items when overflowing (justify-center) → guarded, safeIndex, labels, dialog role, auto-margin centering
- [ui-6] P1 FIXED src/components/Navbar.tsx — `hasProperties` never reset on account switch (previous user's "hosting" menu leaked) + stale async result; initials broke on double spaces; user menu now closes on Escape
- [ui-7] P3 FIXED src/components/HotelCard.tsx — carousel arrows invisible to keyboard focus; compare button lacked aria-label/pressed
- [ui-8] P1 FIXED src/pages/MarketingDeck.tsx:190 — "Cold Math" wrong: 10 rooms x MK 90,000 x 50% x 365 x 15-25% = MK 24.6M-41M, page said MK 8.1M-13.5M
- [ui-9] P3 FIXED src/components/MarkdownContent.tsx — external links now target=_blank rel=noopener
- [ui-10] P2 FIXED src/index.css — added prefers-reduced-motion block for infinite bell animations
- [ui-11] P3 LOGGED indigo (solid, not gradient) accents in MenuImporter, ReminderTemplatesModal, StayOSManager — outside the stone/amber palette but not a banned gradient; not handed off
- [ui-12] P3 LOGGED Footer lacks social links; if wanted, settings/platform must add optional facebookUrl/instagramUrl/twitterUrl to system settings
Checked, no defects: Modal, SmartImage (alt+fallback chain), Pagination, ErrorBoundary, PageLoader, FieldError, Breadcrumbs, CompactHotelCard, index.html (title/meta/og image exists), server/docs brand (Ulendo; no StayOS), currency formats on content pages (MK rounded to 1,000; illustrative MK 4,500 fee line is intentional).

- [H-settings-1] DONE src/pages/HostStarterPack.tsx:63 — download link pointed at nonexistent route/doc id (404) → /api/admin/docs/host-onboarding-pack?format=html&download=1 (orchestrator applied, wave 2)
- [ui-13] P1 FIXED src/pages/{MarketingDeck,OperationsStarterPack,PropertyListingGuide}.tsx + new src/lib/downloadDoc.ts — download buttons navigated without token (404) → shared downloadDocHtml(): fetch with Bearer ID token, blob object-URL save, toast on 401/403/404/failure
- [ui-14] P3 LOGGED useDocContent (settings-owned) fetches /api/docs/:id without token and ignores non-OK → pages already degrade to default title/subtitle; admins just won't see customised title for admin/host docs (settings could add the Bearer token)
- [H-settings-2] DONE download buttons now send ID token via src/lib/downloadDoc.ts, save blob, toast on failure
- [ui-15] P1 FIXED index.html:34-44,76 — og/twitter/JSON-LD image was /hotels/kaya_main.jpg + "Kaya Mawa" alt → /icons/icon-512.png, brand alt, 512x512, twitter:card summary (D1)
- [ui-16] P1 FIXED scripts/check-validation.ts — kayaMawa fixture → likomaPin; 'Sunbird Capital'/sunbird.mw → 'Example Capital Hotel'/example.com (D1)
- [ui-17] P1 FIXED scripts/take-screenshots.mjs:66 — log text named Pumulani Lodge → generic (D1)
- [ui-18] P1 FIXED src/pages/HostStarterPack.tsx:1256 — placeholder named Makokola → "Example Lakeside Cottage" (D1)
- [ui-19] P1 LOGGED public/hotels/*.jpg NOT deleted — still referenced by src/lib/images.ts (property), SEOHead.tsx + dynamicSeo.ts (ux), vite.config.ts + scripts/repair_images.mjs (platform); handoffs H-ui-1..5 sent; delete once grep for hotels/*.jpg is empty (D1)
- [H-orch-D1] DONE index.html, check-validation, take-screenshots, HostStarterPack fixed; no lodge names in other ui content pages/server/docs; public/hotels deletion pending others (ui-19)
- [H-orch-D1] DONE public/hotels/*.jpg (13 lodge photos: kaya/makokola/pumulani/rosalyn) git rm'd by orchestrator after grep showed zero references in src/server/scripts/index.html/vite.config
- [ui-16] P2 FIXED scripts/check-validation.ts — currency checks expected exchange-rate conversion; now assert prices kept per currency (owner decision) (orchestrator, verify)
status: in-progress
- [ui-20] wave D2 started: baseline node agents/checks/d2.mjs on ui files = 219 hits / 19 files (mostly font-mono in guide pages)
- [ui-50] P2 FIXED src/pages/StayOwnerLeaflet.tsx — 212→~130 lines: 3 collapsed steps, 4 one-line benefits, kit buttons, token-aware download via downloadDocHtml (D2)
- [ui-51] P2 FIXED src/pages/ConceptValidationSurvey.tsx — 454→~330 lines: intro prose and option sub-text cut, kit inputs/buttons, same fields and payload; also fixed double-toggle on checkbox labels (label onClick + native click cancelled out); download via downloadDocHtml (D2)
- [ui-21] P2 FIXED src/pages/PropertyListingGuide.tsx — 400→~190 lines: 7 short numbered steps with collapsed Details, tm-* kit, removed table/cards/long prose; doc edit/download/share/form payload unchanged (D2)
- [ui-30] P2 FIXED src/pages/HowHostingWorks.tsx — 1139 -> ~120 lines: 5 numbered steps with one collapsed Details each, dropped sketch SVGs/KPI strip/OTA comparison/photo framework, kept links (/list-your-property, /host-guide, /leaflet, /listing-guide, WhatsApp) and SEOHead (D2)
- [ui-40] P2 FIXED src/pages/HostStarterPack.tsx — 1459 lines to ~330: six numbered steps (photos, prices, guests, calendar, payouts, send details), one collapsed Details each, SVG sketches/stat bar/template walls removed; tm-* kit, form+payload, doc edit/share/print kept, download now token fetch via downloadDocHtml, anchors kept (D2)
- [ui-22] P2 FIXED src/pages/OperationsStarterPack.tsx — 464→~170 lines: 7 numbered steps, scripts/objections/checklist/shadow SOP collapsed into Details, tm-* kit, calmer default title; doc hooks, download, lead form payload unchanged; D1 placeholder lodge name removed (D2)
- [ui-52] P2 FIXED src/pages/PlatformGuideUat.tsx — 568 to ~390 lines: pillar prose replaced by 4-step How to test; each checklist test collapses steps/expected under details; kit buttons/inputs/panel; same localStorage, form payload and ConfirmDialog (D2)
- [ui-23] P2 FIXED src/pages/MarketingDeck.tsx — kit buttons/inputs/panels/dividers, calmer headings and wording (no 'Trojan Horse'/'Sovereign'/'Leverage'), calmer toolbar; content, doc hooks, download and form payload unchanged (D2)
- [ui-24] P2 FIXED src/pages/{Terms,Privacy,Refunds}.tsx — styling only: removed font-mono and tiny uppercase eyebrows, rounded-3xl/2xl→xl; legal text untouched (D2)
- [ui-25] P2 FIXED src/components/{Lightbox,PageLoader,Modal,ConfirmDialog,ErrorBoundary,MobileNav,Navbar,Breadcrumbs}.tsx — removed backdrop-blur, glow/gradient top bar, shadow-xl/2xl→sm, rounded-3xl→xl, eyebrow caps, mono (D2)
- [ui-26] P2 FIXED src/components/{HotelCard,CompactHotelCard,Tooltip,MarkdownContent}.tsx — dropped tiny tracked-caps eyebrow, rounded-2xl/shadow-md/lg→xl/sm (D2)
- [ui-27] P3 LOGGED remaining 7 d2 hits are font-mono on submission reference IDs / error detail text (legitimate); HowHostingWorks, HostStarterPack, PlatformGuideUat, StayOwnerLeaflet, ConceptValidationSurvey rewritten by ui-30/40/50-52
- [H-orch-D2] DONE guides cut to short numbered steps with collapsed Details (doc edit/download hooks kept); MarketingDeck, legal pages, shared components restyled with tm-* kit; d2 hits 219 -> 7 (all legitimate mono); tsc clean in ui files
- [ui-30] P2 FIXED src/components/Footer.tsx — dark footer used emerald logo/QA badge/green status dot (AI look) → amber logo, plain link, no dot (D2; orchestrator, from ai report)
status: done
status: in-progress
- [ui-31] P1 FIXED server/docs/*.md (7 docs) — booking/chat/payment/iCal content wrapped in booking-only blocks, directory-only replacements added (direct contact, indicative rates, no commission/fees); booking text unchanged; d3 gate 81 -> 0 (D3)
- [ui-32] P1 FIXED server/docs/*.html (7 docs) — original body wrapped in booking-only, rendered directory-only body added (survey form keeps same ids/payload; sections B/C and legend swapped); directory view has 0 booking/commission/payment words (D3)
- [ui-33] P1 FIXED src/components/{Navbar,MobileNav,Footer,HotelCard,CompactHotelCard}.tsx — usePlatformMode: My Bookings/ActiveChats/booking listener/unread chat badges, Booking explainer + Refunds links, sold-out dimming and date params hidden in directory mode; cards show 'from' rates (D3)
- [ui-34] P1 FIXED index.html — meta/og/twitter/JSON-LD in directory wording (no booking/verified/payment; TravelAgency->Organization, paymentAccepted removed) (D3)
- [ui-35] P1 FIXED src/pages/HowHostingWorks.tsx — usePlatformMode: directory steps for travellers and hosts (no calendar sync, chat, booking/payment wording; contact-the-property step), SEO/lead/notice/CTA/form label in directory wording; booking text kept for booking mode (D3)
- [ui-36] P1 FIXED src/pages/PlatformGuideUat.tsx — usePlatformMode: chat/voucher/iCal tests hidden in directory mode, B1 becomes 'Contact the property directly', payment-rail line and booking-modal example gated (D3)
- [ui-37] P1 FIXED src/pages/PlatformGuideUat.tsx:73 — unescaped apostrophe in the B1 directory 'expected' string broke the build (19 tsc errors); 'Open any verified stay' → 'Open any stay' (D3)
- [ui-38] P1 FIXED src/pages/{Terms,Privacy}.tsx — usePlatformMode: booking enquiry/voucher/booking-history/messaging-channel/commission lines and SEO meta in directory wording, booking text kept for booking mode (D3)
- [ui-39] P1 FIXED src/pages/StayOwnerLeaflet.tsx — directory steps/benefits (listing page, direct contact, no commission or listing fee; no deposits/chat/calendar sync), default subtitle + founding-host heading by mode, SEO meta in directory wording (D3)
- [ui-40] P1 FIXED src/pages/MarketingDeck.tsx — sections 1-3 have a directory version (who is looking for your stay, comparison without payouts/voucher/iCal, keep your other channels); default title/subtitle by mode; form placeholder 'group stays' (D3)
- [ui-41] P1 FIXED src/pages/{OperationsStarterPack,PropertyListingGuide}.tsx — directory step lists (no booking-site/deposit/chat/iCal pitch; contact-details step; approval checklist needs ≥1 direct contact and never claims Ministry verification) (D3)
- [ui-42] P1 FIXED src/pages/{HostStarterPack,ConceptValidationSurvey}.tsx — HostStarterPack: five directory steps (calendar sync + get paid hidden, contact details + no fees), email summary, SEO and 'How is it let?'; survey: directory feature list (same field, new ids listing_page/direct_contact), pilot note and heading by mode (D3)
- [ui-43] P2 FIXED src/pages/Refunds.tsx — page already disclaims fund handling; booking-coordination/booking-voucher/booking-agreement wording and SEO meta made mode-neutral (route reachable directly; footer link already booking-only) (D3)
- [H-orch-D3] DONE ui-31..43; d3.mjs 0 hits in ui files (geo.ts hits are ux-owned 'Reserve' place names, ux-42); tsc clean
status: done
