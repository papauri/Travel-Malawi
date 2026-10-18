# D1 — Only onboarded properties exist in the product (owner directive, P1)

Travel Malawi connects travellers with **verified, onboarded** properties. Nothing in the app, SEO,
AI or scripts may name, picture, recommend or seed a real lodge/hotel/camp/restaurant that was not
onboarded through the platform (e.g. Kaya Mawa, Pumulani, Makokola, Mvuu, Robin Pope, Sunbird…).

## Rules
1. **Properties come from Firestore only** (approved `hotels`). No hard-coded property names, photos,
   prices, reviews, ratings or "featured" lists anywhere in UI, SEO meta/JSON-LD, sitemap or AI.
2. **Images:** no `public/hotels/*` lodge photos or stock photos of specific properties as defaults,
   OG/Twitter images or placeholders. Use the brand image/neutral placeholder already in
   `src/lib/images.ts` (placeholder data-URI) or a generic Malawi landscape that names no property.
3. **AI (Ulendo):** may use general Malawi knowledge (towns, parks, lake, culture, routes) but must
   only recommend or name properties that are in the platform's data passed in context. Remove real
   property entries from knowledge registries/prompts/fallbacks.
4. **Gazetteers / geocoding:** keep places (towns, parks, landmarks, areas like Cape Maclear,
   Liwonde); remove entries that are a specific lodge/hotel/camp name.
5. **Scripts & fixtures:** seed/repair scripts must not create or reference real properties; test
   fixtures use obviously fictional names ("Example Lakeside Lodge").
6. **Marketing copy:** no fake counts, partner logos or testimonials implying properties that are
   not on the platform.

## How to find
`grep -rniE "kaya|mawa|pumulani|makokola|mvuu|mumbo|robin pope|kumbali|latitude ?13|sunbird|ryalls|protea|chelinda|tongole|kuthengo|mayoka|kande|thawale|mkulumadzi|huntingdon|satemwa|/hotels/[a-z_]+\.jpg|unsplash|pexels"` in your owned files; then read context and judge (a place name like "Liwonde" is fine; "Mvuu Lodge" is not).

Log each fix as `[<lead>-n] P1 FIXED ... (D1)`; mark the inbox line `[H-orch-D1] DONE`.
