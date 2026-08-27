import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Pagination from '../components/Pagination';
import { Search, MapPin, Calendar, Users, Star, LocateFixed, Locate, ChevronDown, Plus, Minus, ShieldCheck, MessageCircle, Smartphone, X, Clock, LayoutGrid, Map as MapIcon, Compass, Navigation, SlidersHorizontal, RotateCcw, Filter, Check, Car, ExternalLink, Route, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Review, CurrencyCode } from '../types';
import { Link, useSearchParams } from 'react-router-dom';
import HotelCard from '../components/HotelCard';
import SmartImage from '../components/SmartImage';
import InteractiveMap, { LodgeMarker } from '../components/InteractiveMap';
import PriceRangeFilter from '../components/PriceRangeFilter';
import { DECORATIVE_IMAGE, HERO_IMAGE, getHotelImage } from '../lib/images';
import { BookingLike, lowestPrice, roomsMatching } from '../lib/availability';
import { todayStr } from '../lib/dates';
import { CURRENCY_CODES, CURRENCIES, currenciesForRooms, formatMoney, readStoredCurrency, storeCurrency } from '../lib/currency';
import { PROPERTY_CATEGORIES } from '../lib/listing';
import { distanceKm, isValidLatLng, resolveHotelCoordinates, LatLng, estimateTravelTime, getDirectionsUrl } from '../lib/geo';
import { getCachedHotels, saveCachedHotels, getCachedRooms, saveCachedRooms } from '../lib/mapCache';

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

