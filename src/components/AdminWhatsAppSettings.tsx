import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, RefreshCw, Smartphone, Lock, 
  AlertCircle, Eye, EyeOff, Save, Globe, Phone, X, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WhatsAppConfigState {
  enabled: boolean;
  provider: 'cloud_api' | 'direct';
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  senderPhoneNumber: string;
  defaultCountryCode: string;
  hasToken?: boolean;
  isConfigured?: boolean;
  lastTestedAt?: number;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
}

export default function AdminWhatsAppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('+265');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const [form, setForm] = useState<WhatsAppConfigState>({
    enabled: false,
    provider: 'cloud_api',
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    senderPhoneNumber: '',
    defaultCountryCode: '+265',
    hasToken: false,
    isConfigured: false,
  });

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp-config');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setForm(data.config);
          if (data.config.lastTestStatus) {
            setTestResult({
              success: data.config.lastTestStatus === 'success',
              message: data.config.lastTestMessage || '',
            });
          }
        }
      }
    } catch {
      toast.error('Failed to load WhatsApp configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setForm(data.config);
      toast.success(
        form.enabled
          ? 'WhatsApp configuration saved and enabled'
          : 'WhatsApp configuration saved (currently disabled)'
      );
    } catch (err: any) {
      toast.error(err.message || 'Error saving WhatsApp configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (form.provider === 'cloud_api' && (!form.phoneNumberId || (!form.accessToken && !form.hasToken))) {
      toast.error('Please specify Phone Number ID and Access Token to test Meta Cloud API.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/whatsapp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testPhone: testPhone.trim(),
          config: form,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'WhatsApp connection test failed');
      }

      setTestResult({
        success: true,
        message: data.message || 'WhatsApp connection verified successfully!',
        details: data.details,
      });
      toast.success('WhatsApp connection test passed!');
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed. Check Phone Number ID and Token.',
      });
      toast.error('WhatsApp test failed.');
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (presetName: 'cloud_api' | 'direct' | 'clear') => {
    if (presetName === 'clear') {
      setForm(prev => ({
        ...prev,
        enabled: false,
        provider: 'cloud_api',
        phoneNumberId: '',
        businessAccountId: '',
        accessToken: '',
        senderPhoneNumber: '',
        defaultCountryCode: '+265',
        hasToken: false,
        isConfigured: false,
      }));
      setTestResult(null);
      toast('WhatsApp settings cleared.');
      return;
    }

    if (presetName === 'direct') {
      setForm(prev => ({
        ...prev,
        enabled: true,
        provider: 'direct',
        defaultCountryCode: '+265',
      }));
      toast.success('Applied Direct wa.me preset');
      return;
    }

    if (presetName === 'cloud_api') {
      setForm(prev => ({
        ...prev,
        enabled: true,
        provider: 'cloud_api',
        defaultCountryCode: '+265',
      }));
      toast.success('Selected Meta WhatsApp Cloud API');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-500 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-stone-700" />
        <span className="text-sm">Loading WhatsApp configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">WhatsApp Business &amp; Messaging</h2>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
            Configure automated arrival PINs, 3-day welcome notes, and instant booking reminders.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={fetchConfig}
            className="p-1.5 text-stone-500 hover:text-stone-900 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition"
            title="Reload settings"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. System Status & Master Switch */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${form.enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <h3 className="font-semibold text-stone-900 text-sm">
                {form.enabled ? 'WhatsApp Integration Operational' : 'WhatsApp Integration Disabled'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
              <span>Mode: <strong className="text-stone-800 font-medium">{form.provider === 'cloud_api' ? 'Meta Cloud API' : 'Direct wa.me'}</strong></span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span>{form.isConfigured ? 'Credentials configured' : 'Credentials pending'}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="font-mono text-stone-600">{form.defaultCountryCode} prefix</span>
            </div>
            <p className="text-xs text-stone-500 pt-0.5 max-w-2xl">
              {form.enabled 
                ? 'WhatsApp messaging options, reminder templates, and guest contact buttons are active platform-wide.'
                : 'All WhatsApp buttons, numbers, and reminder templates are suppressed across bookings and property pages.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs ${
                form.enabled
                  ? 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{form.enabled ? 'Disable WhatsApp' : 'Enable WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Configuration & Test Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 md:p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-stone-700" />
              <h3 className="font-serif font-bold text-lg text-stone-900">Credentials &amp; Routing</h3>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-stone-400 font-medium mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('cloud_api')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  form.provider === 'cloud_api'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Meta Cloud API
              </button>
              <button
                type="button"
                onClick={() => applyPreset('direct')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  form.provider === 'direct'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Direct wa.me
              </button>
              <button
                type="button"
                onClick={() => applyPreset('clear')}
                className="px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-red-700 transition"
              >
                Clear
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Mode selection segmented */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700">Messaging Provider Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    form.provider === 'cloud_api' 
                      ? 'border-stone-900 bg-stone-50/80 ring-1 ring-stone-900' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="cloud_api"
                    checked={form.provider === 'cloud_api'}
                    onChange={() => setForm(prev => ({ ...prev, provider: 'cloud_api' }))}
                    className="mt-0.5 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <span className="text-xs font-semibold text-stone-900 block">Meta WhatsApp Cloud API</span>
                    <span className="text-[11px] text-stone-500 leading-tight block mt-0.5">
                      Direct cloud dispatch without personal WhatsApp app. Sends automated scheduled reminders.
                    </span>
                  </div>
                </label>

                <label 
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    form.provider === 'direct' 
                      ? 'border-stone-900 bg-stone-50/80 ring-1 ring-stone-900' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="direct"
                    checked={form.provider === 'direct'}
                    onChange={() => setForm(prev => ({ ...prev, provider: 'direct' }))}
                    className="mt-0.5 text-stone-900 focus:ring-stone-900"
                  />
                  <div>
                    <span className="text-xs font-semibold text-stone-900 block">Direct Click-to-Chat (wa.me)</span>
                    <span className="text-[11px] text-stone-500 leading-tight block mt-0.5">
                      Zero credentials required. Launches WhatsApp Web or app pre-filled with template message.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Cloud API Fields */}
            {form.provider === 'cloud_api' && (
              <div className="space-y-4 pt-2 border-t border-stone-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone Number ID */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Meta Phone Number ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 102938475629182"
                      value={form.phoneNumberId}
                      onChange={e => setForm({ ...form, phoneNumberId: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">
                      Meta Developers &gt; WhatsApp &gt; API Setup &gt; Phone number ID.
                    </p>
                  </div>

                  {/* WhatsApp Business Account ID (WABA) */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      WhatsApp Business Account ID (WABA ID)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 987654321012345"
                      value={form.businessAccountId}
                      onChange={e => setForm({ ...form, businessAccountId: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">
                      Optional Meta WABA identification code.
                    </p>
                  </div>
                </div>

                {/* System User Access Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-stone-700">
                      System User Access Token <span className="text-red-500">*</span>
                    </label>
                    {form.hasToken && (
                      <span className="text-[11px] text-stone-500 flex items-center gap-1 font-mono">
                        <Lock className="w-3 h-3 text-emerald-600" /> Token saved on server
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      placeholder={form.hasToken ? '••••••••••••••••••••••••••••••••' : 'EAAG... (Paste permanent Meta Access Token)'}
                      value={form.accessToken}
                      onChange={e => setForm({ ...form, accessToken: e.target.value })}
                      className="w-full pl-3 pr-9 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    System User token with <code>whatsapp_business_messaging</code> permission.
                  </p>
                </div>
              </div>
            )}

            {/* General phone settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Default Country Calling Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="+265"
                    value={form.defaultCountryCode}
                    onChange={e => setForm({ ...form, defaultCountryCode: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition"
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  Prefix applied to numbers starting with 0 (Malawi is <code>+265</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Sender / Verified WhatsApp Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="+265 999 123 456"
                    value={form.senderPhoneNumber}
                    onChange={e => setForm({ ...form, senderPhoneNumber: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition"
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  Display number shown to guests in reservation vouchers.
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <span className="text-xs text-stone-500">
                {form.isConfigured ? 'Status: Configured' : 'Status: Incomplete'}
              </span>

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Testing & Diagnostic Tool */}
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-900">Connection Diagnostics</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Dispatch an end-to-end verification ping to any WhatsApp mobile number.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700">
                Recipient Test Phone Number
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+265 999 123 456"
                className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition"
              />
            </div>

            <button
              type="button"
              disabled={testing || (form.provider === 'cloud_api' && !form.phoneNumberId)}
              onClick={handleTest}
              className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-semibold transition border border-stone-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Ping</span>
                </>
              )}
            </button>

            {testResult && (
              <div className={`p-3 rounded-lg border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-stone-50 border-stone-300 text-stone-800'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    )}
                    <span>{testResult.success ? 'Verified' : 'Failed'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestResult(null)}
                    className="text-stone-400 hover:text-stone-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="leading-relaxed text-[11px]">{testResult.message}</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-500 space-y-1">
            <h4 className="font-semibold text-stone-800 text-xs">Direct wa.me Fallback</h4>
            <p className="leading-relaxed">
              If Meta Cloud API is unconfigured, property managers can still send WhatsApp reminders via Direct Click-to-Chat with pre-formatted templates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
