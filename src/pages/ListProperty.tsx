/**
 * "List your property", end to end.
 *
 * What used to happen: every host entry point pointed at `/dashboard`, which
 * redirects anyone without the `hotel_manager` role straight back to the home
 * page. A signed-out visitor, and a signed-in one who had joined to book a
 * stay, both clicked "List your property" and simply landed back where they
 * started with nothing said. Anyone who did get through met a four-field form
 * that wrote a listing with no category, no gallery and no hours, and then
 * dropped them on a dashboard that did not mention the rooms a listing needs
 * before it can take a booking.
 *
 * This page owns the whole path instead: sign in or create an account, add the
 * host role to an existing account, fill in the listing over five reviewable
 * steps, and land on the room editor for the property that was just created.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ChevronRight, Clock,
  Images, Loader2, LocateFixed, Mail, MapPin, MessageCircle, Phone, Plus, Send,
  Sparkles, Wallet, X,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isHotelManager } from '../lib/roles';
import ImageUpload from '../components/ImageUpload';
import GalleryUpload from '../components/GalleryUpload';
import SmartImage from '../components/SmartImage';
import FieldError from '../components/FieldError';
import LocationPicker from '../components/LocationPicker';
import { DECORATIVE_IMAGE, getHotelImage } from '../lib/images';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  CATEGORY_HINTS, COMMON_AMENITIES, DESCRIPTION_MAX, DESCRIPTION_MIN, ListingDraft,
  MALAWI_LOCATIONS, NAME_MAX, PROPERTY_CATEGORIES, PropertyCategory, createListing,
  emptyDraft, errorsForStep, hasDuplicateListing, isStepComplete, validateDraft,
} from '../lib/listing';

const DRAFT_KEY = 'listingDraft';

const STEPS = [
  { title: 'The basics', blurb: 'What it is called, and where it is.' },
  { title: 'The place', blurb: 'What a guest should know before booking.' },
  { title: 'Photographs', blurb: 'The pictures that do the selling.' },
  { title: 'Rooms & Rates', blurb: 'What guests will actually book.' },
  { title: 'Reaching you', blurb: 'How guests get hold of you, and your hours.' },
  { title: 'Plan & Pricing', blurb: 'Provisioning options.' },
  { title: 'Check it over', blurb: 'One last look before it goes for review.' },
];

/** Every step that carries fields — used to find the first one still wrong. */
const FIELD_STEPS = [0, 1, 2, 3, 4];

/** Survives the round trip through a Google sign-in popup. */
function readDraft(): ListingDraft {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) return { ...emptyDraft(), ...JSON.parse(stored) };
  } catch {
    // A corrupt draft is not worth reporting; start clean.
  }
  return emptyDraft();
}

const fieldClass =
  'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-stone-900 outline-none ' +
  'transition placeholder:text-stone-400 focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5';

const labelClass = 'block text-xs font-bold uppercase tracking-[0.14em] text-stone-500 mb-2';

