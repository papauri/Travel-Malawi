import React, { useState, useEffect, useMemo } from 'react';
import { 
  Power, CheckCircle2, AlertTriangle, Key, ExternalLink, 
  RefreshCw, Play, Loader2, Eye, EyeOff, Check,
  Cpu, Globe, Search, ArrowRight, ShieldCheck,
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
  /** The model calls actually use: "auto" and outdated settings resolve to the cheapest current model. */
  resolvedModel?: string;
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

/** "auto → gemini-3.5-flash-lite" for auto mode, otherwise the model actually in use. */
function describeModel(p?: ProviderView): string {
  if (!p) return '';
  if (p.model === 'auto') return p.resolvedModel ? `auto → ${p.resolvedModel}` : 'auto';
  return p.resolvedModel || p.model;
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
        <span className="text-sm">Loading AI settings...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="tm-panel text-center">
        <p className="tm-muted">Couldn't load the AI settings. Check the server is running, then try again.</p>
        <button
          onClick={fetchConfig}
          className="tm-btn tm-btn-secondary tm-btn-sm mt-3"
        >
          Try again
        </button>
      </div>
    );
  }

  const activeProvider = config.providers[config.activeProvider];
  const selectedProvider = config.providers[selectedProviderId] || activeProvider || Object.values(config.providers)[0];
  const configuredCount = Object.values(config.providers).filter(p => p.isConfigured).length;
  const totalCount = Object.keys(config.providers).length;

  return (
    <div className="space-y-6 max-w-5xl min-w-0">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="tm-h1">AI settings</h2>
          <p className="tm-muted mt-0.5">
            Keys and models for Ulendo, listing writing and document reading.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleFetchAllLiveModels}
            disabled={fetchingAllProviders}
            className="tm-btn tm-btn-secondary tm-btn-sm"
            title="Check every provider for its current models"
          >
            {fetchingAllProviders ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-stone-500" />
            )}
            <span>{fetchingAllProviders ? 'Checking...' : 'Check all models'}</span>
          </button>

          <button
            type="button"
            onClick={fetchConfig}
            className="tm-btn tm-btn-secondary tm-btn-sm px-2"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Global Execution Control & System Status */}
      <div className="tm-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <h3 className="font-semibold text-stone-900 text-sm">
                {config.enabled ? 'AI is on' : 'AI is switched off everywhere'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
              <span>Using <strong className="text-stone-800 font-medium">{activeProvider?.name || config.activeProvider}</strong></span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="font-mono text-stone-600">{describeModel(activeProvider)}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="tabular-nums">{configuredCount} of {totalCount} providers have a key</span>
            </div>
            <p className="text-xs text-stone-500 pt-0.5 max-w-2xl">
              {config.enabled
                ? 'Ulendo, the writing helper and document reading are available.'
                : 'Ulendo, the writing helper and document reading are hidden for everyone.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
            <button
              type="button"
              onClick={handleToggleKillSwitch}
              disabled={saving}
              className={`tm-btn tm-btn-sm ${config.enabled ? 'tm-btn-danger' : 'tm-btn-primary'}`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{config.enabled ? 'Turn AI off' : 'Turn AI on'}</span>
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
                      ? 'bg-stone-900 text-white border-stone-900'
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
              <span>All</span>
            </button>
          </div>
        </div>

        {/* 4. Focused Provider Configuration Pane */}
        {viewMode === 'focused' && selectedProvider && (
          <div className="tm-panel space-y-6 animate-in fade-in duration-150 min-w-0">
            {/* Top Bar for Selected Provider */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="tm-h2">{selectedProvider.name}</h3>
                  <a
                    href={selectedProvider.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-400 hover:text-stone-700 inline-flex items-center gap-1 text-xs"
                    title={`Open ${selectedProvider.name} developer portal`}
                  >
                    <span>Provider website</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
                  <span>Provider ID: <code className="font-mono text-stone-700">{selectedProviderId}</code></span>
                  <span aria-hidden="true" className="text-stone-300">·</span>
                  <span>{selectedProvider.source === 'environment' ? 'Key set on the server' : selectedProvider.isConfigured ? 'Key saved here' : 'No key yet'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Active Provider Button */}
                {config.activeProvider === selectedProviderId ? (
                  <span className="tm-tag tm-tag-good">
                    <Check className="w-3.5 h-3.5" />
                    <span>In use</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectActiveProvider(selectedProviderId)}
                    disabled={saving}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Use this provider</span>
                  </button>
                )}

                {/* Enable/Disable Toggle */}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleProviderEnabled(selectedProviderId, selectedProvider.enabled !== false)}
                  className="tm-btn tm-btn-quiet tm-btn-sm"
                >
                  <Power className="w-3 h-3" />
                  <span>{selectedProvider.enabled !== false ? 'On' : 'Off'}</span>
                </button>
              </div>
            </div>

            {/* Notice if provider is disabled */}
            {selectedProvider.enabled === false && (
              <div className="p-3 bg-stone-50 rounded-lg text-xs text-stone-600 flex flex-wrap items-center justify-between gap-3">
                <span>{selectedProvider.name} is off, so it is never used.</span>
                <button
                  type="button"
                  onClick={() => handleToggleProviderEnabled(selectedProviderId, false)}
                  className="tm-link text-xs shrink-0"
                >
                  Turn on
                </button>
              </div>
            )}

            {/* Credentials & Model Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-stone-700">
                    API key {selectedProvider.maskedKey && <span className="font-mono text-stone-400 font-normal">({selectedProvider.maskedKey})</span>}
                  </label>
                  {selectedProvider.isConfigured && (
                    <span className="text-[11px] text-stone-500">
                      {selectedProvider.source === 'environment' ? 'From the server' : 'Saved here'}
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
                          ? (selectedProvider.source === 'environment' ? 'Set on the server' : 'Paste a new key to replace it')
                          : selectedProviderId === 'gemini'
                          ? 'Starts with AIzaSy...'
                          : 'Starts with sk-...'
                      }
                      className="tm-input pr-9 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(prev => ({ ...prev, [selectedProviderId]: !prev[selectedProviderId] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      tabIndex={-1}
                      aria-label={showKey[selectedProviderId] ? 'Hide key' : 'Show key'}
                    >
                      {showKey[selectedProviderId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {keyInputs[selectedProviderId]?.trim() && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveProvider(selectedProviderId)}
                      className="tm-btn tm-btn-primary tm-btn-sm shrink-0"
                    >
                      Save key
                    </button>
                  )}
                </div>
              </div>

              {/* Model Identifier */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-stone-700">
                    Model <span className="font-normal text-stone-400">(auto picks the cheapest current one)</span>
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
                    className="tm-input font-mono text-xs"
                  />
                  <button
                    type="button"
                    disabled={saving || (modelInputs[selectedProviderId] === undefined || modelInputs[selectedProviderId] === selectedProvider.model)}
                    onClick={() => handleSaveProvider(selectedProviderId)}
                    className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                  >
                    Save model
                  </button>
                </div>
                {selectedProvider.resolvedModel && selectedProvider.resolvedModel !== selectedProvider.model && (
                  <p className="text-[11px] text-stone-500">
                    {selectedProvider.model === 'auto' ? 'Auto is currently using ' : 'Outdated or retired, so calls use '}
                    <span className="font-mono text-stone-700">{selectedProvider.resolvedModel}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Recommended Models */}
            {selectedProvider.recommendedModels && selectedProvider.recommendedModels.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-700">Suggested models</span>
                  <button
                    type="button"
                    onClick={() => handleFetchLiveModelsForProvider(selectedProviderId)}
                    disabled={fetchingProviderModels[selectedProviderId]}
                    className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 transition disabled:opacity-50"
                  >
                    {fetchingProviderModels[selectedProviderId] ? (
                      <Loader2 className="w-3 h-3 animate-spin text-stone-700" />
                    ) : (
                      <Search className="w-3 h-3 text-stone-500" />
                    )}
                    <span>See all models</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModelInputs(prev => ({ ...prev, [selectedProviderId]: 'auto' }));
                      handleSaveProvider(selectedProviderId, 'auto');
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition text-left cursor-pointer flex items-center gap-2 ${
                      (modelInputs[selectedProviderId] ?? selectedProvider.model) === 'auto'
                        ? 'bg-amber-50 text-stone-900 border-amber-700 font-medium'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                    }`}
                    title="Always use the cheapest capable model of the newest generation"
                  >
                    <span className="text-[11px]">Auto</span>
                  </button>
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
                            ? 'bg-amber-50 text-stone-900 border-amber-700 font-medium'
                            : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                        }`}
                        title={m.description}
                      >
                        <span className="text-[11px]">{m.name}</span>
                        {m.isSweetSpot && (
                          <span className="text-[10px] px-1 py-0.2 rounded font-medium bg-amber-100 text-amber-900">
                            Best value
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
              <div className="pt-4 border-t border-stone-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-900">
                      All {selectedProvider.name} models
                    </span>
                    {liveModelsMap[selectedProviderId]?.source && (
                      <span className="text-[11px] text-stone-500">
                        ({liveModelsMap[selectedProviderId].source === 'live_api' ? 'live list' : 'saved list'}
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
                        placeholder="Filter models"
                        aria-label="Filter models"
                        className="tm-input pl-8 py-1 text-xs w-44"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLiveModelsFor(prev => ({ ...prev, [selectedProviderId]: false }))}
                      className="p-1 text-stone-400 hover:text-stone-700"
                      title="Close" aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {fetchingProviderModels[selectedProviderId] ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-stone-500 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
                    <span>Getting {selectedProvider.name} models...</span>
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
                              ? 'bg-amber-50 border-amber-700'
                              : 'bg-white border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-mono font-medium truncate text-stone-900">
                                {lm.id}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {lm.isLatest && (
                                  <span className="text-[10px] px-1 py-0.2 rounded font-medium bg-stone-100 text-stone-700">
                                    Latest
                                  </span>
                                )}
                                {lm.isSweetSpot && (
                                  <span className="text-[10px] px-1 py-0.2 rounded font-medium bg-amber-100 text-amber-900">
                                    Best value
                                  </span>
                                )}
                              </div>
                            </div>
                            {lm.description && (
                              <p className="text-[11px] line-clamp-1 mt-0.5 text-stone-500">
                                {lm.description}
                              </p>
                            )}
                          </div>

                          <div className="pt-1 flex items-center justify-end">
                            {isSelected ? (
                              <span className="text-[11px] text-amber-800 flex items-center gap-1 font-medium">
                                <Check className="w-3 h-3" /> In use
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setModelInputs(prev => ({ ...prev, [selectedProviderId]: lm.id }));
                                  handleSaveProvider(selectedProviderId, lm.id);
                                }}
                                className="tm-btn tm-btn-secondary tm-btn-sm"
                              >
                                Use
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 py-3 text-center">
                    No models match that filter.
                  </p>
                )}
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-stone-100">
              <div className="text-xs text-stone-500">
                {selectedProvider.rateLimitNotice ? (
                  <span>{selectedProvider.rateLimitNotice}</span>
                ) : (
                  <span>Test the key before you rely on it.</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={testingProvider === selectedProviderId || !selectedProvider.isConfigured}
                  onClick={() => handleRunTest(selectedProviderId)}
                  className="tm-btn tm-btn-secondary tm-btn-sm"
                  title={!selectedProvider.isConfigured ? 'Add an API key first' : 'Send a short test request'}
                >
                  {testingProvider === selectedProviderId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-stone-700" />
                  )}
                  <span>Test key</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Matrix Overview Mode (All Providers Table) */}
        {viewMode === 'matrix' && (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 text-xs font-medium border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Key</th>
                    <th className="py-3 px-4">Model</th>
                    <th className="py-3 px-4 text-center">In use</th>
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
                            <span>{isEnabled ? 'On' : 'Off'}</span>
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          {p.isConfigured ? (
                            <div className="space-y-0.5">
                              <div className="font-mono text-stone-800">{p.maskedKey || 'Configured'}</div>
                              <div className="text-[10px] text-stone-400">
                                {p.source === 'environment' ? 'From the server' : 'Saved here'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-400">No key</span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-stone-800">
                          {describeModel(p)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isActive ? (
                            <span className="tm-tag tm-tag-good">
                              <Check className="w-3 h-3" /> In use
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectActiveProvider(pid)}
                              className="tm-link text-[11px]"
                            >
                              Use
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {p.isConfigured && (
                            <button
                              type="button"
                              disabled={testingProvider === pid}
                              onClick={() => handleRunTest(pid)}
                              className="tm-btn tm-btn-quiet tm-btn-sm"
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
                            className="tm-btn tm-btn-secondary tm-btn-sm"
                          >
                            Edit
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
                  {testResult.success ? 'The key works' : 'The test failed'}
                </span>
                {testResult.latencyMs !== undefined && (
                  <span className="text-stone-500 tabular-nums">({testResult.latencyMs} ms)</span>
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
              title="Dismiss" aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 pt-2 border-t border-stone-200/60">
            {testResult.success ? (
              <p className="text-stone-700 leading-relaxed break-words">
                "{testResult.sample}"
              </p>
            ) : (
              <div className="text-red-700 leading-relaxed break-words">
                {testResult.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. How it works (collapsed) */}
      <details className="tm-divider pt-4 text-xs text-stone-600">
        <summary className="cursor-pointer text-sm font-medium text-stone-800">How this works</summary>
        <ul className="mt-2 list-disc pl-5 space-y-1.5 leading-relaxed marker:text-stone-400">
          <li>Keys stay on the server and are never sent to anyone's browser.</li>
          <li>Auto checks each provider's models every 6 hours and uses the cheapest current one. Retired models are skipped.</li>
          <li>Turning AI off hides Ulendo, the writing helper and document reading for everyone straight away.</li>
        </ul>
      </details>
    </div>
  );
}
