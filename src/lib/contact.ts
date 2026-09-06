/**
 * Contact details — validation, and the links that make them usable.
 *
 * A property carried no way to reach it. The whole product promises that the
 * host confirms "by phone or WhatsApp", but nothing on a listing held a number,
 * so a guest with a question before booking, or one lost on the road at dusk,
 * had nowhere to go. These rules are shared by the listing wizard, the property
 * editor and the booking form so an address accepted in one place is not
 * rejected in another.
 */

import { normalisePhone } from './spam';

// Deliberately permissive: the aim is to catch a typo, not to adjudicate the
// RFC. Anything stricter starts rejecting real addresses.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export const MAX_EMAIL_LENGTH = 254;

export function isEmail(value: string): boolean {
  const trimmed = (value ?? '').trim();
  return trimmed.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(trimmed);
}

/** The problem with an email address, or null. `label` names it to the reader. */
export function emailProblem(value: string, label: string, required: boolean): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return required ? `${label} is required.` : null;
  if (trimmed.length > MAX_EMAIL_LENGTH) return `${label} is too long.`;
  if (!EMAIL_PATTERN.test(trimmed)) return `${label} does not look like an email address.`;
  return null;
}

/** The problem with a phone number, or null. */
export function phoneProblem(value: string, label: string, required: boolean): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return required ? `${label} is required.` : null;
  const digits = normalisePhone(trimmed);
  if (digits.length < 7) return `${label} is too short to be a real number.`;
  if (digits.length > 15) return `${label} is too long — check for extra digits.`;
  if (/[^\d\s+()\-.]/.test(trimmed)) return `${label} contains characters that are not part of a phone number.`;
  return null;
}

/**
 * A number in the form WhatsApp's link format wants: digits only, no plus.
 *
 * Malawian hosts write their number every which way — `0991 23 45 67`,
 * `+265 991 234 567`, `265991234567`. A local number starting `0` is expanded
 * to the +265 country code, since wa.me refuses anything but an international
 * number and would otherwise open an empty chat.
 */
export function whatsappDigits(value: string): string | null {
  const digits = normalisePhone(value ?? '');
  if (!digits) return null;
  if (digits.startsWith('0')) return `265${digits.slice(1)}`;
  return digits;
}

/** `https://wa.me/...`, or null when there is no usable number. */
export function whatsappLink(value: string | undefined, message?: string): string | null {
  const digits = whatsappDigits(value ?? '');
  if (!digits || digits.length < 7) return null;
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
}

/** `tel:` href, keeping the plus so an international number dials correctly. */
export function telLink(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const digits = normalisePhone(trimmed);
  if (digits.length < 7) return null;
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

export function mailtoLink(value: string | undefined, subject?: string): string | null {
  const trimmed = (value ?? '').trim();
  if (!isEmail(trimmed)) return null;
  return `mailto:${trimmed}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
}

/** True when a property has at least one way of being reached. */
export function hasAnyContact(source: {
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
}): boolean {
  return !!(source.contactEmail?.trim() || source.contactPhone?.trim() || source.contactWhatsapp?.trim());
}
