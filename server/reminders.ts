import fs from 'fs';
import path from 'path';
import { sendSystemEmail } from './emailConfig';
import { sendWhatsAppMessage } from './whatsappConfig';
import { READY_REMINDER_TEMPLATES, fillTemplate, formatReminderEmailHtml, ReminderVariables } from '../src/lib/reminderTemplates';

export interface ServerReminder {
  id: string;
  bookingId: string;
  bookingRef: string;
  hotelId: string;
  hotelName: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestWhatsapp?: string;
  type: 'check_in_3d' | 'check_in_24h' | 'check_out' | 'deposit_payment' | 'check_in_welcome' | 'post_stay_review' | 'custom';
  templateId?: string;
  recipientType: 'guest' | 'manager';
  channel: 'in_app' | 'whatsapp_link' | 'whatsapp' | 'email' | 'both';
  subject?: string;
  html?: string;
  scheduledFor: string;
  message: string;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');

function loadReminders(): ServerReminder[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(REMINDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveReminders(reminders: ServerReminder[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
}

export interface AutoReminderInput {
  id: string;
  reference?: string;
  hotelId: string;
  hotelName: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestWhatsapp?: string;
  checkIn: string;
  checkOut: string;
  roomName?: string;
  arrivalPin?: string;
  totalPrice?: string;
  depositInstructions?: string;
  wifiName?: string;
  wifiPassword?: string;
  managerPhone?: string;
  managerEmail?: string;
  automationSettings?: {
    autoRemindersEnabled?: boolean;
    rules?: Record<string, {
      enabled: boolean;
      channel?: 'email' | 'whatsapp' | 'both';
      timingDays?: number;
      timingHours?: number;
      timeOfDay?: string;
      subjectOverride?: string;
      bodyOverride?: string;
    }>;
    customSignature?: string;
  };
}

export function generateAutoReminders(booking: AutoReminderInput): ServerReminder[] {
  const reminders = loadReminders();
  const newReminders: ServerReminder[] = [];
  const now = new Date();
  const nowIso = now.toISOString();
  const ref = booking.reference || booking.id.slice(0, 6);

  // Check if automation is globally disabled for this property
  if (booking.automationSettings && booking.automationSettings.autoRemindersEnabled === false) {
    // Automation disabled by manager
    return [];
  }

  // Remove previous un-sent reminders for this booking to avoid duplicates
  const filtered = reminders.filter(r => !(r.bookingId === booking.id && !r.sent));

  const rules = booking.automationSettings?.rules || {};

  const vars: ReminderVariables = {
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    hotelName: booking.hotelName,
    roomName: booking.roomName || 'Confirmed Room',
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    bookingRef: ref,
    arrivalPin: booking.arrivalPin || Math.floor(1000 + Math.random() * 9000).toString(),
    totalPrice: booking.totalPrice || 'As quoted',
    depositInstructions: booking.depositInstructions || 'Contact hotel management for payment details.',
    wifiName: booking.wifiName || `${booking.hotelName} Guest`,
    wifiPassword: booking.wifiPassword || 'Provided upon check-in',
    managerPhone: booking.managerPhone || '+265 999 000 000',
    managerEmail: booking.managerEmail || 'reservations@travelmalawi.com',
  };

  const getTemplate = (id: string) => READY_REMINDER_TEMPLATES.find(t => t.id === id);

  // Helper to build and queue a template-based reminder
  const queueTemplateReminder = (
    templateId: string,
    type: ServerReminder['type'],
    targetDate: Date,
    defaultEnabled: boolean = true
  ) => {
    const tmpl = getTemplate(templateId);
    if (!tmpl) return;

    const rule = rules[templateId];
    const isEnabled = rule !== undefined ? rule.enabled : defaultEnabled;
    if (!isEnabled) return;

    // Only schedule if target is in the future
    if (targetDate <= now) return;

    const channelChoice = rule?.channel || (booking.guestEmail ? 'email' : (booking.guestWhatsapp ? 'whatsapp' : 'in_app'));
    const rawSubject = rule?.subjectOverride || tmpl.defaultSubject;
    const rawBody = rule?.bodyOverride || tmpl.defaultBody;

    const finalSubject = fillTemplate(rawSubject, vars);
    let finalBody = fillTemplate(rawBody, vars);

    if (booking.automationSettings?.customSignature) {
      finalBody += `\n\n---\n${booking.automationSettings.customSignature}`;
    }

    const htmlContent = formatReminderEmailHtml(finalSubject, finalBody, booking.hotelName, ref);

    const reminder: ServerReminder = {
      id: `rem-${booking.id}-${templateId}`,
      bookingId: booking.id,
      bookingRef: ref,
      hotelId: booking.hotelId,
      hotelName: booking.hotelName,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      guestWhatsapp: booking.guestWhatsapp,
      type,
      templateId,
      recipientType: 'guest',
      channel: channelChoice,
      subject: finalSubject,
      message: finalBody,
      html: htmlContent,
      scheduledFor: targetDate.toISOString(),
      sent: false,
      createdAt: nowIso,
    };

    newReminders.push(reminder);
  };

  // 1. Deposit & Payment Reminder (Immediately or +10 minutes after confirmation)
  const depositRule = rules['deposit_payment'];
  const depositEnabled = depositRule !== undefined ? depositRule.enabled : true;
  if (depositEnabled) {
    const depositTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes after confirmation
    queueTemplateReminder('deposit_payment', 'deposit_payment', depositTime, true);
  }

  // 2. 3-Day Pre-Arrival Welcome & Directions
  const preArrivalRule = rules['pre_arrival_3d'];
  const daysBeforeArrival = preArrivalRule?.timingDays !== undefined ? preArrivalRule.timingDays : 3;
  const checkInDate = new Date(booking.checkIn + 'T09:00:00');
  const arrivalWelcomeDate = new Date(checkInDate);
  arrivalWelcomeDate.setDate(arrivalWelcomeDate.getDate() - daysBeforeArrival);
  queueTemplateReminder('pre_arrival_3d', 'check_in_3d', arrivalWelcomeDate, true);

  // 3. 24-Hour Final Arrival & Access PIN
  const pinRule = rules['arrival_24h_pin'];
  const hoursBeforePin = pinRule?.timingHours !== undefined ? pinRule.timingHours : 24;
  const pinDate = new Date(checkInDate.getTime() - hoursBeforePin * 60 * 60 * 1000);
  queueTemplateReminder('arrival_24h_pin', 'check_in_24h', pinDate, true);

  // 4. Check-In Day Morning Guide
  const checkInMorning = new Date(booking.checkIn + 'T08:00:00');
  queueTemplateReminder('check_in_welcome', 'check_in_welcome', checkInMorning, false);

  // 5. Morning Check-Out Logistics
  const checkOutMorning = new Date(booking.checkOut + 'T07:30:00');
  queueTemplateReminder('check_out_logistics', 'check_out', checkOutMorning, true);

  // 6. Post-Stay Review Request
  const reviewRule = rules['post_stay_review'];
  const daysAfterCheckout = reviewRule?.timingDays !== undefined ? reviewRule.timingDays : 1;
  const postCheckoutDate = new Date(booking.checkOut + 'T10:00:00');
  postCheckoutDate.setDate(postCheckoutDate.getDate() + daysAfterCheckout);
  queueTemplateReminder('post_stay_review', 'post_stay_review', postCheckoutDate, true);

  const all = [...filtered, ...newReminders];
  saveReminders(all);
  return newReminders;
}

export function createManualReminder(data: {
  bookingId: string;
  bookingRef: string;
  hotelId: string;
  hotelName: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestWhatsapp?: string;
  recipientType: 'guest' | 'manager';
  channel?: 'in_app' | 'whatsapp_link' | 'email';
  subject?: string;
  html?: string;
  message: string;
  scheduledFor: string;
}): ServerReminder {
  const reminders = loadReminders();
  const reminder: ServerReminder = {
    id: `rem-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookingId: data.bookingId,
    bookingRef: data.bookingRef,
    hotelId: data.hotelId,
    hotelName: data.hotelName,
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone,
    guestWhatsapp: data.guestWhatsapp,
    recipientType: data.recipientType,
    channel: data.channel || 'in_app',
    subject: data.subject,
    html: data.html,
    message: data.message,
    scheduledFor: data.scheduledFor,
    type: 'custom',
    sent: false,
    createdAt: new Date().toISOString(),
  };
  reminders.push(reminder);
  saveReminders(reminders);
  return reminder;
}

export function getRemindersForBooking(bookingId: string): ServerReminder[] {
  return loadReminders().filter(r => r.bookingId === bookingId);
}

export function deleteReminder(reminderId: string): boolean {
  const reminders = loadReminders();
  const idx = reminders.findIndex(r => r.id === reminderId);
  if (idx === -1) return false;
  reminders.splice(idx, 1);
  saveReminders(reminders);
  return true;
}

export function checkAndFireReminders(): { fired: ServerReminder[] } {
  const reminders = loadReminders();
  const now = new Date();
  const fired: ServerReminder[] = [];

  for (const r of reminders) {
    if (r.sent) continue;
    const scheduledTime = new Date(r.scheduledFor);
    if (scheduledTime <= now) {
      r.sent = true;
      r.sentAt = now.toISOString();
      fired.push(r);

      // If scheduled as email, dispatch via SMTP
      if ((r.channel === 'email' || r.channel === 'both') && r.guestEmail) {
        sendSystemEmail({
          to: r.guestEmail,
          subject: r.subject || `Update on your stay at ${r.hotelName}`,
          text: r.message,
          html: r.html || `<p>${r.message.replace(/\n/g, '<br/>')}</p>`,
        }).catch(err => {
          console.error(`[Reminders] Failed to dispatch scheduled email reminder ${r.id}:`, err);
        });
      }

      // If scheduled as whatsapp, dispatch via WhatsApp
      if ((r.channel === 'whatsapp' || r.channel === 'whatsapp_link' || r.channel === 'both') && (r.guestWhatsapp || r.guestPhone)) {
        const phone = r.guestWhatsapp || r.guestPhone!;
        sendWhatsAppMessage(phone, r.message).catch(err => {
          console.error(`[Reminders] Failed to dispatch scheduled WhatsApp reminder ${r.id}:`, err);
        });
      }
    }
  }

  if (fired.length > 0) {
    saveReminders(reminders);
  }

  return { fired };
}

export async function sendReminderWhatsAppNow(data: {
  bookingId: string;
  bookingRef: string;
  hotelId: string;
  hotelName: string;
  guestName: string;
  guestPhone?: string;
  guestWhatsapp?: string;
  subject?: string;
  message: string;
}): Promise<{ success: boolean; reminder?: ServerReminder; directLink?: string; isDirect?: boolean; error?: string }> {
  const recipientNumber = data.guestWhatsapp || data.guestPhone;
  if (!recipientNumber || recipientNumber.trim().length === 0) {
    return { success: false, error: 'A valid guest WhatsApp or phone number is required.' };
  }

  const result = await sendWhatsAppMessage(recipientNumber, data.message);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Record as completed reminder
  const now = new Date().toISOString();
  const reminders = loadReminders();
  const reminder: ServerReminder = {
    id: `rem-wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookingId: data.bookingId,
    bookingRef: data.bookingRef,
    hotelId: data.hotelId,
    hotelName: data.hotelName,
    guestName: data.guestName,
    guestPhone: data.guestPhone,
    guestWhatsapp: recipientNumber,
    recipientType: 'guest',
    type: 'custom',
    channel: result.isDirect ? 'whatsapp_link' : 'whatsapp',
    subject: data.subject,
    message: data.message,
    scheduledFor: now,
    sent: true,
    sentAt: now,
    createdAt: now,
  };

  reminders.push(reminder);
  saveReminders(reminders);

  return { 
    success: true, 
    reminder, 
    directLink: result.directLink, 
    isDirect: result.isDirect 
  };
}

export async function sendReminderEmailNow(data: {
  bookingId: string;
  bookingRef: string;
  hotelId: string;
  hotelName: string;
  guestName: string;
  guestEmail: string;
  subject: string;
  message: string;
  html?: string;
}): Promise<{ success: boolean; reminder?: ServerReminder; error?: string }> {
  if (!data.guestEmail || !data.guestEmail.includes('@')) {
    return { success: false, error: 'A valid guest email address is required.' };
  }

  // Send via SMTP
  const emailResult = await sendSystemEmail({
    to: data.guestEmail,
    subject: data.subject,
    text: data.message,
    html: data.html || `<p>${data.message.replace(/\n/g, '<br/>')}</p>`,
  });

  if (!emailResult.success) {
    return { success: false, error: emailResult.error };
  }

  // Record as completed reminder
  const now = new Date().toISOString();
  const reminders = loadReminders();
  const reminder: ServerReminder = {
    id: `rem-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookingId: data.bookingId,
    bookingRef: data.bookingRef,
    hotelId: data.hotelId,
    hotelName: data.hotelName,
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    recipientType: 'guest',
    type: 'custom',
    channel: 'email',
    subject: data.subject,
    message: data.message,
    html: data.html,
    scheduledFor: now,
    sent: true,
    sentAt: now,
    createdAt: now,
  };

  reminders.push(reminder);
  saveReminders(reminders);

  return { success: true, reminder };
}

export function getAllPendingReminders(): ServerReminder[] {
  return loadReminders().filter(r => !r.sent);
}

export function getRemindersForHotel(hotelId: string): ServerReminder[] {
  return loadReminders()
    .filter(r => r.hotelId === hotelId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function sendTestTemplateEmail(data: {
  toEmail: string;
  hotelName: string;
  bookingRef?: string;
  templateTitle: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!data.toEmail || !data.toEmail.includes('@')) {
    return { success: false, error: 'A valid email address is required to receive test previews.' };
  }

  const testSubject = `[TEST PREVIEW] ${data.subject}`;
  const ref = data.bookingRef || 'TEST-1234';
  const htmlBody = formatReminderEmailHtml(testSubject, data.message, data.hotelName, ref);

  const fullHtml = `
    <div style="max-width: 600px; margin: 0 auto 16px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; font-family: sans-serif; font-size: 13px; color: #92400e; text-align: center;">
      <strong>⚠️ THIS IS A TEST EMAIL PREVIEW</strong><br/>
      Sent by Travel Malawi Manager Portal for template: <em>${data.templateTitle}</em>.
    </div>
    ${htmlBody}
  `;

  return await sendSystemEmail({
    to: data.toEmail,
    subject: testSubject,
    text: `[TEST PREVIEW - ${data.templateTitle}]\n\n${data.message}`,
    html: fullHtml,
  });
}
