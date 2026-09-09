import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Booking, Hotel } from '../types';
import { 
  READY_REMINDER_TEMPLATES, 
  ReminderTemplate, 
  ReminderVariables, 
  fillTemplate, 
  formatReminderEmailHtml 
} from '../lib/reminderTemplates';
import { getHotelDepositInfo } from '../lib/depositInfo';
import { 
  Mail, Send, Calendar, Clock, CheckCircle2, MessageSquare, 
  AlertCircle, RefreshCw, Copy, Check, ExternalLink,
  Smartphone, Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatMoney } from '../lib/booking';
import { formatDateStr } from '../lib/dates';
import { useWhatsAppSettings } from '../hooks/useWhatsAppSettings';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ReminderTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  hotel: Hotel;
  roomName?: string;
  onReminderSent?: () => void;
}

export default function ReminderTemplatesModal({
  isOpen,
  onClose,
  booking,
  hotel,
  roomName = 'Reserved Room',
  onReminderSent,
}: ReminderTemplatesModalProps) {
  const { whatsappEnabled, isConfigured: isWhatsAppConfigured, provider: whatsAppProvider } = useWhatsAppSettings();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('pre_arrival_3d');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Custom edited fields for the active template
  const [editedSubject, setEditedSubject] = useState<string>('');
  const [editedBody, setEditedBody] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>(booking.guestEmail || '');
  const [recipientWhatsapp, setRecipientWhatsapp] = useState<string>(booking.guestWhatsapp || booking.guestPhone || '');
  const [savingWhatsappNumber, setSavingWhatsappNumber] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [scheduleChannel, setScheduleChannel] = useState<'email' | 'whatsapp'>('email');
  
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<'compose' | 'preview'>('compose');

  // Sync recipient states if booking changes
  useEffect(() => {
    setRecipientEmail(booking.guestEmail || '');
    setRecipientWhatsapp(booking.guestWhatsapp || booking.guestPhone || '');
  }, [booking.guestEmail, booking.guestWhatsapp, booking.guestPhone]);

  // Compute all template variables for this booking
  const templateVars = useMemo<ReminderVariables>(() => {
    const ref = booking.reference || (booking.id ? booking.id.slice(0, 8).toUpperCase() : 'N/A');
    const pin = booking.arrivalPin || 'Available at front desk';
    const total = formatMoney(booking.total, booking.currency);
    
    // Deposit calculation
    const depositInfo = getHotelDepositInfo(hotel);
    const depositPolicy = depositInfo.depositPercentage 
      ? `${depositInfo.depositPercentage}% deposit (${formatMoney(booking.total * (depositInfo.depositPercentage / 100), booking.currency)})`
      : '50% deposit';

    const depositInstructions = depositInfo.instructions || 
      'Bank Transfer: National Bank of Malawi / Standard Bank. Mobile Money: Airtel Money / TNM Mpamba. Please include your Booking Reference as payment reference.';

    const wifiName = hotel.infrastructure?.wifiSSID || `${hotel.name} Guest WiFi`;
    const wifiPassword = hotel.infrastructure?.wifiPassword || 'Available at reception desk';
    const managerPhone = hotel.contactPhone || hotel.contactWhatsapp || hotel.managerPhone || '+265 999 000 000';
    const managerEmail = hotel.contactEmail || hotel.managerEmail || 'reservations@travelmalawi.com';

    return {
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      hotelName: hotel.name,
      hotelLocation: hotel.location,
      roomName,
      checkIn: formatDateStr(booking.checkIn, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      checkOut: formatDateStr(booking.checkOut, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      bookingRef: ref,
      arrivalPin: pin,
      totalPrice: total,
      depositAmount: depositPolicy,
      depositInstructions,
      wifiName,
      wifiPassword,
      managerPhone,
      managerEmail,
    };
  }, [booking, hotel, roomName]);

  // Selected template object
  const currentTemplate = useMemo(() => {
    return READY_REMINDER_TEMPLATES.find(t => t.id === selectedTemplateId) || READY_REMINDER_TEMPLATES[0];
  }, [selectedTemplateId]);

  // Whenever the selected template changes, re-populate subject and body
  React.useEffect(() => {
    if (currentTemplate) {
      setEditedSubject(fillTemplate(currentTemplate.defaultSubject, templateVars));
      setEditedBody(fillTemplate(currentTemplate.defaultBody, templateVars));
    }
  }, [currentTemplate, templateVars]);

  // Reset email recipient if booking changes
  React.useEffect(() => {
    setRecipientEmail(booking.guestEmail || '');
  }, [booking.guestEmail]);

  // Filter templates by category
  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'all') return READY_REMINDER_TEMPLATES;
    return READY_REMINDER_TEMPLATES.filter(t => t.category === activeCategory);
  }, [activeCategory]);

  const htmlPreview = useMemo(() => {
    return formatReminderEmailHtml(
      editedSubject,
      editedBody,
      hotel.name,
      templateVars.bookingRef
    );
  }, [editedSubject, editedBody, hotel.name, templateVars.bookingRef]);

  // 1. Dispatch Email Immediately via SMTP
  const handleSendEmailNow = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      toast.error('Please enter a valid guest email address.');
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch('/api/reminders/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          bookingRef: templateVars.bookingRef,
          hotelId: hotel.id,
          hotelName: hotel.name,
          guestName: booking.guestName,
          guestEmail: recipientEmail,
          subject: editedSubject,
          message: editedBody,
          html: htmlPreview,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch email reminder.');
      }

      toast.success(`Email reminder sent successfully to ${recipientEmail}!`, {
        icon: '✉️',
      });
      onReminderSent?.();
      onClose();
    } catch (err: any) {
      console.error('Email reminder error:', err);
      toast.error(err.message || 'Failed to send email. Check SMTP settings in Admin Portal.');
    } finally {
      setSendingEmail(false);
    }
  };

  // 2. Save Guest WhatsApp number to booking in Firestore
  const handleSaveGuestWhatsapp = async () => {
    if (!booking.id) return;
    const cleanNum = recipientWhatsapp.trim();
    if (!cleanNum) {
      toast.error('Enter a phone number to save.');
      return;
    }
    setSavingWhatsappNumber(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        guestWhatsapp: cleanNum,
      });
      booking.guestWhatsapp = cleanNum;
      toast.success('Guest WhatsApp number saved to booking!');
    } catch (err: any) {
      console.error('Failed to save guest WhatsApp:', err);
      toast.error('Could not save WhatsApp number to booking.');
    } finally {
      setSavingWhatsappNumber(false);
    }
  };

  // 3. Dispatch WhatsApp reminder directly or via Meta Cloud API
  const handleSendWhatsAppNow = async () => {
    const targetPhone = recipientWhatsapp.trim() || booking.guestPhone || '';
    if (!targetPhone) {
      toast.error('Please enter a WhatsApp phone number for the guest.');
      return;
    }

    setSendingWhatsapp(true);
    try {
      const res = await fetch('/api/reminders/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          bookingRef: templateVars.bookingRef,
          hotelId: hotel.id,
          hotelName: hotel.name,
          guestName: booking.guestName,
          guestPhone: targetPhone,
          guestWhatsapp: targetPhone,
          subject: editedSubject,
          message: editedBody,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch WhatsApp reminder.');
      }

      if (data.isDirect && data.directLink) {
        window.open(data.directLink, '_blank');
        toast.success('Opened WhatsApp with template message ready!');
      } else {
        toast.success(`WhatsApp reminder sent to ${targetPhone}!`, {
          icon: '💬',
        });
      }

      onReminderSent?.();
      onClose();
    } catch (err: any) {
      console.error('WhatsApp reminder error:', err);
      toast.error(err.message || 'WhatsApp sending failed. Opening direct link...');
      handleOpenWhatsApp();
    } finally {
      setSendingWhatsapp(false);
    }
  };

  // 4. Open in WhatsApp (wa.me)
  const handleOpenWhatsApp = () => {
    const rawNumber = recipientWhatsapp.trim() || booking.guestWhatsapp || booking.guestPhone || '';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(`*${editedSubject}*\n\n${editedBody}`);
    
    if (cleanNumber) {
      window.open(`https://wa.me/${cleanNumber}?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
    toast.success('Opened WhatsApp with formatted message!');
  };

  // 5. Schedule Reminder for Future
  const handleScheduleReminder = async () => {
    if (!scheduledDateTime) {
      toast.error('Please select a scheduled date and time.');
      return;
    }

    const channel = scheduleChannel;
    if (channel === 'email' && !recipientEmail) {
      toast.error('Please enter a recipient email address for scheduling.');
      return;
    }
    if (channel === 'whatsapp' && !recipientWhatsapp.trim()) {
      toast.error('Please enter a recipient WhatsApp number for scheduling.');
      return;
    }

    setScheduling(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          bookingRef: templateVars.bookingRef,
          hotelId: hotel.id,
          hotelName: hotel.name,
          guestName: booking.guestName,
          guestEmail: recipientEmail,
          guestPhone: recipientWhatsapp.trim(),
          recipientType: 'guest',
          channel: channel === 'whatsapp' ? 'whatsapp' : (recipientEmail ? 'email' : 'in_app'),
          subject: editedSubject,
          message: editedBody,
          html: htmlPreview,
          scheduledFor: new Date(scheduledDateTime).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule reminder');

      toast.success(`Reminder scheduled successfully via ${channel === 'whatsapp' ? 'WhatsApp' : 'Email'}!`);
      onReminderSent?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule reminder');
    } finally {
      setScheduling(false);
    }
  };

  // 6. Copy Message to Clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(`${editedSubject}\n\n${editedBody}`);
    setCopied(true);
    toast.success('Copied reminder message to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Manager Email Reminders & Templates"
      size="3xl"
    >
      <div className="space-y-6">
        {/* Booking context summary header */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-stone-900 text-sm">{booking.guestName}</span>
            <span className="text-stone-400">·</span>
            <span className="font-mono bg-stone-200/80 px-2 py-0.5 rounded text-stone-700 font-bold">
              #{templateVars.bookingRef}
            </span>
            <span className="text-stone-400">·</span>
            <span className="text-stone-600 font-medium">{roomName}</span>
            <span className="text-stone-400">·</span>
            <span className="text-stone-600">
              {templateVars.checkIn} → {templateVars.checkOut}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone-500">Arrival PIN:</span>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {templateVars.arrivalPin}
            </span>
          </div>
        </div>

        {/* Categories bar */}
        <div className="flex items-center gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
          {[
            { id: 'all', label: 'All Templates' },
            { id: 'arrival', label: 'Arrival & PIN' },
            { id: 'stay', label: 'Stay & Amenities' },
            { id: 'payment', label: 'Deposit & Payment' },
            { id: 'departure', label: 'Departure & Feedback' },
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeCategory === cat.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 2-Column Layout: Templates List on left, Editor on right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Templates list (5 cols) */}
          <div className="md:col-span-5 space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
              Select Ready Template
            </h4>
            {filteredTemplates.map(template => {
              const isSelected = template.id === selectedTemplateId;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900 line-clamp-1">
                      {template.title}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}>
                      {template.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 line-clamp-1">
                    Timing: {template.recommendedTiming}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Template Compose & Dispatch (7 cols) */}
          <div className="md:col-span-7 bg-white border border-stone-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xs">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-stone-900">
                    {currentTemplate.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveView('compose')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                      activeView === 'compose' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('preview')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                      activeView === 'preview' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    HTML Preview
                  </button>
                </div>
              </div>

              {/* Guest recipient contacts */}
              {true ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Recipient Email Address
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      placeholder="guest@example.com"
                      className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-stone-900 font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-emerald-850 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        Guest WhatsApp Number
                      </label>
                      {recipientWhatsapp.trim() && recipientWhatsapp.trim() !== (booking.guestWhatsapp || '') && (
                        <button
                          type="button"
                          onClick={handleSaveGuestWhatsapp}
                          disabled={savingWhatsappNumber}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Save className="w-2.5 h-2.5" />
                          {savingWhatsappNumber ? 'Saving...' : 'Save to Booking'}
                        </button>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={recipientWhatsapp}
                      onChange={e => setRecipientWhatsapp(e.target.value)}
                      placeholder="+265 999 123 456"
                      className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-600 font-medium text-stone-900"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-stone-900 font-medium"
                  />
                </div>
              )}

              {activeView === 'compose' ? (
                <>
                  {/* Subject line */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={e => setEditedSubject(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-stone-900 font-medium text-stone-900"
                    />
                  </div>

                  {/* Message body */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-700">
                        Email Message Body (Variables Auto-Filled)
                      </label>
                      <button
                        type="button"
                        onClick={handleCopyMessage}
                        className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy text'}
                      </button>
                    </div>
                    <textarea
                      rows={9}
                      value={editedBody}
                      onChange={e => setEditedBody(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-xl text-xs font-sans leading-relaxed text-stone-800 focus:outline-none focus:border-stone-900 resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto p-4 bg-stone-50">
                  <div 
                    dangerouslySetInnerHTML={{ __html: htmlPreview }} 
                    className="prose prose-sm max-w-none"
                  />
                </div>
              )}
            </div>

            {/* Action dispatch buttons */}
            <div className="pt-4 border-t border-stone-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Send Email Now button */}
                <button
                  type="button"
                  onClick={handleSendEmailNow}
                  disabled={sendingEmail || !recipientEmail}
                  className="flex-1 min-w-[150px] py-2.5 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {sendingEmail ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sendingEmail ? 'Dispatching...' : 'Send Email Now'}
                </button>

                {/* WhatsApp buttons (ONLY rendered if WhatsApp is enabled in Admin Portal) */}
                {true && (
                  <>
                    <button
                      type="button"
                      onClick={handleSendWhatsAppNow}
                      disabled={sendingWhatsapp || !recipientWhatsapp.trim()}
                      className="flex-1 min-w-[150px] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                      title={recipientWhatsapp.trim() ? 'Send template via WhatsApp' : 'Please provide guest WhatsApp number'}
                    >
                      {sendingWhatsapp ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                      {sendingWhatsapp ? 'Dispatching...' : 'Send WhatsApp Now'}
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      title="Open chat directly in WhatsApp Web or Mobile"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      wa.me
                    </button>
                  </>
                )}
              </div>

              {/* Schedule option row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-stone-100">
                {true && (
                  <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setScheduleChannel('email')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        scheduleChannel === 'email' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleChannel('whatsapp')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        scheduleChannel === 'whatsapp' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      WhatsApp
                    </button>
                  </div>
                )}

                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={e => setScheduledDateTime(e.target.value)}
                  className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-xs flex-1"
                />
                
                <button
                  type="button"
                  onClick={handleScheduleReminder}
                  disabled={scheduling || !scheduledDateTime}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0 cursor-pointer"
                >
                  {scheduling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                  Schedule {scheduleChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </Modal>
  );
}
