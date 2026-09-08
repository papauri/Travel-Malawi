import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, CheckCircle2, XCircle, RefreshCw, Server, Lock, 
  ShieldCheck, AlertCircle, Eye, EyeOff, Sparkles, HelpCircle, Save 
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
  const [testRecipient, setTestRecipient] = useState(user?.email || 'johnpaulchirwa@gmail.com');
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
    } catch (e) {
      console.error('Failed to load email config:', e);
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
          testEmail: testRecipient,
          config: form,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect to SMTP server');
      }

      setTestResult({
        success: true,
        message: data.message || 'SMTP server connection verified successfully.',
      });
      toast.success('SMTP connection verified successfully!');
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'SMTP Connection Error',
      });
      toast.error(err.message || 'SMTP test failed');
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (preset: 'gmail' | 'sendgrid' | 'mailgun' | 'office365' | 'clear') => {
    if (preset === 'clear') {
      setForm({
        ...form,
        smtpHost: '',
        smtpPort: '',
        smtpSecure: false,
        smtpUser: '',
        smtpPass: '',
        fromName: '',
        fromEmail: '',
        replyTo: '',
      });
      toast.success('Fields cleared for manual input');
      return;
    }

    if (preset === 'gmail') {
      setForm({
        ...form,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        fromName: form.fromName || 'Travel Malawi',
      });
      toast.success('Applied Gmail / Google Workspace preset');
    } else if (preset === 'sendgrid') {
      setForm({
        ...form,
        smtpHost: 'smtp.sendgrid.net',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: form.smtpUser || 'apikey',
        fromName: form.fromName || 'Travel Malawi',
      });
      toast.success('Applied SendGrid preset');
    } else if (preset === 'mailgun') {
      setForm({
        ...form,
        smtpHost: 'smtp.mailgun.org',
        smtpPort: 587,
        smtpSecure: false,
        fromName: form.fromName || 'Travel Malawi',
      });
      toast.success('Applied Mailgun preset');
    } else if (preset === 'office365') {
      setForm({
        ...form,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
        fromName: form.fromName || 'Travel Malawi',
      });
      toast.success('Applied Microsoft 365 preset');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-stone-900 text-white rounded-xl shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-serif font-bold text-stone-900">Email &amp; SMTP Settings</h2>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  form.isConfigured 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {form.isConfigured ? 'Configured' : 'Configs Blank / Pending'}
                </span>
              </div>
              <p className="text-stone-500 text-xs sm:text-sm mt-1 max-w-2xl">
                Configure outgoing SMTP parameters to enable transactional emails, manager reminder templates (3-Day Arrival, 24h Check-in PIN, Deposit details, Check-out logistics), and real-time guest notifications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-xs"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="mt-6 pt-6 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-stone-500 mr-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick Provider Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('gmail')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition"
            >
              Google Workspace / Gmail
            </button>
            <button
              type="button"
              onClick={() => applyPreset('sendgrid')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition"
            >
              SendGrid
            </button>
            <button
              type="button"
              onClick={() => applyPreset('mailgun')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition"
            >
              Mailgun
            </button>
            <button
              type="button"
              onClick={() => applyPreset('office365')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition"
            >
              Microsoft 365
            </button>
            <button
              type="button"
              onClick={() => applyPreset('clear')}
              className="px-3 py-1.5 border border-stone-200 hover:bg-stone-50 text-stone-500 rounded-lg text-xs font-medium transition ml-auto"
            >
              Clear to Blank
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main SMTP Form (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-xs space-y-6">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-stone-700" />
            SMTP Server Credentials
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  SMTP Host Server
                </label>
                <input
                  type="text"
                  value={form.smtpHost}
                  onChange={e => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="e.g. smtp.gmail.com or mail.yourdomain.com"
                  className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm font-mono focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Port
                </label>
                <input
                  type="text"
                  value={form.smtpPort}
                  onChange={e => setForm({ ...form, smtpPort: e.target.value })}
                  placeholder="587, 465, or 2525"
                  className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm font-mono focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <input
                type="checkbox"
                id="smtpSecure"
                checked={form.smtpSecure}
                onChange={e => setForm({ ...form, smtpSecure: e.target.checked })}
                className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900"
              />
              <label htmlFor="smtpSecure" className="text-xs text-stone-700 font-medium cursor-pointer">
                <strong>Force SSL/TLS Encryption</strong> (Check this if using Port 465. Leave unchecked for STARTTLS on Port 587/2525)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  SMTP Username / Auth Email
                </label>
                <input
                  type="text"
                  value={form.smtpUser}
                  onChange={e => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder="e.g. johnpaulchirwa@gmail.com or apikey"
                  className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm font-mono focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700">
                    SMTP Password / App Key
                  </label>
                  {form.hasPassword && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Password Saved
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.smtpPass}
                    onChange={e => setForm({ ...form, smtpPass: e.target.value })}
                    placeholder={form.hasPassword ? '•••••••• (leave blank to keep current)' : 'Enter SMTP password / app password'}
                    className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm font-mono focus:outline-none focus:border-stone-900 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                Sender Presentation &amp; Return Address
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={form.fromName}
                    onChange={e => setForm({ ...form, fromName: e.target.value })}
                    placeholder="e.g. Travel Malawi"
                    className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Sender Email
                  </label>
                  <input
                    type="email"
                    value={form.fromEmail}
                    onChange={e => setForm({ ...form, fromEmail: e.target.value })}
                    placeholder="e.g. noreply@travelmalawi.com"
                    className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Reply-To (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.replyTo || ''}
                    onChange={e => setForm({ ...form, replyTo: e.target.value })}
                    placeholder="e.g. support@travelmalawi.com"
                    className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save SMTP Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Test Connection Panel (1 col) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              Test SMTP Connection
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Verify that the server can authenticate with your SMTP provider and optionally send an operational test email.
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Send Test Email To:
              </label>
              <input
                type="email"
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                placeholder="your-email@example.com"
                className="w-full bg-stone-50 border border-stone-200 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-stone-900"
              />
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !form.smtpHost}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Testing &amp; Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Test &amp; Verify Connection
                </>
              )}
            </button>

            {/* Test result display */}
            {testResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-1.5 animate-enter ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{testResult.success ? 'Verification Succeeded' : 'Verification Failed'}</span>
                </div>
                <p className="leading-relaxed font-mono text-[11px] break-words">
                  {testResult.message}
                </p>
              </div>
            )}
          </div>

          {/* Helpful Tips Card */}
          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5 uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
              Google Workspace / Gmail Notice
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              If using a Gmail or Google Workspace address with 2-Step Verification enabled, generate an <strong>App Password</strong> in your Google Account:
            </p>
            <ol className="text-xs text-stone-600 space-y-1.5 pl-4 list-decimal leading-relaxed">
              <li>Visit <em>Google Account &gt; Security</em></li>
              <li>Under 2-Step Verification, select <em>App Passwords</em></li>
              <li>Create one named <code>Travel Malawi</code></li>
              <li>Paste the 16-character key into the SMTP Password field</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
