import React, { useState, useEffect } from 'react';
import { 
  Power, CheckCircle2, AlertTriangle, Key, ExternalLink, 
  RefreshCw, Play, Loader2, Eye, EyeOff, Cpu, ShieldAlert, Check,
  Sparkles, Globe, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RecommendedModel {
  id: string;
  name: string;
  description: string;
  isSweetSpot?: boolean;
}

interface ProviderView {
  name: string;
  website: string;
  enabled: boolean;
  model: string;
  defaultModel: string;
  recommendedModels?: RecommendedModel[];
  rateLimitNotice?: string;
  isConfigured: boolean;
  isValid?: boolean;
  lastValidated?: number;
  validationError?: string;
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

  // Live models lookup state
  const [liveGeminiModels, setLiveGeminiModels] = useState<Array<{
    id: string;
    name: string;
    displayName: string;
    description: string;
    isLatest: boolean;
    isSweetSpot: boolean;
  }> | null>(null);
  const [fetchingLiveModels, setFetchingLiveModels] = useState(false);
  const [liveModelsError, setLiveModelsError] = useState<string | null>(null);
  const [showLiveModels, setShowLiveModels] = useState(false);

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

  const handleToggleProviderEnabled = async (providerId: string, currentEnabled: boolean) => {
    setSaving(true);
    const newEnabled = !currentEnabled;
    try {
      const updates: any = {
        [providerId]: {
          enabled: newEnabled,
        },
      };
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerUpdates: updates }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        const name = data.config.providers[providerId]?.name || providerId;
        if (newEnabled) {
          toast.success(`${name} API enabled`);
        } else {
          toast.success(`${name} API completely disabled and suppressed`);
        }
      } else {
        toast.error('Failed to update provider status');
      }
    } catch {
      toast.error('Error updating provider status');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectActiveProvider = async (providerId: string) => {
    if (!config) return;
    setSaving(true);
    try {
      const payload: any = { activeProvider: providerId };
      const pendingKey = keyInputs[providerId]?.trim();
      const pendingModel = modelInputs[providerId]?.trim();
      if (pendingKey || pendingModel) {
        payload.providerUpdates = {
          [providerId]: {
            ...(pendingKey ? { apiKey: pendingKey } : {}),
            ...(pendingModel ? { model: pendingModel } : {}),
            enabled: true,
          },
        };
      }
      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        if (pendingKey) {
          setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
        }
        toast.success(`Active AI provider set to ${data.config.providers[providerId]?.name || providerId}`);
      } else {
        toast.error('Failed to set active provider');
      }
    } catch {
      toast.error('Error setting active provider');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProvider = async (providerId: string, overrideModel?: string) => {
    setSaving(true);
    try {
      const updates: any = {};
      const newKey = keyInputs[providerId]?.trim();
      const newModel = overrideModel?.trim() || modelInputs[providerId]?.trim();

      const providerUpdate: any = {};
      if (newKey) {
        providerUpdate.apiKey = newKey;
        providerUpdate.enabled = true; // Automatically enable when a key is saved
      }
      if (newModel) {
        providerUpdate.model = newModel;
      }

      updates[providerId] = providerUpdate;

      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerUpdates: updates }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
        if (overrideModel) {
          setModelInputs(prev => ({ ...prev, [providerId]: overrideModel }));
        }
        toast.success(`Active model updated to ${newModel || 'default'}`);
      } else {
        toast.error('Failed to save provider settings');
      }
    } catch {
      toast.error('Error saving provider settings');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchLiveGeminiModels = async () => {
    setFetchingLiveModels(true);
    setLiveModelsError(null);
    setShowLiveModels(true);
    try {
      const pendingKey = keyInputs['gemini']?.trim();
      const url = pendingKey 
        ? `/api/admin/gemini-live-models?apiKey=${encodeURIComponent(pendingKey)}`
        : '/api/admin/gemini-live-models';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.models)) {
        setLiveGeminiModels(data.models);
        toast.success(`Queried Google API: ${data.models.length} active models available`);
      } else {
        setLiveModelsError(data.error || 'Failed to fetch live models from Google API');
        toast.error(data.error || 'Failed to query live Google models');
      }
    } catch (err: any) {
      setLiveModelsError(err.message || 'Error connecting to Google API');
      toast.error('Error contacting live Google API');
    } finally {
      setFetchingLiveModels(false);
    }
  };

  const handleRunTest = async (providerId: string) => {
    setTestingProvider(providerId);
    setTestResult(null);
    try {
      const pendingKey = keyInputs[providerId]?.trim();
      const currentModel = modelInputs[providerId]?.trim() || config?.providers[providerId]?.model;
      const res = await fetch('/api/admin/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          ...(pendingKey ? { apiKey: pendingKey } : {}),
          ...(currentModel ? { model: currentModel } : {}),
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(`${config?.providers[providerId]?.name} connected (${data.latencyMs}ms)`);
        if (pendingKey) {
          setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
          const refRes = await fetch('/api/admin/ai-config');
          if (refRes.ok) {
            const fresh = await refRes.json();
            setConfig(fresh);
          }
        }
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif font-bold text-xl text-stone-900">Active AI Engine</h3>
            <p className="text-stone-500 text-xs md:text-sm mt-1">
              Choose which provider powers listing generation, vision OCR, concierge assistance, and reminders.
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-emerald-800 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Active engine preference is permanently saved and will never auto-switch.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(config.providers).map(([pid, p], pIdx) => {
            const isActive = config.activeProvider === pid;
            const isEnabled = p.enabled !== false;
            return (
              <div
                key={`active-prov-card-${pid}-${pIdx}`}
                onClick={() => {
                  if (!isEnabled) {
                    toast('Enabling ' + p.name + ' and setting as active AI engine...', { icon: '⚡' });
                  }
                  handleSelectActiveProvider(pid);
                }}
                className={`relative p-5 rounded-2xl border cursor-pointer transition-all ${
                  isActive
                    ? 'border-stone-900 bg-stone-50/80 ring-2 ring-stone-900 shadow-sm'
                    : !isEnabled
                    ? 'border-stone-200 bg-stone-100/50 hover:border-stone-300 opacity-60'
                    : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm text-stone-900">{p.name}</h4>
                      {!isEnabled && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-stone-200 text-stone-600">
                          Disabled
                        </span>
                      )}
                    </div>
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
                    <span className={`inline-flex items-center gap-1 font-medium ${isEnabled ? 'text-emerald-600' : 'text-stone-400'}`}>
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
            Store API keys securely on the server. Keys are masked and never exposed to client browsers. Enable or completely disable individual AI APIs as desired.
          </p>
        </div>

        <div className="space-y-6 divide-y divide-stone-100">
          {Object.entries(config.providers).map(([pid, p], pIdx) => {
            const isEditingKey = showKey[pid];
            const hasInputValue = !!keyInputs[pid];
            const isTesting = testingProvider === pid;
            const isEnabled = p.enabled !== false;

            return (
              <div key={`prov-config-row-${pid}-${pIdx}`} className={`pt-6 first:pt-0 space-y-4 ${!isEnabled ? 'opacity-75' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold text-stone-900 text-sm">{p.name}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                      ID: {pid}
                    </span>

                    {/* Enable / Disable Status Button */}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleToggleProviderEnabled(pid, isEnabled)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition border cursor-pointer ${
                        isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      }`}
                      title={isEnabled ? 'Click to completely disable this AI API' : 'Click to enable this AI API'}
                    >
                      <Power className="w-2.5 h-2.5" />
                      <span>{isEnabled ? 'API Enabled' : 'API Disabled'}</span>
                    </button>

                    {isEnabled && (
                      p.isConfigured ? (
                        p.isValid === false ? (
                          <span className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>Invalid Key</span>
                          </span>
                        ) : p.isValid === true ? (
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Verified & Ready</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full font-medium">
                            Configured
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-full font-medium">
                          No Key
                        </span>
                      )
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {p.isConfigured && (
                      <button
                        type="button"
                        disabled={isTesting}
                        onClick={() => handleRunTest(pid)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition border border-stone-200 disabled:opacity-50 cursor-pointer"
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

                {!isEnabled && (
                  <div className="text-[11px] text-stone-600 bg-stone-100/90 border border-dashed border-stone-300 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-stone-400 shrink-0" />
                      <span>
                        <strong>API Completely Disabled:</strong> {p.name} is silenced and suppressed from chat, listing generation, vision OCR, and fallback chains.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleToggleProviderEnabled(pid, false)}
                      className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Enable {p.name}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* API Key Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-stone-600">
                        API Key {p.maskedKey && <span className="text-stone-400 font-normal font-mono">({p.maskedKey})</span>}
                      </label>
                      {p.isConfigured && (
                        <span className="text-[10px] text-emerald-600 font-medium">
                          {p.source === 'environment' ? 'Active via Environment' : 'Key Saved'}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={isEditingKey ? 'text' : 'password'}
                          value={keyInputs[pid] || ''}
                          onChange={e => setKeyInputs(prev => ({ ...prev, [pid]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && keyInputs[pid]?.trim()) {
                              handleSaveProvider(pid);
                            }
                          }}
                          placeholder={
                            p.isConfigured 
                              ? (p.source === 'environment' ? 'Configured in system environment' : 'Enter new key to update...')
                              : pid === 'gemini'
                              ? 'Enter Gemini API key (starts with AIzaSy...)'
                              : 'Enter API key (e.g. sk-...)'
                          }
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-3.5 pr-10 py-2 text-xs font-mono outline-none focus:border-stone-900 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(prev => ({ ...prev, [pid]: !prev[pid] }))}
                          className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                        >
                          {isEditingKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {hasInputValue && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveProvider(pid)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Key</span>
                        </button>
                      )}
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
                        disabled={saving || (modelInputs[pid] === undefined || modelInputs[pid] === p.model)}
                        onClick={() => handleSaveProvider(pid)}
                        className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                      >
                        Save Model
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recommended Models & Sweet Spots */}
                {p.recommendedModels && p.recommendedModels.length > 0 && (
                  <div className="bg-stone-50/80 p-3 rounded-xl border border-stone-200/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                        Recommended Models &amp; Sweet Spots:
                      </span>
                      {pid === 'gemini' && (
                        <button
                          type="button"
                          onClick={handleFetchLiveGeminiModels}
                          disabled={fetchingLiveModels}
                          className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                        >
                          {fetchingLiveModels ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Globe className="w-3 h-3" />
                          )}
                          <span>Check Live Google Models</span>
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.recommendedModels.map((m, mIdx) => {
                        const isCurrent = (modelInputs[pid] ?? p.model) === m.id;
                        return (
                          <button
                            key={`rec-model-${pid}-${m.id}-${mIdx}`}
                            type="button"
                            onClick={() => {
                              setModelInputs(prev => ({ ...prev, [pid]: m.id }));
                              handleSaveProvider(pid, m.id);
                            }}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-stone-900 text-white border-stone-900 font-semibold shadow-2xs'
                                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                            title={m.description}
                          >
                            <span>{m.name}</span>
                            {m.isSweetSpot && (
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                                isCurrent ? 'bg-amber-400 text-stone-950' : 'bg-amber-100 text-amber-900'
                              }`}>
                                Sweet Spot
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Live Google API Models Results Section */}
                    {pid === 'gemini' && showLiveModels && (
                      <div className="mt-3 pt-3 border-t border-stone-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Live Google Models (Direct from API)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowLiveModels(false)}
                            className="text-[10px] text-stone-400 hover:text-stone-600 cursor-pointer"
                          >
                            Hide
                          </button>
                        </div>

                        {fetchingLiveModels && (
                          <div className="flex items-center gap-2 py-2 text-xs text-stone-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-700" />
                            <span>Connecting to Google Generative Language API...</span>
                          </div>
                        )}

                        {liveModelsError && (
                          <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                            {liveModelsError}
                          </div>
                        )}

                        {liveGeminiModels && liveGeminiModels.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                            {liveGeminiModels.map((lm) => {
                              const isSelected = (modelInputs['gemini'] ?? p.model) === lm.id;
                              return (
                                <div
                                  key={lm.id}
                                  className={`p-2 rounded-lg border text-left flex flex-col justify-between gap-1 transition ${
                                    isSelected 
                                      ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400' 
                                      : 'bg-white border-stone-200 hover:border-stone-300'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-mono font-bold text-stone-900 truncate">
                                        {lm.id}
                                      </span>
                                      {lm.isLatest && (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded uppercase shrink-0">
                                          Latest
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-stone-500 line-clamp-2 mt-0.5">
                                      {lm.description || lm.name}
                                    </p>
                                  </div>
                                  <div className="pt-1 flex items-center justify-between">
                                    {isSelected ? (
                                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Active Model
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setModelInputs(prev => ({ ...prev, gemini: lm.id }));
                                          handleSaveProvider('gemini', lm.id);
                                        }}
                                        className="text-[10px] font-semibold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded cursor-pointer transition"
                                      >
                                        Use This Model
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Rate Limit Strategy Notice */}
                {p.rateLimitNotice && (
                  <div className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 flex items-center gap-2">
                    <span className="font-bold text-stone-700 uppercase text-[10px] tracking-wider shrink-0 bg-stone-200/80 px-1.5 py-0.5 rounded">
                      Rate Strategy
                    </span>
                    <span>{p.rateLimitNotice}</span>
                  </div>
                )}

                {/* Authentication Failure Notice */}
                {p.isValid === false && p.validationError && (
                  <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Authentication Error: </span>
                      <span>{p.validationError}</span>
                      <p className="text-[10px] text-red-600 mt-0.5">
                        Please update your API key above or select a different provider. AI features will remain safely suppressed until a valid key is provided.
                      </p>
                    </div>
                  </div>
                )}
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
          • <strong>Standard Cost-Effective Models:</strong> By default, this system connects to lightweight models (DeepSeek-V3, GPT-4o-mini, Mistral Small, Gemini 3.8 Flash). These models cost fractions of a cent per generation, avoiding wasteful token expenses while delivering vivid, authentic hospitality copy.
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