export default function Home() {
  const today = todayStr();

  const [hotels, setHotels] = useState<Hotel[]>(() => getCachedHotels());
  const [rooms, setRooms] = useState<RoomType[]>(() => getCachedRooms());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [loading, setLoading] = useState(() => getCachedHotels().length === 0);
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>('recommended');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [currency, setCurrency] = useState<CurrencyCode>(() => readStoredCurrency() ?? 'USD');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedMapLodgeId, setSelectedMapLodgeId] = useState<string | null>(null);

  // Price Per Night Range Slider limits & state
  const { priceLimitMin, priceLimitMax, priceStep } = useMemo(() => {
    if (currency === 'USD') {
      return { priceLimitMin: 0, priceLimitMax: 800, priceStep: 10 };
    } else {
      return { priceLimitMin: 0, priceLimitMax: 1500000, priceStep: 25000 };
    }
  }, [currency]);

  const [priceRange, setPriceRange] = useState<[number, number]>(() => 
    (readStoredCurrency() === 'MWK' ? [0, 1500000] : [0, 800])
  );
  const [includeUnpricedRooms, setIncludeUnpricedRooms] = useState<boolean>(true);
  const [showPriceFilterDrawer, setShowPriceFilterDrawer] = useState<boolean>(false);

  const isPriceFiltered = priceRange[0] > priceLimitMin || priceRange[1] < priceLimitMax;

  // Map View specific search and filter states
  const [mapSearchText, setMapSearchText] = useState('');
  const [mapPriceRange, setMapPriceRange] = useState<'all' | 'budget' | 'moderate' | 'luxury'>('all');
  const [mapMinRating, setMapMinRating] = useState<number>(0);
  const [mapAmenityFilter, setMapAmenityFilter] = useState<string>('all');
  const [showMapFiltersModal, setShowMapFiltersModal] = useState(false);

  // User Current Live Location State
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [userLocationAccuracy, setUserLocationAccuracy] = useState<number | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [userLocationError, setUserLocationError] = useState<string | null>(null);

  const handleToggleUserLocation = () => {
    if (showUserLocation) {
      setShowUserLocation(false);
      setUserLocation(null);
      setUserLocationError(null);
      if (sortKey === 'distance_asc') {
        setSortKey('recommended');
      }
      toast.success('Current location pin hidden');
      return;
    }

    if (!('geolocation' in navigator)) {
      const err = 'Geolocation is not supported by your browser.';
      setUserLocationError(err);
      toast.error(err);
      return;
    }

    setIsLocatingUser(true);
    setUserLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: LatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setUserLocationAccuracy(position.coords.accuracy || 75);
        setShowUserLocation(true);
        setIsLocatingUser(false);
        setSortKey('distance_asc');
        toast.success('Location found! Distance calculated for all stays.');
      },
      (err) => {
        console.warn('Geolocation warning:', err);
        setIsLocatingUser(false);
        let msg = 'Could not access your location. Please check browser permissions.';
        if (err.code === 1) { // PERMISSION_DENIED
          msg = 'Location permission was denied. Enable location in browser settings.';
        } else if (err.code === 3) { // TIMEOUT
          msg = 'Location request timed out. Please try again.';
        }
        setUserLocationError(msg);
        toast.error(msg);
        setTimeout(() => setUserLocationError(null), 6000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const [searchLocation, setSearchLocation] = useState('');
  const [searchCheckIn, setSearchCheckIn] = useState('');
  const [searchCheckOut, setSearchCheckOut] = useState('');

  // Advanced Guest Selector
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomsWanted, setRoomsWanted] = useState(1);
  const totalGuests = adults + children;
  const guestSelectorRef = useRef<HTMLDivElement>(null);

  const [searchProximity, setSearchProximity] = useState(50);
  const [appliedSearch, setAppliedSearch] = useState<AppliedSearch>(NO_SEARCH);

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

  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % HERO_PLACES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  /**
   * `?category=` preselects the filter, so a link from anywhere else on the
   * site can land on the stays it promised. The footer's category links used
   * to point at the bare home page and filter nothing at all.
   */
  useEffect(() => {
    const requested = searchParams.get('category');
    if (requested && (PROPERTY_CATEGORIES as readonly string[]).includes(requested)) {
      setActiveCategory(requested);
      setCurrentPage(1);
      // The route's own scroll-to-top runs on arrival, so the `#search-results`
      // fragment alone leaves the visitor at the top of the hero instead.
      const timer = setTimeout(
        () => document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        250
      );
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (locationSearchRef.current && !locationSearchRef.current.contains(event.target as Node)) {
        setShowRecentSearches(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        const [hotelSnap, roomSnap] = await Promise.all([
          getDocs(collection(db, 'hotels')),
          getDocs(collection(db, 'room_types')),
        ]);

        const hotelsData = hotelSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Hotel[];
        const approvedHotels = hotelsData.filter(h => h.status === 'approved' || !h.status);
        const roomsData = roomSnap.docs.map(d => ({ id: d.id, ...d.data() })) as RoomType[];
        
        setHotels(approvedHotels);
        setRooms(roomsData);

        // Cache offline for travelers with intermittent internet
        saveCachedHotels(approvedHotels);
        saveCachedRooms(roomsData);
      } catch (error) {
        console.error("Error fetching hotels:", error);
        // If offline / network fails, fallback data from cache is already in state
        if (getCachedHotels().length > 0) {
          toast('Using cached offline lodge data', { icon: '📡' });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchListings();

    // Ratings are a garnish on the listing grid, so this read is kept out of
    // the critical path: until the `reviews` rules are deployed it is denied,
    // and bundling it with the listings would have taken the whole page down.
    getDocs(collection(db, 'reviews'))
      .then(snap => setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Review[]))
      .catch(error => console.warn('Reviews unavailable:', error?.message ?? error));
  }, []);

  // The dropdown used to stay open until its toggle was clicked again, which
  // left it covering the results while the visitor scrolled.
  useEffect(() => {
    if (!showGuestDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!guestSelectorRef.current?.contains(event.target as Node)) setShowGuestDropdown(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showGuestDropdown]);

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
    const snap = await getDocs(collection(db, 'bookings'));
    const loaded = snap.docs.map(d => d.data() as BookingLike);
    setBookings(loaded);
    setBookingsLoaded(true);
    return loaded;
  };

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
        document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSearchLocation('Near Me');
        applySearch({
          location: 'Near Me',
          checkIn: searchCheckIn,
          checkOut: searchCheckOut,
          guests: totalGuests,
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          proximity: searchProximity,
        });
        toast.success(`Found your location! Showing places within ${searchProximity}km.`);
      },
      () => toast.error("Could not get your location. Please check browser permissions.")
    );
  };

  /** Resets both the applied search and the controls that produced it. */
  const clearFilters = () => {
    setAppliedSearch(NO_SEARCH);
    setSearchLocation('');
    setSearchCheckIn('');
    setSearchCheckOut('');
    setSearchProximity(50);
    setActiveCategory('All');
    setSortKey('recommended');
    // Previously left untouched, so "clear all filters" silently kept the
    // party size that had caused the empty result in the first place.
    setAdults(2);
    setChildren(0);
    setRoomsWanted(1);
    setPriceRange([priceLimitMin, priceLimitMax]);
    setIncludeUnpricedRooms(true);
    setMapSearchText('');
    setMapPriceRange('all');
    setMapMinRating(0);
    setMapAmenityFilter('all');
  };

  const activeMapFiltersCount = useMemo(() => {
    let count = 0;
    if (mapSearchText.trim()) count++;
    if (mapPriceRange !== 'all') count++;
    if (isPriceFiltered) count++;
    if (mapMinRating > 0) count++;
    if (mapAmenityFilter !== 'all') count++;
    if (activeCategory !== 'All') count++;
    return count;
  }, [mapSearchText, mapPriceRange, isPriceFiltered, mapMinRating, mapAmenityFilter, activeCategory]);

  const clearMapFilters = () => {
    setMapSearchText('');
    setMapPriceRange('all');
    setPriceRange([priceLimitMin, priceLimitMax]);
    setIncludeUnpricedRooms(true);
    setMapMinRating(0);
    setMapAmenityFilter('all');
    setActiveCategory('All');
  };

  
  const searchSuggestions = useMemo(() => {
    if (!searchLocation.trim()) return [];
    
    const query = searchLocation.toLowerCase().trim();
    const suggestions = [];
    
    // Extract unique locations
    const locations = Array.from(new Set(hotels.map(h => h.location.trim()))).filter(loc => loc.toLowerCase().includes(query));
    
    locations.forEach(loc => {
      suggestions.push({ type: 'location', text: loc });
    });
    
    // Extract hotels
    const matchingHotels = hotels.filter(h => 
      h.name.toLowerCase().includes(query) || 
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
    const counts = new Map<string, number>();
    for (const hotel of hotels) {
      const location = hotel.location?.trim();
      // Some imported records hold a coordinate pair where the place name
      // should be. `14°6'11"S 34°51'43"E` is not something to offer as a
      // one-tap destination, and searching it matches nothing else.
      if (!location || !/^[A-Za-z][A-Za-z\s'&.,-]{2,}$/.test(location)) continue;
      counts.set(location, (counts.get(location) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([location]) => location);
    return ranked.length > 0 ? ranked.slice(0, 6) : FALLBACK_DESTINATIONS;
  }, [hotels]);


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

    const guests = typeof appliedSearch.guests === 'number' ? appliedSearch.guests : undefined;

    const matched = byCategory
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
          if (!entry.hotel.name.toLowerCase().includes(q) && 
              !entry.hotel.location.toLowerCase().includes(q) && 
              !entry.hotel.locationNotes?.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Map View quick search query
        if (mapSearchText.trim()) {
          const q = mapSearchText.trim().toLowerCase();
          const nameMatch = entry.hotel.name.toLowerCase().includes(q);
          const locationMatch = entry.hotel.location.toLowerCase().includes(q);
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

        // Map Price filter
        if (mapPriceRange !== 'all') {
          const price = entry.priceFrom;
          if (price === null) return false;
          const usdValue = currency === 'USD' ? price : price / 1750;
          if (mapPriceRange === 'budget' && usdValue > 80) return false;
          if (mapPriceRange === 'moderate' && (usdValue < 80 || usdValue > 220)) return false;
          if (mapPriceRange === 'luxury' && usdValue < 220) return false;
        }

        // Map Minimum Rating filter
        if (mapMinRating > 0) {
          const avg = entry.rating?.average ?? 0;
          if (avg < mapMinRating) return false;
        }

        // Map Amenity filter
        if (mapAmenityFilter !== 'all') {
          const target = mapAmenityFilter.toLowerCase();
          const hotelAmenities = entry.hotel.amenities?.map(a => a.toLowerCase()) || [];
          const desc = entry.hotel.description?.toLowerCase() || '';
          const match = hotelAmenities.some(a => a.includes(target)) || desc.includes(target);
          if (!match) return false;
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
      sorted.sort((a, b) => a.hotel.name.localeCompare(b.hotel.name));
    }
    return sorted;
  }, [
    hotels, roomsByHotel, bookings, ratingByHotel, activeCategory, 
    appliedSearch, sortKey, currency, mapSearchText, mapPriceRange, 
    mapMinRating, mapAmenityFilter, showUserLocation, userLocation,
    isPriceFiltered, priceRange, priceLimitMax, includeUnpricedRooms
  ]);

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

  /**
   * The three properties shown above the fold when nothing is being searched.
   *
   * An admin can promote a listing from the admin dashboard, and those come
   * first, newest promotion first. Anything left over is filled by guest
   * rating, so the row is never short and still means something when nobody
   * has promoted anything.
   */
  const featuredHotels = useMemo(() => {
    const enriched = hotels.map(hotel => ({
      hotel,
      priceFrom: lowestPrice(roomsByHotel.get(hotel.id ?? '') ?? [], currency),
      rating: ratingByHotel.get(hotel.id ?? '') ?? null,
    }));

    const promoted = enriched
      .filter(entry => entry.hotel.featured)
      .sort((a, b) => (b.hotel.featuredAt ?? 0) - (a.hotel.featuredAt ?? 0));

    const rest = enriched
      .filter(entry => !entry.hotel.featured)
      .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));

    return [...promoted, ...rest].slice(0, 3);
  }, [hotels, roomsByHotel, ratingByHotel, currency]);

  /** Whether the row above is a real editorial pick or just the best rated. */
  const hasPromotedFeatures = useMemo(() => hotels.some(h => h.featured), [hotels]);
  

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[92svh] md:min-h-[96svh] w-full flex flex-col justify-center overflow-hidden bg-stone-950">
        <motion.div
          initial={{ scale: 1.06 }}
          animate={{ scale: 1.16 }}
          transition={{ duration: 26, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
          className="absolute inset-0 z-0"
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

        {/* Scrims run left-to-right now that the type is anchored left, so the
            photograph stays visible on the side the text does not occupy. */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-stone-950/80 via-stone-950/40 to-transparent" />
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-stone-950/70 via-stone-950/30 to-transparent" />

        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 md:pt-32 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 md:mb-12"
          >
            <h1 className="font-sans flex flex-col gap-2 md:gap-3">
              <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-white/90 uppercase ml-0.5 md:ml-1">
                Welcome to Malawi
              </span>
              <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-[1.15] md:leading-[1.1]">
                Find your perfect stay.
              </span>
            </h1>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`relative mt-8 bg-white/95 backdrop-blur-xl rounded-2xl lg:rounded-full p-1.5 md:p-2
                       shadow-xl shadow-stone-900/10 ring-1 ring-stone-900/5
                       flex flex-col lg:flex-row lg:items-center gap-1 w-full max-w-[56rem] text-left transition-all ${
                         showRecentSearches || showGuestDropdown ? 'z-40' : 'z-20'
                       }`}
          >
            {/* Where */}
            <div
              ref={locationSearchRef}
              className={`relative flex-[1.5] min-w-0 rounded-2xl px-3 lg:px-5 py-2.5 lg:py-2 hover:bg-stone-50 transition group bg-white lg:bg-transparent shadow-sm lg:shadow-none ring-1 ring-stone-100 lg:ring-0 ${
                showRecentSearches ? 'z-50' : 'z-20'
              }`}
            >
              <label htmlFor="search-where" className="block text-[0.6rem] font-bold text-stone-900 uppercase tracking-[0.1em] mb-0.5">
                Where to
              </label>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-stone-400 shrink-0" />
                <input
                  id="search-where"
                  type="text"
                  value={searchLocation}
                  onChange={e => setSearchLocation(e.target.value)}
                  onFocus={() => setShowRecentSearches(true)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="Lake, park, town or lodge"
                  autoComplete="off"
                  className="bg-transparent border-none p-0 text-stone-800 text-sm w-full outline-none placeholder:text-stone-400"
                />
              </div>

              {/* Where to Dropdown */}
              {showRecentSearches && (
                <div className="absolute left-0 top-full mt-2 w-full min-w-[300px] md:min-w-[340px] bg-white rounded-2xl shadow-2xl border border-stone-200/90 overflow-hidden z-[100]">
                  <div className="p-3 space-y-3">
                    {/* 1. Live Suggestions when typing */}
                    {searchLocation.trim() && searchSuggestions.length > 0 ? (
                      <div>
                        <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2 px-2">Suggestions</h4>
                        <ul className="space-y-1.5">
                          {searchSuggestions.map((suggestion, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchLocation(suggestion.text);
                                  setShowRecentSearches(false);
                                  applySearch({
                                    location: suggestion.text,
                                    checkIn: searchCheckIn,
                                    checkOut: searchCheckOut,
                                    guests: totalGuests,
                                    coords: null,
                                    proximity: searchProximity,
                                  });
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl bg-stone-50/70 hover:bg-emerald-50/80 border border-stone-100 hover:border-emerald-200/80 transition flex items-center gap-3 group/item"
                              >
                                <div className="h-8 w-8 rounded-lg bg-white border border-stone-200/80 flex items-center justify-center shrink-0 text-emerald-600 shadow-xs group-hover/item:border-emerald-300 transition">
                                  {suggestion.type === 'location' ? <MapPin className="w-4 h-4 text-emerald-600" /> : <Search className="w-4 h-4 text-emerald-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-800 text-sm truncate group-hover/item:text-emerald-900">{suggestion.text}</div>
                                  {suggestion.subtitle && (
                                    <div className="text-xs text-stone-500 truncate">{suggestion.subtitle}</div>
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 text-left transition group/geo"
                      >
                        <div className="h-8 w-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700 shadow-xs">
                          <LocateFixed className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-emerald-950 text-sm">Find stays near me</div>
                          <div className="text-xs text-emerald-700/80">Use your current GPS location</div>
                        </div>
                      </button>
                    )}

                    {/* 3. Recent Searches */}
                    {!searchLocation.trim() && recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-2 mb-1.5">
                          <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Recent searches</h4>
                          <button
                            type="button"
                            onClick={clearRecentSearches}
                            className="text-[11px] font-semibold text-stone-400 hover:text-red-600 transition"
                          >
                            Clear all
                          </button>
                        </div>
                        <ul className="space-y-1.5">
                          {recentSearches.map((rs, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchLocation(rs.location);
                                  setAdults(rs.adults);
                                  setChildren(rs.children);
                                  setRoomsWanted(rs.roomsWanted);
                                  setShowRecentSearches(false);
                                  applySearch({
                                    location: rs.location,
                                    checkIn: searchCheckIn,
                                    checkOut: searchCheckOut,
                                    guests: rs.adults + rs.children,
                                    coords: null,
                                    proximity: searchProximity,
                                  });
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl bg-stone-50/70 hover:bg-stone-100 border border-stone-100 hover:border-stone-200 transition flex items-center gap-3 group/rs"
                              >
                                <div className="h-8 w-8 rounded-lg bg-white border border-stone-200/80 flex items-center justify-center shrink-0 text-stone-500 shadow-xs">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-800 text-sm truncate group-hover/rs:text-stone-950">{rs.location}</div>
                                  <div className="text-xs text-stone-500 truncate">
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
                      <div className="pt-1 border-t border-stone-100">
                        <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2 px-2">Popular destinations</h4>
                        <div className="flex flex-wrap gap-1.5 px-1">
                          {popularDestinations.map(dest => (
                            <button
                              key={`drop-${dest}`}
                              type="button"
                              onClick={() => {
                                setSearchLocation(dest);
                                setShowRecentSearches(false);
                                applySearch({
                                  location: dest,
                                  checkIn: searchCheckIn,
                                  checkOut: searchCheckOut,
                                  guests: totalGuests,
                                  coords: null,
                                  proximity: searchProximity,
                                });
                              }}
                              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-900 border border-stone-200/70 hover:border-emerald-200 text-xs font-semibold transition"
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

            <div className="hidden lg:block w-px self-center h-10 bg-stone-200" />

            {/* When */}
            <div className="shrink-0 rounded-2xl px-4 py-3 hover:bg-stone-50 transition">
              <span className="block text-[0.6rem] font-bold text-stone-900 uppercase tracking-[0.1em] mb-0.5">
                Nights
              </span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-stone-400 shrink-0" />
                <input
                  type="date"
                  aria-label="Check in"
                  min={today}
                  value={searchCheckIn}
                  onChange={e => setSearchCheckIn(e.target.value)}
                  className="bg-transparent border-none p-0 text-stone-800 text-sm w-full outline-none min-w-0"
                />
                <span className="text-stone-300 shrink-0">&ndash;</span>
                <input
                  type="date"
                  aria-label="Check out"
                  min={searchCheckIn || today}
                  value={searchCheckOut}
                  onChange={e => setSearchCheckOut(e.target.value)}
                  className="bg-transparent border-none p-0 text-stone-800 text-sm w-full outline-none min-w-0"
                />
              </div>
            </div>

            <div className="hidden lg:block w-px self-center h-10 bg-stone-200" />

            {/* Who */}
            <div
              ref={guestSelectorRef}
              className={`relative flex-[1.05] rounded-2xl px-3 lg:px-5 py-2.5 lg:py-2 hover:bg-stone-50 transition bg-white lg:bg-transparent shadow-sm lg:shadow-none ring-1 ring-stone-100 lg:ring-0 ${
                showGuestDropdown ? 'z-50' : 'z-20'
              }`}
            >
              <button
                type="button"
                onClick={() => setShowGuestDropdown(v => !v)}
                aria-expanded={showGuestDropdown}
                className="w-full text-left"
              >
                <span className="block text-[0.6rem] font-bold text-stone-900 uppercase tracking-[0.1em] mb-0.5">
                  Party
                </span>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-stone-400 shrink-0" />
                  <span className="text-sm text-stone-800 truncate">
                    {totalGuests === 0
                      ? 'Add guests'
                      : `${totalGuests} guest${totalGuests > 1 ? 's' : ''}, ${roomsWanted} room${roomsWanted > 1 ? 's' : ''}`}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-stone-400 shrink-0 ml-auto transition ${showGuestDropdown ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {showGuestDropdown && (
                <div className="absolute top-full left-2 right-2 lg:left-auto lg:right-0 lg:w-72 mt-2 bg-white rounded-2xl shadow-2xl ring-1 ring-stone-200 p-2 z-[100]">
                  {([
                    { label: 'Adults', hint: 'Ages 13 or above', value: adults, set: setAdults, min: 1, max: 16 },
                    { label: 'Children', hint: 'Ages 2–12', value: children, set: setChildren, min: 0, max: 16 },
                    { label: 'Rooms', hint: 'Up to 8', value: roomsWanted, set: setRoomsWanted, min: 1, max: 8 },
                  ] as const).map(row => (
                    <div key={row.label} className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-stone-50">
                      <div>
                        <span className="block text-sm font-semibold text-stone-900">{row.label}</span>
                        <span className="text-xs text-stone-400">{row.hint}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Fewer ${row.label.toLowerCase()}`}
                          disabled={row.value <= row.min}
                          onClick={() => row.set(Math.max(row.min, row.value - 1))}
                          className="h-8 w-8 grid place-items-center rounded-full border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 disabled:hover:border-stone-300 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold tabular-nums">{row.value}</span>
                        <button
                          type="button"
                          aria-label={`More ${row.label.toLowerCase()}`}
                          disabled={row.value >= row.max}
                          onClick={() => row.set(Math.min(row.max, row.value + 1))}
                          className="h-8 w-8 grid place-items-center rounded-full border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 disabled:hover:border-stone-300 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSearch}
              disabled={searching}
              className="shrink-0 flex items-center justify-center gap-2 bg-stone-900 text-white
                         rounded-xl lg:rounded-full h-10 lg:h-auto lg:w-auto lg:my-0.5 lg:mr-0.5 lg:px-5 lg:py-2
                         font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-60"
            >
              {searching
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                : <Search className="h-4 w-4" />}
              Search
            </button>
          </motion.div>

          {/* One-tap destinations */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative z-10 mt-6 flex flex-wrap items-center gap-2"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40 mr-1">
              Popular
            </span>
            {popularDestinations.map(destination => (
              <button
                key={destination}
                type="button"
                onClick={() => {
                  setSearchLocation(destination);
                  applySearch({
                    location: destination,
                    checkIn: searchCheckIn,
                    checkOut: searchCheckOut,
                    guests: totalGuests,
                    coords: null,
                    proximity: searchProximity,
                  });
                }}
                className="rounded-full border border-white/20 bg-white/[0.07] px-4 py-2 text-sm font-medium text-white/80
                           backdrop-blur-sm transition hover:border-white/40 hover:bg-white/15 hover:text-white"
              >
                {destination}
              </button>
            ))}
            <button
              type="button"
              onClick={handleNearMe}
              className="flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.07] px-4 py-2
                         text-sm font-semibold text-emerald-100/80 backdrop-blur-sm transition hover:bg-emerald-300/15"
            >
              <LocateFixed className="h-3.5 w-3.5" /> Near me
            </button>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative z-10 mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/55"
          >
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300/60" /> No booking fee, ever</li>
            <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-300/60" /> You hear from the host, not a call centre</li>
            <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-emerald-300/60" /> Settle up at the property</li>
          </motion.ul>
        </div>

        <a
          href="#search-results"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 hidden md:flex flex-col items-center gap-2
                     text-white/50 hover:text-white transition"
        >
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em]">See where you could stay</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </a>
      </section>

        {/* Featured Destinations */}
        {!hasSearch && featuredHotels.length > 0 && (
          <section className="bg-stone-50/50 py-12 md:py-14 border-b border-stone-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-stone-400 uppercase mb-2">
                    {hasPromotedFeatures ? 'Hand-picked by Travel Malawi' : 'Rated by people who stayed'}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-serif text-stone-900 tracking-tight">
                    {hasPromotedFeatures ? 'Featured stays' : 'The ones guests go back to'}
                  </h2>
                </div>
                <button
                  onClick={() => document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-sm font-semibold text-stone-900 hover:text-emerald-700 transition self-start md:self-auto border-b border-stone-300 hover:border-emerald-700 pb-0.5"
                >
                  See everywhere
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredHotels.map((entry, index) => (
                  <Link key={entry.hotel.id} to={`/hotel/${entry.hotel.id}`} className="group flex flex-col gap-3">
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-100 rounded-2xl shadow-xs">
                      <SmartImage
                        src={getHotelImage(entry.hotel)}
                        alt={entry.hotel.name}
                        className="absolute inset-0 w-full h-full object-cover transition duration-700 ease-out group-hover:scale-105"
                      />
                      {entry.hotel.featured ? (
                        <span className="absolute top-3.5 left-3.5 flex items-center gap-1.5 bg-stone-900/90 backdrop-blur-md text-white text-[0.65rem] font-bold px-3 py-1.5 rounded-full uppercase tracking-[0.12em] shadow-md">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Featured
                        </span>
                      ) : index === 0 && !hasPromotedFeatures ? (
                        <span className="absolute top-3.5 left-3.5 bg-white/95 backdrop-blur-md text-stone-900 text-[0.65rem] font-bold px-3 py-1.5 rounded-full uppercase tracking-[0.12em] shadow-md">
                          Best rated
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1 px-1">
                      <p className="text-[0.65rem] font-bold tracking-[0.2em] text-stone-500 uppercase">
                        {entry.hotel.location}
                      </p>
                      <h3 className="font-serif text-xl font-bold text-stone-900 truncate group-hover:text-emerald-700 transition-colors">
                        {entry.hotel.name}
                      </h3>
                      <div className="flex items-center justify-between mt-0.5">
                        {entry.priceFrom ? (
                          <p className="text-sm text-stone-600">
                            <span className="font-bold text-stone-900">{formatMoney(entry.priceFrom, currency)}</span>
                            <span className="text-stone-400 text-xs"> / night</span>
                          </p>
                        ) : (
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

        {/* Categories */}
      <section id="search-results" className="scroll-mt-20 border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8 overflow-x-auto py-4 scrollbar-hide text-sm font-medium text-stone-500">
            {(['All', ...PROPERTY_CATEGORIES] as string[]).map((category) => (
              <button 
                key={category} 
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap transition pb-1.5 text-xs sm:text-sm ${
                  activeCategory === category 
                    ? 'text-stone-900 font-bold border-b-2 border-stone-900' 
                    : 'hover:text-stone-900 font-medium'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Property Listings & Map Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 w-full flex-1">
        {/* Results Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif text-stone-900 mb-2 tracking-tight">
              {hasSearch ? 'What matched' : 'Every stay in Malawi'}
            </h2>
            <p className="text-stone-500 text-sm md:text-base">
              {hasSearch
                ? `${filteredHotels.length} propert${filteredHotels.length === 1 ? 'y' : 'ies'} can take you.`
                : 'Independent lodges, camps and guesthouses — every one booked direct with its owner.'}
            </p>
            {hasSearch || isPriceFiltered ? (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {appliedSearch.coords && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1 rounded-full">
                    Within {appliedSearch.proximity} km
                  </span>
                )}
                {!appliedSearch.coords && appliedSearch.location && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1 rounded-full">
                    {appliedSearch.location}
                  </span>
                )}
                {appliedSearch.checkIn && appliedSearch.checkOut && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1 rounded-full">
                    {appliedSearch.checkIn} &rarr; {appliedSearch.checkOut}
                  </span>
                )}
                {!!appliedSearch.guests && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1 rounded-full">
                    {appliedSearch.guests} guest{appliedSearch.guests === 1 ? '' : 's'}
                  </span>
                )}
                {isPriceFiltered && (
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                    <span>
                      {formatMoney(priceRange[0], currency)} – {priceRange[1] >= priceLimitMax ? `${formatMoney(priceLimitMax, currency)}+` : formatMoney(priceRange[1], currency)} / night
                    </span>
                    <button 
                      type="button"
                      onClick={() => setPriceRange([priceLimitMin, priceLimitMax])}
                      className="hover:text-emerald-950 p-0.5 rounded-full hover:bg-emerald-100/80 transition"
                      title="Clear price filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-900 px-2.5 py-1 rounded-full border border-stone-200 hover:border-stone-400 transition flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Price Filter Quick Toggle Button */}
            <button
              type="button"
              id="btn-toggle-price-filter"
              onClick={() => setShowPriceFilterDrawer(prev => !prev)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition border cursor-pointer ${
                isPriceFiltered
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : showPriceFilterDrawer
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>
                {isPriceFiltered 
                  ? `${formatMoney(priceRange[0], currency)} - ${priceRange[1] >= priceLimitMax ? `${formatMoney(priceLimitMax, currency)}+` : formatMoney(priceRange[1], currency)}`
                  : 'Budget Filter'}
              </span>
              {isPriceFiltered && (
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              )}
            </button>

            {/* Currency selector */}
            {offeredCurrencies.length > 1 && (
              <div className="flex items-center gap-1.5 bg-stone-50 p-1 rounded-full border border-stone-200">
                {offeredCurrencies.map(code => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => chooseCurrency(code)}
                    aria-pressed={currency === code}
                    title={CURRENCIES[code].label}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                      currency === code
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}

            {/* Sort Dropdown */}
            <label className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider hidden sm:inline">Sort</span>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="bg-white border border-stone-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-stone-700 outline-none focus:border-stone-900 transition shadow-2xs"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Price Range Slider Filter Panel */}
        <div className="mb-6">
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
            availablePrices={allAvailablePrices}
            matchingCount={filteredHotels.length}
            totalCount={hotels.filter(h => !h.status || h.status === 'approved').length}
            isExpanded={showPriceFilterDrawer}
            onToggleExpand={() => setShowPriceFilterDrawer(prev => !prev)}
            includeUnpriced={includeUnpricedRooms}
            onToggleIncludeUnpriced={(include) => setIncludeUnpricedRooms(include)}
          />
        </div>

        {/* Dedicated Tabbed Interface for List View vs Map View */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-6">
          <div className="inline-flex items-center p-1 bg-stone-100 rounded-2xl border border-stone-200/80 shadow-2xs">
            <button
              type="button"
              id="tab-list-view"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${viewMode === 'grid' ? 'text-emerald-700' : 'text-stone-500'}`} />
              <span>List View</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black ${
                viewMode === 'grid' ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700'
              }`}>
                {filteredHotels.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-map-view"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              <MapIcon className={`w-4 h-4 ${viewMode === 'map' ? 'text-emerald-600' : 'text-stone-500'}`} />
              <span>Map View</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black ${
                viewMode === 'map' ? 'bg-emerald-800 text-white' : 'bg-stone-200 text-stone-700'
              }`}>
                {lodgeMarkers.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-stone-500 hidden sm:block">
            {viewMode === 'grid' 
              ? `Showing page ${currentPage} of ${Math.max(1, Math.ceil(filteredHotels.length / itemsPerPage))}`
              : `Interactive clustered map of Malawi stays`
            }
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
                <div key={i} className="flex flex-col gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-8">
                  {filteredHotels.length > 0 ? filteredHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((entry, index) => (
                    <HotelCard
                      key={entry.hotel.id}
                      hotel={entry.hotel}
                      index={index}
                      priceFrom={entry.priceFrom}
                      priceCurrency={currency}
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
                        className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-stone-800 transition shadow-sm"
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
                {/* Map View Search, Filter & Location Control Bar */}
                <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-3.5 md:p-4 space-y-3.5">
                  {/* Top Row: Search Input, Quick Filters, Geolocation Toggle, and Sort */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Search Field */}
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={mapSearchText}
                        onChange={(e) => setMapSearchText(e.target.value)}
                        placeholder="Search map by lodge name, district, or lakefront area..."
                        className="w-full pl-9 pr-8 py-2 text-xs md:text-sm bg-stone-50 hover:bg-stone-100/80 focus:bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition"
                      />
                      {mapSearchText && (
                        <button
                          type="button"
                          onClick={() => setMapSearchText('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Controls Row: Geolocation, Filters, Sort */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* User Location Toggle Button */}
                      <button
                        type="button"
                        onClick={handleToggleUserLocation}
                        disabled={isLocatingUser}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition shadow-2xs border ${
                          showUserLocation
                            ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                        title={showUserLocation ? "Turn off your location pin" : "Locate me on map to find nearest stays"}
                      >
                        {isLocatingUser ? (
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="relative flex items-center justify-center">
                            <Locate className={`w-3.5 h-3.5 ${showUserLocation ? 'text-white' : 'text-blue-600'}`} />
                            {showUserLocation && (
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                            )}
                          </div>
                        )}
                        <span>{showUserLocation ? 'My Location: ON' : 'Show My Location'}</span>
                      </button>

                      {/* Sort Dropdown */}
                      <div className="relative inline-flex items-center">
                        <select
                          value={sortKey}
                          onChange={(e) => {
                            const newSort = e.target.value as SortKey;
                            setSortKey(newSort);
                            if (newSort === 'distance_asc' && !showUserLocation && !isLocatingUser) {
                              handleToggleUserLocation();
                            }
                          }}
                          className="appearance-none text-xs font-semibold bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200 rounded-xl pl-3 pr-7 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition cursor-pointer"
                        >
                          <option value="recommended">Sort: Recommended</option>
                          <option value="distance_asc">Sort: Nearest to Me (GPS)</option>
                          <option value="price_asc">Sort: Price: Low to High</option>
                          <option value="price_desc">Sort: Price: High to Low</option>
                          <option value="rating">Sort: Guest Rating</option>
                          <option value="name_asc">Sort: Name (A-Z)</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute right-2.5 pointer-events-none" />
                      </div>

                      {/* Filter Modal / Popover Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowMapFiltersModal(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                          activeMapFiltersCount > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Filters</span>
                        {activeMapFiltersCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] flex items-center justify-center font-black">
                            {activeMapFiltersCount}
                          </span>
                        )}
                      </button>

                      {/* Clear Filters Button */}
                      {activeMapFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={clearMapFilters}
                          className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
                          title="Reset map filters"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Details Drawer / Bar */}
                  <div className={`pt-2 border-t border-stone-100 flex flex-wrap items-center gap-2.5 transition-all ${
                    showMapFiltersModal ? 'block' : 'hidden md:flex'
                  }`}>
                    {/* Category Selector Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setActiveCategory('All')}
                        className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                          activeCategory === 'All'
                            ? 'bg-stone-900 text-white font-bold'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        All Types
                      </button>
                      {PROPERTY_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCategory(cat)}
                          className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                            activeCategory === cat
                              ? 'bg-stone-900 text-white font-bold'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Extra Secondary Filters */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
                      {/* Price Range Slider Toggle in Map View */}
                      <button
                        type="button"
                        onClick={() => setShowPriceFilterDrawer(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${
                          isPriceFiltered
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>
                          {isPriceFiltered 
                            ? `${formatMoney(priceRange[0], currency)} - ${priceRange[1] >= priceLimitMax ? `${formatMoney(priceLimitMax, currency)}+` : formatMoney(priceRange[1], currency)}`
                            : 'Budget: Range Slider'}
                        </span>
                      </button>

                      {/* Rating Filter */}
                      <select
                        value={mapMinRating}
                        onChange={(e) => setMapMinRating(Number(e.target.value))}
                        className="text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg px-2.5 py-1 focus:outline-none"
                      >
                        <option value={0}>Rating: Any</option>
                        <option value={4.0}>★ 4.0 & above</option>
                        <option value={4.5}>★ 4.5 & above</option>
                      </select>

                      {/* Amenity Filter */}
                      <select
                        value={mapAmenityFilter}
                        onChange={(e) => setMapAmenityFilter(e.target.value)}
                        className="text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg px-2.5 py-1 focus:outline-none"
                      >
                        <option value="all">Amenity: Any</option>
                        <option value="beach">Lakefront / Beach</option>
                        <option value="pool">Swimming Pool</option>
                        <option value="safari">Safari / Game Drives</option>
                        <option value="wifi">Free WiFi</option>
                        <option value="restaurant">Restaurant / Dining</option>
                        <option value="air conditioning">Air Conditioning</option>
                      </select>
                    </div>
                  </div>

                  {/* Geolocation Notice Banner if active */}
                  {showUserLocation && userLocation && (
                    <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200/80 px-3.5 py-2 rounded-xl text-xs text-blue-900">
                      <div className="flex items-center gap-2">
                        <Locate className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
                        <span>
                          <strong>Location active:</strong> Showing real distances from your GPS location. Stays are sorted by proximity.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleUserLocation}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline ml-2 shrink-0"
                      >
                        Turn off
                      </button>
                    </div>
                  )}

                  {/* Geolocation Error Alert if failed */}
                  {userLocationError && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl text-xs text-amber-900">
                      <span>{userLocationError}</span>
                      <button
                        type="button"
                        onClick={() => setUserLocationError(null)}
                        className="text-amber-700 hover:text-amber-900 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Main Map View: Left Cards List + Right Map Canvas */}
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-4 lg:gap-6 items-start">
                  {/* Lodge Cards Feed (Natural flow on mobile, scrollable sidebar on desktop) */}
                  <div className="order-2 lg:order-1 lg:h-[560px] lg:overflow-y-auto pr-0 lg:pr-1 space-y-3 scrollbar-slim">
                    <div className="flex items-center justify-between px-1 text-xs text-stone-500 font-medium">
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
                          onClick={clearMapFilters}
                          className="px-4 py-1.5 rounded-full bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
                        >
                          Clear Map Filters
                        </button>
                      </div>
                    ) : (
                      filteredHotels.map(entry => {
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
                          ? estimateTravelTime(distanceKm(userLocation, coords!))
                          : null;

                        return (
                          <div
                            key={hotel.id}
                            id={`map-card-${hotel.id}`}
                            onClick={() => setSelectedMapLodgeId(isSelected ? null : hotel.id ?? null)}
                            className={`group p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer bg-white ${
                              isSelected
                                ? 'border-emerald-600 ring-2 ring-emerald-500/25 shadow-md bg-emerald-50/10'
                                : 'border-stone-200/90 hover:border-stone-300 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex gap-3 sm:gap-3.5">
                              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-stone-100 shrink-0 relative">
                                {img ? (
                                  <SmartImage src={img} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                                    <MapPin className="w-5 h-5" />
                                  </div>
                                )}
                                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-stone-900/85 backdrop-blur-md text-[9px] font-bold text-white uppercase tracking-wider">
                                  {categoryLabel}
                                </span>
                              </div>

                              <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                                <div className="space-y-1">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <h4 className="font-serif font-bold text-stone-900 truncate text-sm sm:text-base group-hover:text-emerald-800 transition-colors leading-tight">
                                      {hotel.name}
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
                                    <span className="truncate">{hotel.location}</span>
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

                                <div className="flex items-center justify-between pt-2 mt-1 border-t border-stone-100">
                                  <div>
                                    {priceDisplay ? (
                                      <div className="text-xs sm:text-sm font-bold text-emerald-800">
                                        {priceDisplay} <span className="text-[10px] text-stone-400 font-normal">/ night</span>
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
                                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                        Live from GPS
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-white/80 rounded-lg p-2 border border-emerald-100">
                                        <span className="text-[10px] text-stone-500 font-medium block">Est. Drive Time</span>
                                        <span className="font-extrabold text-stone-900 text-sm">
                                          ⏱️ {travelEstimate.drivingTimeFormatted}
                                        </span>
                                      </div>
                                      <div className="bg-white/80 rounded-lg p-2 border border-emerald-100">
                                        <span className="text-[10px] text-stone-500 font-medium block">Est. Road Distance</span>
                                        <span className="font-extrabold text-blue-700 text-sm">
                                          🛣️ ~{travelEstimate.roadDistanceKm} km
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
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                                      >
                                        <Navigation className="w-3.5 h-3.5 fill-white" />
                                        <span>Get Directions</span>
                                        <ExternalLink className="w-3 h-3 opacity-80" />
                                      </a>
                                      <Link
                                        to={`/hotel/${hotel.id}`}
                                        className="inline-flex items-center justify-center gap-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition"
                                      >
                                        <span>View Stay</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </Link>
                                    </div>
                                  </div>
                                ) : !showUserLocation ? (
                                  <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2 text-xs text-blue-900">
                                      <Locate className="w-4 h-4 text-blue-600 shrink-0" />
                                      <span>Turn on location to view driving time & distance to this stay.</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleToggleUserLocation}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0"
                                    >
                                      <Locate className="w-3.5 h-3.5" />
                                      <span>Enable Location</span>
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Interactive Clustered Map */}
                  <div className="order-1 lg:order-2 lg:sticky lg:top-20 h-[340px] sm:h-[420px] lg:h-[560px] w-full rounded-2xl overflow-hidden shadow-sm border border-stone-200 bg-stone-100">
                    <InteractiveMap
                      lodges={lodgeMarkers}
                      enableClustering={true}
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
               className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-stone-800 transition"
             >
               List your property
             </Link>
          </div>
        )}
      </section>

      {/* Host Call to Action */}
      <section className="relative overflow-hidden bg-stone-900 py-16 md:py-20 text-white">
        <div className="absolute inset-0 opacity-[0.12]">
          <SmartImage src={DECORATIVE_IMAGE} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-900/90 to-emerald-950/60" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="mb-4 text-[0.7rem] font-bold uppercase tracking-[0.26em] text-emerald-400">
                Run a place of your own?
              </p>
              <h2 className="mb-5 font-serif text-3xl md:text-5xl leading-[1.1] tracking-tight">
                Your lodge. Your rates.
                <br />
                Your guests.
              </h2>
              <p className="mb-6 max-w-lg text-sm md:text-base leading-relaxed text-white/70">
                Travellers find you, message you, and book with you — no agency in the middle and
                nothing taken off your rate. Listing takes one sitting.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Link
                  to="/list-your-property"
                  className="rounded-full bg-white px-7 py-3 text-center text-sm font-bold text-stone-900 shadow-lg transition hover:bg-stone-100"
                >
                  List your property
                </Link>
                <span className="text-xs text-white/50">Free to list · Reviewed within a day</span>
              </div>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { term: 'No commission', detail: 'You keep the full nightly rate you set.' },
                { term: 'Paid on arrival', detail: 'Guests settle with you, in kwacha or dollars.' },
                { term: 'One dashboard', detail: 'Rooms, rates, blocked dates and every request.' },
                { term: 'WhatsApp built in', detail: 'Confirmations reach guests where they read.' },
              ].map(item => (
                <div key={item.term} className="rounded-xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
                  <dt className="mb-1 text-sm font-bold text-white">{item.term}</dt>
                  <dd className="text-xs leading-relaxed text-white/65">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}



