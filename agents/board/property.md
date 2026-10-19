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
status: in-progress
- [property-60] P2 FIXED src/components/MenuEditor.tsx — dark gradient/neon import banner + duplicate CTA merged into the restaurant toggle panel; tm-panel/tm-input/tm-label/tm-btn kit, triple-nested section/dish boxes flattened to list rows, header buttons wrap (D2)
- [property-34] P2 FIXED src/pages/ManageHotel.tsx — whole file: 39 hand-rolled labels → tm-label, 38 inputs → tm-input, h-9 buttons/chips → tm-btn/tm-tag, 30 uppercase eyebrows removed, rose/sky/indigo/blue → red/amber/stone, rounded-2xl → rounded-xl, shadow-2xs/lg dropped, toast exclamations removed (D2)
- [property-61] P2 FIXED src/components/MenuTemplates.tsx — tagline eyebrow → sentence-case italic, emerald pill diet tags → quiet stone tags, rounded-3xl/2xl → xl/lg, card shadows dropped; 2 remaining eyebrows are the Elegant/Heritage section-head typography (one per rendered menu, legitimate) (D2)
- [property-62] P2 FIXED src/components/OpeningHoursEditor.tsx — 24/7 banner (dark badge, neon check, 2-line hype copy) → one quiet line; segmented control calmer; tip paragraph removed; time inputs wrap at 360px; kit label/buttons (D2)
- [property-80] P2 FIXED src/pages/ManagerDashboard.tsx — header unboxed (tm-h1, one primary), duplicate bulk-editor CTA + 3rd approve button removed, summary row = 4 calm tm-panel numbers (no eyebrows/mono), 5 bulky tab tiles → one wrapping tab row, cards: tm-tag badges, tm-actions button row (wraps, no overflow at 360px), no backdrop-blur/shadow-lg; sign-in/guest gates cut to one panel + 2 buttons, dark shadow banner → amber notice (D2)
- [property-35] P2 FIXED src/pages/ManageHotel.tsx header + status banners — no panel around title (tm-h1), header buttons in tm-actions (wrap), manager-view and moderation banners cut to one line each, plain wording, buttons tm-btn (D2)
- [property-63] P2 FIXED src/components/ConferenceManager.tsx — form/list on tm-panel, tm-input/tm-label (emerald focus rings + uppercase eyebrow labels gone), pill buttons → kit with wrapping tm-actions, empty state one line + one action, amenity/seat tags → tm-tag, sentence-case labels, shorter delete confirm (D2)
- [property-36] P2 FIXED src/pages/ManageHotel.tsx stats + section nav — 'Performance' toggle, tab grid without boxed tiles/panel, font-mono badges → tabular-nums, redundant restaurant 'Live' badge removed (D2)
- [property-81] P2 FIXED src/components/GalleryUpload.tsx — header label/count → tm-label/tm-tag, select-delete bar + link bar unboxed with tm-btn/tm-input in wrapping tm-actions, empty states one line + one action, gradient/backdrop-blur/shadows/font-mono removed from tiles, dark drop overlay → light amber (D2)
- [property-37] P2 FIXED src/pages/ManageHotel.tsx details tab — boxes-inside-cards → dividers, 10/11px text → readable xs, section titles/descriptions sentence case + one short line, Guest messaging / Deposit & payment / Opening hours collapsed by default (no required fields inside), kit buttons/inputs (D2)
- [property-64] P2 FIXED src/components/PromotionsManager.tsx — promo cards inside SectionCard flattened to divided rows, dark guest preview → light preview collapsed in <details>, eyebrow labels/rounded-xl inputs → tm-label/tm-input, pill/uppercase buttons → kit, hype title/description and labels shortened, header controls wrap (D2)
- [property-38] P2 FIXED src/pages/ManageHotel.tsx details header/save bar/delete — header unboxed, import is secondary (one primary = Save details), sticky save bar without blur/shadow, red 'Danger Zone' box → quiet divider + tm-btn-danger (D2)
- [property-82] P2 FIXED src/components/ImageUpload.tsx — label → tm-label, link input/Done → tm-input/tm-btn, gradient + backdrop-blur + shadows removed from cover preview, dark drop overlay → light amber, empty/drop text cut to one line (D2)
- [property-83] P2 FIXED src/components/RoomGallery.tsx — photo counter backdrop-blur/pill removed, arrow shadows to shadow-sm (D2)
- [property-84] P2 FIXED src/components/SectionCard.tsx — no shadow/tinted header band, header wraps (tm-actions, min-w-0) so actions never overflow, tm-muted description, collapse toggle → tm-btn-quiet 'Show/Hide' (D2)
- [property-85] P2 FIXED src/components/EditableSection.tsx — emerald inputs/buttons → tm-input + tm-btn in tm-actions, edit pencil kept inside its container (was -right-8 overflow) (D2)
- [property-39] P2 FIXED src/pages/ManageHotel.tsx photos tab — duplicate top+bottom save → one sticky save bar (top save only on other views with pending changes), dark/emerald badge labels removed, headings + help cut to one plain line, duplicate photo-count badge removed, blur dropped on photo buttons (D2)
- [property-40] P2 FIXED src/pages/ManageHotel.tsx rooms + promotions headers — unboxed headers, emerald whole-place banner → one quiet line, header buttons in tm-actions (wrap at 360px), bulk-editor toggle secondary so 'Add room' is the one primary, plain labels (D2)
- [property-41] P2 FIXED src/pages/ManageHotel.tsx room list/form — room cards: tm-tag status, action row tm-actions (wraps, no overflow), Edit/Sync/More as small kit buttons, empty state one line + Add room; room form sticky bar without blur, kit buttons (D2)
- [property-42] P2 FIXED src/pages/ManageHotel.tsx restaurant/bookings/inquiries — booking status uppercase pill → tm-tag, PIN chip tm-tag, emerald WhatsApp editor/pulsing neon presence dot → stone/emerald-600, slot badges font-mono → tabular-nums, restaurant sticky bar without blur + wrapping actions, kit primary on empty state (D2)
- [property-43] P2 FIXED src/pages/ManageHotel.tsx bookings tab — panel-in-panel removed (list of tm-panel cards), filters/export as small kit buttons, card action row tm-actions (Confirm primary, Decline danger, More quiet) wraps instead of overflowing, emerald reminder-template callout → one muted line + secondary button (D2)
- [property-44] P2 FIXED src/pages/ManageHotel.tsx inquiries tab — online/away card unboxed into a plain header row, pulsing dot calmed, secondary small toggle, messages list header plain with tm-tag count (D2)
- [property-65] P2 FIXED src/components/BulkRoomEditor.tsx — finished by helper (kit buttons/inputs, wrapping action rows, tables in overflow-x-auto); checker clean (D2)
- [property-86] P2 FIXED src/components/StayOSManager.tsx — finished by helper: 11 off-palette (teal/cyan/indigo) accents → stone/amber, kit panel/buttons, no blur; checker clean (D2)
- [property-45] P3 LOGGED src/pages/ManageHotel.tsx — remaining D2 hits are legitimate: 4 photo-overlay gradients (text legibility on photos), font-mono on booking.reference; MenuTemplates 2 eyebrows are printed-menu typography
- [H-orch-D2] DONE ManageHotel (header, banners, nav, details, photos, rooms, promotions, restaurant, bookings, inquiries), ManagerDashboard and all 13 owned components on the tm-* kit; D2 hits 73 → 7 (all legitimate); tsc clean in owned files
status: done
