/**
 * Ulendo's zero-token greetings: short, varied, and grounded in today's real
 * numbers instead of one canned paragraph. Used for the chat welcome and
 * whenever the AI service cannot be reached for a simple greeting.
 */

export interface GreetingBooking {
  checkIn: string;
  checkOut: string;
  status?: string;
}

export interface GreetingInput {
  name?: string;
  propertyNames: string[];
  isAdmin?: boolean;
  bookings?: GreetingBooking[];
  todayStr: string;
  hour?: number;
  /** True when the conversation already has messages: no full greeting again. */
  ongoing?: boolean;
}

function pick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function buildConciergeGreeting(input: GreetingInput): string {
  const hour = input.hour ?? new Date().getHours();
  const name = input.name?.trim() ? `, ${input.name.trim()}` : '';
  const scope = input.isAdmin
    ? 'the platform'
    : input.propertyNames.length === 1
      ? input.propertyNames[0]
      : input.propertyNames.length > 1
        ? `your ${input.propertyNames.length} properties`
        : 'your lodge';

  if (input.ongoing) {
    return pick([
      `Hi again${name}. What do you need?`,
      `Here${name}. What's next?`,
      `Hey${name}, go ahead.`,
    ]);
  }

  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const live = (input.bookings || []).filter(b => b.status !== 'cancelled' && b.status !== 'rejected');
  const arrivals = live.filter(b => b.checkIn === input.todayStr).length;
  const departures = live.filter(b => b.checkOut === input.todayStr).length;
  const pending = live.filter(b => b.status === 'pending' && b.checkOut >= input.todayStr).length;

  if (arrivals || departures || pending) {
    const today = [
      arrivals ? plural(arrivals, 'arrival') : '',
      departures ? plural(departures, 'check-out') : '',
    ].filter(Boolean).join(' and ');
    const pendingNote = pending ? `${plural(pending, 'booking')} waiting for confirmation` : '';
    const summary = today
      ? `${today} today at ${scope}${pendingNote ? `, plus ${pendingNote}` : ''}`
      : `${pendingNote} at ${scope}`;
    return `${salutation}${name}. ${summary.charAt(0).toUpperCase()}${summary.slice(1)}. Want the details?`;
  }

  return pick([
    `${salutation}${name}. How can I help across ${scope} today?`,
    `${salutation}${name}. What's on the list for ${scope} today?`,
    `${salutation}${name}. Rates, bookings, guests or something else? Just ask.`,
  ]);
}
