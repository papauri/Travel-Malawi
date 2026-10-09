import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, CheckCircle2, RefreshCw, Server, Lock, 
  AlertCircle, Eye, EyeOff, Save, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface EmailConfigState {
  smtpHost: string;
  smtpPort: string | number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  hasPassword?: boolean;
  isConfigured?: boolean;
  lastTestedAt?: number;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
}

export default function AdminEmailSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState(user?.email || '');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [form, setForm] = useState<EmailConfigState>({
    smtpHost: '',
    smtpPort: '',
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    hasPassword: false,
    isConfigured: false,
  });

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-config');
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
      toast.error('Failed to load SMTP settings');
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
      const res = await fetch('/api/admin/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      toast.success('SMTP configuration saved successfully');
      setForm(data.config);
    } catch (err: any) {
      toast.error(err.message || 'Error saving SMTP configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!form.smtpHost || !form.smtpUser) {
      toast.error('Please enter at least an SMTP Host and Username before testing.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail: testRecipient.trim(),
          recipient: testRecipient.trim(),
          config: form,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'SMTP test failed');
      }

      setTestResult({
        success: true,
        message: data.message || `Test connection verified. Sample email sent to ${testRecipient}.`,
      });
      toast.success('SMTP verified successfully!');
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to authenticate with SMTP server. Check host, port, and password.',
      });
      toast.error('SMTP test failed');
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (preset: 'gmail' | 'sendgrid' | 'mailgun' | 'office365' | 'clear') => {
    if (preset === 'clear') {
      setForm({
        smtpHost: '',
        smtpPort: '',
        smtpSecure: false,
        smtpUser: '',
        smtpPass: '',
        fromName: '',
        fromEmail: '',
        replyTo: '',
        hasPassword: false,
        isConfigured: false,
      });
      setTestResult(null);
      toast('Cleared SMTP settings.');
      return;
    }

    if (preset === 'gmail') {
      setForm(prev => ({
        ...prev,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        fromName: prev.fromName || 'Travel Malawi',
      }));
      toast.success('Applied Gmail / Google Workspace preset');
    } else if (preset === 'sendgrid') {
      setForm(prev => ({
        ...prev,
        smtpHost: 'smtp.sendgrid.net',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: prev.smtpUser || 'apikey',
        fromName: prev.fromName || 'Travel Malawi',
      }));
      toast.success('Applied SendGrid preset');
    } else if (preset === 'mailgun') {
      setForm(prev => ({
        ...prev,
        smtpHost: 'smtp.mailgun.org',
        smtpPort: 587,
        smtpSecure: false,
        fromName: prev.fromName || 'Travel Malawi',
      }));
      toast.success('Applied Mailgun preset');
    } else if (preset === 'office365') {
      setForm(prev => ({
        ...prev,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
        fromName: prev.fromName || 'Travel Malawi',
      }));
      toast.success('Applied Microsoft 365 preset');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-500 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-stone-700" />
        <span className="text-sm">Loading email configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Email &amp; SMTP Settings</h2>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
            Configure outgoing SMTP parameters to dispatch booking confirmations, 24h arrival PINs, and reminders.
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

      {/* 2. System Status Card */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${form.isConfigured ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <h3 className="font-semibold text-stone-900 text-sm">
                {form.isConfigured ? 'SMTP Mailer Operational' : 'SMTP Server Not Configured'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
              <span>Host: <strong className="text-stone-800 font-mono font-normal">{form.smtpHost || 'None'}</strong></span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="font-mono">Port {form.smtpPort || '587'}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span>{form.fromEmail || 'Default sender address'}</span>
            </div>
            <p className="text-xs text-stone-500 pt-0.5 max-w-2xl">
              Handles all transactional notifications, host arrival PIN templates, and manager reminders securely through Node nodemailer proxy.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving...' : 'Save Config'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Form & Test Diagnostic Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main SMTP Form (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 md:p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-stone-700" />
              <h3 className="font-serif font-bold text-lg text-stone-900">Server Credentials</h3>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-stone-400 font-medium mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('gmail')}
                className="px-2.5 py-1 text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg transition"
              >
                Gmail
              </button>
              <button
                type="button"
                onClick={() => applyPreset('sendgrid')}
                className="px-2.5 py-1 text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg transition"
              >
                SendGrid
              </button>
              <button
                type="button"
                onClick={() => applyPreset('mailgun')}
                className="px-2.5 py-1 text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg transition"
              >
                Mailgun
              </button>
              <button
                type="button"
                onClick={() => applyPreset('office365')}
                className="px-2.5 py-1 text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg transition"
              >
                Microsoft 365
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  SMTP Host Server
                </label>
                <input
                  type="text"
                  value={form.smtpHost}
                  onChange={e => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="e.g. smtp.gmail.com"
                  className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-xs font-mono focus:bg-white focus:border-stone-900 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Port
                </label>
                <input
                  type="text"
                  value={form.smtpPort}
                  onChange={e => setForm({ ...form, smtpPort: e.target.value })}
                  placeholder="587 or 465"
                  className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-xs font-mono focus:bg-white focus:border-stone-900 outline-none transition"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 bg-stone-50 rounded-lg border border-stone-200">
              <input
                type="checkbox"
                id="smtpSecure"
                checked={form.smtpSecure}
                onChange={e => setForm({ ...form, smtpSecure: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
              />
              <label htmlFor="smtpSecure" className="text-xs text-stone-600 font-medium cursor-pointer">
                Force SSL/TLS Encryption (Check for Port 465; leave unchecked for STARTTLS on Port 587)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  SMTP Username / Auth Email
                </label>
                <input
                  type="text"
                  value={form.smtpUser}
                  onChange={e => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder="e.g. info@travelmalawi.com"
                  className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-xs font-mono focus:bg-white focus:border-stone-900 outline-none transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">
                    SMTP Password / App Key
                  </label>
                  {form.hasPassword && (
                    <span className="text-[10px] text-stone-500 font-mono">
                      Password saved
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.smtpPass}
                    onChange={e => setForm({ ...form, smtpPass: e.target.value })}
                    placeholder={form.hasPassword ? '•••••••• (leave blank to keep current)' : 'Enter password or app key'}
                    className="w-full bg-stone-50 border border-stone-200 px-3 pr-9 py-2 rounded-lg text-xs font-mono focus:bg-white focus:border-stone-900 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2 block">
                Sender Presentation &amp; Return Address
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={form.fromName}
                    onChange={e => setForm({ ...form, fromName: e.target.value })}
                    placeholder="e.g. Travel Malawi"
                    className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-xs focus:bg-white focus:border-stone-900 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Sender Email
                  </label>
                  <input
                    type="email"
                    value={form.fromEmail}
                    onChange={e => setForm({ ...form, fromEmail: e.target.value })}
                    placeholder="e.g. reservations@travelmalawi.com"
                    className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-xs focus:bg-white focus:border-stone-900 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Reply-To (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.replyTo || ''}
                    onChange={e => setForm({ ...form, replyTo: e.target.value })}
                    placeholder="e.g. concierge@travelmalawi.com"
                    className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-xs focus:bg-white focus:border-stone-900 outline-none transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Test Connection Panel (1 col) */}
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-900">Test SMTP Connection</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Verify authentication with your SMTP server and send a test dispatch.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700">
                Send Test Email To:
              </label>
              <input
                type="email"
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-xs font-mono focus:bg-white focus:border-stone-900 outline-none transition"
              />
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !form.smtpHost}
              className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-semibold transition border border-stone-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-stone-700" />
                  <span>Send Test Email</span>
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
                    <span>{testResult.success ? 'Connected' : 'Connection Failed'}</span>
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
            <h4 className="font-semibold text-stone-800 text-xs">Security Note</h4>
            <p className="leading-relaxed">
              SMTP secrets are stored in local server storage and handled exclusively in backend Node routes. No credentials leak into client bundles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
