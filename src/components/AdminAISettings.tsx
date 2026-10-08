import React, { useState, useEffect, useMemo } from 'react';
import { 
  Power, CheckCircle2, AlertTriangle, Key, ExternalLink, 
  RefreshCw, Play, Loader2, Eye, EyeOff, Check,
  Sparkles, Globe, Search, ArrowRight, ShieldCheck,
  SlidersHorizontal, TableProperties, ChevronRight, X
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

interface LiveModelItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isLatest: boolean;
  isSweetSpot: boolean;
}

interface LiveModelsResult {
  provider: string;
  providerName: string;
  success: boolean;
  models: LiveModelItem[];
  latestRecommendation: string;
  source: 'live_api' | 'catalog';
  error?: string;
  latencyMs?: number;
}

export default function AdminAISettings() {
  const [config, setConfig] = useState<AdminConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selected provider in detail view
  const [selectedProviderId, setSelectedProviderId] = useState<string>('gemini');
  // View mode: 'focused' (tabbed detail) or 'matrix' (all-in-one table)
  const [viewMode, setViewMode] = useState<'focused' | 'matrix'>('focused');

  // Input states for keys and custom models
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // Filter query for live models
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Testing connection state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    sample?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // Live models lookup state
  const [liveModelsMap, setLiveModelsMap] = useState<Record<string, LiveModelsResult>>({});
  const [fetchingProviderModels, setFetchingProviderModels] = useState<Record<string, boolean>>({});
  const [showLiveModelsFor, setShowLiveModelsFor] = useState<Record<string, boolean>>({});
  const [fetchingAllProviders, setFetchingAllProviders] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/ai-config');
      if (res.ok) {
        const data: AdminConfigData = await res.json();
        setConfig(data);
        // Pre-fill model inputs
        const models: Record<string, string> = {};
        Object.entries(data.providers).forEach(([pid, p]) => {
          models[pid] = p.model || p.defaultModel;
        });
        setModelInputs(models);

        // Keep selected provider valid
        if (data.activeProvider && (!selectedProviderId || !data.providers[selectedProviderId])) {
          setSelectedProviderId(data.activeProvider);
        }
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
        toast.success(newEnabled ? 'Ulendo AI activated platform-wide' : 'AI Kill Switch activated: all AI features suppressed');
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
      const updates = {
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
          toast.success(`${name} enabled`);
        } else {
          toast.success(`${name} disabled`);
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
        toast.success(`Active provider set to ${data.config.providers[providerId]?.name || providerId}`);
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
        toast.success(`Saved settings for ${data.config.providers[providerId]?.name || providerId}`);
      } else {
        toast.error('Failed to save provider settings');
      }
    } catch {
      toast.error('Error saving provider settings');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchLiveModelsForProvider = async (providerId: string) => {
    setFetchingProviderModels(prev => ({ ...prev, [providerId]: true }));
    setShowLiveModelsFor(prev => ({ ...prev, [providerId]: true }));
    try {
      const pendingKey = keyInputs[providerId]?.trim();
      const url = pendingKey 
        ? `/api/admin/live-models?provider=${encodeURIComponent(providerId)}&apiKey=${encodeURIComponent(pendingKey)}`
        : `/api/admin/live-models?provider=${encodeURIComponent(providerId)}`;
      const res = await fetch(url);
      const data: LiveModelsResult = await res.json();
      setLiveModelsMap(prev => ({
        ...prev,
        [providerId]: data,
      }));
      if (data.success && Array.isArray(data.models)) {
        toast.success(`Found ${data.models.length} live models for ${data.providerName || providerId}`);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error(`Error connecting to ${providerId} API`);
    } finally {
      setFetchingProviderModels(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleFetchAllLiveModels = async () => {
    setFetchingAllProviders(true);
    try {
      const customKeys: Record<string, string> = {};
      Object.entries(keyInputs).forEach(([k, v]) => {
        if (v?.trim()) customKeys[k] = v.trim();
      });

      const res = await fetch('/api/admin/live-models-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customKeys }),
      });
      const data = await res.json();
      if (data.success && data.providers) {
        setLiveModelsMap(data.providers);
        const openMap: Record<string, boolean> = {};
        Object.keys(data.providers).forEach(k => {
          openMap[k] = true;
        });
        setShowLiveModelsFor(openMap);
        toast.success('Live model catalogs refreshed for all providers');
      } else {
        toast.error(data.error || 'Failed to query providers');
      }
    } catch {
      toast.error('Failed to query provider APIs');
    } finally {
      setFetchingAllProviders(false);
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
        toast.error(`Connection failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setTestResult({
        provider: providerId,
        success: false,
        error: err?.message || 'Network error executing test',
      });
      toast.error('Network error during connection test');
    } finally {
      setTestingProvider(null);
    }
  };

  // Filtered live models for currently inspected provider
  const filteredLiveModels = useMemo(() => {
    const list = liveModelsMap[selectedProviderId]?.models || [];
    if (!modelSearchQuery.trim()) return list;
    const q = modelSearchQuery.toLowerCase();
    return list.filter(m => 
      m.id.toLowerCase().includes(q) || 
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  }, [liveModelsMap, selectedProviderId, modelSearchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-stone-500 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-stone-700" />
        <span className="text-sm">Loading AI configuration...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 bg-stone-50 border border-stone-200 rounded-xl text-center">
        <p className="text-stone-600 text-sm">Failed to connect to the AI administration service.</p>
        <button
          onClick={fetchConfig}
          className="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeProvider = config.providers[config.activeProvider];
  const selectedProvider = config.providers[selectedProviderId] || activeProvider || Object.values(config.providers)[0];
  const configuredCount = Object.values(config.providers).filter(p => p.isConfigured).length;
  const totalCount = Object.keys(config.providers).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">AI Services & Provider Keys</h2>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
            Configure multi-provider backends for Ulendo hospitality intelligence, listing generation, and vision OCR.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleFetchAllLiveModels}
            disabled={fetchingAllProviders}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:border-stone-300 transition disabled:opacity-50"
            title="Query active models across all providers simultaneously"
          >
            {fetchingAllProviders ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-stone-500" />
            )}
            <span>{fetchingAllProviders ? 'Querying APIs...' : 'Query All Catalogs'}</span>
          </button>

          <button
            type="button"
            onClick={fetchConfig}
            className="p-1.5 text-stone-500 hover:text-stone-900 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition"
            title="Refresh status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Global Execution Control & System Status */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <h3 className="font-semibold text-stone-900 text-sm">
                {config.enabled ? 'Ulendo AI Engine Operational' : 'Global Kill Switch Active (All AI Suppressed)'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
              <span>Active Provider: <strong className="text-stone-800 font-medium">{activeProvider?.name || config.activeProvider}</strong></span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="font-mono text-stone-600">{activeProvider?.model}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="tabular-nums">{configuredCount} of {totalCount} providers configured</span>
            </div>
            <p className="text-xs text-stone-500 pt-0.5 max-w-2xl">
              {config.enabled
                ? 'Ulendo AI is active across manager onboarding, listing generation, vision OCR, and guest inquiry tools.'
                : 'All AI features, writing assistance buttons, and server endpoints are suppressed platform-wide.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
            <button
              type="button"
              onClick={handleToggleKillSwitch}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs ${
                config.enabled
                  ? 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{config.enabled ? 'Trigger Kill Switch (Suppress AI)' : 'Re-enable AI Platform'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Provider Workspace: Tabs & View Switcher */}
      <div className="space-y-4">
        {/* Navigation & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Provider selector tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {Object.entries(config.providers).map(([pid, p]) => {
              const isActive = config.activeProvider === pid;
              const isSelected = selectedProviderId === pid;
              const isEnabled = p.enabled !== false;

              return (
                <button
                  key={`provider-tab-${pid}`}
                  type="button"
                  onClick={() => {
                    setSelectedProviderId(pid);
                    setViewMode('focused');
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
                    isSelected && viewMode === 'focused'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                      : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    !isEnabled ? 'bg-stone-300' : p.isConfigured ? 'bg-emerald-500' : 'bg-amber-400'
                  }`} />
                  <span>{p.name}</span>
                  {isActive && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      isSelected && viewMode === 'focused' ? 'bg-stone-800 text-stone-200' : 'bg-stone-100 text-stone-700'
                    }`}>
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mode toggle: Focused vs Overview Table */}
          <div className="flex items-center gap-1 self-end sm:self-auto shrink-0 bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('focused')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'focused' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Detail</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'matrix' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Matrix</span>
            </button>
          </div>
        </div>

        {/* 4. Focused Provider Configuration Pane */}
        {viewMode === 'focused' && selectedProvider && (
          <div className="bg-white border border-stone-200 rounded-xl p-5 md:p-6 shadow-2xs space-y-6 animate-in fade-in duration-150">
            {/* Top Bar for Selected Provider */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-serif font-bold text-lg text-stone-900">{selectedProvider.name}</h3>
                  <a
                    href={selectedProvider.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-400 hover:text-stone-700 inline-flex items-center gap-1 text-xs"
                    title={`Open ${selectedProvider.name} developer portal`}
                  >
                    <span>Developer Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
                  <span>Provider ID: <code className="font-mono text-stone-700">{selectedProviderId}</code></span>
                  <span aria-hidden="true" className="text-stone-300">·</span>
                  <span>{selectedProvider.source === 'environment' ? 'Configured via Environment' : selectedProvider.isConfigured ? 'Manual key configured' : 'No API key set'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Active Provider Button */}
                {config.activeProvider === selectedProviderId ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200">
                    <Check className="w-3.5 h-3.5 text-stone-800" />
                    <span>Current Active Engine</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectActiveProvider(selectedProviderId)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white transition shadow-2xs cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Set as Active Engine</span>
                  </button>
                )}

                {/* Enable/Disable Toggle */}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleProviderEnabled(selectedProviderId, selectedProvider.enabled !== false)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border cursor-pointer ${
                    selectedProvider.enabled !== false
                      ? 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{selectedProvider.enabled !== false ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </div>

            {/* Notice if provider is disabled */}
            {selectedProvider.enabled === false && (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-600 flex items-center justify-between gap-3">
                <span>
                  <strong>Provider Disabled:</strong> {selectedProvider.name} is excluded from active routing, vision OCR, and fallback chains.
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleProviderEnabled(selectedProviderId, false)}
                  className="text-xs font-semibold text-stone-900 hover:underline shrink-0"
                >
                  Enable Provider
                </button>
              </div>
            )}

            {/* Credentials & Model Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-stone-700">
                    API Key {selectedProvider.maskedKey && <span className="font-mono text-stone-400 font-normal">({selectedProvider.maskedKey})</span>}
                  </label>
                  {selectedProvider.isConfigured && (
                    <span className="text-[11px] text-stone-500">
                      {selectedProvider.source === 'environment' ? 'System Environment' : 'Database Stored'}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey[selectedProviderId] ? 'text' : 'password'}
                      value={keyInputs[selectedProviderId] || ''}
                      onChange={e => setKeyInputs(prev => ({ ...prev, [selectedProviderId]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && keyInputs[selectedProviderId]?.trim()) {
                          handleSaveProvider(selectedProviderId);
                        }
                      }}
                      placeholder={
                        selectedProvider.isConfigured
                          ? (selectedProvider.source === 'environment' ? 'Loaded from system environment' : 'Enter new key to update...')
                          : selectedProviderId === 'gemini'
                          ? 'Starts with AIzaSy...'
                          : 'Starts with sk-...'
                      }
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-3 pr-9 py-2 text-xs font-mono text-stone-900 placeholder-stone-400 focus:bg-white focus:border-stone-900 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(prev => ({ ...prev, [selectedProviderId]: !prev[selectedProviderId] }))}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"
                      tabIndex={-1}
                    >
                      {showKey[selectedProviderId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {keyInputs[selectedProviderId]?.trim() && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveProvider(selectedProviderId)}
                      className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition shrink-0"
                    >
                      Save Key
                    </button>
                  )}
                </div>
              </div>

              {/* Model Identifier */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-stone-700">
                    Model Identifier <span className="font-normal text-stone-400">(Default: {selectedProvider.defaultModel})</span>
                  </label>
                  {selectedProvider.model !== selectedProvider.defaultModel && (
                    <button
                      type="button"
                      onClick={() => {
                        setModelInputs(prev => ({ ...prev, [selectedProviderId]: selectedProvider.defaultModel }));
                        handleSaveProvider(selectedProviderId, selectedProvider.defaultModel);
                      }}
                      className="text-[11px] text-stone-500 hover:text-stone-900 underline"
                    >
                      Reset default
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modelInputs[selectedProviderId] ?? selectedProvider.model}
                    onChange={e => setModelInputs(prev => ({ ...prev, [selectedProviderId]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleSaveProvider(selectedProviderId);
                      }
                    }}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:bg-white focus:border-stone-900 outline-none transition"
                  />
                  <button
                    type="button"
                    disabled={saving || (modelInputs[selectedProviderId] === undefined || modelInputs[selectedProviderId] === selectedProvider.model)}
                    onClick={() => handleSaveProvider(selectedProviderId)}
                    className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    Save Model
                  </button>
                </div>
              </div>
            </div>

            {/* Recommended Models */}
            {selectedProvider.recommendedModels && selectedProvider.recommendedModels.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700">Recommended Models</span>
                  <button
                    type="button"
                    onClick={() => handleFetchLiveModelsForProvider(selectedProviderId)}
                    disabled={fetchingProviderModels[selectedProviderId]}
                    className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 transition disabled:opacity-50"
                  >
                    {fetchingProviderModels[selectedProviderId] ? (
                      <Loader2 className="w-3 h-3 animate-spin text-stone-700" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-stone-500" />
                    )}
                    <span>Browse Live Model Catalog</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedProvider.recommendedModels.map((m, mIdx) => {
                    const isCurrent = (modelInputs[selectedProviderId] ?? selectedProvider.model) === m.id;
                    return (
                      <button
                        key={`rec-model-${selectedProviderId}-${m.id}-${mIdx}`}
                        type="button"
                        onClick={() => {
                          setModelInputs(prev => ({ ...prev, [selectedProviderId]: m.id }));
                          handleSaveProvider(selectedProviderId, m.id);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition text-left cursor-pointer flex items-center gap-2 ${
                          isCurrent
                            ? 'bg-stone-900 text-white border-stone-900 font-medium shadow-2xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                        title={m.description}
                      >
                        <span className="font-mono text-[11px]">{m.name}</span>
                        {m.isSweetSpot && (
                          <span className={`text-[10px] px-1 py-0.2 rounded font-medium ${
                            isCurrent ? 'bg-stone-800 text-stone-200' : 'bg-amber-100 text-amber-900'
                          }`}>
                            Sweet Spot
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Model Catalog Explorer */}
            {showLiveModelsFor[selectedProviderId] && (
              <div className="pt-4 border-t border-stone-200 space-y-3 bg-stone-50/60 p-4 rounded-xl border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-900">
                      Live Models: {selectedProvider.name}
                    </span>
                    {liveModelsMap[selectedProviderId]?.source && (
                      <span className="text-[11px] text-stone-500">
                        ({liveModelsMap[selectedProviderId].source === 'live_api' ? 'Live API' : 'Verified Catalog'}
                        {liveModelsMap[selectedProviderId].latencyMs ? ` · ${liveModelsMap[selectedProviderId].latencyMs}ms` : ''})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onChange={e => setModelSearchQuery(e.target.value)}
                        placeholder="Filter models..."
                        className="pl-8 pr-2.5 py-1 text-xs bg-white border border-stone-200 rounded-lg w-44 outline-none focus:border-stone-900"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLiveModelsFor(prev => ({ ...prev, [selectedProviderId]: false }))}
                      className="p-1 text-stone-400 hover:text-stone-700"
                      title="Close live model catalog"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {fetchingProviderModels[selectedProviderId] ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-stone-500 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
                    <span>Querying {selectedProvider.name} model endpoints...</span>
                  </div>
                ) : filteredLiveModels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {filteredLiveModels.map(lm => {
                      const isSelected = (modelInputs[selectedProviderId] ?? selectedProvider.model) === lm.id;
                      return (
                        <div
                          key={`live-m-${selectedProviderId}-${lm.id}`}
                          className={`p-2.5 rounded-lg border text-left flex flex-col justify-between gap-1.5 transition ${
                            isSelected
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-mono font-medium truncate ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                                {lm.id}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {lm.isLatest && (
                                  <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                                    isSelected ? 'bg-stone-800 text-stone-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}>
                                    Latest
                                  </span>
                                )}
                                {lm.isSweetSpot && (
                                  <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                                    isSelected ? 'bg-stone-800 text-stone-200' : 'bg-amber-50 text-amber-900 border border-amber-200'
                                  }`}>
                                    Sweet Spot
                                  </span>
                                )}
                              </div>
                            </div>
                            {lm.description && (
                              <p className={`text-[11px] line-clamp-1 mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                                {lm.description}
                              </p>
                            )}
                          </div>

                          <div className="pt-1 flex items-center justify-end">
                            {isSelected ? (
                              <span className="text-[11px] text-emerald-300 flex items-center gap-1 font-medium">
                                <Check className="w-3 h-3" /> Selected
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setModelInputs(prev => ({ ...prev, [selectedProviderId]: lm.id }));
                                  handleSaveProvider(selectedProviderId, lm.id);
                                }}
                                className="text-[11px] font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded transition cursor-pointer"
                              >
                                Use Model
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 py-3 text-center">
                    No models matched the search query.
                  </p>
                )}
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-stone-100">
              <div className="text-xs text-stone-500">
                {selectedProvider.rateLimitNotice ? (
                  <span><strong>Rate Strategy:</strong> {selectedProvider.rateLimitNotice}</span>
                ) : (
                  <span>Verified for Travel Malawi operations and listing drafting.</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={testingProvider === selectedProviderId || !selectedProvider.isConfigured}
                  onClick={() => handleRunTest(selectedProviderId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition border border-stone-200 disabled:opacity-40 cursor-pointer"
                  title={!selectedProvider.isConfigured ? 'Add an API key first to test connection' : 'Test inference connection'}
                >
                  {testingProvider === selectedProviderId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-stone-700" />
                  )}
                  <span>Test Connection</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Matrix Overview Mode (All Providers Table) */}
        {viewMode === 'matrix' && (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] font-semibold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Key Configuration</th>
                    <th className="py-3 px-4">Active Model</th>
                    <th className="py-3 px-4 text-center">Engine Role</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {Object.entries(config.providers).map(([pid, p]) => {
                    const isActive = config.activeProvider === pid;
                    const isEnabled = p.enabled !== false;

                    return (
                      <tr key={`matrix-row-${pid}`} className="hover:bg-stone-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-900">{p.name}</div>
                          <div className="text-[11px] font-mono text-stone-400">{pid}</div>
                        </td>

                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleProviderEnabled(pid, isEnabled)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                              isEnabled ? 'text-emerald-700 bg-emerald-50' : 'text-stone-500 bg-stone-100'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                            <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          {p.isConfigured ? (
                            <div className="space-y-0.5">
                              <div className="font-mono text-stone-800">{p.maskedKey || 'Configured'}</div>
                              <div className="text-[10px] text-stone-400">
                                {p.source === 'environment' ? 'Environment variable' : 'Manual key'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-400">No key provided</span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-stone-800">
                          {p.model}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-900 text-white">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectActiveProvider(pid)}
                              className="text-stone-600 hover:text-stone-900 text-[11px] font-medium underline cursor-pointer"
                            >
                              Set Active
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right space-x-2">
                          {p.isConfigured && (
                            <button
                              type="button"
                              disabled={testingProvider === pid}
                              onClick={() => handleRunTest(pid)}
                              className="px-2.5 py-1 text-[11px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded transition"
                            >
                              {testingProvider === pid ? 'Testing...' : 'Test'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProviderId(pid);
                              setViewMode('focused');
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 rounded transition"
                          >
                            Configure
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. Test Diagnostic Result Panel */}
      {testResult && (
        <div className={`p-4 rounded-xl border transition-all text-xs ${
          testResult.success
            ? 'bg-stone-50 border-stone-300 text-stone-800'
            : 'bg-red-50/60 border-red-200 text-red-900'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-semibold text-sm">
                  {testResult.success ? 'Connection Successful' : 'Connection Test Failed'}
                </span>
                {testResult.latencyMs !== undefined && (
                  <span className="font-mono text-stone-500 tabular-nums">({testResult.latencyMs}ms)</span>
                )}
              </div>
              <p className="text-stone-500">
                Provider: <strong className="text-stone-800">{config.providers[testResult.provider]?.name || testResult.provider}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-stone-400 hover:text-stone-700 p-1"
              title="Dismiss result"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 pt-2 border-t border-stone-200/60">
            {testResult.success ? (
              <p className="font-serif italic text-stone-700 bg-white p-3 rounded-lg border border-stone-200 leading-relaxed">
                "{testResult.sample}"
              </p>
            ) : (
              <div className="font-mono text-red-700 bg-white p-3 rounded-lg border border-red-200 leading-relaxed">
                {testResult.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Architecture & Compliance Notes */}
      <div className="pt-4 border-t border-stone-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-500">
        <div>
          <h4 className="font-semibold text-stone-800 mb-1">Server-Side Proxy Security</h4>
          <p className="leading-relaxed">
            API keys are saved in local server storage and never exposed to guest or manager browsers. Requests are securely proxied via server routes.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-stone-800 mb-1">Cost-Optimized Defaults</h4>
          <p className="leading-relaxed">
            Default configurations connect to lightweight production models (Gemini 3.8 Flash, GPT-4o Mini, Mistral Small) for low token footprints.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-stone-800 mb-1">Global Kill Switch Guarantee</h4>
          <p className="leading-relaxed">
            Toggling the master switch instantly suppresses all AI endpoints, assistant buttons, and prompt generators platform-wide.
          </p>
        </div>
      </div>
    </div>
  );
}
