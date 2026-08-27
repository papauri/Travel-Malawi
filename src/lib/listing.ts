/**
 * Everything the "list your property" flow needs, in one place.
 *
 * The listing form used to live inline in the manager dashboard: it wrote a
 * document with `categories: []`, no gallery, no opening hours and no check-in
 * times, and validated only that a name and a location were present. A property
 * created that way was invisible under every category filter on the home page,
 * and nothing told the host that a room still had to be added before it could
 * take a single booking.
 *
 * The rules here are shared by the wizard and the property editor so the two
 * cannot drift apart.
 */

import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { Hotel } from '../types';
import { defaultWeek } from './hours';
import { normalizeImageUrl } from './images';
import { emailProblem, phoneProblem } from './contact';

/**
 * The categories the home page filters on. Kept here rather than inline in the
 * filter row: a host who cannot pick from exactly this list ends up with a
 * listing no filter will ever match.
 */
export const PROPERTY_CATEGORIES = [
  'Lake & Beach',
  'Safari & Wildlife',
  'Romantic Escape',
  'Family',
  'Adventure',
  'Luxury',
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

/** A one-line hint per category, so the choice is not a guess. */
export const CATEGORY_HINTS: Record<PropertyCategory, string> = {
  'Lake & Beach': 'On or near the lakeshore — sand, water, sunsets.',
  'Safari & Wildlife': 'In or beside a park or reserve.',
  'Romantic Escape': 'Quiet, adults-first, made for two.',
  Family: 'Room to spread out, and happy to take children.',
  Adventure: 'A base for hiking, diving, climbing or paddling.',
  Luxury: 'Premium rooms, full service, higher rates.',
};

/** Offered as one-tap chips; a host can still type anything else. */
export const COMMON_AMENITIES = [
  'Free WiFi',
  'Breakfast included',
  'Swimming pool',
  'Restaurant',
  'Bar',
  'Air conditioning',
  'Hot water',
  'Backup power',
  'Secure parking',
  'Airport transfer',
  'Lake view',
  'Private beach',
  'Boat trips',
  'Spa',
  'Gym',
  'Conference room',
  'Laundry',
  'Room service',
  'Family rooms',
  'Pet friendly',
];

/** Common Malawian locations, offered as a datalist on the location field. */
export const MALAWI_LOCATIONS = [
  'Lilongwe',
  'Blantyre',
  'Mzuzu',
  'Zomba',
  'Salima',
  'Mangochi',
  'Cape Maclear',
  'Monkey Bay',
  'Nkhata Bay',
  'Likoma Island',
  'Senga Bay',
  'Nkhotakota',
  'Karonga',
  'Chintheche',
  'Liwonde',
  'Majete',
  'Nyika Plateau',
  'Mulanje',
  'Dedza',
  'Kasungu',
];

export interface ListingDraft {
  name: string;
  category: PropertyCategory | '';
  location: string;
  locationNotes: string;
  description: string;
  amenities: string[];
  imageUrl: string;
  galleryUrls: string[];
  coordinates: { lat: number; lng: number } | null;
  checkInTime: string;
  checkOutTime: string;
  /** How guests reach the property once they have booked — or before. */
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
}

export function emptyDraft(): ListingDraft {
  return {
    name: '',
    category: '',
    location: '',
    locationNotes: '',
    description: '',
    amenities: [],
    imageUrl: '',
    galleryUrls: [],
    coordinates: null,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    contactEmail: '',
    contactPhone: '',
    contactWhatsapp: '',
  };
}

export const NAME_MAX = 80;
export const DESCRIPTION_MIN = 60;
export const DESCRIPTION_MAX = 2000;

export type DraftErrors = Partial<Record<keyof ListingDraft, string>>;

/**
 * The fields each step owns. The wizard validates a step before it will
 * advance, so a problem is reported next to the field that caused it rather
 * than all at once at the end.
 */
export const STEP_FIELDS: (keyof ListingDraft)[][] = [
  ['name', 'category', 'location'],
  ['description', 'amenities'],
  ['imageUrl', 'galleryUrls'],
  ['contactEmail', 'contactPhone', 'contactWhatsapp', 'checkInTime', 'checkOutTime'],
  [],
];

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateDraft(draft: ListingDraft): DraftErrors {
  const errors: DraftErrors = {};

  const name = draft.name.trim();
  if (!name) errors.name = 'Give your property its name.';
  else if (name.length < 3) errors.name = 'That looks too short to be a name.';
  else if (name.length > NAME_MAX) errors.name = 'Keep the name under ' + NAME_MAX + ' characters.';

  if (!draft.category) errors.category = 'Pick the category guests would look under.';
  else if (!(PROPERTY_CATEGORIES as readonly string[]).includes(draft.category)) {
    errors.category = 'Pick one of the listed categories.';
  }

  const location = draft.location.trim();
  if (!location) errors.location = 'Where is it? A town or area is enough.';
  else if (location.length < 3) errors.location = 'Give a town, area or landmark.';

  const description = draft.description.trim();
  const short = DESCRIPTION_MIN - description.length;
  if (!description) errors.description = 'Tell guests what staying here is like.';
  else if (short > 0) {
    errors.description = 'A little more — ' + short + ' more character' + (short === 1 ? '' : 's') + ' to go.';
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = 'That is over the ' + DESCRIPTION_MAX + ' character limit.';
  }

  // A listing with no photo falls back to a grey placeholder in every grid on
  // the site, which serves the host worse than not being listed at all.
  if (!normalizeImageUrl(draft.imageUrl)) {
    errors.imageUrl = 'Add one main photo — it is the first thing guests see.';
  }

  if (!isTime(draft.checkInTime)) errors.checkInTime = 'Use a 24-hour time, e.g. 14:00.';
  if (!isTime(draft.checkOutTime)) errors.checkOutTime = 'Use a 24-hour time, e.g. 11:00.';

  // A booking request is only the start of a conversation: the property has to
  // be reachable for it to become a stay. Both are required for that reason;
  // WhatsApp is not, since most properties use one number for both.
  const email = emailProblem(draft.contactEmail, 'A booking email', true);
  if (email) errors.contactEmail = email;
  const phone = phoneProblem(draft.contactPhone, 'A phone number', true);
  if (phone) errors.contactPhone = phone;
  const whatsapp = phoneProblem(draft.contactWhatsapp, 'The WhatsApp number', false);
  if (whatsapp) errors.contactWhatsapp = whatsapp;

  return errors;
}

/** Only the errors belonging to one step of the wizard. */
export function errorsForStep(draft: ListingDraft, step: number): DraftErrors {
  const all = validateDraft(draft);
  const scoped: DraftErrors = {};
  for (const field of STEP_FIELDS[step] ?? []) {
    if (all[field]) scoped[field] = all[field];
  }
  return scoped;
}

export function isStepComplete(draft: ListingDraft, step: number): boolean {
  return Object.keys(errorsForStep(draft, step)).length === 0;
}

/**
 * True when this manager already has a listing under the same name.
 *
 * Submitting twice — a double click, or a back-then-forward — used to create a
 * second copy of the property, which then had to be moderated and deleted by
 * hand.
 */
export async function hasDuplicateListing(managerId: string, name: string): Promise<boolean> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return false;
  const snap = await getDocs(
    query(collection(db, 'hotels'), where('managerId', '==', managerId), limit(50))
  );
  return snap.docs.some(d => String(d.data().name ?? '').trim().toLowerCase() === wanted);
}

