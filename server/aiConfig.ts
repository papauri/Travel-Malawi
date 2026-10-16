import fs from 'fs';
import path from 'path';
import {
  AUTO_MODEL,
  autoPickModel,
  fetchProviderCatalog,
  getRankedModels,
  hasCatalog,
  isModelRetired,
  isModelStale,
  rankModels,
  recordCatalog,
  refreshCatalog,
  resolveModel,
} from './modelRegistry';

export type AIProviderId = 'deepseek' | 'openai' | 'mistral' | 'gemini' | 'groq' | 'anthropic';

export interface RecommendedModel {
  id: string;
  name: string;
  description: string;
  isSweetSpot?: boolean;
}

export interface ProviderConfig {
  enabled?: boolean;
  apiKey?: string;
  model: string;
  defaultModel: string;
  name: string;
  website: string;
  recommendedModels?: RecommendedModel[];
  rateLimitNotice?: string;
  isValid?: boolean;
  lastValidated?: number;
  validationError?: string;
}

export interface AISystemConfig {
  enabled: boolean;
  activeProvider: AIProviderId;
  providers: Record<AIProviderId, ProviderConfig>;
  updatedAt?: number;
}

/** Hard-coded defaults from earlier releases; configs still holding them are moved to "auto". */
const LEGACY_DEFAULT_MODELS = new Set([
  'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-lite',
  'gpt-4o-mini', 'gpt-4o',
  'claude-haiku-4-5-20251001',
  'llama-3.3-70b-versatile',
]);

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai_config.json');

export const DEFAULT_PROVIDERS: Record<AIProviderId, ProviderConfig> = {
  mistral: {
    enabled: false,
    model: AUTO_MODEL,
    defaultModel: AUTO_MODEL,
    name: 'Mistral AI',
    website: 'https://console.mistral.ai',
    rateLimitNotice: 'Free Tier: 1 req/sec limit. Server queue automatically paces requests at 1.25s intervals.',
    recommendedModels: [
      { id: 'mistral-small-latest', name: 'Mistral Small (latest)', description: 'Cheapest capable Mistral model, always the newest Small release', isSweetSpot: true },
      { id: 'mistral-medium-latest', name: 'Mistral Medium (latest)', description: 'Stronger reasoning for multi-step planning' },
    ],
  },
  gemini: {
    enabled: true,
    model: AUTO_MODEL,
    defaultModel: AUTO_MODEL,
    name: 'Google Gemini',
    website: 'https://aistudio.google.com',
    rateLimitNotice: 'Free tier: 15 RPM. Server queue paces Gemini calls 4s apart with jittered backoff.',
    recommendedModels: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', description: 'Cheapest current-generation Gemini model', isSweetSpot: true },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Newest Flash release: stronger reasoning at low cost' },
    ],
  },
  groq: {
    enabled: false,
    model: AUTO_MODEL,
    defaultModel: AUTO_MODEL,
    name: 'Groq (Llama)',
    website: 'https://console.groq.com',
    rateLimitNotice: 'Free Tier: 30 req/min, blazing LPU inference speeds.',
    recommendedModels: [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', description: 'Cheapest current-generation Llama on Groq LPU', isSweetSpot: true },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'Proven fallback for hospitality planning' },
    ],
  },
  deepseek: {
    enabled: false,
    model: AUTO_MODEL,
    defaultModel: AUTO_MODEL,
    name: 'DeepSeek',
    website: 'https://platform.deepseek.com',
    rateLimitNotice: 'Extremely affordable pricing with high throughput.',
    recommendedModels: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (latest)', description: 'Always the newest DeepSeek chat model, lowest cost', isSweetSpot: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (latest)', description: 'Chain-of-thought deep reasoning' },
    ],
  },
  openai: {
    enabled: false,
    model: AUTO_MODEL,
    defaultModel: AUTO_MODEL,
    name: 'OpenAI (ChatGPT)',
    website: 'https://platform.openai.com',
    rateLimitNotice: 'Tier 1: 500 req/min on Mini models.',
    recommendedModels: [
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Cheapest capable current-generation OpenAI model', isSweetSpot: true },
    ],
  },
  anthropic: {
    enabled: false,
    model: AUTO_MODEL,
    defaultModel: AUTO_MODEL,
    name: 'Anthropic Claude',
    website: 'https://console.anthropic.com',
    rateLimitNotice: 'Tier 1: 50 req/min on Haiku models.',
    recommendedModels: [
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', description: 'Cheapest current-generation Claude: fast, natural hospitality writing', isSweetSpot: true },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', description: 'Stronger writing, reasoning and tone calibration' },
    ],
  },
};

