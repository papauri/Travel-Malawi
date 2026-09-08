import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  CheckCircle, 
  Clock, 
  Zap, 
  Send, 
  Eye, 
  Edit3, 
  RotateCcw, 
  Trash2, 
  Check, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Info,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, HotelEmailAutomationSettings, AutomationRuleConfig } from '../types';
import { 
  READY_REMINDER_TEMPLATES, 
  ReminderTemplate, 
  fillTemplate, 
  formatReminderEmailHtml, 
  ReminderVariables 
} from '../lib/reminderTemplates';
import { useWhatsAppSettings } from '../hooks/useWhatsAppSettings';

interface ManagerEmailTemplatesHubProps {
  hotel: Hotel;
  onHotelUpdate?: (updatedHotel: Hotel) => void;
  currentUserEmail?: string | null;
}

interface ScheduledReminderItem {
  id: string;
  bookingId: string;
  bookingRef: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestWhatsapp?: string;
  templateId?: string;
  type: string;
  channel: string;
  subject?: string;
  message: string;
  scheduledFor: string;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}

interface SchedulerStatus {
  daemonActive: boolean;
  intervalSeconds: number;
  serverTime: string;
  pendingCount: number;
  message: string;
}

export default function ManagerEmailTemplatesHub({
  hotel,
  onHotelUpdate,
  currentUserEmail
}: ManagerEmailTemplatesHubProps) {
  const { whatsappEnabled } = useWhatsAppSettings();

  // Local copy of hotel email automation settings
  const [settings, setSettings] = useState<HotelEmailAutomationSettings>(() => {
    const existing = hotel.emailAutomationSettings;
    return {
      autoRemindersEnabled: existing?.autoRemindersEnabled ?? true,
      rules: existing?.rules ?? {},
      customSignature: existing?.customSignature ?? '',
      bccManager: existing?.bccManager ?? false,
    };
  });

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Active sub-view: 'templates' | 'queue'
  const [activeView, setActiveView] = useState<'templates' | 'queue'>('templates');

  // Expanded template for editing / previewing
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>('pre_arrival_3d');

  // Preview mode toggle per expanded template: 'editor' | 'preview'
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('preview');

  // Test send state
  const [testEmailAddress, setTestEmailAddress] = useState(currentUserEmail || hotel.contactEmail || hotel.managerEmail || '');
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  // Scheduled reminders & scheduler status
  const [reminders, setReminders] = useState<ScheduledReminderItem[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);

  // Sample data for realistic preview
  const sampleVars: ReminderVariables = {
    guestName: 'Kondwani Banda',
    guestEmail: 'kondwani.banda@example.mw',
    guestPhone: '+265 999 444 888',
    hotelName: hotel.name || 'Your Property',
    hotelLocation: hotel.location || 'Lake Malawi, Mangochi',
    roomName: 'Deluxe Lake View Chalet',
    checkIn: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
    bookingRef: 'MW-8492',
    arrivalPin: '4829',
    totalPrice: '240,000 MWK',
    depositAmount: '120,000 MWK (50%)',
    depositInstructions: hotel.depositInfo?.airtelMoneyNumber
      ? `Airtel Money: ${hotel.depositInfo.airtelMoneyNumber} (${hotel.depositInfo.airtelMoneyName || hotel.name})`
      : 'Bank transfer or Mobile Money. Please reference booking #MW-8492.',
    wifiName: hotel.infrastructure?.wifiSSID || `${hotel.name} Guest WiFi`,
    wifiPassword: hotel.infrastructure?.wifiPassword || 'MalawiSun2026',
    managerPhone: hotel.contactPhone || hotel.managerPhone || '+265 999 123 456',
    managerEmail: hotel.contactEmail || hotel.managerEmail || 'reservations@travelmalawi.com',
  };

  // Fetch scheduler status
  useEffect(() => {
    fetch('/api/reminders/scheduler-status')
      .then(r => r.json())
      .then(data => setSchedulerStatus(data))
      .catch(() => {});
  }, []);

  // Fetch reminders for this hotel
  const fetchHotelReminders = async () => {
    if (!hotel.id) return;
    setLoadingReminders(true);
    try {
      const res = await fetch(`/api/reminders/hotel/${hotel.id}`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingReminders(false);
    }
  };

  useEffect(() => {
    if (activeView === 'queue' && hotel.id) {
      fetchHotelReminders();
    }
  }, [activeView, hotel.id]);

  // Handle setting updates
  const handleToggleMaster = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, autoRemindersEnabled: enabled }));
    setHasChanges(true);
  };

  const handleUpdateRule = (templateId: string, patch: Partial<AutomationRuleConfig>) => {
    setSettings(prev => {
      const currentRule = prev.rules?.[templateId] || {
        enabled: true,
        channel: 'email',
        timingDays: 3,
        timingHours: 24,
      };
      return {
        ...prev,
        rules: {
          ...prev.rules,
          [templateId]: {
            ...currentRule,
            ...patch,
          },
        },
      };
    });
    setHasChanges(true);
  };

  const handleResetTemplate = (templateId: string) => {
    setSettings(prev => {
      const updatedRules = { ...(prev.rules || {}) };
      if (updatedRules[templateId]) {
        delete updatedRules[templateId].subjectOverride;
        delete updatedRules[templateId].bodyOverride;
      }
      return { ...prev, rules: updatedRules };
    });
    setHasChanges(true);
    toast.success('Reset template to standard platform copy.');
  };

  // Save changes to Firestore
  const handleSaveSettings = async () => {
    if (!hotel.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'hotels', hotel.id), {
        emailAutomationSettings: settings,
      });
      setHasChanges(false);
      if (onHotelUpdate) {
        onHotelUpdate({
          ...hotel,
          emailAutomationSettings: settings,
        });
      }
      toast.success('Email automation settings saved successfully!');
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings: ' + (err?.message || 'Check database permissions.'));
    } finally {
      setSaving(false);
    }
  };

  // Dispatch real test email to manager
  const handleSendTestEmail = async (tmpl: ReminderTemplate) => {
    if (!testEmailAddress.trim() || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }

    setSendingTest(tmpl.id);
    const rule = settings.rules?.[tmpl.id];
    const rawSubject = rule?.subjectOverride || tmpl.defaultSubject;
    const rawBody = rule?.bodyOverride || tmpl.defaultBody;

    const finalSubject = fillTemplate(rawSubject, sampleVars);
    let finalBody = fillTemplate(rawBody, sampleVars);
    if (settings.customSignature) {
      finalBody += `\n\n---\n${settings.customSignature}`;
    }

    try {
      const res = await fetch('/api/reminders/test-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmailAddress.trim(),
          hotelName: hotel.name,
          bookingRef: sampleVars.bookingRef,
          templateTitle: tmpl.title,
          subject: finalSubject,
          message: finalBody,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Test preview sent to ${testEmailAddress.trim()}! Check your inbox.`);
      } else {
        toast.error(data.error || 'Failed to send test email. Ensure SMTP is configured.');
      }
    } catch (err: any) {
      toast.error('Failed to send test email: ' + (err?.message || 'Server error.'));
    } finally {
      setSendingTest(null);
    }
  };

  // Delete a scheduled reminder
  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id));
        toast.success('Scheduled reminder removed.');
      } else {
        toast.error('Could not remove reminder.');
      }
    } catch {
      toast.error('Failed to delete reminder.');
    }
  };

  // Insert variable into active editor
  const insertVariable = (templateId: string, varName: string) => {
    const tmpl = READY_REMINDER_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    const currentBody = settings.rules?.[templateId]?.bodyOverride !== undefined 
      ? settings.rules[templateId].bodyOverride!
      : tmpl.defaultBody;

    handleUpdateRule(templateId, {
      bodyOverride: currentBody + ` {${varName}}`,
    });
  };

  const pendingCount = reminders.filter(r => !r.sent).length;
  const sentCount = reminders.filter(r => r.sent).length;

  return (
    <div className="space-y-6" id="manager-email-hub">
      {/* 1. Server Cron & Daemon Assurance Card */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-stone-900 tracking-tight">
                  Automated Guest Email Engine
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-300/60">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Auto-Daemon Running (Every 60s)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                  <ShieldCheck className="w-3 h-3 text-stone-500" />
                  Zero Server Cron Required
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-3xl leading-relaxed">
                Automated guest reminders run continuously on the platform&apos;s internal background engine. 
                <strong className="text-stone-900 font-semibold"> You do not need to configure any external cron jobs, Linux crontabs, or background scripts</strong>. 
                When automation is enabled, your pre-arrival passes, check-in PINs, and post-stay reviews dispatch automatically to guests when their reservations become due.
              </p>
            </div>
          </div>

          {/* Master Toggle */}
          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200/80 p-3 rounded-xl shrink-0 self-start lg:self-center">
            <div className="text-right">
              <div className="text-xs font-bold text-stone-900">
                {settings.autoRemindersEnabled ? 'Automation Active' : 'Automation Paused'}
              </div>
              <div className="text-[11px] text-stone-500">
                {settings.autoRemindersEnabled ? 'Scheduled emails will send' : 'No emails sent automatically'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleMaster(!settings.autoRemindersEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.autoRemindersEnabled ? 'bg-emerald-600' : 'bg-stone-300'
              }`}
              role="switch"
              aria-checked={settings.autoRemindersEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.autoRemindersEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Global Signature & Options */}
        <div className="mt-5 pt-4 border-t border-stone-200/70 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
              Custom Property Email Signature
            </label>
            <input
              type="text"
              value={settings.customSignature || ''}
              onChange={e => {
                setSettings(prev => ({ ...prev, customSignature: e.target.value }));
                setHasChanges(true);
              }}
              placeholder={`Warm regards,\nThe Reservations & Host Team at ${hotel.name || 'Our Property'}`}
              className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-stone-900 focus:outline-hidden focus:border-stone-900"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Appended to the bottom of all automated emails sent from this property.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
              Test Preview Recipient Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailAddress}
                onChange={e => setTestEmailAddress(e.target.value)}
                placeholder="manager@example.com"
                className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-stone-900 focus:outline-hidden focus:border-stone-900"
              />
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Where preview test emails will be delivered when you click &quot;Send Test Preview&quot; below.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Sub Navigation Tabs: Templates vs Live Queue */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveView('templates')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeView === 'templates'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Templates &amp; Automation Rules</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-700 text-white">
              {READY_REMINDER_TEMPLATES.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('queue')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeView === 'queue'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled Queue &amp; History</span>
            {pendingCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-mono">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {hasChanges && (
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        )}
      </div>

      {/* 3. VIEW A: ALL EMAIL TEMPLATES & AUTOMATION RULES */}
      {activeView === 'templates' && (
        <div className="space-y-4">
          <div className="text-xs text-stone-500 flex items-center justify-between">
            <span>Configure which emails trigger automatically for your guests and customize your wording:</span>
            <span>Click any card to expand editor &amp; HTML preview</span>
          </div>

          <div className="space-y-3">
            {READY_REMINDER_TEMPLATES.map(tmpl => {
              const rule = settings.rules?.[tmpl.id] || {
                enabled: tmpl.id !== 'custom',
                channel: 'email',
                timingDays: 3,
                timingHours: 24,
              };

              const isExpanded = expandedTemplateId === tmpl.id;
              const isEnabled = rule.enabled;

              const activeSubject = rule.subjectOverride || tmpl.defaultSubject;
              const activeBody = rule.bodyOverride || tmpl.defaultBody;

              const filledSubject = fillTemplate(activeSubject, sampleVars);
              let filledBody = fillTemplate(activeBody, sampleVars);
              if (settings.customSignature) {
                filledBody += `\n\n---\n${settings.customSignature}`;
              }

              const renderedHtml = formatReminderEmailHtml(
                filledSubject,
                filledBody,
                hotel.name || 'Your Property',
                sampleVars.bookingRef
              );

              return (
                <div
                  key={tmpl.id}
                  className={`bg-white rounded-2xl border transition-all ${
                    isExpanded 
                      ? 'border-stone-400 shadow-sm ring-1 ring-stone-300/60' 
                      : 'border-stone-200 hover:border-stone-300 shadow-2xs'
                  }`}
                >
                  {/* Template Card Summary Header */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div 
                      className="flex items-start gap-3 flex-1 cursor-pointer"
                      onClick={() => setExpandedTemplateId(isExpanded ? null : tmpl.id)}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isEnabled ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'
                      }`}>
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-stone-900">{tmpl.title}</h4>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                            {tmpl.badge}
                          </span>
                          {rule.subjectOverride && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                              Customized
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">
                          Subject: {activeSubject}
                        </p>
                      </div>
                    </div>

                    {/* Automation Trigger & Toggle Controls */}
                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      {/* Timing Rule Pill / Select */}
                      {tmpl.id === 'pre_arrival_3d' && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <select
                            value={rule.timingDays ?? 3}
                            onChange={e => handleUpdateRule(tmpl.id, { timingDays: parseInt(e.target.value) })}
                            className="bg-transparent font-medium text-stone-900 text-xs focus:outline-hidden"
                          >
                            <option value={1}>1 day before check-in</option>
                            <option value={2}>2 days before check-in</option>
                            <option value={3}>3 days before check-in</option>
                            <option value={5}>5 days before check-in</option>
                            <option value={7}>7 days before check-in</option>
                          </select>
                        </div>
                      )}

                      {tmpl.id === 'arrival_24h_pin' && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <select
                            value={rule.timingHours ?? 24}
                            onChange={e => handleUpdateRule(tmpl.id, { timingHours: parseInt(e.target.value) })}
                            className="bg-transparent font-medium text-stone-900 text-xs focus:outline-hidden"
                          >
                            <option value={12}>12 hours before check-in</option>
                            <option value={24}>24 hours before check-in</option>
                            <option value={48}>48 hours before check-in</option>
                          </select>
                        </div>
                      )}

                      {tmpl.id === 'deposit_payment' && (
                        <span className="text-[11px] text-stone-500 font-medium bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg">
                          Upon booking confirmation
                        </span>
                      )}

                      {tmpl.id === 'post_stay_review' && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <select
                            value={rule.timingDays ?? 1}
                            onChange={e => handleUpdateRule(tmpl.id, { timingDays: parseInt(e.target.value) })}
                            className="bg-transparent font-medium text-stone-900 text-xs focus:outline-hidden"
                          >
                            <option value={1}>1 day after check-out</option>
                            <option value={2}>2 days after check-out</option>
                            <option value={3}>3 days after check-out</option>
                          </select>
                        </div>
                      )}

                      {/* Automation Switch */}
                      <button
                        type="button"
                        onClick={() => handleUpdateRule(tmpl.id, { enabled: !isEnabled })}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          isEnabled
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                        }`}
                        title="Toggle automated sending for this template"
                      >
                        {isEnabled ? '● Auto: Enabled' : '○ Auto: Off'}
                      </button>

                      {/* Expand / Collapse */}
                      <button
                        type="button"
                        onClick={() => setExpandedTemplateId(isExpanded ? null : tmpl.id)}
                        className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                        title={isExpanded ? 'Collapse' : 'Expand editor & preview'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Editor & Live Preview Panel */}
                  {isExpanded && (
                    <div className="border-t border-stone-200 bg-stone-50/60 p-4 sm:p-6 rounded-b-2xl">
                      {/* Mode switch: Editor vs HTML Preview */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-1.5 bg-stone-200/80 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setPreviewTab('preview')}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                              previewTab === 'preview'
                                ? 'bg-white text-stone-900 shadow-2xs'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Rendered Email Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewTab('editor')}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                              previewTab === 'editor'
                                ? 'bg-white text-stone-900 shadow-2xs'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Subject &amp; Copy</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {(rule.subjectOverride || rule.bodyOverride) && (
                            <button
                              type="button"
                              onClick={() => handleResetTemplate(tmpl.id)}
                              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 font-semibold underline cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reset Default
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendTestEmail(tmpl)}
                            disabled={sendingTest === tmpl.id}
                            className="bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{sendingTest === tmpl.id ? 'Sending...' : 'Send Test to My Inbox'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Content: Preview or Editor */}
                      {previewTab === 'preview' ? (
                        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                          {/* Fake Email Client Chrome */}
                          <div className="bg-stone-100 border-b border-stone-200 px-4 py-2.5 text-xs text-stone-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-mono">
                            <div>
                              <span className="text-stone-400">To:</span> {sampleVars.guestName} &lt;{sampleVars.guestEmail}&gt;
                            </div>
                            <div>
                              <span className="text-stone-400">From:</span> {hotel.name} &lt;reservations@travelmalawi.com&gt;
                            </div>
                          </div>

                          <div className="p-4 sm:p-6 bg-stone-50/50">
                            {/* Injected HTML email preview */}
                            <div 
                              className="max-w-2xl mx-auto rounded-xl shadow-xs"
                              dangerouslySetInnerHTML={{ __html: renderedHtml }} 
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs">
                          <div>
                            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                              Email Subject Line
                            </label>
                            <input
                              type="text"
                              value={rule.subjectOverride ?? tmpl.defaultSubject}
                              onChange={e => handleUpdateRule(tmpl.id, { subjectOverride: e.target.value })}
                              className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-stone-900 font-medium focus:outline-hidden focus:border-stone-900"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                                Email Message Body
                              </label>
                              <span className="text-[11px] text-stone-400">
                                Click variables below to insert
                              </span>
                            </div>

                            {/* Variable Insertion Pills */}
                            <div className="flex flex-wrap gap-1 mb-2.5">
                              {[
                                'guestName',
                                'hotelName',
                                'roomName',
                                'checkIn',
                                'checkOut',
                                'bookingRef',
                                'arrivalPin',
                                'wifiName',
                                'wifiPassword',
                                'managerPhone',
                                'depositInstructions'
                              ].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => insertVariable(tmpl.id, v)}
                                  className="text-[11px] font-mono bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200 transition cursor-pointer"
                                  title={`Insert {${v}}`}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>

                            <textarea
                              rows={10}
                              value={rule.bodyOverride ?? tmpl.defaultBody}
                              onChange={e => handleUpdateRule(tmpl.id, { bodyOverride: e.target.value })}
                              className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-200 p-3 rounded-xl text-stone-900 font-mono focus:outline-hidden focus:border-stone-900 leading-relaxed"
                            />
                          </div>

                          {/* Channel selector if WhatsApp is enabled */}
                          {whatsappEnabled && (
                            <div className="pt-2 border-t border-stone-100 flex items-center gap-3">
                              <span className="text-xs font-semibold text-stone-600">Primary Delivery Channel:</span>
                              <div className="flex gap-2">
                                <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`channel-${tmpl.id}`}
                                    checked={rule.channel === 'email' || !rule.channel}
                                    onChange={() => handleUpdateRule(tmpl.id, { channel: 'email' })}
                                  />
                                  <span>Email (SMTP)</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`channel-${tmpl.id}`}
                                    checked={rule.channel === 'whatsapp'}
                                    onChange={() => handleUpdateRule(tmpl.id, { channel: 'whatsapp' })}
                                  />
                                  <span>WhatsApp</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`channel-${tmpl.id}`}
                                    checked={rule.channel === 'both'}
                                    onChange={() => handleUpdateRule(tmpl.id, { channel: 'both' })}
                                  />
                                  <span>Both Channels</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. VIEW B: SCHEDULED REMINDERS QUEUE & SENT HISTORY */}
      {activeView === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-stone-900">
                Scheduled Queue &amp; History for {hotel.name}
              </h4>
              <p className="text-xs text-stone-500">
                Live queue of automated reminders awaiting background dispatch or recently completed.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchHotelReminders}
              disabled={loadingReminders}
              className="text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl border border-stone-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loadingReminders ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {loadingReminders ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-500 text-sm">
              Loading reminders queue...
            </div>
          ) : reminders.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center space-y-2">
              <Mail className="w-8 h-8 text-stone-300 mx-auto" />
              <div className="text-sm font-bold text-stone-800">No scheduled reminders queued yet</div>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                When a new booking is confirmed for {hotel.name}, automated pre-arrival, PIN, and check-out emails will populate here and dispatch automatically.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs divide-y divide-stone-100">
              {reminders.map(item => {
                const isSent = item.sent;
                const dateScheduled = new Date(item.scheduledFor);
                const isPast = dateScheduled <= new Date();

                return (
                  <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-stone-900">{item.guestName}</span>
                        <span className="text-xs font-mono font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                          #{item.bookingRef}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isSent 
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {isSent ? '✓ Sent' : (isPast ? 'Firing now...' : 'Scheduled')}
                        </span>
                        <span className="text-[11px] text-stone-400 capitalize">
                          via {item.channel}
                        </span>
                      </div>

                      <div className="text-xs text-stone-600 font-medium">
                        {item.subject || item.message.slice(0, 80) + '...'}
                      </div>

                      <div className="text-[11px] text-stone-400 flex items-center gap-3">
                        <span>Scheduled for: {dateScheduled.toLocaleString()}</span>
                        {item.sentAt && <span>Sent at: {new Date(item.sentAt).toLocaleString()}</span>}
                        {item.guestEmail && <span>✉️ {item.guestEmail}</span>}
                      </div>
                    </div>

                    {!isSent && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(item.id)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition self-end sm:self-center flex items-center gap-1 cursor-pointer font-medium"
                        title="Cancel this scheduled reminder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
