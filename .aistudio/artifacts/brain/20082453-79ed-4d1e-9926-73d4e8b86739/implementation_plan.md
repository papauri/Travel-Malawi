# Illustrated Step-by-Step Listing Guide & Host Starter Pack Enquiry Flow

Create a comprehensive, single-page, illustrated step-by-step guide on `/how-hosting-works` (with alias `/how-to-list`) featuring warm custom SVG illustrations, and update the Host Starter Pack property submission section from WhatsApp contact promises to an email-driven property enquiry routed to `info@ulendomalawi.com`.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and design choices were confirmed in Phase 1 and will govern this update:

- **Page Location**: Upgrade the existing `/how-hosting-works` route into the definitive illustrated listing guide, while maintaining aliases (e.g. `/how-to-list`) and navigation links from the navbar and footer.
- **Enquiry Routing Email**: All host stay enquiries will be routed to `info@ulendomalawi.com`.
- **Illustration Aesthetic**: Warm, custom SVG vector illustrations crafted specifically for Travel Malawi's earthy identity (acacia trees, Lake Malawi shoreline, camera framing, dual-currency cards, calendar synchronization, and direct mobile money / bank payouts).
- **Host Starter Pack Truthfulness**: All claims regarding automated WhatsApp messaging bots will be replaced with the true operational workflow: hosts submit an enquiry to tell us about their stay, and the Travel Malawi team follows up via email to finalize the listing.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Single-Page Illustrated Listing Guide (`/how-hosting-works`)**: Provides prospective hosts, lodge managers, and cottage owners with a visually stunning, step-by-step walkthrough of how listing on Travel Malawi works—from initial property enquiry to 0% commission direct payouts.
  2. **Truthful Host Starter Pack (`/host-starter-pack` / `/host-guide`)**: Overhauls the "Your Property" section into an authentic "Tell Us About Your Stay" property enquiry. Replaces WhatsApp promises with an email address field and email notification dispatch to `info@ulendomalawi.com`.
- **Target Audience / Persona**: Independent Malawian lodge owners, lakeside cottage caretakers, safari camp managers, B&B proprietors, and boutique guest house hosts across Malawi (Mangochi, Cape Maclear, Lilongwe, Blantyre, Mulanje, Likoma Island, Nyika).
- **Key Value**: Builds trust through complete transparency, eliminates false promises about automated WhatsApp contact, and offers clear, visually grounded onboarding guidance with direct email communication.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow 1: Prospective Host Visits the Illustrated Listing Guide (`/how-hosting-works`)
1. **Hero**: Warm editorial header with the proposition: *"List Your Stay on Travel Malawi — Step-by-Step Guide"*. Clear highlights: 0% host commission, direct guest inquiries, and 100% payout retention to Airtel Money, TNM Mpamba, or local banks.
2. **Illustrated Step 1 — Tell Us About Your Stay**:
   - Custom SVG: Thatched Malawian cottage on the lakeshore with morning sun and an enquiry notepad.
   - Text & Guidance: Send a quick enquiry with your stay type, room count, and location. No complicated paperwork.
3. **Illustrated Step 2 — Snap 4 Essential Photos**:
   - Custom SVG: Camera viewfinder framing a clean bed with morning light, lake horizon, spotless bathroom, and golden hour dining.
   - Practical Tips: Natural morning light, phone cameras are perfect, specific angles for each space.
4. **Illustrated Step 3 — Set Transparent Dual-Currency Rates**:
   - Custom SVG: Clean rate card showing Malawian Kwacha (nearest MK 1,000) and US Dollars (nearest $5) with a 0% commission seal.
   - Pricing Rules: Whole house vs. per-room rates, anchoring best suites first.
5. **Illustrated Step 4 — Connect Your Calendar (iCal Sync)**:
   - Custom SVG: Synchronized calendar gears connecting Airbnb, Booking.com, and Google Calendar feeds into Travel Malawi.
   - Availability Protection: Automated date blocking prevents double bookings.
6. **Illustrated Step 5 — Receive Direct Inquiries & 100% Payouts**:
   - Custom SVG: Warm Malawian hospitality welcome greeting, mobile money icons (Airtel Money, TNM Mpamba) and bank transfer.
   - Direct Terms: Guests pay the host directly; zero platform deductions.
7. **Action Block**: Clean CTA card allowing hosts to jump directly into submitting their property enquiry or browsing the full starter pack.

#### Flow 2: Host Submits Property Enquiry in Host Starter Pack (`/host-starter-pack`)
1. Host navigates to `/host-starter-pack` to read setup guidance.
2. In Section 6 and the submission form, the heading reads: **"Tell Us About Your Stay (Property Enquiry)"**.
3. Form fields include:
   - Property Name (required)
   - Location in Malawi (required)
   - Your Name (required)
   - Email Address (required — used for official follow-up and listing setup)
   - Phone / WhatsApp Number (optional/contact)
   - Stay booking model: Whole House vs. Individual Rooms
   - Nightly Rate in MWK and USD
   - Room / Bedroom count
   - Features, amenities, and unique highlights
