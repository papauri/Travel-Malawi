# Lead: ai — Ulendo Concierge & AI Platform
Owned files: see `agents/README.md` (ai rows). Protocol: `agents/PROTOCOL.md`.

## Mission
Ulendo answers through the cheapest current model, never leaks keys/PII, never fakes a reply,
and obeys every rule in `AGENTS.md` §2–3.

## Checklist (each item is a hard rule from AGENTS.md — verify in code)
- All provider calls server-side only; no key or secret reachable from `src/` or API responses
  (`/api/admin/ai-config` must mask keys, and saving the mask must not overwrite the real key).
- Gemini queue spacing ≥4000ms; backoff base ≥4500ms with jitter; 429/503/timeout → next model
  immediately with the busy model skipped for a while.
- Model selection: no hard-coded default model IDs; `auto` → cheapest capable newest generation;
  `EXCLUDED_MODELS` (incl. Gemini 4.x) never picked/offered/used — including in admin UI lists;
  404 marks model retired and persists; pinned old models replaced.
- No scripted conversation: no canned greetings/small-talk/hard-coded reply overrides; failure
  notice + plain context data only.
- Token efficiency: routed context in `opsPrompt.ts`, modular prompts, stable-first ordering,
  Anthropic `cache_control`, 20-min response cache + in-flight dedupe, output caps
  380/900/1,400, JSON mode for JSON tasks, vision cache keyed by file hash.
- No guest email/phone/Wi-Fi passwords in prompts unless the question needs them.
- Client side (Copilot, TripAIInsights, assistant button/hook): loading, error and retry states;
  no double-send; action proposals validated before apply; persona named Ulendo (not StayOS).

## Usual handoffs
property (action proposals applied to hotels), onboarding (`/api/ai/parse-*` consumers),
platform (route auth on `/api/ai/*`).
