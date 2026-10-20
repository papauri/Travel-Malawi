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
import { whatsappDigits } from '../lib/contact';
import { db } from '../lib/firebase';
import { usePlatformMode } from '../contexts/PlatformModeContext';

interface ReminderTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  hotel: Hotel;
  roomName?: string;
  onReminderSent?: () => void;
}

function ReminderTemplatesModalBody({
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
    // Never invent a number: an unset phone falls back to fillTemplate's wording.
    const managerPhone = hotel.contactPhone || hotel.contactWhatsapp || hotel.managerPhone || undefined;
    const managerEmail = hotel.contactEmail || hotel.managerEmail || 'info@ulendomalawi.com';

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
    // The server only sends to the email stored on the booking.
    if (!booking.guestEmail) {
      toast.error('This booking has no guest email address.');
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
          guestEmail: booking.guestEmail,
          subject: editedSubject,
          message: editedBody,
          html: htmlPreview,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch email reminder.');
      }

      toast.success(`Email reminder sent to ${booking.guestEmail}`, {
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
        updatedAt: Date.now(),
      });
      booking.guestWhatsapp = cleanNum;
      toast.success('WhatsApp number saved to the booking');
    } catch (err: any) {
      console.error('Failed to save guest WhatsApp:', err);
      toast.error('Could not save WhatsApp number to booking.');
    } finally {
      setSavingWhatsappNumber(false);
    }
  };

  // 3. Dispatch WhatsApp reminder directly or via Meta Cloud API
  const handleSendWhatsAppNow = async () => {
    // The server only sends to a number stored on the booking, so a newly
    // typed number is saved to the booking first.
    const typed = recipientWhatsapp.trim();
    if (typed && typed !== (booking.guestWhatsapp || '') && typed !== (booking.guestPhone || '')) {
      await handleSaveGuestWhatsapp();
      if (booking.guestWhatsapp !== typed) return;
    }
    const targetPhone = booking.guestWhatsapp || booking.guestPhone || '';
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
        toast.success('WhatsApp opened with the message ready');
      } else {
        toast.success(`WhatsApp reminder sent to ${targetPhone}`, {
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
    // whatsappDigits expands local 0-prefixed numbers to 265...; wa.me rejects them otherwise.
    const cleanNumber = whatsappDigits(rawNumber) || '';
    const encodedMessage = encodeURIComponent(`*${editedSubject}*\n\n${editedBody}`);
    
    if (cleanNumber) {
      window.open(`https://wa.me/${cleanNumber}?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
    toast.success('WhatsApp opened with the message ready');
  };

  // 5. Schedule Reminder for Future
  const handleScheduleReminder = async () => {
    if (!scheduledDateTime) {
      toast.error('Please select a scheduled date and time.');
      return;
    }

    const channel = scheduleChannel;
    if (channel === 'email' && !booking.guestEmail) {
      toast.error('This booking has no guest email address.');
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
          guestEmail: booking.guestEmail || '',
          guestPhone: booking.guestWhatsapp || booking.guestPhone || '',
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

      toast.success(`Reminder scheduled by ${channel === 'whatsapp' ? 'WhatsApp' : 'email'}`);
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
    toast.success('Reminder copied');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Send a reminder"
      size="3xl"
    >
      <div className="space-y-6">
        {/* Booking context summary header */}
        <div className="bg-stone-50 rounded-lg px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs min-w-0">
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0">
            <span className="font-semibold text-stone-900 text-sm break-words">{booking.guestName}</span>
            <span className="text-stone-400">·</span>
            <span className="font-mono bg-stone-200/80 px-2 py-0.5 rounded text-stone-700 font-semibold">
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
            <span className="font-mono font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
              {templateVars.arrivalPin}
            </span>
          </div>
        </div>

        {/* Categories bar */}
        <div className="flex items-center gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'arrival', label: 'Arrival & PIN' },
            { id: 'stay', label: 'During the stay' },
            { id: 'payment', label: 'Deposit & payment' },
            { id: 'departure', label: 'Departure & feedback' },
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeCategory === cat.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Templates list (left) and editor (right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-w-0">
          
          {/* Templates list (5 cols) */}
          <div className="md:col-span-5 space-y-1 max-h-[480px] overflow-y-auto pr-1 min-w-0">
            <h4 className="tm-label">
              Pick a template
            </h4>
            {filteredTemplates.map(template => {
              const isSelected = template.id === selectedTemplateId;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex flex-col gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50 ring-1 ring-amber-700/30'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-stone-900 line-clamp-1 min-w-0">
                      {template.title}
                    </span>
                    <span className="tm-tag shrink-0">
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

          {/* Compose and send */}
          <div className="md:col-span-7 space-y-4 flex flex-col justify-between min-w-0 md:border-l md:border-stone-200 md:pl-6">
            
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-stone-500 shrink-0" />
                  <h4 className="text-sm font-semibold text-stone-900 truncate">
                    {currentTemplate.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveView('compose')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                      activeView === 'compose' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('preview')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                      activeView === 'preview' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {/* Guest recipient contacts */}
              {true ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="tm-label">
                      Guest email
                    </label>
                    <input
                      type="email"
                      value={booking.guestEmail || ''}
                      readOnly
                      title="Reminders go to the email on the booking. Edit the booking to change it."
                      placeholder="No email on this booking"
                      className="tm-input bg-stone-50"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-stone-700 flex items-center gap-1">
                        Guest WhatsApp
                      </label>
                      {recipientWhatsapp.trim() && recipientWhatsapp.trim() !== (booking.guestWhatsapp || '') && (
                        <button
                          type="button"
                          onClick={handleSaveGuestWhatsapp}
                          disabled={savingWhatsappNumber}
                          className="tm-link text-xs inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <Save className="w-2.5 h-2.5" />
                          {savingWhatsappNumber ? 'Saving...' : 'Save to booking'}
                        </button>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={recipientWhatsapp}
                      onChange={e => setRecipientWhatsapp(e.target.value)}
                      placeholder="Include country code"
                      className="tm-input"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="tm-label">
                    Guest email
                  </label>
                  <input
                    type="email"
                    value={booking.guestEmail || ''}
                    readOnly
                    title="Reminders go to the email on the booking. Edit the booking to change it."
                    placeholder="No email on this booking"
                    className="tm-input bg-stone-50"
                  />
                </div>
              )}

              {activeView === 'compose' ? (
                <>
                  {/* Subject line */}
                  <div>
                    <label className="tm-label">
                      Email subject
                    </label>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={e => setEditedSubject(e.target.value)}
                      className="tm-input"
                    />
                  </div>

                  {/* Message body */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-stone-700">
                        Message
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
                      className="tm-input leading-relaxed resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="border border-stone-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto p-4 bg-stone-50 break-words">
                  <div 
                    dangerouslySetInnerHTML={{ __html: htmlPreview }} 
                    className="prose prose-sm max-w-none"
                  />
                </div>
              )}
            </div>

            {/* Send buttons */}
            <div className="pt-4 border-t border-stone-100 space-y-3">
              <div className="tm-actions">
                {/* Send email now */}
                <button
                  type="button"
                  onClick={handleSendEmailNow}
                  disabled={sendingEmail || !booking.guestEmail}
                  className="tm-btn tm-btn-primary flex-1 min-w-[150px]"
                >
                  {sendingEmail ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sendingEmail ? 'Sending...' : 'Send email'}
                </button>

                {/* WhatsApp buttons */}
                {true && (
                  <>
                    <button
                      type="button"
                      onClick={handleSendWhatsAppNow}
                      disabled={sendingWhatsapp || !recipientWhatsapp.trim()}
                      className="tm-btn tm-btn-secondary flex-1 min-w-[150px]"
                      title={recipientWhatsapp.trim() ? 'Send template via WhatsApp' : 'Add the guest WhatsApp number first'}
                    >
                      {sendingWhatsapp ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                      {sendingWhatsapp ? 'Sending...' : 'Send WhatsApp'}
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="tm-btn tm-btn-quiet"
                      title="Open the chat in WhatsApp"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      wa.me
                    </button>
                  </>
                )}
              </div>

              {/* Schedule */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-stone-100">
                {true && (
                  <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => setScheduleChannel('email')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                        scheduleChannel === 'email' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleChannel('whatsapp')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                        scheduleChannel === 'whatsapp' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
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
                  className="tm-input flex-1 min-w-0"
                />
                
                <button
                  type="button"
                  onClick={handleScheduleReminder}
                  disabled={scheduling || !scheduledDateTime}
                  className="tm-btn tm-btn-secondary shrink-0"
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

/**
 * Booking reminders (email/WhatsApp to the guest) exist only in booking mode.
 * Gated in a wrapper so none of the body's hooks (Firestore listeners, writes)
 * run while the platform is a directory (D3).
 */
export default function ReminderTemplatesModal(props: ReminderTemplatesModalProps) {
  const { bookingsEnabled } = usePlatformMode();
  if (!bookingsEnabled) return null;
  return <ReminderTemplatesModalBody {...props} />;
}
