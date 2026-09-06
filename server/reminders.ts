import fs from 'fs';
import path from 'path';

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
  type: 'check_in_3d' | 'check_in_24h' | 'check_out' | 'custom';
  recipientType: 'guest' | 'manager';
  channel: 'in_app' | 'whatsapp_link';
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

export function generateAutoReminders(booking: {
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
}): ServerReminder[] {
  const reminders = loadReminders();
  const newReminders: ServerReminder[] = [];
  const now = new Date().toISOString();
  const ref = booking.reference || booking.id.slice(0, 6);

  // Don't duplicate - remove old reminders for this booking
  const filtered = reminders.filter(r => r.bookingId !== booking.id);

  // 3 days before check-in: Manager prep reminder
  const checkInDate = new Date(booking.checkIn + 'T09:00:00');
  const threeDaysBefore = new Date(checkInDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

  if (threeDaysBefore > new Date()) {
    const r: ServerReminder = {
      id: `rem-${booking.id}-3d`,
      bookingId: booking.id,
      bookingRef: ref,
      hotelId: booking.hotelId,
      hotelName: booking.hotelName,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      guestWhatsapp: booking.guestWhatsapp,
      type: 'check_in_3d',
      recipientType: 'manager',
      channel: 'in_app',
      scheduledFor: threeDaysBefore.toISOString(),
      message: `Booking ${ref} — ${booking.guestName} arrives in 3 days (${booking.checkIn}). Prepare the room at ${booking.hotelName}.`,
      sent: false,
      createdAt: now,
    };
    newReminders.push(r);
  }

  // 24h before check-in: Guest arrival reminder
  const oneDayBefore = new Date(checkInDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);

  if (oneDayBefore > new Date()) {
    const r: ServerReminder = {
      id: `rem-${booking.id}-24h`,
      bookingId: booking.id,
      bookingRef: ref,
      hotelId: booking.hotelId,
      hotelName: booking.hotelName,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      guestWhatsapp: booking.guestWhatsapp,
      type: 'check_in_24h',
      recipientType: 'guest',
      channel: 'in_app',
      scheduledFor: oneDayBefore.toISOString(),
      message: `Your stay at ${booking.hotelName} is tomorrow (${booking.checkIn})! Pack your bags and get ready for an amazing trip.`,
      sent: false,
      createdAt: now,
    };
    newReminders.push(r);
  }

  // Check-out day morning: Guest checkout reminder
  const checkOutDate = new Date(booking.checkOut + 'T08:00:00');
  if (checkOutDate > new Date()) {
    const r: ServerReminder = {
      id: `rem-${booking.id}-out`,
      bookingId: booking.id,
      bookingRef: ref,
      hotelId: booking.hotelId,
      hotelName: booking.hotelName,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      guestWhatsapp: booking.guestWhatsapp,
      type: 'check_out',
      recipientType: 'guest',
      channel: 'in_app',
      scheduledFor: checkOutDate.toISOString(),
      message: `Today is check-out day at ${booking.hotelName}. We hope you had a wonderful stay! Check-out is ${booking.checkOut}.`,
      sent: false,
      createdAt: now,
    };
    newReminders.push(r);
  }

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
  message: string;
  scheduledFor: string;
}): ServerReminder {
  const reminders = loadReminders();
  const reminder: ServerReminder = {
    id: `rem-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...data,
    type: 'custom',
    channel: 'in_app',
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

      // Log the reminder (since email is mocked)
      const recipientLabel = r.recipientType === 'guest' ? r.guestName : `Manager of ${r.hotelName}`;
      console.log(`\n🔔 REMINDER FIRED`);
      console.log(`  To: ${recipientLabel}${r.guestEmail ? ` (${r.guestEmail})` : ''}`);
      console.log(`  Type: ${r.type}`);
      console.log(`  Message: ${r.message}`);
      console.log(`  Booking: ${r.bookingRef}`);

      // If WhatsApp available, log the link
      if (r.guestWhatsapp) {
        const phone = r.guestWhatsapp.replace(/[^0-9]/g, '');
        const waMsg = encodeURIComponent(r.message);
        console.log(`  WhatsApp: https://wa.me/${phone}?text=${waMsg}`);
      }
      console.log('');
    }
  }

  if (fired.length > 0) {
    saveReminders(reminders);
  }

  return { fired };
}

export function getAllPendingReminders(): ServerReminder[] {
  return loadReminders().filter(r => !r.sent);
}
