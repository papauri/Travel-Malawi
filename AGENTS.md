# AGENTS.md — Custom Instructions for Travel Malawi

## 1. Project Overview & Identity
- **Project Name**: Travel Malawi
- **Tagline**: The Warm Heart of Africa — a travel directory of Malawi's places to stay
- **Mission**: Help domestic and international travellers discover independent lodges, boutique hotels, B&Bs, lakeside cottages, guest houses and safari camps across Malawi, and contact them directly.
- **Purpose guardrail (Tourism Act, 2025 — owner directive)**: by default Travel Malawi is an **information directory**. It publishes listing information and the property's own contact details; it does not take bookings, payments, deposits, commissions or listing fees, and it does not carry guest↔host chat or calls. The booking platform still exists in code but is switched off by `system/settings.platformMode` (`'directory'` default, `'booking'` on), toggled by an admin with one switch in the Admin Dashboard and enforced in the UI (`usePlatformMode()`), on the server (`server/platformMode.ts`) and in `firestore.rules`. Every new feature, copy change, doc, email, SEO tag and Ulendo prompt must work and read correctly in directory mode first; anything booking- or chat-related must be gated, never shown by default. Docs use `<!-- booking-only -->` / `<!-- directory-only -->` blocks. Never claim a property is licensed or "Ministry verified". Detail: `agents/directives/D3-directory-mode.md`; gate: `node agents/checks/d3.mjs`.
- **Only onboarded properties exist**: every property name, photo, price, review or recommendation shown anywhere (UI, SEO meta/JSON-LD, sitemap, Ulendo, emails, scripts) comes from approved listings in Firestore. Never hard-code, seed or recommend a real lodge/hotel that was not onboarded (e.g. no Kaya Mawa images in `index.html`). Place names (towns, parks, the lake) are fine. Detail: `agents/directives/D1-no-hardcoded-properties.md`.
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
- **Model Selection (no hard-coded models)**:
  - Every provider defaults to `auto`: `server/modelRegistry.ts` polls each enabled provider's `/models` endpoint (every 6h and on startup), ranks the results and uses the **cheapest capable model of the newest generation** (e.g. Gemini 3.x Flash-Lite, GPT-5 Mini, Claude Haiku 5.5, Mistral Small latest, Llama 4 Scout on Groq).
  - Admin-pinned models are honoured only while they are current; older-generation or retired IDs are replaced automatically.
  - A 404 / "no longer available" response marks the model retired (persisted in `data/model_registry.json`), records any replacement the provider suggests, and the request falls through to the next candidate model.
  - Never add a fixed model ID as a default; add to `FALLBACK_MODELS` only as a last resort for when a catalog cannot be reached.
  - Excluded models (`EXCLUDED_MODELS` in `server/modelRegistry.ts`) are never picked, offered or used. Gemini 4.x is excluded at the owner's request.
  - Timeouts, 503 "high demand" and 429s move the request to the next model straight away; the busy model is skipped for a while.
  - Providers: Gemini, DeepSeek, OpenAI, Mistral, Groq, Anthropic (configured via Admin Settings).
- **No scripted conversation**: Ulendo's replies come from the AI. When no AI provider can answer, the chat shows a short notice saying so, plus plain data from context when the question maps directly onto it (arrivals, check-outs, rates, ownership, property lists). No canned greetings, small talk or hard-coded reply overrides.

### Token Efficiency (Mandatory)
- **Route context, don't dump it**: `server/opsPrompt.ts` sends only the property sections a message touches (rooms, dining, utilities, reviews...), full detail only for properties the user names, and full booking lists only for booking/revenue questions.
- **Modular system prompts**: a compact core prompt plus optional modules (action proposal schemas only for change requests, Malawi knowledge only for travel/guest advice).
- **Cache-friendly ordering**: stable content first, volatile content (time, history, message) last so provider prefix caching applies; Anthropic system prompts carry `cache_control`.
- **Never pay twice**: identical provider calls are served from a 20-minute cache or share the in-flight request; vision extraction is keyed by file hash.
- **Size outputs to the task**: small talk 380 tokens, questions 900, analysis 1,400; JSON tasks use JSON mode so output is never wasted on parse failures.
- Never send secrets or guest PII (Wi-Fi passwords, guest email/phone) unless the question needs them.

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

---

## 7. Department Leads (multi-agent audit & patching)
- Ten department leads (booking, property, onboarding, ai, messaging, settings, platform, ui, ux, cleanup) each own a set of files and a checklist. Roster, write-ownership map and run playbook: `agents/README.md`.
- **Any agent can act as a lead**: read `agents/PROTOCOL.md` + `agents/leads/<lead>.md`, then do the task. Claude Code also exposes them as subagents `lead-<name>` (`.claude/agents/`).
- Leads only edit files they own; cross-department work goes through one-line handoffs in `agents/board/inbox/<lead>.md` and only when a fix touches another owner's file, a shared contract changes, or the root cause is in another domain.
- For a single-domain bug, call just that lead; run the full wave playbook only for system-wide audits.
