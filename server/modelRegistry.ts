import fs from 'fs';
import path from 'path';
import type { AIProviderId } from './aiConfig';

/**
 * Live model registry.
 *
 * Hard-coded model IDs rot: providers retire models every few months and the
 * calls start failing with 404s. Instead, each provider's /models endpoint is
 * polled (cached for MODEL_CATALOG_TTL_MS), the results are ranked, and the
 * "auto" model resolves to the cheapest capable model of the newest generation.
 * Models a provider reports as retired are remembered so they are never tried
 * again, and any replacement the provider suggests is tried first.
 */

/** Stored model value meaning "pick the cheapest capable model of the latest generation". */
export const AUTO_MODEL = 'auto';

export const MODEL_CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const DISCOVERY_TIMEOUT_MS = 8000;
const MAX_CANDIDATES = 6;

/**
 * Last-resort models when a provider's catalog cannot be reached: current,
 * explicitly versioned models only (aliases can silently move to excluded models).
 */
export const FALLBACK_MODELS: Record<AIProviderId, string[]> = {
  gemini: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'],
  openai: ['gpt-5-mini'],
  anthropic: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
  deepseek: ['deepseek-chat'],
  mistral: ['mistral-small-latest', 'mistral-medium-latest'],
  groq: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile'],
};

export interface DiscoveredModel {
  id: string;
  displayName: string;
  description: string;
}

export interface RankedModel extends DiscoveredModel {
  /** Numeric version, e.g. [3, 8] for gemini-3.8-flash. Empty for version-less aliases. */
  version: number[];
  /** Relative cost tier within the provider: 0 is cheapest. */
  tier: number;
  stable: boolean;
  isLatestGeneration: boolean;
}

interface Classification {
  version: number[];
  tier: number;
  stable: boolean;
}

// ---------------------------------------------------------------------------
// Classification: which models are usable for chat, how new and how costly
// ---------------------------------------------------------------------------

function parseVersion(text: string): number[] {
  return text.split(/[.-]/).map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
}

/**
 * Models the platform owner has ruled out (e.g. Gemini 4.0: overloaded and slow
 * to respond). They are never auto-picked, offered or used, even if pinned.
 */
const EXCLUDED_MODELS: Partial<Record<AIProviderId, RegExp>> = {
  gemini: /^gemini-4(\.|-)/,
};

export function isExcludedModel(provider: AIProviderId, model: string): boolean {
  return EXCLUDED_MODELS[provider]?.test(model) ?? false;
}

function classifyGemini(id: string): Classification | null {
  if (!id.startsWith('gemini-') || isExcludedModel('gemini', id)) return null;
  if (/embedding|tts|audio|image|live|robotics|computer-use|aqa|native|vision|learnlm|exp|veo|imagen|banana/.test(id)) return null;
  const m = id.match(/^gemini-(\d+(?:\.\d+)?)-(.+)$/);
  if (!m) return null;
  const variant = m[2];
  const tier = /lite/.test(variant) ? 0 : /flash/.test(variant) ? 1 : /pro/.test(variant) ? 3 : 2;
  return { version: parseVersion(m[1]), tier, stable: !/preview/.test(variant) };
}