function getEnvApiKey(provider: AIProviderId): string | undefined {
  switch (provider) {
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'mistral':
      return process.env.MISTRAL_API_KEY;
    case 'gemini':
      return (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_GENAI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMINI_KEY ||
        process.env.VITE_GEMINI_API_KEY
      );
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

let inMemoryConfig: AISystemConfig | null = null;

export function loadAIConfig(): AISystemConfig {
  if (inMemoryConfig) {
    return inMemoryConfig;
  }

  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      // Merge with defaults while strictly respecting the user's activeProvider and enabled statuses
      inMemoryConfig = {
        enabled: parsed.enabled ?? true,
        activeProvider: parsed.activeProvider || 'gemini',
        providers: {
          ...DEFAULT_PROVIDERS,
          ...(parsed.providers || {}),
        },
        updatedAt: parsed.updatedAt || Date.now(),
      };
      
      // Ensure each provider has latest recommendedModels, rateLimitNotice, and strictly respects stored enabled state
      (Object.keys(DEFAULT_PROVIDERS) as AIProviderId[]).forEach(pid => {
        const parsedProvider = parsed.providers?.[pid] || {};
        inMemoryConfig!.providers[pid] = {
          ...DEFAULT_PROVIDERS[pid],
          ...parsedProvider,
          // CRITICAL: Respect explicitly stored `enabled` state. Never auto-enable a provider without user action!
          enabled: parsedProvider.enabled !== undefined 
            ? parsedProvider.enabled 
            : (DEFAULT_PROVIDERS[pid].enabled ?? false),
          recommendedModels: DEFAULT_PROVIDERS[pid].recommendedModels,
          rateLimitNotice: DEFAULT_PROVIDERS[pid].rateLimitNotice,
        };
      });

      // Old hard-coded defaults and outdated models move to "auto" so each
      // provider follows its cheapest current-generation model from now on.
      let migrated = false;
      (Object.keys(DEFAULT_PROVIDERS) as AIProviderId[]).forEach(pid => {
        const provider = inMemoryConfig!.providers[pid];
        provider.defaultModel = AUTO_MODEL;
        const stored = (provider.model || '').trim();
        if (!stored || LEGACY_DEFAULT_MODELS.has(stored) || isModelStale(pid, stored)) {
          if (stored !== AUTO_MODEL) {
            provider.model = AUTO_MODEL;
            migrated = true;
          }
        }
      });
      if (migrated) saveAIConfig(inMemoryConfig!);

      return inMemoryConfig;
    }
  } catch (err) {
    console.warn('Could not read ai_config.json, using defaults', err);
  }

  // Initialize fresh config with Gemini as default active provider
  inMemoryConfig = {
    enabled: true,
    activeProvider: 'gemini',
    providers: { ...DEFAULT_PROVIDERS },
    updatedAt: Date.now(),
  };
  saveAIConfig(inMemoryConfig);
  return inMemoryConfig;
}

export function saveAIConfig(config: AISystemConfig): boolean {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    config.updatedAt = Date.now();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    inMemoryConfig = config;
    return true;
  } catch (err) {
    console.error('Failed to save ai_config.json', err);
    return false;
  }
}

export function markProviderValidity(provider: AIProviderId, isValid: boolean, error?: string): void {
  const config = loadAIConfig();
  if (!config.providers[provider]) return;
  config.providers[provider].isValid = isValid;
  config.providers[provider].lastValidated = Date.now();
  config.providers[provider].validationError = error;
  saveAIConfig(config);
}

