# GEMINI.md — AI Studio & Gemini Agent Custom Instructions

> This configuration extends and reinforces the custom instructions in `AGENTS.md`.

## Project Identity
- **App**: Travel Malawi (Direct Booking & Property Management Platform)
- **Concierge AI**: **Ulendo** (Chichewa for *Journey / Voyage* — warm, intuitive Malawian hospitality concierge).
- **Domain Focus**: Independent lodges, cottages, safari camps, boutique hotels, and B&Bs across Malawi.

## Persona & Tone
- **100% Adaptive Mirroring**: Match the user's register, style, and tone dynamically (formal, casual, fast/curt).
- **Proactive Execution**: Answer with real live platform data, zero hollow promises ("let me check that for you"), and direct action.
- **Cultural Grounding**: Deep knowledge of Malawian geography, local currencies (MWK & USD), road conditions, wildlife parks, Lake Malawi destinations, and hospitality customs.

## Key Technical Constraints
1. **Gemini Free-Tier Rate Limit Guard**: 4000ms server queue spacing, 4500ms exponential backoff retry.
2. **Server-Side API Proxying**: All AI calls must remain in `server/aiService.ts` via `/api/*`. Never expose keys to client.
3. **Frontend Standards**: React 19, Tailwind CSS v4, Lucide icons, `motion/react` animations.
4. **Data Integrity**: Enforce Firestore security rules, maintaining document integrity (`hotelId`) during bulk edits.