function classifyOpenAI(id: string): Classification | null {
  const m = id.match(/^gpt-(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const rest = m[2];
  if (/audio|realtime|search|transcribe|tts|image|codex|instruct|chat-latest|oss|deep-research|computer|nano/.test(rest)) return null;
  // gpt-3.5 and the gpt-4 line are retired generations.
  if (parseFloat(m[1]) < 5) return null;
  const tier = /mini/.test(rest) ? 0 : /pro/.test(rest) ? 3 : 1;
  return { version: parseVersion(m[1]), tier, stable: !/preview/.test(rest) };
}

function classifyAnthropic(id: string): Classification | null {
  const m = id.match(/^claude-(haiku|sonnet|opus|fable)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/);
  if (!m) return null; // claude-3-x-* and other legacy naming
  const family = m[1];
  const tier = family === 'haiku' ? 0 : family === 'sonnet' ? 1 : family === 'opus' ? 2 : 3;
  return { version: [parseInt(m[2], 10), m[3] ? parseInt(m[3], 10) : 0], tier, stable: true };
}

function classifyMistral(id: string): Classification | null {
  if (!id.endsWith('-latest')) return null;
  if (/codestral|devstral|pixtral|voxtral|magistral|ocr|embed|moderation|ministral-[38]b|open-/.test(id)) return null;
  const tier = /small/.test(id) ? 0 : /medium/.test(id) ? 1 : /large/.test(id) ? 2 : -1;
  if (tier < 0) return null;
  return { version: [], tier, stable: true };
}

function classifyDeepSeek(id: string): Classification | null {
  if (id === 'deepseek-chat') return { version: [], tier: 0, stable: true };
  if (id === 'deepseek-reasoner') return { version: [], tier: 1, stable: true };
  return null;
}

function classifyGroq(id: string): Classification | null {
  if (!/llama/.test(id) || /guard|tool-use|vision/.test(id)) return null;
  const m = id.match(/llama-(\d+(?:\.\d+)?)/);
  if (!m) return null;
  // Sub-10B models are too weak for structured hospitality output.
  if (/-(1|3|8)b/.test(id)) return null;
  const tier = /scout/.test(id) ? 0 : /maverick|70b/.test(id) ? 1 : 2;
  return { version: parseVersion(m[1]), tier, stable: !/preview/.test(id) };
}

const CLASSIFIERS: Record<AIProviderId, (id: string) => Classification | null> = {
  gemini: classifyGemini,
  openai: classifyOpenAI,
  anthropic: classifyAnthropic,
  mistral: classifyMistral,
  deepseek: classifyDeepSeek,
  groq: classifyGroq,
};

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Orders models best-first: stable latest-generation models from cheapest to
 * priciest (newest version wins a tie), then previews, then older generations.
 * Unusable models (embeddings, TTS, retired generations, tiny models) are dropped.
 */
export function rankModels(provider: AIProviderId, models: DiscoveredModel[]): RankedModel[] {
  const retired = retiredFor(provider);
  const classified = models
    .filter(m => !retired.has(m.id))
    .map(m => ({ model: m, c: CLASSIFIERS[provider](m.id) }))
    .filter((x): x is { model: DiscoveredModel; c: Classification } => x.c !== null);

  const stableMajors = classified.filter(x => x.c.stable && x.c.version.length > 0).map(x => x.c.version[0]);
  const latestMajor = stableMajors.length > 0 ? Math.max(...stableMajors) : null;

  return classified
    .map(({ model, c }) => ({
      ...model,
      ...c,
      isLatestGeneration: latestMajor === null || c.version.length === 0 || c.version[0] === latestMajor,
    }))
    .sort((a, b) => {
      if (a.isLatestGeneration !== b.isLatestGeneration) return a.isLatestGeneration ? -1 : 1;
      if (a.stable !== b.stable) return a.stable ? -1 : 1;
      if (a.tier !== b.tier) return a.tier - b.tier;
      const byVersion = compareVersions(b.version, a.version);
      if (byVersion !== 0) return byVersion;
      // Prefer the alias over dated snapshots (gpt-5-mini over gpt-5-mini-2025-08-07).
      return a.id.length - b.id.length;
    });
}

// ---------------------------------------------------------------------------
// Persistent state: discovered catalogs, retired models, provider hints
// ---------------------------------------------------------------------------

interface RegistryState {
  catalogs: Partial<Record<AIProviderId, { models: DiscoveredModel[]; fetchedAt: number }>>;
  retired: Partial<Record<AIProviderId, string[]>>;
  /** Replacements suggested by providers in retirement errors, newest first. */
  hints: Partial<Record<AIProviderId, string[]>>;
}

const REGISTRY_FILE = path.join(process.cwd(), 'data', 'model_registry.json');
let state: RegistryState | null = null;

function getState(): RegistryState {
  if (state) return state;
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
      state = { catalogs: parsed.catalogs || {}, retired: parsed.retired || {}, hints: parsed.hints || {} };
      return state;
    }
  } catch (err) {
    console.warn('[modelRegistry] Could not read model_registry.json, starting fresh', err);
  }
  state = { catalogs: {}, retired: {}, hints: {} };
  return state;
}

