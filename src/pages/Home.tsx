import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Pagination from '../components/Pagination';
import { Search, MapPin, Calendar, Users, Star, LocateFixed, ChevronDown, Plus, Minus, ShieldCheck, MessageCircle, Smartphone, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Review, CurrencyCode } from '../types';
import { Link, useSearchParams } from 'react-router-dom';
import HotelCard from '../components/HotelCard';
import SmartImage from '../components/SmartImage';
import { DECORATIVE_IMAGE, HERO_IMAGE, getHotelImage } from '../lib/images';
import { BookingLike, lowestPrice, roomsMatching } from '../lib/availability';
import { todayStr } from '../lib/dates';
import { CURRENCY_CODES, CURRENCIES, currenciesForRooms, formatMoney, readStoredCurrency, storeCurrency } from '../lib/currency';
import { PROPERTY_CATEGORIES } from '../lib/listing';
import { distanceKm, isValidLatLng } from '../lib/geo';

type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating';

const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Guest rating',
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

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>('recommended');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [currency, setCurrency] = useState<CurrencyCode>(() => readStoredCurrency() ?? 'USD');

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
        setHotels(hotelsData.filter(h => h.status === 'approved' || !h.status));
        setRooms(roomSnap.docs.map(d => ({ id: d.id, ...d.data() })) as RoomType[]);
      } catch (error) {
        console.error("Error fetching hotels:", error);
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
    if (next.checkIn && next.checkOut) {
      setSearching(true);
      try {
        await ensureBookings();
      } catch (error) {
        // Availability is a refinement, not a gate: fall back to matching on
        // capacity alone rather than showing the visitor nothing.
        console.error('Could not load availability:', error);
        toast('Showing results without live availability.', { icon: '⚠️' });
      } finally {
        setSearching(false);
      }
    }
    setAppliedSearch(next);
    setCurrentPage(1);
    document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const coordinates = hotel.coordinates;
        const distance =
          appliedSearch.coords && isValidLatLng(coordinates)
            ? distanceKm(appliedSearch.coords, coordinates)
            : null;

        return {
          hotel,
          matching,
          distance,
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
        // A property whose rooms have not been set up is still worth showing;
        // one with rooms that cannot take this party is not.
        if ((guests || appliedSearch.checkIn) && entry.hasRooms && entry.matching.length === 0) return false;
        return true;
      });

    const sorted = [...matched];
    if (appliedSearch.coords && sortKey === 'recommended') {
      sorted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else if (sortKey === 'price_asc') {
      sorted.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
    } else if (sortKey === 'price_desc') {
      sorted.sort((a, b) => (b.priceFrom ?? -Infinity) - (a.priceFrom ?? -Infinity));
    } else if (sortKey === 'rating') {
      sorted.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
    }
    return sorted;
  }, [hotels, roomsByHotel, bookings, ratingByHotel, activeCategory, appliedSearch, sortKey, currency]);

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
      {/* Hero.
          Was a centred stack over a full-bleed image: a rotating verb in front
          of the brand name, a sentence of positioning copy, and a search pill.
          It read like a slogan and said nothing about where a visitor could
          actually go. This one is anchored left, names real places, and puts
          one-tap destinations directly under the search. */}
      <section className="relative min-h-[94svh] w-full flex flex-col justify-center overflow-hidden bg-stone-950">
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
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-stone-950 via-stone-950/85 to-stone-950/45" />
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-stone-950 via-stone-950/25 to-stone-950/65" />

        <div className="relative z-20 w-full max-w-6xl mx-auto px-6 lg:px-8 pt-28 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 mb-7"
          >
            <span className="h-px w-8 bg-emerald-300/40" />
            <span className="text-[0.65rem] md:text-[0.7rem] font-semibold tracking-[0.26em] text-emerald-200/70 uppercase">
              Booked direct with Malawian hosts
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-white max-w-4xl tracking-[-0.035em] leading-[1.02]
                       text-[clamp(2.6rem,7.5vw,5.75rem)] mb-7"
          >
            <span className="block">Wake up on</span>
            <span className="relative block h-[1.12em] overflow-hidden text-emerald-200/85">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={heroIndex}
                  initial={{ opacity: 0, y: '100%' }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: '-100%' }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 top-0 whitespace-nowrap"
                >
                  {HERO_PLACES[heroIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl text-lg md:text-xl text-white/70 leading-relaxed"
          >
            Lodges, camps and guesthouses run by the families who own them. Ask the host
            anything, agree the details between you, and pay when you arrive.
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 bg-white/95 backdrop-blur-xl rounded-3xl p-3 lg:p-2.5
                       shadow-2xl shadow-stone-950/40 ring-1 ring-white/50
                       flex flex-col lg:flex-row lg:items-stretch gap-2 lg:gap-0 w-full max-w-4xl text-left"
          >
            {/* Where */}
            <div ref={locationSearchRef} className="relative flex-[1.5] min-w-0 rounded-2xl px-4 lg:px-5 py-4 lg:py-3 hover:bg-stone-50 transition group bg-white lg:bg-transparent shadow-sm lg:shadow-none ring-1 ring-stone-100 lg:ring-0">
              <label htmlFor="search-where" className="block text-[0.68rem] font-bold text-stone-900 uppercase tracking-[0.14em] mb-1">
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

              {/* Recent Searches Dropdown */}
              {showRecentSearches && (searchSuggestions.length > 0 || (!searchLocation.trim() && recentSearches.length > 0)) && (
                <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] bg-white rounded-2xl shadow-xl ring-1 ring-stone-950/5 overflow-hidden z-50">
                  <div className="p-3">
                    {searchLocation.trim() && searchSuggestions.length > 0 ? (
                      <>
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 px-3">Suggestions</h4>
                        <ul className="space-y-1">
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
                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 transition flex items-center gap-3 group/item"
                              >
                                <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 group-hover/item:bg-white group-hover/item:shadow-sm transition">
                                  {suggestion.type === 'location' ? <MapPin className="w-4 h-4 text-stone-400" /> : <Search className="w-4 h-4 text-stone-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-700 text-sm truncate">{suggestion.text}</div>
                                  {suggestion.subtitle && (
                                    <div className="text-xs text-stone-400 truncate">{suggestion.subtitle}</div>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : !searchLocation.trim() && recentSearches.length > 0 ? (
                      <>
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 px-3">Recent searches</h4>
                        <ul className="space-y-1">
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
                                }}
                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 transition flex items-center gap-3 group/item"
                              >
                                <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 group-hover/item:bg-white group-hover/item:shadow-sm transition">
                                  <Clock className="w-4 h-4 text-stone-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-700 text-sm truncate">{rs.location}</div>
                                  <div className="text-xs text-stone-400 truncate">
                                    {rs.adults + rs.children} guest{rs.adults + rs.children !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:block w-px self-center h-10 bg-stone-200" />

            {/* When */}
            <div className="shrink-0 rounded-2xl px-4 py-3 hover:bg-stone-50 transition">
              <span className="block text-[0.68rem] font-bold text-stone-900 uppercase tracking-[0.14em] mb-1">
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
            <div ref={guestSelectorRef} className="relative flex-[1.05] rounded-2xl px-4 lg:px-5 py-4 lg:py-3 hover:bg-stone-50 transition bg-white lg:bg-transparent shadow-sm lg:shadow-none ring-1 ring-stone-100 lg:ring-0">
              <button
                type="button"
                onClick={() => setShowGuestDropdown(v => !v)}
                aria-expanded={showGuestDropdown}
                className="w-full text-left"
              >
                <span className="block text-[0.68rem] font-bold text-stone-900 uppercase tracking-[0.14em] mb-1">
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
                <div className="absolute top-full left-2 right-2 lg:left-auto lg:right-0 lg:w-72 mt-2 bg-white rounded-2xl shadow-xl ring-1 ring-stone-200 p-2 z-50">
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
                         rounded-2xl h-12 lg:h-auto lg:w-auto lg:my-1 lg:mr-1 lg:px-7
                         font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-60"
            >
              {searching
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                : <Search className="h-4 w-4" />}
              Search
            </button>
          </motion.div>

          {/* One-tap destinations. "Near me" was written and then left out of
              the markup entirely, so the geolocation search was unreachable. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center gap-2"
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
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/55"
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

        {/* Featured Destinations.
            Deliberately the same editorial card language as the main grid —
            this section used to use boxed cards with a "Discover →" affordance,
            so the page showed the same properties in two unrelated styles. */}
        {!hasSearch && featuredHotels.length > 0 && (
          <section className="bg-white py-20 border-b border-stone-200">
            <div className="max-w-[90rem] mx-auto px-6 lg:px-12">
              <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-stone-400 uppercase mb-3">
                    {hasPromotedFeatures ? 'Hand-picked by Travel Malawi' : 'Rated by people who stayed'}
                  </p>
                  <h2 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-tight">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 gap-y-10">
                {featuredHotels.map((entry, index) => (
                  <Link key={entry.hotel.id} to={`/hotel/${entry.hotel.id}`} className="group flex flex-col gap-4">
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-100 rounded-sm">
                      <SmartImage
                        src={getHotelImage(entry.hotel)}
                        alt={entry.hotel.name}
                        className="absolute inset-0 w-full h-full object-cover transition duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
                      />
                      {entry.hotel.featured ? (
                        <span className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/95 backdrop-blur text-stone-900 text-[0.65rem] font-bold px-3 py-1.5 rounded-full uppercase tracking-[0.12em]">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured
                        </span>
                      ) : index === 0 && !hasPromotedFeatures ? (
                        <span className="absolute top-4 left-4 bg-white/95 backdrop-blur text-stone-900 text-[0.65rem] font-bold px-3 py-1.5 rounded-full uppercase tracking-[0.12em]">
                          Best rated
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1">
                      <p className="text-[0.65rem] font-bold tracking-[0.2em] text-stone-500 uppercase">
                        {entry.hotel.location}
                      </p>
                      <h3 className="font-serif text-2xl text-stone-900 truncate group-hover:text-emerald-700 transition-colors duration-300">
                        {entry.hotel.name}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        {entry.priceFrom ? (
                          <p className="text-sm text-stone-600">
                            <span className="font-semibold text-stone-900">{formatMoney(entry.priceFrom, currency)}</span>
                            <span className="text-stone-400"> a night</span>
                          </p>
                        ) : (
                          <span className="text-sm text-stone-400">Ask the host for rates</span>
                        )}
                        {entry.rating && (
                          <span className="flex items-center gap-1 text-sm text-stone-600">
                            <Star className="w-3.5 h-3.5 fill-stone-900 text-stone-900" />
                            <span className="font-semibold text-stone-900">{entry.rating.average.toFixed(1)}</span>
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
      <section id="search-results" className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center gap-10 overflow-x-auto py-6 scrollbar-hide text-sm font-medium text-stone-500">
            {(['All', ...PROPERTY_CATEGORIES] as string[]).map((category) => (
              <button 
                key={category} 
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap transition pb-2 ${activeCategory === category ? 'text-stone-900 border-b-2 border-stone-900' : 'hover:text-stone-900'}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Property Grid */}
      <section className="max-w-[90rem] mx-auto px-6 lg:px-12 py-32 w-full flex-1">
        <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-4 tracking-tight">
              {hasSearch ? 'What matched' : 'Every stay in Malawi'}
            </h2>
            <p className="text-stone-500 text-lg">
              {hasSearch
                ? `${filteredHotels.length} propert${filteredHotels.length === 1 ? 'y' : 'ies'} can take you.`
                : 'Independent lodges, camps and guesthouses — every one booked direct with its owner.'}
            </p>
            {hasSearch && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {appliedSearch.coords && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1.5 rounded-full">
                    Within {appliedSearch.proximity} km
                  </span>
                )}
                {!appliedSearch.coords && appliedSearch.location && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1.5 rounded-full">
                    {appliedSearch.location}
                  </span>
                )}
                {appliedSearch.checkIn && appliedSearch.checkOut && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1.5 rounded-full">
                    {appliedSearch.checkIn} &rarr; {appliedSearch.checkOut}
                  </span>
                )}
                {!!appliedSearch.guests && (
                  <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-3 py-1.5 rounded-full">
                    {appliedSearch.guests} guest{appliedSearch.guests === 1 ? '' : 's'}
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-900 px-3 py-1.5 rounded-full border border-stone-200 hover:border-stone-400 transition flex items-center gap-1.5"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-6 shrink-0 flex-wrap">
            {offeredCurrencies.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Currency</span>
                <div className="flex gap-1">
                  {offeredCurrencies.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => chooseCurrency(code)}
                      aria-pressed={currency === code}
                      title={CURRENCIES[code].label}
                      className={`px-3 py-2 rounded-full text-sm font-semibold transition ${
                        currency === code
                          ? 'bg-stone-900 text-white'
                          : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          <label className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Sort by</span>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="bg-white border border-stone-200 rounded-full px-4 py-2.5 text-sm font-medium text-stone-700 outline-none focus:border-stone-900 transition"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                <option key={key} value={key}>{SORT_LABELS[key]}</option>
              ))}
            </select>
          </label>
          </div>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="animate-pulse bg-stone-200 rounded-2xl aspect-[4/3] w-full" />
                <div className="animate-pulse bg-stone-200 h-5 w-2/3 rounded mt-1" />
                <div className="animate-pulse bg-stone-200 h-4 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : hotels.length > 0 ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
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
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                    <Search className="w-8 h-8 text-stone-400" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">Nothing free on those terms</h3>
                  <p className="text-stone-500 text-lg max-w-md mb-8">
                    Try a wider stretch of dates, a smaller party, or somewhere else along the lake —
                    most properties have more room midweek.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition"
                  >
                    Start the search over
                  </button>
                </div>
              )}
            </div>
            
            {filteredHotels.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredHotels.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                <MapPin className="w-8 h-8 text-stone-400" />
             </div>
             <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">Nothing listed yet</h3>
             <p className="text-stone-500 text-lg max-w-md mb-8">
               The first listings are on their way. If you run a property in Malawi, yours could be
               the one people find here.
             </p>
             <Link
               to="/list-your-property"
               className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition"
             >
               List your property
             </Link>
          </div>
        )}
      </section>

      {/* Host call to action.
          The button pointed at /dashboard, which redirects anyone without the
          manager role straight back here — so for every visitor who was not
          already a host, the one thing this section asked them to do did
          nothing at all. */}
      <section className="relative overflow-hidden bg-stone-900 py-28 text-white">
        <div className="absolute inset-0 opacity-[0.12]">
          <SmartImage src={DECORATIVE_IMAGE} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-900/90 to-emerald-950/60" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="mb-6 text-[0.7rem] font-bold uppercase tracking-[0.26em] text-emerald-400">
                Run a place of your own?
              </p>
              <h2 className="mb-7 font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
                Your lodge. Your rates.
                <br />
                Your guests.
              </h2>
              <p className="mb-9 max-w-lg text-lg leading-relaxed text-white/70">
                Travellers find you, message you, and book with you — no agency in the middle and
                nothing taken off your rate. Listing takes one sitting.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/list-your-property"
                  className="rounded-full bg-white px-8 py-4 text-center text-base font-bold text-stone-900 shadow-xl transition hover:bg-stone-100"
                >
                  List your property
                </Link>
                <span className="text-sm text-white/50">Free to list · Reviewed within a day</span>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                { term: 'No commission', detail: 'You keep the full nightly rate you set.' },
                { term: 'Paid on arrival', detail: 'Guests settle with you, in kwacha or dollars.' },
                { term: 'One dashboard', detail: 'Rooms, rates, blocked dates and every request.' },
                { term: 'WhatsApp built in', detail: 'Confirmations reach guests where they read.' },
              ].map(item => (
                <div key={item.term} className="rounded-2xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-sm">
                  <dt className="mb-1.5 font-bold">{item.term}</dt>
                  <dd className="text-sm leading-relaxed text-white/60">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
