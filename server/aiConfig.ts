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
    model: 'gemini-2.0-flash',
    defaultModel: 'gemini-2.0-flash',
    name: 'Google Gemini',
    website: 'https://aistudio.google.com',
    rateLimitNotice: 'Generous free tier with ultra-fast sub-second latency and high throughput.',
    recommendedModels: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: '⚡ Sweet Spot: State-of-the-art speed, multi-turn reasoning, ultra-fast sub-second responses',
        isSweetSpot: true,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: '🚀 Proven workhorse Flash model with generous 15 RPM / 1M TPM free tier',
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: '🧠 Deep reasoning, complex hospitality analysis and 2M token context window',
      },
    ],
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    defaultModel: 'llama-3.3-70b-versatile',
    name: 'Groq (Llama)',
    website: 'https://console.groq.com',
    rateLimitNotice: 'Free Tier: 30 req/min, blazing LPU inference speeds.',
    recommendedModels: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        description: '⚡ Sweet Spot: Near-instant inference with state-of-the-art reasoning',
        isSweetSpot: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: '🚀 Ultra-lightweight model with lowest latency',
      },
    ],
  },
  deepseek: {
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
      return process.env.GEMINI_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

let inMemoryConfig: AISystemConfig | null = null;

function autoSelectWorkingProvider(config: AISystemConfig) {
  const currentKey = config.providers[config.activeProvider]?.apiKey?.trim() || getEnvApiKey(config.activeProvider);
  const isCurrentValid = config.providers[config.activeProvider]?.isValid !== false;

  if (!currentKey || !isCurrentValid) {
    const providers = Object.keys(DEFAULT_PROVIDERS) as AIProviderId[];
    for (const pid of providers) {
      const key = config.providers[pid]?.apiKey?.trim() || getEnvApiKey(pid);
      const isValid = config.providers[pid]?.isValid !== false;
      if (key && isValid && key.length > 5) {
        config.activeProvider = pid;
        break;
      }
    }
  }
}

export function loadAIConfig(): AISystemConfig {
  if (inMemoryConfig) {
    const oldProvider = inMemoryConfig.activeProvider;
    autoSelectWorkingProvider(inMemoryConfig);
    if (oldProvider !== inMemoryConfig.activeProvider) {
      saveAIConfig(inMemoryConfig);
    }
    return inMemoryConfig;
  }

  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      // Merge with defaults
      inMemoryConfig = {
        enabled: parsed.enabled ?? true,
        activeProvider: parsed.activeProvider || 'mistral',
        providers: {
          ...DEFAULT_PROVIDERS,
          ...(parsed.providers || {}),
        },
        updatedAt: parsed.updatedAt || Date.now(),
      };
      
      // Ensure each provider has latest recommendedModels & rateLimitNotice
      (Object.keys(DEFAULT_PROVIDERS) as AIProviderId[]).forEach(pid => {
        inMemoryConfig!.providers[pid] = {
          ...DEFAULT_PROVIDERS[pid],
          ...inMemoryConfig!.providers[pid],
          recommendedModels: DEFAULT_PROVIDERS[pid].recommendedModels,
          rateLimitNotice: DEFAULT_PROVIDERS[pid].rateLimitNotice,
        };
      });

      // Auto-migrate legacy/invalid checkpoints to production gemini-2.0-flash
      const currentGeminiModel = inMemoryConfig!.providers.gemini?.model;
      if (
        currentGeminiModel === 'gemini-3.6-flash' ||
        currentGeminiModel === 'gemini-3.8-flash' ||
        currentGeminiModel === 'gemini-2.5-flash' ||
        currentGeminiModel === 'gemini-flash-latest'
      ) {
        inMemoryConfig!.providers.gemini.model = 'gemini-2.0-flash';
        saveAIConfig(inMemoryConfig!);
      }

      const oldProvider = inMemoryConfig.activeProvider;
      autoSelectWorkingProvider(inMemoryConfig);
      if (oldProvider !== inMemoryConfig.activeProvider) {
        saveAIConfig(inMemoryConfig);
      }
      
      return inMemoryConfig;
    }
  } catch (err) {
    console.warn('Could not read ai_config.json, using defaults', err);
  }

  // Initialize fresh config
  inMemoryConfig = {
    enabled: true,
    activeProvider: 'mistral',
    providers: { ...DEFAULT_PROVIDERS },
    updatedAt: Date.now(),
  };
  autoSelectWorkingProvider(inMemoryConfig);
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

export function getEffectiveApiKey(provider: AIProviderId): string | undefined {
  const config = loadAIConfig();
  const configuredKey = config.providers[provider]?.apiKey?.trim();
  if (configuredKey) return configuredKey;
  return getEnvApiKey(provider);
}

export function getAvailableProviders(): AIProviderId[] {
  const config = loadAIConfig();
  const ordered: AIProviderId[] = [];
  const allProviders = Object.keys(DEFAULT_PROVIDERS) as AIProviderId[];
  
  // Active provider first
  const activeKey = getEffectiveApiKey(config.activeProvider);
  if (activeKey && activeKey.trim().length > 5 && config.providers[config.activeProvider]?.isValid !== false) {
    ordered.push(config.activeProvider);
  }
  
  // Then remaining providers with valid keys
  for (const pid of allProviders) {
    if (pid === config.activeProvider) continue;
    const key = getEffectiveApiKey(pid);
    if (key && key.trim().length > 5 && config.providers[pid]?.isValid !== false) {
      ordered.push(pid);
    }
  }
  
  return ordered;
}

export function getPublicAIStatus() {
  const config = loadAIConfig();
  const activeKey = getEffectiveApiKey(config.activeProvider);
  const providerConf = config.providers[config.activeProvider];

  // Key must exist, be trimmed, non-placeholder, and not invalidated by authentication failure
  const hasValidKeyFormat = !!activeKey && activeKey.trim().length > 5 && !activeKey.includes('placeholder') && !activeKey.includes('your_');
  const isNotInvalidated = providerConf?.isValid !== false;
  const available = !!config.enabled && hasValidKeyFormat && isNotInvalidated;

  return {
    enabled: !!config.enabled,
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
    const effectiveKey = getEffectiveApiKey(pid);
    const hasConfiguredKey = !!p.apiKey?.trim();
    const hasEnvKey = !!getEnvApiKey(pid);

    providersView[pid] = {
      name: p.name || DEFAULT_PROVIDERS[pid].name,
      website: p.website || DEFAULT_PROVIDERS[pid].website,
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
