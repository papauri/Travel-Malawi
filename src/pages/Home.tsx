import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Pagination from '../components/Pagination';
import { Search, MapPin, Calendar, Users, Star, LocateFixed, Locate, ChevronDown, Plus, Minus, ShieldCheck, MessageCircle, Smartphone, X, Clock, LayoutGrid, Map as MapIcon, Compass, Navigation, SlidersHorizontal, RotateCcw, Filter, Check, Car, ExternalLink, Route, ArrowRight, Building2, CheckCircle2, BookOpen, AlignJustify, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Review, CurrencyCode } from '../types';
import { Link, useSearchParams } from 'react-router-dom';
import HotelCard from '../components/HotelCard';
import CompactHotelCard from '../components/CompactHotelCard';
import SmartImage from '../components/SmartImage';
import InteractiveMap, { LodgeMarker } from '../components/InteractiveMap';
import PriceRangeFilter from '../components/PriceRangeFilter';
import { DECORATIVE_IMAGE, HERO_IMAGE, getHotelImage } from '../lib/images';
import { BookingLike, lowestPrice, roomsMatching } from '../lib/availability';
import { todayStr } from '../lib/dates';
import { CURRENCY_CODES, CURRENCIES, currenciesForRooms, formatMoney, readStoredCurrency, storeCurrency, onCurrencyChange } from '../lib/currency';
import { PROPERTY_CATEGORIES, COMMON_AMENITIES } from '../lib/listing';
import { distanceKm, isValidLatLng, resolveHotelCoordinates, LatLng, estimateTravelTime, getDirectionsUrl, formatLocationName, MALAWI_HUBS } from '../lib/geo';
import { getCachedHotels, saveCachedHotels, getCachedRooms, saveCachedRooms } from '../lib/mapCache';
import PriceDisplay from '../components/PriceDisplay';
import MaskedPlaceName from '../components/MaskedPlaceName';
import { openAccessPermissionsModal, MANUAL_LOCATION_STORAGE_KEY, UserLocationEventDetail } from '../components/AccessRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isHotelManager } from '../lib/roles';
import { getActivePromotion, calculateSlashedPrice, getSaleTypeBadge } from '../lib/promotions';
import SEOHead from '../components/SEOHead';
import { generateAutonomousSeo } from '../lib/dynamicSeo';

type SortKey = 'recommended' | 'distance_asc' | 'price_asc' | 'price_desc' | 'rating' | 'name_asc';

const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'Recommended',
  distance_asc: 'Nearest to Me',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Guest rating',
  name_asc: 'Name (A to Z)',
};

interface AppliedSearch {
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number | '';
  coords: { lat: number; lng: number } | null;
  proximity: number;
}

interface RecentSearch {
  location: string;
  adults: number;
  children: number;
  roomsWanted: number;
  timestamp: number;
}

const NO_SEARCH: AppliedSearch = {
  location: '', checkIn: '', checkOut: '', guests: '', coords: null, proximity: 50,
};

export const STAY_TYPE_OPTIONS = [
  { id: 'All', label: 'All stays' },
  { id: 'entire_place', label: 'Entire place' },
  { id: 'whole_guest_house', label: 'Guest houses' },
  { id: 'cottage_chalet', label: 'Cottages and chalets' },
  { id: 'villa_holiday_home', label: 'Villas and homes' },
  { id: 'rooms', label: 'Rooms and suites' },
  { id: 'safari_lodge', label: 'Safari camps and lodges' },
  { id: 'bnb_guesthouse', label: 'Bed and breakfasts' },
] as const;

export const STAY_TYPE_LABELS: Record<string, string> = {
  All: 'All stays',
  entire_place: 'Entire place',
  whole_guest_house: 'Guest house',
  cottage_chalet: 'Cottage and chalet',
  villa_holiday_home: 'Villa or home',
  rooms: 'Rooms and suites',
  safari_lodge: 'Safari camp or lodge',
  bnb_guesthouse: 'Bed and breakfast',
};

export function matchesStayType(hotel: Hotel, stayType: string): boolean {
  if (!stayType || stayType === 'All') return true;

  const isEntire = hotel.stayType === 'entire_place';
  const entireStyle = (hotel.entirePlaceDetails?.propertyType || '').toLowerCase();
  const nameLower = (hotel.name || '').toLowerCase();
  const descLower = (hotel.description || '').toLowerCase();
  const categories = hotel.categories || [];

  switch (stayType) {
    case 'entire_place':
      return isEntire;

    case 'whole_guest_house':
      return (
        isEntire && (
          entireStyle.includes('guest house') || 
          nameLower.includes('guest house') || 
          categories.includes('Guest House')
        )
      );

    case 'cottage_chalet':
      return (
        entireStyle.includes('cottage') || 
        entireStyle.includes('chalet') || 
        categories.includes('Cottage and chalet') ||
        nameLower.includes('cottage') || 
        nameLower.includes('chalet')
      );

    case 'villa_holiday_home':
      return (
        isEntire && (
          entireStyle.includes('villa') || 
          entireStyle.includes('holiday home') || 
          entireStyle.includes('house') ||
          nameLower.includes('villa')
        )
      );

    case 'rooms':
      return !isEntire;

    case 'safari_lodge':
      return (
        categories.includes('Safari & Wildlife') || 
        nameLower.includes('safari') || 
        nameLower.includes('camp') || 
        descLower.includes('safari')
      );

    case 'bnb_guesthouse':
      return (
        !isEntire && (
          categories.includes('Bed and breakfast') || 
          categories.includes('Guest House') ||
          nameLower.includes('b&b') || 
          nameLower.includes('guest house')
        )
      );

    default:
      return true;
  }
}


/**
 * The rotating half of the headline.
 *
 * It used to cycle four verbs — "Discover / Experience / Support / Connect
 * with" — in front of the brand name, which told a first-time visitor nothing
 * about the country or what was for sale. Naming real places does both.
 */
const HERO_PLACES = [
  'Lake Malawi.',
  'Likoma Island.',
  'the Zomba Plateau.',
  'a Liwonde riverbank.',
  'the Mulanje foothills.',
];

/** Shown only until the real listings load and supply their own locations. */
const FALLBACK_DESTINATIONS = ['Lake Malawi', 'Likoma', 'Zomba', 'Liwonde', 'Lilongwe'];

const DISCOVERY_KEY = 'tm_discovery_v1';
const VIEW_MODES = ['grid', 'map', 'compact'] as const;

interface DiscoverySnapshot {
  stayType?: string;
  category?: string;
  amenities?: string[];
  sortKey?: string;
  viewMode?: string;
  page?: number;
  priceRange?: [number, number];
  priceCurrency?: string;
  includeUnpriced?: boolean;
  mapSearchText?: string;
  form?: {
    location?: string; checkIn?: string; checkOut?: string;
    adults?: number; children?: number; rooms?: number; proximity?: number;
  };
  applied?: Partial<AppliedSearch>;
}

/** Filters a link can carry (`/?category=`, `/?stayType=`, `/?location=`, `/?search=`). */
function parseUrlFilters(search: string) {
  const params = new URLSearchParams(search);
  const category = params.get('category') ?? '';
  const stayType = params.get('stayType') ?? '';
  return {
    category: (PROPERTY_CATEGORIES as readonly string[]).includes(category) ? category : '',
    stayType: STAY_TYPE_OPTIONS.some(o => o.id === stayType && o.id !== 'All') ? stayType : '',
    location: (params.get('location') || params.get('search') || '').trim().slice(0, 80),
  };
}

/**
 * The visitor's search and filters, kept for the tab session so a reload or the
 * back button after opening a property lands them where they were. A link that
 * carries its own filters wins and starts clean.
 */