export function maskApiKey(key?: string): string {
  if (!key || key.length < 8) return '';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export function getEffectiveApiKey(provider: AIProviderId, ignoreDisabled = false): string | undefined {
  const config = loadAIConfig();
  if (!ignoreDisabled && config.providers[provider]?.enabled === false) {
    return undefined;
  }
  const configuredKey = config.providers[provider]?.apiKey?.trim();
  if (configuredKey) return configuredKey;
  return getEnvApiKey(provider);
}

export function getAvailableProviders(): AIProviderId[] {
  const config = loadAIConfig();
  const ordered: AIProviderId[] = [];
  const allProviders = Object.keys(DEFAULT_PROVIDERS) as AIProviderId[];
  
  // Active provider first (if enabled and configured)
  const activeConf = config.providers[config.activeProvider];
  if (activeConf?.enabled !== false) {
    const activeKey = getEffectiveApiKey(config.activeProvider);
    if (activeKey && activeKey.trim().length > 5 && activeConf?.isValid !== false) {
      ordered.push(config.activeProvider);
    }
  }
  
  // Then remaining enabled providers with valid keys
  for (const pid of allProviders) {
    if (pid === config.activeProvider) continue;
    if (config.providers[pid]?.enabled === false) continue;
    const key = getEffectiveApiKey(pid);
    if (key && key.trim().length > 5 && config.providers[pid]?.isValid !== false) {
      ordered.push(pid);
    }
  }
  
  return ordered;
}

export function getPublicAIStatus() {
  const config = loadAIConfig();
  const providerConf = config.providers[config.activeProvider];
  const isProviderEnabled = providerConf?.enabled !== false;
  const activeKey = getEffectiveApiKey(config.activeProvider);

  // Key must exist, be trimmed, non-placeholder, and not invalidated by authentication failure
  const hasValidKeyFormat = !!activeKey && activeKey.trim().length > 5 && !activeKey.includes('placeholder') && !activeKey.includes('your_');
  const isNotInvalidated = providerConf?.isValid !== false;

  // A provider is confirmed working only once its API key connects and works:
  // Either explicitly marked isValid === true, or catalog successfully discovered via hasCatalog()
  const isConfirmedWorking = isProviderEnabled && hasValidKeyFormat && isNotInvalidated && (providerConf?.isValid === true || hasCatalog(config.activeProvider));

  // Check if any available provider is confirmed working
  const anyConfirmedWorking = isConfirmedWorking || getAvailableProviders().some(pid => {
    const p = config.providers[pid];
    const k = getEffectiveApiKey(pid);
    return !!k && k.trim().length > 5 && p?.isValid !== false && (p?.isValid === true || hasCatalog(pid));
  });

  const isOperational = !!config.enabled && anyConfirmedWorking;

  return {
    enabled: isOperational,
    systemEnabled: !!config.enabled,
    providerEnabled: isProviderEnabled,
    activeProvider: config.activeProvider,
    model: resolveModel(config.activeProvider, providerConf?.model),
    available: isOperational, // Strictly only available once confirmed that our API key connects and is working
    hasLiveProvider: isOperational,
    isValid: providerConf?.isValid,
    validationError: providerConf?.validationError || (!hasValidKeyFormat ? 'No API key configured' : undefined),
  };
}

export function getAdminAIConfig() {
  const config = loadAIConfig();
  
  const providersView: Record<string, any> = {};
  (Object.keys(DEFAULT_PROVIDERS) as AIProviderId[]).forEach((pid) => {
    const p = config.providers[pid] || DEFAULT_PROVIDERS[pid];
    const effectiveKey = getEffectiveApiKey(pid, true);
    const hasConfiguredKey = !!p.apiKey?.trim();
    const hasEnvKey = !!getEnvApiKey(pid);

    providersView[pid] = {
      name: p.name || DEFAULT_PROVIDERS[pid].name,
      website: p.website || DEFAULT_PROVIDERS[pid].website,
      enabled: p.enabled !== false,
      model: p.model || AUTO_MODEL,
      resolvedModel: resolveModel(pid, p.model),
      defaultModel: AUTO_MODEL,
      recommendedModels: getRecommendedModels(pid),
      rateLimitNotice: DEFAULT_PROVIDERS[pid].rateLimitNotice,
      isConfigured: !!effectiveKey && effectiveKey.length > 5,
      isValid: p.isValid,
      lastValidated: p.lastValidated,
      validationError: p.validationError,
      maskedKey: maskApiKey(p.apiKey),
      source: hasConfiguredKey ? 'manual' : hasEnvKey ? 'environment' : 'none',
    };
  });

    return {
    enabled: !!config.enabled,
    activeProvider: config.activeProvider,
    providers: providersView,
    updatedAt: config.updatedAt,
  };
}

/**
 * The models worth suggesting right now: the live catalog's current generation
 * when it has been discovered, otherwise the curated list. Retired models are never shown.
 */
function getRecommendedModels(provider: AIProviderId): RecommendedModel[] {
  const pick = autoPickModel(provider);
  if (hasCatalog(provider)) {
    const current = getRankedModels(provider).filter(m => m.isLatestGeneration && m.stable).slice(0, 4);
    if (current.length > 0) {
      return current.map(m => ({
        id: m.id,
        name: m.displayName,
        description: m.id === pick ? 'Auto pick: cheapest capable model of the latest generation' : m.description,
        isSweetSpot: m.id === pick,
      }));
    }
  }
  return (DEFAULT_PROVIDERS[provider].recommendedModels || [])
    .filter(m => !isModelRetired(provider, m.id))
    .map(m => ({ ...m, isSweetSpot: m.id === pick }));
}

export interface LiveModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isLatest: boolean;
  isSweetSpot: boolean;
  isDeprecated?: boolean;
}

export interface LiveProviderModelsResult {
  provider: AIProviderId;
  providerName: string;
  success: boolean;
  models: LiveModelInfo[];
  latestRecommendation: string;
  source: 'live_api' | 'catalog';
  error?: string;
  latencyMs?: number;
}

function catalogFallback(provider: AIProviderId): LiveModelInfo[] {
  return getRecommendedModels(provider).map(m => ({
    id: m.id,
    name: m.name,
    displayName: m.name,
    description: m.description,
    isLatest: true,
    isSweetSpot: !!m.isSweetSpot,
  }));
}

