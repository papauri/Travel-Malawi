import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Home, Mail, Send, ShieldCheck, ArrowRight } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COMMON_AMENITIES, MALAWI_LOCATIONS, PROPERTY_CATEGORIES } from '../lib/listing';
import { DEFAULT_PLATFORM_EMAIL, isEmail } from '../lib/contact';
import { CONTACT_ROLES, LISTING_REQUESTS_COLLECTION } from '../lib/listingRequests';

/**
 * "Request a listing": the owner sends the same details the listing wizard
 * asks for, and our team reviews them before anything is published. It is the
 * fallback for owners who want help; the form keeps pointing to the wizard so
 * hosts list (and stay in charge of) their own property where they can.
 */

const EMPTY = {
  propName: '',
  category: '',
  stayType: 'whole_house' as 'whole_house' | 'rooms',
  propLoc: '',
  address: '',
  mapLink: '',
  description: '',
  roomCount: '1',
  maxGuests: '',
  nightlyMwk: '',
  nightlyUsd: '',
  amenities: [] as string[],
  propertyPhone: '',
  propertyWhatsapp: '',
  propertyEmail: '',
  website: '',
  photosLink: '',
  contactName: '',
  contactRole: 'Owner',
  contactEmail: '',
  contactPhone: '',
  notes: '',
};

type FormState = typeof EMPTY;

