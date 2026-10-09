import './envSanitizer';
import fs from 'fs';
import path from 'path';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { sendSystemEmail } from './emailConfig';
import { sendWhatsAppMessage } from './whatsappConfig';
import { escapeHtml, PROJECT_ID, DATABASE_ID } from './auth';
import { READY_REMINDER_TEMPLATES, fillTemplate, formatReminderEmailHtml, ReminderVariables } from '../src/lib/reminderTemplates';

/**
 * Booking reminders.
 *
 * Storage: a JSON file under data/ by default. Set REMINDERS_STORE=firestore to
 * keep them in the `server_reminders` Firestore collection instead, using
 * Application Default Credentials (e.g. the Cloud Run service account) — use
 * this in production, because container disks are wiped on every redeploy.
 *
 * Delivery: a reminder is marked `sent` only once a channel reports success.
 * Failures are retried with backoff and abandoned after MAX_ATTEMPTS; reminders
 * more than a day overdue (e.g. after downtime) are expired rather than sent.
 * Times are Malawi time (Africa/Blantyre, UTC+2, no DST) whatever the server TZ.
 */

export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'expired' | 'cancelled' | 'skipped';

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
  /** True only once delivery succeeded. Kept for existing UI; prefer `status`. */
  sent: boolean;
  sentAt?: string;
  status?: ReminderStatus;
  attempts?: number;
  nextAttemptAt?: string;
  lastError?: string;
  createdAt: string;
}

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const MALAWI_OFFSET = '+02:00';