/** The document written to Firestore, with the defaults a listing needs. */
export function draftToHotel(draft: ListingDraft, managerId: string): Omit<Hotel, 'id'> {
  const amenities = [...new Set(draft.amenities.map(a => a.trim()).filter(Boolean))];
  const galleryUrls = [...new Set(draft.galleryUrls.map(url => url.trim()).filter(Boolean))];

  return {
    managerId,
    // Every new listing is moderated, and the security rules require this
    // exact value on create.
    status: 'pending',
    name: draft.name.trim(),
    description: draft.description.trim(),
    location: draft.location.trim(),
    locationNotes: draft.locationNotes.trim(),
    coordinates: draft.coordinates ?? undefined,
    imageUrl: draft.imageUrl.trim(),
    galleryUrls,
    amenities,
    // Was hard-coded to `[]`, which kept the listing out of every category filter.
    categories: draft.category ? [draft.category] : [],
    checkInTime: draft.checkInTime,
    checkOutTime: draft.checkOutTime,
    contactEmail: draft.contactEmail.trim(),
    contactPhone: draft.contactPhone.trim(),
    // Falls back to the phone number, so a property that uses one number for
    // both does not have to type it twice.
    contactWhatsapp: draft.contactWhatsapp.trim() || draft.contactPhone.trim(),
    // Starting points the host can change later, rather than absent fields
    // that show as "not published" on the property page.
    hours: defaultWeek(),
    chatEnabled: true,
    isOnline: true,
    createdAt: Date.now(),
  };
}

/** Creates the listing and returns its new id. */
export async function createListing(draft: ListingDraft, managerId: string): Promise<string> {
  const payload: Record<string, unknown> = { ...draftToHotel(draft, managerId) };
  // Firestore rejects `undefined`; coordinates are the only optional object.
  if (payload.coordinates === undefined) delete payload.coordinates;
  const ref = await addDoc(collection(db, 'hotels'), payload);
  return ref.id;
}
