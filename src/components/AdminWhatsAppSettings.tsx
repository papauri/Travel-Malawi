import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, XCircle, RefreshCw, Smartphone, Lock, 
  ShieldCheck, AlertCircle, Eye, EyeOff, Sparkles, HelpCircle, Save, ExternalLink,
  Phone, Globe, ToggleLeft, ToggleRight
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
    } catch (err) {
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
          ? 'WhatsApp configuration saved & enabled platform-wide.'
          : 'WhatsApp configuration saved (currently disabled).'
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
      toast('WhatsApp settings cleared to blank.');
      return;
    }

    if (presetName === 'direct') {
      setForm(prev => ({
        ...prev,
        enabled: true,
        provider: 'direct',
        defaultCountryCode: '+265',
      }));
      toast.success('Applied Direct Click-to-Chat preset (wa.me)');
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
      <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white rounded-2xl border border-stone-200 shadow-xs">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
        <p className="text-sm font-medium text-stone-600">Loading WhatsApp configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-stone-900">WhatsApp Business &amp; Messaging Configuration</h2>
              {form.enabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active &amp; Visible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-300">
                  <XCircle className="w-3.5 h-3.5 text-stone-400" /> Disabled (Hidden Across App)
                </span>
              )}
            </div>
            <p className="text-sm text-stone-600 max-w-2xl">
              Configure WhatsApp for automated arrival PINs, 3-day welcome notes, and instant booking reminders.
              Toggle on or off: when disabled, all WhatsApp buttons, templates, and numbers are completely hidden.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchConfig}
            className="self-start md:self-auto px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload Settings
          </button>
        </div>

        {/* Master Enabled / Disabled Switch */}
        <div className={`mt-6 p-4 rounded-xl border transition-all ${
          form.enabled 
            ? 'bg-emerald-50/70 border-emerald-300' 
            : 'bg-stone-50 border-stone-300'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                className="text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
                title={form.enabled ? 'Click to disable WhatsApp' : 'Click to enable WhatsApp'}
              >
                {form.enabled ? (
                  <ToggleRight className="w-10 h-10 text-emerald-700" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-stone-400" />
                )}
              </button>
              <div>
                <p className="text-sm font-bold text-stone-900">
                  {form.enabled ? 'WhatsApp Integration is Enabled' : 'WhatsApp Integration is Disabled'}
                </p>
                <p className="text-xs text-stone-600">
                  {form.enabled 
                    ? 'All WhatsApp messaging options, reminder templates, and guest numbers are fully accessible across bookings and property management.'
                    : 'When disabled, NO WhatsApp buttons, numbers, or templates will show anywhere on the platform (bookings, reminders, or property pages).'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                form.enabled
                  ? 'bg-stone-800 hover:bg-stone-900 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              {form.enabled ? 'Disable WhatsApp' : 'Enable WhatsApp'}
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Form & Test Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-stone-900">WhatsApp Credentials &amp; Routing</h3>
            </div>

            {/* Presets dropdown / buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-stone-400 font-medium mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('cloud_api')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  form.provider === 'cloud_api'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                Meta Cloud API
              </button>
              <button
                type="button"
                onClick={() => applyPreset('direct')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  form.provider === 'direct'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                Direct wa.me (No Keys)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('clear')}
                className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition"
              >
                Clear Blank
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Mode selection radio */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Messaging Provider Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label 
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    form.provider === 'cloud_api' 
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="cloud_api"
                    checked={form.provider === 'cloud_api'}
                    onChange={() => setForm(prev => ({ ...prev, provider: 'cloud_api' }))}
                    className="mt-1 text-emerald-700 focus:ring-emerald-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Meta WhatsApp Cloud API</span>
                    <span className="text-[11px] text-stone-500 leading-tight block mt-0.5">
                      Direct cloud dispatch without opening personal WhatsApp app. Sends automated scheduled reminders.
                    </span>
                  </div>
                </label>

                <label 
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    form.provider === 'direct' 
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="direct"
                    checked={form.provider === 'direct'}
                    onChange={() => setForm(prev => ({ ...prev, provider: 'direct' }))}
                    className="mt-1 text-emerald-700 focus:ring-emerald-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Direct Click-to-Chat (wa.me)</span>
                    <span className="text-[11px] text-stone-500 leading-tight block mt-0.5">
                      Zero credentials required. Launches WhatsApp Web or phone app pre-filled with the exact template message.
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
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Meta Phone Number ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 102938475629182"
                      value={form.phoneNumberId}
                      onChange={e => setForm({ ...form, phoneNumberId: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Found in Meta Developers &gt; WhatsApp &gt; API Setup &gt; Phone number ID.
                    </p>
                  </div>

                  {/* WhatsApp Business Account ID (WABA) */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      WhatsApp Business Account ID (WABA ID)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 987654321012345"
                      value={form.businessAccountId}
                      onChange={e => setForm({ ...form, businessAccountId: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Optional Meta WABA identification code.
                    </p>
                  </div>
                </div>

                {/* System User Access Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">
                      System User Access Token (Permanent / API Key) <span className="text-red-500">*</span>
                    </label>
                    {form.hasToken && (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Token securely stored on server
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      placeholder={form.hasToken ? '••••••••••••••••••••••••••••••••' : 'EAAG... (Paste permanent Meta Access Token)'}
                      value={form.accessToken}
                      onChange={e => setForm({ ...form, accessToken: e.target.value })}
                      className="w-full pl-3.5 pr-10 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                      title={showToken ? 'Hide token' : 'Show token'}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Generated under Meta Business Manager &gt; System Users &gt; Tokens with <code>whatsapp_business_messaging</code> permission.
                  </p>
                </div>
              </div>
            )}

            {/* General phone settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
              {/* Default Country Calling Code */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Default Country Calling Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="+265"
                    value={form.defaultCountryCode}
                    onChange={e => setForm({ ...form, defaultCountryCode: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Prefix applied to local guest numbers starting with 0 (e.g. Malawi is <code>+265</code>).
                </p>
              </div>

              {/* Sender / Business Display Number */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Sender / Verified WhatsApp Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="+265 999 123 456"
                    value={form.senderPhoneNumber}
                    onChange={e => setForm({ ...form, senderPhoneNumber: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Display number shown to guests and in reservation receipts.
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
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving Settings...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save WhatsApp Settings
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Testing & Diagnostic Tool */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-stone-900 text-sm">Test WhatsApp Connection</h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Verify your WhatsApp configuration by sending a verification ping or generating a test message link.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Test Recipient Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+265 991 234 567"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Include country code (e.g. <code>+265</code> or local <code>099...</code>).
                </p>
              </div>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="w-full py-2.5 bg-stone-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Verifying Connection...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Test WhatsApp Connection
                  </>
                )}
              </button>
            </div>

            {/* Test result display */}
            {testResult && (
              <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{testResult.success ? 'WhatsApp Verified' : 'Test Failed'}</span>
                </div>
                <p className="text-[11px] leading-relaxed break-words">{testResult.message}</p>
                {testResult.details?.directLink && (
                  <a
                    href={testResult.details.directLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline mt-1"
                  >
                    Open Generated Test Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick Guide Card */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-950 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>How Managers Use This</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-emerald-850 list-disc list-inside">
              <li>Managers can view and update each guest&apos;s WhatsApp number right from their booking card.</li>
              <li>Ready-to-go templates (3-Day arrival, 24h PIN, Payment &amp; Deposit, Check-out) can be sent via WhatsApp with 1 click.</li>
              <li>If Cloud API is configured, reminders send in the background. If Direct mode is selected, it opens in WhatsApp Web/App ready to send.</li>
              <li>Toggle off &quot;Enable WhatsApp&quot; at any time to instantly hide all WhatsApp features.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