function persist(): void {
  try {
    fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(getState(), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[modelRegistry] Failed to persist model_registry.json', err);
  }
}

function retiredFor(provider: AIProviderId): Set<string> {
  return new Set(getState().retired[provider] || []);
}

export function isModelRetired(provider: AIProviderId, model: string): boolean {
  return retiredFor(provider).has(model);
}

/** Pulls "use models/gemini-3.5-flash-lite" style replacement suggestions out of provider errors. */
export function parseReplacementHint(message: string): string | null {
  const m = (message || '').match(/\buse\s+(?:the\s+)?(?:model\s+)?[`'"]?(?:models\/)?([a-z][a-z0-9.\-/]*[a-z0-9])/i);
  // Model IDs always carry a version or a dash; this rejects prose like "use the Interactions API".
  return m && /\d/.test(m[1]) && m[1].includes('-') ? m[1] : null;
}

/** Remembers that a model is gone for good, along with any replacement the provider suggested. */
export function markModelRetired(provider: AIProviderId, model: string, errorMessage?: string): void {
  const s = getState();
  const retired = new Set(s.retired[provider] || []);
  if (retired.has(model)) return;
  retired.add(model);
  s.retired[provider] = [...retired];

  const hint = errorMessage ? parseReplacementHint(errorMessage) : null;
  if (hint && hint !== model && !retired.has(hint)) {
    s.hints[provider] = [hint, ...(s.hints[provider] || []).filter(h => h !== hint)].slice(0, 5);
  }
  console.warn(`[modelRegistry] ${provider} model ${model} is retired${hint ? `; provider suggests ${hint}` : ''}.`);
  persist();
}

/** True when an error message means the model itself no longer exists for this key. */
export function isModelUnavailableMessage(status: number, message: string): boolean {
  const lower = (message || '').toLowerCase();
  if (status === 404) return true;
  return (
    lower.includes('model_not_found') ||
    lower.includes('no longer available') ||
    lower.includes('has been deprecated') ||
    lower.includes('decommissioned') ||
    lower.includes('does not exist') ||
    (lower.includes('model') && lower.includes('not found'))
  );
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

async function getJson(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err: any = new Error(`${res.status}: ${body.slice(0, 150)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Lists the chat-capable models a provider currently serves for this key. */
export async function fetchProviderCatalog(provider: AIProviderId, apiKey: string): Promise<DiscoveredModel[]> {
  const bearer = { Authorization: `Bearer ${apiKey}` };
  switch (provider) {
    case 'gemini': {
      const models: DiscoveredModel[] = [];
      let pageToken = '';
      for (let page = 0; page < 5; page++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const data = await getJson(url, { 'x-goog-api-key': apiKey });
        for (const m of data.models || []) {
          const methods: string[] = m.supportedGenerationMethods || [];
          if (methods.length > 0 && !methods.includes('generateContent')) continue;
          const id = String(m.name || '').replace(/^models\//, '');
          if (id) models.push({ id, displayName: m.displayName || id, description: m.description || '' });
        }
        pageToken = data.nextPageToken || '';
        if (!pageToken) break;
      }
      return models;
    }
    case 'anthropic': {
      const data = await getJson('https://api.anthropic.com/v1/models?limit=100', {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      });
      return (data.data || []).map((m: any) => ({
        id: m.id,
        displayName: m.display_name || m.id,
        description: `Anthropic Claude model${m.created_at ? ` (released ${String(m.created_at).slice(0, 10)})` : ''}`,
      }));
    }
    case 'openai':
    case 'groq':
    case 'mistral':
    case 'deepseek': {
      const url = {
        openai: 'https://api.openai.com/v1/models',
        groq: 'https://api.groq.com/openai/v1/models',
        mistral: 'https://api.mistral.ai/v1/models',
        deepseek: 'https://api.deepseek.com/models',
      }[provider];
      const data = await getJson(url, bearer);
      return (data.data || [])
        .filter((m: any) => provider !== 'mistral' || m.capabilities?.completion_chat !== false)
        .map((m: any) => ({
          id: m.id,
          displayName: m.name || m.id,
          description: m.description || (m.context_window ? `Context window ${Math.round(m.context_window / 1024)}k tokens` : ''),
        }));
    }
  }
}

const inflight: Partial<Record<AIProviderId, Promise<void>>> = {};

function catalogIsFresh(provider: AIProviderId): boolean {
  const catalog = getState().catalogs[provider];
  return !!catalog && Date.now() - catalog.fetchedAt < MODEL_CATALOG_TTL_MS;
}

export function recordCatalog(provider: AIProviderId, models: DiscoveredModel[]): void {
  if (models.length === 0) return;
  getState().catalogs[provider] = { models, fetchedAt: Date.now() };
  persist();
}

/**
 * Refreshes a provider's catalog when it is missing or older than the TTL.
 * Concurrent callers share one request; failures keep the previous catalog.
 */
export function refreshCatalog(provider: AIProviderId, apiKey: string | undefined, force = false): Promise<void> {
  if (!apiKey || apiKey.trim().length < 6) return Promise.resolve();
  if (!force && catalogIsFresh(provider)) return Promise.resolve();
  if (inflight[provider]) return inflight[provider]!;

  const run = fetchProviderCatalog(provider, apiKey.trim())
    .then(models => {
      recordCatalog(provider, models);
      const pick = autoPickModel(provider);
      console.log(`[modelRegistry] ${provider}: ${models.length} models discovered, auto model is ${pick}.`);
    })
    .catch(err => {
      console.warn(`[modelRegistry] ${provider} catalog refresh failed: ${err?.message || err}`);
    })
    .finally(() => {
      delete inflight[provider];
    });
  inflight[provider] = run;
  return run;
}

export function hasCatalog(provider: AIProviderId): boolean {
  return !!getState().catalogs[provider]?.models?.length;
}

export function getRankedModels(provider: AIProviderId): RankedModel[] {
  return rankModels(provider, getState().catalogs[provider]?.models || []);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** The cheapest capable model of the newest generation this provider serves. */
export function autoPickModel(provider: AIProviderId): string {
  const retired = retiredFor(provider);
  const ranked = getRankedModels(provider);
  const top = ranked.find(m => m.isLatestGeneration && m.stable) || ranked[0];
  if (top) return top.id;
  const hint = (getState().hints[provider] || []).find(h => !retired.has(h));
  if (hint) return hint;
  return FALLBACK_MODELS[provider].find(m => !retired.has(m)) || FALLBACK_MODELS[provider][0];
}

/** Models from generations that predate the current lineup, used before a catalog is available. */
const LEGACY_PATTERNS: Record<AIProviderId, RegExp> = {
  gemini: /^gemini-(1\.|2\.|pro$)/,
  openai: /^(gpt-3|gpt-4)/,
  anthropic: /^claude-(3|instant|2)|^claude-(haiku|sonnet|opus)-4/,
  deepseek: /^$/,
  mistral: /^(open-|mistral-tiny|ministral-[38]b)/,
  groq: /^(llama3-|llama-3\.1-8b|mixtral|gemma)/,
};

/**
 * True when a stored model should be replaced: it was retired, it is from an
 * older generation than the provider now serves, or it no longer appears in
 * the provider's catalog.
 */
export function isModelStale(provider: AIProviderId, model: string): boolean {
  if (retiredFor(provider).has(model)) return true;
  if (isExcludedModel(provider, model)) return true;
  if (!hasCatalog(provider)) return LEGACY_PATTERNS[provider].test(model);

  const catalogIds = new Set((getState().catalogs[provider]?.models || []).map(m => m.id));
  if (!catalogIds.has(model)) return true;

  const own = CLASSIFIERS[provider](model);
  if (!own) return false; // unclassifiable but served: the admin chose it deliberately
  const ranked = getRankedModels(provider).find(m => m.id === model);
  return !ranked || !ranked.isLatestGeneration;
}

/**
 * Resolves the stored model setting to the model to call. "auto", empty,
 * retired and outdated values all become the auto pick, so callers never send
 * a deprecated model ID.
 */
export function resolveModel(provider: AIProviderId, stored?: string | null): string {
  const m = (stored || '').replace(/^models\//, '').trim();
  if (!m || m === AUTO_MODEL || m === 'default') return autoPickModel(provider);
  if (isModelStale(provider, m)) return autoPickModel(provider);
  return m;
}

// ---------------------------------------------------------------------------
// Rate-limit cooldowns
// ---------------------------------------------------------------------------

/** Models whose quota is exhausted, until the given timestamp. In memory only. */
const cooldowns = new Map<string, number>();

/** Skips a model until its quota resets, so requests go straight to one with headroom. */
export function coolDownModel(provider: AIProviderId, model: string, ms: number): void {
  const key = `${provider}:${model}`;
  const until = Date.now() + Math.max(5_000, ms);
  cooldowns.set(key, Math.max(until, cooldowns.get(key) || 0));
  console.warn(`[modelRegistry] ${provider} model ${model} is rate-limited; skipping it for ${Math.round(ms / 1000)}s.`);
}

export function isCoolingDown(provider: AIProviderId, model: string): boolean {
  const key = `${provider}:${model}`;
  const until = cooldowns.get(key);
  if (!until) return false;
  if (until <= Date.now()) {
    cooldowns.delete(key);
    return false;
  }
  return true;
}

/**
 * How long to rest a model after a 429, from the provider's message: a zero
 * free-tier quota rests for hours, a daily cap for an hour, otherwise the
 * suggested retry delay (default one minute).
 */
export function rateLimitCooldownMs(message: string, retryAfterSec?: number | null): number {
  const lower = (message || '').toLowerCase();
  if (/limit:\s*0\b/.test(lower)) return 6 * 60 * 60 * 1000;
  const retryIn = lower.match(/retry in\s+([\d.]+)\s*s/);
  const suggested = retryIn ? parseFloat(retryIn[1]) * 1000 : retryAfterSec ? retryAfterSec * 1000 : 0;
  if (/per\s*day|perday|daily/.test(lower)) return Math.max(suggested, 60 * 60 * 1000);
  return suggested || 60_000;
}

/**
 * Ordered models to try for one request: the resolved model, provider-suggested
 * replacements, the next-cheapest current models, then evergreen fallbacks.
 * Previous-generation models come last as an emergency reserve, used only when
 * every current model is retired or rate-limited. Rate-limited models are skipped.
 */
export function getCandidateModels(provider: AIProviderId, stored?: string | null): string[] {
  const retired = retiredFor(provider);
  const ranked = getRankedModels(provider);
  const ordered = [
    resolveModel(provider, stored),
    ...(getState().hints[provider] || []),
    ...ranked.filter(m => m.isLatestGeneration && m.stable).map(m => m.id),
    ...ranked.filter(m => !m.isLatestGeneration && m.stable).map(m => m.id),
    ...FALLBACK_MODELS[provider],
  ];
  return [...new Set(ordered)]
    .filter(m => !retired.has(m) && !isCoolingDown(provider, m) && !isExcludedModel(provider, m))
    .slice(0, MAX_CANDIDATES);
}
