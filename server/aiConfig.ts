import fs from 'fs';
import path from 'path';

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

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai_config.json');

export const DEFAULT_PROVIDERS: Record<AIProviderId, ProviderConfig> = {
  mistral: {
    enabled: false,
    model: 'mistral-small-latest',
    defaultModel: 'mistral-small-latest',
    name: 'Mistral AI',
    website: 'https://console.mistral.ai',
    rateLimitNotice: 'Free Tier: 1 req/sec limit. Server queue automatically paces requests at 1.25s intervals.',
    recommendedModels: [
      {
        id: 'ministral-8b-latest',
        name: 'Ministral 8B',
        description: '⚡ Sweet Spot: Ultra-fast edge model, lowest token footprint, ideal for free tier quotas',
        isSweetSpot: true,
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small 4',
        description: '🧠 High intelligence, balanced reasoning for deep property lookups & concierge',
        isSweetSpot: true,
      },
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        description: '🌟 Flagship reasoning model for heavy multi-step planning',
      },
    ],
  },
  gemini: {
    enabled: true,
    model: 'gemini-3.8-flash',
    defaultModel: 'gemini-3.8-flash',
    name: 'Google Gemini',
    website: 'https://aistudio.google.com',
    rateLimitNotice: 'Generous free tier with ultra-fast sub-second latency, superior multimodal vision, and high throughput.',
    recommendedModels: [
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        description: '⚡ Latest Flagship Flash: Ultra-fast sub-second latency, superior multimodal vision & top-tier hospitality intelligence',
        isSweetSpot: true,
      },
      {
        id: 'gemini-3.7-flash',
        name: 'Gemini 3.7 Flash',
        description: '🧠 Advanced reasoning with hybrid thinking and instant execution',
        isSweetSpot: true,
      },
      {
        id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        description: '✨ High-speed multimodal intelligence for instant hospitality workflows',
        isSweetSpot: false,
      },
      {
        id: 'gemini-flash-latest',
        name: 'Gemini Flash (Latest)',
        description: '🔄 Always Latest: Automatically tracks Google\'s newest production Flash release',
        isSweetSpot: true,
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        description: '💰 Ultra-budget & Fastest: Lowest latency and highest cost-efficiency for instant queries',
        isSweetSpot: true,
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
        description: '🌟 Deep multi-step reasoning, complex hospitality strategy and long context planning',
        isSweetSpot: false,
      },
    ],
  },
  groq: {
    enabled: false,
    model: 'llama-3.1-8b-instant',
    defaultModel: 'llama-3.1-8b-instant',
    name: 'Groq (Llama)',
    website: 'https://console.groq.com',
    rateLimitNotice: 'Free Tier: 30 req/min, blazing LPU inference speeds.',
    recommendedModels: [
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: '⚡ Sweet Spot: Ultra-fast edge inference with universal availability on Groq LPU',
        isSweetSpot: true,
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B (Tier 2+)',
        description: '🧠 High-reasoning 70B model (requires paid tier on GroqCloud)',
      },
    ],
  },
  deepseek: {
    enabled: false,
    model: 'deepseek-chat',
    defaultModel: 'deepseek-chat',
    name: 'DeepSeek',
    website: 'https://platform.deepseek.com',
    rateLimitNotice: 'Extremely affordable pricing ($0.14-$0.28 per 1M tokens) with high throughput.',
    recommendedModels: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek V3 (Chat)',
        description: '⚡ Sweet Spot: General intelligence with top-tier coding & hospitality understanding',
        isSweetSpot: true,
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1 (Reasoner)',
        description: '🧠 Chain-of-thought deep reasoning',
      },
    ],
  },
  openai: {
    enabled: false,
    model: 'gpt-4o-mini',
    defaultModel: 'gpt-4o-mini',
    name: 'OpenAI (ChatGPT)',
    website: 'https://platform.openai.com',
    rateLimitNotice: 'Tier 1 / Free trials: 500 req/min on Mini models.',
    recommendedModels: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: '⚡ Sweet Spot: Fast, highly capable, and extremely cost-efficient',
        isSweetSpot: true,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o (Omni)',
        description: '🌟 Flagship OpenAI model for complex hospitality strategy',
      },
    ],
  },
  anthropic: {
    enabled: false,
    model: 'claude-3-5-haiku-20241022',
    defaultModel: 'claude-3-5-haiku-20241022',
    name: 'Anthropic Claude',
    website: 'https://console.anthropic.com',
    rateLimitNotice: 'Tier 1: 50 req/min on Haiku models.',
    recommendedModels: [
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: '⚡ Sweet Spot: Fast, poetic hospitality writing and conversational flow',
        isSweetSpot: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: '🧠 Industry-leading writing, reasoning, and tone calibration',
      },
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

      // Migrate any legacy/deprecated model strings to modern Gemini 3 series
      const currentGeminiModel = inMemoryConfig!.providers.gemini?.model;
      if (
        !currentGeminiModel ||
        currentGeminiModel === 'gemini-2.0-flash' ||
        currentGeminiModel === 'gemini-2.0-pro' ||
        currentGeminiModel === 'gemini-2.0-flash-thinking' ||
        currentGeminiModel === 'gemini-1.5-flash' ||
        currentGeminiModel === 'gemini-1.5-pro' ||
        currentGeminiModel === 'gemini-pro'
      ) {
        inMemoryConfig!.providers.gemini.model = 'gemini-3.8-flash';
        saveAIConfig(inMemoryConfig!);
      }

      if (inMemoryConfig!.providers.groq?.model === 'llama-3.3-70b-versatile') {
        inMemoryConfig!.providers.groq.model = 'llama-3.1-8b-instant';
        saveAIConfig(inMemoryConfig!);
      }
      
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
  const available = !!config.enabled && isProviderEnabled && hasValidKeyFormat && isNotInvalidated;

  return {
    enabled: !!config.enabled && isProviderEnabled,
    systemEnabled: !!config.enabled,
    providerEnabled: isProviderEnabled,
    activeProvider: config.activeProvider,
    model: providerConf?.model || DEFAULT_PROVIDERS[config.activeProvider].defaultModel,
    available,
    isValid: providerConf?.isValid,
    validationError: providerConf?.validationError,
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
      model: p.model || DEFAULT_PROVIDERS[pid].defaultModel,
      defaultModel: DEFAULT_PROVIDERS[pid].defaultModel,
      recommendedModels: DEFAULT_PROVIDERS[pid].recommendedModels || [],
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

export interface LiveModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isLatest: boolean;
  isSweetSpot: boolean;
  isDeprecated: boolean;
}

export async function fetchLiveGeminiModels(apiKey?: string): Promise<{
  success: boolean;
  models: LiveModelInfo[];
  latestRecommendation: string;
  error?: string;
}> {
  const key = apiKey || getEffectiveApiKey('gemini', true);
  if (!key || key.length < 6) {
    return {
      success: false,
      models: [],
      latestRecommendation: 'gemini-3.8-flash',
      error: 'No Gemini API key configured. Please enter and save your API key first.',
    };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!res.ok) {
      const errBody = await res.text();
      return {
        success: false,
        models: [],
        latestRecommendation: 'gemini-3.8-flash',
        error: `Google API returned ${res.status}: ${errBody.slice(0, 150)}`,
      };
    }

    const data = await res.json();
    const rawList: any[] = data.models || [];

    // Filter and map models suitable for text/vision generation
    const liveModels: LiveModelInfo[] = rawList
      .map(m => {
        const id = m.name?.replace(/^models\//, '') || '';
        const isDeprecated = id.includes('2.0') || id.includes('1.5') || id === 'gemini-pro';
        const isLatest = id.startsWith('gemini-3.8') || id.startsWith('gemini-3.7') || id === 'gemini-flash-latest';
        const isSweetSpot = id === 'gemini-3.8-flash' || id === 'gemini-3.7-flash' || id === 'gemini-3.1-flash-lite' || id === 'gemini-flash-latest';

        return {
          id,
          name: m.displayName || id,
          displayName: m.displayName || id,
          description: m.description || '',
          isLatest,
          isSweetSpot,
          isDeprecated,
        };
      })
      .filter(m => {
        // Exclude embeddings, audio-only, speech, robotics, and deprecated models
        if (!m.id.startsWith('gemini')) return false;
        if (m.id.includes('embedding') || m.id.includes('robotics') || m.id.includes('transcribe') || m.id.includes('tts') || m.id.includes('audio')) return false;
        if (m.isDeprecated) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort latest flagship models first
        if (a.id === 'gemini-3.8-flash') return -1;
        if (b.id === 'gemini-3.8-flash') return 1;
        if (a.id === 'gemini-3.7-flash') return -1;
        if (b.id === 'gemini-3.7-flash') return 1;
        if (a.id === 'gemini-3.6-flash') return -1;
        if (b.id === 'gemini-3.6-flash') return 1;
        if (a.id === 'gemini-flash-latest') return -1;
        if (b.id === 'gemini-flash-latest') return 1;
        return a.id.localeCompare(b.id);
      });

    return {
      success: true,
      models: liveModels,
      latestRecommendation: 'gemini-3.8-flash',
    };
  } catch (err: any) {
    return {
      success: false,
      models: [],
      latestRecommendation: 'gemini-3.8-flash',
      error: err.message || 'Failed to query live Google models',
    };
  }
}

