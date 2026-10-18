status: in-progress
# property — wave 1 (resumed; items 1-22 recovered from interrupted run's git diff)
- [property-1] P1 FIXED  src/components/BulkRoomEditor.tsx:138 — switching property filter kept hidden rooms selected → bulk save touched invisible rooms; now pruned to visible
- [property-2] P2 FIXED  src/components/BulkRoomEditor.tsx:755 — promotion delete had no confirm → ConfirmDialog added
- [property-3] P1 FIXED  src/components/BulkRoomEditor.tsx:192 — legacy room without photo could not be repriced (photo rule blocked rate change) → only rate rules checked
- [property-4] P1 FIXED  src/components/ConferenceManager.tsx:68 — cleared rate (undefined) made setDoc throw → undefined fields dropped; blanks trimmed from amenities/policies on save
- [property-5] P2 FIXED  src/components/ConferenceManager.tsx:173 — comma/newline typing eaten in amenities/policies inputs → kept loose while typing
- [property-6] P2 FIXED  src/components/ConferenceManager.tsx:51 — double-submit + no load-error state → saving guard/disabled button, load error toast, page clamp after delete
- [property-7] P2 FIXED  src/components/ConferenceManager.tsx:157 — uploads went to shared "conferences" folder → per-hotel folder; empty imageUrl filtered from gallery
- [property-8] P2 FIXED  src/components/GalleryUpload.tsx:133 — toast said "deleted from media" but removal only applies on save → "Save to apply"
- [property-9] P3 FIXED  src/components/ImageUpload.tsx:91 — "Room Cover" toast shown for every cover → "cover photo"
- [property-10] P2 FIXED src/components/MenuEditor.tsx:301 — deleting a section with dishes had no confirm → ConfirmDialog
- [property-11] P2 FIXED src/components/MenuEditor.tsx:367 — tag input ate commas/spaces while typing → loose while typing, trimmed on save (ManageHotel.tsx:1252)
- [property-12] P1 FIXED src/components/PromotionsManager.tsx:31 — promos saved from bulk editor not reflected; no dirty signal → sync from hotel.promotions when clean, onDirtyChange prop
- [property-13] P2 FIXED src/components/PromotionsManager.tsx:157 — removing all promos left no save button → "Save removal" shown when dirty; page clamp; new promo jumps to its page; fixed_slash label; max% from constant
- [property-14] P1 FIXED src/components/StayOSManager.tsx:84 — baseline never advanced after save → permanent false "unsaved" warning; onSaved keeps page hotel current
- [property-15] P2 FIXED src/components/StayOSManager.tsx:145 — user-facing "Stay OS" → "Ulendo Stay" (also tab label ManageHotel.tsx:2121)
- [property-16] P1 FIXED src/lib/listing.ts:543 — entire-place listing without a rate got invented $120 / MK 210,000 → only host-entered rates sold
- [property-17] P2 FIXED src/lib/uploadImage.ts:170 — >16MB post-compression file hit server limit with bare status → clear error before upload
- [property-18] P1 FIXED src/pages/ManagerDashboard.tsx:277 — room with quantity 0 counted as 1 unit → counted as 0
- [property-19] P1 FIXED src/pages/ManageHotel.tsx:162 — imported rooms with no rate got invented $50 / MK 85,000 → only stated rates; warning toast for unpriced rooms
- [property-20] P1 FIXED src/pages/ManageHotel.tsx:112 — stayType/entirePlaceDetails/heroLayout/conference policy edits missing from dirty snapshot → lost silently on tab switch
- [property-21] P1 FIXED src/pages/ManageHotel.tsx:1182 — merely opening room editor counted as unsaved (false positive) → baseline compare; stayos/promotions tabs now guarded; beforeunload includes promos
- [property-22] P2 FIXED src/pages/ManageHotel.tsx:943 — bookings without currency summed/exported as USD → MWK default (matches booking lead); room quantity 0 displayed as 1 fixed
- [H-onboarding-1] DONE listing.ts draftToHotel now also writes legacy `category`
- [H-onboarding-2] DONE ManageHotel.tsx pending/rejected banner now shows moderationNotes
- [property-23] P1 FIXED src/pages/ManageHotel.tsx:814 — unverified email match opened the editor but rules (email_verified) refuse every save → email match needs verified address (or shadow); clear "verify your email" toast; same gate on isPropertyOwner/canSeeFinancials
- [property-24] P1 FIXED src/pages/ManagerDashboard.tsx:183 — dashboard listed email-matched hotels for unverified accounts → filtered out + verify-email notice
- [H-platform-c1] DONE email-based manager access in ManageHotel/ManagerDashboard now requires verified email, with a clear message for unverified hosts
- [property-25] P1 FIXED src/components/BulkRoomEditor.tsx:286 — legacy room without `currency` was rewritten as MWK primary keeping its USD `price` ($95 shown as MK 95) → default USD, same as roomPrice()
- [property-26] P1 FIXED src/lib/hours.ts:126 — isOpenAt used the viewer's clock, so travellers abroad saw wrong Open/Closed → evaluated in Malawi time (UTC+2)
- [property-27] P2 FIXED src/components/GalleryUpload.tsx:69 — dropping files while a batch uploaded started a 2nd batch on the stale list, losing the 1st batch's photos → blocked until done
- [property-28] P3 FIXED src/pages/ManageHotel.tsx:2023 — rejected listing banner read like a generic unpublish → "Listing Not Approved" heading above the review note
status: done
- [H-booking-1] DONE ManageHotel.tsx updateBookingDetails: entirePlaceRoom for entire-place bookings, withPropertyBlocks for availability, child breakdown + childPolicy passed to computeBookingPricing
status: done
status: in-progress
- [property-29] P1 FIXED src/lib/images.ts:28 — lodge photos (/hotels/kaya|pumulani|makokola_*) used as per-name fallbacks, DECORATIVE_IMAGE and category defaults; unsplash stock hero → removed name map; decorative/hero = generic Zomba Plateau landscape; category/room defaults = neutral placeholder; stored bundled-photo URLs dropped; dead-URL rewrites no longer point at stock photos (D1)
- [property-30] P1 FIXED src/pages/ManageHotel.tsx:847 — editor padded imageless listings with other lodges' bundled photos → only the property's own photos (D1)
- [property-31] P2 FIXED src/pages/ManageHotel.tsx:3328,3354 — placeholders named a real lodge → "Example Lakeside Lodge" (D1)
- [property-32] P3 FIXED src/lib/listing.ts:425 — comment example named a real lodge → fictional name (D1)
- [property-33] P1 FIXED scripts/seed-restaurants.mjs — seeded menus/hours onto real lodges and invented MWK rates + $25 fees on EVERY room → fictional "Example …" test listings only; room pricing limited to their rooms (D1)
- [H-orch-D1] DONE images.ts, listing.ts, ManageHotel.tsx, seed-restaurants.mjs carry no real property names/photos
- [H-ui-5] DONE no owned file references public/hotels/*.jpg or root {kaya,makokola,pumulani,rosalyn}_*.jpg any more — ui may delete them (other refs remain in SEOHead.tsx, dynamicSeo.ts, index.html: not property-owned)
status: done
- [H-onboarding-29] DONE src/lib/listing.ts:154 + ManageHotel.tsx:2333 — invented entire-place defaults $120 / MK 210,000 → 0 (validateDraft still demands a rate); applied by orchestrator
status: done
