/**
 * Listing requests and host emails.
 *
 * A listing request is what a property owner sends from the "Request a
 * listing" form when they would rather our team looked at their property
 * first. It carries the same details the listing wizard asks for, is never
 * published, and is reviewed in Admin > Hosts. Every email the team sends a
 * host from the app (to a requester or to a listed property) is kept in
 * `host_messages`, drafts included.
 */

import { DEFAULT_PLATFORM_DOMAIN } from './contact';

export const LISTING_REQUESTS_COLLECTION = 'host_onboarding_submissions';
export const HOST_MESSAGES_COLLECTION = 'host_messages';

export type ListingRequestStatus = 'pending_review' | 'needs_info' | 'approved' | 'declined' | 'archived';

export const LISTING_REQUEST_STATUSES: { id: ListingRequestStatus; label: string }[] = [
  { id: 'pending_review', label: 'New' },
  { id: 'needs_info', label: 'Waiting on host' },
  { id: 'approved', label: 'Invited to list' },
  { id: 'declined', label: 'Declined' },
  { id: 'archived', label: 'Archived' },
];

export const CONTACT_ROLES = ['Owner', 'Manager', 'Authorised agent'] as const;

export interface ListingRequest {
  id: string;
  ref?: string;
  status: ListingRequestStatus;
  propName: string;
  category?: string;
  stayType?: 'whole_house' | 'rooms';
  propLoc?: string;
  address?: string;
  mapLink?: string;
  description?: string;
  roomCount?: string;
  maxGuests?: string;
  nightlyMwk?: string;
  nightlyUsd?: string;
  amenities?: string[];
  propertyPhone?: string;
  propertyWhatsapp?: string;
  propertyEmail?: string;
  website?: string;
  photosLink?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail: string;
  contactPhone?: string;
  notes?: string;
  declarationAt?: string;
  source?: string;
  createdAt?: any;
  // Team only
  adminNotes?: string;
  updatedAt?: number;
  reviewedBy?: string;
  lastEmailAt?: number;
}

export interface HostMessage {
  id: string;
  to: string;
  toName?: string;
  subject: string;
  body: string;
  status: 'sent' | 'draft' | 'failed';
  template?: string;
  requestId?: string;
  hotelId?: string;
  hotelName?: string;
  error?: string;
  createdAt: number;
  sentAt?: number;
  createdBy?: string;
  createdByEmail?: string;
}

/** Firestore timestamps, epoch millis or ISO strings, as millis (0 when unknown). */
export function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

/** What a request still lacks before the property could go live, in plain words. */
export function missingItems(r: Partial<ListingRequest>): string[] {
  const missing: string[] = [];
  if (!r.category) missing.push('the type of property (lodge, guest house, cottage...)');
  if (!r.address?.trim()) missing.push('the physical address or directions to the property');
  if (!r.description || r.description.trim().length < 60) missing.push('a short description of the property and what is nearby');
  if (!r.photosLink?.trim()) missing.push('a few clear photos (bedroom, bathroom, outside, view)');
  if (!r.propertyPhone?.trim() && !r.propertyWhatsapp?.trim() && !r.propertyEmail?.trim()) {
    missing.push('a phone number, WhatsApp number or email travellers can use to contact the property');
  }
  if (!r.nightlyMwk?.trim() && !r.nightlyUsd?.trim()) missing.push('a "from" price per night in MWK and/or USD');
  return missing;
}

export type TemplateId = 'received' | 'more_info' | 'invite' | 'declined' | 'listing_update' | 'photos' | 'blank';

export const REQUEST_TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: 'received', label: 'Received, under review' },
  { id: 'more_info', label: 'Need more information' },
  { id: 'invite', label: 'Confirm: finish your listing' },
  { id: 'declined', label: 'Not able to list' },
];

export const HOST_TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: 'blank', label: 'Blank message' },
  { id: 'listing_update', label: 'Please update your listing' },
  { id: 'photos', label: 'Photos needed' },
];

