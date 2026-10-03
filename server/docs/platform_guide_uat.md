# TRAVEL MALAWI — PLATFORM GUIDE & UAT VERIFICATION MANUAL
**The Warm Heart of Africa — Direct Booking & Hospitality Platform**
*Quality Assurance Protocols, Verification Checklists, and Acceptance Standards*

---

## 1. PURPOSE & AUDIENCE
This manual defines verification checklists, operational standards, and acceptance criteria for Travel Malawi. It is maintained for internal operations, ground team inspectors, marketing leads, and lodge onboarding specialists.

---

## 2. CORE SYSTEM ARCHITECTURE & DESIGN PILLARS
* **Local First**: Built specifically for Malawian connectivity, supporting instant mobile money, local bank rails, and offline GPS caching.
* **Zero Host Commission**: Direct relationship between guest and lodge manager with 0% platform deductions during launch.
* **Dual Currency Precision**: Malawian Kwacha (MWK) rounded to the nearest 1,000 MWK; USD rounded to the nearest dollar.
* **Adaptive AI Concierge (Ulendo)**: 24/7 intelligent assistance tuned with deep cultural and geographical knowledge of Malawi.

---

## 3. USER ACCEPTANCE TEST (UAT) SUITES

### SUITE A: DISCOVERY & MERCHANDISING
* **Test A1 (Destination Autocomplete)**: Verify instant filtering for key hubs: Lilongwe, Blantyre, Cape Maclear, Mangochi, Nkhata Bay, Nyika, Liwonde, Majete, Mulanje.
* **Test A2 (View Modes)**: Seamless switching between Visual Photo Grid, High-Density Compact List, and Clustered Interactive Map.
* **Test A3 (Currency Switcher)**: Toggle between MWK and USD; verify all rates update cleanly without UI jitter.

### SUITE B: BOOKING & GUEST COMMUNICATION
* **Test B1 (Direct WhatsApp Inquiries)**: Verify 1-click WhatsApp launcher includes pre-filled dates, guest count, and room preference.
* **Test B2 (Offline GPS Navigation)**: Ensure GPS coordinates launch device-native navigation (Google Maps, OsmAnd) without cellular data.
* **Test B3 (Instant Booking Voucher)**: Confirm that booking voucher displays clear settlement details (Airtel Money, TNM Mpamba, or Bank Transfer).

### SUITE C: PROPERTY MANAGER & HOST OPERATIONS
* **Test C1 (Storefront Merchandising)**: Confirm property photo gallery, amenity badges, and check-in/out policies render crisp and legible.
* **Test C2 (Inventory Blocking & Calendar)**: Verify date blocking prevents accidental double-bookings.
* **Test C3 (Bulk Rate Adjustments)**: Ensure peak holiday surcharges or seasonal discounts apply correctly across multiple rooms.

### SUITE D: MARKETING & STRATEGIC DOCUMENTS
* **Test D1 (1-Click Sharing)**: WhatsApp share, link copy, and clean print/PDF export function reliably on all partner documents.
* **Test D2 (Inbound Partner Submissions)**: Confirm partner survey submissions, fast-track listing requests, and field scout notes route immediately to the Admin Documentation Hub.

---

## 4. FIELD REPORTING & DEFECT ESCALATION
Submit ground test findings, bug reports, or amenity discrepancies directly through the submission form at `/uat` or contact operations via WhatsApp (+265 999 00 00 00).
