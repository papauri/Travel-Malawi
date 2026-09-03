import fs from 'fs';
import path from 'path';

export type AIProviderId = 'deepseek' | 'openai' | 'mistral' | 'gemini' | 'groq' | 'anthropic';

export interface ProviderConfig {
  apiKey?: string;
  model: string;
  defaultModel: string;
  name: string;
  website: string;
}

export interface AISystemConfig {
  enabled: boolean;
  activeProvider: AIProviderId;
  providers: Record<AIProviderId, ProviderConfig>;
  updatedAt?: number;
}

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai_config.json');

const DEFAULT_PROVIDERS: Record<AIProviderId, ProviderConfig> = {
  deepseek: {
    model: 'deepseek-chat',
    defaultModel: 'deepseek-chat',
    name: 'DeepSeek',
    website: 'https://platform.deepseek.com',
  },
  openai: {
    model: 'gpt-4o-mini',
    defaultModel: 'gpt-4o-mini',
    name: 'OpenAI (ChatGPT)',
    website: 'https://platform.openai.com',
  },
  mistral: {
    model: 'mistral-small-latest',
    defaultModel: 'mistral-small-latest',
    name: 'Mistral AI',
    website: 'https://console.mistral.ai',
  },
  gemini: {
    model: 'gemini-1.5-flash',
    defaultModel: 'gemini-1.5-flash',
    name: 'Google Gemini',
    website: 'https://aistudio.google.com',
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    defaultModel: 'llama-3.3-70b-versatile',
    name: 'Groq (Llama)',
    website: 'https://console.groq.com',
  },
  anthropic: {
    model: 'claude-3-5-haiku-20241022',
    defaultModel: 'claude-3-5-haiku-20241022',
    name: 'Anthropic Claude',
    website: 'https://console.anthropic.com',
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
      
      // Merge with defaults
      inMemoryConfig = {
        enabled: parsed.enabled ?? true,
        activeProvider: parsed.activeProvider || 'deepseek',
        providers: {
          ...DEFAULT_PROVIDERS,
          ...(parsed.providers || {}),
        },
        updatedAt: parsed.updatedAt || Date.now(),
      };
      return inMemoryConfig;
    }
  } catch (err) {
    console.warn('Could not read ai_config.json, using defaults', err);
  }

  // Initialize fresh config
  inMemoryConfig = {
    enabled: true,
    activeProvider: 'deepseek',
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

export function getPublicAIStatus() {
  const config = loadAIConfig();
  const activeKey = getEffectiveApiKey(config.activeProvider);

  return {
    enabled: !!config.enabled,
    activeProvider: config.activeProvider,
    model: config.providers[config.activeProvider]?.model || DEFAULT_PROVIDERS[config.activeProvider].defaultModel,
    available: !!config.enabled && !!activeKey,
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
      isConfigured: !!effectiveKey,
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
