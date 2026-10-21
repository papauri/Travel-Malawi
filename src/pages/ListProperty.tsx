/**
 * "List your property", end to end.
 *
 * What used to happen: every host entry point pointed at `/dashboard`, which
 * redirects anyone without the `hotel_manager` role straight back to the home
 * page. A signed-out visitor, and a signed-in one who had joined to plan a
 * stay, both clicked "List your property" and simply landed back where they
 * started with nothing said. Anyone who did get through met a four-field form
 * that wrote a listing with no category, no gallery and no hours, and then
 * dropped them on a dashboard that did not mention the rooms a listing needs
 * before it can go live.
 *
 * This page owns the whole path instead: sign in or create an account, add the
 * host role to an existing account, fill in the listing over five reviewable
 * steps, and land on the room editor for the property that was just created.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ChevronRight, Clock,
  Images, Loader2, LocateFixed, Mail, MapPin, MessageCircle, Phone, Plus, Send,
  FileText, CheckCircle2, Wallet, X, DollarSign, Trash2, Sliders, ChevronDown, ChevronUp,
  RefreshCw, TrendingUp, HelpCircle, AlertTriangle, BookOpen,
  User, Shield, Building, ConciergeBell, BedDouble, Tag, Home, Globe,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isHotelManager } from '../lib/roles';
import SEOHead from '../components/SEOHead';
import ImageUpload from '../components/ImageUpload';
import GalleryUpload from '../components/GalleryUpload';
import SmartImage from '../components/SmartImage';
import FieldError from '../components/FieldError';
import LocationPicker from '../components/LocationPicker';
import AIAssistantButton from '../components/AIAssistantButton';
import PropertyDocumentImporter from '../components/PropertyDocumentImporter';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { analyzeDescriptionLocal, DescriptionAnalysisResult } from '../lib/descriptionAnalyzer';
import { DECORATIVE_IMAGE, getHotelImage } from '../lib/images';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  CATEGORY_HINTS, COMMON_AMENITIES, DESCRIPTION_MAX, DESCRIPTION_MIN, ListingDraft,
  MALAWI_LOCATIONS, NAME_MAX, PROPERTY_CATEGORIES, PropertyCategory, createListing,
  emptyDraft, errorsForStep, hasDuplicateListing, isStepComplete, validateDraft,
  findExistingProperty, ExistingPropertyMatch,
} from '../lib/listing';
import { searchNominatim, searchMalawiPlaces, MalawiPlaceSuggestion, parseGoogleMapsPlaceUrl, reverseGeocodeCoordinates } from '../lib/geo';
import { RoomInput } from '../lib/validateRoom';
import { CURRENCIES, formatMoney } from '../lib/currency';
import { CurrencyCode } from '../types';
import { useWhatsAppSettings } from '../hooks/useWhatsAppSettings';
import { DEFAULT_PLATFORM_EMAIL } from '../lib/contact';
import { usePlatformMode } from '../contexts/PlatformModeContext';

/**
 * The wizard's draft. `tourismLicenceNumber` is optional and kept beside the
 * shared listing draft; it is written onto the hotel right after it is created.
 */
type WizardDraft = ListingDraft & { tourismLicenceNumber?: string };

const LICENCE_MAX = 60;

// Shared with the document importer so both round kwacha to MK 1,000.
import { roomPriceFields } from '../lib/localPropertyParser';

export interface SuggestedRoomItem {
  name: string;
  description: string;
  maxGuests: number;
  suggestedPriceUsd: number;
  suggestedPriceMwk: number;
  currencies: ('USD' | 'MWK')[];
  isCustomizing?: boolean;
}