/**
 * Lists the provider's live models for the admin catalog. Only usable chat
 * models are returned (ranked cheapest-latest first); retired and
 * older-generation models are never flagged as latest or recommended.
 */
export async function fetchLiveProviderModels(
  provider: AIProviderId,
  apiKey?: string
): Promise<LiveProviderModelsResult> {
  const providerName = DEFAULT_PROVIDERS[provider]?.name || provider;
  const key = apiKey?.trim() || getEffectiveApiKey(provider, true);
  const startTime = Date.now();

  if (!key || key.length < 5) {
    return {
      provider,
      providerName,
      success: false,
      models: catalogFallback(provider),
      latestRecommendation: autoPickModel(provider),
      source: 'catalog',
      error: `No API key configured for ${providerName}. Please enter and save an API key to query live models directly.`,
      latencyMs: 0,
    };
  }

  try {
    const discovered = await fetchProviderCatalog(provider, key);
    const latencyMs = Date.now() - startTime;
    // Only the saved key's catalog drives auto-selection; a pasted test key just previews.
    const usingSavedKey = !apiKey?.trim() || apiKey.trim() === getEffectiveApiKey(provider, true);
    if (usingSavedKey) recordCatalog(provider, discovered);

    const ranked = rankModels(provider, discovered);
    const pick = ranked.find(m => m.isLatestGeneration && m.stable)?.id || autoPickModel(provider);

    return {
      provider,
      providerName,
      success: true,
      models: ranked.map(m => ({
        id: m.id,
        name: m.displayName,
        displayName: m.displayName,
        description: m.description,
        isLatest: m.isLatestGeneration && m.stable,
        isSweetSpot: m.id === pick,
      })),
      latestRecommendation: pick,
      source: 'live_api',
      latencyMs,
    };
  } catch (err: any) {
    return {
      provider,
      providerName,
      success: false,
      models: catalogFallback(provider),
      latestRecommendation: autoPickModel(provider),
      source: 'catalog',
      error: `${providerName} API error ${err?.message || 'request failed'}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

export async function fetchAllLiveProviderModels(
  customKeys?: Record<string, string>
): Promise<Record<AIProviderId, LiveProviderModelsResult>> {
  const providers = Object.keys(DEFAULT_PROVIDERS) as AIProviderId[];
  const results = await Promise.all(
    providers.map(p => fetchLiveProviderModels(p, customKeys?.[p]))
  );

  const map: Partial<Record<AIProviderId, LiveProviderModelsResult>> = {};
  results.forEach(r => {
    map[r.provider] = r;
  });
  return map as Record<AIProviderId, LiveProviderModelsResult>;
}

// Backward compatibility alias for Gemini
export async function fetchLiveGeminiModels(apiKey?: string) {
  const result = await fetchLiveProviderModels('gemini', apiKey);
  return {
    success: result.success,
    models: result.models,
    latestRecommendation: result.latestRecommendation,
    error: result.error,
  };
}

/** Refreshes the model catalog of a provider if it is stale and records live connectivity validity. Never throws. */
export async function refreshProviderCatalog(provider: AIProviderId, force = false): Promise<void> {
  const key = getEffectiveApiKey(provider);
  if (!key || key.trim().length < 6) {
    return;
  }
  try {
    await refreshCatalog(provider, key, force);
    if (hasCatalog(provider)) {
      markProviderValidity(provider, true);
    }
  } catch (err: any) {
    const msg = err?.message || 'Connection failed';
    const lower = msg.toLowerCase();
    const isAuth = lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('key not found') || lower.includes('authentication') || lower.includes('invalid_api_key');
    if (isAuth || err?.status === 401 || err?.status === 403) {
      markProviderValidity(provider, false, msg);
    }
  }
}

/** Discovers the current models of every enabled provider; run at startup and on a timer. */
export async function warmModelCatalogs(force = false): Promise<void> {
  const config = loadAIConfig();
  const providers = (Object.keys(DEFAULT_PROVIDERS) as AIProviderId[]).filter(
    pid => config.providers[pid]?.enabled !== false
  );
  await Promise.all(providers.map(pid => refreshProviderCatalog(pid, force)));

  // Re-check stored models against the fresh catalogs.
  let migrated = false;
  for (const pid of providers) {
    const stored = config.providers[pid]?.model;
    if (stored && stored !== AUTO_MODEL && isModelStale(pid, stored)) {
      console.warn(`[aiConfig] ${pid} model ${stored} is outdated or retired; switching to auto (${autoPickModel(pid)}).`);
      config.providers[pid].model = AUTO_MODEL;
      migrated = true;
    }
  }
  if (migrated) saveAIConfig(config);
}

