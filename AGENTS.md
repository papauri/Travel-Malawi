# AGENTS.md — Custom Instructions for Travel Malawi

## 1. Project Overview & Identity
- **Project Name**: Travel Malawi
- **Tagline**: The Warm Heart of Africa — Direct Booking & Hospitality Platform
- **Mission**: Connect domestic and international travelers directly with verified independent lodges, boutique hotels, B&Bs, lakeside cottages, guest houses, and safari camps across Malawi.
- **Architecture**: Full-stack TypeScript application with React 19 + Vite frontend and Express 5 backend running on port 3000, backed by Firebase Firestore.

---

## 2. AI Assistant Persona & Behavioral Guidelines
- **Concierge AI Identity**: **Ulendo** (*oo-LEN-doh* — Chichewa for *journey, voyage, expedition*). Replaces legacy "StayOS Copilot". Ulendo serves as the resident hospitality concierge across property operations and traveller route planning, embodying the warmth, deep local knowledge, and culture of the Warm Heart of Africa.

### 100% Adaptive Mirroring (Core Mandate)
- **Dynamic Energy & Style Matching**: The AI must continuously analyze the user's conversational style and match their tone at 100% capacity:
  - **Formal / Corporate**: Polished, articulate, professional, and respectful.
  - **Casual / Friendly**: Warm, conversational, engaging, and hospitable, matching casual banter or emojis when used by the user.
  - **Hurried / Curt**: Ultra-brief, direct answers, bulleted lists, zero unnecessary pleasantries or fluff.
- **Zero Empty Promises**:
  - NEVER say: *"Let me pull that up..."*, *"I'll check the metrics..."*, or *"Give me a second to gather the data..."*.
  - Drive analysis autonomously and provide answers immediately based on available platform state.
- **Tone & Demeanor**:
  - Hospitable, proactive, respectful, and culturally authentic to Malawi.
  - Never preachy, robotic, or generic.

---

## 3. Models, API Routing & Rate Limit Pacing

### Server-Side Security
- **API Key Protection**: ALL AI interactions (Gemini, OpenAI, Anthropic, DeepSeek, Mistral, Groq) **MUST** occur server-side in `/server/aiService.ts` behind Express `/api/*` endpoints. Never expose AI API keys or secrets to the browser.

### Gemini Rate Limiting & Pacing Guardrails
- **Free-Tier Limits**: Gemini free tier enforces a strict 15 RPM quota limit.
- **Pacing Rule**: The server request queue must maintain a minimum **4000ms delay** between consecutive Gemini API requests to prevent HTTP `429 Too Many Requests` errors.
- **Exponential Backoff**: In the event of transient rate limits, backoff retry logic must use a minimum base delay of **4500ms** with randomized jitter.
- **Supported Models**:
  - Primary: `gemini-2.5-flash`, `gemini-3.8-flash`
  - Fallback / Alternatives: DeepSeek-V3, GPT-4o-mini, Mistral Small, Groq Llama-3.3-70b (configured via Admin Settings).

---

## 4. Malawi Domain Knowledge & Localization Rules

### Currencies & Pricing
- **Dual Currency Support**: Malawian Kwacha (MWK) and United States Dollar (USD).
- **Rounding Conventions**:
  - **MWK**: Clean rounding to the nearest 1,000 MWK (e.g., MK 85,000, not MK 84,932).
  - **USD**: Whole dollars or rounded to nearest $5 (e.g., $95 or $100).
- **Accepted Payment Rails in Malawi**:
  - Mobile Money: Airtel Money, TNM Mpamba.
  - Bank Transfers: National Bank of Malawi (NBM), Standard Bank, FDH Bank, Centenary Bank.
  - Cards: Visa, Mastercard.
  - Cash on Arrival (where supported by lodge policy).

### Geography & Key Destinations
- **Lake Malawi & Lakeshore**: Cape Maclear (Lake Malawi National Park), Mangochi, Nkhata Bay, Senga Bay (Salima), Likoma & Chizumulu Islands.
- **Wildlife Reserves & National Parks**: Liwonde National Park, Majete Wildlife Reserve, Nyika National Park, Kasungu National Park, Vwaza Marsh Game Reserve, Nkhotakota Wildlife Reserve.
- **Cities & Commercial Hubs**: Lilongwe (Capital / Old Town & City Centre), Blantyre (Commercial capital), Mzuzu (Northern hub), Zomba (Old capital & university town).
- **Mountains & Scenic Plateaus**: Mount Mulanje (Sapitwa Peak), Zomba Plateau, Dedza Mountain (and Dedza Pottery), Dzalanyama Forest Reserve.

### Local Cuisine & Culture
- Fresh Lake fish (Chambo, Kampango, Usipa, Mpasa).
- Traditional staple: Nsima served with relish (ndiwo).
- Local hospitality expression: *"Takulandirani"* (Welcome) and *"Zikomo"* (Thank you).

---

## 5. Coding Standards & Technical Architecture

### Frontend Guidelines
- **Framework**: React 19 with Vite, TypeScript (strict mode).
- **Styling**: Tailwind CSS v4 using utility classes.
- **Design System**: Warm, organic, earthy neutral palette (`stone-*`, `amber-*`, warm creams, and high-contrast dark accents).
- **Anti-Pattern Bans**:
  - NO purple-to-blue generic AI gradients.
  - NO cluttered nested cards (cards inside cards).
  - NO unstyled raw elements or unrendered placeholder handlers.
- **Icons**: Use exclusively `lucide-react`. Do not write raw SVG icons.
- **Animations**: Use `motion/react` for smooth layout transitions and modals.

### Backend & Database Guidelines
- **Server**: Express 5 on port 3000 (`server.ts`), bundled with `esbuild` for CommonJS execution in production (`dist/server.cjs`).
- **Database**: Firebase Firestore (`firestore.rules` enforces security rules).
  - Multi-tenant role permissions: Guests, Property Managers (owners of hotels/rooms), and Admins.
  - Batch updates in bulk editors must preserve existing `hotelId` fields to conform with security invariants.
- **Production Build Script**:
  ```json
  "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
  "start": "node dist/server.cjs"
  ```

---

## 6. Property Management & Operations Rules
- **Bulk Room & Rate Editor**: Allows managers to apply percentage discounts, price drops, and promotional campaigns across multiple room units.
- **Validation**:
  - Check-in and check-out dates must be properly sequenced (`checkOut > checkIn`).
  - Unit room inventory must prevent overbooking through calendar date-blocking.
- **Guest Inquiries & Real-time Chat**: Messages must be routed directly between the authenticated guest and the assigned property manager.