4. Clear disclaimer: *"This enquiry helps our team learn about your property. We will review your details and send you an email to get your listing ready."*
5. On Submission:
   - Sends enquiry payload to backend `/api/host-enquiry` (or `/api/surveys/submit`), which automatically dispatches an email notification to `info@ulendomalawi.com`.
   - Records the submission in Firestore collection `host_onboarding_submissions` with status `pending_review`.
   - Displays a warm confirmation card: *"Takulandirani! We have received your property enquiry (Ref: #SUB-XXXXXX). Our team will review your stay details and get back to you by email at [host email]."*
   - Provides a direct mail link: *"Need immediate assistance? Email us at info@ulendomalawi.com"*.

### Visual Identity & Theme
- **Color Palette**: Malawian warm earthy tones (`stone-900` ink, `amber-700` warm ochre, `emerald-800` deep forest, `stone-100` soft sand backgrounds, and crisp white surfaces).
- **Typography**: Clean serif display headers (`font-serif`) for an authentic editorial tone, paired with high-legibility sans-serif (`font-sans`) for body copy and technical parameters.
- **Illustration Style**: Handcrafted SVG vector compositions with smooth geometric paths, warm gradient accents, clear iconography, and Malawian nature motifs (lake waters, acacia branch, warm sun, thatched roofline).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Email-First Enquiry Model vs. WhatsApp Auto-Contact**
  - *Chosen Approach*: Collect host email as the primary communication channel and dispatch notification to `info@ulendomalawi.com`. Remove false claims that a WhatsApp bot will immediately message them.
  - *Why*: Reflects real team operations, avoids false user expectations, and gives the platform a reliable audit trail.
  - *Alternatives Considered*: Pure WhatsApp redirect link. Rejected because the user explicitly stated: *"remove the wording that says under your properties that they will be contacted through whatsapp... This my properties should send an email to our email address. Its more like an enquiry so word it as such."*
- **Decision 2: In-App SVG Illustrations vs. Heavy External PNGs**
  - *Chosen Approach*: Build responsive, scalable, inline SVG components styled with Tailwind CSS color tokens.
  - *Why*: Instant loading, crisp rendering on high-DPI retina screens, dark/light compatibility, zero broken image risks, and completely self-contained.
- **Decision 3: Dual Route Support (`/how-hosting-works` and `/how-to-list`)**
  - *Chosen Approach*: Upgrade `/how-hosting-works` and add `/how-to-list` alias in router so both paths resolve smoothly.
  - *Why*: Preserves existing internal links while providing an intuitive, search-friendly URL for new hosts.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Travel Malawi Frontend                          │
│                                                                        │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │   /how-hosting-works         │    │   /host-starter-pack         │  │
│  │   Illustrated 5-Step Guide   │    │   Truthful Guide + Enquiry   │  │
│  │   - Custom SVG Visuals       │    │   - "Tell us about stay"     │  │
│  │   - Photo & Pricing Tips     │    │   - Email required input     │  │
│  │   - Calendar & Direct Payout │    │   - No fake WhatsApp claims  │  │
│  └──────────────┬───────────────┘    └──────────────┬───────────────┘  │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │                                   │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Express 5 Server Backend                         │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  POST /api/host-enquiry (or /api/surveys/submit)                 │  │
│  │  - Validates contact email, property name, rates & room count    │  │
│  │  - Dispatches email alert to info@ulendomalawi.com               │  │
│  │  - Records submission to Firestore host_onboarding_submissions  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                  │                                     │
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Nodemailer / sendSystemEmail                                    │  │
│  │  To: info@ulendomalawi.com                                       │  │
│  │  Subject: New Property Enquiry — [Property Name]                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

1. **Host Enquiry Payload (`host_onboarding_submissions` Firestore & API)**:
   ```typescript
   interface HostEnquirySubmission {
     propName: string;         // e.g. "Nkhata Bay Lakeview Chalets"
     propLoc: string;          // e.g. "Nkhata Bay, Northern Lake Malawi"
     stayType: 'whole_house' | 'rooms';
     contactName: string;      // Host / Owner name
     contactEmail: string;     // Primary email for enquiry follow-up
     contactPhone?: string;    // Optional phone/WhatsApp
     nightlyMwk?: string;      // Rate in MWK
     nightlyUsd?: string;      // Rate in USD
     roomCount: string;        // Number of rooms / bedrooms
     notes?: string;           // Amenities, features, questions
     createdAt: any;           // Firestore serverTimestamp
     source: 'host-starter-pack' | 'how-hosting-works';
     status: 'pending_review';
   }
   ```

2. **Firestore Security Rules**:
   - Ensure `host_onboarding_submissions` allowlist in `firestore.rules` permits `contactEmail` within valid string length constraints (≤ 254 characters).

3. **Backend Email Dispatch (`server/emailConfig.ts` & `server.ts`)**:
   - Formats a clean HTML & text summary of the property enquiry.
   - Sends to `info@ulendomalawi.com` with `replyTo` set to the host's submitted email address so the team can hit "Reply" to start the conversation immediately.