export function normalizePropertyCategory(input?: string): PropertyCategory | null {
  if (!input) return null;
  const trimmed = input.trim();
  if ((PROPERTY_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed as PropertyCategory;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes('bed') || lower.includes('b&b') || lower.includes('breakfast') || lower.includes('homestay')) {
    return 'Bed & Breakfast';
  }
  if (lower.includes('cottage') || lower.includes('chalet') || lower.includes('cabin') || lower.includes('villa') || lower.includes('bungalow')) {
    return 'Cottage & Chalet';
  }
  if (lower.includes('guest') || lower.includes('guesthouse') || lower.includes('inn') || lower.includes('residency') || lower.includes('suites')) {
    return 'Guest House';
  }
  if (lower.includes('lake') || lower.includes('beach') || lower.includes('water') || lower.includes('shore') || lower.includes('island') || lower.includes('bay')) {
    return 'Lake & Beach';
  }
  if (lower.includes('safari') || lower.includes('wild') || lower.includes('game') || lower.includes('camp') || lower.includes('park') || lower.includes('reserve')) {
    return 'Safari & Wildlife';
  }
  if (lower.includes('luxur') || lower.includes('5-star') || lower.includes('five star') || lower.includes('retreat')) {
    return 'Luxury';
  }
  if (lower.includes('romant') || lower.includes('honeymoon') || lower.includes('couple')) {
    return 'Romantic Escape';
  }
  if (lower.includes('fam') || lower.includes('kid') || lower.includes('children')) {
    return 'Family';
  }
  if (lower.includes('advent') || lower.includes('hike') || lower.includes('hiking') || lower.includes('backpack')) {
    return 'Adventure';
  }
  return null;
}

export function inferCategoryFromNameAndLocation(name: string, location?: string): PropertyCategory {
  const text = `${name} ${location || ''}`.toLowerCase();
  if (text.includes('b&b') || text.includes('bed & breakfast') || text.includes('bed and breakfast') || text.includes('homestay') || text.includes('warm heart')) {
    return 'Bed & Breakfast';
  }
  if (text.includes('cottage') || text.includes('chalet') || text.includes('cabin') || text.includes('self-catering')) {
    return 'Cottage & Chalet';
  }
  if (text.includes('safari') || text.includes('camp') || text.includes('liwonde') || text.includes('majete') || text.includes('nyika') || text.includes('kasungu') || text.includes('lengwe')) {
    return 'Safari & Wildlife';
  }
  if (text.includes('lake') || text.includes('beach') || text.includes('maclear') || text.includes('senga') || text.includes('salima') || text.includes('likoma') || text.includes('nkhata') || text.includes('chintheche') || text.includes('monkey bay') || text.includes('mangochi')) {
    return 'Lake & Beach';
  }
  if (text.includes('mulanje') || text.includes('hiker') || text.includes('climb') || text.includes('backpacker') || text.includes('adventure')) {
    return 'Adventure';
  }
  if (text.includes('5-star') || text.includes('luxury') || text.includes('retreat')) {
    return 'Luxury';
  }
  if (text.includes('guest house') || text.includes('guesthouse') || text.includes('inn') || text.includes('residency') || text.includes('lilongwe') || text.includes('blantyre') || text.includes('mzuzu') || text.includes('zomba')) {
    return 'Guest House';
  }
  return 'Guest House';
}

export function authenticMalawianDescription(propName: string, category: PropertyCategory, loc: string): string {
  if (category === 'Lake & Beach') {
    return `Welcome to ${propName}. Nestled along the pristine shores of Lake Malawi in ${loc}, our property offers panoramic sunrise views over crystal-clear waters, private sandy beaches, and fresh Lake Chambo dining. Experience the Warm Heart of Africa with tranquil breezes, attentive local hospitality, and comfortable lakeside accommodations.`;
  }
  if (category === 'Safari & Wildlife') {
    return `Welcome to ${propName}. Situated in ${loc}, our bush retreat immerses you in Malawi's rich wilderness and wildlife. Enjoy guided game drives, tranquil evenings around the campfire under starry African skies, solar-powered comforts, and genuine Malawian warmth.`;
  }
  if (category === 'Romantic Escape' || category === 'Luxury') {
    return `Welcome to ${propName} in ${loc}, Malawi. A quiet, comfortable place to stay with attentive service and good local food.`;
  }
  if (category === 'Cottage & Chalet') {
    return `Welcome to ${propName}. Offering peaceful, self-contained chalets surrounded by scenic greenery in ${loc}, Malawi. Perfect for families and relaxing weekend getaways with private verandas, fully equipped amenities, secure grounds, and warm hospitality.`;
  }
  return `Welcome to ${propName}. Located in the vibrant heart of ${loc}, Malawi, we offer comfortable, well-appointed accommodations with high-speed Wi-Fi, reliable solar backup power, and genuine Warm Heart of Africa hospitality for both business and leisure travelers.`;
}

export function synthesizeRoomsForCategory(category: PropertyCategory) {
  if (category === 'Hotel') {
    return [
      { name: 'Standard King Room', description: 'Comfortable executive room with work desk, ensuite bathroom, and high-speed WiFi.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 4, amenities: ['Ensuite bathroom', 'Dedicated Workspace', 'Free WiFi', 'Hot shower', 'Air conditioning'] },
      { name: 'Deluxe Suite', description: 'Spacious suite with separate seating lounge, king bed, city view, and minibar.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 2, amenities: ['Ensuite bathroom', 'Air conditioning', 'Minibar', 'City view', 'Dedicated Workspace'] }
    ];
  }
  if (category === 'Resort') {
    return [
      { name: 'Lakeside Chalet', description: 'Scenic resort chalet steps away from the water with private veranda and king bed.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 4, amenities: ['Ensuite bathroom', 'Lake view', 'Balcony', 'Ceiling fan', 'Mosquito net'] },
      { name: 'Beachfront Family Chalet', description: 'Multi-room resort chalet ideal for families with direct beach access and lush gardens.', priceMwk: 0, priceUsd: 0, maxGuests: 4, baseGuests: 2, quantity: 2, amenities: ['Ensuite bathroom', 'Family rooms', 'Lake view', 'Private terrace', 'Breakfast included'] }
    ];
  }
  if (category === 'Lake & Beach') {
    return [
      { name: 'Standard Lakeview Chalet', description: 'Cozy private chalet overlooking Lake Malawi with ensuite bathroom and private veranda.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 4, amenities: ['Ensuite bathroom', 'Ceiling fan', 'Mosquito net', 'Balcony', 'Hot shower'] },
      { name: 'Executive Beach Suite', description: 'Spacious direct beach access suite with panoramic sunrise views, king bed, and mini-fridge.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 2, amenities: ['Ensuite bathroom', 'Air conditioning', 'Lake view', 'Mini-fridge', 'Private terrace'] }
    ];
  }
  if (category === 'Bed & Breakfast') {
    return [
      { name: 'Deluxe Garden Room (B&B)', description: 'Peaceful garden room with delicious home-cooked Malawian breakfast included and ensuite bath.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 3, amenities: ['Ensuite bathroom', 'Breakfast included', 'Ceiling fan', 'Hot water', 'Workspace'] },
      { name: 'Heritage Queen Suite', description: 'Charming queen room with handcrafted wood furnishings, private veranda, and warm breakfast.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 2, amenities: ['Ensuite bathroom', 'Breakfast included', 'Veranda', 'Mosquito net', 'Coffee maker'] }
    ];
  }
  if (category === 'Cottage & Chalet') {
    return [
      { name: 'Two-Bedroom Self-Catering Cottage', description: 'Fully equipped private cottage with kitchen, dining area, fireplace, and scenic patio.', priceMwk: 0, priceUsd: 0, maxGuests: 4, baseGuests: 2, quantity: 2, amenities: ['Kitchen', 'Ensuite bathroom', 'Fireplace', 'Dining area', 'Private patio', 'Backup power'] }
    ];
  }
  if (category === 'Safari & Wildlife') {
    return [
      { name: 'Luxury Safari Tent', description: 'Raised canvas tent overlooking the bush, ensuite open-air stone bathroom, and game view deck.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 4, amenities: ['Ensuite bathroom', 'Deck', 'Mosquito net', 'Bush view', 'Solar power'] }
    ];
  }
  if (category === 'Luxury') {
    return [
      { name: 'Presidential Lake Villa', description: 'Premier private villa with personal plunge pool, open-plan lounge, and breathtaking lake vistas.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 2, amenities: ['Private plunge pool', 'Ensuite bathroom', 'Air conditioning', 'Butler service', 'Lake view', 'Minibar'] }
    ];
  }
  return [
    { name: 'Executive Double Room', description: 'Modern, well-appointed guest room with work desk, high-speed WiFi, and hot power shower.', priceMwk: 0, priceUsd: 0, maxGuests: 2, baseGuests: 2, quantity: 4, amenities: ['Ensuite bathroom', 'Dedicated Workspace', 'Free WiFi', 'Hot shower', 'Backup power'] }
  ];
}

function getDraftStorageKey(uid?: string | null): string {
  return uid ? `travel_malawi_listing_draft_${uid}` : 'travel_malawi_listing_draft_guest';
}

export function getSteps(stayType?: string) {
  return [
    { title: 'Your property', blurb: 'Its name, type and where it is.', time: '~1 min' },
    { title: 'Description and amenities', blurb: 'What guests should know and what you offer.', time: '~1 min' },
    { title: 'Photos', blurb: 'A cover photo and a few more.', time: '~30 secs' },
    {
      title: stayType === 'entire_place' ? 'The place and its rate' : 'Rooms and rates',
      blurb: stayType === 'entire_place' ? 'How many guests and the nightly rate.' : 'Your room types and nightly rates.',
      time: '~1 min',
    },
    { title: 'Host and contacts', blurb: 'Who guests and our team can reach.', time: '~30 secs' },
    { title: 'Listing plan', blurb: 'Listing on Travel Malawi is free.', time: '~15 secs' },
    { title: 'Review and submit', blurb: 'Check everything, then send it for review.', time: '~15 secs' },
  ];
}

const STEPS = getSteps();

/** Every step that carries fields — used to find the first one still wrong. */
const FIELD_STEPS = [0, 1, 2, 3, 4];

/** Survives the round trip through a Google sign-in popup or page refresh, scoped to user. */
function readDraftForUser(uid?: string | null): WizardDraft {
  try {
    const key = getDraftStorageKey(uid);
    const stored = localStorage.getItem(key);
    if (stored) return { ...emptyDraft(), ...JSON.parse(stored) };
  } catch {
    // A corrupt draft is not worth reporting; start clean.
  }
  return emptyDraft();
}

// Mirrors tm-input as plain utilities so per-field padding overrides (pl-8/pl-11) still win.
const fieldClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 ' +
  'focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-700/20 leading-relaxed';

const textareaClass =
  fieldClass + ' ' +
  'min-h-[140px] resize-y overflow-y-auto scrollbar-thin scrollbar-thumb-stone-200 hover:scrollbar-thumb-stone-300';

const labelClass = 'tm-label';

export default function ListProperty() {
  const { whatsappEnabled } = useWhatsAppSettings();
  // Directory mode (the default): no bookings, payments or in-app chat are promised to hosts.
  const { bookingsEnabled } = usePlatformMode();
  const { user, loading: authLoading, becomeHost } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();

  const prevUserUidRef = useRef<string | undefined>(user?.uid);
  const [draft, setDraft] = useState<WizardDraft>(() => readDraftForUser(user?.uid));
  const [step, setStep] = useState(0);
  const [showWelcomeWalkthrough, setShowWelcomeWalkthrough] = useState<boolean>(() => {
    // If user has already typed a draft with name, location, or description, jump directly to the form
    const userDraft = readDraftForUser(user?.uid);
    if (userDraft.name || userDraft.location || userDraft.description) {
      return false;
    }
    // Check if user previously saw and dismissed the welcome screen
    try {
      return !localStorage.getItem('travel_malawi_seen_onboarding_welcome');
    } catch {
      return true;
    }
  });
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Licensing declaration: required before a listing can be sent for review.
  const [licensingAccepted, setLicensingAccepted] = useState(false);
  const [showLicensingError, setShowLicensingError] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [amenityInput, setAmenityInput] = useState('');
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [checkingPremium, setCheckingPremium] = useState(true);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Real-time Database Duplicate & AI/Maps Discovery State
  const [existingMatch, setExistingMatch] = useState<ExistingPropertyMatch | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  // Google Maps (Malawi) Autocomplete State
  const [placeSuggestions, setPlaceSuggestions] = useState<MalawiPlaceSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  const placeDropdownRef = useRef<HTMLDivElement>(null);

  const [aiLookupLoading, setAiLookupLoading] = useState(false);
  const [aiCategorized, setAiCategorized] = useState(false);
  const [aiPropertySuggestion, setAiPropertySuggestion] = useState<{
    matched: boolean;
    officialName: string;
    category?: PropertyCategory;
    location?: string;
    locationNotes?: string;
    description?: string;
    amenities?: string[];
    coordinates?: { lat: number; lng: number } | null;
    confidence?: string;
    summary?: string;
    checkInTime?: string;
    checkOutTime?: string;
    suggestedRooms?: Array<{
      name: string;
      description?: string;
      priceMwk?: number;
      priceUsd?: number;
      maxGuests?: number;
      baseGuests?: number;
      quantity?: number;
      amenities?: string[];
    }>;
    contactPhone?: string;
    contactEmail?: string;
    contactWhatsapp?: string;
    suggestedImageUrl?: string;
  } | null>(null);

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
  const [showPropertyImporter, setShowPropertyImporter] = useState(false);

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

  // Multi-user draft isolation & account synchronization
  useEffect(() => {
    const prevUid = prevUserUidRef.current;
    const currentUid = user?.uid;

    if (prevUid !== currentUid) {
      prevUserUidRef.current = currentUid;
      if (currentUid) {
        const userSavedDraft = readDraftForUser(currentUid);
        const hasExisting = Boolean(userSavedDraft.name || userSavedDraft.location || userSavedDraft.description);

        if (hasExisting) {
          // Switch to this user's stored draft
          setDraft(userSavedDraft);
        } else if (!prevUid) {
          // User just signed in from an anonymous guest session: adopt what was typed, but update manager details
          setDraft(curr => ({
            ...curr,
            managerName: user.displayName || curr.managerName,
            managerEmail: user.email || curr.managerEmail,
            contactEmail: user.email || curr.contactEmail,
            managerPhone: user.phone || curr.managerPhone,
            contactPhone: user.phone || curr.contactPhone,
          }));
        } else {
          // User switched accounts (from User A to User B)! Clear User A's data and start fresh for User B
          const fresh = emptyDraft();
          fresh.managerName = user.displayName || '';
          fresh.managerEmail = user.email || '';
          fresh.contactEmail = user.email || '';
          fresh.managerPhone = user.phone || '';
          fresh.contactPhone = user.phone || '';
          setDraft(fresh);
        }
      } else {
        // User logged out
        setDraft(emptyDraft());
      }
    }
  }, [user]);

  // Persist draft keyed strictly by active user
  useEffect(() => {
    try {
      const key = getDraftStorageKey(user?.uid);
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // Private browsing; the draft simply will not persist.
    }
  }, [draft, user?.uid]);

  // Pre-fill manager and contact details for signed-in host if empty
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

  // Explicitly discard draft and start fresh
  const handleDiscardDraft = () => {
    setShowDiscardConfirm(true);
  };

  const confirmDiscardDraft = () => {
    setShowDiscardConfirm(false);
    try {
      localStorage.removeItem(getDraftStorageKey(user?.uid));
    } catch {}
    const fresh = emptyDraft();
    if (user) {
      fresh.managerName = user.displayName || '';
      fresh.managerEmail = user.email || '';
      fresh.contactEmail = user.email || '';
      fresh.managerPhone = user.phone || '';
      fresh.contactPhone = user.phone || '';
    }
    setDraft(fresh);
    setStep(0);
    setExistingMatch(null);
    setAiPropertySuggestion(null);
    toast.success('Draft cleared. Starting fresh');
  };

  // Real-time check against Firestore database for duplicate or existing property
  useEffect(() => {
    const trimmed = draft.name.trim();
    if (trimmed.length < 3) {
      setExistingMatch(null);
      return;
    }

    setCheckingExisting(true);
    const timer = setTimeout(async () => {
      const result = await findExistingProperty(trimmed, draft.id);
      setExistingMatch(result);
      setCheckingExisting(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [draft.name, draft.id]);

  // Close place suggestions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (placeDropdownRef.current && !placeDropdownRef.current.contains(event.target as Node)) {
        setShowPlaceDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live autocomplete from Google Maps strictly within Malawi as user types
  useEffect(() => {
    const trimmed = draft.name.trim();
    if (trimmed.length < 2) {
      setPlaceSuggestions([]);
      setShowPlaceDropdown(false);
      return;
    }

    setSearchingPlaces(true);
    const timer = setTimeout(async () => {
      const results = await searchMalawiPlaces(trimmed, 6);
      setPlaceSuggestions(results);
      setShowPlaceDropdown(results.length > 0);
      setSearchingPlaces(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [draft.name]);

  // Handle selecting a place suggestion from Hospitality Registry / Maps dropdown
  const handleSelectMalawiPlace = (item: MalawiPlaceSuggestion, autoFillDetails: boolean = false) => {
    setShowPlaceDropdown(false);

    const targetCategory = (item.category || normalizePropertyCategory(item.category)) as PropertyCategory | undefined;
    const targetLocation = (item.location && item.location !== 'Malawi' ? item.location : draft.location) || 'Malawi';
    const targetCoords = item.coordinates;
    const targetNotes = item.locationNotes || (item.district ? `Located in ${item.district}, Malawi` : '');

    setDraft(prev => ({
      ...prev,
      name: item.name,
      category: targetCategory || prev.category,
      location: targetLocation,
      coordinates: targetCoords,
      locationNotes: prev.locationNotes || targetNotes,
    }));

    if (targetCategory) {
      setAiCategorized(true);
    }

    const p = item;

    const suggestionObj = {
      matched: true,
      officialName: item.name,
      category: targetCategory,
      location: targetLocation,
      locationNotes: targetNotes,
      description: p.description || authenticMalawianDescription(item.name, targetCategory || 'Bed & Breakfast', targetLocation),
      amenities: p.amenities && p.amenities.length > 0 ? p.amenities : COMMON_AMENITIES.slice(0, 8),
      coordinates: targetCoords,
      confidence: 'high' as const,
      summary: p.summary || `${item.name} in ${targetLocation}, Malawi.`,
      checkInTime: p.checkInTime || '14:00',
      checkOutTime: p.checkOutTime || '10:00',
      suggestedRooms: p.suggestedRooms || (targetCategory ? synthesizeRoomsForCategory(targetCategory) : []),
      // Never invent contacts: they are the only way travellers reach the property.
      contactPhone: p.contactPhone || '',
      contactEmail: p.contactEmail || user?.email || '',
      contactWhatsapp: p.contactWhatsapp || p.contactPhone || '',
    };

    setAiPropertySuggestion(suggestionObj);

    if (autoFillDetails) {
      setDraft(current => ({
        ...current,
        name: suggestionObj.officialName,
        category: (suggestionObj.category as PropertyCategory) || current.category,
        location: suggestionObj.location || current.location,
        locationNotes: suggestionObj.locationNotes || current.locationNotes,
        coordinates: suggestionObj.coordinates || current.coordinates,
        description: suggestionObj.description || current.description,
        amenities: suggestionObj.amenities ? Array.from(new Set([...current.amenities, ...suggestionObj.amenities])) : current.amenities,
        checkInTime: suggestionObj.checkInTime || current.checkInTime,
        checkOutTime: suggestionObj.checkOutTime || current.checkOutTime,
        contactPhone: current.contactPhone || suggestionObj.contactPhone,
        contactEmail: current.contactEmail || suggestionObj.contactEmail,
        contactWhatsapp: current.contactWhatsapp || suggestionObj.contactWhatsapp,
        managerName: current.managerName || user?.displayName || user?.email?.split('@')[0] || 'Property Host',
        managerEmail: current.managerEmail || user?.email || '',
        rooms: (current.rooms.length === 0 || (current.rooms.length === 1 && !current.rooms[0].name?.trim())) && suggestionObj.suggestedRooms.length > 0
          ? suggestionObj.suggestedRooms.map(r => {
              const maxG = Math.max(1, Number(r.maxGuests) || 2);
              return {
                id: uuidv4(),
                name: r.name,
                description: r.description || 'Authentic and comfortable stay with ensuite bathroom and warm Malawian hospitality.',
                // Only prices actually suggested — no invented defaults, no conversion.
                ...roomPriceFields(Number(r.priceUsd) || 0, Number(r.priceMwk) || 0),
                maxGuests: maxG,
                baseGuests: Math.min(Math.max(1, Number(r.baseGuests || maxG)), maxG),
                quantity: r.quantity || 3,
                amenities: r.amenities && r.amenities.length > 0 ? r.amenities : ['Ensuite bathroom', 'Ceiling fan', 'Mosquito net', 'Hot shower'],
              };
            })
          : current.rooms,
      }));
      toast.success(`Loaded verified details for "${item.name}"`);
      return;
    }

    if (item.source === 'registry') {
      toast.success(`Matched verified lodge "${item.name}" (${item.badge || item.category})`);
    } else if (item.source === 'smart_suggestion') {
      toast.success(`Applied naming idea "${item.name}"`);
    } else {
      toast.success(`Selected "${item.name}" in Malawi`);
    }
  };

  // Look up property on Maps, Knowledge Base & live Web Scraping
  const handleLookupPropertyAI = async (
    overrideName?: string,
    options?: { forceWebScrape?: boolean; url?: string; location?: string }
  ) => {
    const rawInput = (overrideName || draft.name).trim();
    if (!rawInput && !options?.url) {
      toast.error('Please enter a property name or website URL to look up from the web');
      return;
    }

    setAiLookupLoading(true);
    setAiPropertySuggestion(null);

    const isUrl = rawInput.startsWith('http://') || rawInput.startsWith('https://') || rawInput.startsWith('www.') || Boolean(options?.url);
    let targetUrl = options?.url;
    if (!targetUrl) {
      if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
        targetUrl = rawInput;
      } else if (rawInput.startsWith('www.')) {
        targetUrl = `https://${rawInput}`;
      }
    }

    let extractedBrandFromUrl = '';
    if (targetUrl) {
      try {
        const u = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
        const hostClean = u.hostname.replace(/^www\./i, '').split('.')[0];
        const pathSlug = u.pathname.split('/').filter(Boolean).pop() || '';
        const candidate = pathSlug && pathSlug.length > 3 && !/index|home|default|main/i.test(pathSlug) ? pathSlug : hostClean;
        extractedBrandFromUrl = candidate.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      } catch {}
    }

    const searchName = (isUrl && !overrideName)
      ? (draft.name && !draft.name.startsWith('http') && !draft.name.startsWith('www.') && draft.name !== 'Malawi Accommodation' ? draft.name : (extractedBrandFromUrl || 'Malawi Accommodation'))
      : (targetUrl && (rawInput.startsWith('http') || rawInput.startsWith('www.')) ? (extractedBrandFromUrl || 'Malawi Accommodation') : rawInput);

    try {
      const locationContext = options?.location || draft.location || undefined;
      const osmQuery = (searchName && searchName !== 'Malawi Accommodation') ? `${searchName} Malawi` : 'Malawi';
      
      // Concurrently query Nominatim/OpenStreetMap for coordinates and AI Knowledge Base/Web Scraper for property data
      const [osmResults, aiResult] = await Promise.all([
        searchNominatim(osmQuery, 3).catch(() => []),
        generateDetailed<{
          matched: boolean;
          officialName: string;
          category?: string;
          location?: string;
          locationNotes?: string;
          description?: string;
          amenities?: string[];
          coordinates?: { lat: number; lng: number } | null;
          confidence?: string;
          summary?: string;
          checkInTime?: string;
          checkOutTime?: string;
          suggestedRooms?: Array<{
            name: string;
            description?: string;
            priceMwk?: number;
            priceUsd?: number;
            maxGuests?: number;
            baseGuests?: number;
            quantity?: number;
            amenities?: string[];
          }>;
          contactPhone?: string;
          contactEmail?: string;
          contactWhatsapp?: string;
        }>({
          action: 'lookup_property',
          entityType: 'property',
          details: {
            name: searchName,
            url: targetUrl,
            location: locationContext,
            extraNotes: targetUrl
              ? `Live Web Extraction Request: Look up and extract authentic details from ${targetUrl}. Extract the real official full name (not website title or domain name), exact category (Hotel, Resort, Lodge, Cottage, Safari Camp, etc.), town/area, arrival directions, real room types with dual pricing (MWK & USD), base guests and max occupancy, welcoming description, verified amenities, check-in/out hours, and direct phone/email contacts.`
              : 'Search Google Maps, online listings, and live web sources across Malawi. Auto-categorize accurately (Hotel, Resort, Bed & Breakfast, Cottage & Chalet, Guest House, Lake & Beach, Safari & Wildlife, Luxury, Romantic Escape, Family, Adventure) and fill all fields.',
          },
        }),
      ]);

      const aiData = aiResult?.data;
      let matchedCoords: { lat: number; lng: number } | null = null;
      let matchedLocation = draft.location;

      if (osmResults && osmResults.length > 0) {
        matchedCoords = osmResults[0].coordinates;
        if (!matchedLocation || matchedLocation === 'Malawi') {
          const parts = osmResults[0].location.split(',');
          matchedLocation = parts.slice(0, 2).join(',').trim();
        }
      }

      if (aiData?.coordinates && (!matchedCoords || aiData.confidence === 'high')) {
        matchedCoords = aiData.coordinates;
      }

      // If we don't have coordinates yet, and AI gave an official name, query Nominatim for exact place
      if (!matchedCoords && aiData?.officialName && aiData.officialName !== 'Malawi Accommodation') {
        try {
          const placeResults = await searchNominatim(`${aiData.officialName} Malawi`, 1);
          if (placeResults && placeResults.length > 0) {
            matchedCoords = placeResults[0].coordinates;
            if (!matchedLocation || matchedLocation === 'Malawi') {
              matchedLocation = placeResults[0].location;
            }
          }
        } catch {}
      }

      const verifiedCategory =
        normalizePropertyCategory(aiData?.category) ||
        inferCategoryFromNameAndLocation(aiData?.officialName || searchName, aiData?.location || matchedLocation);

      let rawRooms = aiData?.suggestedRooms;
      if (!rawRooms || !Array.isArray(rawRooms) || rawRooms.length === 0) {
        rawRooms = synthesizeRoomsForCategory(verifiedCategory);
      }
      const rooms = rawRooms.map(r => {
        const maxG = Math.max(1, Number(r.maxGuests) || 2);
        return {
          ...r,
          maxGuests: maxG,
          baseGuests: Math.min(Math.max(1, Number(r.baseGuests || maxG)), maxG),
        };
      });

      const finalOfficialName = (aiData?.officialName && !aiData.officialName.startsWith('http') && !aiData.officialName.startsWith('www.') && aiData.officialName !== 'Malawi Accommodation')
        ? aiData.officialName
        : (extractedBrandFromUrl || (searchName !== 'Malawi Accommodation' ? searchName : 'Malawi Stay'));

      let finalLocation = (aiData?.location && aiData.location !== 'Malawi')
        ? aiData.location
        : (matchedLocation || draft.location || 'Malawi');

      let resolvedNotes = aiData?.locationNotes || '';

      // If we have coordinates, reverse geocode to verify authentic Malawian town/area and arrival directions
      if (matchedCoords) {
        try {
          const rev = await reverseGeocodeCoordinates(matchedCoords);
          if (rev.location && (finalLocation === 'Malawi' || !aiData?.location)) {
            finalLocation = rev.location;
          }
          if (rev.locationNotes && !resolvedNotes) {
            resolvedNotes = rev.locationNotes;
          }
        } catch {}
      }

      if (aiData && (aiData.matched || aiData.officialName || isUrl)) {
        const suggestion = {
          matched: aiData.matched ?? true,
          officialName: finalOfficialName,
          category: verifiedCategory,
          location: finalLocation,
          locationNotes: resolvedNotes,
          description: aiData.description || authenticMalawianDescription(finalOfficialName, verifiedCategory, finalLocation),
          amenities: Array.isArray(aiData.amenities) && aiData.amenities.length > 0 ? aiData.amenities : COMMON_AMENITIES.slice(0, 8),
          coordinates: matchedCoords,
          confidence: aiData.confidence || 'high',
          summary: aiData.summary || `Authentic accommodation in ${finalLocation} providing comfortable stays for leisure and business guests.`,
          checkInTime: aiData.checkInTime || '14:00',
          checkOutTime: aiData.checkOutTime || '10:00',
          suggestedRooms: rooms,
          contactPhone: aiData.contactPhone || '',
          contactEmail: aiData.contactEmail || user?.email || '',
          contactWhatsapp: aiData.contactWhatsapp || aiData.contactPhone || '',
        };
        setAiPropertySuggestion(suggestion);

        // Directly autofill draft if web URL was entered or forceWebScrape was requested
        if (isUrl || options?.forceWebScrape) {
          setDraft(prev => ({
            ...prev,
            name: finalOfficialName,
            category: verifiedCategory || prev.category,
            location: finalLocation || prev.location,
            locationNotes: resolvedNotes || prev.locationNotes,
            coordinates: matchedCoords || prev.coordinates,
            description: suggestion.description || prev.description,
            amenities: suggestion.amenities.length > 0 ? suggestion.amenities : prev.amenities,
            contactPhone: suggestion.contactPhone || prev.contactPhone,
            contactEmail: suggestion.contactEmail || prev.contactEmail,
            contactWhatsapp: suggestion.contactWhatsapp || prev.contactWhatsapp,
            checkInTime: suggestion.checkInTime || prev.checkInTime,
            checkOutTime: suggestion.checkOutTime || prev.checkOutTime,
            rooms: rooms.length > 0 ? rooms.map((r, i) => {
              const usd = Number(r.priceUsd || 0);
              const mwk = Number(r.priceMwk || 0);
              return {
                id: `room-${Date.now()}-${i}`,
                name: r.name,
                description: r.description || '',
                priceMwk: mwk,
                priceUsd: usd,
                ...roomPriceFields(usd, mwk),
                maxGuests: r.maxGuests || 2,
                baseGuests: Math.min(r.baseGuests || 2, r.maxGuests || 2),
                quantity: r.quantity || 1,
                amenities: r.amenities || ['Ensuite bathroom'],
                images: [],
              };
            }) : prev.rooms,
          }));
          setAiCategorized(true);
          const hasImportedPrice = rooms.some(r => Number(r.priceUsd || 0) > 0 || Number(r.priceMwk || 0) > 0);
          if (hasImportedPrice) {
            toast.success(`Imported "${finalOfficialName}" in ${finalLocation} with listed rates (${verifiedCategory})`, { duration: 6000 });
          } else {
            toast.success(`Imported "${finalOfficialName}" in ${finalLocation} (${verifiedCategory})! Set room rates manually on Step 4.`, { duration: 6000 });
          }
        } else {
          toast.success(`Draft Assistant matched "${finalOfficialName}" & auto-categorized as "${verifiedCategory}"`);
        }
      } else if (matchedCoords || searchName) {
        const suggestion = {
          matched: true,
          officialName: finalOfficialName,
          category: verifiedCategory,
          location: finalLocation,
          locationNotes: resolvedNotes || `Located in ${finalLocation}`,
          description: authenticMalawianDescription(finalOfficialName, verifiedCategory, finalLocation),
          amenities: COMMON_AMENITIES.slice(0, 6),
          coordinates: matchedCoords,
          confidence: 'medium',
          summary: `Identified and verified stay in ${finalLocation}.`,
          checkInTime: '14:00',
          checkOutTime: '10:00',
          suggestedRooms: rooms,
          contactPhone: '',
          contactEmail: user?.email || '',
          contactWhatsapp: '',
        };
        setAiPropertySuggestion(suggestion);
        if (isUrl) {
          setDraft(prev => ({
            ...prev,
            name: finalOfficialName,
            category: verifiedCategory || prev.category,
            location: finalLocation || prev.location,
            coordinates: matchedCoords || prev.coordinates,
            locationNotes: resolvedNotes || prev.locationNotes,
          }));
        }
        toast.success(`Draft Assistant prepared details & auto-categorized as "${verifiedCategory}"`);
      } else {
        toast('No verified listing found on Maps. You can enter details manually.', { icon: 'ℹ️' });
      }
    } catch (err: any) {
      console.error('Property lookup error:', err);
      toast.error('Could not complete property lookup. You can continue manually.');
    } finally {
      setAiLookupLoading(false);
    }
  };

  // 1-Click apply AI & Maps suggestion
  const handleApplyAISuggestion = (applyAllFields: boolean = true) => {
    if (!aiPropertySuggestion) return;
    const s = aiPropertySuggestion;

    setDraft(current => {
      const next = { ...current };
      if (s.officialName) next.name = s.officialName;
      if (s.category && (PROPERTY_CATEGORIES as readonly string[]).includes(s.category)) {
        next.category = s.category;
        setAiCategorized(true);
      }
      if (s.location) next.location = s.location;
      if (s.locationNotes) next.locationNotes = s.locationNotes;
      if (s.coordinates) next.coordinates = s.coordinates;

      if (applyAllFields) {
        // Auto-fill Description
        if (s.description) {
          next.description = s.description;
        }
        // Auto-fill Amenities
        if (s.amenities && s.amenities.length > 0) {
          next.amenities = Array.from(new Set([...current.amenities, ...s.amenities]));
        }
        // Auto-fill Check-In & Check-Out times
        if (s.checkInTime) next.checkInTime = s.checkInTime;
        if (s.checkOutTime) next.checkOutTime = s.checkOutTime;

        // Auto-fill Contact & Manager details
        if (s.contactPhone && !current.contactPhone) next.contactPhone = s.contactPhone;
        if (s.contactEmail && !current.contactEmail) next.contactEmail = s.contactEmail;
        if (s.contactWhatsapp && !current.contactWhatsapp) next.contactWhatsapp = s.contactWhatsapp || s.contactPhone || '';

        if (!next.managerName) {
          next.managerName = user?.displayName || user?.email?.split('@')[0] || 'Property Host';
        }
        if (!next.managerEmail && user?.email) {
          next.managerEmail = user.email;
        }

        const currentRoomsEmpty = current.rooms.length === 0 || (current.rooms.length === 1 && !current.rooms[0].name?.trim());
        if (currentRoomsEmpty && s.suggestedRooms && s.suggestedRooms.length > 0) {
          next.rooms = s.suggestedRooms.map(r => {
            const maxG = Math.max(1, Number(r.maxGuests) || 2);
            const usd = Number(r.priceUsd || 0);
            const mwk = Number(r.priceMwk || 0);
            return {
              id: uuidv4(),
              name: r.name,
              description: r.description || `Authentic and comfortable stay with ensuite bathroom, ceiling fan, and warm Malawian hospitality.`,
              ...roomPriceFields(usd, mwk),
              maxGuests: maxG,
              baseGuests: Math.min(Math.max(1, Number(r.baseGuests || maxG)), maxG),
              quantity: r.quantity || 1,
              amenities: r.amenities && r.amenities.length > 0 ? r.amenities : ['Ensuite bathroom', 'Ceiling fan', 'Mosquito net', 'Hot shower'],
            };
          });
        } else if (next.rooms && next.rooms.length > 0) {
          next.rooms = next.rooms.map(r => {
            const maxG = Math.max(1, Number(r.maxGuests) || 1);
            return {
              ...r,
              maxGuests: maxG,
              baseGuests: Math.min(Math.max(1, Number(r.baseGuests || maxG)), maxG),
            };
          });
        }
      }

      return next;
    });

    if (applyAllFields) {
      toast.success(`Draft Assistant filled all listing fields! Auto-categorized as "${s.category}". Review any details across the steps.`);
    } else {
      toast.success(`Applied verified details for "${s.officialName}"`);
    }
    setAiPropertySuggestion(null);
  };

  const set = useCallback(<K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  }, []);

  const steps = useMemo(() => getSteps(draft.stayType), [draft.stayType]);
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
    setStep(s => Math.min(steps.length - 1, s + 1));
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
  const [linkingDescription, setLinkingDescription] = useState(false);

  const handleLinkDescription = async () => {
    const desc = draft.description?.trim();
    if (!desc) {
      toast.error('Write or paste a description first to link amenities and category.');
      return;
    }
    setLinkingDescription(true);
    try {
      let matchedCats: PropertyCategory[] = [];
      let matchedAmens: string[] = [];

      if (aiStatus.enabled && aiStatus.available) {
        const res = await generateDetailed<DescriptionAnalysisResult>({
          action: 'link_description_to_amenities_and_category',
          entityType: 'property',
          currentText: desc,
          details: {
            name: draft.name,
            location: draft.location,
          },
        });
        if (res?.data) {
          matchedCats = res.data.categories || [];
          matchedAmens = res.data.matchedAmenities || [];
        }
      }

      if (matchedCats.length === 0 && matchedAmens.length === 0) {
        const local = analyzeDescriptionLocal(desc, draft.name, draft.location);
        matchedCats = local.categories;
        matchedAmens = local.matchedAmenities;
      }

      if (matchedCats.length > 0 && !draft.category) {
        set('category', matchedCats[0]);
      }
      if (matchedAmens.length > 0) {
        const currentAmens = draft.amenities || [];
        const combined = Array.from(new Set([...currentAmens, ...matchedAmens]));
        set('amenities', combined);
      }

      toast.success(`Linked ${matchedAmens.length} amenities and category '${matchedCats[0] || draft.category}' from description`);
    } catch {
      const local = analyzeDescriptionLocal(desc, draft.name, draft.location);
      if (local.categories.length > 0 && !draft.category) {
        set('category', local.categories[0]);
      }
      if (local.matchedAmenities.length > 0) {
        const combined = Array.from(new Set([...(draft.amenities || []), ...local.matchedAmenities]));
        set('amenities', combined);
      }
      toast.success(`Linked ${local.matchedAmenities.length} amenities from description`);
    } finally {
      setLinkingDescription(false);
    }
  };

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
          // Only what the suggestion priced; the other currency is never converted.
          const usd = Number(item.suggestedPriceUsd) || 0;
          const mwk = Number(item.suggestedPriceMwk) || 0;
          return {
            name: item.name || 'Standard Room',
            description: item.description || '',
            maxGuests: Number(item.maxGuests) || 2,
            suggestedPriceUsd: usd,
            suggestedPriceMwk: mwk,
            currencies: roomPriceFields(usd, mwk).currencies,
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
        const newUsd = Math.max(5, (item.suggestedPriceUsd || 0) + delta);
        next[index] = { ...item, suggestedPriceUsd: newUsd };
      } else {
        const newMwk = Math.max(1000, (item.suggestedPriceMwk || 0) + delta);
        next[index] = { ...item, suggestedPriceMwk: newMwk };
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
        toast.success('Description enhanced');
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

    // Unpriced currencies stay empty for the host to fill (no defaults, no conversion).
    const prices: Partial<Record<CurrencyCode, number>> = {};
    if (currencies.includes('USD') && Number(item.suggestedPriceUsd) > 0) {
      prices.USD = Number(item.suggestedPriceUsd);
    }
    if (currencies.includes('MWK') && Number(item.suggestedPriceMwk) > 0) {
      prices.MWK = Number(item.suggestedPriceMwk);
    }

    const maxG = Math.max(1, Number(item.maxGuests) || 2);
    const newRoom: RoomInput = {
      id: crypto.randomUUID(),
      name: item.name.trim() || 'Guest Room',
      description: item.description?.trim() || '',
      currencies,
      prices,
      maxGuests: maxG,
      baseGuests: maxG,
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
      if (currencies.includes('USD') && Number(item.suggestedPriceUsd) > 0) {
        prices.USD = Number(item.suggestedPriceUsd);
      }
      if (currencies.includes('MWK') && Number(item.suggestedPriceMwk) > 0) {
        prices.MWK = Number(item.suggestedPriceMwk);
      }

      const maxG = Math.max(1, Number(item.maxGuests) || 2);
      return {
        id: crypto.randomUUID(),
        name: item.name.trim() || 'Guest Room',
        description: item.description?.trim() || '',
        currencies,
        prices,
        maxGuests: maxG,
        baseGuests: maxG,
        quantity: 1,
        imageUrl: '',
        galleryUrls: [],
      };
    });
    set('rooms', [...(draft.rooms || []), ...newRooms]);
    setSuggestedRooms([]);
    toast.success(`Added ${newRooms.length} room types with dual-currency rates`);
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
        // Each currency only as suggested — never converted or defaulted.
        setAiRateData({
          usd: Number(res.data.suggestedPriceUsd) || 0,
          mwk: Number(res.data.suggestedPriceMwk) || 0,
          reasoning: res.data.reasoning || `Recommended rates for ${room.name || 'this room'} based on local Malawian hospitality standards.`,
        });
      } else {
        toast.error('No rate suggestion available right now. Please enter your own rates.');
        setAiRateRoomIdx(null);
      }
    } catch {
      toast.error('Could not fetch rate recommendation');
    } finally {
      setAiRateLoading(false);
    }
  };

  const handleApplyAIRates = (roomIdx: number) => {
    if (!aiRateData) return;
    const updated = [...(draft.rooms || [])];
    const room = updated[roomIdx];
    if (!room) return;

    const suggested: Partial<Record<CurrencyCode, number>> = {};
    if (aiRateData.usd > 0) suggested.USD = aiRateData.usd;
    if (aiRateData.mwk > 0) suggested.MWK = aiRateData.mwk;
    const currs: CurrencyCode[] = Array.from(new Set([...(room.currencies || []), ...(Object.keys(suggested) as CurrencyCode[])]));
    updated[roomIdx] = {
      ...room,
      currencies: currs,
      prices: { ...room.prices, ...suggested },
    };
    set('rooms', updated);
    setAiRateRoomIdx(null);
    setAiRateData(null);
    const applied = [suggested.USD ? `$${suggested.USD} USD` : '', suggested.MWK ? `MK ${suggested.MWK.toLocaleString()}` : ''].filter(Boolean).join(' & ');
    toast.success(`Applied ${applied} to ${room.name || 'room'}`);
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

    // Auto-ensure the user has the host role so they never get blocked by permissions error
    if (!isHost && !user.isShadowed) {
      try {
        await becomeHost();
      } catch (err: any) {
        console.warn('Auto becomeHost on submit:', err);
      }
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

    if (!licensingAccepted) {
      setShowLicensingError(true);
      toast.error('Please confirm the licensing declaration before sending.');
      setTimeout(() => document.getElementById('listing-licensing-declaration')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }

    setSubmitting(true);
    try {
      // Guards against a double submit creating two copies of the property,
      // which then had to be moderated and deleted by hand.
      const lookupUid = user.uid.startsWith('shadow_host_')
        ? (auth.currentUser?.uid || user.uid)
        : user.uid;
      if (await hasDuplicateListing(lookupUid, draft.name)) {
        toast.error('You already have a property listed under that name.');
        setStep(0);
        setShowErrors(true);
        setTimeout(() => document.querySelector('p[role="alert"].text-red-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
      }

      const id = await createListing(draft, user.uid);

      // Optional licence number and the licensing declaration: the shared
      // draft→hotel mapping does not carry them, so they are added once the
      // listing exists (manager may edit while pending).
      const licence = (draft.tourismLicenceNumber ?? '').trim().slice(0, LICENCE_MAX);
      try {
        await updateDoc(doc(db, 'hotels', id), {
          licensingAcknowledgedAt: new Date().toISOString(),
          ...(licence ? { tourismLicenceNumber: licence } : {}),
        });
      } catch (licenceErr) {
        console.warn('[Onboarding] Could not save licensing details:', licenceErr);
        if (licence) {
          toast.error('Your listing was sent, but the licence number was not saved. Add it from your property page.');
        }
      }

      // Immediately dispatch onboarding welcome & login instructions email to property owner
      try {
        const token = await auth.currentUser?.getIdToken();
        const ownerEmailToSend = draft.ownerEmail.trim() || draft.managerEmail.trim() || draft.contactEmail.trim() || user.email;
        if (ownerEmailToSend) {
          fetch('/api/onboarding/send-welcome', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              hotelId: id,
              propertyName: draft.name,
              ownerEmail: ownerEmailToSend,
              ownerName: draft.ownerName || draft.managerName || user.displayName,
              managerEmail: draft.managerEmail || user.email,
              managerName: draft.managerName || user.displayName,
              location: draft.location,
              category: draft.category,
              stayType: draft.stayType,
            }),
          }).then(res => res.json()).then(result => {
            if (result?.sent) {
              const sentTo = Array.isArray(result.recipients) && result.recipients.length > 0
                ? result.recipients.join(', ')
                : ownerEmailToSend;
              toast.success(`Set-your-password link & listing preview sent to ${sentTo}`, { duration: 5000 });
            }
          }).catch(err => {
            console.warn('[Onboarding] Could not dispatch welcome email:', err);
          });
        }
      } catch (emailErr) {
        console.warn('[Onboarding] Welcome email token error:', emailErr);
      }

      try {
        localStorage.removeItem(getDraftStorageKey(user.uid));
      } catch {
        // Nothing to do; the draft is replaced on the next listing anyway.
      }
      setDraft(emptyDraft());
      
      const hasRooms = (draft.rooms && draft.rooms.length > 0) || draft.stayType === 'entire_place';
      if (hasRooms) {
        toast.success('Property and rooms submitted for review! Opening your management hub.', { duration: 6000 });
        navigate(`/dashboard/hotel/${id}`);
      } else {
        toast.success('Submitted for review. Add your rooms now so travellers can see them.', { duration: 6000 });
        navigate(`/dashboard/hotel/${id}?tab=rooms`);
      }
    } catch (error: any) {
      console.error('Could not create listing:', error);
      const specificError = error?.code === 'permission-denied'
        ? 'Your account is not allowed to publish listings yet.'
        : (error?.message ? `Submission failed: ${error.message}` : 'Could not submit the property. Please try again.');
      toast.error(specificError);
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

  if (showWelcomeWalkthrough) {
    return (
      <OnboardingWelcomeWalkthrough
        user={user}
        enabling={enabling}
        hasAI={Boolean(aiStatus.enabled && aiStatus.available)}
        onStart={() => {
          setShowWelcomeWalkthrough(false);
          try {
            localStorage.setItem('travel_malawi_seen_onboarding_welcome', '1');
          } catch {}
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onImportDocument={() => {
          setShowWelcomeWalkthrough(false);
          setShowPropertyImporter(true);
        }}
      />
    );
  }

  // ---- The wizard (Unified for both guests and authenticated hosts) ----
  return (
    <div className="bg-stone-50">
      <SEOHead
        title="List Your Property — Join Travel Malawi Hospitality Platform"
        description="List your lodge, boutique hotel, B&B, or Lake Malawi cottage on Travel Malawi. Free to list, and travellers contact you directly to plan their stay."
        keywords="list property Malawi, host lodge Malawi, lodge onboarding Malawi, hotel management Malawi, Travel Malawi partner"
        url="https://ulendomalawi.com/list-your-property"
      />
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-12">
        {/* Streamlined Top Control Bar */}
        <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (user && isHost) {
                navigate('/dashboard');
              } else {
                navigate('/');
              }
            }}
            className="tm-btn tm-btn-quiet tm-btn-sm -ml-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{user && isHost ? 'Dashboard' : 'Explore stays'}</span>
          </button>

          <div className="tm-actions">
            <button
              type="button"
              onClick={() => setShowPropertyImporter(true)}
              className="tm-btn tm-btn-secondary tm-btn-sm"
              title="Fill the form from a brochure or rate sheet"
            >
              <FileText className="w-3.5 h-3.5 text-stone-600" />
              <span className="sm:hidden">Import</span>
              <span className="hidden sm:inline">Import from document</span>
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="tm-btn tm-btn-quiet tm-btn-sm hover:text-red-700"
              title="Clear all fields and start a fresh draft"
              aria-label="Discard draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Discard</span>
            </button>
          </div>
        </div>

        {/* Hospitable Welcome Banner for Unauthenticated Visitors */}
        {!user && (
          <div className="mb-4 sm:mb-6 px-3.5 py-2.5 rounded-xl bg-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-700">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-stone-900 shrink-0">Takulandirani.</span>
              <span className="sm:whitespace-normal">Listing is free. Your draft is saved on this device.</span>
            </div>
            <button
              type="button"
              onClick={() => openAuth('host')}
              className="tm-link text-xs whitespace-nowrap cursor-pointer self-start sm:self-auto shrink-0"
            >
              Sign in to keep it
            </button>
          </div>
        )}

        {/* Upgrade Banner for Logged-In Guests Becoming Hosts */}
        {user && !isHost && (
          <div className="mb-4 sm:mb-6 p-4 rounded-xl bg-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <h3 className="font-semibold text-sm text-stone-900">
                Turn on hosting for this account
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed break-words">
                Signed in as <strong>{user.displayName || user.email}</strong>. You need hosting on to list a property.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnableHosting}
              disabled={enabling}
              className="tm-btn tm-btn-secondary tm-btn-sm shrink-0 self-start sm:self-auto"
            >
              {enabling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
              <span>Turn on hosting</span>
            </button>
          </div>
        )}

        {/* Clean, Unified Step Header & Stepper */}
        <header className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-stone-500">
              Step {step + 1} of {steps.length}
            </span>
            <span className="text-xs text-stone-400">
              Your draft saves as you go
            </span>
          </div>

          {/* Interactive Stepper Bar */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-3">
            {steps.map((s, index) => {
              const done = index < step && isStepComplete(draft, index);
              const active = index === step;
              const reachable = index <= step || FIELD_STEPS.slice(0, index).every(i => isStepComplete(draft, i));
              return (
                <button
                  key={`step-progress-${index}`}
                  type="button"
                  disabled={!reachable}
                  onClick={() => { if (reachable) { setShowErrors(false); setStep(index); } }}
                  className="group py-1 text-left disabled:cursor-not-allowed cursor-pointer"
                  title={`Step ${index + 1}: ${s.title}`}
                >
                  <div
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      active ? 'bg-stone-900' : done ? 'bg-stone-700' : 'bg-stone-200 group-hover:bg-stone-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <h1 className="tm-h1">
            {steps[step].title}
          </h1>
          <p className="mt-1 tm-lead">
            {steps[step].blurb}
          </p>
        </header>

        <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6 md:p-8">
          {step === 0 && (
            <div className="space-y-8">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs sm:text-sm text-amber-950 leading-relaxed">
                <Shield className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">Before you list:</span> your property must hold the licences and permits Malawian law requires, including a tourism operating licence under the Tourism Act, 2025 where it applies. Getting and keeping them is the owner's responsibility; Travel Malawi does not issue or verify licences. You will be asked to confirm this before sending your listing.
                </p>
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className={labelClass} htmlFor="listing-name">Property name</label>
                  <div className="flex items-center gap-2">
                    {aiStatus.enabled && aiStatus.available && (
                      <button
                        type="button"
                        onClick={() => handleLookupPropertyAI(draft.name, { forceWebScrape: true })}
                        disabled={aiLookupLoading || !draft.name.trim()}
                        className="tm-btn tm-btn-secondary tm-btn-sm"
                        title="Fill in details from your website or Google listing"
                      >
                        {aiLookupLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-stone-600" />
                        )}
                        <span>{aiLookupLoading ? 'Looking up…' : 'Fill in from the web'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <input
                    id="listing-name"
                    type="text"
                    maxLength={NAME_MAX}
                    value={draft.name}
                    onChange={e => {
                      const val = e.target.value;
                      const gmaps = parseGoogleMapsPlaceUrl(val);
                      if (gmaps && (gmaps.name || gmaps.coordinates)) {
                        const extractedName = gmaps.name || (draft.name !== 'Malawi Accommodation' ? draft.name : '');
                        if (extractedName) set('name', extractedName);
                        if (gmaps.coordinates) {
                          set('coordinates', gmaps.coordinates);
                          reverseGeocodeCoordinates(gmaps.coordinates).then(geo => {
                            if (geo.location) set('location', geo.location);
                            if (geo.locationNotes) set('locationNotes', geo.locationNotes);
                          }).catch(() => {});
                        }
                        toast.success(
                          extractedName
                            ? `Got "${extractedName}" and the map pin from Google Maps`
                            : `Got the map pin from Google Maps`,
                          { icon: '📍' }
                        );
                        if (extractedName) {
                          handleLookupPropertyAI(extractedName);
                        }
                        return;
                      }
                      const trimmedVal = val.trim();
                      const isWebLink = trimmedVal.startsWith('http://') || trimmedVal.startsWith('https://') || trimmedVal.startsWith('www.');
                      if (isWebLink && aiStatus.enabled && aiStatus.available) {
                        let initialBrand = '';
                        try {
                          const u = new URL(trimmedVal.startsWith('http') ? trimmedVal : `https://${trimmedVal}`);
                          const hostClean = u.hostname.replace(/^www\./i, '').split('.')[0];
                          const pathSlug = u.pathname.split('/').filter(Boolean).pop() || '';
                          const candidate = pathSlug && pathSlug.length > 3 && !/index|home|default|main/i.test(pathSlug) ? pathSlug : hostClean;
                          initialBrand = candidate.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                        } catch {}
                        set('name', initialBrand || 'Looking up…');
                        toast('Website link found. Looking up the name, location, rates and amenities…');
                        const norm = trimmedVal.startsWith('www.') ? `https://${trimmedVal}` : trimmedVal;
                        handleLookupPropertyAI(trimmedVal, { forceWebScrape: true, url: norm });
                        return;
                      }
                      set('name', val);
                    }}
                    placeholder="e.g. Example Lakeside Lodge, or paste website / Maps link"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <div className="absolute right-3.5 top-3.5 flex items-center gap-2">
                    {(checkingExisting || searchingPlaces) ? (
                      <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                    ) : (
                      <MapPin className="w-4 h-4 text-stone-300" />
                    )}
                  </div>

                  {/* Malawi Hospitality Registry & Geographic Discovery Dropdown */}
                  {showPlaceDropdown && placeSuggestions.length > 0 && (
                    <div
                      ref={placeDropdownRef}
                      className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden animate-in fade-in slide-in-from-top-1"
                    >
                      <div className="px-4 py-2 bg-stone-50 text-stone-600 border-b border-stone-200 flex items-center justify-between text-xs font-medium">
                        <span>Matches in Malawi</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-stone-400">
                            {placeSuggestions.length} found
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPlaceDropdown(false)}
                            className="text-stone-400 hover:text-stone-700 p-0.5 rounded-lg hover:bg-stone-100 transition"
                            title="Close suggestions"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <ul className="max-h-72 overflow-y-auto divide-y divide-stone-100">
                        {placeSuggestions.map((item, psIdx) => {
                          const isReg = item.source === 'registry';
                          const isIdea = item.source === 'smart_suggestion';

                          return (
                            <li
                              key={`place-sug-${item.id || psIdx}-${psIdx}`}
                              className="p-2.5 hover:bg-stone-50 transition flex items-center justify-between gap-3 group"
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectMalawiPlace(item)}
                                className="flex-1 text-left flex items-start gap-3 min-w-0 cursor-pointer"
                              >
                                <div className="shrink-0 mt-0.5">
                                  {isReg || isIdea ? (
                                    <Building2 className="w-4 h-4 text-stone-500" />
                                  ) : (
                                    <MapPin className="w-4 h-4 text-stone-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-semibold text-stone-900 group-hover:text-stone-950 truncate">
                                      {item.name}
                                    </p>
                                    {isReg && (
                                      <span className="tm-tag">
                                        Listed
                                      </span>
                                    )}
                                    {isIdea && (
                                      <span className="tm-tag">
                                        Name idea
                                      </span>
                                    )}
                                    {item.category && (
                                      <span className="tm-tag">
                                        {item.category}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-stone-500 group-hover:text-stone-700 truncate mt-0.5">
                                    {isIdea && item.description ? item.description : item.location}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectMalawiPlace(item, true);
                                }}
                                className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                                title="Fill in the details for this place"
                              >
                                <Check className="w-3 h-3" />
                                <span>Use</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Duplicate / Existing Property Warning */}
                {existingMatch?.exists && (
                  <div className="mt-3 p-3.5 rounded-xl bg-amber-50 text-amber-900 text-xs flex items-start gap-3 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">
                        This property is already listed
                      </p>
                      <p className="mt-0.5 leading-relaxed break-words">
                        "{existingMatch.hotel?.name}" in {existingMatch.hotel?.location} is on Travel Malawi ({existingMatch.hotel?.status || 'pending'}).
                        If it is yours, sign in with the account that listed it, or contact support.
                      </p>
                    </div>
                  </div>
                )}

                {/* Discovered Property Card */}
                {aiPropertySuggestion && (
                  <div className="mt-4 p-4 sm:p-5 rounded-xl bg-stone-50 text-stone-800 animate-in fade-in space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="tm-tag tm-tag-good">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Details found</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAiPropertySuggestion(null)}
                        className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-200/60 transition cursor-pointer"
                        title="Dismiss suggestion"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <h4 className="tm-h2 break-words">
                          {aiPropertySuggestion.officialName}
                        </h4>
                        {aiPropertySuggestion.category && (
                          <span className="tm-tag">
                            {aiPropertySuggestion.category}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        {aiPropertySuggestion.location && (
                          <span className="tm-tag">
                            <MapPin className="w-3 h-3 text-stone-500" />
                            {aiPropertySuggestion.location}
                          </span>
                        )}
                        {aiPropertySuggestion.coordinates && (
                          <span className="tm-tag">
                            <CheckCircle2 className="w-3 h-3 text-stone-600" />
                            Map pin found
                          </span>
                        )}
                      </div>
                    </div>

                    {aiPropertySuggestion.summary && (
                      <p className="text-xs text-stone-600 leading-relaxed italic">
                        "{aiPropertySuggestion.summary}"
                      </p>
                    )}

                    <div className="pt-1 tm-actions">
                      <button
                        type="button"
                        onClick={() => handleApplyAISuggestion(true)}
                        className="tm-btn tm-btn-secondary tm-btn-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Use details and rooms</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyAISuggestion(false)}
                        className="tm-btn tm-btn-quiet tm-btn-sm"
                      >
                        <span>Name and location only</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiPropertySuggestion(null)}
                        className="tm-btn tm-btn-quiet tm-btn-sm"
                      >
                        I'll type it myself
                      </button>
                    </div>
                  </div>
                )}

                <FieldError message={visible.name} />
              </div>

              {/* Stay Type: Room-by-Room vs Whole House / Entire Place */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={labelClass}>How do guests stay?</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={draft.stayType !== 'entire_place'}
                    onClick={() => set('stayType', 'rooms')}
                    className={`relative rounded-xl border p-4 text-left transition cursor-pointer ${
                      draft.stayType !== 'entire_place'
                        ? 'border-stone-900 bg-white ring-1 ring-stone-900 text-stone-900'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BedDouble className={`h-4 w-4 ${draft.stayType !== 'entire_place' ? 'text-stone-900' : 'text-stone-500'}`} />
                        <span className="block text-sm font-semibold">By the room</span>
                      </div>
                      {draft.stayType !== 'entire_place' && (
                        <Check className="h-4 w-4 text-stone-900" />
                      )}
                    </div>
                    <span className="mt-1.5 block text-xs leading-relaxed text-stone-500">
                      Guests stay in a room, chalet or tent. For hotels, lodges and B&amp;Bs.
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={draft.stayType === 'entire_place'}
                    onClick={() => {
                      set('stayType', 'entire_place');
                      if (!draft.entirePlaceDetails) {
                        set('entirePlaceDetails', {
                          propertyType: 'Cottage',
                          bedrooms: 2,
                          bathrooms: 2,
                          beds: 3,
                          maxGuests: 6,
                          hasPrivateKitchen: true,
                          hasDedicatedHost: true,
                        });
                      }
                    }}
                    className={`relative rounded-xl border p-4 text-left transition cursor-pointer ${
                      draft.stayType === 'entire_place'
                        ? 'border-stone-900 bg-white ring-1 ring-stone-900 text-stone-900'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Home className={`h-4 w-4 ${draft.stayType === 'entire_place' ? 'text-stone-900' : 'text-stone-500'}`} />
                        <span className="block text-sm font-semibold">The whole place</span>
                      </div>
                      {draft.stayType === 'entire_place' && (
                        <Check className="h-4 w-4 text-stone-900" />
                      )}
                    </div>
                    <span className="mt-1.5 block text-xs leading-relaxed text-stone-500">
                      Guests have the whole cottage, villa or house to themselves.
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={labelClass}>Which category fits best?</span>
                  <span className="text-[11px] text-stone-500">Pick one</span>
                </div>

                {aiCategorized && draft.category && (
                  <p className="mb-3 text-xs text-stone-600 animate-in fade-in">
                    We picked <span className="font-semibold text-stone-900">{draft.category}</span>. Tap another to change it.
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {PROPERTY_CATEGORIES.map((category, catIdx) => {
                    const selected = draft.category === category;
                    return (
                      <button
                        key={`cat-${category}-${catIdx}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          set('category', category as PropertyCategory);
                          setAiCategorized(false);
                        }}
                        className={`h-11 sm:h-12 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-center text-center cursor-pointer active:scale-98 ${
                          selected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <span className="truncate">{category}</span>
                      </button>
                    );
                  })}
                </div>
                {draft.category && (
                  <p className="mt-2 text-xs text-stone-500 italic">
                    {CATEGORY_HINTS[draft.category]}
                  </p>
                )}
                <FieldError message={visible.category} />
              </div>

              <div>
                <label className={labelClass} htmlFor="listing-location">Town or area</label>
                <input
                  id="listing-location"
                  type="text"
                  list="malawi-locations"
                  value={draft.location}
                  onChange={e => {
                    const val = e.target.value;
                    const gmaps = parseGoogleMapsPlaceUrl(val);
                    if (gmaps) {
                      if (gmaps.coordinates) {
                        set('coordinates', gmaps.coordinates);
                        reverseGeocodeCoordinates(gmaps.coordinates).then(res => {
                          if (res.location) set('location', res.location);
                          if (res.locationNotes && !draft.locationNotes) set('locationNotes', res.locationNotes);
                        }).catch(() => {});
                      }
                      if (gmaps.name && !draft.name) {
                        set('name', gmaps.name);
                      }
                      toast.success('Got the map pin and area from Google Maps');
                      return;
                    }
                    set('location', val);
                  }}
                  placeholder="e.g. Cape Maclear, Area 43 Lilongwe, or paste a Google Maps link"
                  className={fieldClass}
                />
                <datalist id="malawi-locations">
                  {MALAWI_LOCATIONS.map((location, locIdx) => <option key={`loc-${location}-${locIdx}`} value={location} />)}
                </datalist>
                <FieldError message={visible.location} />
              </div>

              <div>
                <label className={labelClass} htmlFor="listing-notes">Directions <span className="font-normal text-stone-400">(optional)</span></label>
                <textarea
                  id="listing-notes"
                  rows={2}
                  value={draft.locationNotes}
                  onChange={e => set('locationNotes', e.target.value)}
                  placeholder="Turn off the M5 at the mission, 400 m of dirt road, gate on the left."
                  className={fieldClass}
                />
                <p className="text-xs text-stone-400 mt-1">
                  Landmarks, turn-offs or road conditions.
                </p>
              </div>

              <div>
                <LocationPicker
                  value={draft.coordinates}
                  onChange={coords => {
                    set('coordinates', coords);
                    if (coords) {
                      reverseGeocodeCoordinates(coords).then(res => {
                        if (res.location) {
                          set('location', res.location);
                          toast.success(`Area set to "${res.location}" from the map pin`);
                        }
                        if (res.locationNotes && !draft.locationNotes) {
                          set('locationNotes', res.locationNotes);
                        }
                      }).catch(() => {});
                    }
                  }}
                  locationText={draft.location || draft.name}
                  label="Pin the exact location"
                  onLocationSelect={info => {
                    if (info.location) {
                      set('location', info.location);
                    }
                    if (info.coordinates) {
                      set('coordinates', info.coordinates);
                    }
                    if (info.locationNotes && !draft.locationNotes) {
                      set('locationNotes', info.locationNotes);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 sm:space-y-8">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className={labelClass} htmlFor="listing-description">Describe your stay</label>
                  <div className="flex items-center gap-2">
                    {!draft.description.trim() && !!draft.name?.trim() && aiStatus.enabled && aiStatus.available && (
                      <button
                        type="button"
                        onClick={handleDraftStarter}
                        disabled={draftingStarter}
                        className="tm-btn tm-btn-secondary tm-btn-sm"
                      >
                        {draftingStarter ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-stone-500" />
                        )}
                        <span>Write a first draft</span>
                      </button>
                    )}
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
                </div>

                <textarea
                  id="listing-description"
                  rows={5}
                  maxLength={DESCRIPTION_MAX}
                  value={draft.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="What is it like to stay here? The setting, the views, the food, the people."
                  className={textareaClass}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {draft.description.trim().length >= 10 ? (
                    <button
                      type="button"
                      onClick={handleLinkDescription}
                      disabled={linkingDescription}
                      className="tm-btn tm-btn-quiet tm-btn-sm -ml-3"
                      title="Pick amenities and category from your description"
                    >
                      {linkingDescription ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
                      ) : (
                        <Tag className="w-3.5 h-3.5 text-stone-600" />
                      )}
                      <span>Pick amenities from description</span>
                    </button>
                  ) : <div />}
                  <span className={draft.description.trim().length < DESCRIPTION_MIN ? 'text-stone-400' : 'text-stone-700 font-medium'}>
                    {draft.description.trim().length} / {DESCRIPTION_MAX}
                  </span>
                </div>
                <FieldError message={visible.description} />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className={labelClass}>Amenities</span>
                  {aiStatus.enabled && aiStatus.available && (
                    <button
                      type="button"
                      onClick={handleSuggestAmenities}
                      disabled={suggestingAmenities}
                      className="tm-btn tm-btn-secondary tm-btn-sm"
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
                  <div className="mb-3.5 p-3.5 bg-stone-50 rounded-xl space-y-2 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5 min-w-0">
                        <Check className="w-3.5 h-3.5 text-stone-500" />
                        Suggested for {draft.category || 'stay'}:
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={addAllSuggestedAmenities}
                          className="tm-link text-[11px]"
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
                            className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1 font-medium ${
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

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {COMMON_AMENITIES.map((amenity, amIdx) => {
                    const selected = draft.amenities.includes(amenity);
                    return (
                      <button
                        key={`amenity-${amenity}-${amIdx}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleAmenity(amenity)}
                        className={`h-8 px-3 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                          selected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                        }`}
                      >
                        <span>{selected ? '✓' : '+'}</span>
                        <span>{amenity}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3.5 flex gap-2">
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
                    placeholder="Add your own (e.g. Firepit, Inverter)"
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={addTypedAmenity}
                    className="tm-btn tm-btn-secondary shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>

                {draft.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {draft.amenities.map((amenity, aIdx) => (
                      <span
                        key={`${amenity}-${aIdx}`}
                        className="tm-tag"
                      >
                        {amenity}
                        <button
                          type="button"
                          aria-label={`Remove ${amenity}`}
                          onClick={() => toggleAmenity(amenity)}
                          className="text-stone-400 hover:text-stone-700 transition cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 sm:space-y-8">
              <ImageUpload
                label="Cover photo"
                hint="The first photo guests see."
                value={draft.imageUrl}
                onChange={url => set('imageUrl', url)}
                folder={`hotels/${draft.id}`}
              />
              <FieldError message={visible.imageUrl} />

              <div className="border-t border-stone-100 pt-6">
                <GalleryUpload
                  label="More photos"
                  hint="Rooms, views and amenities. Four or more works best."
                  value={draft.galleryUrls}
                  onChange={urls => set('galleryUrls', urls)}
                  folder={`hotels/${draft.id}/gallery`}
                />
              </div>
            </div>
          )}

          {step === 3 && draft.stayType === 'entire_place' && (
            <div className="space-y-8">
              <div className="space-y-8">
                {/* Property Type / Style */}
                <div>
                  <label className={labelClass}>
                    What kind of place is it?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {['Cottage', 'Villa', 'Whole Guest House', 'Entire B&B', 'Chalet', 'Holiday Home'].map((type) => {
                      const selected = (draft.entirePlaceDetails?.propertyType || 'Cottage') === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            set('entirePlaceDetails', {
                              ...(draft.entirePlaceDetails || {}),
                              propertyType: type,
                            });
                          }}
                          className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                            selected
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Capacity & Space Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Bedrooms</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={draft.entirePlaceDetails?.bedrooms ?? 2}
                      onChange={(e) => {
                        set('entirePlaceDetails', {
                          ...(draft.entirePlaceDetails || {}),
                          bedrooms: Math.max(1, Number(e.target.value)),
                        });
                      }}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Bathrooms</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={draft.entirePlaceDetails?.bathrooms ?? 2}
                      onChange={(e) => {
                        set('entirePlaceDetails', {
                          ...(draft.entirePlaceDetails || {}),
                          bathrooms: Math.max(1, Number(e.target.value)),
                        });
                      }}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Beds</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={draft.entirePlaceDetails?.beds ?? 3}
                      onChange={(e) => {
                        set('entirePlaceDetails', {
                          ...(draft.entirePlaceDetails || {}),
                          beds: Math.max(1, Number(e.target.value)),
                        });
                      }}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Most guests</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={draft.entirePlaceDetails?.maxGuests ?? 6}
                      onChange={(e) => {
                        set('entirePlaceDetails', {
                          ...(draft.entirePlaceDetails || {}),
                          maxGuests: Math.max(1, Number(e.target.value)),
                        });
                      }}
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* Nightly Rates for the Whole Property */}
                <div className="space-y-3 border-t border-stone-100 pt-6">
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">Nightly rate for the whole place</h4>
                    <p className="text-xs text-stone-500 mt-0.5">Fill in one or both currencies. Each is set by you.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>USD per night</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-stone-400">$</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.entirePlaceDetails?.ratePerNightUsd || ''}
                          onChange={(e) => {
                            const usd = Number(e.target.value);
                            set('entirePlaceDetails', {
                              ...(draft.entirePlaceDetails || {}),
                              ratePerNightUsd: usd,
                            });
                          }}
                          placeholder="120"
                          className={`${fieldClass} pl-8`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>MK per night</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-stone-400 text-xs">MK</span>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={draft.entirePlaceDetails?.ratePerNightMwk || ''}
                          onChange={(e) => {
                            const mwk = Number(e.target.value);
                            set('entirePlaceDetails', {
                              ...(draft.entirePlaceDetails || {}),
                              ratePerNightMwk: mwk,
                            });
                          }}
                          placeholder="210000"
                          className={`${fieldClass} pl-10`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exclusive Inclusions */}
                <div>
                  <label className={labelClass}>
                    What is included
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {[
                      { key: 'hasPrivateKitchen', label: 'Full kitchen' },
                      { key: 'hasDedicatedHost', label: 'Caretaker or cook' },
                      { key: 'hasPrivatePool', label: 'Private pool' },
                      { key: 'hasLakeAccess', label: 'Lake or beach access' },
                      { key: 'hasGarden', label: 'Private garden' },
                    ].map((inc) => {
                      const checked = Boolean((draft.entirePlaceDetails as any)?.[inc.key]);
                      return (
                        <button
                          key={inc.key}
                          type="button"
                          onClick={() => {
                            set('entirePlaceDetails', {
                              ...(draft.entirePlaceDetails || {}),
                              [inc.key]: !checked,
                            });
                          }}
                          className={`p-3 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                            checked
                              ? 'bg-stone-900 border-stone-900 text-white'
                              : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <span>{inc.label}</span>
                          <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${checked ? 'bg-white text-stone-900 font-bold' : 'border border-stone-300'}`}>
                            {checked ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Whole House Description Note */}
                <div>
                  <label className={labelClass}>
                    Notes for guests <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={draft.entirePlaceDetails?.wholeHouseDescription || ''}
                    onChange={(e) => {
                      set('entirePlaceDetails', {
                        ...(draft.entirePlaceDetails || {}),
                        wholeHouseDescription: e.target.value,
                      });
                    }}
                    placeholder="e.g. Entire 3-bedroom lakeside villa with private cook. All bedrooms have en-suite bathrooms and lake views."
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && draft.stayType !== 'entire_place' && (
            <div className="space-y-8">
              <div className="space-y-6">
                <p className="tm-muted">
                  Add each room type with its rate in USD, MK or both. You set each currency yourself.
                </p>

                {/* Current Rooms Overview List */}
                {(draft.rooms || []).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-stone-900">
                      Your rooms ({(draft.rooms || []).length})
                    </p>
                    <ul className="divide-y divide-stone-200 border-y border-stone-200">
                      {(draft.rooms || []).map((room, idx) => (
                        <li key={`configured-room-${room.id || idx}-${idx}`} className="py-3 flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-3 min-w-0">
                            {room.imageUrl ? (
                              <img src={room.imageUrl} alt={room.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-12 bg-stone-100 rounded-lg flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5 text-stone-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="font-semibold text-sm text-stone-900 truncate">
                                {room.name || `Room ${idx + 1} (no name yet)`}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-stone-600">
                                {room.prices?.USD ? (
                                  <span className="font-semibold text-stone-900">
                                    ${room.prices.USD} USD
                                  </span>
                                ) : null}
                                {room.prices?.MWK ? (
                                  <span className="font-semibold text-stone-900">
                                    MK {Number(room.prices.MWK).toLocaleString()}
                                  </span>
                                ) : null}
                                {(!room.prices?.USD && !room.prices?.MWK) && (
                                  <span className="text-amber-800 font-medium">No rate yet</span>
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
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Add Actions Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      set('rooms', [...(draft.rooms || []), {
                        id: crypto.randomUUID(),
                        name: '',
                        description: '',
                        currencies: ['USD', 'MWK'],
                        prices: {},
                        maxGuests: 2,
                        quantity: 1,
                        imageUrl: '',
                        galleryUrls: [],
                      }]);
                    }}
                    className="w-full sm:flex-1 py-3.5 border-2 border-dashed border-stone-300 rounded-xl text-stone-700 font-semibold hover:border-stone-400 hover:bg-stone-50 transition text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add a room type</span>
                  </button>

                  {aiStatus.enabled && aiStatus.available && (
                    <button
                      type="button"
                      onClick={handleSuggestRoomTypes}
                      disabled={suggestingRooms}
                      className="tm-btn tm-btn-secondary w-full sm:w-auto"
                    >
                      {suggestingRooms ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                          <span>Suggesting rooms…</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-stone-500" />
                          <span>Suggest room types</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Interactive Room Types Customizer Tray */}
                {suggestedRooms.length > 0 && (
                  <div className="tm-divider pt-6 space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-stone-900">
                          Suggested room types
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Edit anything, set your rates, then add the ones you want.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={addAllSuggestedRooms}
                          className="tm-btn tm-btn-secondary tm-btn-sm"
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

                    <ul className="divide-y divide-stone-200 border-y border-stone-200">
                      {suggestedRooms.map((roomItem, rIdx) => (
                        <li key={`suggested-room-${rIdx}`} className="py-4 flex flex-col justify-between space-y-3.5 min-w-0">
                          <div className="space-y-2.5">
                            {/* Room Name Input */}
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-stone-700">
                                  Room name
                                </label>
                              </div>
                              <input
                                type="text"
                                value={roomItem.name}
                                onChange={e => updateSuggestedRoom(rIdx, { name: e.target.value })}
                                className="tm-input mt-1 font-semibold"
                                placeholder="e.g. Deluxe Lake Chalet"
                              />
                            </div>

                            {/* Room Description & AI Polish */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-stone-700">
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
                                className="tm-input"
                                placeholder="The bed, the view, what is in the room."
                              />
                            </div>

                            {/* Currency & Dual Pricing Controls */}
                            <div className="pt-2 border-t border-stone-100 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-medium text-stone-700">
                                  Nightly rate
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
                                  <div className="bg-stone-50 p-2 rounded-lg">
                                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                                      <span className="font-semibold text-stone-700">USD</span>
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
                                          updateSuggestedRoom(rIdx, { suggestedPriceUsd: val });
                                        }}
                                        className="w-full text-xs font-bold text-stone-900 bg-transparent outline-hidden"
                                        min="0"
                                      />
                                      <span className="text-[10px] text-stone-400">/nt</span>
                                    </div>
                                  </div>
                                )}

                                {roomItem.currencies.includes('MWK') && (
                                  <div className="bg-stone-50 p-2 rounded-lg">
                                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                                      <span className="font-semibold text-stone-700">MK</span>
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
                                          updateSuggestedRoom(rIdx, { suggestedPriceMwk: val });
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
                                <span className="text-[11px] text-stone-600">Most guests</span>
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
                            className="tm-btn tm-btn-secondary tm-btn-sm w-full sm:w-auto sm:self-start"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add this room</span>
                          </button>
                        </li>
                      ))}
                    </ul>
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
                  <div key={`room-pricing-card-${room.id || idx}-${idx}`} className="tm-divider pt-8 relative space-y-6 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="tm-tag shrink-0">
                          Room {idx + 1}
                        </span>
                        <h4 className="font-serif text-base sm:text-lg font-semibold text-stone-900 truncate">
                          {room.name || 'New room type'}
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
                        className="tm-btn tm-btn-quiet tm-btn-sm hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>

                    {/* Room Name */}
                    <div>
                      <label className={labelClass}>Room name</label>
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
                        placeholder="e.g. Balcony over the lake, en-suite bathroom, solar hot water"
                      />
                    </div>

                    {/* Currency & Nightly Rate Management */}
                    <div className="space-y-4 border-t border-stone-100 pt-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-sm font-semibold text-stone-900">
                            Nightly rate
                          </label>
                          <p className="text-[11px] text-stone-500">
                            Tick the currencies you take, then type each rate.
                          </p>
                        </div>

                        {/* AI Rate Advisor Trigger Button */}
                        {aiStatus.enabled && aiStatus.available && (
                          <button
                            type="button"
                            onClick={() => handleOpenAIRateAdvisor(idx)}
                            disabled={aiRateLoading && aiRateRoomIdx === idx}
                            className="tm-btn tm-btn-secondary tm-btn-sm self-start sm:self-auto"
                          >
                            {aiRateLoading && aiRateRoomIdx === idx ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                                <span>Checking rates…</span>
                              </>
                            ) : (
                              <>
                                <DollarSign className="w-3.5 h-3.5 text-stone-600" />
                                <span>Suggest a rate</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Currency Checkboxes */}
                      <div className="flex flex-wrap items-center gap-3">
                        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                          hasUsd ? 'bg-white border-stone-900 text-stone-900' : 'bg-white border-stone-200 text-stone-500'
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
                              // The host types each rate; unticking drops it from the saved prices.
                              if (!e.target.checked) {
                                const { USD: _usd, ...rest } = updated[idx].prices || {};
                                updated[idx].prices = rest;
                              }
                              set('rooms', updated);
                            }}
                            className="rounded text-stone-900 focus:ring-stone-900 w-4 h-4"
                          />
                          <span>US dollars</span>
                        </label>

                        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                          hasMwk ? 'bg-white border-stone-900 text-stone-900' : 'bg-white border-stone-200 text-stone-500'
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
                              if (!e.target.checked) {
                                const { MWK: _mwk, ...rest } = updated[idx].prices || {};
                                updated[idx].prices = rest;
                              }
                              set('rooms', updated);
                            }}
                            className="rounded text-stone-900 focus:ring-stone-900 w-4 h-4"
                          />
                          <span>Malawi kwacha</span>
                        </label>
                      </div>

                      {/* Price Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        {hasUsd && (
                          <div>
                            <label className={labelClass}>
                              USD per night
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
                            <label className={labelClass}>
                              MK per night
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

                      {/* Rate Advisor Inline Card */}
                      {aiRateRoomIdx === idx && aiRateData && (
                        <div className="p-4 bg-stone-50 rounded-xl space-y-3 animate-in fade-in">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-stone-600 shrink-0" />
                              <h5 className="font-semibold text-sm text-stone-900">
                                Suggested rate
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

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[11px] text-stone-500">USD</span>
                              <p className="text-lg font-bold text-stone-900">{aiRateData.usd > 0 ? `$${aiRateData.usd}` : '—'} <span className="text-xs font-normal text-stone-500">/nt</span></p>
                            </div>
                            <div>
                              <span className="text-[11px] text-stone-500">MK</span>
                              <p className="text-lg font-bold text-stone-900">{aiRateData.mwk > 0 ? `MK ${aiRateData.mwk.toLocaleString()}` : '—'} <span className="text-xs font-normal text-stone-500">/nt</span></p>
                            </div>
                          </div>

                          <p className="text-xs text-stone-600 leading-relaxed">
                            {aiRateData.reasoning}
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleApplyAIRates(idx)}
                              className="tm-btn tm-btn-secondary tm-btn-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Use this rate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAiRateRoomIdx(null);
                                setAiRateData(null);
                              }}
                              className="tm-btn tm-btn-quiet tm-btn-sm"
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
                        <label className={labelClass}>How many of these rooms?</label>
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
                        <label className={labelClass}>Sleeps up to</label>
                        <input
                          type="number"
                          value={room.maxGuests || ''}
                          onChange={e => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            const updated = [...(draft.rooms || [])];
                            updated[idx] = {
                              ...updated[idx],
                              maxGuests: val,
                              baseGuests: Math.min(Number(updated[idx].baseGuests || val), val),
                            };
                            set('rooms', updated);
                          }}
                          className={fieldClass}
                          min="1"
                          max="30"
                          placeholder="e.g. 2"
                        />
                      </div>
                    </div>

                    {/* Extra Guest Fees (Optional) — collapsed */}
                    <details className="pt-4 border-t border-stone-100" open={Boolean(room.extraGuestFees?.USD || room.extraGuestFees?.MWK)}>
                      <summary className="cursor-pointer text-sm font-medium text-stone-700">
                        Extra guest fees <span className="font-normal text-stone-400">(optional)</span>
                      </summary>
                    <div className="mt-3 space-y-3">
                      <p className="text-[11px] text-stone-500">
                        Guests included in the rate, and what each extra guest pays.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className={labelClass}>
                            Guests included
                          </label>
                          <input
                            type="number"
                            value={room.baseGuests !== undefined && room.baseGuests !== '' ? Number(room.baseGuests) : Math.min(2, Math.max(1, Number(room.maxGuests) || 2))}
                            onChange={e => {
                              const maxG = Math.max(1, Number(room.maxGuests || 1));
                              const val = Math.min(Math.max(1, Number(e.target.value) || 1), maxG);
                              const updated = [...(draft.rooms || [])];
                              updated[idx] = {
                                ...updated[idx],
                                baseGuests: val,
                              };
                              set('rooms', updated);
                            }}
                            className={fieldClass}
                            min="1"
                            max={room.maxGuests || 30}
                            placeholder={`Max ${room.maxGuests || 2}`}
                          />
                        </div>

                        {hasUsd && (
                          <div>
                            <label className={labelClass}>
                              Extra guest (USD)
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
                            <label className={labelClass}>
                              Extra guest (MK)
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
                    </details>

                    {/* Room Photos */}
                    <div className="pt-4 border-t border-stone-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-stone-900">
                          Room photos
                        </span>
                        <span className="text-[11px] text-stone-500">
                          At least one needed
                        </span>
                      </div>
                      <ImageUpload
                        label="Room cover photo"
                        hint="A bright, wide shot of the bed and room."
                        tooltip="Guest View: This image appears as the primary thumbnail for this room type in the room list on your property page."
                        value={room.imageUrl || ''}
                        onChange={url => {
                          const updated = [...(draft.rooms || [])];
                          if (url && (updated[idx].galleryUrls || []).includes(url)) {
                            const prevCover = updated[idx].imageUrl;
                            const remaining = (updated[idx].galleryUrls || []).filter(u => u !== url);
                            if (prevCover && !remaining.includes(prevCover)) remaining.unshift(prevCover);
                            updated[idx].galleryUrls = remaining;
                          }
                          updated[idx].imageUrl = url;
                          set('rooms', updated);
                        }}
                        folder={`hotels/${draft.id}/rooms`}
                      />

                      <GalleryUpload
                        label="More room photos"
                        hint="Bathroom, view and extras. Tap the star to make one the cover."
                        tooltip="Guest View: These photos form the image carousel when a guest clicks to view more details about this specific room type."
                        value={room.galleryUrls || []}
                        onChange={urls => {
                          const updated = [...(draft.rooms || [])];
                          updated[idx].galleryUrls = urls;
                          set('rooms', updated);
                        }}
                        folder={`hotels/${draft.id}/rooms`}
                        showCoverBadge={true}
                        onSetCover={url => {
                          const updated = [...(draft.rooms || [])];
                          const prevCover = updated[idx].imageUrl;
                          const remaining = (updated[idx].galleryUrls || []).filter(u => u !== url);
                          if (prevCover && !remaining.includes(prevCover)) remaining.unshift(prevCover);
                          updated[idx].imageUrl = url;
                          updated[idx].galleryUrls = remaining;
                          set('rooms', updated);
                          toast.success('Set as room cover photo');
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <FieldError message={visible.rooms} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              {/* Host & direct contacts */}
              <div className="space-y-6">

                <div>
                  <label className={labelClass} htmlFor="listing-manager-name">
                    Your full name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      id="listing-manager-name"
                      type="text"
                      value={draft.managerName}
                      onChange={e => set('managerName', e.target.value)}
                      placeholder="e.g. Kondwani Banda"
                      className={`${fieldClass} pl-11`}
                    />
                  </div>
                  <FieldError message={visible.managerName} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="listing-email">
                      Contact email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        id="listing-email"
                        type="email"
                        autoComplete="email"
                        value={draft.contactEmail}
                        onChange={e => set('contactEmail', e.target.value)}
                        placeholder="hello@yourproperty.mw"
                        className={`${fieldClass} pl-11`}
                      />
                    </div>
                    <FieldError message={visible.contactEmail} />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="listing-phone">
                      Contact phone <span className="text-red-500">*</span>
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
                    <FieldError message={visible.contactPhone} />
                  </div>
                </div>

                {/* WhatsApp & Alt Phone */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* The property's own WhatsApp is a direct contact travellers use in directory mode. */}
                  {(whatsappEnabled || !bookingsEnabled) && (
                    <div>
                      <label className={labelClass} htmlFor="listing-whatsapp">
                        WhatsApp number <span className="font-normal text-stone-400">(optional)</span>
                      </label>
                      <div className="relative">
                        <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <input
                          id="listing-whatsapp"
                          type="tel"
                          value={draft.contactWhatsapp}
                          onChange={e => set('contactWhatsapp', e.target.value)}
                          placeholder="Same as contact phone"
                          className={`${fieldClass} pl-11`}
                        />
                      </div>
                      <FieldError message={visible.contactWhatsapp} />
                    </div>
                  )}

                  <div>
                    <label className={labelClass} htmlFor="listing-manager-phone">
                      Other phone <span className="font-normal text-stone-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        id="listing-manager-phone"
                        type="tel"
                        value={draft.managerPhone}
                        onChange={e => set('managerPhone', e.target.value)}
                        placeholder="Another number guests can try"
                        className={`${fieldClass} pl-11`}
                      />
                    </div>
                    <FieldError message={visible.managerPhone} />
                  </div>
                </div>

                {/* Check-in & Check-out Times */}
                <div className="grid gap-4 pt-4 border-t border-stone-100 sm:grid-cols-2">
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

              {/* Property Ownership & Alternate Contacts (Optional) */}
              <details
                className="border-t border-stone-100 pt-6"
                open={Boolean(
                  draft.ownerName || draft.ownerEmail || draft.ownerPhone || draft.managerEmail ||
                  visible.ownerName || visible.ownerEmail || visible.ownerPhone || visible.managerEmail
                )}
              >
                <summary className="cursor-pointer text-sm font-medium text-stone-700">
                  Owner details <span className="font-normal text-stone-400">(optional)</span>
                </summary>
              <div className="mt-4 space-y-4">
                <p className="text-xs text-stone-500">
                  Only if the owner or billing company is not you.
                </p>

                <div>
                  <label className={labelClass} htmlFor="listing-owner-name">
                    Owner or company name
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="listing-owner-email">
                      Owner email
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
                      Owner phone
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

                <div>
                  <label className={labelClass} htmlFor="listing-manager-email">
                    Manager email <span className="text-stone-400 font-normal">(optional)</span>
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
              </div>
              </details>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              {checkingPremium ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-stone-300" />
                </div>
              ) : premiumEnabled && bookingsEnabled ? (
                <div className="text-center">
                  <h3 className="tm-h2 mb-1">Choose a plan</h3>
                  <p className="tm-muted mb-6">You can change it later.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200 border-y border-stone-200 text-left">
                    <div className="py-5 md:pr-6 border-l-2 border-amber-700 pl-4">
                      <h4 className="font-semibold text-stone-900">Basic</h4>
                      <p className="text-sm text-stone-500 mt-1 mb-4">Everything you need to list your property.</p>
                      <p className="text-2xl font-semibold text-stone-900 mb-6">Free</p>
                      <span className="tm-tag tm-tag-good">
                        <Check className="h-3.5 w-3.5" /> Selected
                      </span>
                    </div>
                    <div className="py-5 pl-4 md:pl-6">
                      <h4 className="font-semibold text-stone-900">Premium</h4>
                      <p className="text-sm text-stone-500 mt-1 mb-4">More visibility and extra tools.</p>
                      <p className="text-2xl font-semibold text-stone-900 mb-6">$49<span className="text-sm text-stone-500 font-normal">/mo</span></p>
                      {/* No in-app checkout exists yet; upgrades are arranged with the team. */}
                      <a
                        href={`mailto:${DEFAULT_PLATFORM_EMAIL}?subject=${encodeURIComponent('Premium listing upgrade')}`}
                        className="tm-btn tm-btn-secondary"
                      >
                        Ask about Premium
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <BadgeCheck className="mx-auto h-8 w-8 text-stone-700 mb-3" />
                  <h3 className="tm-h2 mb-2">{bookingsEnabled ? 'Free listing, no commission' : 'Free listing'}</h3>
                  <p className="tm-lead mx-auto">
                    {bookingsEnabled
                      ? 'Listing on Travel Malawi is free. Guests pay you directly.'
                      : 'Listing on Travel Malawi is free. Travellers contact you directly to arrange their stay.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-8">
              <div>
                <div className="relative h-48 sm:h-64 overflow-hidden rounded-lg bg-stone-100">
                  <SmartImage
                    src={getHotelImage({ name: draft.name, imageUrl: draft.imageUrl, galleryUrls: draft.galleryUrls })}
                    alt={draft.name || 'Your property'}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-stone-900">
                    {draft.category || 'No category yet'}
                  </span>
                </div>
                <div className="pt-5">
                  <p className="tm-muted">{draft.location}</p>
                  <h2 className="mt-1 tm-h1 break-words">{draft.name}</h2>
                  <p className="mt-4 whitespace-pre-line text-stone-600">{draft.description}</p>

                  {draft.amenities.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {draft.amenities.map((amenity, aIdx) => (
                        <span key={`${amenity}-${aIdx}`} className="tm-tag">
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
                      <dt className="font-semibold text-stone-400">Photos</dt>
                      <dd className="text-stone-900">{1 + draft.galleryUrls.length}</dd>
                    </div>
                  </dl>

                  <dl className="mt-4 grid gap-4 border-t border-stone-100 pt-6 text-sm sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="font-semibold text-stone-400">Contact email</dt>
                      <dd className="truncate text-stone-900">{draft.contactEmail}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-400">Contact phone</dt>
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
                      <dt className="font-semibold text-stone-400">Host</dt>
                      <dd className="text-stone-900 font-medium mt-0.5 break-words">{draft.managerName || 'Not given yet'}</dd>
                      {(draft.managerEmail || draft.managerPhone) && (
                        <dd className="text-stone-500 text-xs mt-0.5">
                          {[draft.managerEmail, draft.managerPhone].filter(Boolean).join(' · ')}
                        </dd>
                      )}
                    </div>
                    {draft.ownerName ? (
                      <div>
                        <dt className="font-semibold text-stone-400">Owner</dt>
                        <dd className="text-stone-900 font-medium mt-0.5 break-words">{draft.ownerName}</dd>
                        {(draft.ownerEmail || draft.ownerPhone) && (
                          <dd className="text-stone-500 text-xs mt-0.5">
                            {[draft.ownerEmail, draft.ownerPhone].filter(Boolean).join(' · ')}
                          </dd>
                        )}
                      </div>
                    ) : (
                      <div>
                        <dt className="font-semibold text-stone-400">Owner</dt>
                        <dd className="text-stone-500 text-xs mt-0.5">Same as host</dd>
                      </div>
                    )}
                  </dl>

                  {/* Room Types & Pricing Summary in Review */}
                  <div className="mt-6 border-t border-stone-100 pt-6">
                    {draft.stayType === 'entire_place' ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-stone-900">
                            The whole place
                          </h4>
                          <button
                            type="button"
                            onClick={() => setStep(3)}
                            className="tm-link text-xs cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-serif font-semibold text-base text-stone-900">
                              Entire {draft.entirePlaceDetails?.propertyType || 'place'}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {draft.entirePlaceDetails?.ratePerNightUsd ? (
                                <span className="text-stone-900 font-semibold text-xs">
                                  ${draft.entirePlaceDetails.ratePerNightUsd} USD / night
                                </span>
                              ) : null}
                              {draft.entirePlaceDetails?.ratePerNightMwk ? (
                                <span className="text-stone-900 font-semibold text-xs">
                                  MK {Number(draft.entirePlaceDetails.ratePerNightMwk).toLocaleString()} / night
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-700 pt-1">
                            <span>{draft.entirePlaceDetails?.bedrooms || 2} bedrooms</span>
                            <span>·</span>
                            <span>{draft.entirePlaceDetails?.bathrooms || 2} bathrooms</span>
                            <span>·</span>
                            <span>{draft.entirePlaceDetails?.beds || 3} beds</span>
                            <span>·</span>
                            <span>Up to {draft.entirePlaceDetails?.maxGuests || 6} guests</span>
                          </div>

                          {draft.entirePlaceDetails?.wholeHouseDescription && (
                            <p className="text-xs text-stone-600 pt-1 italic">
                              "{draft.entirePlaceDetails.wholeHouseDescription}"
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-stone-900">
                            Rooms ({(draft.rooms || []).length})
                          </h4>
                          <button
                            type="button"
                            onClick={() => setStep(3)}
                            className="tm-link text-xs cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>

                        {(draft.rooms || []).length === 0 ? (
                          <p className="text-xs text-amber-900 bg-amber-50 p-3 rounded-lg">
                            No rooms yet. Add at least one on the Rooms step before you submit.
                          </p>
                        ) : (
                          <ul className="divide-y divide-stone-200">
                            {(draft.rooms || []).map((room, rIdx) => (
                              <li key={`draft-summary-room-${room.id || rIdx}-${rIdx}`} className="py-3 first:pt-0 text-xs space-y-1.5 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-stone-900 text-sm break-words min-w-0">{room.name || `Room ${rIdx + 1}`}</span>
                                  <span className="text-[11px] text-stone-500 shrink-0">
                                    {room.quantity || 1} available
                                  </span>
                                </div>
                                <p className="text-stone-600 line-clamp-1">{room.description || 'No description provided'}</p>
                                <div className="flex flex-wrap items-center gap-2 pt-1 font-semibold">
                                  {room.prices?.USD ? (
                                    <span className="text-stone-900">
                                      ${room.prices.USD} USD / night
                                    </span>
                                  ) : null}
                                  {room.prices?.MWK ? (
                                    <span className="text-stone-900">
                                      MK {Number(room.prices.MWK).toLocaleString()} / night
                                    </span>
                                  ) : null}
                                  <span className="text-stone-400 font-normal">· Sleeps {room.maxGuests || 2}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional AI Appeal & Guest Clarity Check */}
              {aiStatus.enabled && aiStatus.available && (
                <div className="rounded-xl bg-stone-50 p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-stone-900">
                          Want a second opinion?
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Ulendo reads your listing and says what a guest might miss. Only you see it.
                        </p>
                      </div>
                    </div>
                    {!listingReview && (
                      <button
                        type="button"
                        onClick={handleReviewListing}
                        disabled={reviewingListing}
                        className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                      >
                        {reviewingListing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                            <span>Reading…</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-stone-600" />
                            <span>Check my listing</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {listingReview && (
                    <div className="space-y-3 pt-3 border-t border-stone-200/70 animate-in fade-in">
                      <div className="text-xs leading-relaxed text-stone-700 whitespace-pre-line break-words">
                        {listingReview}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setListingReview(null)}
                          className="tm-btn tm-btn-quiet tm-btn-sm"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="tm-link text-xs"
                        >
                          Edit description or amenities
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Licensing & the law: required declaration before submitting */}
              <div className="border-t border-stone-100 pt-6">
                <div
                  id="listing-licensing-declaration"
                  className={`rounded-xl border p-4 space-y-3 ${
                    showLicensingError && !licensingAccepted ? 'border-red-300 bg-red-50/40' : 'border-stone-200 bg-stone-50/70'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-stone-600 leading-relaxed space-y-2">
                      <span className="font-semibold text-stone-900 block">
                        Licensing is your responsibility
                      </span>
                      <p>
                        Under Malawian law, an accommodation business must hold the licences and permits that apply to it. Depending on your property, this can include:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>a tourism operating licence from the Department of Tourism under Section 27 of the Tourism Act, 2025;</li>
                        <li>business and tax registration (Registrar General and the Malawi Revenue Authority);</li>
                        <li>permits from your city, municipal or district council, and any health or fire safety certificates.</li>
                      </ul>
                      <p>
                        Travel Malawi is an information directory. We do not issue, check or verify licences or permits, and we are not responsible for whether a listed property is licensed or meets legal, health or safety requirements. Being listed here is not an approval or endorsement by Travel Malawi or by the Ministry.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-stone-200 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={licensingAccepted}
                      onChange={e => {
                        setLicensingAccepted(e.target.checked);
                        if (e.target.checked) setShowLicensingError(false);
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-stone-900"
                    />
                    <span className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                      I confirm that I have the authority to list this property, that its details are accurate, and that it holds the licences and permits Malawian law requires of it. I understand Travel Malawi does not verify licences and is not responsible for them, and I agree to the{' '}
                      <Link to="/terms" target="_blank" className="font-semibold text-stone-900 underline hover:text-stone-700">
                        Terms of Service
                      </Link>
                      .
                    </span>
                  </label>
                  {showLicensingError && !licensingAccepted && (
                    <p role="alert" className="text-xs text-red-600">
                      Tick the box to confirm before sending your listing.
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <label className={labelClass} htmlFor="listing-tourism-licence">
                    Tourism licence number <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    id="listing-tourism-licence"
                    type="text"
                    maxLength={LICENCE_MAX}
                    value={draft.tourismLicenceNumber ?? ''}
                    onChange={e => set('tourismLicenceNumber', e.target.value)}
                    placeholder="As shown on your licence"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-xs text-stone-500">
                    Shown on your listing as provided by the property. Travel Malawi does not verify it.
                  </p>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-6">
                <p className="font-semibold text-stone-900 text-sm">
                  What happens next
                </p>
                <ol className="mt-2.5 space-y-1.5 text-xs sm:text-sm text-stone-600">
                  <li>1. Our team checks your listing, usually within a day.</li>
                  <li>2. You will hear from us when it is live.</li>
                  <li>
                    {bookingsEnabled
                      ? '3. Booking requests arrive in your dashboard.'
                      : '3. Travellers find your listing and contact you directly.'}
                  </li>
                </ol>
              </div>

              {Object.keys(allErrors).length > 0 && (
                <div className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
                  <p className="font-semibold">A few things to fix before sending:</p>
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
        <div className="mt-6 sm:mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="tm-btn tm-btn-quiet disabled:opacity-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="tm-btn tm-btn-primary"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="tm-btn tm-btn-primary"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{submitting ? 'Sending…' : 'Submit for review'}</span>
            </button>
          )}
        </div>
      </div>
      <PropertyDocumentImporter
        open={showPropertyImporter}
        onClose={() => setShowPropertyImporter(false)}
        onImport={(data) =>
          setDraft((curr) => {
            const resolvedCategory =
              normalizePropertyCategory(data.category || data.categories?.[0]) || curr.category;
            const mergedAmenities =
              data.amenities && data.amenities.length > 0
                ? Array.from(new Set([...(curr.amenities || []), ...data.amenities]))
                : curr.amenities;

            return {
              ...curr,
              ...(data.name ? { name: data.name } : {}),
              ...(resolvedCategory ? { category: resolvedCategory } : {}),
              ...(data.stayType ? { stayType: data.stayType } : {}),
              ...(data.location ? { location: data.location } : {}),
              ...(data.locationNotes ? { locationNotes: data.locationNotes } : {}),
              ...(data.description ? { description: data.description } : {}),
              ...(data.ownerName ? { ownerName: data.ownerName } : {}),
              ...(data.ownerEmail ? { ownerEmail: data.ownerEmail } : {}),
              ...(data.ownerPhone ? { ownerPhone: data.ownerPhone } : {}),
              ...(data.managerName ? { managerName: data.managerName } : {}),
              ...(data.managerEmail ? { managerEmail: data.managerEmail } : {}),
              ...(data.managerPhone ? { managerPhone: data.managerPhone } : {}),
              ...(data.contactPhone ? { contactPhone: data.contactPhone } : {}),
              ...(data.contactWhatsapp ? { contactWhatsapp: data.contactWhatsapp } : {}),
              ...(data.contactEmail ? { contactEmail: data.contactEmail } : {}),
              ...(data.checkInTime ? { checkInTime: data.checkInTime } : {}),
              ...(data.checkOutTime ? { checkOutTime: data.checkOutTime } : {}),
              amenities: mergedAmenities,
              ...(data.rooms && data.rooms.length > 0 ? { rooms: data.rooms } : {}),
            };
          })
        }
      />

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title="Discard this draft?"
        message="Everything you have entered so far will be cleared."
        confirmText="Discard draft"
        cancelText="Keep editing"
        isDestructive={true}
        onConfirm={confirmDiscardDraft}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Simple, welcoming first-time walkthrough screen.
 * Clarifies that listing only takes ~3 minutes, showcases the 3 easy steps,
 * conditionally highlights Ulendo AI if enabled/available, and completely omits AI
 * mentions if AI is unavailable to prevent host confusion.
 */
function OnboardingWelcomeWalkthrough({
  user,
  enabling,
  hasAI,
  onStart,
  onImportDocument,
}: {
  user: any;
  enabling: boolean;
  hasAI: boolean;
  onStart: () => void;
  onImportDocument?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-700 font-sans">
      <SEOHead
        title="List Your Property — Join Travel Malawi Hospitality Platform"
        description="List your lodge, boutique hotel, B&B, or Lake Malawi cottage on Travel Malawi. Free to list, and travellers contact you directly to plan their stay."
        keywords="list property Malawi, host lodge Malawi, lodge onboarding Malawi, hotel management Malawi, Travel Malawi partner"
        url="https://ulendomalawi.com/list-your-property"
      />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="tm-btn tm-btn-quiet tm-btn-sm -ml-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Explore stays</span>
          </button>

          <div className="tm-actions">
            <Link
              to="/host-guide"
              className="tm-btn tm-btn-quiet tm-btn-sm"
            >
              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
              <span className="hidden sm:inline">Host guide</span>
            </Link>
            <button
              type="button"
              onClick={onStart}
              className="tm-btn tm-btn-quiet tm-btn-sm"
            >
              <span>Skip to form</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Focused Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 sm:p-10 space-y-6 sm:space-y-8">
          <div className="space-y-3">
            <p className="text-sm text-stone-500">Takulandirani.</p>
            <h1 className="tm-h1">
              List your stay in about 3 minutes
            </h1>
            <p className="tm-lead">
              Listing is free and travellers contact you directly. Your draft saves as you type.
            </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onStart}
              className="tm-btn tm-btn-primary"
            >
              <span>Start listing</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onImportDocument && (
              <button
                type="button"
                onClick={onImportDocument}
                className="tm-btn tm-btn-secondary"
              >
                <FileText className="w-4 h-4 text-stone-600" />
                <span>Import from a document</span>
              </button>
            )}
          </div>

          {/* Simple 3-Step Overview */}
          <ol className="pt-6 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <li className="space-y-1">
              <h3 className="font-semibold text-stone-900 text-sm">1. Your property</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Name, category and where it is.
              </p>
            </li>
            <li className="space-y-1">
              <h3 className="font-semibold text-stone-900 text-sm">2. Photos and rates</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                A cover photo and nightly rates in MK, USD or both.
              </p>
            </li>
            <li className="space-y-1">
              <h3 className="font-semibold text-stone-900 text-sm">3. Contacts</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                The phone and WhatsApp guests use to reach you.
              </p>
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}