function readDiscovery(): DiscoverySnapshot | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (['category', 'stayType', 'location', 'search'].some(k => params.has(k))) return null;
    const raw = sessionStorage.getItem(DISCOVERY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const today = todayStr();
  const [restored] = useState<DiscoverySnapshot | null>(readDiscovery);
  const [urlFilters] = useState(() => parseUrlFilters(typeof window === 'undefined' ? '' : window.location.search));
  const restoredDates = (() => {
    const f = restored?.form;
    return f?.checkIn && f?.checkOut && f.checkIn >= todayStr() && f.checkOut > f.checkIn
      ? { checkIn: f.checkIn, checkOut: f.checkOut }
      : { checkIn: '', checkOut: '' };
  })();

  const [hotels, setHotels] = useState<Hotel[]>(() => getCachedHotels());
  const [rooms, setRooms] = useState<RoomType[]>(() => getCachedRooms());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [loading, setLoading] = useState(() => getCachedHotels().length === 0);
  const [searching, setSearching] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [listingsReloadKey, setListingsReloadKey] = useState(0);
  const [activeStayType, setActiveStayType] = useState(() =>
    urlFilters.stayType || (STAY_TYPE_OPTIONS.some(o => o.id === restored?.stayType) ? restored!.stayType! : 'All'));
  const [activeCategory, setActiveCategory] = useState(() =>
    urlFilters.category || ((PROPERTY_CATEGORIES as readonly string[]).includes(restored?.category ?? '') ? restored!.category! : 'All'));
  const [activeAmenities, setActiveAmenities] = useState<string[]>(() =>
    Array.isArray(restored?.amenities) ? restored!.amenities!.filter(a => (COMMON_AMENITIES as readonly string[]).includes(a)) : []);
  const [searchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = restored?.sortKey as SortKey | undefined;
    // "Nearest to me" needs a live location that is not restored with the rest.
    return saved && saved in SORT_LABELS && saved !== 'distance_asc' ? saved : 'recommended';
  });
  const [currentPage, setCurrentPage] = useState(() =>
    Number.isInteger(restored?.page) && restored!.page! > 0 ? restored!.page! : 1);
  const itemsPerPage = 6;
  const [currency, setCurrency] = useState<CurrencyCode>(readStoredCurrency);
  const [viewMode, setViewMode] = useState<'grid' | 'map' | 'compact'>(() =>
    (VIEW_MODES as readonly string[]).includes(restored?.viewMode ?? '') ? (restored!.viewMode as 'grid' | 'map' | 'compact') : 'grid');
  const [selectedMapLodgeId, setSelectedMapLodgeId] = useState<string | null>(null);
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();
  const isHost = isHotelManager(user);

  // User has already listed a property in Travel Malawi
  const hasUserListed = useMemo(() => {
    if (!user?.uid) return false;
    return hotels.some(h => h.managerId === user.uid);
  }, [user?.uid, hotels]);

  useEffect(() => {
    return onCurrencyChange(setCurrency);
  }, []);

  // Price Per Night Range Slider limits & state
  const { priceLimitMin, priceLimitMax, priceStep } = useMemo(() => {
    if (currency === 'USD') {
      return { priceLimitMin: 0, priceLimitMax: 800, priceStep: 10 };
    } else {
      return { priceLimitMin: 0, priceLimitMax: 1500000, priceStep: 25000 };
    }
  }, [currency]);

  const [priceRange, setPriceRange] = useState<[number, number]>(() => {
    const stored = readStoredCurrency();
    const saved = restored?.priceRange;
    const max = stored === 'USD' ? 800 : 1500000;
    if (
      restored?.priceCurrency === stored && Array.isArray(saved) &&
      Number.isFinite(saved[0]) && Number.isFinite(saved[1]) &&
      saved[0] >= 0 && saved[1] <= max && saved[0] <= saved[1]
    ) {
      return [saved[0], saved[1]];
    }
    return [0, max];
  });

  // Keep price range bounded within active currency limit when currency toggles
  useEffect(() => {
    if (currency === 'USD') {
      setPriceRange(prev => (prev[1] > 800 ? [0, 800] : prev));
    } else {
      setPriceRange(prev => (prev[1] <= 800 ? [0, 1500000] : prev));
    }
  }, [currency]);
  const [includeUnpricedRooms, setIncludeUnpricedRooms] = useState<boolean>(restored?.includeUnpriced !== false);
  const [showPriceFilterDrawer, setShowPriceFilterDrawer] = useState<boolean>(false);

  const isPriceFiltered = priceRange[0] > priceLimitMin || priceRange[1] < priceLimitMax;

  // Map View specific search and filter states
  const [mapSearchText, setMapSearchText] = useState(() => (typeof restored?.mapSearchText === 'string' ? restored.mapSearchText.slice(0, 80) : ''));
  const [mapRadius, setMapRadius] = useState<number | 'any'>('any');
  const [showMapFiltersModal, setShowMapFiltersModal] = useState(false);

  // User Current Live Location State
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [userLocationLabel, setUserLocationLabel] = useState<string | null>(null);
  const [userLocationAccuracy, setUserLocationAccuracy] = useState<number | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [userLocationError, setUserLocationError] = useState<string | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (activeStayType !== 'All') count++;
    if (activeCategory !== 'All') count++;
    if (isPriceFiltered) count++;
    if (activeAmenities.length > 0) count += activeAmenities.length;
    if (showUserLocation) count++;
    return count;
  }, [activeStayType, activeCategory, isPriceFiltered, activeAmenities.length, showUserLocation]);

  const handleToggleUserLocation = async () => {
    if (showUserLocation) {
      setShowUserLocation(false);
      setUserLocation(null);
      setUserLocationLabel(null);
      setUserLocationError(null);
      if (sortKey === 'distance_asc') {
        setSortKey('recommended');
      }
      toast.success('Current location pin hidden');
      return;
    }

    setIsLocatingUser(true);
    const defaultHub = MALAWI_HUBS[0]; // Lilongwe, Malawi

    if (!('geolocation' in navigator)) {
      setIsLocatingUser(false);
      setUserLocation(defaultHub.coords);
      setUserLocationLabel(`${defaultHub.name} (Default)`);
      setShowUserLocation(true);
      setSortKey('distance_asc');
      toast.success(`Using ${defaultHub.name} as default location.`);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: LatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setUserLocationLabel('Live GPS');
        setUserLocationAccuracy(position.coords.accuracy || 75);
        setShowUserLocation(true);
        setIsLocatingUser(false);
        setSortKey('distance_asc');
        toast.success('Live location found! Distance calculated for all stays.');
      },
      (err) => {
        console.warn('GPS unavailable or blocked, falling back to default:', err);
        setIsLocatingUser(false);
        setUserLocation(defaultHub.coords);
        setUserLocationLabel(`${defaultHub.name} (Default)`);
        setUserLocationAccuracy(null);
        setShowUserLocation(true);
        setSortKey('distance_asc');
        toast.success(`Using ${defaultHub.name} as your default starting location.`);
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    // Restore persisted manual location on mount
    try {
      const saved = localStorage.getItem(MANUAL_LOCATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.coords?.lat && parsed?.coords?.lng) {
          setUserLocation({ lat: parsed.coords.lat, lng: parsed.coords.lng });
          setUserLocationLabel(parsed.label || 'Selected City');
          setShowUserLocation(true);
          setUserLocationAccuracy(500); // manual location, lower accuracy
          setSortKey('distance_asc');
        }
      }
    } catch { /* ignore corrupted storage */ }

    // Listen for manual location selection from AccessRequestModal
    const handleLocationChanged = (e: Event) => {
      const detail = (e as CustomEvent<UserLocationEventDetail>).detail;
      if (detail?.coords?.lat && detail?.coords?.lng) {
        setUserLocation({ lat: detail.coords.lat, lng: detail.coords.lng });
        setUserLocationLabel(detail.label || 'Selected Area');
        setShowUserLocation(true);
        setUserLocationAccuracy(detail.isManual ? 500 : 75);
        setIsLocatingUser(false);
        setSortKey('distance_asc');
        toast.success(`Location set to ${detail.label || 'selected area'}. Distances updated!`);
      }
    };

    const handleLocationCleared = () => {
      setUserLocation(null);
      setUserLocationLabel(null);
      setShowUserLocation(false);
      setUserLocationAccuracy(null);
      if (sortKey === 'distance_asc') {
        setSortKey('recommended');
      }
    };

    window.addEventListener('user-location-changed', handleLocationChanged);
    window.addEventListener('user-location-cleared', handleLocationCleared);
    return () => {
      window.removeEventListener('user-location-changed', handleLocationChanged);
      window.removeEventListener('user-location-cleared', handleLocationCleared);
    };
  }, []);

  const [searchLocation, setSearchLocation] = useState(() => urlFilters.location || restored?.form?.location || '');
  const [searchCheckIn, setSearchCheckIn] = useState(restoredDates.checkIn);
  const [searchCheckOut, setSearchCheckOut] = useState(restoredDates.checkOut);

  // Advanced Guest Selector
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const clampCount = (value: unknown, min: number, max: number, fallback: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  const [adults, setAdults] = useState(() => clampCount(restored?.form?.adults, 1, 16, 2));
  const [children, setChildren] = useState(() => clampCount(restored?.form?.children, 0, 16, 0));
  const [roomsWanted, setRoomsWanted] = useState(() => clampCount(restored?.form?.rooms, 1, 8, 1));
  const totalGuests = adults + children;
  const guestSelectorRef = useRef<HTMLDivElement>(null);

  const [searchProximity, setSearchProximity] = useState(() => clampCount(restored?.form?.proximity, 1, 500, 50));
  const [appliedSearch, setAppliedSearch] = useState<AppliedSearch>(() => {
    if (urlFilters.location) return { ...NO_SEARCH, location: urlFilters.location };
    const a = restored?.applied;
    if (!a) return NO_SEARCH;
    const coords = a.coords && isValidLatLng(a.coords as LatLng) ? { lat: a.coords.lat, lng: a.coords.lng } : null;
    return {
      location: typeof a.location === 'string' ? a.location : '',
      checkIn: restoredDates.checkIn && a.checkIn === restoredDates.checkIn ? a.checkIn : '',
      checkOut: restoredDates.checkOut && a.checkOut === restoredDates.checkOut ? a.checkOut : '',
      guests: typeof a.guests === 'number' && a.guests > 0 && a.guests <= 32 ? a.guests : '',
      coords,
      proximity: clampCount(a.proximity, 1, 500, 50),
    };
  });

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse recent searches', e);
    }
    return [];
  });
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const locationSearchRef = useRef<HTMLDivElement>(null);
  const mapStaysListRef = useRef<HTMLDivElement>(null);
  const checkInInputRef = useRef<HTMLInputElement>(null);
  const checkOutInputRef = useRef<HTMLInputElement>(null);

  const openCheckInPicker = () => {
    if (checkInInputRef.current) {
      try {
        if (typeof checkInInputRef.current.showPicker === 'function') {
          checkInInputRef.current.showPicker();
        } else {
          checkInInputRef.current.focus();
        }
      } catch {
        checkInInputRef.current.focus();
      }
    }
  };

  const openCheckOutPicker = () => {
    if (checkOutInputRef.current) {
      try {
        if (typeof checkOutInputRef.current.showPicker === 'function') {
          checkOutInputRef.current.showPicker();
        } else {
          checkOutInputRef.current.focus();
        }
      } catch {
        checkOutInputRef.current.focus();
      }
    }
  };


  const [heroIndex, setHeroIndex] = useState(0);
  const [customDestinations, setCustomDestinations] = useState<string[]>([]);
  const [manualDestinationsEnabled, setManualDestinationsEnabled] = useState(false);
  const [featuredMode, setFeaturedMode] = useState<'auto' | 'manual' | 'disabled'>('auto');

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % HERO_PLACES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  /**
   * Links from elsewhere (footer, sitemap, search-engine results) can carry
   * `?category=`, `?stayType=`, `?location=` or `?search=`. The first load reads
   * them straight into state; this applies them when the visitor follows such a
   * link while already on the page.
   */
  const urlAppliedRef = useRef(true);
  useEffect(() => {
    const first = urlAppliedRef.current;
    urlAppliedRef.current = false;
    const filters = parseUrlFilters(searchParams.toString());
    let shouldScroll = false;
    if (filters.category) {
      setActiveCategory(filters.category);
      setCurrentPage(1);
      shouldScroll = true;
    }
    if (filters.stayType) {
      setActiveStayType(filters.stayType);
      setCurrentPage(1);
      shouldScroll = true;
    }
    if (filters.location) {
      if (!first) {
        setSearchLocation(filters.location);
        setAppliedSearch(prev => ({ ...NO_SEARCH, checkIn: prev.checkIn, checkOut: prev.checkOut, guests: prev.guests, location: filters.location }));
        setCurrentPage(1);
      }
      shouldScroll = true;
    }
    if (shouldScroll) {
      const timer = setTimeout(
        () => document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        250
      );
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Keep the visitor's search and filters for reload and back navigation.
  useEffect(() => {
    try {
      const snapshot: DiscoverySnapshot = {
        stayType: activeStayType,
        category: activeCategory,
        amenities: activeAmenities,
        sortKey,
        viewMode,
        page: currentPage,
        priceRange,
        priceCurrency: currency,
        includeUnpriced: includeUnpricedRooms,
        mapSearchText,
        form: {
          location: searchLocation, checkIn: searchCheckIn, checkOut: searchCheckOut,
          adults, children, rooms: roomsWanted, proximity: searchProximity,
        },
        applied: appliedSearch,
      };
      sessionStorage.setItem(DISCOVERY_KEY, JSON.stringify(snapshot));
    } catch {
      // storage unavailable: the search still works, it just is not remembered
    }
  }, [
    activeStayType, activeCategory, activeAmenities, sortKey, viewMode, currentPage, priceRange, currency,
    includeUnpricedRooms, mapSearchText, searchLocation, searchCheckIn, searchCheckOut, adults, children,
    roomsWanted, searchProximity, appliedSearch,
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (locationSearchRef.current && !locationSearchRef.current.contains(event.target as Node)) {
        setShowRecentSearches(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('recentSearches');
    } catch (err) {
      console.error('Failed to clear recent searches', err);
    }
  };

  const saveRecentSearch = (search: RecentSearch) => {
    if (!search.location.trim() || search.location === 'Near Me') return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => 
        s.location.toLowerCase() !== search.location.toLowerCase() || 
        s.adults !== search.adults || 
        s.children !== search.children
      );
      const updated = [search, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('recentSearches', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recent searches', e);
      }
      return updated;
    });
  };

  useEffect(() => {
    async function fetchListings() {
      try {
        // Rooms come along with the listings because search now filters on
        // capacity and price, both of which live on the room type.
        const [hotelSnap, roomSnap, settingsSnap] = await Promise.all([
          getDocs(collection(db, 'hotels')),
          getDocs(collection(db, 'room_types')),
          getDoc(doc(db, 'system', 'settings'))
        ]);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setCustomDestinations(data.popularDestinations || []);
          setManualDestinationsEnabled(!!data.manualDestinationsEnabled);
          setFeaturedMode(data.featuredMode || 'auto');
        }

        const hotelsData = hotelSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Hotel[];
        const approvedHotels = hotelsData.filter(h => h.status === 'approved' || !h.status);
        const roomsData = roomSnap.docs.map(d => ({ id: d.id, ...d.data() })) as RoomType[];
        
        setHotels(approvedHotels);
        setRooms(roomsData);

        // Cache offline for travelers with intermittent internet
        saveCachedHotels(approvedHotels);
        saveCachedRooms(roomsData);
        setLoadFailed(false);
      } catch (error) {
        console.error("Error fetching hotels:", error);
        // If offline / network fails, fallback data from cache
        const fallbackHotels = getCachedHotels();
        if (fallbackHotels.length > 0) {
          toast('Using cached offline lodge data', { icon: '📡' });
          setHotels(fallbackHotels);
          setRooms(getCachedRooms());
        } else {
          // Without this the page claimed "Nothing listed yet" when the real
          // problem was that the listings could not be fetched.
          setLoadFailed(true);
        }
      } finally {
        setLoading(false);
      }
    }
    setLoading(prev => prev || getCachedHotels().length === 0);
    fetchListings();

    // Real-time synchronization: Any bulk price updates or promotion launches
    // in the Admin or Manager Dashboard immediately update the live home page
    const unsubHotels = onSnapshot(collection(db, 'hotels'), (snap) => {
      setLoadFailed(false);
      const hotelsData = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Hotel[];
      const approvedHotels = hotelsData.filter(h => h.status === 'approved' || !h.status);
      setHotels(approvedHotels);
      saveCachedHotels(approvedHotels);
    }, (err) => console.warn('Realtime hotels listener warning:', err?.message));

    const unsubRooms = onSnapshot(collection(db, 'room_types'), (snap) => {
      const roomsData = snap.docs.map(d => ({ id: d.id, ...d.data() })) as RoomType[];
      setRooms(roomsData);
      saveCachedRooms(roomsData);
    }, (err) => console.warn('Realtime rooms listener warning:', err?.message));

    // Also listen to immediate in-tab or cross-component window events
    const onRoomsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ rooms: RoomType[] }>;
      if (customEvent.detail?.rooms) {
        setRooms(prev => {
          const map = new Map(customEvent.detail.rooms.map(r => [r.id, r]));
          return prev.map(r => (r.id && map.has(r.id) ? { ...r, ...map.get(r.id) } : r));
        });
      }
    };
    const onHotelsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ hotels: Hotel[] }>;
      if (customEvent.detail?.hotels) {
        setHotels(prev => {
          const map = new Map(customEvent.detail.hotels.map(h => [h.id, h]));
          return prev.map(h => (h.id && map.has(h.id) ? { ...h, ...map.get(h.id) } : h));
        });
      }
    };
    window.addEventListener('travel_malawi_rooms_updated', onRoomsUpdated);
    window.addEventListener('travel_malawi_hotels_updated', onHotelsUpdated);

    // Ratings are a garnish on the listing grid, so this read is kept out of
    // the critical path: until the `reviews` rules are deployed it is denied,
    // and bundling it with the listings would have taken the whole page down.
    getDocs(collection(db, 'reviews'))
      .then(snap => setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Review[]))
      .catch(error => console.warn('Reviews unavailable:', error?.message ?? error));

    return () => {
      unsubHotels();
      unsubRooms();
      window.removeEventListener('travel_malawi_rooms_updated', onRoomsUpdated);
      window.removeEventListener('travel_malawi_hotels_updated', onHotelsUpdated);
    };
  }, [listingsReloadKey]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!showGuestDropdown) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!guestSelectorRef.current?.contains(event.target as Node)) setShowGuestDropdown(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [showGuestDropdown]);

  // Close open filter <details> tags when clicking outside
  useEffect(() => {
    const handleDetailsClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      document.querySelectorAll('details[open]').forEach(el => {
        if (!el.contains(target)) {
          el.removeAttribute('open');
        }
      });
    };
    document.addEventListener('mousedown', handleDetailsClickOutside);
    document.addEventListener('touchstart', handleDetailsClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleDetailsClickOutside);
      document.removeEventListener('touchstart', handleDetailsClickOutside);
    };
  }, []);

  /** Currencies any listing is sold in, so the switch only offers real ones. */
  const offeredCurrencies = useMemo(() => {
    const offered = currenciesForRooms(rooms);
    return offered.length > 0 ? offered : CURRENCY_CODES;
  }, [rooms]);

  const chooseCurrency = (code: CurrencyCode) => {
    setCurrency(code);
    storeCurrency(code);
    if (code === 'USD') {
      setPriceRange([0, 800]);
    } else {
      setPriceRange([0, 1500000]);
    }
  };

  const roomsByHotel = useMemo(() => {
    const map = new Map<string, RoomType[]>();
    for (const room of rooms) {
      if (!room.hotelId) continue;
      const list = map.get(room.hotelId);
      if (list) list.push(room);
      else map.set(room.hotelId, [room]);
    }
    return map;
  }, [rooms]);

  /** All available minimum prices for histogram visual calculation */
  const allAvailablePrices = useMemo(() => {
    return hotels
      .filter(h => !h.status || h.status === 'approved')
      .map(hotel => {
        const hotelRooms = roomsByHotel.get(hotel.id ?? '') ?? [];
        return lowestPrice(hotelRooms, currency);
      });
  }, [hotels, roomsByHotel, currency]);

  /** Average rating per hotel across imported and guest-written reviews. */
  const ratingByHotel = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    const add = (hotelId: string, rating: number) => {
      if (!hotelId || !(rating > 0)) return;
      const entry = totals.get(hotelId) ?? { sum: 0, count: 0 };
      entry.sum += rating;
      entry.count += 1;
      totals.set(hotelId, entry);
    };
    for (const hotel of hotels) {
      for (const review of hotel.reviews ?? []) add(hotel.id!, review.rating);
    }
    for (const review of reviews) add(review.hotelId, review.rating);

    const averages = new Map<string, { average: number; count: number }>();
    totals.forEach((v, k) => averages.set(k, { average: v.sum / v.count, count: v.count }));
    return averages;
  }, [hotels, reviews]);

  /**
   * Bookings are only needed once a date range is in play, and the collection
   * grows with every reservation, so the read is deferred until then.
   */
  const ensureBookings = async (): Promise<BookingLike[]> => {
    if (bookingsLoaded) return bookings;
    // The public inventory mirror; bookings themselves are private.
    const snap = await getDocs(collection(db, 'booking_slots'));
    const loaded = snap.docs.map(d => d.data() as BookingLike);
    setBookings(loaded);
    setBookingsLoaded(true);
    return loaded;
  };

  // A restored search with dates must see live availability, not an empty mirror.
  useEffect(() => {
    if (appliedSearch.checkIn && appliedSearch.checkOut) {
      ensureBookings().catch(error => console.error('Could not load availability:', error));
    }
    // Runs once for the restored search; later searches load bookings themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySearch = async (next: AppliedSearch) => {
    if (next.checkIn && next.checkOut && next.checkOut <= next.checkIn) {
      toast.error('Check-out must be after check-in.');
      return;
    }
    setSearching(true);

    // Gracefully scroll down to the search results with navbar offset
    const resultsEl = document.getElementById('search-results');
    if (resultsEl) {
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
      const tasks: Promise<unknown>[] = [
        new Promise(resolve => setTimeout(resolve, 600))
      ];
      if (next.checkIn && next.checkOut) {
        tasks.push(ensureBookings());
      }
      await Promise.all(tasks);
    } catch (error) {
      // Availability is a refinement, not a gate: fall back to matching on
      // capacity alone rather than showing the visitor nothing.
      console.error('Could not load availability:', error);
      toast('Showing results without live availability.', { icon: '⚠️' });
    } finally {
      setAppliedSearch(next);
      setCurrentPage(1);
      setSearching(false);
      // Ensure clean viewport alignment after search state commit
      setTimeout(() => {
        document.getElementById(viewMode === 'grid' ? 'map-canvas' : 'grid-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  const handleSearch = () => {
    setShowGuestDropdown(false);
    setShowRecentSearches(false);

    if (searchLocation.trim() && searchLocation !== 'Near Me') {
      saveRecentSearch({
        location: searchLocation.trim(),
        adults,
        children,
        roomsWanted,
        timestamp: Date.now()
      });
    }

    applySearch({
      location: searchLocation,
      checkIn: searchCheckIn,
      checkOut: searchCheckOut,
      guests: totalGuests,
      coords: null,
      proximity: searchProximity,
    });
  };

  const handleNearMe = async () => {
    const defaultHub = MALAWI_HUBS[0];
    const applyCoords = (coords: LatLng, label: string) => {
      setSearchLocation(label);
      applySearch({
        location: label,
        checkIn: searchCheckIn,
        checkOut: searchCheckOut,
        guests: totalGuests,
        coords: coords,
        proximity: searchProximity,
      });
      toast.success(`Showing places near ${label} (${searchProximity}km).`);
    };

    if (!navigator.geolocation) {
      applyCoords(defaultHub.coords, defaultHub.name);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'Near Me');
      },
      (err) => {
        console.warn('Near me geolocation error, using default hub:', err);
        applyCoords(defaultHub.coords, defaultHub.name);
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  };

  /** Resets both the applied search and the controls that produced it. */
  const clearFilters = () => {
    setAppliedSearch(NO_SEARCH);
    setSearchLocation('');
    setSearchCheckIn('');
    setSearchCheckOut('');
    setSearchProximity(50);
    setActiveStayType('All');
    setActiveCategory('All');
    setActiveAmenities([]);
    setSortKey('recommended');
    // Previously left untouched, so "clear all filters" silently kept the
    // party size that had caused the empty result in the first place.
    setAdults(2);
    setChildren(0);
    setRoomsWanted(1);
    setPriceRange([priceLimitMin, priceLimitMax]);
    setIncludeUnpricedRooms(true);
    setMapSearchText('');
    setMapRadius('any');
  };

  const activeMapFiltersCount = useMemo(() => {
    let count = 0;
    if (mapSearchText.trim()) count++;
    if (isPriceFiltered) count++;
    if (mapRadius !== 'any') count++;
    if (activeStayType !== 'All') count++;
    if (activeCategory !== 'All') count++;
    return count;
  }, [mapSearchText, isPriceFiltered, activeStayType, activeCategory, mapRadius]);

  const clearMapFilters = () => {
    setMapSearchText('');
    setPriceRange([priceLimitMin, priceLimitMax]);
    setIncludeUnpricedRooms(true);
    setMapRadius('any');
    setActiveStayType('All');
    setActiveCategory('All');
    setActiveAmenities([]);
  };

  
  const searchSuggestions = useMemo(() => {
    if (!searchLocation.trim()) return [];
    
    const query = searchLocation.toLowerCase().trim();
    const suggestions = [];
    
    // Extract unique locations
    const locations = Array.from(new Set(hotels.map(h => (h.location || '').trim()))).filter(loc => loc.toLowerCase().includes(query));
    
    locations.forEach(loc => {
      suggestions.push({ type: 'location', text: loc });
    });
    
    // Extract hotels
    const matchingHotels = hotels.filter(h => 
      (h.name || '').toLowerCase().includes(query) || 
      (h.locationNotes && h.locationNotes.toLowerCase().includes(query))
    );
    
    matchingHotels.forEach(h => {
      suggestions.push({ type: 'hotel', text: h.name, id: h.id, subtitle: h.location });
    });
    
    return suggestions.slice(0, 8); // Limit to top 8 suggestions
  }, [searchLocation, hotels]);

  const hasSearch = !!(appliedSearch.location || appliedSearch.coords || appliedSearch.checkIn || appliedSearch.guests);

  /**
   * The one-tap destinations under the search bar. Taken from the listings
   * that actually exist, most-listed first, so a chip always has something
   * behind it — a hard-coded list would send visitors to an empty page as soon
   * as it drifted from the data.
   */
  const popularDestinations = useMemo(() => {
    if (manualDestinationsEnabled) {
      return customDestinations || [];
    }
    const counts = new Map<string, number>();
    for (const hotel of hotels) {
      const location = hotel.location?.trim();
      if (!location || !/^[A-Za-z][A-Za-z\s'&.,-]{2,}$/.test(location)) continue;
      counts.set(location, (counts.get(location) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([location]) => location);
    return ranked.length > 0 ? ranked.slice(0, 6) : FALLBACK_DESTINATIONS;
  }, [hotels, customDestinations, manualDestinationsEnabled]);


  /**
   * Search results. Dates and party size used to be collected and then
   * discarded — only the text box actually filtered anything. They now decide
   * which properties have a room that can take the party on those nights.
   */
  const filteredHotels = useMemo(() => {
    const approved = hotels.filter(h => !h.status || h.status === 'approved');
    const byCategory = activeCategory === 'All'
      ? approved
      : approved.filter(h => h.categories?.includes(activeCategory));

    const byStayType = activeStayType === 'All'
      ? byCategory
      : byCategory.filter(h => matchesStayType(h, activeStayType));

    const guests = typeof appliedSearch.guests === 'number' ? appliedSearch.guests : undefined;

    const matched = byStayType
      .map(hotel => {
        const hotelRooms = roomsByHotel.get(hotel.id ?? '') ?? [];
        const matching = roomsMatching(hotelRooms, bookings, {
          checkIn: appliedSearch.checkIn || undefined,
          checkOut: appliedSearch.checkOut || undefined,
          guests,
        });
        const coordinates = resolveHotelCoordinates(hotel);
        const distance =
          appliedSearch.coords && isValidLatLng(coordinates)
            ? distanceKm(appliedSearch.coords, coordinates)
            : null;

        const userDistance =
          showUserLocation && isValidLatLng(userLocation) && isValidLatLng(coordinates)
            ? distanceKm(userLocation, coordinates)
            : null;

        const secondaryCurrency: CurrencyCode = currency === 'MWK' ? 'USD' : 'MWK';
        return {
          hotel,
          matching,
          distance,
          userDistance,
          coordinates,
          // Listings with no rooms loaded yet keep their headline price blank
          // rather than advertising a misleading zero. A listing not sold in the
          // chosen currency shows "rates on request" instead of a converted one.
          priceFrom: lowestPrice(matching.length ? matching : hotelRooms, currency),
          secondaryPriceFrom: lowestPrice(matching.length ? matching : hotelRooms, secondaryCurrency),
          secondaryCurrency,
          rating: ratingByHotel.get(hotel.id ?? '') ?? null,
          hasRooms: hotelRooms.length > 0,
        };
      })
      .filter(entry => {
        // A radius search is meaningless for a listing with no pin, so those
        // are left out rather than silently included at an unknown distance.
        if (appliedSearch.coords) {
          if (entry.distance === null) return false;
          if (entry.distance > appliedSearch.proximity) return false;
        }
        if (appliedSearch.location && appliedSearch.location !== 'Near Me') {
          const q = appliedSearch.location.toLowerCase();
          if (!(entry.hotel.name || '').toLowerCase().includes(q) && 
              !(entry.hotel.location || '').toLowerCase().includes(q) && 
              !entry.hotel.locationNotes?.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Map View quick search query
        if (mapSearchText.trim()) {
          const q = mapSearchText.trim().toLowerCase();
          const nameMatch = (entry.hotel.name || '').toLowerCase().includes(q);
          const locationMatch = (entry.hotel.location || '').toLowerCase().includes(q);
          const descMatch = entry.hotel.description?.toLowerCase().includes(q);
          const notesMatch = entry.hotel.locationNotes?.toLowerCase().includes(q);
          const catMatch = entry.hotel.categories?.some(c => c.toLowerCase().includes(q));
          if (!nameMatch && !locationMatch && !descMatch && !notesMatch && !catMatch) {
            return false;
          }
        }

        // Price Range Slider Filter
        if (isPriceFiltered) {
          if (entry.priceFrom !== null) {
            if (entry.priceFrom < priceRange[0]) return false;
            if (priceRange[1] < priceLimitMax && entry.priceFrom > priceRange[1]) return false;
          } else {
            if (!includeUnpricedRooms) return false;
          }
        }

        // Amenities Filter
        if (activeAmenities.length > 0) {
          const hotelAmenities = entry.hotel.amenities || [];
          if (!activeAmenities.every(amenity => hotelAmenities.includes(amenity))) {
            return false;
          }
        }

        // Map Radius filter
        if (showUserLocation && userLocation && mapRadius !== 'any') {
          if (entry.userDistance === null || entry.userDistance > mapRadius) return false;
        }

        // A property whose rooms have not been set up is still worth showing;
        // one with rooms that cannot take this party is not.
        if ((guests || appliedSearch.checkIn) && entry.hasRooms && entry.matching.length === 0) return false;
        return true;
      });

    const sorted = [...matched];
    if (sortKey === 'distance_asc') {
      sorted.sort((a, b) => {
        const distA = a.userDistance ?? a.distance ?? Infinity;
        const distB = b.userDistance ?? b.distance ?? Infinity;
        return distA - distB;
      });
    } else if (appliedSearch.coords && sortKey === 'recommended') {
      sorted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else if (sortKey === 'price_asc') {
      sorted.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
    } else if (sortKey === 'price_desc') {
      sorted.sort((a, b) => (b.priceFrom ?? -Infinity) - (a.priceFrom ?? -Infinity));
    } else if (sortKey === 'rating') {
      sorted.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
    } else if (sortKey === 'name_asc') {
      sorted.sort((a, b) => (a.hotel.name || '').localeCompare(b.hotel.name || ''));
    }
    return sorted;
  }, [
    hotels, roomsByHotel, bookings, ratingByHotel, activeCategory, activeStayType,
    appliedSearch, sortKey, currency, mapSearchText,
    showUserLocation, userLocation,
    isPriceFiltered, priceRange, priceLimitMax, includeUnpricedRooms
  ]);

  // Any change to what the visitor is filtering on starts them back at page 1,
  // otherwise a narrower result set can leave them on an empty page.
  const filterSignature = JSON.stringify([
    activeCategory, activeStayType, activeAmenities, appliedSearch, sortKey, mapSearchText,
    mapRadius, priceRange, includeUnpricedRooms,
  ]);
  const filterSignatureRef = useRef(filterSignature);
  useEffect(() => {
    // The first run is the restored state, so its page must be kept.
    if (filterSignatureRef.current === filterSignature) return;
    filterSignatureRef.current = filterSignature;
    setCurrentPage(1);
  }, [filterSignature]);

  // Data refreshes can also shrink the list; keep the page in range.
  const totalPages = Math.max(1, Math.ceil(filteredHotels.length / itemsPerPage));
  useEffect(() => {
    if (loading) return; // nothing is listed yet, so the page count means nothing
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, loading]);

  /**
   * Prepared map markers for clustered Map View.
   * Resolves genuine GPS coordinates across Malawi for every property.
   */
  const lodgeMarkers: LodgeMarker[] = useMemo(() => {
    return filteredHotels
      .map(entry => {
        const hotel = entry.hotel;
        const coords = entry.coordinates;
        const primaryImage = getHotelImage(hotel);
        const categoryLabel = hotel.categories?.[0] || 'Lodge';
        return {
          id: hotel.id ?? '',
          name: hotel.name,
          location: hotel.location,
          coordinates: coords,
          priceFrom: entry.priceFrom,
          priceCurrency: currency,
          image: primaryImage,
          rating: entry.rating?.average,
          category: categoryLabel,
          slug: hotel.id,
          distanceFromUser: entry.userDistance,
        };
      })
      .filter(l => isValidLatLng(l.coordinates));
  }, [filteredHotels, currency]);

  // Prevent scroll chaining to the outer page when cursor is within the Map View stays list
  useEffect(() => {
    const el = mapStaysListRef.current;
    if (!el || viewMode !== 'map') return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isScrollingUp = e.deltaY < 0;
      const isScrollingDown = e.deltaY > 0;

      // If at top or bottom boundary, prevent outer page from scrolling
      if (scrollTop <= 0 && isScrollingUp) {
        e.preventDefault();
        return;
      }
      if (scrollTop + clientHeight >= scrollHeight - 1 && isScrollingDown) {
        e.preventDefault();
        return;
      }

      // Stop propagation so outer document wheel listeners don't trigger page movement
      e.stopPropagation();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [viewMode, filteredHotels.length]);

  // Smooth scroll within the sidebar container when a map marker is selected
  useEffect(() => {
    if (selectedMapLodgeId && mapStaysListRef.current && viewMode === 'map') {
      const cardEl = document.getElementById(`map-card-${selectedMapLodgeId}`);
      if (cardEl && mapStaysListRef.current) {
        const container = mapStaysListRef.current;
        const cardTop = cardEl.offsetTop - container.offsetTop;
        container.scrollTo({ top: Math.max(0, cardTop - 40), behavior: 'smooth' });
      }
    }
  }, [selectedMapLodgeId, viewMode]);

  /**
   * The three properties shown above the fold when nothing is being searched.
   *
   * An admin can promote a listing from the admin dashboard, and those come
   * first, newest promotion first. Anything left over is filled by guest
   * rating, so the row is never short and still means something when nobody
   * has promoted anything.
   */
  const featuredHotels = useMemo(() => {
    if (featuredMode === 'disabled') return [];

    const secondaryCurrency: CurrencyCode = currency === 'MWK' ? 'USD' : 'MWK';

    const enriched = hotels.map(hotel => {
      const hotelRooms = roomsByHotel.get(hotel.id ?? '') ?? [];
      return {
        hotel,
        priceFrom: lowestPrice(hotelRooms, currency),
        secondaryPriceFrom: lowestPrice(hotelRooms, secondaryCurrency),
        secondaryCurrency,
        rating: ratingByHotel.get(hotel.id ?? '') ?? null,
      };
    });

    const promoted = enriched
      .filter(entry => entry.hotel.featured)
      .sort((a, b) => (b.hotel.featuredAt ?? 0) - (a.hotel.featuredAt ?? 0));

    if (featuredMode === 'manual') {
      return promoted.slice(0, 3);
    }

    const rest = enriched
      .filter(entry => !entry.hotel.featured)
      .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));

    return [...promoted, ...rest].slice(0, 3);
  }, [hotels, roomsByHotel, ratingByHotel, currency, featuredMode]);

  /** Whether the row above is a real editorial pick or just the best rated. */
  const hasPromotedFeatures = useMemo(() => hotels.some(h => h.featured), [hotels]);

  // State, not the URL: clearing a filter must not leave its old title behind.
  const currentLocParam = appliedSearch.location && appliedSearch.location !== 'Near Me' ? appliedSearch.location : undefined;
  const currentCategoryParam = activeCategory !== 'All' ? activeCategory : undefined;

  const pageSeo = useMemo(() => {
    return generateAutonomousSeo({
      hotels,
      filteredHotels,
      roomsByHotel,
      ratingByHotel,
      locationParam: currentLocParam,
      categoryParam: currentCategoryParam,
      searchParam: null,
    });
  }, [
    hotels,
    filteredHotels,
    roomsByHotel,
    ratingByHotel,
    currentLocParam,
    currentCategoryParam,
  ]);

  return (
    <div className="flex flex-col min-h-screen">
      <SEOHead
        title={pageSeo.title}
        description={pageSeo.description}
        keywords={pageSeo.keywords}
        url={pageSeo.url}
        schema={pageSeo.schema}
      />
      {/* Hero */}
      <section className="relative z-20 min-h-[50svh] sm:min-h-[54svh] md:min-h-[58svh] lg:min-h-[80svh] xl:min-h-[86svh] 2xl:min-h-[90svh] w-full flex flex-col justify-center items-center pb-12 sm:pb-16 md:pb-20 lg:pb-28 pt-20 sm:pt-24 md:pt-28 lg:pt-36 bg-stone-950 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 1.08, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-0 overflow-hidden"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            className="w-full h-full"
          >
            <SmartImage
              src={HERO_IMAGE}
              fallbacks={[DECORATIVE_IMAGE]}
              alt=""
              aria-hidden="true"
              loading="eager"
              className="w-full h-full object-cover object-center"
            />
          </motion.div>
        </motion.div>

        {/* Scrims for text legibility */}
        <div className="absolute inset-0 z-10 bg-stone-950/60" />
        <div className="absolute inset-0 z-10 bg-radial-[at_center_center] from-transparent via-stone-950/30 to-stone-950/80" />

        <div className="relative z-20 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center my-auto">
          <motion.div
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-xl mx-auto"
          >
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-normal text-stone-100 tracking-tight leading-[1.2] text-balance">
              Find your <span className="italic font-light text-amber-100/90">quiet escape.</span>
            </h1>
            <p className="mt-2.5 text-xs sm:text-sm text-stone-300/85 font-light max-w-md leading-relaxed mx-auto text-balance">
              Cottages, lodges, guest houses, and safari camps booked direct across Malawi — zero commission.
            </p>
          </motion.div>
        </div>

        <motion.ul
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="relative z-20 hidden lg:flex items-center justify-center gap-3 text-[11px] text-stone-300/85 mt-6 px-4"
        >
          <li className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/40 border border-stone-700/40">
            <ShieldCheck className="h-3 w-3 text-stone-300" />
            <span>Zero booking fees</span>
          </li>
          <li className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/40 border border-stone-700/40">
            <MessageCircle className="h-3 w-3 text-stone-300" />
            <span>Direct host communication</span>
          </li>
          <li className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/40 border border-stone-700/40">
            <Smartphone className="h-3 w-3 text-stone-300" />
            <span>Pay directly at property</span>
          </li>
        </motion.ul>
      </section>

      {/* Floating Compact Search Bar */}
      <section className="relative z-30 -mt-7 sm:-mt-8 lg:-mt-9 px-3 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`relative bg-[#FBF9F5]/98 rounded-2xl p-2 sm:p-2.5 md:p-1.5
                     shadow-sm border border-stone-200
                     w-full transition-all ${
                       showRecentSearches || showGuestDropdown ? 'z-50' : 'z-30'
                     }`}
        >
          <div className="grid grid-cols-2 md:flex md:flex-row md:items-center gap-1.5 md:gap-0 w-full text-left">
            {/* Where */}
            <div
              ref={locationSearchRef}
              className={`col-span-2 md:flex-[1.3] md:min-w-0 relative rounded-lg px-3 py-1.5 md:px-3.5 md:py-1.5 hover:bg-stone-50 transition group border border-stone-200/60 md:border-none ${
                showRecentSearches ? 'z-50 bg-stone-50' : 'z-20'
              }`}
            >
              <label htmlFor="search-where" className="block text-xs font-medium text-stone-500 mb-0.5">
                Destination
              </label>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                <input
                  id="search-where"
                  type="text"
                  value={searchLocation}
                  onChange={e => setSearchLocation(e.target.value)}
                  onFocus={() => setShowRecentSearches(true)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="Where in Malawi?"
                  autoComplete="off"
                  className="bg-transparent border-none p-0 text-stone-900 text-xs font-medium w-full outline-none placeholder:text-stone-400 placeholder:font-normal"
                />
              </div>

              {/* Where to Dropdown */}
              {showRecentSearches && (
                <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] sm:min-w-[340px] bg-[#FBF9F5] rounded-2xl shadow-sm border border-stone-200/90 overflow-hidden z-[100]">
                  <div className="p-3 space-y-3">
                    {/* 1. Live Suggestions when typing */}
                    {searchLocation.trim() && searchSuggestions.length > 0 ? (
                      <div>
                        <h4 className="text-xs font-medium text-stone-500 mb-2 px-2">Suggestions</h4>
                        <ul className="space-y-1">
                          {searchSuggestions.map((suggestion, i) => (
                            <li key={`${suggestion.text}-${i}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchLocation(suggestion.text);
                                  setShowRecentSearches(false);
                                  saveRecentSearch({
                                    location: suggestion.text,
                                    adults,
                                    children,
                                    roomsWanted,
                                    timestamp: Date.now()
                                  });
                                  applySearch({
                                    location: suggestion.text,
                                    checkIn: searchCheckIn,
                                    checkOut: searchCheckOut,
                                    guests: totalGuests,
                                    coords: null,
                                    proximity: searchProximity,
                                  });
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl bg-stone-100/60 hover:bg-stone-200/60 border border-stone-200/40 hover:border-stone-300 transition flex items-center gap-2.5 group/item"
                              >
                                <div className="h-7 w-7 rounded-lg bg-white border border-stone-200/80 flex items-center justify-center shrink-0 text-stone-700 shadow-xs group-hover/item:border-stone-400 transition">
                                  {suggestion.type === 'location' ? <MapPin className="w-3.5 h-3.5 text-stone-700" /> : <Search className="w-3.5 h-3.5 text-stone-700" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-900 text-xs sm:text-sm truncate group-hover/item:text-stone-950">{suggestion.text}</div>
                                  {suggestion.subtitle && (
                                    <div className="text-[11px] text-stone-500 truncate">{suggestion.subtitle}</div>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* 2. Instant Geolocation / Near Me Option */}
                    {!searchLocation.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowRecentSearches(false);
                          handleNearMe();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200/80 text-left transition group/geo"
                      >
                        <div className="h-7 w-7 rounded-lg bg-white border border-stone-300 flex items-center justify-center shrink-0 text-stone-800 shadow-xs">
                          <LocateFixed className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-stone-900 text-xs sm:text-sm">Find stays near me</div>
                          <div className="text-[11px] text-stone-500">Use your current GPS coordinates</div>
                        </div>
                      </button>
                    )}

                    {/* 3. Recent Searches */}
                    {!searchLocation.trim() && recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-2 mb-1">
                          <h4 className="text-sm font-medium text-stone-700">Recent searches</h4>
                          <button
                            type="button"
                            onClick={clearRecentSearches}
                            className="text-xs text-stone-500 hover:text-stone-900"
                          >
                            Clear
                          </button>
                        </div>
                        <ul className="space-y-1">
                          {recentSearches.map((rs, i) => (
                            <li key={`${rs.location}-${rs.timestamp || i}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchLocation(rs.location);
                                  setAdults(rs.adults);
                                  setChildren(rs.children);
                                  setRoomsWanted(rs.roomsWanted);
                                  setShowRecentSearches(false);
                                  saveRecentSearch({
                                    location: rs.location,
                                    adults: rs.adults,
                                    children: rs.children,
                                    roomsWanted: rs.roomsWanted,
                                    timestamp: Date.now()
                                  });
                                  applySearch({
                                    location: rs.location,
                                    checkIn: searchCheckIn,
                                    checkOut: searchCheckOut,
                                    guests: rs.adults + rs.children,
                                    coords: null,
                                    proximity: searchProximity,
                                  });
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl bg-stone-100/60 hover:bg-stone-200/60 border border-stone-200/40 hover:border-stone-300 transition flex items-center gap-2.5 group/rs"
                              >
                                <div className="h-7 w-7 rounded-lg bg-white border border-stone-200/80 flex items-center justify-center shrink-0 text-stone-500 shadow-xs">
                                  <Clock className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-800 text-xs sm:text-sm truncate group-hover/rs:text-stone-950">{rs.location}</div>
                                  <div className="text-[11px] text-stone-500 truncate">
                                    {rs.adults + rs.children} guest{rs.adults + rs.children !== 1 ? 's' : ''} • {rs.roomsWanted} room{rs.roomsWanted !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 4. Popular Places in Malawi Chips inside Dropdown */}
                    {!searchLocation.trim() && (
                      <div className="pt-2 border-t border-stone-200/60">
                        <h4 className="text-xs font-medium text-stone-500 mb-1.5 px-2">Popular destinations</h4>
                        <div className="flex flex-wrap gap-1 px-1">
                          {popularDestinations.map((dest, dIdx) => (
                            <button
                              key={`drop-${dest}-${dIdx}`}
                              type="button"
                              onClick={() => {
                                setSearchLocation(dest);
                                setShowRecentSearches(false);
                                saveRecentSearch({
                                  location: dest,
                                  adults,
                                  children,
                                  roomsWanted,
                                  timestamp: Date.now()
                                });
                                applySearch({
                                  location: dest,
                                  checkIn: searchCheckIn,
                                  checkOut: searchCheckOut,
                                  guests: totalGuests,
                                  coords: null,
                                  proximity: searchProximity,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 border border-stone-200/70 hover:border-stone-300 text-[11px] font-medium transition"
                            >
                              {dest}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden md:block h-5 w-px bg-stone-200/80 mx-1" />

            {/* Check In */}
            <div
              onClick={openCheckInPicker}
              className="col-span-1 md:flex-1 md:min-w-0 rounded-lg px-3 py-1.5 md:px-3 md:py-1.5 hover:bg-stone-50 transition border border-stone-200/60 md:border-none cursor-pointer group"
            >
              <label
                htmlFor="search-check-in"
                className="block text-xs font-medium text-stone-500 mb-0.5 cursor-pointer"
              >
                Check in
              </label>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-stone-400 shrink-0 group-hover:text-stone-700 transition" />
                <input
                  ref={checkInInputRef}
                  id="search-check-in"
                  type="date"
                  aria-label="Check in"
                  min={today}
                  value={searchCheckIn}
                  onChange={e => setSearchCheckIn(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    openCheckInPicker();
                  }}
                  className="bg-transparent border-none p-0 text-stone-900 text-xs font-medium w-full outline-none min-w-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="hidden md:block h-5 w-px bg-stone-200/80 mx-1" />

            {/* Check Out */}
            <div
              onClick={openCheckOutPicker}
              className="col-span-1 md:flex-1 md:min-w-0 rounded-lg px-3 py-1.5 md:px-3 md:py-1.5 hover:bg-stone-50 transition border border-stone-200/60 md:border-none cursor-pointer group"
            >
              <label
                htmlFor="search-check-out"
                className="block text-xs font-medium text-stone-500 mb-0.5 cursor-pointer"
              >
                Check out
              </label>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-stone-400 shrink-0 group-hover:text-stone-700 transition" />
                <input
                  ref={checkOutInputRef}
                  id="search-check-out"
                  type="date"
                  aria-label="Check out"
                  min={searchCheckIn || today}
                  value={searchCheckOut}
                  onChange={e => setSearchCheckOut(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    openCheckOutPicker();
                  }}
                  className="bg-transparent border-none p-0 text-stone-900 text-xs font-medium w-full outline-none min-w-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="hidden md:block h-5 w-px bg-stone-200/80 mx-1" />

            {/* Who / Guests */}
            <div
              ref={guestSelectorRef}
              className={`col-span-1 md:flex-1 md:min-w-0 relative rounded-lg px-3 py-1.5 md:px-3 md:py-1.5 hover:bg-stone-50 transition border border-stone-200/60 md:border-none ${
                showGuestDropdown ? 'z-50 bg-stone-50' : 'z-20'
              }`}
            >
              <button
                type="button"
                onClick={() => setShowGuestDropdown(v => !v)}
                aria-expanded={showGuestDropdown}
                className="w-full text-left cursor-pointer"
              >
                <span className="block text-xs font-medium text-stone-500 mb-0.5">
                  Guests
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                  <span className="text-xs font-medium text-stone-900 truncate">
                    {totalGuests === 0
                      ? 'Add guests'
                      : `${totalGuests} guest${totalGuests > 1 ? 's' : ''}`}
                  </span>
                  <ChevronDown className={`h-3 w-3 text-stone-400 shrink-0 ml-auto transition ${showGuestDropdown ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {showGuestDropdown && (
                <div className="absolute top-full left-0 right-0 sm:left-auto sm:right-0 sm:w-72 mt-2 bg-[#FBF9F5] rounded-2xl shadow-sm ring-1 ring-stone-200 p-2 z-[100]">
                  {(!searchCheckIn || !searchCheckOut) && (
                    <div className="mb-2 p-2.5 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-center justify-between gap-2">
                      <div className="text-[11px] text-amber-900 leading-tight">
                        <span className="font-semibold block">Select dates first</span>
                        <span className="text-xs text-amber-800">For accurate rates & room capacity</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowGuestDropdown(false);
                          openCheckInPicker();
                        }}
                        className="text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
                      >
                        Pick Dates
                      </button>
                    </div>
                  )}
                  {([
                    { label: 'Adults', hint: 'Ages 13 or above', value: adults, set: setAdults, min: 1, max: 16 },
                    { label: 'Children', hint: 'Ages 2–12', value: children, set: setChildren, min: 0, max: 16 },
                    { label: 'Rooms', hint: 'Up to 8', value: roomsWanted, set: setRoomsWanted, min: 1, max: 8 },
                  ] as const).map((row, rIdx) => (
                    <div key={`${row.label}-${rIdx}`} className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-stone-200/50">
                      <div>
                        <span className="block text-xs font-semibold text-stone-900">{row.label}</span>
                        <span className="text-xs text-stone-500">{row.hint}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Fewer ${row.label.toLowerCase()}`}
                          disabled={row.value <= row.min}
                          onClick={() => row.set(Math.max(row.min, row.value - 1))}
                          className="h-7 w-7 grid place-items-center rounded-full border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 transition text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-4 text-center text-xs font-semibold tabular-nums text-stone-800">{row.value}</span>
                        <button
                          type="button"
                          aria-label={`More ${row.label.toLowerCase()}`}
                          disabled={row.value >= row.max}
                          onClick={() => row.set(Math.min(row.max, row.value + 1))}
                          className="h-7 w-7 grid place-items-center rounded-full border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 transition text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search CTA button */}
            <div className="col-span-1 md:shrink-0 flex items-center p-0.5">
              <button
                onClick={handleSearch}
                disabled={searching}
                className="w-full md:w-auto h-full min-h-[40px] flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 active:scale-98 text-white rounded-lg px-4 py-2 font-medium text-xs tracking-normal transition disabled:opacity-60 cursor-pointer"
              >
                {searching
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-400 border-t-white" />
                  : <Search className="h-3.5 w-3.5 text-stone-300" />}
                <span>Search stays</span>
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Popular Destinations */}
      {popularDestinations.length > 0 && (
        <section className="bg-stone-50/60 py-2 sm:py-2.5 border-b border-stone-200/70">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden w-full">
              <span className="text-xs sm:text-sm text-stone-500 shrink-0 select-none whitespace-nowrap">
                Popular destinations
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {popularDestinations.map((destination, dIdx) => (
                  <button
                    key={`pop-${destination}-${dIdx}`}
                    type="button"
                    onClick={() => {
                      setSearchLocation(destination);
                      saveRecentSearch({
                        location: destination,
                        adults,
                        children,
                        roomsWanted,
                        timestamp: Date.now()
                      });
                      applySearch({
                        location: destination,
                        checkIn: searchCheckIn,
                        checkOut: searchCheckOut,
                        guests: totalGuests,
                        coords: null,
                        proximity: searchProximity,
                      });
                    }}
                    className="h-7 sm:h-7.5 rounded-full border border-stone-200/80 bg-white hover:bg-stone-50 px-3 text-[11px] sm:text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:text-stone-900 active:scale-95 cursor-pointer whitespace-nowrap shrink-0  flex items-center"
                  >
                    {destination}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Destinations */}
        {!hasSearch && featuredHotels.length > 0 && (
          <section className="bg-stone-50/50 py-12 md:py-14 border-b border-stone-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-stone-500 mb-1">
                    {hasPromotedFeatures ? 'Hand-picked by Travel Malawi' : 'Rated by people who stayed'}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-serif text-stone-900 tracking-tight">
                    {hasPromotedFeatures ? 'Featured stays' : 'The ones guests go back to'}
                  </h2>
                </div>
                <button
                  onClick={() => document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="tm-link self-start md:self-auto"
                >
                  See everywhere
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredHotels.map((entry, index) => (
                  <Link key={`featured-${entry.hotel.id || 'hotel'}-${index}`} to={`/hotel/${entry.hotel.id}`} className="group flex flex-col gap-3">
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-100 rounded-2xl shadow-xs">
                      <SmartImage
                        src={getHotelImage(entry.hotel)}
                        alt={entry.hotel.name}
                        className="absolute inset-0 w-full h-full object-cover transition duration-700 ease-out group-hover:scale-105"
                      />
                      {index === 0 && !hasPromotedFeatures ? (
                        <span className="absolute top-3.5 left-3.5 bg-white/95 text-stone-900 text-xs font-medium px-2.5 py-1 rounded-md shadow-sm">
                          Best rated
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1 px-1">
                      <p className="text-xs text-stone-500">
                        {entry.hotel.location}
                      </p>
                      <h3 className="font-serif text-base sm:text-lg md:text-xl font-bold text-stone-900 leading-snug line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem] group-hover:text-emerald-700 transition-colors">
                        <MaskedPlaceName name={entry.hotel.name} fallback="[Featured Stay]" />
                      </h3>
                      <div className="flex items-start justify-between mt-0.5 gap-2">
                        {entry.priceFrom ? (() => {
                          const promo = getActivePromotion(entry.hotel, appliedSearch.checkIn, 'all');
                          const slashed = calculateSlashedPrice(entry.priceFrom, promo, currency);

                          return slashed.hasDiscount ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-xs font-medium">
                                  {slashed.saleTypeLabel}
                                </span>
                                <span className="text-emerald-700 text-xs font-medium">
                                  Save {slashed.discountPercentage}%
                                </span>
                              </div>
                              <div className="flex items-baseline gap-1 flex-wrap">
                                <span className="text-xs text-stone-400">From</span>
                                <PriceDisplay className="text-stone-400 font-medium line-through decoration-stone-300 text-xs" amount={entry.priceFrom} currency={currency} />
                                <span className="text-stone-400 font-bold text-xs">&gt;</span>
                                <span className="text-xs text-red-600">to</span>
                                <PriceDisplay className="text-red-600 font-bold text-sm sm:text-base tracking-tight" amount={slashed.slashedPrice} currency={currency} />
                                <span className="text-stone-400 text-[11px] sm:text-xs"> / night</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-baseline flex-wrap gap-x-1.5">
                              <p className="text-xs sm:text-sm text-stone-600">
                                <span className="text-stone-500 text-[11px] sm:text-xs mr-1 font-medium">From</span>
                                <PriceDisplay className="text-stone-900 font-bold text-sm sm:text-base tracking-tight" amount={entry.priceFrom} currency={currency} />
                                <span className="text-stone-400 text-[11px] sm:text-xs"> / night</span>
                              </p>
                              {entry.secondaryPriceFrom ? (
                                <span className="text-xs text-stone-400 font-medium">
                                  ({formatMoney(entry.secondaryPriceFrom, entry.secondaryCurrency)})
                                </span>
                              ) : null}
                            </div>
                          );
                        })() : (
                          <span className="text-xs text-stone-400">Ask the host for rates</span>
                        )}
                        {entry.rating && (
                          <span className="flex items-center gap-1 text-xs text-stone-600 font-semibold">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{entry.rating.average.toFixed(1)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

      {/* Main Property Listings & Map Section */}
      <section id="search-results" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 w-full flex-1">
        {/* Results Header Title */}
        <div className="text-center mb-5 max-w-xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-serif text-stone-900 mb-1 tracking-tight font-normal">
            {hasSearch ? 'What matched' : 'Every stay in Malawi'}
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm font-light">
            {hasSearch
              ? `${filteredHotels.length} propert${filteredHotels.length === 1 ? 'y' : 'ies'} can take you.`
              : 'Cottages, guest houses, lodges, and camps — booked direct with the host.'}
          </p>
        </div>

          {/* Filter Toolbar - Compact Collapsible Dropdown on Mobile, Streamlined Strip on Desktop */}
          <div className="mb-5 sm:mb-6 flex flex-col gap-2.5 bg-stone-50/70 border border-stone-200/80 p-2 sm:p-2.5 rounded-xl">
            {/* Mobile Filter Bar & Collapsible Trigger (Mobile only: < sm) */}
            <div className="flex sm:hidden items-center justify-between gap-2 w-full">
              {/* Collapsible Dropdown Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(prev => !prev)}
                className={`flex-1 h-9 px-3 rounded-lg border text-xs font-medium flex items-center justify-between transition-colors  cursor-pointer ${
                  isMobileFilterOpen || activeFiltersCount > 0
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
                }`}
                aria-expanded={isMobileFilterOpen}
                title="Toggle filter and sort menu"
              >
                <div className="flex items-center gap-2 truncate">
                  <SlidersHorizontal className={`w-3.5 h-3.5 shrink-0 ${isMobileFilterOpen || activeFiltersCount > 0 ? 'text-white' : 'text-stone-600'}`} />
                  <span className="font-semibold truncate">
                    {activeFiltersCount > 0
                      ? `${activeStayType !== 'All' ? (STAY_TYPE_LABELS[activeStayType] || activeStayType) : 'Filtered'} (${activeFiltersCount})`
                      : 'Filter & Sort Stays'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                  <span className="text-[11px] opacity-85">{isMobileFilterOpen ? 'Close' : 'Filter'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMobileFilterOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Quick Currency Selector on Mobile */}
              {offeredCurrencies.length > 1 && (
                <div className="flex items-center h-9 bg-white p-0.5 rounded-lg border border-stone-200  shrink-0">
                  {offeredCurrencies.map((code, cIdx) => (
                    <button
                      key={`mob-curr-${code}-${cIdx}`}
                      type="button"
                      onClick={() => chooseCurrency(code)}
                      aria-pressed={currency === code}
                      title={CURRENCIES[code].label}
                      className={`h-full px-2.5 flex items-center justify-center rounded-md text-[11px] font-bold transition cursor-pointer ${
                        currency === code
                          ? 'bg-stone-900 text-white '
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Expanded Filter Dropdown Content */}
            {isMobileFilterOpen && (
              <div className="sm:hidden mt-1 pt-2.5 border-t border-stone-200/80 flex flex-col gap-3 text-xs animate-in fade-in duration-200">
                {/* Header with Title & Reset Button */}
                <div className="flex items-center justify-between pb-1 border-b border-stone-200/60">
                  <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
                    <Filter className="w-3.5 h-3.5 text-stone-700" />
                    <span>Filter & Refine Stays</span>
                    {activeFiltersCount > 0 && (
                      <span className="text-xs bg-stone-900 text-white px-1.5 py-0.5 rounded-full font-semibold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </div>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-[11px] text-stone-500 hover:text-stone-900 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset all
                    </button>
                  )}
                </div>

                {/* Section 1: Stay Type & Experience Category */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="tm-label">
                      Stay type
                    </label>
                    <div className="relative">
                      <select
                        value={activeStayType}
                        onChange={e => { setActiveStayType(e.target.value); setCurrentPage(1); }}
                        className="w-full h-8.5 pl-2.5 pr-7 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 outline-none appearance-none"
                      >
                        {STAY_TYPE_OPTIONS.map((opt) => (
                          <option key={`m-stay-${opt.id}`} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 pointer-events-none absolute right-2 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="tm-label">
                      Experience
                    </label>
                    <div className="relative">
                      <select
                        value={activeCategory}
                        onChange={e => { setActiveCategory(e.target.value); setCurrentPage(1); }}
                        className="w-full h-8.5 pl-2.5 pr-7 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 outline-none appearance-none"
                      >
                        {(['All', ...PROPERTY_CATEGORIES] as string[]).map((category, cIdx) => (
                          <option key={`m-cat-${category}-${cIdx}`} value={category}>
                            {category === 'All' ? 'All experiences' : category}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 pointer-events-none absolute right-2 top-2.5" />
                    </div>
                  </div>
                </div>

                {/* Section 2: Budget (Price Range Slider Embedded) */}
                <div className="bg-white border border-stone-200/90 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-stone-700">
                      Budget per night
                    </span>
                    <span className="text-[11px] font-semibold text-stone-900">
                      {isPriceFiltered
                        ? `${formatMoney(priceRange[0], currency)} – ${priceRange[1] >= priceLimitMax ? `${formatMoney(priceLimitMax, currency)}+` : formatMoney(priceRange[1], currency)}`
                        : `Any price (${currency})`}
                    </span>
                  </div>
                  <PriceRangeFilter
                    currency={currency}
                    minPrice={priceRange[0]}
                    maxPrice={priceRange[1]}
                    priceLimitMin={priceLimitMin}
                    priceLimitMax={priceLimitMax}
                    step={priceStep}
                    onPriceChange={(min, max) => {
                      setPriceRange([min, max]);
                      setCurrentPage(1);
                    }}
                    onReset={() => {
                      setPriceRange([priceLimitMin, priceLimitMax]);
                      setCurrentPage(1);
                    }}
                    includeUnpriced={includeUnpricedRooms}
                    onToggleIncludeUnpriced={(include) => setIncludeUnpricedRooms(include)}
                  />
                </div>

                {/* Section 3: Amenities Filter Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-stone-700">
                      Amenities
                    </span>
                    {activeAmenities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveAmenities([])}
                        className="text-xs text-stone-500 hover:text-stone-900"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_AMENITIES.slice(0, 8).map((amenity, aIdx) => {
                      const isActive = activeAmenities.includes(amenity);
                      return (
                        <button
                          key={`m-amenity-${amenity}-${aIdx}`}
                          type="button"
                          onClick={() => {
                            setActiveAmenities(prev =>
                              prev.includes(amenity)
                                ? prev.filter(a => a !== amenity)
                                : [...prev, amenity]
                            );
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition border cursor-pointer ${
                            isActive
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          {amenity}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4: Location & GPS */}
                <div>
                  <span className="tm-label">
                    Location and distances
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleToggleUserLocation}
                      disabled={isLocatingUser}
                      className={`h-8.5 flex items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        showUserLocation && userLocationLabel === 'Live GPS'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {isLocatingUser ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Locate className="w-3.5 h-3.5 text-stone-500" />
                      )}
                      <span>{showUserLocation && userLocationLabel === 'Live GPS' ? 'GPS Active' : 'Live GPS'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openAccessPermissionsModal('location')}
                      className={`h-8.5 flex items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition cursor-pointer truncate px-2 ${
                        showUserLocation && userLocationLabel && userLocationLabel !== 'Live GPS'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span className="truncate">{userLocationLabel && userLocationLabel !== 'Live GPS' ? userLocationLabel : 'Select City Hub'}</span>
                    </button>
                  </div>
                </div>

                {/* Section 5: Sort */}
                <div>
                  <label className="tm-label">
                    Sort order
                  </label>
                  <div className="relative">
                    <select
                      value={sortKey}
                      onChange={e => setSortKey(e.target.value as SortKey)}
                      className="w-full h-8.5 pl-2.5 pr-7 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 outline-none appearance-none"
                    >
                      {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                        <option key={`m-sort-${key}`} value={key}>
                          Sort: {SORT_LABELS[key]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400 pointer-events-none absolute right-2 top-2.5" />
                  </div>
                </div>

                {/* Close & Apply CTA button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileFilterOpen(false);
                      document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full h-9 bg-stone-900 text-white font-medium rounded-lg text-xs hover:bg-stone-800 transition  flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Show {filteredHotels.length} Stays</span>
                  </button>
                </div>
              </div>
            )}

            {/* Active search filter tags - clean subtle strip (shown when collapsed on mobile, or always on desktop) */}
            {(hasSearch || isPriceFiltered || activeStayType !== 'All' || activeCategory !== 'All' || activeAmenities.length > 0) && (!isMobileFilterOpen || true) && (
              <div className={`${isMobileFilterOpen ? 'hidden sm:flex' : 'flex'} items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full border-b sm:border-b border-stone-200/60 pb-1.5`}>
                {activeStayType !== 'All' && (
                  <span className="text-[11px] font-medium bg-white text-stone-800 border border-stone-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0 ">
                    <span>{STAY_TYPE_LABELS[activeStayType] || activeStayType}</span>
                    <button
                      type="button"
                      onClick={() => { setActiveStayType('All'); setCurrentPage(1); }}
                      className="hover:text-stone-950 p-0.5 rounded-full hover:bg-stone-100 transition cursor-pointer"
                      title="Clear stay filter"
                    >
                      <X className="w-3 h-3 text-stone-400 hover:text-stone-700" />
                    </button>
                  </span>
                )}
                {activeCategory !== 'All' && (
                  <span className="text-[11px] font-medium bg-white text-stone-800 border border-stone-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0 ">
                    <span>Category: {activeCategory}</span>
                    <button
                      type="button"
                      onClick={() => { setActiveCategory('All'); setCurrentPage(1); }}
                      className="hover:text-stone-950 p-0.5 rounded-full hover:bg-stone-100 transition cursor-pointer"
                      title="Clear category filter"
                    >
                      <X className="w-3 h-3 text-stone-400 hover:text-stone-700" />
                    </button>
                  </span>
                )}
                {appliedSearch.coords && (
                  <span className="text-[11px] font-medium bg-white border border-stone-200 text-stone-700 px-2.5 py-0.5 rounded-full shrink-0 ">
                    Within {appliedSearch.proximity} km
                  </span>
                )}
                {!appliedSearch.coords && appliedSearch.location && (
                  <span className="text-[11px] font-medium bg-white border border-stone-200 text-stone-700 px-2.5 py-0.5 rounded-full shrink-0 ">
                    {appliedSearch.location}
                  </span>
                )}
                {appliedSearch.checkIn && appliedSearch.checkOut && (
                  <span className="text-[11px] font-medium bg-white border border-stone-200 text-stone-700 px-2.5 py-0.5 rounded-full shrink-0 ">
                    {appliedSearch.checkIn} &rarr; {appliedSearch.checkOut}
                  </span>
                )}
                {!!appliedSearch.guests && (
                  <span className="text-[11px] font-medium bg-white border border-stone-200 text-stone-700 px-2.5 py-0.5 rounded-full shrink-0 ">
                    {appliedSearch.guests} guest{appliedSearch.guests === 1 ? '' : 's'}
                  </span>
                )}
                {isPriceFiltered && (
                  <span className="text-[11px] font-medium bg-white text-stone-800 border border-stone-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0 ">
                    <span>
                      {formatMoney(priceRange[0], currency)} – {priceRange[1] >= priceLimitMax ? `${formatMoney(priceLimitMax, currency)}+` : formatMoney(priceRange[1], currency)}
                    </span>
                    <button 
                      type="button"
                      onClick={() => setPriceRange([priceLimitMin, priceLimitMax])}
                      className="hover:text-stone-950 p-0.5 rounded-full hover:bg-stone-100 transition cursor-pointer"
                      title="Clear price filter"
                    >
                      <X className="w-3 h-3 text-stone-400 hover:text-stone-700" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="tm-btn tm-btn-quiet tm-btn-sm shrink-0 ml-auto"
                >
                  <RotateCcw className="w-3 h-3" /> Clear all
                </button>
              </div>
            )}

            {/* Desktop Filter Controls Strip (Hidden on mobile: sm:flex) */}
            <div className="hidden sm:flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 w-full">
              {/* Primary Content & Stay Filters (Left Group) */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Stay Type */}
                <div className="relative inline-flex items-center">
                  <select
                    value={activeStayType}
                    onChange={e => { setActiveStayType(e.target.value); setCurrentPage(1); }}
                    className={`h-8 pl-3 pr-7.5 border rounded-lg text-xs font-medium outline-none transition-colors cursor-pointer appearance-none ${
                      activeStayType !== 'All'
                        ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300'
                    }`}
                    title="Filter by stay type (Whole house, cottage, or rooms)"
                  >
                    {STAY_TYPE_OPTIONS.map((opt) => (
                      <option key={`stay-type-${opt.id}`} value={opt.id} className="text-stone-900 bg-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 ${activeStayType !== 'All' ? 'text-stone-300' : 'text-stone-400'}`} />
                </div>

                {/* Category (Experiences) */}
                <div className="relative inline-flex items-center">
                  <select
                    value={activeCategory}
                    onChange={e => { setActiveCategory(e.target.value); setCurrentPage(1); }}
                    className={`h-8 pl-3 pr-7.5 border rounded-lg text-xs font-medium outline-none transition-colors cursor-pointer appearance-none ${
                      activeCategory !== 'All'
                        ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300'
                    }`}
                    title="Filter by experience category"
                  >
                    {(['All', ...PROPERTY_CATEGORIES] as string[]).map((category, cIdx) => (
                      <option key={`cat-${category}-${cIdx}`} value={category} className="text-stone-900 bg-white">
                        {category === 'All' ? 'All experiences' : category}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 ${activeCategory !== 'All' ? 'text-stone-300' : 'text-stone-400'}`} />
                </div>

                {/* Budget (Price Range) */}
                <details className="relative group">
                  <summary className={`list-none flex items-center justify-between gap-1.5 h-8 border rounded-lg px-3 text-xs font-medium outline-none transition-colors cursor-pointer select-none [&::-webkit-details-marker]:hidden ${
                    isPriceFiltered
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                      : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300'
                  }`}>
                    <span className="whitespace-nowrap">
                      {isPriceFiltered 
                        ? `${formatMoney(priceRange[0], currency)} – ${priceRange[1] >= priceLimitMax ? `${formatMoney(priceLimitMax, currency)}+` : formatMoney(priceRange[1], currency)}`
                        : 'Budget'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 group-open:rotate-180 transition-transform shrink-0 ${isPriceFiltered ? 'text-stone-300' : 'text-stone-400'}`} />
                  </summary>
                  <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white border border-stone-200 rounded-xl shadow-sm z-50 p-3.5">
                    <PriceRangeFilter
                      currency={currency}
                      minPrice={priceRange[0]}
                      maxPrice={priceRange[1]}
                      priceLimitMin={priceLimitMin}
                      priceLimitMax={priceLimitMax}
                      step={priceStep}
                      onPriceChange={(min, max) => {
                        setPriceRange([min, max]);
                        setCurrentPage(1);
                      }}
                      onReset={() => {
                        setPriceRange([priceLimitMin, priceLimitMax]);
                        setCurrentPage(1);
                      }}
                      includeUnpriced={includeUnpricedRooms}
                      onToggleIncludeUnpriced={(include) => setIncludeUnpricedRooms(include)}
                    />
                  </div>
                </details>

                {/* Amenities */}
                <details className="relative group">
                  <summary className={`list-none flex items-center justify-between gap-1.5 h-8 border rounded-lg px-3 text-xs font-medium outline-none transition-colors cursor-pointer select-none [&::-webkit-details-marker]:hidden ${
                    activeAmenities.length > 0
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                      : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300'
                  }`}>
                    <span>
                      {activeAmenities.length > 0 ? `Amenities (${activeAmenities.length})` : 'Amenities'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 group-open:rotate-180 transition-transform shrink-0 ${activeAmenities.length > 0 ? 'text-stone-300' : 'text-stone-400'}`} />
                  </summary>
                  <div className="absolute left-0 mt-2 w-60 bg-white border border-stone-200 rounded-xl shadow-sm z-50 p-2.5 flex flex-col gap-1">
                    {COMMON_AMENITIES.map((amenity, aIdx) => {
                      const isActive = activeAmenities.includes(amenity);
                      return (
                        <label key={`amenity-${amenity}-${aIdx}`} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-stone-50 rounded-lg cursor-pointer text-xs transition">
                          <input 
                            type="checkbox" 
                            checked={isActive}
                            onChange={() => {
                              setActiveAmenities(prev => 
                                prev.includes(amenity) 
                                  ? prev.filter(a => a !== amenity)
                                  : [...prev, amenity]
                              );
                              setCurrentPage(1);
                            }}
                            className="rounded border-stone-300 text-stone-900 focus:ring-stone-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="text-stone-700 font-medium">{amenity}</span>
                        </label>
                      );
                    })}
                    {activeAmenities.length > 0 && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          setActiveAmenities([]);
                          setCurrentPage(1);
                        }}
                        className="mt-1 text-xs font-medium text-stone-500 hover:text-stone-900 text-center py-1.5 border-t border-stone-100 cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </details>
              </div>

              {/* Utility & Location Controls (Right Group) */}
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                {/* Geolocation & Hub Controls */}
                <div className="flex items-center h-8 rounded-lg border border-stone-200 bg-white p-0.5 ">
                  <button
                    type="button"
                    onClick={handleToggleUserLocation}
                    disabled={isLocatingUser}
                    className={`h-full flex items-center gap-1 rounded-md px-2.5 text-xs font-medium transition cursor-pointer ${
                      showUserLocation && userLocationLabel === 'Live GPS'
                        ? 'bg-stone-900 text-white font-semibold'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                    title="Toggle device GPS location"
                  >
                    {isLocatingUser ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Locate className="w-3 h-3 text-stone-400 shrink-0" />
                    )}
                    <span>{showUserLocation && userLocationLabel === 'Live GPS' ? 'GPS On' : 'GPS'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openAccessPermissionsModal('location')}
                    className={`h-full flex items-center gap-1 rounded-md px-2.5 text-xs font-medium transition cursor-pointer ${
                      showUserLocation && userLocationLabel && userLocationLabel !== 'Live GPS'
                        ? 'bg-stone-900 text-white font-semibold'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                    title="Choose a Malawian travel hub or city for distance calculations"
                  >
                    <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                    <span className="max-w-[85px] truncate">{userLocationLabel && userLocationLabel !== 'Live GPS' ? userLocationLabel : 'City'}</span>
                  </button>
                </div>

                {/* Sort Dropdown */}
                <div className="relative inline-flex items-center">
                  <select
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as SortKey)}
                    className="h-8 pl-3 pr-7.5 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-lg text-xs font-medium text-stone-700 outline-none transition-colors cursor-pointer appearance-none"
                    title="Sort properties"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                      <option key={key} value={key} className="text-stone-900 bg-white">Sort: {SORT_LABELS[key]}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 pointer-events-none absolute right-2.5" />
                </div>

                {/* Currency Selector */}
                {offeredCurrencies.length > 1 && (
                  <div className="flex items-center h-8 bg-white p-0.5 rounded-lg border border-stone-200 ">
                    {offeredCurrencies.map((code, cIdx) => (
                      <button
                        key={`curr-${code}-${cIdx}`}
                        type="button"
                        onClick={() => chooseCurrency(code)}
                        aria-pressed={currency === code}
                        title={CURRENCIES[code].label}
                        className={`h-full px-2.5 flex items-center justify-center rounded-md text-[11px] font-bold transition cursor-pointer ${
                          currency === code
                            ? 'bg-stone-900 text-white '
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>



        {/* Header for results with View Mode Switch */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-6 gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm font-bold text-stone-900">
              {viewMode === 'grid' || viewMode === 'compact' ? `${filteredHotels.length} Stays Found` : `${lodgeMarkers.length} Stays on Map`}
            </span>
            <span className="text-xs text-stone-500 hidden sm:inline">
              {viewMode === 'grid' || viewMode === 'compact'
                ? `· Page ${currentPage} of ${Math.max(1, Math.ceil(filteredHotels.length / itemsPerPage))}`
                : `· Interactive clustered map`
              }
            </span>
          </div>

          {/* View Mode Segmented Switch (blends into the header bar without covering content on mobile) */}
          <div className="flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => {
                setViewMode('grid');
                setTimeout(() => {
                  document.getElementById('grid-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                viewMode === 'grid'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-stone-700" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('compact');
                setTimeout(() => {
                  document.getElementById('compact-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                viewMode === 'compact'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              aria-label="Compact view"
            >
              <AlignJustify className="w-3.5 h-3.5 text-stone-700" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('map');
                setTimeout(() => {
                  document.getElementById('map-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                viewMode === 'map'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              aria-label="Map view"
            >
              <MapIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
        </div>
        
        {loading || searching ? (
          <div>
            {searching && (
              <div className="mb-8 flex items-center justify-center py-4 px-4 bg-stone-50 border border-stone-200/80 rounded-2xl animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-stone-300 border-t-emerald-600 rounded-full animate-spin" />
                  <span className="text-xs md:text-sm font-semibold text-stone-800">
                    Finding available stays across Malawi…
                  </span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={`skeleton-${i}`} className="flex flex-col gap-3">
                  <div className="animate-pulse bg-stone-200/80 rounded-2xl aspect-[4/3] w-full" />
                  <div className="animate-pulse bg-stone-200/70 h-3 w-1/3 rounded-full mt-1" />
                  <div className="animate-pulse bg-stone-200/90 h-5 w-3/4 rounded-md" />
                  <div className="animate-pulse bg-stone-200/60 h-4 w-1/2 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : hotels.length > 0 ? (
          <div>
            {viewMode === 'grid' ? (
              /* LIST / GRID VIEW */
              <div>
                <div id="grid-canvas" className="scroll-mt-24 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-8">
                  {filteredHotels.length > 0 ? filteredHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((entry, index) => (
                    <HotelCard
                      key={`hotel-card-${entry.hotel.id || 'h'}-${index}`}
                      hotel={entry.hotel}
                      index={index}
                      priceFrom={entry.priceFrom}
                      priceCurrency={currency}
                      secondaryPriceFrom={entry.secondaryPriceFrom}
                      secondaryCurrency={entry.secondaryCurrency}
                      rating={entry.rating}
                      searchParams={{
                        checkIn: appliedSearch.checkIn,
                        checkOut: appliedSearch.checkOut,
                        guests: appliedSearch.guests || undefined,
                      }}
                    />
                  )) : (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-6 h-6 text-stone-400" />
                      </div>
                      <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">Nothing free on those terms</h3>
                      <p className="text-stone-500 text-sm max-w-md mb-6">
                        Try a wider stretch of dates, a smaller party, or somewhere else along the lake —
                        most properties have more room midweek.
                      </p>
                      <button
                        onClick={clearFilters}
                        className="tm-btn tm-btn-primary"
                      >
                        Start the search over
                      </button>
                    </div>
                  )}
                </div>
                
                {filteredHotels.length > itemsPerPage && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(filteredHotels.length / itemsPerPage)}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </div>
            ) : viewMode === 'compact' ? (
              /* COMPACT LIST VIEW */
              <div>
                <div id="compact-canvas" className="scroll-mt-24 flex flex-col gap-3 md:gap-4">
                  {filteredHotels.length > 0 ? filteredHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((entry, index) => (
                    <CompactHotelCard
                      key={`hotel-card-compact-${entry.hotel.id || 'h'}-${index}`}
                      hotel={entry.hotel}
                      rating={entry.rating?.average}
                      minPrice={entry.priceFrom}
                      secondaryPriceFrom={entry.secondaryPriceFrom}
                      secondaryCurrency={entry.secondaryCurrency}
                      searchParams={{
                        checkIn: appliedSearch.checkIn,
                        checkOut: appliedSearch.checkOut,
                        guests: appliedSearch.guests || undefined,
                        currency
                      }}
                      isAvailable={
                        (appliedSearch.checkIn && appliedSearch.checkOut)
                          ? entry.matching.length > 0
                          : undefined
                      }
                    />
                  )) : (
                    <div className="py-16 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-6 h-6 text-stone-400" />
                      </div>
                      <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">Nothing free on those terms</h3>
                      <p className="text-stone-500 text-sm max-w-md mb-6">
                        Try a wider stretch of dates, a smaller party, or somewhere else along the lake —
                        most properties have more room midweek.
                      </p>
                      <button
                        onClick={clearFilters}
                        className="tm-btn tm-btn-primary"
                      >
                        Start the search over
                      </button>
                    </div>
                  )}
                </div>
                
                {filteredHotels.length > itemsPerPage && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(filteredHotels.length / itemsPerPage)}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* MAP VIEW */
              <div className="space-y-4">
                {/* Main Map View: Left Cards List + Right Map Canvas */}
                <div id="map-canvas" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-4 lg:gap-6 items-start">
                  {/* Lodge Cards Feed (Isolated internal scroll container) */}
                  <div
                    ref={mapStaysListRef}
                    className="order-2 lg:order-1 h-[520px] sm:h-[560px] lg:h-[600px] xl:h-[650px] overflow-y-auto overscroll-contain pr-0 lg:pr-1 space-y-3 scrollbar-slim touch-pan-y"
                  >
                    <div className="sticky top-0 z-10 bg-white/95 py-2 px-1 border-b border-stone-100 flex items-center justify-between text-xs text-stone-500 font-medium ">
                      <span>
                        Showing <strong>{lodgeMarkers.length}</strong> {lodgeMarkers.length === 1 ? 'stay' : 'stays'} on map
                      </span>
                      {sortKey === 'distance_asc' && (
                        <span className="text-blue-600 font-bold flex items-center gap-1">
                          <Locate className="w-3 h-3" /> Sorted by nearest
                        </span>
                      )}
                    </div>

                    {filteredHotels.length === 0 ? (
                      <div className="py-12 px-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 text-center flex flex-col items-center justify-center">
                        <Search className="w-8 h-8 text-stone-400 mb-2" />
                        <h4 className="font-serif font-bold text-stone-900 text-sm mb-1">No stays match this filter</h4>
                        <p className="text-xs text-stone-500 max-w-xs mb-3">
                          Try searching for a different area, clearing category filters, or broadening price settings.
                        </p>
                        <button
                          type="button"
                          onClick={hasSearch ? clearFilters : clearMapFilters}
                          className="tm-btn tm-btn-primary tm-btn-sm"
                        >
                          Clear map filters
                        </button>
                      </div>
                    ) : (
                      filteredHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((entry, index) => {
                        const hotel = entry.hotel;
                        const isSelected = selectedMapLodgeId === hotel.id;
                        const priceDisplay = entry.priceFrom
                          ? `${currency === 'USD' ? '$' : 'MK '}${entry.priceFrom.toLocaleString()}`
                          : null;
                        const img = getHotelImage(hotel);
                        const categoryLabel = hotel.categories?.[0] || 'Lodge';

                        const coords = resolveHotelCoordinates(hotel);
                        const hasCoords = isValidLatLng(coords);
                        const travelEstimate = (showUserLocation && isValidLatLng(userLocation) && hasCoords)
                          ? estimateTravelTime(distanceKm(userLocation, coords!), userLocation, coords!, hotel.name)
                          : null;

                        return (
                          <div
                            key={`map-hotel-${hotel.id || 'h'}-${index}`}
                            id={`map-card-${hotel.id}`}
                            onClick={() => setSelectedMapLodgeId(isSelected ? null : hotel.id ?? null)}
                            className={`group p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer bg-white ${
                              isSelected
                                ? 'border-emerald-600 ring-2 ring-emerald-500/25 shadow-sm bg-emerald-50/10'
                                : 'border-stone-200/90 hover:border-stone-300 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex gap-3 sm:gap-3.5">
                              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl overflow-hidden bg-stone-100 shrink-0 relative">
                                {img ? (
                                  <SmartImage src={img} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                                    <MapPin className="w-5 h-5" />
                                  </div>
                                )}
                                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-stone-900/85 text-xs font-medium text-white">
                                  {categoryLabel}
                                </span>
                              </div>

                              <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                                <div className="space-y-1">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <h4 className="font-serif font-bold text-stone-900 truncate text-sm sm:text-base group-hover:text-emerald-800 transition-colors leading-tight">
                                      <MaskedPlaceName name={hotel.name} fallback="[Featured Stay]" />
                                    </h4>
                                    {entry.rating && (
                                      <div className="flex items-center gap-1 text-xs font-bold text-stone-800 shrink-0 bg-stone-50 px-1.5 py-0.5 rounded-md border border-stone-100">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        <span>{entry.rating.average.toFixed(1)}</span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-stone-500 truncate flex items-center gap-1">
                                    <MapPin className="w-3 h-3 shrink-0 text-stone-400" />
                                    <span className="truncate">{formatLocationName(hotel.location, hotel.name)}</span>
                                  </p>

                                  {/* Proximity Distance Badge */}
                                  {entry.userDistance !== null && entry.userDistance !== undefined && (
                                    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full w-fit">
                                      <Locate className="w-3 h-3 text-blue-600 animate-pulse" />
                                      <span>
                                        {entry.userDistance < 1
                                          ? `${Math.round(entry.userDistance * 1000)} m away`
                                          : `${entry.userDistance.toFixed(1)} km away`}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-end justify-between gap-2 mt-2 pt-2 border-t border-stone-100">
                                  <div>
                                    <div className="text-xs text-stone-400 font-medium">From</div>
                                    {entry.priceFrom !== null && entry.priceFrom !== undefined ? (
                                      <div className="flex items-baseline gap-1">
                                        <PriceDisplay
                                          amount={entry.priceFrom}
                                          currency={currency}
                                          className="font-bold text-sm text-stone-900"
                                        />
                                        <span className="text-xs text-stone-400">/ night</span>
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-stone-400">Rates on request</div>
                                    )}
                                  </div>
                                  <Link
                                    to={`/hotel/${hotel.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs font-bold text-stone-900 hover:text-emerald-700 underline underline-offset-2 flex items-center gap-1"
                                  >
                                    View Stay &rarr;
                                  </Link>
                                </div>
                              </div>
                            </div>

                            {/* Detailed Distance & Travel Measurement Box when selected */}
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-stone-100 space-y-2.5 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                                {travelEstimate && isValidLatLng(userLocation) && hasCoords ? (
                                  <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 space-y-2 text-stone-900">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                                        <Car className="w-3.5 h-3.5 text-emerald-700" />
                                        <span>Route & Travel Distance</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openAccessPermissionsModal('location')}
                                        className="text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition cursor-pointer"
                                        title="Click to change city or hub"
                                      >
                                        {userLocationLabel || 'Your location'} (Change)
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-white/80 rounded-lg p-2 border border-emerald-100">
                                        <span className="text-xs text-stone-500 font-medium block">Drive time</span>
                                        <span className="font-extrabold text-stone-900 text-sm">
                                          {travelEstimate.drivingTimeFormatted}
                                        </span>
                                      </div>
                                      <div className="bg-white/80 rounded-lg p-2 border border-emerald-100">
                                        <span className="text-xs text-stone-500 font-medium block">Road distance</span>
                                        <span className="font-extrabold text-emerald-800 text-sm">
                                          ~{travelEstimate.roadDistanceKm} km
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-stone-600 px-0.5">
                                      <span>Straight-line: {travelEstimate.straightLineKm} km</span>
                                      <span className="text-emerald-800 font-medium truncate">{travelEstimate.notes}</span>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                      <a
                                        href={getDirectionsUrl(userLocation, coords!, hotel.name)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                                      >
                                        <Navigation className="w-3.5 h-3.5 fill-white" />
                                        <span>Open in Google Maps</span>
                                        <ExternalLink className="w-3 h-3 opacity-80" />
                                      </a>
                                      <Link
                                        to={`/hotel/${hotel.id}`}
                                        className="inline-flex items-center justify-center gap-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition"
                                      >
                                        <span>View stay</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </Link>
                                    </div>
                                  </div>
                                ) : !showUserLocation ? (
                                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2 text-xs text-stone-700">
                                      <Locate className="w-4 h-4 text-emerald-700 shrink-0" />
                                      <span>Turn on location or pick a Malawian city to calculate driving time & distance.</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={handleToggleUserLocation}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                                      >
                                        <Locate className="w-3.5 h-3.5" />
                                        <span>Use GPS</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openAccessPermissionsModal('location')}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-medium rounded-lg transition cursor-pointer"
                                      >
                                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Pick a city</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    
                    {filteredHotels.length > itemsPerPage && (
                      <div className="pt-2 pb-6 flex justify-center">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={Math.ceil(filteredHotels.length / itemsPerPage)}
                          onPageChange={setCurrentPage}
                        />
                      </div>
                    )}
                  </div>

                  {/* Interactive Clustered Map */}
                  <div className="order-1 lg:order-2 sticky top-[72px] lg:top-20 z-10 h-[520px] sm:h-[560px] lg:h-[600px] xl:h-[650px] w-full rounded-2xl overflow-hidden shadow-sm border border-stone-200 bg-stone-100 overscroll-contain">
                    <InteractiveMap
                      lodges={lodgeMarkers}
                      enableClustering={false}
                      selectedLodgeId={selectedMapLodgeId}
                      onLodgeSelect={(lodge) => setSelectedMapLodgeId(lodge.id)}
                      onClearSelectedLodge={() => setSelectedMapLodgeId(null)}
                      userLocation={userLocation}
                      showUserLocation={showUserLocation}
                      userLocationAccuracy={userLocationAccuracy}
                      onToggleUserLocation={handleToggleUserLocation}
                      isLocatingUser={isLocatingUser}
                      heightClass="h-full w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          loadFailed ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                <WifiOff className="w-6 h-6 text-amber-600" />
             </div>
             <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">We could not load the stays</h3>
             <p className="text-stone-500 text-sm max-w-md mb-6">
               Check your mobile data or Wi-Fi and try again. Stays you have opened before are kept on your device.
             </p>
             <button
               type="button"
               onClick={() => { setLoadFailed(false); setLoading(true); setListingsReloadKey(k => k + 1); }}
               className="tm-btn tm-btn-primary"
             >
               Try again
             </button>
          </div>
          ) : (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-stone-400" />
             </div>
             <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">Nothing listed yet</h3>
             <p className="text-stone-500 text-sm max-w-md mb-6">
               The first listings are on their way. If you run a property in Malawi, yours could be
               the one people find here.
             </p>
             <Link
               to="/list-your-property"
               className="tm-btn tm-btn-primary"
             >
               List your property
             </Link>
          </div>
          )
        )}
      </section>
    </div>
  );
}