export default function ListProperty() {
  const { user, loading: authLoading, becomeHost } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<ListingDraft>(readDraft);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [amenityInput, setAmenityInput] = useState('');
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [checkingPremium, setCheckingPremium] = useState(true);

  const isHost = isHotelManager(user);

  useEffect(() => {
    const fetchPremiumStatus = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'settings'));
        if (snap.exists() && snap.data().premiumListingsEnabled) {
          setPremiumEnabled(true);
        }
      } catch (err) {
        console.warn('Could not fetch premium settings', err);
      } finally {
        setCheckingPremium(false);
      }
    };
    fetchPremiumStatus();
  }, []);

  // Nothing typed is lost to a sign-in, a refresh, or a mis-click on Back.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Private browsing; the draft simply will not persist.
    }
  }, [draft]);

  const set = useCallback(<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  }, []);

  const stepErrors = useMemo(() => errorsForStep(draft, step), [draft, step]);
  const allErrors = useMemo(() => validateDraft(draft), [draft]);
  const visible = showErrors ? stepErrors : {};

  const goNext = () => {
    if (!isStepComplete(draft, step)) {
      setShowErrors(true);
      setTimeout(() => document.querySelector('p[role="alert"].text-red-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setShowErrors(false);
    setStep(s => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setShowErrors(false);
    setStep(s => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAmenity = (amenity: string) => {
    const has = draft.amenities.includes(amenity);
    set('amenities', has ? draft.amenities.filter(a => a !== amenity) : [...draft.amenities, amenity]);
  };

  const addTypedAmenity = () => {
    const value = amenityInput.trim();
    if (!value) return;
    if (!draft.amenities.some(a => a.toLowerCase() === value.toLowerCase())) {
      set('amenities', [...draft.amenities, value]);
    }
    setAmenityInput('');
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Your browser will not share a location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        
        toast.success('Pin dropped at your current position.', { id: 'geo' });
        set('coordinates', { lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => toast.error('Could not read your location. Check browser permissions.', { id: 'geo' })
    );
  };

  const handleEnableHosting = async () => {
    setEnabling(true);
    try {
      await becomeHost();
      toast.success('Hosting is on. Let us get your property up.');
    } catch (error: any) {
      console.error('Could not enable hosting:', error);
      toast.error(error?.message ?? 'Could not switch your account to hosting.');
    } finally {
      setEnabling(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      openAuth('host');
      return;
    }
    // The final guard is the whole draft, not just this step: a host can jump
    // back and empty a field they already passed.
    if (Object.keys(allErrors).length > 0) {
      const firstBadStep = FIELD_STEPS.find(s => !isStepComplete(draft, s)) ?? 0;
      setStep(firstBadStep);
      setShowErrors(true);
      toast.error('Something above still needs filling in.');
        setTimeout(() => document.querySelector('p[role="alert"].text-red-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
    }

    setSubmitting(true);
    try {
      // Guards against a double submit creating two copies of the property,
      // which then had to be moderated and deleted by hand.
      if (await hasDuplicateListing(user.uid, draft.name)) {
        toast.error('You already have a property listed under that name.');
        setStep(0);
        setShowErrors(true);
      setTimeout(() => document.querySelector('p[role="alert"].text-red-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
      }

      const id = await createListing(draft, user.uid);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to do; the draft is replaced on the next listing anyway.
      }
      setDraft(emptyDraft());
      toast.success('Submitted for review. Now add a room so it can take bookings.', { duration: 6000 });
      // A listing with no room cannot take a single booking, so the room
      // editor — not the dashboard — is where this ends.
      navigate(`/dashboard/hotel/${id}?tab=rooms`);
    } catch (error: any) {
      console.error('Could not create listing:', error);
      toast.error(
        error?.code === 'permission-denied'
          ? 'Your account is not allowed to publish listings yet.'
          : 'Could not submit the property. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-stone-400" />
      </div>
    );
  }

  // ---- Gate: no account, or an account that does not host yet ----
  if (!user || !isHost) {
    return <HostIntro user={user} enabling={enabling} onEnable={handleEnableHosting} onSignUp={() => openAuth('host')} />;
  }

  // ---- The wizard ----
  return (
    <div className="bg-stone-50">
      <div className="mx-auto w-full max-w-5xl px-6 lg:px-8 py-14">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 transition hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to your dashboard
        </button>

        <header className="mb-10">
          <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-emerald-700">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="font-serif text-4xl tracking-tight text-stone-900 md:text-5xl">{STEPS[step].title}</h1>
          <p className="mt-3 text-lg text-stone-500">{STEPS[step].blurb}</p>
        </header>

        {/* Progress. Each completed step stays clickable so a host can go back
            and correct something without losing the rest. */}
        <ol className="mb-10 grid grid-cols-5 gap-2">
          {STEPS.map((s, index) => {
            const done = index < step && isStepComplete(draft, index);
            const active = index === step;
            const reachable = index <= step || FIELD_STEPS.slice(0, index).every(i => isStepComplete(draft, i));
            return (
              <li key={s.title}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => { if (reachable) { setShowErrors(false); setStep(index); } }}
                  className="w-full text-left disabled:cursor-not-allowed"
                >
                  <span
                    className={`block h-1.5 rounded-full transition ${
                      active ? 'bg-stone-900' : done ? 'bg-emerald-500' : 'bg-stone-200'
                    }`}
                  />
                  <span
                    className={`mt-2 hidden text-xs font-semibold sm:block ${
                      active ? 'text-stone-900' : done ? 'text-emerald-700' : 'text-stone-400'
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm md:p-10">
          {step === 0 && (
            <div className="space-y-8">
              <div>
                <label className={labelClass} htmlFor="listing-name">Property name</label>
                <input
                  id="listing-name"
                  type="text"
                  maxLength={NAME_MAX}
                  value={draft.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Nkhata Bay Beach Lodge or Central Guest House"
                  className={fieldClass}
                />
                <p className="mt-2 text-xs text-stone-400">
                  This is fixed once the listing is created — an admin can change it later if you need.
                </p>
                <FieldError message={visible.name} />
              </div>

              <div>
                <span className={labelClass}>Which category fits best?</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PROPERTY_CATEGORIES.map(category => {
                    const selected = draft.category === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => set('category', category as PropertyCategory)}
                        className={`relative rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-stone-50 hover:border-stone-400'
                        }`}
                      >
                        <span className="block text-sm font-bold">{category}</span>
                        <span className={`mt-1 block text-xs ${selected ? 'text-white/70' : 'text-stone-500'}`}>
                          {CATEGORY_HINTS[category]}
                        </span>
                        {selected && <Check className="absolute right-4 top-4 h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  Guests filter by this on the home page, so a listing without one is much harder to find.
                </p>
                <FieldError message={visible.category} />
              </div>

              <div>
                <label className={labelClass} htmlFor="listing-location">Town or area</label>
                <input
                  id="listing-location"
                  type="text"
                  list="malawi-locations"
                  value={draft.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="e.g. Cape Maclear"
                  className={fieldClass}
                />
                <datalist id="malawi-locations">
                  {MALAWI_LOCATIONS.map(location => <option key={location} value={location} />)}
                </datalist>
                <FieldError message={visible.location} />
              </div>

              <div>
                <label className={labelClass} htmlFor="listing-notes">Finding the place <span className="font-medium normal-case tracking-normal text-stone-400">(optional)</span></label>
                <textarea
                  id="listing-notes"
                  rows={2}
                  value={draft.locationNotes}
                  onChange={e => set('locationNotes', e.target.value)}
                  placeholder="Turn off the M5 at the mission, 400 m of dirt road, gate on the left."
                  className={fieldClass}
                />
              </div>

              <div>
                <LocationPicker
                  value={draft.coordinates}
                  onChange={coords => set('coordinates', coords)}
                  locationText={draft.location || draft.name}
                  label="Search & Pin Exact Location"
                  onLocationSelect={info => {
                    if (info.location && !draft.location) {
                      set('location', info.location);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8">
              <div>
                <label className={labelClass} htmlFor="listing-description">Describe the stay</label>
                <textarea
                  id="listing-description"
                  rows={7}
                  maxLength={DESCRIPTION_MAX}
                  value={draft.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Ten chalets under the fig trees, right on the sand. Breakfast on the deck, boats to the island at nine, and the fire lit every evening."
                  className={fieldClass}
                />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-stone-400">
                    What is the view, the food, the walk to the water? Skip the sales talk.
                  </span>
                  <span className={draft.description.trim().length < DESCRIPTION_MIN ? 'text-stone-400' : 'text-emerald-600'}>
                    {draft.description.trim().length} / {DESCRIPTION_MAX}
                  </span>
                </div>
                <FieldError message={visible.description} />
              </div>

              <div>
                <span className={labelClass}>What is on offer?</span>
                <div className="flex flex-wrap gap-2">
                  {COMMON_AMENITIES.map(amenity => {
                    const selected = draft.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleAmenity(amenity)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          selected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                        }`}
                      >
                        {amenity}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={amenityInput}
                    onChange={e => setAmenityInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTypedAmenity();
                      }
                    }}
                    placeholder="Anything else — kayaks, curio shop, chapel…"
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={addTypedAmenity}
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>

                {draft.amenities.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {draft.amenities.map(amenity => (
                      <span
                        key={amenity}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"
                      >
                        {amenity}
                        <button
                          type="button"
                          aria-label={`Remove ${amenity}`}
                          onClick={() => toggleAmenity(amenity)}
                          className="text-emerald-600 transition hover:text-emerald-900"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <ImageUpload
                label="Property Cover Photo"
                hint="Choose an impressive exterior or best-view shot."
                tooltip="Guest View: This image appears as the large hero banner spanning the top of your property page, and serves as the main thumbnail in search results."
                value={draft.imageUrl}
                onChange={url => set('imageUrl', url)}
                folder={`hotels/${draft.id}`}
              />
              <FieldError message={visible.imageUrl} />

              <div className="border-t border-stone-100 pt-8">
                <GalleryUpload
                  label="Property Gallery"
                  hint="Include common areas and surroundings. Do NOT put specific room photos here."
                  tooltip="Guest View: These appear in the photo grid/carousel at the top of your property page, just below the cover photo."
                  value={draft.galleryUrls}
                  onChange={urls => set('galleryUrls', urls)}
                  folder={`hotels/${draft.id}/gallery`}
                />
                <p className="mt-2 text-xs text-stone-400">
                  Rooms, the view, the food, the bathroom. Six or more is where bookings start.
                </p>
              </div>

            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
                <h3 className="text-lg font-serif font-bold text-stone-900 mb-2">What will guests book?</h3>
                <p className="text-sm text-stone-600 mb-6">
                  Add at least one room type (e.g. "Standard Double", "Lakeview Chalet").
                  You can always add more later from your dashboard.
                </p>

                {(draft.rooms || []).length > 0 && (
                  <div className="space-y-4 mb-6">
                    {(draft.rooms || []).map((room, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-stone-200 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-4">
                          {room.imageUrl ? (
                            <img src={room.imageUrl} className="w-16 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-16 h-12 bg-stone-100 rounded-lg flex items-center justify-center">
                              <span className="text-[10px] text-stone-400">No photo</span>
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-stone-900">{room.name}</h4>
                            <p className="text-xs text-stone-500">
                              {room.currencies?.[0]} {room.prices?.[room.currencies?.[0] || 'USD']} / night
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...(draft.rooms || [])];
                            updated.splice(idx, 1);
                            set('rooms', updated);
                          }}
                          className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    set('rooms', [...(draft.rooms || []), {
                      name: '',
                      description: '',
                      currencies: ['USD'],
                      prices: { USD: 0 },
                      maxGuests: 2,
                      quantity: 1,
                      imageUrl: '',
                      galleryUrls: [],
                    }]);
                  }}
                  className="w-full py-4 border-2 border-dashed border-stone-300 rounded-xl text-stone-600 font-semibold hover:border-stone-400 hover:bg-stone-100 transition"
                >
                  + Add a room type
                </button>
              </div>

              {(draft.rooms || []).map((room, idx) => (
                <div key={idx} className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm relative space-y-6">
                  <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl uppercase tracking-widest">
                    Room Type {idx + 1}
                  </div>
                  
                  <div>
                    <label className={labelClass}>Room Name</label>
                    <input
                      type="text"
                      value={room.name || ''}
                      onChange={e => {
                        const updated = [...(draft.rooms || [])];
                        updated[idx].name = e.target.value;
                        set('rooms', updated);
                      }}
                      className={fieldClass}
                      placeholder="e.g. Standard Double Room"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                      value={room.description || ''}
                      onChange={e => {
                        const updated = [...(draft.rooms || [])];
                        updated[idx].description = e.target.value;
                        set('rooms', updated);
                      }}
                      className={fieldClass}
                      rows={2}
                      placeholder="What makes this room special?"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Nightly Price (USD)</label>
                      <input
                        type="number"
                        value={room.prices?.USD || ''}
                        onChange={e => {
                          const updated = [...(draft.rooms || [])];
                          updated[idx].prices = { ...updated[idx].prices, USD: Number(e.target.value) };
                          set('rooms', updated);
                        }}
                        className={fieldClass}
                        min="0"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Quantity</label>
                      <input
                        type="number"
                        value={room.quantity || ''}
                        onChange={e => {
                          const updated = [...(draft.rooms || [])];
                          updated[idx].quantity = Number(e.target.value);
                          set('rooms', updated);
                        }}
                        className={fieldClass}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Max Guests</label>
                      <input
                        type="number"
                        value={room.maxGuests || ''}
                        onChange={e => {
                          const updated = [...(draft.rooms || [])];
                          updated[idx].maxGuests = Number(e.target.value);
                          set('rooms', updated);
                        }}
                        className={fieldClass}
                        min="1"
                        max="30"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100">
                    <ImageUpload
                      label="Room Cover Photo"
                      hint="Make it a well-lit, wide shot of the bed and room."
                      tooltip="Guest View: This image appears as the primary thumbnail for this room type in the booking list on your property page."
                      value={room.imageUrl || ''}
                      onChange={url => {
                        const updated = [...(draft.rooms || [])];
                        updated[idx].imageUrl = url;
                        set('rooms', updated);
                      }}
                      folder={`hotels/${draft.id}/rooms`}
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-stone-100">
                    <GalleryUpload
                      label="Room Gallery"
                      hint="Add photos of the en-suite bathroom, the view from this room, and specific room amenities."
                      tooltip="Guest View: These photos form the image carousel when a guest clicks to view more details about this specific room type."
                      value={room.galleryUrls || []}
                      onChange={urls => {
                        const updated = [...(draft.rooms || [])];
                        updated[idx].galleryUrls = urls;
                        set('rooms', updated);
                      }}
                      folder={`hotels/${draft.id}/rooms`}
                    />
                  </div>
                </div>
              ))}

              <FieldError message={visible.rooms} />
            </div>
          )}

{step === 4 && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                <p className="text-sm leading-relaxed text-emerald-900">
                  Guests see these on your listing, and a booking request quotes them back so
                  nobody has to hunt for a number when they are already on the road.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="listing-email">Booking email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    id="listing-email"
                    type="email"
                    autoComplete="email"
                    value={draft.contactEmail}
                    onChange={e => set('contactEmail', e.target.value)}
                    placeholder="reservations@yourproperty.mw"
                    className={`${fieldClass} pl-11`}
                  />
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  Where booking requests should reach you. It can differ from your sign-in address.
                </p>
                <FieldError message={visible.contactEmail} />
              </div>

              <div>
                <label className={labelClass} htmlFor="listing-phone">Phone number</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    id="listing-phone"
                    type="tel"
                    autoComplete="tel"
                    value={draft.contactPhone}
                    onChange={e => set('contactPhone', e.target.value)}
                    placeholder="+265 991 234 567"
                    className={`${fieldClass} pl-11`}
                  />
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  Include the country code so guests abroad can dial it.
                </p>
                <FieldError message={visible.contactPhone} />
              </div>

              <div>
                <label className={labelClass} htmlFor="listing-whatsapp">
                  WhatsApp <span className="font-medium normal-case tracking-normal text-stone-400">(optional)</span>
                </label>
                <div className="relative">
                  <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    id="listing-whatsapp"
                    type="tel"
                    value={draft.contactWhatsapp}
                    onChange={e => set('contactWhatsapp', e.target.value)}
                    placeholder="Same as the phone number"
                    className={`${fieldClass} pl-11`}
                  />
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  Leave it blank if it is the same number — we will use the phone number above.
                </p>
                <FieldError message={visible.contactWhatsapp} />
              </div>

              <div className="grid gap-6 border-t border-stone-100 pt-8 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="listing-checkin">Check-in from</label>
                  <input
                    id="listing-checkin"
                    type="time"
                    value={draft.checkInTime}
                    onChange={e => set('checkInTime', e.target.value)}
                    className={fieldClass}
                  />
                  <FieldError message={visible.checkInTime} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="listing-checkout">Check-out until</label>
                  <input
                    id="listing-checkout"
                    type="time"
                    value={draft.checkOutTime}
                    onChange={e => set('checkOutTime', e.target.value)}
                    className={fieldClass}
                  />
                  <FieldError message={visible.checkOutTime} />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              {checkingPremium ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-stone-300" />
                </div>
              ) : premiumEnabled ? (
                <div className="rounded-2xl border border-stone-200 p-8 text-center bg-white shadow-sm">
                  <Sparkles className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                  <h3 className="font-serif text-2xl text-stone-900 mb-2">Choose a Premium Plan</h3>
                  <p className="text-stone-600 mb-6">Unlock powerful features to get more bookings.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div className="rounded-xl border border-stone-200 p-6">
                      <h4 className="font-bold text-stone-900">Basic</h4>
                      <p className="text-sm text-stone-500 mt-1 mb-4">Perfect for getting started.</p>
                      <p className="text-2xl font-bold text-stone-900 mb-6">Free</p>
                      <button className="w-full rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800">
                        Selected
                      </button>
                    </div>
                    <div className="rounded-xl border-2 border-blue-500 bg-blue-50/30 p-6 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Recommended
                      </div>
                      <h4 className="font-bold text-stone-900">Premium</h4>
                      <p className="text-sm text-stone-500 mt-1 mb-4">Maximum visibility and tools.</p>
                      <p className="text-2xl font-bold text-stone-900 mb-6">$49<span className="text-sm text-stone-500 font-normal">/mo</span></p>
                      <button className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                        Upgrade
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
                    <BadgeCheck className="h-8 w-8" />
                  </div>
                  <h3 className="font-serif text-2xl text-stone-900 mb-2">Listing is Free During Beta!</h3>
                  <p className="text-stone-600 max-w-md mx-auto">
                    Currently, there are no fees for listing your property. You get full access to all features at zero cost. Enjoy!
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-8">
              <div className="overflow-hidden rounded-2xl border border-stone-200">
                <div className="relative h-64 bg-stone-100">
                  <SmartImage
                    src={getHotelImage({ name: draft.name, imageUrl: draft.imageUrl, galleryUrls: draft.galleryUrls })}
                    alt={draft.name || 'Your property'}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-stone-900">
                    {draft.category || 'Uncategorised'}
                  </span>
                </div>
                <div className="p-6">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-stone-500">{draft.location}</p>
                  <h2 className="mt-1 font-serif text-3xl text-stone-900">{draft.name}</h2>
                  <p className="mt-4 whitespace-pre-line text-stone-600">{draft.description}</p>

                  {draft.amenities.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {draft.amenities.map(amenity => (
                        <span key={amenity} className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}

                  <dl className="mt-6 grid gap-4 border-t border-stone-100 pt-6 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-stone-400">Check-in</dt>
                      <dd className="text-stone-900">From {draft.checkInTime}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-400">Check-out</dt>
                      <dd className="text-stone-900">Until {draft.checkOutTime}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-400">Photographs</dt>
                      <dd className="text-stone-900">{1 + draft.galleryUrls.length}</dd>
                    </div>
                  </dl>

                  <dl className="mt-4 grid gap-4 border-t border-stone-100 pt-6 text-sm sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="font-semibold text-stone-400">Email</dt>
                      <dd className="truncate text-stone-900">{draft.contactEmail}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-400">Phone</dt>
                      <dd className="text-stone-900">{draft.contactPhone}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-400">WhatsApp</dt>
                      <dd className="text-stone-900">
                        {draft.contactWhatsapp.trim() || `${draft.contactPhone} (same)`}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="flex items-center gap-2 font-bold text-amber-900">
                  <Clock className="h-4 w-4" /> What happens next
                </p>
                <ol className="mt-3 space-y-2 text-sm text-amber-900/90">
                  <li>1. You add at least one room type, with its rate and how many you have.</li>
                  <li>2. Our team checks the listing — usually within a day.</li>
                  <li>3. It appears in search, and booking requests come to your dashboard.</li>
                </ol>
              </div>

              {Object.keys(allErrors).length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                  <p className="font-bold">Not quite ready to send:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {Object.values(allErrors).map(message => <li key={message}>{message}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-stone-500 transition hover:text-stone-900 disabled:opacity-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Sending…' : 'Submit for review'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const SELLING_POINTS = [
  {
    icon: Wallet,
    title: 'You keep the rate you set',
    body: 'No commission taken off the top, no listing fee, no monthly charge. Guests pay you at the property, in kwacha or dollars.',
  },
  {
    icon: MessageCircle,
    title: 'Guests reach you directly',
    body: 'Requests land in your dashboard and confirmations go out over WhatsApp. No call centre in between.',
  },
  {
    icon: BadgeCheck,
    title: 'Checked before it goes live',
    body: 'Every listing is reviewed by our team, so the properties on Travel Malawi are ones guests can trust.',
  },
];

/**
 * The gate. Same page for a signed-out visitor and for someone signed in who
 * has not hosted before — only the button at the end differs, because those
 * are two different problems: no account at all, versus an account without the
 * host role.
 */
function HostIntro({
  user, enabling, onEnable, onSignUp,
}: {
  user: unknown;
  enabling: boolean;
  onEnable: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-stone-950 text-white">
        <div className="absolute inset-0 opacity-30">
          <SmartImage src={DECORATIVE_IMAGE} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/85 to-stone-950/45" />

        <div className="relative mx-auto w-full max-w-6xl px-6 py-24 lg:px-8 lg:py-32">
          <p className="mb-6 text-[0.7rem] font-bold uppercase tracking-[0.26em] text-emerald-200/70">
            For Malawian hosts
          </p>
          <h1 className="max-w-3xl font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.03em]">
            Your property. Your rates.
            <br />
            Your guests.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Put your property in front of travellers looking for the real Malawi — and let them book it
            without an agency taking a cut.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            {user ? (
              <button
                onClick={onEnable}
                disabled={enabling}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-stone-900 transition hover:bg-stone-100 disabled:opacity-60"
              >
                {enabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {enabling ? 'Setting you up…' : 'Start hosting on this account'}
              </button>
            ) : (
              <button
                onClick={onSignUp}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-stone-900 transition hover:bg-stone-100"
              >
                <Sparkles className="h-4 w-4" /> Create your host account
              </button>
            )}
            <p className="text-sm text-white/50">
              {user
                ? 'Keeps everything you have already booked — same login, one extra hat.'
                : 'Free to list. Nothing to pay, ever.'}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          {SELLING_POINTS.map(point => (
            <div key={point.title}>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <point.icon className="h-5 w-5" />
              </div>
              <h2 className="mb-2 font-serif text-2xl text-stone-900">{point.title}</h2>
              <p className="leading-relaxed text-stone-500">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:px-8">
          <h2 className="mb-12 font-serif text-4xl tracking-tight text-stone-900">Four steps, one sitting</h2>
          <ol className="grid gap-8 md:grid-cols-4">
            {[
              { icon: Building2, title: 'The basics', body: 'Name, category and where in Malawi to find you.' },
              { icon: MessageCircle, title: 'The place', body: 'What the stay is actually like, and what is included.' },
              { icon: Images, title: 'Photographs', body: 'One main shot, then as many more as you have.' },
              { icon: ChevronRight, title: 'Rooms and rates', body: 'Add a room type, set the price, open for bookings.' },
            ].map((item, index) => (
              <li key={item.title} className="rounded-3xl border border-stone-200 bg-white p-7">
                <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
                  0{index + 1}
                </span>
                <item.icon className="mb-4 h-5 w-5 text-emerald-700" />
                <h3 className="mb-2 font-serif text-xl text-stone-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-stone-500">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}



