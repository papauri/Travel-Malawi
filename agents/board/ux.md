status: in-progress
(resumed run: items ux-1..ux-8 are partial work found in git diff from the interrupted run, logged here)
- [ux-1] P1 FIXED src/App.tsx — 19 pages eagerly bundled, no Suspense → lazy() + Suspense spinner; stale-chunk error after deploy → one auto reload in RouteErrorBoundary
- [ux-2] P2 FIXED src/App.tsx — ScrollToTop always jumped to top on Back; now restores per-history-entry scroll on POP, hash timer cleared, hash decoded; NotFound now has SEOHead noindex
- [ux-3] P2 FIXED src/components/SEOHead.tsx — pages without SEOHead kept previous page's title/canonical → resetHead() on unmount; added noindex prop + robots meta
- [ux-4] P1 FIXED server/seo.ts — sitemap listed registry hotels/towns with no /hotel/:id page and pending/rejected listings → only approved live hotels/locations
- [ux-5] P2 FIXED src/lib/dynamicSeo.ts — zero-result search fell back to all hotels ("N lodges in <place>") → empty set when filters active
- [ux-6] P2 FIXED src/hooks/useNetworkStatus.ts + OfflineIndicator.tsx — offline/online flapping banner (1.5s grace), banner never cleared when only server dropped (15s probe), guide modal no a11y/scroll-lock/ESC
- [ux-7] P1 FIXED src/components/InteractiveMap.tsx — popup timers fired after unmount (throw), stale onMarkerChange closure, popup /hotel links did full reload, one-finger drag trapped page scroll on mobile, icon buttons unlabeled, fullscreen no ESC/scroll-lock, own online listener → useNetworkStatus
- [ux-8] P2 FIXED src/components/{LocationPicker,DirectionsPanel,OfflineMapManager}.tsx — stale geocode/search answers overwrote newer, clipboard rejection unhandled (false "Copied"), offline map save attempted offline, guide modal a11y/scroll-lock
- [ux-9] P1 FIXED src/contexts/WishlistContext.tsx — previous account's saves shown while new one loads, offline empty-snapshot wiped list, rapid double-tap used stale list
- [ux-10] P2 FIXED src/pages/SavedProperties.tsx — one unreadable/removed hotel hid all saves (Promise.all), unapproved hotels shown, no error/retry state, signed-out CTA had no sign-in button, stale async setState
- [ux-11] P1 FIXED src/pages/Home.tsx — search/filters/sort/view/page lost on reload & Back → sessionStorage snapshot restore (validated); URL ?category/stayType/location/search parsed on first load and on in-page link follow
- [ux-12] P1 FIXED src/pages/Home.tsx — fetch failure showed "Nothing listed yet" → error state + retry; null name/location crashed search/sort; page reset on restored state; SEO title tied to state not stale URL; empty-state button now clears search when active
- [ux-13] P1 FIXED src/components/CompareWidget.tsx — removing last property inside open dialog left page scroll-locked with no UI; dialog had no role/ESC/focus trap, icon buttons unlabeled, disabled Compare gave no reason, hotel.amenities undefined crashed
- [ux-14] P2 FIXED src/components/PriceRangeFilter.tsx — typing in Min/Max boxes clamped every keystroke (typing 80 became 1000 after '8') → draft applied on blur/Enter; boxes labeled
- [ux-15] P3 FIXED src/components/WalkthroughTooltip.tsx — onDismiss in effect deps: an inline callback restarted the effect and hid the tip early → ref
- [ux-16] P2 FIXED src/components/TripPlannerD3.tsx — shared itinerary linked to dead travel-malawi.ai.studio (site is ulendomalawi.com); clipboard rejection showed false 'Copied'
- [ux-17] P3 LOGGED src/lib/geo.ts:125 — parseGoogleMapsPlaceUrl is a stub returning null (ListProperty name/location paste-extract never fires); wiring parseCoordinates risks hijacking names like 'Room 12, 34'; onboarding owns the callers, left as is
- [ux-18] P1 FIXED server.ts:237 /sitemap.xml — route never read hotel status so pending/rejected listings were still listed (seo.ts filter had nothing to filter) and only the first 100 hotels were fetched → status passed through, page tokens followed (max 10 pages)
- [ux-19] P2 FIXED server/seo.ts:93 robots.txt — Googlebot/Bingbot had their own 'Allow: /' groups so they ignored every Disallow (admin, dashboard, my-bookings, profile) → groups removed, /saved added
Checked, no defects: all navigate()/Link targets resolve to routes (incl. ?category/?stayType links vs PROPERTY_CATEGORIES/STAY_TYPE_OPTIONS); 404 route present; greps for onClick={()=>{}}, href="#", TODO/FIXME/coming soon, alert( = 0 hits; console.log only in main.tsx PWA hooks (intentional); useBodyScrollLock refcounted; CompareContext; geolocation calls all have error handlers+timeouts; map unmount cleanup (map.remove, ResizeObserver). Inbox: none. tsc --noEmit clean. No handoffs sent.
status: done
status: in-progress
- [ux-20] P2 FIXED src/App.tsx RestrictedRoute — /marketing(-deck), /operations-guide, /uat(+aliases) now admin/marketing only; /listing-guide hosts (hotel_manager) or admin/marketing; signed-out get sign-in prompt, others a friendly notice (noindex)
- [ux-21] P2 FIXED server/seo.ts — /marketing and /operations-guide removed from sitemap; restricted routes added to robots Disallow
- [H-settings-3] DONE routes gated via RestrictedRoute, sitemap/robots updated
- [ux-22] P1 FIXED src/lib/geo.ts — KNOWN_LODGE_COORDS (~55 lodge/hotel names) deleted, incl. the pass in resolveHotelCoordinates that overrode a listing's own pin by name match; lodge keywords removed from REGIONAL_DESTINATIONS (places kept) (D1)
- [ux-23] P1 FIXED src/lib/geo.ts MALAWI_KNOWN_PLACES — all category 'hotel' entries removed (Kaya Mawa, Makokola, Pumulani, Sunbird x5, Protea Ryalls, Latitude 13, Kumbali, Mayoka, Tongole, Kuthengo, Blue Zebra, Soul Rebel, President Walmont); park entries renamed to places (Liwonde NP, Nyika NP, Majete); Likoma Island + Nkhotakota Reserve added as places (D1)
- [ux-24] P1 FIXED src/lib/geo.ts + src/components/TripPlannerD3.tsx — 'kaya mawa' / 'makokola' / 'mayoka' / 'ku chawe' / 'pumlani' name checks dropped, 'likoma' etc kept (D1)
- [ux-25] P1 FIXED src/lib/dynamicSeo.ts:248, src/components/SEOHead.tsx:19 — default/OG/Twitter/JSON-LD image /hotels/kaya_main.jpg -> /icons/icon-512.png (D1)
- [ux-26] server/seo.ts — checked, no property names or lodge images (D1)
- [H-orch-D1] DONE
- [H-ui-1] DONE same fixes as ux-24/ux-25
status: done