/** A Malawi wall-clock time on a YYYY-MM-DD date, as an absolute Date. */
function malawiTime(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00${MALAWI_OFFSET}`);
}

function statusOf(r: ServerReminder): ReminderStatus {
  return r.status || (r.sent ? 'sent' : 'pending');
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

interface ReminderStore {
  all(): Promise<ServerReminder[]>;
  byBooking(bookingId: string): Promise<ServerReminder[]>;
  byHotel(hotelId: string): Promise<ServerReminder[]>;
  get(id: string): Promise<ServerReminder | null>;
  put(reminders: ServerReminder[]): Promise<void>;
  remove(id: string): Promise<boolean>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');

class FileStore implements ReminderStore {
  private read(): ServerReminder[] {
    try {
      if (!fs.existsSync(REMINDERS_FILE)) return [];
      return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }
  private write(list: ServerReminder[]) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${REMINDERS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, REMINDERS_FILE);
  }
  async all() { return this.read(); }
  async byBooking(bookingId: string) { return this.read().filter(r => r.bookingId === bookingId); }
  async byHotel(hotelId: string) { return this.read().filter(r => r.hotelId === hotelId); }
  async get(id: string) { return this.read().find(r => r.id === id) || null; }
  async put(reminders: ServerReminder[]) {
    if (reminders.length === 0) return;
    const list = this.read();
    for (const rem of reminders) {
      const idx = list.findIndex(r => r.id === rem.id);
      if (idx === -1) list.push(rem);
      else list[idx] = rem;
    }
    this.write(list);
  }
  async remove(id: string) {
    const list = this.read();
    const next = list.filter(r => r.id !== id);
    if (next.length === list.length) return false;
    this.write(next);
    return true;
  }
}

class FirestoreStore implements ReminderStore {
  private db: Firestore;
  constructor() {
    const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
    this.db = getFirestore(app, DATABASE_ID);
  }
  private col() { return this.db.collection('server_reminders'); }
  async all() { return (await this.col().get()).docs.map(d => d.data() as ServerReminder); }
  async byBooking(bookingId: string) {
    return (await this.col().where('bookingId', '==', bookingId).get()).docs.map(d => d.data() as ServerReminder);
  }
  async byHotel(hotelId: string) {
    return (await this.col().where('hotelId', '==', hotelId).get()).docs.map(d => d.data() as ServerReminder);
  }
  async get(id: string) {
    const snap = await this.col().doc(id).get();
    return snap.exists ? (snap.data() as ServerReminder) : null;
  }
  async put(reminders: ServerReminder[]) {
    for (let i = 0; i < reminders.length; i += 400) {
      const batch = this.db.batch();
      for (const r of reminders.slice(i, i + 400)) {
        // Firestore rejects undefined values.
        batch.set(this.col().doc(r.id), JSON.parse(JSON.stringify(r)));
      }
      await batch.commit();
    }
  }
  async remove(id: string) {
    const ref = this.col().doc(id);
    if (!(await ref.get()).exists) return false;
    await ref.delete();
    return true;
  }
}

class HybridReminderStore implements ReminderStore {
  private fileStore = new FileStore();
  private firestoreStore: FirestoreStore | null = null;
  private warnedFallback = false;
  private disabledFirestore = false;

  private getFirestore(): FirestoreStore | null {
    if (this.disabledFirestore) return null;
    if (!this.firestoreStore) {
      try {
        this.firestoreStore = new FirestoreStore();
      } catch (err: any) {
        this.handleFallback('initialization', err);
        return null;
      }
    }
    return this.firestoreStore;
  }

  private handleFallback(op: string, err: any) {
    this.disabledFirestore = true;
    if (!this.warnedFallback) {
      this.warnedFallback = true;
      console.warn(`[Reminders] Firestore unavailable (${err?.message || err}). Falling back to local file storage.`);
    }
  }

  async all() {
    const fs = this.getFirestore();
    if (!fs) return this.fileStore.all();
    try {
      return await fs.all();
    } catch (err: any) {
      this.handleFallback('all()', err);
      return this.fileStore.all();
    }
  }

  async byBooking(bookingId: string) {
    const fs = this.getFirestore();
    if (!fs) return this.fileStore.byBooking(bookingId);
    try {
      return await fs.byBooking(bookingId);
    } catch (err: any) {
      this.handleFallback('byBooking()', err);
      return this.fileStore.byBooking(bookingId);
    }
  }

  async byHotel(hotelId: string) {
    const fs = this.getFirestore();
    if (!fs) return this.fileStore.byHotel(hotelId);
    try {
      return await fs.byHotel(hotelId);
    } catch (err: any) {
      this.handleFallback('byHotel()', err);
      return this.fileStore.byHotel(hotelId);
    }
  }

  async get(id: string) {
    const fs = this.getFirestore();
    if (!fs) return this.fileStore.get(id);
    try {
      return await fs.get(id);
    } catch (err: any) {
      this.handleFallback('get()', err);
      return this.fileStore.get(id);
    }
  }

  async put(reminders: ServerReminder[]) {
    // Always mirror to file store
    await this.fileStore.put(reminders);
    const fs = this.getFirestore();
    if (!fs) return;
    try {
      await fs.put(reminders);
    } catch (err: any) {
      this.handleFallback('put()', err);
    }
  }

  async remove(id: string) {
    const fileResult = await this.fileStore.remove(id);
    const fs = this.getFirestore();
    if (!fs) return fileResult;
    try {
      const fsResult = await fs.remove(id);
      return fsResult || fileResult;
    } catch (err: any) {
      this.handleFallback('remove()', err);
      return fileResult;
    }
  }
}

let store: ReminderStore | null = null;
function getStore(): ReminderStore {
  if (!store) {
    store = process.env.REMINDERS_STORE === 'firestore' ? new HybridReminderStore() : new FileStore();
  }
  return store;
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

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

/** Email HTML built from plain text, with every input escaped. */
function buildHtml(subject: string, body: string, hotelName: string, ref: string): string {
  return formatReminderEmailHtml(escapeHtml(subject), escapeHtml(body), escapeHtml(hotelName), escapeHtml(ref));
}

export async function generateAutoReminders(booking: AutoReminderInput): Promise<ServerReminder[]> {
  if (booking.automationSettings && booking.automationSettings.autoRemindersEnabled === false) {
    return [];
  }

  const existing = await getStore().byBooking(booking.id);
  const now = new Date();
  const nowIso = now.toISOString();
  const ref = booking.reference || booking.id.slice(0, 6);
  const rules = booking.automationSettings?.rules || {};

  // Templates already delivered (or given up on) for this booking are not
  // queued again, so confirming twice does not send a second deposit reminder.
  const settledTemplates = new Set(
    existing.filter(r => r.templateId && statusOf(r) !== 'pending').map(r => r.templateId!)
  );

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
    depositInstructions: booking.depositInstructions || 'Contact the property for payment details.',
    wifiName: booking.wifiName || `${booking.hotelName} Guest`,
    wifiPassword: booking.wifiPassword || 'Provided upon check-in',
    managerPhone: booking.managerPhone || 'via your Travel Malawi booking chat',
    managerEmail: booking.managerEmail || 'via your Travel Malawi booking chat',
  };

  const newReminders: ServerReminder[] = [];

  const queue = (templateId: string, type: ServerReminder['type'], targetDate: Date, defaultEnabled = true) => {
    const tmpl = READY_REMINDER_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    if (settledTemplates.has(templateId)) return;

    const rule = rules[templateId];
    const isEnabled = rule !== undefined ? rule.enabled : defaultEnabled;
    if (!isEnabled) return;
    if (Number.isNaN(targetDate.getTime()) || targetDate <= now) return;

    const channelChoice = rule?.channel || (booking.guestEmail ? 'email' : (booking.guestWhatsapp ? 'whatsapp' : 'in_app'));
    const finalSubject = fillTemplate(rule?.subjectOverride || tmpl.defaultSubject, vars);
    let finalBody = fillTemplate(rule?.bodyOverride || tmpl.defaultBody, vars);
    if (booking.automationSettings?.customSignature) {
      finalBody += `\n\n---\n${booking.automationSettings.customSignature}`;
    }

    newReminders.push({
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
      html: buildHtml(finalSubject, finalBody, booking.hotelName, ref),
      scheduledFor: targetDate.toISOString(),
      sent: false,
      status: 'pending',
      attempts: 0,
      createdAt: nowIso,
    });
  };

  // 1. Deposit & payment details, shortly after confirmation.
  queue('deposit_payment', 'deposit_payment', new Date(now.getTime() + 5 * 60 * 1000));

  // 2. Pre-arrival welcome and directions (default 3 days before, 09:00).
  const daysBefore = rules['pre_arrival_3d']?.timingDays ?? 3;
  const preArrival = malawiTime(booking.checkIn, '09:00');
  preArrival.setTime(preArrival.getTime() - daysBefore * 24 * 60 * 60 * 1000);
  queue('pre_arrival_3d', 'check_in_3d', preArrival);

  // 3. Arrival PIN (default 24h before 09:00 on check-in day).
  const hoursBefore = rules['arrival_24h_pin']?.timingHours ?? 24;
  let arrivalPinTime = new Date(malawiTime(booking.checkIn, '09:00').getTime() - hoursBefore * 60 * 60 * 1000);
  // If the booking is same-day or next-day and 24h before has already passed,
  // but check-in has not concluded, dispatch the essential PIN within 2 minutes of confirmation.
  if (arrivalPinTime <= now && malawiTime(booking.checkIn, '23:59') >= now) {
    arrivalPinTime = new Date(now.getTime() + 2 * 60 * 1000);
  }
  queue('arrival_24h_pin', 'check_in_24h', arrivalPinTime);

  // 4. Check-in morning guide.
  queue('check_in_welcome', 'check_in_welcome', malawiTime(booking.checkIn, '08:00'), false);

  // 5. Check-out logistics.
  queue('check_out_logistics', 'check_out', malawiTime(booking.checkOut, '07:30'));

  // 6. Post-stay review request (default 1 day after check-out, 10:00).
  const daysAfter = rules['post_stay_review']?.timingDays ?? 1;
  queue('post_stay_review', 'post_stay_review', new Date(malawiTime(booking.checkOut, '10:00').getTime() + daysAfter * 24 * 60 * 60 * 1000));

  // Pending reminders for templates no longer queued (e.g. a rule switched
  // off since the last run) are cancelled rather than left to fire.
  const queuedIds = new Set(newReminders.map(r => r.id));
  const dropped = existing
    .filter(r => statusOf(r) === 'pending' && r.templateId && !queuedIds.has(r.id))
    .map(r => ({ ...r, status: 'cancelled' as const }));

  await getStore().put([...dropped, ...newReminders]);
  return newReminders;
}

export async function createManualReminder(data: {
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
  message: string;
  scheduledFor: string;
}): Promise<ServerReminder> {
  const subject = data.subject || `Update on your stay at ${data.hotelName}`;
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
    html: buildHtml(subject, data.message, data.hotelName, data.bookingRef),
    message: data.message,
    scheduledFor: data.scheduledFor,
    type: 'custom',
    sent: false,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  await getStore().put([reminder]);
  return reminder;
}

// ---------------------------------------------------------------------------
// Queries and removal
// ---------------------------------------------------------------------------

export async function getReminder(id: string): Promise<ServerReminder | null> {
  return getStore().get(id);
}

export async function getRemindersForBooking(bookingId: string): Promise<ServerReminder[]> {
  return getStore().byBooking(bookingId);
}

export async function getRemindersForHotel(hotelId: string): Promise<ServerReminder[]> {
  return (await getStore().byHotel(hotelId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllPendingReminders(): Promise<ServerReminder[]> {
  return (await getStore().all()).filter(r => statusOf(r) === 'pending');
}

export async function deleteReminder(reminderId: string): Promise<boolean> {
  return getStore().remove(reminderId);
}

/** Cancels every not-yet-sent reminder for a booking (e.g. on cancellation). */
export async function cancelRemindersForBooking(bookingId: string): Promise<number> {
  const pending = (await getStore().byBooking(bookingId)).filter(r => statusOf(r) === 'pending');
  await getStore().put(pending.map(r => ({ ...r, status: 'cancelled' as const })));
  return pending.length;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

type DeliveryOutcome = { delivered: boolean; permanent?: boolean; error?: string };

async function deliver(r: ServerReminder): Promise<DeliveryOutcome> {
  // In-app and manual WhatsApp-link reminders are surfaced in the UI at their
  // scheduled time; reaching it is the delivery.
  if (r.channel === 'in_app' || r.channel === 'whatsapp_link') return { delivered: true };

  const errors: string[] = [];
  let delivered = false;
  let attempted = false;

  if ((r.channel === 'email' || r.channel === 'both') && r.guestEmail) {
    attempted = true;
    const result = await sendSystemEmail({
      to: r.guestEmail,
      subject: r.subject || `Update on your stay at ${r.hotelName}`,
      text: r.message,
      html: r.html || buildHtml(r.subject || '', r.message, r.hotelName, r.bookingRef),
    });
    if (result.success) delivered = true;
    else errors.push(`email: ${result.error || 'failed'}`);
  }

  const phone = r.guestWhatsapp || r.guestPhone;
  if ((r.channel === 'whatsapp' || r.channel === 'both') && phone) {
    attempted = true;
    const result = await sendWhatsAppMessage(phone, r.message);
    if (result.success && !result.isDirect) delivered = true;
    else if (result.isDirect) errors.push('whatsapp: Cloud API not configured, message not sent');
    else errors.push(`whatsapp: ${result.error || 'failed'}`);
  }

  if (!attempted) return { delivered: false, permanent: true, error: 'No contact details for the chosen channel' };
  return { delivered, error: errors.join('; ') || undefined };
}

let firing = false;

/** Called every minute by the server. Never runs two passes at once. */
export async function checkAndFireReminders(): Promise<{ fired: ServerReminder[] }> {
  if (firing) return { fired: [] };
  firing = true;
  const fired: ServerReminder[] = [];
  try {
    const now = Date.now();
    let allReminders: ServerReminder[] = [];
    try {
      allReminders = await getStore().all();
    } catch (err: any) {
      console.warn('[Reminders] Failed to read from reminder store:', err?.message || err);
      return { fired: [] };
    }

    const due = allReminders.filter(r =>
      statusOf(r) === 'pending' &&
      new Date(r.scheduledFor).getTime() <= now &&
      (!r.nextAttemptAt || new Date(r.nextAttemptAt).getTime() <= now)
    );

    const updates: ServerReminder[] = [];
    for (const r of due) {
      if (now - new Date(r.scheduledFor).getTime() > STALE_AFTER_MS) {
        updates.push({ ...r, status: 'expired', lastError: 'More than 24 hours overdue; not sent.' });
        continue;
      }

      let outcome: DeliveryOutcome;
      try {
        outcome = await deliver(r);
      } catch (err: any) {
        outcome = { delivered: false, error: err?.message || 'Delivery error' };
      }

      if (outcome.delivered) {
        const done = { ...r, sent: true, sentAt: new Date().toISOString(), status: 'sent' as const, lastError: outcome.error };
        updates.push(done);
        fired.push(done);
        continue;
      }

      const attempts = (r.attempts || 0) + 1;
      if (outcome.permanent || attempts >= MAX_ATTEMPTS) {
        updates.push({ ...r, attempts, status: outcome.permanent ? 'skipped' : 'failed', lastError: outcome.error });
        console.error(`[Reminders] Giving up on ${r.id}: ${outcome.error}`);
      } else {
        const delay = RETRY_BASE_MS * 2 ** (attempts - 1);
        updates.push({ ...r, attempts, nextAttemptAt: new Date(now + delay).toISOString(), lastError: outcome.error });
      }
    }

    await getStore().put(updates);
  } finally {
    firing = false;
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

  const now = new Date().toISOString();
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
    // A direct wa.me link still has to be opened by the manager.
    sent: !result.isDirect,
    sentAt: result.isDirect ? undefined : now,
    status: result.isDirect ? 'pending' : 'sent',
    createdAt: now,
  };
  if (!result.isDirect) await getStore().put([reminder]);

  return { success: true, reminder, directLink: result.directLink, isDirect: result.isDirect };
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
}): Promise<{ success: boolean; reminder?: ServerReminder; error?: string }> {
  if (!data.guestEmail || !data.guestEmail.includes('@')) {
    return { success: false, error: 'A valid guest email address is required.' };
  }

  const html = buildHtml(data.subject, data.message, data.hotelName, data.bookingRef);
  const emailResult = await sendSystemEmail({ to: data.guestEmail, subject: data.subject, text: data.message, html });
  if (!emailResult.success) {
    return { success: false, error: emailResult.error };
  }

  const now = new Date().toISOString();
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
    html,
    scheduledFor: now,
    sent: true,
    sentAt: now,
    status: 'sent',
    createdAt: now,
  };
  await getStore().put([reminder]);
  return { success: true, reminder };
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
  const htmlBody = buildHtml(testSubject, data.message, data.hotelName, data.bookingRef || 'TEST-1234');
  const fullHtml = `
    <div style="max-width: 600px; margin: 0 auto 16px; background: #fafaf9; border: 1px solid #e7e5e4; padding: 12px 16px; font-family: sans-serif; font-size: 13px; color: #44403c; text-align: center;">
      <strong>Test email preview</strong><br/>
      Sent from the Travel Malawi manager portal for template: <em>${escapeHtml(data.templateTitle)}</em>.
    </div>
    ${htmlBody}
  `;

  return sendSystemEmail({
    to: data.toEmail,
    subject: testSubject,
    text: `[TEST PREVIEW - ${data.templateTitle}]\n\n${data.message}`,
    html: fullHtml,
  });
}