const SITE = `https://${DEFAULT_PLATFORM_DOMAIN}`;

const LICENSING_LINE =
  'A reminder that the property must hold the licences and permits Malawian law requires, including a tourism operating licence under the Tourism Act, 2025 where it applies. Travel Malawi is an information directory: we do not issue or verify licences, and a listing is not an approval or endorsement by Travel Malawi or the Ministry of Tourism.';

interface TemplateContext {
  name?: string;
  propName?: string;
  ref?: string;
  missing?: string[];
}

/** A ready-to-edit subject and body for a template. Plain text; the server wraps it in the branded email. */
export function buildTemplate(id: TemplateId, ctx: TemplateContext): { subject: string; body: string } {
  const hello = `Muli bwanji ${ctx.name?.trim() || 'there'},`;
  const prop = ctx.propName?.trim() || 'your property';
  const ref = ctx.ref ? ` (ref ${ctx.ref})` : '';
  const sign = '\n\nZikomo,\nThe Travel Malawi team';
  switch (id) {
    case 'received':
      return {
        subject: `We received your listing request for ${prop}${ref}`,
        body: `${hello}\n\nThank you for telling us about ${prop}. Your listing request${ref} has reached our team and is now being reviewed. Nothing is published until that review is done.\n\nWe will email you once we have been through the details, either with a few questions or with the next step to get ${prop} listed.\n\nIf you would like to move faster, you can create a free account and list the property yourself at ${SITE}/list-your-property.${sign}`,
      };
    case 'more_info': {
      const items = (ctx.missing && ctx.missing.length ? ctx.missing : ['(add what you need here)'])
        .map(m => `- ${m}`).join('\n');
      return {
        subject: `A few more details for ${prop}${ref}`,
        body: `${hello}\n\nThank you for your listing request for ${prop}. Before we can take it further we need a little more information:\n\n${items}\n\nYou can reply to this email with the details (photos can be attached or shared as a link).${sign}`,
      };
    }
    case 'invite':
      return {
        subject: `Next step: list ${prop} on Travel Malawi`,
        body: `${hello}\n\nGood news: we have reviewed your request${ref} and ${prop} is a good fit for Travel Malawi.\n\nThe next step is for you to create your free account and complete the listing yourself, so you stay in control of your details, photos and prices:\n\n1. Go to ${SITE}/list-your-property\n2. Sign up with this email address\n3. Add your photos, rooms, "from" prices and the contact details travellers should use\n4. Submit the listing; our team checks it before it goes live\n\nThere is no commission and no listing fee. Travellers contact you directly.\n\n${LICENSING_LINE}${sign}`,
      };
    case 'declined':
      return {
        subject: `About your listing request for ${prop}`,
        body: `${hello}\n\nThank you for your interest in listing ${prop} on Travel Malawi. After reviewing your request${ref}, we are not able to list the property at this time.\n\n(Add the reason here, if you want to share it.)\n\nYou are welcome to get in touch again if anything changes.${sign}`,
      };
    case 'listing_update':
      return {
        subject: `Please check your listing for ${prop}`,
        body: `${hello}\n\nWe are reviewing the listings on Travel Malawi and would like you to check the details for ${prop}, so travellers see accurate information:\n\n- photos\n- "from" prices\n- the phone, WhatsApp or email travellers should use\n\nYou can update everything from your dashboard at ${SITE}/dashboard.${sign}`,
      };
    case 'photos':
      return {
        subject: `Photos for ${prop}`,
        body: `${hello}\n\nListings with clear photos get far more interest from travellers. Could you add a few to ${prop}? Good ones to start with: a bedroom, a bathroom, the outside of the property and the view.\n\nYou can upload them from your dashboard at ${SITE}/dashboard, or reply to this email with the photos attached.${sign}`,
      };
    case 'blank':
    default:
      return { subject: '', body: `${hello}\n\n${sign.trimStart()}` };
  }
}
