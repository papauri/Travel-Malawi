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
  Award, FileText, CheckCircle2, Wallet, X, DollarSign, Coins, Trash2, Sliders, ChevronDown, ChevronUp,
  RefreshCw, TrendingUp, HelpCircle,
  User, UserCheck, Shield, Building,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isHotelManager } from '../lib/roles';
import ImageUpload from '../components/ImageUpload';
import GalleryUpload from '../components/GalleryUpload';
import SmartImage from '../components/SmartImage';
import FieldError from '../components/FieldError';
import LocationPicker from '../components/LocationPicker';
import AIAssistantButton from '../components/AIAssistantButton';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { DECORATIVE_IMAGE, getHotelImage } from '../lib/images';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  CATEGORY_HINTS, COMMON_AMENITIES, DESCRIPTION_MAX, DESCRIPTION_MIN, ListingDraft,
  MALAWI_LOCATIONS, NAME_MAX, PROPERTY_CATEGORIES, PropertyCategory, createListing,
  emptyDraft, errorsForStep, hasDuplicateListing, isStepComplete, validateDraft,
} from '../lib/listing';
import { RoomInput } from '../lib/validateRoom';
import { CURRENCIES, formatMoney } from '../lib/currency';
import { CurrencyCode } from '../types';

const ESTIMATED_MWK_PER_USD = 1750;

function convertUsdToMwk(usd: number): number {
  if (!usd || usd <= 0) return 0;
  return Math.round((usd * ESTIMATED_MWK_PER_USD) / 5000) * 5000;
}

function convertMwkToUsd(mwk: number): number {
  if (!mwk || mwk <= 0) return 0;
  return Math.max(5, Math.round((mwk / ESTIMATED_MWK_PER_USD) / 5) * 5);
}

export interface SuggestedRoomItem {
  name: string;
  description: string;
  maxGuests: number;
  suggestedPriceUsd: number;
  suggestedPriceMwk: number;
  currencies: ('USD' | 'MWK')[];
  isCustomizing?: boolean;
}

const DRAFT_KEY = 'listingDraft';