const newRef = () => `ENQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export default function ListingRequestForm({ source }: { source: string }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [declared, setDeclared] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'declared', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  const whole = form.stayType === 'whole_house';
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));
  const toggleAmenity = (a: string) =>
    setForm(prev => ({ ...prev, amenities: prev.amenities.includes(a) ? prev.amenities.filter(x => x !== a) : [...prev.amenities, a] }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.propName.trim()) e.propName = 'Enter the name of the property.';
    if (!form.category) e.category = 'Choose the type of property.';
    if (!form.propLoc.trim()) e.propLoc = 'Enter the town or area.';
    if (!form.address.trim()) e.address = 'Enter the address or directions.';
    if (form.description.trim().length < 30) e.description = 'Describe the property in a sentence or two (30 characters or more).';
    if (!form.propertyPhone.trim() && !form.propertyWhatsapp.trim() && !form.propertyEmail.trim()) {
      e.propertyPhone = 'Add at least one way for travellers to contact the property.';
    }
    if (form.propertyEmail.trim() && !isEmail(form.propertyEmail)) e.propertyEmail = 'Check this email address.';
    if (!form.contactName.trim()) e.contactName = 'Enter your name.';
    if (!isEmail(form.contactEmail)) e.contactEmail = 'Enter a valid email address so we can reply.';
    if (!form.contactPhone.trim()) e.contactPhone = 'Enter a phone number we can reach you on.';
    if (!declared) e.declared = 'Tick the box to confirm before sending.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error('Please check the highlighted fields.');
      setTimeout(() => document.querySelector('[data-field-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setSubmitting(true);
    const declarationAt = new Date().toISOString();
    const payload = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])),
      contactEmail: form.contactEmail.trim().toLowerCase(),
      declarationAt,
      source,
    } as FormState & { declarationAt: string; source: string };

    // The server emails the team and returns the reference; the review copy is
    // kept in Firestore under that same reference.
    let ref: string | null = null;
    try {
      const res = await fetch('/api/host-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) ref = (await res.json())?.id || null;
    } catch (err) {
      console.warn('[ListingRequest] Team notification failed:', err);
    }
    const sentToTeam = !!ref;
    ref = ref || newRef();

    let saved = false;
    try {
      await setDoc(doc(db, LISTING_REQUESTS_COLLECTION, ref), {
        ...payload,
        ref,
        status: 'pending_review',
        createdAt: serverTimestamp(),
      });
      saved = true;
    } catch (err) {
      console.warn('[ListingRequest] Could not save the review copy:', err);
    }

    setSubmitting(false);
    if (!sentToTeam && !saved) {
      toast.error(`We could not send your request. Please try again, or email ${DEFAULT_PLATFORM_EMAIL}.`);
      return;
    }
    setDoneRef(ref);
    toast.success('Listing request received');
  };

  const err = (k: keyof typeof errors) =>
    errors[k] ? <p data-field-error="true" role="alert" className="mt-1 text-xs text-red-600">{errors[k]}</p> : null;
  const inputClass = (k: keyof typeof errors) => `tm-input ${errors[k] ? 'border-red-300' : ''}`;

  if (doneRef) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-stone-900 font-medium text-sm">
          <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
          <span>Zikomo. Your listing request has been received.</span>
        </div>
        <p className="text-sm text-stone-700">
          Reference <span className="font-mono font-semibold">{doneRef}</span>. Our team reviews every request before anything is published.
          We will email you at <strong className="text-stone-900 break-words">{form.contactEmail}</strong> once it has been reviewed, either with
          questions or with the next step to get <strong className="text-stone-900">{form.propName}</strong> listed.
        </p>
        <p className="text-xs text-stone-500">
          Nothing appears on Travel Malawi until the review is done and the listing is complete.
        </p>
        <div className="tm-actions pt-1">
          <a
            href={`mailto:${DEFAULT_PLATFORM_EMAIL}?subject=${encodeURIComponent(`Listing request: ${form.propName} (Ref: ${doneRef})`)}`}
            className="tm-btn tm-btn-secondary tm-btn-sm"
          >
            <Mail size={14} /> Send photos to {DEFAULT_PLATFORM_EMAIL}
          </a>
          <button
            type="button"
            onClick={() => { setForm(EMPTY); setDeclared(false); setErrors({}); setDoneRef(null); }}
            className="tm-btn tm-btn-quiet tm-btn-sm"
          >
            Request another property
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="p-3 rounded-lg bg-stone-100 border border-stone-200 text-xs sm:text-sm text-stone-700 leading-relaxed">
        <strong className="text-stone-900">Quickest way to get listed:</strong> create a free account and{' '}
        <Link to="/list-your-property" className="tm-link font-semibold">list the property yourself <ArrowRight size={12} className="inline" /></Link>.
        You stay in charge of your photos, prices and contact details. Prefer our team to look first? Fill in the form below; we review every
        request and get back to you by email.
      </div>

      {/* The establishment */}
      <fieldset className="space-y-4">
        <legend className="tm-h2 text-base mb-1">The property</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-name">Name of the property *</label>
            <input id="lr-name" type="text" maxLength={200} value={form.propName} onChange={set('propName')}
              placeholder="e.g. Lakeside Cottage" className={inputClass('propName')} />
            {err('propName')}
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-category">Type of property *</label>
            <select id="lr-category" value={form.category} onChange={set('category')} className={inputClass('category')}>
              <option value="">Choose one</option>
              {PROPERTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {err('category')}
          </div>
        </div>

        <div>
          <span className="tm-label">What travellers stay in</span>
          <div className="tm-actions">
            <button type="button" aria-pressed={whole} onClick={() => setForm(p => ({ ...p, stayType: 'whole_house' }))}
              className={`tm-btn tm-btn-sm ${whole ? 'tm-btn-primary' : 'tm-btn-secondary'}`}>
              <Home size={14} /> The whole place
            </button>
            <button type="button" aria-pressed={!whole} onClick={() => setForm(p => ({ ...p, stayType: 'rooms' }))}
              className={`tm-btn tm-btn-sm ${!whole ? 'tm-btn-primary' : 'tm-btn-secondary'}`}>
              Individual rooms
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-loc">Town or area *</label>
            <input id="lr-loc" type="text" list="lr-locations" maxLength={200} value={form.propLoc} onChange={set('propLoc')}
              placeholder="e.g. Cape Maclear, Mangochi" className={inputClass('propLoc')} />
            <datalist id="lr-locations">{MALAWI_LOCATIONS.map(l => <option key={l} value={l} />)}</datalist>
            {err('propLoc')}
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-map">Google Maps link <span className="font-normal text-stone-400">(optional)</span></label>
            <input id="lr-map" type="url" maxLength={500} value={form.mapLink} onChange={set('mapLink')}
              placeholder="https://maps.app.goo.gl/..." className="tm-input" />
          </div>
        </div>
        <div>
          <label className="tm-label" htmlFor="lr-address">Physical address or directions *</label>
          <input id="lr-address" type="text" maxLength={300} value={form.address} onChange={set('address')}
            placeholder="e.g. Plot 12, beach road, 2 km past the village market" className={inputClass('address')} />
          {err('address')}
        </div>
        <div>
          <label className="tm-label" htmlFor="lr-desc">Describe the property *</label>
          <textarea id="lr-desc" rows={4} maxLength={2000} value={form.description} onChange={set('description')}
            placeholder="What it is like, what is nearby, what makes it special"
            className={`${inputClass('description')} resize-y`} />
          {err('description')}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-rooms">{whole ? 'Bedrooms' : 'Rooms'}</label>
            <input id="lr-rooms" type="number" min="1" max="500" value={form.roomCount} onChange={set('roomCount')} className="tm-input" />
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-guests">Max guests</label>
            <input id="lr-guests" type="number" min="1" max="2000" value={form.maxGuests} onChange={set('maxGuests')} className="tm-input" />
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-mwk">From (MWK/night)</label>
            <input id="lr-mwk" type="text" inputMode="numeric" maxLength={20} value={form.nightlyMwk} onChange={set('nightlyMwk')}
              placeholder="85,000" className="tm-input" />
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-usd">From (USD/night)</label>
            <input id="lr-usd" type="text" inputMode="numeric" maxLength={20} value={form.nightlyUsd} onChange={set('nightlyUsd')}
              placeholder="60" className="tm-input" />
          </div>
        </div>

        <div>
          <span className="tm-label">Facilities</span>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_AMENITIES.map(a => {
              const on = form.amenities.includes(a);
              return (
                <button key={a} type="button" aria-pressed={on} onClick={() => toggleAmenity(a)}
                  className={`px-2.5 py-1 rounded-full border text-xs transition cursor-pointer ${on ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'}`}>
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="tm-label" htmlFor="lr-photos">Link to photos <span className="font-normal text-stone-400">(optional)</span></label>
          <input id="lr-photos" type="url" maxLength={500} value={form.photosLink} onChange={set('photosLink')}
            placeholder="Google Drive, Facebook page or website gallery" className="tm-input" />
          <p className="mt-1 text-xs text-stone-500">You can also email photos after sending this form.</p>
        </div>
      </fieldset>

      {/* Contact details shown to travellers */}
      <fieldset className="space-y-4 tm-divider pt-5">
        <legend className="tm-h2 text-base mb-1">How travellers contact the property</legend>
        <p className="text-xs text-stone-500 -mt-2">These go on the listing. At least one is needed.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-pphone">Phone</label>
            <input id="lr-pphone" type="tel" maxLength={40} value={form.propertyPhone} onChange={set('propertyPhone')}
              placeholder="+265 999 123 456" className={inputClass('propertyPhone')} />
            {err('propertyPhone')}
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-pwa">WhatsApp</label>
            <input id="lr-pwa" type="tel" maxLength={40} value={form.propertyWhatsapp} onChange={set('propertyWhatsapp')}
              placeholder="+265 888 123 456" className="tm-input" />
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-pemail">Email</label>
            <input id="lr-pemail" type="email" maxLength={254} value={form.propertyEmail} onChange={set('propertyEmail')}
              placeholder="stay@example.com" className={inputClass('propertyEmail')} />
            {err('propertyEmail')}
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-web">Website or social page</label>
            <input id="lr-web" type="url" maxLength={300} value={form.website} onChange={set('website')}
              placeholder="https://" className="tm-input" />
          </div>
        </div>
      </fieldset>

      {/* The person sending the request */}
      <fieldset className="space-y-4 tm-divider pt-5">
        <legend className="tm-h2 text-base mb-1">About you</legend>
        <p className="text-xs text-stone-500 -mt-2">For our team only, so we can reply. Not published.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-cname">Your name *</label>
            <input id="lr-cname" type="text" maxLength={120} value={form.contactName} onChange={set('contactName')}
              className={inputClass('contactName')} />
            {err('contactName')}
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-role">Your role *</label>
            <select id="lr-role" value={form.contactRole} onChange={set('contactRole')} className="tm-input">
              {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-cemail">Your email *</label>
            <input id="lr-cemail" type="email" maxLength={254} value={form.contactEmail} onChange={set('contactEmail')}
              className={inputClass('contactEmail')} />
            {err('contactEmail')}
          </div>
          <div className="min-w-0">
            <label className="tm-label" htmlFor="lr-cphone">Your phone *</label>
            <input id="lr-cphone" type="tel" maxLength={40} value={form.contactPhone} onChange={set('contactPhone')}
              className={inputClass('contactPhone')} />
            {err('contactPhone')}
          </div>
        </div>
        <div>
          <label className="tm-label" htmlFor="lr-notes">Anything else for our team <span className="font-normal text-stone-400">(optional)</span></label>
          <textarea id="lr-notes" rows={2} maxLength={2000} value={form.notes} onChange={set('notes')} className="tm-input resize-y" />
        </div>
      </fieldset>

      {/* Declaration */}
      <div className={`rounded-lg border p-3 ${errors.declared ? 'border-red-300 bg-red-50/40' : 'border-stone-200 bg-stone-50'}`}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={declared} onChange={e => { setDeclared(e.target.checked); if (e.target.checked) setErrors(p => ({ ...p, declared: undefined })); }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-stone-900" />
          <span className="text-xs sm:text-sm text-stone-700 leading-relaxed">
            I am the owner of this property or authorised to list it, and the details above are accurate. I understand our team reviews this
            request before anything is published, and I agree to the{' '}
            <Link to="/terms" target="_blank" className="font-semibold text-stone-900 underline">Terms of Service</Link>.
          </span>
        </label>
        {err('declared')}
      </div>

      <div className="tm-actions justify-between items-center">
        <span className="text-xs text-stone-500">We review every request and reply by email.</span>
        <button type="submit" disabled={submitting} className="tm-btn tm-btn-primary tm-btn-sm">
          <Send size={14} />
          {submitting ? 'Sending...' : 'Send listing request'}
        </button>
      </div>

      {/* Fine print: licensing is the owner's responsibility */}
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-stone-500">
        <ShieldCheck size={12} className="shrink-0 mt-0.5" />
        <span>
          Accommodation businesses in Malawi must hold the licences and permits the law requires of them, including a tourism operating
          licence from the Department of Tourism under Section 27 of the Tourism Act, 2025 where it applies, business and tax registration,
          and council, health and fire permits. Obtaining and keeping them is the owner's responsibility. Travel Malawi is an information
          directory: it does not issue, check or verify licences or permits, is not responsible for whether a property is licensed or meets
          legal, health or safety requirements, and a listing is not an approval or endorsement by Travel Malawi or the Ministry of Tourism.
          Sending this form does not guarantee a listing.
        </span>
      </p>
    </form>
  );
}
