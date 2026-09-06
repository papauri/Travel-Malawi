import React, { useState, useEffect } from 'react';
import { 
  Power, CheckCircle2, AlertTriangle, Key, ExternalLink, 
  RefreshCw, Play, Loader2, Eye, EyeOff, Cpu, ShieldAlert, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProviderView {
  name: string;
  website: string;
  model: string;
  defaultModel: string;
  isConfigured: boolean;
  maskedKey: string;
  source: 'manual' | 'environment' | 'none';
}

interface AdminConfigData {
  enabled: boolean;
  activeProvider: string;
  providers: Record<string, ProviderView>;
  updatedAt?: number;
}

export default function AdminAISettings() {
  const [config, setConfig] = useState<AdminConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New keys / model edits
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // Testing state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    sample?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/ai-config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // Pre-fill model inputs
        const models: Record<string, string> = {};
        Object.entries(data.providers).forEach(([pid, p]: [string, any]) => {
          models[pid] = p.model || p.defaultModel;
        });
        setModelInputs(models);
      }
    } catch (err) {
      console.error('Failed to load AI config:', err);
      toast.error('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggleKillSwitch = async () => {
    if (!config) return;
    const newEnabled = !config.enabled;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        toast.success(newEnabled ? 'AI Assistant activated platform-wide' : 'AI Kill Switch activated: all AI features suppressed');
      } else {
        toast.error('Failed to update AI status');
      }
    } catch {
      toast.error('Network error updating AI status');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectActiveProvider = async (providerId: string) => {
    if (!config || config.activeProvider === providerId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeProvider: providerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        toast.success(`Active AI provider changed to ${data.config.providers[providerId]?.name || providerId}`);
      } else {
        toast.error('Failed to set active provider');
      }
    } catch {
      toast.error('Error setting active provider');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProvider = async (providerId: string) => {
    setSaving(true);
    try {
      const updates: any = {};
      const newKey = keyInputs[providerId]?.trim();
      const newModel = modelInputs[providerId]?.trim();

      const providerUpdate: any = {};
      if (newKey) providerUpdate.apiKey = newKey;
      if (newModel) providerUpdate.model = newModel;

      updates[providerId] = providerUpdate;

      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerUpdates: updates }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        // Clear sensitive input
        setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
        toast.success(`Saved settings for ${config?.providers[providerId]?.name || providerId}`);
      } else {
        toast.error('Failed to save provider settings');
      }
    } catch {
      toast.error('Error saving provider settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async (providerId: string) => {
    setTestingProvider(providerId);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(`${config?.providers[providerId]?.name} connected (${data.latencyMs}ms)`);
      } else {
        toast.error(`Test failed: ${data.error || 'Connection error'}`);
      }
    } catch (err: any) {
      setTestResult({
        provider: providerId,
        success: false,
        error: err?.message || 'Network error executing test',
      });
      toast.error('Network error during AI test');
    } finally {
      setTestingProvider(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400 space-x-3">
        <Loader2 className="w-6 h-6 animate-spin text-stone-600" />
        <span className="text-sm font-medium">Loading AI configuration...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 bg-stone-50 border border-stone-200 rounded-2xl text-center">
        <p className="text-stone-600">Failed to connect to AI administration service.</p>
        <button
          onClick={fetchConfig}
          className="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeProviderData = config.providers[config.activeProvider];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl">
      {/* Title & Introduction */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-serif font-bold text-stone-900">AI Services & Provider Keys</h2>
            <p className="text-stone-500 text-sm mt-1">
              Configure multi-provider AI backends for manager onboarding and descriptions, with global kill switch control.
            </p>
          </div>
          <button
            onClick={fetchConfig}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. MASTER KILL SWITCH CARD */}
      <div className={`p-6 md:p-8 rounded-2xl border transition-all ${
        config.enabled 
          ? 'bg-stone-900 text-white border-stone-900 shadow-sm' 
          : 'bg-red-950/10 border-red-200 text-stone-900'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                config.enabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-red-500/20 text-red-700 border border-red-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                {config.enabled ? 'AI System Operational' : 'Global Kill Switch Active'}
              </span>
              {config.enabled && activeProviderData && (
                <span className="text-xs text-stone-400">
                  Routing requests to <span className="text-white font-medium">{activeProviderData.name}</span>
                </span>
              )}
            </div>
            <h3 className={`text-xl font-serif font-bold ${config.enabled ? 'text-white' : 'text-stone-900'}`}>
              Platform-Wide AI Kill Switch
            </h3>
            <p className={`text-xs md:text-sm max-w-2xl leading-relaxed ${config.enabled ? 'text-stone-300' : 'text-stone-600'}`}>
              {config.enabled 
                ? 'AI assistance is active. Managers can use subtle drafting tools during property and room onboarding.'
                : 'All AI features, writing assistance buttons, and server generation endpoints are completely suppressed and hidden across the entire application.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleToggleKillSwitch}
              disabled={saving}
              className={`flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm transition shadow-sm ${
                config.enabled 
                  ? 'bg-red-600 hover:bg-red-500 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{config.enabled ? 'Trigger Kill Switch (Deactivate All AI)' : 'Re-enable AI Platform'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE PROVIDER SELECTION */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-2xs space-y-6">
        <div>
          <h3 className="font-serif font-bold text-xl text-stone-900">Active AI Engine</h3>
          <p className="text-stone-500 text-xs md:text-sm mt-1">
            Choose which provider powers all listing generation and text refinements across the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(config.providers).map(([pid, p]) => {
            const isActive = config.activeProvider === pid;
            return (
              <div
                key={pid}
                onClick={() => handleSelectActiveProvider(pid)}
                className={`relative p-5 rounded-2xl border cursor-pointer transition-all ${
                  isActive
                    ? 'border-stone-900 bg-stone-50/80 ring-2 ring-stone-900 shadow-sm'
                    : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-stone-900">{p.name}</h4>
                    <p className="text-[11px] font-mono text-stone-500">{p.model}</p>
                  </div>
                  {isActive ? (
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-stone-300 shrink-0" />
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  {p.isConfigured ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{p.source === 'environment' ? 'Env Variable' : 'Key configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-stone-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>No Key</span>
                    </span>
                  )}

                  <a
                    href={p.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-stone-400 hover:text-stone-700 inline-flex items-center gap-1 text-[11px]"
                  >
                    <span>Portal</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. API KEYS & MODEL CONFIGURATION */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-2xs space-y-6">
        <div>
          <h3 className="font-serif font-bold text-xl text-stone-900">Provider Credentials & Models</h3>
          <p className="text-stone-500 text-xs md:text-sm mt-1">
            Store API keys securely on the server. Keys are masked and never exposed to client browsers.
          </p>
        </div>

        <div className="space-y-6 divide-y divide-stone-100">
          {Object.entries(config.providers).map(([pid, p]) => {
            const isEditingKey = showKey[pid];
            const hasInputValue = !!keyInputs[pid];
            const isTesting = testingProvider === pid;

            return (
              <div key={pid} className="pt-6 first:pt-0 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-stone-900 text-sm">{p.name}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                      ID: {pid}
                    </span>
                    {p.isConfigured && (
                      <span className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                        Ready
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {p.isConfigured && (
                      <button
                        type="button"
                        disabled={isTesting}
                        onClick={() => handleRunTest(pid)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition border border-stone-200 disabled:opacity-50"
                      >
                        {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        <span>Test Connection</span>
                      </button>
                    )}
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 px-2.5 py-1.5"
                    >
                      <span>Get Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* API Key Field */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                      API Key {p.maskedKey && <span className="text-stone-400 font-normal font-mono">({p.maskedKey})</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={isEditingKey ? 'text' : 'password'}
                        value={keyInputs[pid] || ''}
                        onChange={e => setKeyInputs(prev => ({ ...prev, [pid]: e.target.value }))}
                        placeholder={p.isConfigured ? 'Enter new key to update...' : 'Enter API key (e.g. sk-...)'}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-3.5 pr-10 py-2 text-xs font-mono outline-none focus:border-stone-900 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(prev => ({ ...prev, [pid]: !prev[pid] }))}
                        className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                      >
                        {isEditingKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Model Selection Field */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                      Model Identifier <span className="text-stone-400 font-normal">(Default: {p.defaultModel})</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={modelInputs[pid] ?? p.model}
                        onChange={e => setModelInputs(prev => ({ ...prev, [pid]: e.target.value }))}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-mono outline-none focus:border-stone-900 transition"
                      />
                      <button
                        type="button"
                        disabled={saving || (!hasInputValue && modelInputs[pid] === p.model)}
                        onClick={() => handleSaveProvider(pid)}
                        className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. LIVE TEST RESULT PANEL */}
      {testResult && (
        <div className={`p-6 rounded-2xl border transition-all ${
          testResult.success 
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
            : 'bg-red-50/70 border-red-200 text-red-950'
        }`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <h4 className="font-bold text-sm">
                  {testResult.success ? 'Provider Connected Successfully' : 'Provider Connection Failed'}
                </h4>
                {testResult.latencyMs !== undefined && (
                  <span className="text-xs font-mono bg-white/80 px-2 py-0.5 rounded-full border border-stone-200/50">
                    {testResult.latencyMs}ms
                  </span>
                )}
              </div>
              <p className="text-xs opacity-80">
                Tested provider: <span className="font-semibold uppercase">{testResult.provider}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-xs opacity-60 hover:opacity-100 font-medium px-2 py-1"
            >
              Dismiss
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-black/5 text-xs">
            {testResult.success ? (
              <div>
                <span className="font-semibold block mb-1">Generated Sample:</span>
                <p className="italic bg-white/80 p-3 rounded-xl border border-emerald-100 font-serif leading-relaxed">
                  "{testResult.sample}"
                </p>
              </div>
            ) : (
              <div>
                <span className="font-semibold block mb-1">Error Details:</span>
                <p className="font-mono bg-white/80 p-3 rounded-xl border border-red-100 text-red-700">
                  {testResult.error}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. PRACTICAL COST & SECURITY NOTICE */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-xs text-stone-600 space-y-2">
        <h4 className="font-semibold text-stone-900 text-sm">Design & Cost Optimization Architecture</h4>
        <p className="leading-relaxed">
          • <strong>Standard Cost-Effective Models:</strong> By default, this system connects to lightweight models (DeepSeek-V3, GPT-4o-mini, Mistral Small, Gemini 1.5 Flash). These models cost fractions of a cent per generation, avoiding wasteful token expenses while delivering vivid, authentic hospitality copy.
        </p>
        <p className="leading-relaxed">
          • <strong>Zero Browser Key Exposure:</strong> All keys are stored server-side in persistent system configuration and handled through Node proxy endpoints. No API secret is ever bundled or transmitted to guest or manager browsers.
        </p>
        <p className="leading-relaxed">
          • <strong>Subtle Manager Integration:</strong> The writing assistant displays only minimal, dignified controls. When the global kill switch is active, all AI UI elements and server endpoints are completely suppressed.
        </p>
      </div>
    </div>
  );
}