const STEPS = [
  { title: 'The basics', blurb: 'What it is called, and where it is.' },
  { title: 'The place', blurb: 'What a guest should know before booking.' },
  { title: 'Photographs', blurb: 'The pictures that do the selling.' },
  { title: 'Rooms & Rates', blurb: 'What guests will actually book.' },
  { title: 'Management & Contact', blurb: 'Designate the property manager, contacts, and check-in hours.' },
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

  // Subtle, optional AI Assistant features
  const { status: aiStatus, generate, generateDetailed } = useAIAssistant();
  const [draftingStarter, setDraftingStarter] = useState(false);
  const [suggestingAmenities, setSuggestingAmenities] = useState(false);
  const [suggestedAmenities, setSuggestedAmenities] = useState<string[]>([]);
  const [suggestingRooms, setSuggestingRooms] = useState(false);
  const [suggestedRooms, setSuggestedRooms] = useState<SuggestedRoomItem[]>([]);
  const [polishingSuggestedIdx, setPolishingSuggestedIdx] = useState<number | null>(null);
  const [aiRateRoomIdx, setAiRateRoomIdx] = useState<number | null>(null);
  const [aiRateLoading, setAiRateLoading] = useState(false);
  const [aiRateData, setAiRateData] = useState<{ usd: number; mwk: number; reasoning: string } | null>(null);
  const [reviewingListing, setReviewingListing] = useState(false);
  const [listingReview, setListingReview] = useState<string | null>(null);

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

  // Pre-fill manager and contact details from signed-in host if empty
  useEffect(() => {
    if (!user) return;
    setDraft(current => {
      let changed = false;
      const next = { ...current };
      if (!next.managerName && user.displayName) {
        next.managerName = user.displayName;
        changed = true;
      }
      if (!next.managerEmail && user.email) {
        next.managerEmail = user.email;
        changed = true;
      }
      if (!next.contactEmail && user.email) {
        next.contactEmail = user.email;
        changed = true;
      }
      if (!next.managerPhone && user.phone) {
        next.managerPhone = user.phone;
        changed = true;
      }
      if (!next.contactPhone && user.phone) {
        next.contactPhone = user.phone;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [user]);

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

  // Optional AI Helper: Draft initial description
  const handleDraftStarter = async () => {
    if (!draft.name?.trim()) {
      toast.error('Please enter a property name in Step 1 first.');
      return;
    }
    setDraftingStarter(true);
    try {
      const text = await generate({
        action: 'draft',
        entityType: 'property',
        details: {
          name: draft.name,
          location: draft.location,
          locationNotes: draft.locationNotes,
          category: draft.category,
          amenities: draft.amenities,
        },
      });
      if (text) {
        set('description', text);
        toast.success('Draft created based on your property details');
      }
    } finally {
      setDraftingStarter(false);
    }
  };

  // Optional AI Helper: Suggest relevant amenities
  const handleSuggestAmenities = async () => {
    setSuggestingAmenities(true);
    try {
      const res = await generateDetailed<string[]>({
        action: 'suggest_amenities',
        entityType: 'property',
        details: {
          name: draft.name,
          location: draft.location,
          category: draft.category,
          amenities: draft.amenities,
        },
      });

      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        // Filter out already selected
        const newOnes = res.data.filter(
          item => !draft.amenities.some(a => a.toLowerCase() === item.toLowerCase())
        );
        setSuggestedAmenities(newOnes.length > 0 ? newOnes : res.data);
        toast.success(`Suggested ${res.data.length} amenities for ${draft.category || 'your stay'}`);
      } else if (res?.text) {
        const items = res.text
          .split(/[,\n]/)
          .map(s => s.replace(/^[-*•\d.]+\s*/, '').trim())
          .filter(s => s.length > 1 && s.length < 35);
        if (items.length > 0) {
          setSuggestedAmenities(items.slice(0, 8));
        }
      }
    } catch {
      toast.error('Could not generate amenity suggestions');
    } finally {
      setSuggestingAmenities(false);
    }
  };

  const addAllSuggestedAmenities = () => {
    const toAdd = suggestedAmenities.filter(
      item => !draft.amenities.some(a => a.toLowerCase() === item.toLowerCase())
    );
    if (toAdd.length > 0) {
      set('amenities', [...draft.amenities, ...toAdd]);
      toast.success(`Added ${toAdd.length} amenities`);
    }
    setSuggestedAmenities([]);
  };

  // Optional AI Helper: Suggest standard room types tailored for Malawi
  const handleSuggestRoomTypes = async () => {
    setSuggestingRooms(true);
    try {
      const res = await generateDetailed<Array<{
        name: string;
        description: string;
        maxGuests: number;
        suggestedPriceUsd: number;
        suggestedPriceMwk?: number;
      }>>({
        action: 'suggest_rooms',
        entityType: 'property',
        details: {
          name: draft.name,
          location: draft.location,
          category: draft.category,
        },
      });

      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const formatted: SuggestedRoomItem[] = res.data.map(item => {
          const usd = Number(item.suggestedPriceUsd) || 65;
          const mwk = Number(item.suggestedPriceMwk) || convertUsdToMwk(usd);
          return {
            name: item.name || 'Standard Room',
            description: item.description || '',
            maxGuests: Number(item.maxGuests) || 2,
            suggestedPriceUsd: usd,
            suggestedPriceMwk: mwk,
            currencies: ['USD', 'MWK'],
            isCustomizing: false,
          };
        });
        setSuggestedRooms(formatted);
        toast.success(`Generated ${formatted.length} room suggestions with USD & MK rates`);
      } else {
        toast.error('Could not parse room suggestions. You can add room types manually below.');
      }
    } catch {
      toast.error('Error generating room suggestions');
    } finally {
      setSuggestingRooms(false);
    }
  };

  const updateSuggestedRoom = (index: number, patch: Partial<SuggestedRoomItem>) => {
    setSuggestedRooms(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  };

  const adjustSuggestedPrice = (index: number, currency: 'usd' | 'mwk', delta: number) => {
    setSuggestedRooms(prev => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      if (currency === 'usd') {
        const newUsd = Math.max(10, (item.suggestedPriceUsd || 50) + delta);
        next[index] = {
          ...item,
          suggestedPriceUsd: newUsd,
          suggestedPriceMwk: convertUsdToMwk(newUsd),
        };
      } else {
        const newMwk = Math.max(10000, (item.suggestedPriceMwk || 75000) + delta);
        next[index] = {
          ...item,
          suggestedPriceMwk: newMwk,
          suggestedPriceUsd: convertMwkToUsd(newMwk),
        };
      }
      return next;
    });
  };

  const handlePolishSuggestedDescription = async (index: number) => {
    const item = suggestedRooms[index];
    if (!item) return;
    setPolishingSuggestedIdx(index);
    try {
      const polished = await generate({
        action: 'polish',
        entityType: 'room',
        currentText: item.description,
        details: {
          name: item.name,
          category: draft.category,
          location: draft.location,
        },
      });
      if (polished) {
        updateSuggestedRoom(index, { description: polished });
        toast.success('Description polished with AI');
      }
    } catch {
      toast.error('Could not polish description');
    } finally {
      setPolishingSuggestedIdx(null);
    }
  };

  const addSuggestedRoom = (index: number) => {
    const item = suggestedRooms[index];
    if (!item) return;

    const currencies: CurrencyCode[] = (item.currencies && item.currencies.length > 0)
      ? item.currencies
      : ['USD', 'MWK'];

    const prices: Partial<Record<CurrencyCode, number>> = {};
    if (currencies.includes('USD')) {
      prices.USD = Number(item.suggestedPriceUsd) || 60;
    }
    if (currencies.includes('MWK')) {
      prices.MWK = Number(item.suggestedPriceMwk) || convertUsdToMwk(item.suggestedPriceUsd || 60);
    }

    const newRoom: RoomInput = {
      name: item.name.trim() || 'Guest Room',
      description: item.description?.trim() || '',
      currencies,
      prices,
      maxGuests: Number(item.maxGuests) || 2,
      quantity: 1,
      imageUrl: '',
      galleryUrls: [],
    };
    set('rooms', [...(draft.rooms || []), newRoom]);
    setSuggestedRooms(prev => prev.filter((_, i) => i !== index));
    toast.success(`Added ${newRoom.name} (${currencies.map(c => CURRENCIES[c].symbol).join(' & ')})`);
  };

  const addAllSuggestedRooms = () => {
    if (suggestedRooms.length === 0) return;
    const newRooms: RoomInput[] = suggestedRooms.map(item => {
      const currencies: CurrencyCode[] = (item.currencies && item.currencies.length > 0)
        ? item.currencies
        : ['USD', 'MWK'];

      const prices: Partial<Record<CurrencyCode, number>> = {};
      if (currencies.includes('USD')) {
        prices.USD = Number(item.suggestedPriceUsd) || 60;
      }
      if (currencies.includes('MWK')) {
        prices.MWK = Number(item.suggestedPriceMwk) || convertUsdToMwk(item.suggestedPriceUsd || 60);
      }

      return {
        name: item.name.trim() || 'Guest Room',
        description: item.description?.trim() || '',
        currencies,
        prices,
        maxGuests: Number(item.maxGuests) || 2,
        quantity: 1,
        imageUrl: '',
        galleryUrls: [],
      };
    });
    set('rooms', [...(draft.rooms || []), ...newRooms]);
    setSuggestedRooms([]);
    toast.success(`Added ${newRooms.length} room types with dual-currency rates!`);
  };

  // AI Rate Advisor for individual room
  const handleOpenAIRateAdvisor = async (roomIdx: number) => {
    const room = draft.rooms?.[roomIdx];
    if (!room) return;
    setAiRateRoomIdx(roomIdx);
    setAiRateLoading(true);
    setAiRateData(null);

    try {
      const res = await generateDetailed<{
        suggestedPriceUsd: number;
        suggestedPriceMwk: number;
        reasoning: string;
      }>({
        action: 'suggest_rate',
        entityType: 'room',
        details: {
          name: room.name || 'Standard Room',
          category: draft.category,
          location: draft.location,
          capacity: Number(room.maxGuests) || 2,
          extraNotes: draft.name ? `Property name: ${draft.name}` : undefined,
        },
      });

      if (res?.data && (res.data.suggestedPriceUsd || res.data.suggestedPriceMwk)) {
        const usd = Number(res.data.suggestedPriceUsd) || 75;
        const mwk = Number(res.data.suggestedPriceMwk) || convertUsdToMwk(usd);
        setAiRateData({
          usd,
          mwk,
          reasoning: res.data.reasoning || `Recommended rates for ${room.name || 'this room'} based on local Malawian hospitality standards.`,
        });
      } else {
        const fallbackUsd = 75;
        setAiRateData({
          usd: fallbackUsd,
          mwk: convertUsdToMwk(fallbackUsd),
          reasoning: `Competitive benchmark rate for ${draft.category || 'accommodation'} in ${draft.location || 'Malawi'}.`,
        });
      }
    } catch {
      toast.error('Could not fetch AI rate recommendation');
    } finally {
      setAiRateLoading(false);
    }
  };

  const handleApplyAIRates = (roomIdx: number) => {
    if (!aiRateData) return;
    const updated = [...(draft.rooms || [])];
    const room = updated[roomIdx];
    if (!room) return;

    const currs: CurrencyCode[] = Array.from(new Set([...(room.currencies || []), 'USD', 'MWK'])) as CurrencyCode[];
    updated[roomIdx] = {
      ...room,
      currencies: currs,
      prices: {
        ...room.prices,
        USD: aiRateData.usd,
        MWK: aiRateData.mwk,
      },
    };
    set('rooms', updated);
    setAiRateRoomIdx(null);
    setAiRateData(null);
    toast.success(`Applied $${aiRateData.usd} USD & MK ${aiRateData.mwk.toLocaleString()} to ${room.name || 'room'}`);
  };

  // Optional AI Helper: Review listing appeal before submission
  const handleReviewListing = async () => {
    setReviewingListing(true);
    try {
      const res = await generate({
        action: 'review_listing',
        entityType: 'property',
        currentText: draft.description,
        details: {
          name: draft.name,
          location: draft.location,
          category: draft.category,
          amenities: draft.amenities,
          roomsCount: draft.rooms?.length || 0,
          extraNotes: `${1 + draft.galleryUrls.length} photos provided. Check-in ${draft.checkInTime || '14:00'}, check-out ${draft.checkOutTime || '10:00'}.`,
        },
      });
      if (res) {
        setListingReview(res);
      }
    } catch {
      toast.error('Could not complete listing review');
    } finally {
      setReviewingListing(false);
    }
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
        <ol className="mb-10 grid grid-cols-7 gap-2">
          {STEPS.map((s, index) => {
            const done = index < step && isStepComplete(draft, index);
            const active = index === step;
            const reachable = index <= step || FIELD_STEPS.slice(0, index).every(i => isStepComplete(draft, i));
            return (
              <li key={`step-${s.title}-${index}`}>
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
                  {PROPERTY_CATEGORIES.map((category, catIdx) => {
                    const selected = draft.category === category;
                    return (
                      <button
                        key={`cat-${category}-${catIdx}`}
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
                  {MALAWI_LOCATIONS.map((location, locIdx) => <option key={`loc-${location}-${locIdx}`} value={location} />)}
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
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass} htmlFor="listing-description">Describe the stay</label>
                  <AIAssistantButton
                    value={draft.description}
                    onChange={text => set('description', text)}
                    entityType="property"
                    context={{
                      name: draft.name,
                      location: draft.location,
                      locationNotes: draft.locationNotes,
                      category: draft.category,
                      amenities: draft.amenities,
                    }}
                    fieldLabel="property description"
                  />
                </div>

                {!draft.description.trim() && !!draft.name?.trim() && aiStatus.enabled && aiStatus.available && (
                  <div className="mb-3 p-3.5 bg-stone-50 border border-stone-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-stone-600">
                      <FileText className="w-4 h-4 text-stone-500 shrink-0" />
                      <span>
                        Short on time? Let the assistant draft a welcoming starter based on <strong>{draft.name}</strong>.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDraftStarter}
                      disabled={draftingStarter}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl transition text-xs disabled:opacity-50"
                    >
                      {draftingStarter ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Drafting starter...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          <span>Draft starter description</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

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
                <div className="flex items-center justify-between mb-2">
                  <span className={labelClass}>What is on offer?</span>
                  {aiStatus.enabled && aiStatus.available && (
                    <button
                      type="button"
                      onClick={handleSuggestAmenities}
                      disabled={suggestingAmenities}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 px-3 py-1.5 rounded-full transition disabled:opacity-50"
                    >
                      {suggestingAmenities ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-stone-500" />
                      )}
                      <span>Suggest amenities</span>
                    </button>
                  )}
                </div>

                {/* Optional Suggested Amenities Tray */}
                {suggestedAmenities.length > 0 && (
                  <div className="mb-4 p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-stone-500" />
                        Suggested for {draft.category || 'stay'} in {draft.location || 'Malawi'}:
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={addAllSuggestedAmenities}
                          className="text-[11px] font-bold text-stone-900 hover:underline"
                        >
                          Add all
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuggestedAmenities([])}
                          className="text-stone-400 hover:text-stone-600"
                          title="Dismiss suggestions"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedAmenities.map((am, aIdx) => {
                        const isSelected = draft.amenities.includes(am);
                        return (
                          <button
                            key={`${am}-${aIdx}`}
                            type="button"
                            onClick={() => toggleAmenity(am)}
                            className={`text-xs px-3 py-1 rounded-full border transition flex items-center gap-1.5 font-medium ${
                              isSelected
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <span>{isSelected ? '✓' : '+'}</span>
                            <span>{am}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {COMMON_AMENITIES.map((amenity, amIdx) => {
                    const selected = draft.amenities.includes(amenity);
                    return (
                      <button
                        key={`amenity-${amenity}-${amIdx}`}
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
                    {draft.amenities.map((amenity, aIdx) => (
                      <span
                        key={`${amenity}-${aIdx}`}
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
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 space-y-6">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-serif font-bold text-stone-900">Room Types & Multi-Currency Pricing</h3>
                      <p className="text-sm text-stone-600 mt-0.5">
                        Set rates in US Dollars (USD) for international travelers, Malawi Kwacha (MK) for domestic guests, or both.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto bg-stone-200/60 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-700">
                      <Coins className="w-3.5 h-3.5 text-stone-500" />
                      <span>Benchmark: ~1,750 MK per USD</span>
                    </div>
                  </div>
                </div>

                {/* Current Rooms Overview List */}
                {(draft.rooms || []).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Configured Rooms ({(draft.rooms || []).length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(draft.rooms || []).map((room, idx) => (
                        <div key={`configured-room-${room.id || idx}-${idx}`} className="bg-white p-3.5 rounded-xl border border-stone-200 flex items-center justify-between shadow-2xs">
                          <div className="flex items-center gap-3 min-w-0">
                            {room.imageUrl ? (
                              <img src={room.imageUrl} alt={room.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-12 bg-stone-100 rounded-lg flex items-center justify-center shrink-0 border border-stone-200">
                                <Building2 className="w-5 h-5 text-stone-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-stone-900 truncate">
                                {room.name || `Room ${idx + 1} (Unnamed)`}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-stone-600">
                                {room.prices?.USD ? (
                                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    ${room.prices.USD} USD
                                  </span>
                                ) : null}
                                {room.prices?.MWK ? (
                                  <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                    MK {Number(room.prices.MWK).toLocaleString()}
                                  </span>
                                ) : null}
                                {(!room.prices?.USD && !room.prices?.MWK) && (
                                  <span className="text-amber-600 font-medium">Rate unconfigured</span>
                                )}
                                <span className="text-stone-400">·</span>
                                <span className="text-stone-500">Sleeps {room.maxGuests || 2}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...(draft.rooms || [])];
                              updated.splice(idx, 1);
                              set('rooms', updated);
                              toast.success('Room removed');
                            }}
                            className="text-stone-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition shrink-0 ml-2"
                            title="Remove room type"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Actions Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      set('rooms', [...(draft.rooms || []), {
                        name: '',
                        description: '',
                        currencies: ['USD', 'MWK'],
                        prices: { USD: 70, MWK: 120000 },
                        maxGuests: 2,
                        quantity: 1,
                        imageUrl: '',
                        galleryUrls: [],
                      }]);
                    }}
                    className="w-full sm:flex-1 py-3.5 border-2 border-dashed border-stone-300 rounded-xl text-stone-700 font-semibold hover:border-stone-400 hover:bg-white transition text-xs flex items-center justify-center gap-2 bg-stone-100/50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add room type manually (Dual USD / MK)</span>
                  </button>

                  {aiStatus.enabled && aiStatus.available && (
                    <button
                      type="button"
                      onClick={handleSuggestRoomTypes}
                      disabled={suggestingRooms}
                      className="w-full sm:w-auto py-3.5 px-5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition inline-flex items-center justify-center gap-2 border border-stone-900 disabled:opacity-50 shadow-2xs"
                    >
                      {suggestingRooms ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-300" />
                          <span>Crafting room configurations...</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-stone-300" />
                          <span>Suggest Rooms for {draft.category || 'stay'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Interactive Room Types Customizer Tray */}
                {suggestedRooms.length > 0 && (
                  <div className="p-5 bg-white border border-stone-300 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-stone-700" />
                          Suggested Room Setups for {draft.name || draft.location || 'Your Property'}
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Tweak room names, edit descriptions, adjust USD / MK rates, or add directly to your listing.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={addAllSuggestedRooms}
                          className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Add all ({suggestedRooms.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuggestedRooms([])}
                          className="text-stone-400 hover:text-stone-600 p-1"
                          title="Dismiss suggestions"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {suggestedRooms.map((roomItem, rIdx) => (
                        <div key={`suggested-room-${roomItem.name || rIdx}-${rIdx}`} className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-2xs hover:border-stone-300 transition">
                          <div className="space-y-2.5">
                            {/* Room Name Input */}
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                  Room Name
                                </label>
                                <span className="text-[10px] font-medium text-stone-400">
                                  Editable
                                </span>
                              </div>
                              <input
                                type="text"
                                value={roomItem.name}
                                onChange={e => updateSuggestedRoom(rIdx, { name: e.target.value })}
                                className="w-full mt-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-900 focus:ring-1 focus:ring-stone-400"
                                placeholder="e.g. Deluxe Lake Chalet"
                              />
                            </div>

                            {/* Room Description & AI Polish */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                  Description
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handlePolishSuggestedDescription(rIdx)}
                                  disabled={polishingSuggestedIdx === rIdx}
                                  className="text-[10px] font-semibold text-stone-700 hover:text-stone-900 hover:underline flex items-center gap-1"
                                >
                                  {polishingSuggestedIdx === rIdx ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-stone-500" />
                                  ) : (
                                    <FileText className="w-3 h-3 text-stone-500" />
                                  )}
                                  <span>Polish description</span>
                                </button>
                              </div>
                              <textarea
                                value={roomItem.description}
                                onChange={e => updateSuggestedRoom(rIdx, { description: e.target.value })}
                                rows={2}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:ring-1 focus:ring-stone-400"
                                placeholder="Describe the atmosphere, views, and features..."
                              />
                            </div>

                            {/* Currency & Dual Pricing Controls */}
                            <div className="pt-2 border-t border-stone-200/70 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                  Currencies & Rates
                                </span>
                                <div className="flex items-center gap-2">
                                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={roomItem.currencies.includes('USD')}
                                      onChange={e => {
                                        const currs = e.target.checked
                                          ? [...roomItem.currencies, 'USD' as const]
                                          : roomItem.currencies.filter(c => c !== 'USD');
                                        if (currs.length > 0) updateSuggestedRoom(rIdx, { currencies: currs });
                                      }}
                                      className="rounded text-stone-900 focus:ring-stone-400 w-3.5 h-3.5"
                                    />
                                    <span>USD ($)</span>
                                  </label>
                                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={roomItem.currencies.includes('MWK')}
                                      onChange={e => {
                                        const currs = e.target.checked
                                          ? [...roomItem.currencies, 'MWK' as const]
                                          : roomItem.currencies.filter(c => c !== 'MWK');
                                        if (currs.length > 0) updateSuggestedRoom(rIdx, { currencies: currs });
                                      }}
                                      className="rounded text-stone-900 focus:ring-stone-400 w-3.5 h-3.5"
                                    />
                                    <span>MK (MWK)</span>
                                  </label>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {roomItem.currencies.includes('USD') && (
                                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                                      <span className="font-semibold text-emerald-800">USD Rate</span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => adjustSuggestedPrice(rIdx, 'usd', -5)}
                                          className="px-1 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-bold"
                                        >
                                          -$5
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => adjustSuggestedPrice(rIdx, 'usd', 5)}
                                          className="px-1 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-bold"
                                        >
                                          +$5
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold text-stone-400">$</span>
                                      <input
                                        type="number"
                                        value={roomItem.suggestedPriceUsd || ''}
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          updateSuggestedRoom(rIdx, {
                                            suggestedPriceUsd: val,
                                            suggestedPriceMwk: convertUsdToMwk(val),
                                          });
                                        }}
                                        className="w-full text-xs font-bold text-stone-900 bg-transparent outline-hidden"
                                        min="0"
                                      />
                                      <span className="text-[10px] text-stone-400">/nt</span>
                                    </div>
                                  </div>
                                )}

                                {roomItem.currencies.includes('MWK') && (
                                  <div className="bg-white p-2 rounded-lg border border-stone-200">
                                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                                      <span className="font-semibold text-blue-800">MK Rate</span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => adjustSuggestedPrice(rIdx, 'mwk', -10000)}
                                          className="px-1 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-bold"
                                        >
                                          -10k
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => adjustSuggestedPrice(rIdx, 'mwk', 10000)}
                                          className="px-1 py-0.5 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-bold"
                                        >
                                          +10k
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-bold text-stone-400">MK</span>
                                      <input
                                        type="number"
                                        value={roomItem.suggestedPriceMwk || ''}
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          updateSuggestedRoom(rIdx, {
                                            suggestedPriceMwk: val,
                                            suggestedPriceUsd: convertMwkToUsd(val),
                                          });
                                        }}
                                        className="w-full text-xs font-bold text-stone-900 bg-transparent outline-hidden"
                                        min="0"
                                      />
                                      <span className="text-[10px] text-stone-400">/nt</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Capacity */}
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-stone-600">Max Guests:</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateSuggestedRoom(rIdx, { maxGuests: Math.max(1, roomItem.maxGuests - 1) })}
                                    className="w-6 h-6 flex items-center justify-center bg-white border border-stone-200 rounded font-bold text-xs hover:bg-stone-100"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-bold text-stone-800">{roomItem.maxGuests}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateSuggestedRoom(rIdx, { maxGuests: Math.min(20, roomItem.maxGuests + 1) })}
                                    className="w-6 h-6 flex items-center justify-center bg-white border border-stone-200 rounded font-bold text-xs hover:bg-stone-100"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Add This Room Button */}
                          <button
                            type="button"
                            onClick={() => addSuggestedRoom(rIdx)}
                            className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add this room to listing</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Full Detailed Room Cards for Listing */}
              {(draft.rooms || []).map((room, idx) => {
                const roomCurrencies: CurrencyCode[] = room.currencies && room.currencies.length > 0
                  ? room.currencies
                  : ['USD', 'MWK'];
                const hasUsd = roomCurrencies.includes('USD');
                const hasMwk = roomCurrencies.includes('MWK');

                return (
                  <div key={`room-pricing-card-${room.id || idx}-${idx}`} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative space-y-6">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                          Room {idx + 1}
                        </span>
                        <h4 className="font-serif font-bold text-base text-stone-900">
                          {room.name || 'Untitled Room Type'}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(draft.rooms || [])];
                          updated.splice(idx, 1);
                          set('rooms', updated);
                          toast.success('Room removed');
                        }}
                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition flex items-center gap-1 text-xs font-semibold"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Remove Room</span>
                      </button>
                    </div>

                    {/* Room Name */}
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
                        placeholder="e.g. Lakeview Deluxe Chalet, Executive Suite, Safari Tent"
                      />
                    </div>

                    {/* Room Description */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelClass}>Description</label>
                        <AIAssistantButton
                          value={room.description || ''}
                          onChange={text => {
                            const updated = [...(draft.rooms || [])];
                            updated[idx].description = text;
                            set('rooms', updated);
                          }}
                          entityType="room"
                          context={{
                            name: room.name,
                            capacity: typeof room.maxGuests === 'number' ? room.maxGuests : Number(room.maxGuests) || undefined,
                            extraNotes: draft.name ? `Room at ${draft.name}, located in ${draft.location || 'Malawi'}` : undefined,
                          }}
                          fieldLabel="room description"
                        />
                      </div>
                      <textarea
                        value={room.description || ''}
                        onChange={e => {
                          const updated = [...(draft.rooms || [])];
                          updated[idx].description = e.target.value;
                          set('rooms', updated);
                        }}
                        className={fieldClass}
                        rows={2}
                        placeholder="What makes this room special? e.g. Private balcony overlooking Lake Malawi, en-suite bathroom with solar hot water..."
                      />
                    </div>

                    {/* Currency & Nightly Rate Management */}
                    <div className="p-5 bg-stone-50/80 border border-stone-200 rounded-xl space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-stone-800">
                            Accepted Currencies & Nightly Rates
                          </label>
                          <p className="text-[11px] text-stone-500">
                            Enable US Dollars ($), Malawi Kwacha (MK), or both for this room.
                          </p>
                        </div>

                        {/* AI Rate Advisor Trigger Button */}
                        {aiStatus.enabled && aiStatus.available && (
                          <button
                            type="button"
                            onClick={() => handleOpenAIRateAdvisor(idx)}
                            disabled={aiRateLoading && aiRateRoomIdx === idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition shadow-2xs self-start sm:self-auto disabled:opacity-50"
                          >
                            {aiRateLoading && aiRateRoomIdx === idx ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                                <span>Evaluating Malawi rates...</span>
                              </>
                            ) : (
                              <>
                                <DollarSign className="w-3.5 h-3.5 text-stone-600" />
                                <span>Rate Advisor</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Currency Checkboxes */}
                      <div className="flex flex-wrap items-center gap-3">
                        <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          hasUsd ? 'bg-white border-emerald-500 text-emerald-900 shadow-2xs' : 'bg-stone-100 border-stone-200 text-stone-500'
                        }`}>
                          <input
                            type="checkbox"
                            checked={hasUsd}
                            onChange={e => {
                              const updated = [...(draft.rooms || [])];
                              const nextCurrs = e.target.checked
                                ? Array.from(new Set([...roomCurrencies, 'USD' as CurrencyCode]))
                                : roomCurrencies.filter(c => c !== 'USD');
                              if (nextCurrs.length === 0) {
                                toast.error('Pick at least one currency for this room.');
                                return;
                              }
                              updated[idx].currencies = nextCurrs;
                              if (e.target.checked && (!updated[idx].prices?.USD || updated[idx].prices?.USD === 0)) {
                                updated[idx].prices = {
                                  ...updated[idx].prices,
                                  USD: convertMwkToUsd(updated[idx].prices?.MWK || 0) || 70,
                                };
                              }
                              set('rooms', updated);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                          />
                          <span>US Dollar ($ USD)</span>
                        </label>

                        <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          hasMwk ? 'bg-white border-blue-500 text-blue-900 shadow-2xs' : 'bg-stone-100 border-stone-200 text-stone-500'
                        }`}>
                          <input
                            type="checkbox"
                            checked={hasMwk}
                            onChange={e => {
                              const updated = [...(draft.rooms || [])];
                              const nextCurrs = e.target.checked
                                ? Array.from(new Set([...roomCurrencies, 'MWK' as CurrencyCode]))
                                : roomCurrencies.filter(c => c !== 'MWK');
                              if (nextCurrs.length === 0) {
                                toast.error('Pick at least one currency for this room.');
                                return;
                              }
                              updated[idx].currencies = nextCurrs;
                              if (e.target.checked && (!updated[idx].prices?.MWK || updated[idx].prices?.MWK === 0)) {
                                updated[idx].prices = {
                                  ...updated[idx].prices,
                                  MWK: convertUsdToMwk(updated[idx].prices?.USD || 0) || 120000,
                                };
                              }
                              set('rooms', updated);
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Malawi Kwacha (MK MWK)</span>
                        </label>
                      </div>

                      {/* Price Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        {hasUsd && (
                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              Nightly Price (USD)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">$</span>
                              <input
                                type="number"
                                value={room.prices?.USD ?? ''}
                                onChange={e => {
                                  const updated = [...(draft.rooms || [])];
                                  updated[idx].prices = { ...updated[idx].prices, USD: Number(e.target.value) };
                                  set('rooms', updated);
                                }}
                                className={`${fieldClass} pl-8`}
                                placeholder="e.g. 75"
                                min="0"
                              />
                            </div>
                          </div>
                        )}

                        {hasMwk && (
                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              Nightly Price (MK / Malawi Kwacha)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">MK</span>
                              <input
                                type="number"
                                value={room.prices?.MWK ?? ''}
                                onChange={e => {
                                  const updated = [...(draft.rooms || [])];
                                  updated[idx].prices = { ...updated[idx].prices, MWK: Number(e.target.value) };
                                  set('rooms', updated);
                                }}
                                className={`${fieldClass} pl-10`}
                                placeholder="e.g. 130000"
                                min="0"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dual-Currency Auto-Sync Helpers */}
                      {hasUsd && hasMwk && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200 text-xs text-stone-500">
                          <span className="font-medium">Quick sync:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const usd = room.prices?.USD || 0;
                              if (usd <= 0) {
                                toast.error('Enter a USD rate first');
                                return;
                              }
                              const calcMwk = convertUsdToMwk(usd);
                              const updated = [...(draft.rooms || [])];
                              updated[idx].prices = { ...updated[idx].prices, MWK: calcMwk };
                              set('rooms', updated);
                              toast.success(`Calculated MK ${calcMwk.toLocaleString()} from $${usd} USD`);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-stone-200/70 border border-stone-200 rounded-md font-semibold text-stone-700 transition"
                          >
                            ⚡ Calc MK from USD ($ {room.prices?.USD || 0} → MK {convertUsdToMwk(room.prices?.USD || 0).toLocaleString()})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const mwk = room.prices?.MWK || 0;
                              if (mwk <= 0) {
                                toast.error('Enter an MK rate first');
                                return;
                              }
                              const calcUsd = convertMwkToUsd(mwk);
                              const updated = [...(draft.rooms || [])];
                              updated[idx].prices = { ...updated[idx].prices, USD: calcUsd };
                              set('rooms', updated);
                              toast.success(`Calculated $${calcUsd} USD from MK ${mwk.toLocaleString()}`);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-stone-200/70 border border-stone-200 rounded-md font-semibold text-stone-700 transition"
                          >
                            ⚡ Calc USD from MK
                          </button>
                        </div>
                      )}

                      {/* Rate Advisor Inline Card */}
                      {aiRateRoomIdx === idx && aiRateData && (
                        <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-3 animate-in fade-in">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-stone-600 shrink-0" />
                              <h5 className="font-bold text-xs text-stone-900 uppercase tracking-wider">
                                Market Rate Recommendation
                              </h5>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAiRateRoomIdx(null);
                                setAiRateData(null);
                              }}
                              className="text-stone-400 hover:text-stone-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Suggested USD</span>
                              <p className="text-lg font-bold text-stone-900">${aiRateData.usd} <span className="text-xs font-normal text-stone-500">/nt</span></p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Suggested MK</span>
                              <p className="text-lg font-bold text-stone-900">MK {aiRateData.mwk.toLocaleString()} <span className="text-xs font-normal text-stone-500">/nt</span></p>
                            </div>
                          </div>

                          <p className="text-xs text-stone-600 leading-relaxed">
                            {aiRateData.reasoning}
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleApplyAIRates(idx)}
                              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Apply These Rates</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAiRateRoomIdx(null);
                                setAiRateData(null);
                              }}
                              className="px-3 py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Capacity & Inventory */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Quantity (Available Rooms of this Type)</label>
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
                          placeholder="e.g. 4"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Max Guests (Sleeps)</label>
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
                          placeholder="e.g. 2"
                        />
                      </div>
                    </div>

                    {/* Extra Guest Fees (Optional) */}
                    <div className="pt-4 border-t border-stone-100 space-y-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
                          Extra Guest Fees (Optional)
                        </label>
                        <p className="text-[11px] text-stone-500">
                          Additional charge per night for guests beyond the base occupancy.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {hasUsd && (
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Extra Guest Fee (USD)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">$</span>
                              <input
                                type="number"
                                value={room.extraGuestFees?.USD ?? ''}
                                onChange={e => {
                                  const updated = [...(draft.rooms || [])];
                                  updated[idx].extraGuestFees = {
                                    ...updated[idx].extraGuestFees,
                                    USD: e.target.value ? Number(e.target.value) : undefined,
                                  };
                                  set('rooms', updated);
                                }}
                                className={`${fieldClass} pl-8`}
                                placeholder="e.g. 20"
                                min="0"
                              />
                            </div>
                          </div>
                        )}
                        {hasMwk && (
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Extra Guest Fee (MK)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">MK</span>
                              <input
                                type="number"
                                value={room.extraGuestFees?.MWK ?? ''}
                                onChange={e => {
                                  const updated = [...(draft.rooms || [])];
                                  updated[idx].extraGuestFees = {
                                    ...updated[idx].extraGuestFees,
                                    MWK: e.target.value ? Number(e.target.value) : undefined,
                                  };
                                  set('rooms', updated);
                                }}
                                className={`${fieldClass} pl-10`}
                                placeholder="e.g. 35000"
                                min="0"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Room Photos */}
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
                );
              })}

              <FieldError message={visible.rooms} />
            </div>
          )}

{step === 4 && (
            <div className="space-y-8">
              {/* Designated Property Manager (Required) */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5 sm:p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-stone-900 p-2 text-white shadow-2xs">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Designated Property Manager & Host in Charge</h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      The primary person managing on-site hospitality, guest check-ins, and operations. Our AI Concierge and travelers will know this person as the authorized manager.
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="listing-manager-name">
                    Manager Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      id="listing-manager-name"
                      type="text"
                      value={draft.managerName}
                      onChange={e => set('managerName', e.target.value)}
                      placeholder="e.g. Kondwani Banda or Chimwemwe Phiri"
                      className={`${fieldClass} pl-11`}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-stone-400">
                    The named host or manager who will be managing the property.
                  </p>
                  <FieldError message={visible.managerName} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-stone-200/60">
                  <div>
                    <label className={labelClass} htmlFor="listing-manager-email">
                      Manager Direct Email <span className="text-stone-400 font-normal lowercase">(optional direct)</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        id="listing-manager-email"
                        type="email"
                        value={draft.managerEmail}
                        onChange={e => set('managerEmail', e.target.value)}
                        placeholder={draft.contactEmail || "manager@property.mw"}
                        className={`${fieldClass} pl-11`}
                      />
                    </div>
                    <FieldError message={visible.managerEmail} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="listing-manager-phone">
                      Manager Direct Phone <span className="text-stone-400 font-normal lowercase">(optional direct)</span>
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        id="listing-manager-phone"
                        type="tel"
                        value={draft.managerPhone}
                        onChange={e => set('managerPhone', e.target.value)}
                        placeholder={draft.contactPhone || "+265 991 234 567"}
                        className={`${fieldClass} pl-11`}
                      />
                    </div>
                    <FieldError message={visible.managerPhone} />
                  </div>
                </div>
              </div>

              {/* Property Ownership / Operating Entity (Optional) */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-stone-100 p-2 text-stone-700">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Property Ownership & Operating Entity <span className="text-xs text-stone-400 font-normal">(Optional)</span></h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      If the lodge or property is owned by a company, trust, or individual separate from the on-site manager.
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="listing-owner-name">
                    Owner or Holding Entity Name
                  </label>
                  <div className="relative">
                    <Building className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      id="listing-owner-name"
                      type="text"
                      value={draft.ownerName}
                      onChange={e => set('ownerName', e.target.value)}
                      placeholder="e.g. Nyika Safaris Ltd or Dr. T. Mwale"
                      className={`${fieldClass} pl-11`}
                    />
                  </div>
                  <FieldError message={visible.ownerName} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  <div>
                    <label className={labelClass} htmlFor="listing-owner-email">
                      Owner Email <span className="text-stone-400 font-normal lowercase">(optional)</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        id="listing-owner-email"
                        type="email"
                        value={draft.ownerEmail}
                        onChange={e => set('ownerEmail', e.target.value)}
                        placeholder="owner@company.mw"
                        className={`${fieldClass} pl-11`}
                      />
                    </div>
                    <FieldError message={visible.ownerEmail} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="listing-owner-phone">
                      Owner Phone <span className="text-stone-400 font-normal lowercase">(optional)</span>
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        id="listing-owner-phone"
                        type="tel"
                        value={draft.ownerPhone}
                        onChange={e => set('ownerPhone', e.target.value)}
                        placeholder="+265 888 123 456"
                        className={`${fieldClass} pl-11`}
                      />
                    </div>
                    <FieldError message={visible.ownerPhone} />
                  </div>
                </div>
              </div>

              {/* Public Booking & Front Desk Contact */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 sm:p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-600 p-2 text-white shadow-2xs">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Public Booking & Guest Inquiries</h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      These details are presented to guests on your public listing and confirmed on booking vouchers.
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="listing-email">
                    Booking & Reservations Email <span className="text-red-500">*</span>
                  </label>
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
                  <p className="mt-1.5 text-xs text-stone-400">
                    Where booking requests should reach you. It can differ from your sign-in address.
                  </p>
                  <FieldError message={visible.contactEmail} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="listing-phone">
                    Booking Phone Number <span className="text-red-500">*</span>
                  </label>
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
                  <p className="mt-1.5 text-xs text-stone-400">
                    Include country code (+265) so international travelers can connect immediately.
                  </p>
                  <FieldError message={visible.contactPhone} />
                </div>

                <div>
                  <label className={labelClass} htmlFor="listing-whatsapp">
                    WhatsApp Number <span className="font-medium normal-case tracking-normal text-stone-400">(optional)</span>
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
                  <p className="mt-1.5 text-xs text-stone-400">
                    Leave blank if same as phone number — we will use the phone number above.
                  </p>
                  <FieldError message={visible.contactWhatsapp} />
                </div>
              </div>

              {/* Check-in & Check-out Times */}
              <div className="grid gap-6 border-t border-stone-100 pt-8 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="listing-checkin">Check-in from</label>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      id="listing-checkin"
                      type="time"
                      value={draft.checkInTime}
                      onChange={e => set('checkInTime', e.target.value)}
                      className={`${fieldClass} pl-11`}
                    />
                  </div>
                  <FieldError message={visible.checkInTime} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="listing-checkout">Check-out until</label>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      id="listing-checkout"
                      type="time"
                      value={draft.checkOutTime}
                      onChange={e => set('checkOutTime', e.target.value)}
                      className={`${fieldClass} pl-11`}
                    />
                  </div>
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
                  <Award className="mx-auto h-12 w-12 text-stone-700 mb-4" />
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
                      {draft.amenities.map((amenity, aIdx) => (
                        <span key={`${amenity}-${aIdx}`} className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700">
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
                      <dt className="font-semibold text-stone-400">Public Email</dt>
                      <dd className="truncate text-stone-900">{draft.contactEmail}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-400">Public Phone</dt>
                      <dd className="text-stone-900">{draft.contactPhone}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-400">WhatsApp</dt>
                      <dd className="text-stone-900">
                        {draft.contactWhatsapp.trim() || `${draft.contactPhone} (same)`}
                      </dd>
                    </div>
                  </dl>

                  <dl className="mt-4 grid gap-4 border-t border-stone-100 pt-6 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-stone-400 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-stone-500" />
                        <span>Designated Property Manager</span>
                      </dt>
                      <dd className="text-stone-900 font-medium mt-0.5">{draft.managerName || 'Assigned Host'}</dd>
                      {(draft.managerEmail || draft.managerPhone) && (
                        <dd className="text-stone-500 text-xs mt-0.5">
                          {[draft.managerEmail, draft.managerPhone].filter(Boolean).join(' · ')}
                        </dd>
                      )}
                    </div>
                    {draft.ownerName ? (
                      <div>
                        <dt className="font-semibold text-stone-400 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-stone-500" />
                          <span>Property Owner / Entity</span>
                        </dt>
                        <dd className="text-stone-900 font-medium mt-0.5">{draft.ownerName}</dd>
                        {(draft.ownerEmail || draft.ownerPhone) && (
                          <dd className="text-stone-500 text-xs mt-0.5">
                            {[draft.ownerEmail, draft.ownerPhone].filter(Boolean).join(' · ')}
                          </dd>
                        )}
                      </div>
                    ) : (
                      <div>
                        <dt className="font-semibold text-stone-400">Ownership & Management</dt>
                        <dd className="text-stone-500 text-xs mt-0.5">Managed directly by host on-site</dd>
                      </div>
                    )}
                  </dl>

                  {/* Room Types & Pricing Summary in Review */}
                  <div className="mt-6 border-t border-stone-100 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                        Configured Room Types & Rates ({(draft.rooms || []).length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="text-xs font-semibold text-stone-700 hover:text-stone-900 hover:underline"
                      >
                        Edit Rooms &rarr;
                      </button>
                    </div>

                    {(draft.rooms || []).length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                        ⚠️ No room types added yet. Please add at least one room in Step 3 before publishing.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(draft.rooms || []).map((room, rIdx) => (
                          <div key={`draft-summary-room-${room.id || rIdx}-${rIdx}`} className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 text-xs space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-stone-900 text-sm">{room.name || `Room ${rIdx + 1}`}</span>
                              <span className="text-[10px] font-semibold text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200">
                                {room.quantity || 1} available
                              </span>
                            </div>
                            <p className="text-stone-600 line-clamp-1">{room.description || 'No description provided'}</p>
                            <div className="flex flex-wrap items-center gap-2 pt-1 font-semibold">
                              {room.prices?.USD ? (
                                <span className="text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                                  ${room.prices.USD} USD / night
                                </span>
                              ) : null}
                              {room.prices?.MWK ? (
                                <span className="text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded">
                                  MK {Number(room.prices.MWK).toLocaleString()} / night
                                </span>
                              ) : null}
                              <span className="text-stone-400 font-normal">· Sleeps {room.maxGuests || 2}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional AI Appeal & Guest Clarity Check */}
              {aiStatus.enabled && aiStatus.available && (
                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-stone-600 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                          Listing Readiness & Appeal Check
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Get quick, private feedback on how attractive and clear your listing is for travelers.
                        </p>
                      </div>
                    </div>
                    {!listingReview && (
                      <button
                        type="button"
                        onClick={handleReviewListing}
                        disabled={reviewingListing}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-900 bg-white hover:bg-stone-100 rounded-xl border border-stone-200 transition shadow-2xs disabled:opacity-50"
                      >
                        {reviewingListing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                            <span>Reviewing draft...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-stone-600" />
                            <span>Run Quick Check</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {listingReview && (
                    <div className="space-y-3 pt-3 border-t border-stone-200/70 animate-in fade-in">
                      <div className="p-4 bg-white rounded-xl border border-stone-200 text-xs leading-relaxed text-stone-700 whitespace-pre-line">
                        {listingReview}
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setListingReview(null)}
                          className="text-xs text-stone-400 hover:text-stone-600 transition"
                        >
                          Dismiss feedback
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="text-xs font-semibold text-stone-800 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Edit description or amenities</span>
                          <span>&rarr;</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                    {Object.entries(allErrors).map(([field, message]) => (
                      <li key={`${field}-${message}`}>{message}</li>
                    ))}
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
                <ArrowRight className="h-4 w-4" /> Create your host account
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
          {SELLING_POINTS.map((point, pIdx) => (
            <div key={`selling-point-${point.title}-${pIdx}`}>
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
              <li key={`step-card-${item.title}-${index}`} className="rounded-3xl border border-stone-200 bg-white p-7">
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



