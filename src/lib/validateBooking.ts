/**
 * Booking form validation.
 *
 * One function so the rules are stated once and cannot drift between the field
 * hints, the submit handler and whatever calls it next. Every rule returns the
 * field it belongs to, so the form can mark that input rather than only firing
 * a toast that disappears.
 */

import { RoomType } from '../types';
import { DateStr, daysUntil, isValidDateStr, nightsBetween, todayStr } from './dates';
import { normalisePhone } from './spam';

export type BookingField =
  | 'guestName' | 'guestEmail' | 'guestPhone' | 'guestWhatsapp'
  | 'checkIn' | 'checkOut' | 'guests' | 'specialRequests';

export interface FieldError {
  field: BookingField;
  message: string;
}

export interface BookingInput {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestWhatsapp?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  specialRequests?: string;
}

/** Longest stay the form accepts. Beyond this it is a long let, not a booking. */
export const MAX_NIGHTS = 60;

/** How far ahead a booking may be made. */
export const MAX_DAYS_AHEAD = 730;

export const MAX_SPECIAL_REQUESTS = 1000;
export const MAX_NAME_LENGTH = 100;

// Deliberately permissive: the aim is to catch a typo, not to adjudicate the
// RFC. Anything stricter starts rejecting real addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function phoneError(value: string, label: string, required: boolean): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return required ? `${label} is required.` : null;
  const digits = normalisePhone(trimmed);
  if (digits.length < 7) return `${label} is too short to be a real number.`;
  if (digits.length > 15) return `${label} is too long — check for extra digits.`;
  if (/[^\d\s+()\-.]/.test(trimmed)) return `${label} contains characters that are not part of a phone number.`;
  return null;
}

/**
 * Every problem with a submission, in the order the fields appear. An empty
 * array means it is safe to write.
 */
export function validateBooking(input: BookingInput, room: RoomType | null): FieldError[] {
  const errors: FieldError[] = [];
  const today = todayStr();

  const name = (input.guestName ?? '').trim();
  if (!name) {
    errors.push({ field: 'guestName', message: 'Please give the name the booking is under.' });
  } else if (name.length < 2) {
    errors.push({ field: 'guestName', message: 'That name is too short.' });
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push({ field: 'guestName', message: `Please keep the name under ${MAX_NAME_LENGTH} characters.` });
  }

  const email = (input.guestEmail ?? '').trim();
  if (!email) {
    errors.push({ field: 'guestEmail', message: 'An email address is required to confirm the booking.' });
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'guestEmail', message: 'That does not look like a valid email address.' });
  }

  const phoneProblem = phoneError(input.guestPhone, 'Phone number', true);
  if (phoneProblem) errors.push({ field: 'guestPhone', message: phoneProblem });

  const whatsappProblem = phoneError(input.guestWhatsapp ?? '', 'WhatsApp number', false);
  if (whatsappProblem) errors.push({ field: 'guestWhatsapp', message: whatsappProblem });

  // --- Dates ---------------------------------------------------------------
  const checkIn = input.checkIn as DateStr;
  const checkOut = input.checkOut as DateStr;

  if (!isValidDateStr(checkIn)) {
    errors.push({ field: 'checkIn', message: 'Please choose a check-in date.' });
  } else if (checkIn < today) {
    errors.push({ field: 'checkIn', message: 'Check-in cannot be in the past.' });
  } else if (daysUntil(checkIn) > MAX_DAYS_AHEAD) {
    errors.push({ field: 'checkIn', message: 'That is more than two years away — please contact the property directly.' });
  }

  if (!isValidDateStr(checkOut)) {
    errors.push({ field: 'checkOut', message: 'Please choose a check-out date.' });
  } else if (isValidDateStr(checkIn)) {
    const nights = nightsBetween(checkIn, checkOut);
    if (nights <= 0) {
      errors.push({ field: 'checkOut', message: 'Check-out must be after check-in.' });
    } else if (nights > MAX_NIGHTS) {
      errors.push({ field: 'checkOut', message: `Stays longer than ${MAX_NIGHTS} nights need to be arranged with the property.` });
    }
  }

  // --- Party size ----------------------------------------------------------
  const guests = Number(input.guests);
  if (!Number.isInteger(guests) || guests < 1) {
    errors.push({ field: 'guests', message: 'A booking needs at least one guest.' });
  } else if (room && guests > (room.maxGuests ?? 0)) {
    errors.push({
      field: 'guests',
      message: `${room.name} sleeps up to ${room.maxGuests}. Book a second room for a larger party.`,
    });
  }

  const requests = (input.specialRequests ?? '').trim();
  if (requests.length > MAX_SPECIAL_REQUESTS) {
    errors.push({
      field: 'specialRequests',
      message: `Please keep requests under ${MAX_SPECIAL_REQUESTS} characters.`,
    });
  }

  return errors;
}

/** Field to message, for marking inputs. */
export function errorsByField(errors: FieldError[]): Partial<Record<BookingField, string>> {
  const map: Partial<Record<BookingField, string>> = {};
  for (const error of errors) if (!map[error.field]) map[error.field] = error.message;
  return map;
}
