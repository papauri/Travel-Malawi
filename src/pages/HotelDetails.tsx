import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Review, CurrencyCode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useChatModal } from '../contexts/ChatModalContext';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { MapPin, Calendar, Users, Star, CheckCircle2, ChevronRight, Info, Plus, Minus, ShieldCheck, AlertTriangle, UtensilsCrossed, Clock, BedDouble, MessageSquare, MessageCircle, Images, Mail, PhoneCall, Navigation, CreditCard, LogIn, LogOut, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { motion } from 'motion/react';
import Pagination from '../components/Pagination';
import PropertyChat from '../components/PropertyChat';
import SmartImage from '../components/SmartImage';
import DirectionsPanel from '../components/DirectionsPanel';
import { ReviewModal } from '../components/ReviewModal';
import InteractiveMap from '../components/InteractiveMap';
import { useBreadcrumbLabel } from '../components/Breadcrumbs';
import { getHotelImages, getRoomImage } from '../lib/images';
import { formatDateStr, nightsBetween, todayStr } from '../lib/dates';
import { formatTime, hasPublishedHours, isOpenAt, summariseHours } from '../lib/hours';
import MenuTemplateView from '../components/MenuTemplates';
import { BookingLike, isRoomAvailable, unitsRemaining } from '../lib/availability';
import { hasAnyContact, mailtoLink, telLink, whatsappLink } from '../lib/contact';
import { mapEmbedUrl, mapLinkUrl, resolveHotelCoordinates, isValidLatLng } from '../lib/geo';
import { getSingleCachedHotel, saveSingleCachedHotel } from '../lib/mapCache';
import DatePicker from '../components/DatePicker';
import { computeBookingPricing, formatMoney, makeBookingReference } from '../lib/booking';
import { isTraveller } from '../lib/roles';
import { validateBooking, errorsByField, BookingField, MAX_SPECIAL_REQUESTS } from '../lib/validateBooking';
import { assessBooking, readSubmissionLog, recordSubmission } from '../lib/spam';
import {
  CURRENCIES, currenciesForRooms, packagePrice, readStoredCurrency, resolveCurrency,
  roomCurrencies, roomPrice, roomPrimaryCurrency, storeCurrency,
} from '../lib/currency';
import Modal, { fieldClass, labelClass } from '../components/Modal';
import Lightbox from '../components/Lightbox';

export default function HotelDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { openInquiryChat, activeChat } = useChatModal();

  const today = todayStr();
  const [hotel, setHotel] = useState<Hotel | null>(() => (id ? getSingleCachedHotel(id) : null));
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(() => !id || !getSingleCachedHotel(id));
  const [saving, setSaving] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeGalleryRoom, setActiveGalleryRoom] = useState<RoomType | null>(null);
  const [showHotelGallery, setShowHotelGallery] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [guestsCount, setGuestsCount] = useState(() => {
    const parsed = parseInt(searchParams.get('guests') ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
  });
  const [guestName, setGuestName] = useState(user?.displayName || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [currentReviewPage, setCurrentReviewPage] = useState(1);
  const [reviewSort, setReviewSort] = useState<'recent' | 'highest'>('recent');
  const reviewsPerPage = 5;
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>(() => readStoredCurrency() ?? 'USD');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BookingField, string>>>({});
  // A field positioned off-screen and hidden from assistive technology. No
  // person can fill it in; something submitting the form blindly will.
  const [honeypot, setHoneypot] = useState('');
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show when scrolled past roughly the hero image
      setIsScrolledPastHero(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // When the booking form was opened, for the "filled impossibly fast" check.
  const [formOpenedAt, setFormOpenedAt] = useState<number>(() => Date.now());

  // The property and its rooms are what the page is for; each secondary read
  // is issued separately and swallowed on failure. Bundling them into one
  // Promise.all means any single denied collection blanks the whole page —
  // which is exactly what a `bookings` read denied by undeployed rules did.
  /**
   * Any dialog on this page. The page's fixed furniture — the floating chat
   * button, the booking status pill — hides while one is open, so nothing
   * floats over a form the visitor is filling in.
   */
  const anyDialogOpen = !!selectedRoom || !!activeGalleryRoom || showHotelGallery;

  // Fills the last crumb with the property's name once it has loaded.
  useBreadcrumbLabel(hotel?.name);

  // Live real-time subscription to the hotel document so online status and details update instantly
  useEffect(() => {
    if (!id) return;

    const unsubHotel = onSnapshot(doc(db, 'hotels', id), (docSnap) => {
      if (docSnap.exists()) {
        const fetchedHotel = { id: docSnap.id, ...docSnap.data() } as Hotel;
        setHotel(fetchedHotel);
        saveSingleCachedHotel(fetchedHotel);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to hotel details:", error);
      setLoading(false);
    });

    async function fetchRooms() {
      try {
        const roomDocs = await getDocs(query(collection(db, 'room_types'), where('hotelId', '==', id)));
        setRooms(roomDocs.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
      } catch (error) {
        console.error("Error fetching rooms:", error);
      }
    }
    fetchRooms();

    return () => unsubHotel();
  }, [id]);

  // Live occupancy. Without it the page still sells rooms — it just falls back
  // to the manager's stated inventory, and the final pre-write check catches a
  // clash.
  useEffect(() => {
    if (!id) return;
    getDocs(query(collection(db, 'bookings'), where('hotelId', '==', id)))
      .then(snap => setBookings(snap.docs.map(d => d.data() as BookingLike)))
      .catch(err => console.warn('Live availability unavailable:', err?.message ?? err));
  }, [id]);

  // Guest-written reviews live in their own collection so each one can be tied
  // to a completed stay. A failure here must not take the page down.
  useEffect(() => {
    if (!id) return;
    getDocs(query(collection(db, 'reviews'), where('hotelId', '==', id)))
      .then(snap => {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
        loaded.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setReviews(loaded);
      })
      .catch(err => console.warn('Reviews unavailable:', err?.message ?? err));
  }, [id]);

  useEffect(() => {
    if (user) {
      setGuestName(user.displayName || '');
      setGuestEmail(user.email || '');
    }
  }, [user]);

  // A check-out on or before the check-in is not a stay. Clearing it beats
  // leaving the form in a state whose price breakdown silently reads zero.
  useEffect(() => {
    if (checkIn && checkOut && checkOut <= checkIn) setCheckOut('');
  }, [checkIn, checkOut]);

  const isBookable = !hotel?.status || hotel.status === 'approved';

  /** The Menu tab only exists when the property has published a restaurant. */
  const restaurant = hotel?.restaurant?.enabled ? hotel.restaurant : null;

  /** Currencies this property sells in, across all its rooms. */
  const offeredCurrencies = useMemo(() => currenciesForRooms(rooms), [rooms]);

  // Fall back if the remembered choice is not one this property accepts.
  useEffect(() => {
    if (offeredCurrencies.length > 0 && !offeredCurrencies.includes(currency)) {
      setCurrency(offeredCurrencies[0]);
    }
  }, [offeredCurrencies, currency]);

  const chooseCurrency = (code: CurrencyCode) => {
    setCurrency(code);
    storeCurrency(code);
  };

  /** Remaining inventory per room for the dates currently selected. */
  const roomAvailability = useMemo(() => {
    const hasDates = !!checkIn && !!checkOut && checkIn < checkOut;
    const map: Record<string, { available: boolean; remaining: number | null }> = {};
    for (const room of rooms) {
      if (!room.id) continue;
      map[room.id] = hasDates
        ? {
            available: isRoomAvailable(room, bookings, checkIn, checkOut, 1),
            remaining: unitsRemaining(room, bookings, checkIn, checkOut),
          }
        : { available: (room.quantity ?? 0) > 0, remaining: null };
    }
    return map;
  }, [rooms, bookings, checkIn, checkOut]);

  /** Combined rating across imported and guest-written reviews. */
  const ratingSummary = useMemo(() => {
    const ratings = [
      ...(hotel?.reviews ?? []).map(r => r.rating),
      ...reviews.map(r => r.rating),
    ].filter(r => typeof r === 'number' && r > 0);
    if (!ratings.length) return null;
    return {
      average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
      count: ratings.length,
    };
  }, [hotel?.reviews, reviews]);

  /** Imported and guest-written reviews in one list, verified stays first. */
  const allReviews = useMemo(() => {
    const written = reviews.map(r => ({
      key: r.id ?? `review-${r.createdAt}`,
      author: r.authorName || 'Guest',
      rating: r.rating,
      text: r.text,
      date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      source: 'Travel-Malawi',
      verified: true,
    }));
    const imported = (hotel?.reviews ?? []).map((r, i) => ({
      key: `imported-${i}`,
      author: r.author || 'Guest',
      rating: r.rating,
      text: r.text,
      date: r.date,
      source: r.source,
      verified: false,
    }));
    return [...written, ...imported];
  }, [hotel?.reviews, reviews]);

  /**
   * Re-verifies availability against live Firestore data immediately before
   * writing a booking, so two guests racing for the last room can't both win.
   *
   * If the read itself is refused — a signed-out guest against rules that
   * require auth to read `bookings` — this deliberately allows the request
   * through. A booking is a request, not a confirmation: the property re-checks
   * inventory before confirming, and refusing every guest checkout because a
   * verification query was denied is by far the worse failure.
   */
  async function checkRoomAvailability(room: RoomType, quantity: number): Promise<boolean> {
    try {
      const snap = await getDocs(query(collection(db, 'bookings'), where('roomTypeId', '==', room.id)));
      const live = snap.docs.map(d => d.data() as BookingLike);
      return isRoomAvailable(room, live, checkIn, checkOut, quantity);
    } catch (error) {
      console.warn('Could not verify live availability; deferring to the property:', error);
      return true;
    }
  }

  const initiateBooking = (room: RoomType) => {
    // Signed-out visitors book as guests; a signed-in account needs the
    // traveller role, which a hotel manager can hold at the same time.
    if (user && !isTraveller(user)) {
      toast.error("This account cannot book rooms. Add a traveller role to book.");
      return;
    }
    if (!isBookable) {
      toast.error("This property is not accepting bookings yet.");
      return;
    }
    if ((room.quantity ?? 0) <= 0) {
      toast.error("This room is currently not available for booking.");
      return;
    }
    if (room.id && !roomAvailability[room.id]?.available) {
      toast.error("This room is fully booked for the selected dates. Try different dates.");
      return;
    }
    // This used to refuse to open the modal when the party was too large, which
    // was a dead end: the guest counter lives inside the modal, so there was no
    // way to reduce the count. Clamp and say so instead.
    if (guestsCount > room.maxGuests) {
      setGuestsCount(room.maxGuests);
      toast(`This room sleeps up to ${room.maxGuests}. Guest count adjusted — book a second room for a larger party.`, { icon: 'ℹ️' });
    }
    setSelectedRoom(room);
    setSelectedPackages([]);
    setFieldErrors({});
    setHoneypot('');
    setFormOpenedAt(Date.now());
  };

  const handleManualBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || saving) return;

    // One validator, so the field hints and the submit check cannot disagree.
    const problems = validateBooking(
      {
        guestName, guestEmail, guestPhone, guestWhatsapp,
        checkIn, checkOut, guests: guestsCount, specialRequests,
      },
      selectedRoom
    );

    if (problems.length > 0) {
      setFieldErrors(errorsByField(problems));
      toast.error(problems[0].message);
      return;
    }
    setFieldErrors({});

    // Spam scoring. Blocking is reserved for signals a person cannot trip by
    // accident; anything softer is accepted and flagged for the property.
    const assessment = assessBooking({
      guestName, guestEmail, guestPhone, guestWhatsapp, specialRequests,
      honeypot,
      elapsedMs: Date.now() - formOpenedAt,
      recentSubmissionTimes: readSubmissionLog(),
    });

    if (assessment.verdict === 'block') {
      console.warn('Booking blocked as spam:', assessment.codes);
      toast.error(
        'This request could not be submitted. If you are a guest, please contact the property directly.',
        { duration: 8000 }
      );
      return;
    }

    setSaving(true);
    setBookingStatus(`Submitting booking request for ${selectedRoom.name}...`);
    try {
      // Availability may have changed while the form was open, so it is
      // re-checked against live data rather than trusting the render-time view.
      const isAvailable = await checkRoomAvailability(selectedRoom, 1);
      if (!isAvailable) {
        toast.error("Sorry, that room was just taken for these dates. Please try different dates.");
        return;
      }

      // Same helper that renders the on-screen breakdown, so the stored total
      // can never disagree with the price the guest was shown.
      const pricing = computeBookingPricing(
        selectedRoom, checkIn, checkOut, guestsCount, 1, selectedPackages, currency
      );
      const reference = makeBookingReference();

      await addDoc(collection(db, 'bookings'), {
        reference,
        hotelId: hotel?.id,
        managerId: hotel?.managerId ?? null,
        roomTypeId: selectedRoom.id,
        guestId: user?.uid || 'anonymous',
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: (guestPhone || '').trim(),
        guestWhatsapp: (guestWhatsapp || '').trim(),
        checkIn,
        checkOut,
        specialRequests: specialRequests.trim(),
        guests: guestsCount,
        quantity: 1,
        total: pricing.total,
        packageIds: selectedPackages,
        extraGuestTotal: pricing.extraGuestTotal,
        packagesTotal: pricing.packagesTotal,
        currency: pricing.currency,
        status: 'pending',
        // Written only when something actually tripped, so the manager sees a
        // warning on the booking rather than having to guess.
        ...(assessment.verdict === 'review'
          ? { flagged: true, flagReasons: assessment.codes, flagScore: assessment.score }
          : {}),
        createdAt: Date.now()
      });

      recordSubmission();

      // The reference is the only handle a signed-out guest has on the booking,
      // so it is surfaced rather than only stored.
      toast.custom(
        (t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-stone-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-4 border border-stone-800`}>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  Booking Requested
                </p>
                <p className="text-sm font-medium text-stone-300 leading-relaxed mb-2">
                  The property will review your stay request and notify you once it's confirmed.
                </p>
                <div className="inline-flex items-center gap-1.5 bg-stone-800/80 px-2.5 py-1 rounded-lg border border-stone-700/50">
                  <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Ref</span>
                  <span className="text-xs font-mono font-bold text-white">{reference}</span>
                </div>
              </div>
            </div>
          </div>
        ),
        { duration: 8000 }
      );
      setSelectedRoom(null);
      // A guest booking without an account has nothing to show on the bookings
      // page, which is traveller-only.
      if (user) navigate('/my-bookings');
    } catch (error) {
      console.error("Booking error:", error);
      toast.error('Failed to submit booking.');
    } finally {
      setSaving(false);
      setBookingStatus(null);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: hotel?.name || 'Travel Malawi',
      text: `Check out ${hotel?.name} in ${hotel?.location} on Travel Malawi!`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
    </div>
  );
  if (!hotel) return <div className="p-20 text-center text-xl font-serif">Property not found.</div>;

  // Falls back to bundled photography when the record has no usable images.
  const hotelImages = getHotelImages(hotel);
  // A single photograph gets the full width rather than a third of the grid.
  const galleryImages = hotelImages.slice(1, 3);
  const hasGallery = galleryImages.length > 0;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Sticky Header when scrolled past hero */}
      <div
        className={`fixed top-20 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/60 shadow-xs transition-transform duration-300 ease-in-out ${
          isScrolledPastHero ? 'translate-y-0' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-16 flex items-center justify-between">
          <h2 className="font-serif text-lg md:text-xl font-bold text-stone-900 tracking-tight truncate pr-4">{hotel.name}</h2>
          <button
            onClick={() => {
              document.getElementById('rooms-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="bg-stone-900 text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest shrink-0 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
          >
            Book Now
          </button>
        </div>
      </div>

      {/* Header image and gallery.
          The layout follows how many photographs a listing actually has.
          It used to be a fixed three-up grid padded with "No additional photo"
          boxes, so a listing with one image gave over half its header to two
          empty grey panels. */}
      <div className="w-full">
        <div className={`grid gap-0 md:h-[68vh] ${hasGallery ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Main image */}
          <div className={`relative rounded-none overflow-hidden h-[46vh] md:h-full group cursor-pointer ${hasGallery ? 'md:col-span-2 md:row-span-2' : ''}`} onClick={() => setShowHotelGallery(true)}>
            <SmartImage src={hotelImages[0]} alt={hotel.name} loading="eager" className="w-full h-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/10 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full p-7 md:p-10 flex justify-between items-end">
              <div>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-white/80 text-sm font-medium mb-3"
                >
                  <MapPin className="h-4 w-4" />
                  {hotel.location}
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={`font-serif font-medium tracking-[-0.02em] text-white leading-[0.95] max-w-3xl
                    ${hasGallery ? 'text-[clamp(2rem,4.5vw,3.75rem)]' : 'text-[clamp(2.25rem,5.5vw,5rem)]'}`}
                >
                  {hotel.name}
                </motion.h1>
              </div>
              
              <div className="hidden md:flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 pointer-events-auto">
                <button 
                  onClick={handleShare}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button 
                  className="bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all"
                >
                  <Images className="h-4 w-4" />
                  {hotelImages.length} Photos
                </button>
              </div>
            </div>
            
            <div className="md:hidden absolute top-4 right-4 flex items-center gap-2 z-10 pointer-events-auto">
              <button 
                onClick={handleShare}
                className="bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button 
                className="bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all"
              >
                <Images className="h-4 w-4" />
                {hotelImages.length}
              </button>
            </div>
          </div>

          {/* Supporting photographs, only when they exist */}
          {galleryImages.map((url, index) => (
            <div key={url} className="relative rounded-none overflow-hidden hidden md:block md:col-span-2 md:row-span-1 group cursor-pointer" onClick={() => setShowHotelGallery(true)}>
              <SmartImage
                src={url}
                alt={`${hotel.name} — photograph ${index + 2}`}
                className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-700 ease-out"
              />
            </div>
          ))}
        </div>

        <div className="max-w-[90rem] mx-auto px-4 lg:px-12">
          {/* A listing awaiting moderation is reachable by direct link, so it says
              plainly that it cannot be booked rather than failing at submit. */}
          {!isBookable && (
            <div className="mt-6 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-6 py-4">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">This property is not taking bookings yet</p>
                <p className="text-sm text-amber-800/80 mt-0.5">
                  {hotel.status === 'rejected'
                    ? 'The listing is not currently published on Travel-Malawi.'
                    : 'The listing is awaiting review by our team. Check back shortly.'}
                </p>
              </div>
            </div>
          )}

          {offeredCurrencies.length > 1 && (
            <div className="mt-6 flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider mr-1">Prices in</span>
              {offeredCurrencies.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => chooseCurrency(code)}
                  aria-pressed={currency === code}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition ${
                    currency === code
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {ratingSummary && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-full">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-semibold">{ratingSummary.average.toFixed(1)}</span>
                </div>
                <span className="text-stone-500 text-sm">
                  {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}
                </span>
              </div>
            )}

            <a
              href="#directions"
              className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2 rounded-full text-sm font-semibold transition"
            >
              <Navigation className="h-4 w-4 text-emerald-600" />
              <span>Get Directions Right Away</span>
            </a>
            <a
              href="#reviews"
              className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2 rounded-full text-sm font-semibold transition"
            >
              <Star className="h-4 w-4 text-emerald-600" />
              <span>Skip to Reviews</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto px-4 lg:px-12 py-24 grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-24">
        <div className="lg:col-span-2">
          <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 tracking-tight">About this property</h2>
          <p className="text-stone-600 text-lg leading-relaxed mb-12">{hotel.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 items-stretch">
            {/* Location & Setting Card with embedded Interactive Map */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between overflow-hidden">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-700 shrink-0" /> Location &amp; Setting
                    </h3>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                      Malawi
                    </span>
                  </div>
                  <p className="text-stone-600 text-sm leading-relaxed">{hotel.location}</p>
                </div>

                {/* Embedded Interactive Map for Location & Setting */}
                <div className="rounded-xl overflow-hidden border border-stone-200 shadow-xs relative isolate bg-stone-100">
                  <InteractiveMap
                    center={resolveHotelCoordinates(hotel)}
                    markerPosition={resolveHotelCoordinates(hotel)}
                    popupText={hotel.name}
                    zoom={13}
                    heightClass="h-44 sm:h-48"
                    interactive={true}
                    showSatelliteToggle={true}
                    showDistanceOverlay={false}
                  />
                </div>

                {hotel.locationNotes && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl">
                    <h4 className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-0.5">Host Notes</h4>
                    <p className="text-amber-800 text-xs leading-relaxed">{hotel.locationNotes}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                <a
                  href="#directions"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-900 bg-stone-50 border border-stone-200 px-3.5 py-2 rounded-xl hover:bg-stone-100 hover:border-stone-300 transition shadow-2xs"
                >
                  <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                  Full Driving Directions
                </a>
                <a
                  href={mapLinkUrl(hotel)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
                >
                  <span>Google Maps</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            
            {/* Stay Policies Card */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col justify-between">
              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" /> Stay Policies
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 uppercase tracking-wide">
                      Verified Rules
                    </span>
                  </div>
                  <p className="text-stone-500 text-xs">Standard house rules and stay guidelines</p>
                </div>

                {/* 2x2 Grid of Compact Policy Blocks */}
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {/* Check-in */}
                  <div className="bg-stone-50/80 border border-stone-200/70 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <LogIn className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Check-in</div>
                      <div className="text-xs font-bold text-stone-900 truncate">From {formatTime(hotel.checkInTime ?? '14:00')}</div>
                    </div>
                  </div>

                  {/* Check-out */}
                  <div className="bg-stone-50/80 border border-stone-200/70 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <LogOut className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Check-out</div>
                      <div className="text-xs font-bold text-stone-900 truncate">Until {formatTime(hotel.checkOutTime ?? '11:00')}</div>
                    </div>
                  </div>

                  {/* Cancellation */}
                  <div className="bg-stone-50/80 border border-stone-200/70 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100/80 text-blue-800 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Cancellation</div>
                      <div className="text-xs font-bold text-emerald-800 truncate">Free 7d prior</div>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="bg-stone-50/80 border border-stone-200/70 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Payment</div>
                      <div className="text-xs font-bold text-stone-900 truncate">Pay at property</div>
                    </div>
                  </div>
                </div>

                {/* Compact Reception Hours */}
                {hasPublishedHours(hotel.hours) && (
                  <div className="bg-stone-50/90 border border-stone-200/80 rounded-xl p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                        <Clock className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                        <span>Reception Hours</span>
                      </div>
                      {isOpenAt(hotel.hours) === true ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                          Open now
                        </span>
                      ) : isOpenAt(hotel.hours) === false ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded-full">
                          Closed now
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      {summariseHours(hotel.hours!).map(row => (
                        <div key={row.label} className="flex justify-between items-center text-stone-600">
                          <span className="font-medium text-stone-500">{row.label}</span>
                          <span className="font-semibold text-stone-900">{row.hours}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3.5 mt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span className="truncate">Special requests &amp; custom arrival times can be arranged</span>
              </div>
            </div>
          </div>

          {/* Reaching the property */}
          {hasAnyContact(hotel) && (
            <div className="mb-12 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-emerald-700" /> Reach the property directly
                    </h3>
                    <span 
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border ${
                        hotel.isOnline !== false 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${hotel.isOnline !== false ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
                      {hotel.isOnline !== false ? 'Host Online' : 'Host Away'}
                    </span>
                  </div>
                  <p className="text-stone-500 text-xs">
                    Contact {hotel.name} hosts directly for special inquiries, activities, or arrival updates.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {hotel.chatEnabled !== false && (
                    <button
                      type="button"
                      onClick={() => openInquiryChat(hotel)}
                      className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800 shadow-2xs cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{hotel.isOnline !== false ? 'Live Host Chat' : 'Leave a Message'}</span>
                    </button>
                  )}
                  {telLink(hotel.contactPhone) && (
                    <a
                      href={telLink(hotel.contactPhone)!}
                      className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-800 border border-stone-200 transition hover:bg-stone-200 shadow-2xs"
                    >
                      <PhoneCall className="h-3.5 w-3.5" /> {hotel.contactPhone}
                    </a>
                  )}
                  {whatsappLink(hotel.contactWhatsapp || hotel.contactPhone, `Hello ${hotel.name}, I have a question about staying with you.`) && (
                    <a
                      href={whatsappLink(hotel.contactWhatsapp || hotel.contactPhone, `Hello ${hotel.name}, I have a question about staying with you.`)!}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-2xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {mailtoLink(hotel.contactEmail, `Enquiry about ${hotel.name}`) && (
                    <a
                      href={mailtoLink(hotel.contactEmail, `Enquiry about ${hotel.name}`)!}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200 transition hover:ring-stone-400 shadow-2xs"
                    >
                      <Mail className="h-3.5 w-3.5" /> {hotel.contactEmail}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <h2
            id="rooms-section"
            className="text-4xl md:text-5xl font-serif text-stone-900 mb-10 tracking-tight"
          >
            Available Rooms
          </h2>
          {rooms.length === 0 ? (
            <p className="text-stone-500 italic">No rooms available at the moment.</p>
          ) : (
            <div className="flex overflow-x-auto md:flex-col gap-4 md:gap-6 mb-24 pb-6 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory scrollbar-none">
              {rooms.map((room) => {
                const status = room.id ? roomAvailability[room.id] : undefined;
                const roomDisplayCurrency = resolveCurrency(room, currency);
                const isSoldOut = status ? !status.available : (room.quantity ?? 0) <= 0;
                const hasDates = !!checkIn && !!checkOut && checkIn < checkOut;
                return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-[85vw] sm:w-[400px] md:w-full shrink-0 snap-center flex flex-col md:flex-row md:items-start gap-5 p-4 bg-white border border-stone-200 rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  <div className="w-full md:w-2/5 lg:w-1/3 aspect-[4/3] overflow-hidden rounded-[16px] relative shrink-0 group">
                    <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none">
                      {[getRoomImage(room, hotel), ...(room.galleryUrls || [])].map((imgUrl, i) => (
                        <div key={i} className="min-w-full h-full shrink-0 snap-center relative">
                          <SmartImage
                            src={imgUrl}
                            alt={`${room.name} photo ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    
                    {((room.galleryUrls || []).length > 0) && (
                      <div className="absolute bottom-3 right-3 bg-stone-900/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm z-10 pointer-events-none">
                        <Images className="h-3 w-3" />
                        Swipe for more
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full md:w-3/5 lg:w-2/3 flex flex-col justify-between py-1 pr-1 md:pr-2">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                        <h3 className="text-2xl md:text-3xl font-serif text-stone-900 tracking-tight leading-none">{room.name}</h3>
                        <div className="flex items-center gap-2 text-stone-700 bg-stone-50 px-3 py-1.5 rounded-full text-xs font-semibold border border-stone-200 shadow-xs">
                          <Users className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> 
                          <span>Max {room.maxGuests}</span>
                        </div>
                      </div>
                      
                      <p className="text-stone-500 text-sm leading-relaxed mb-5 font-light line-clamp-3 md:line-clamp-4">{room.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        {isSoldOut ? (
                          <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-xs font-bold border border-red-100">
                            <Info className="h-3.5 w-3.5" />
                            <span>{hasDates ? 'Sold out for these dates' : 'Not available'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{status?.remaining != null ? status.remaining : room.quantity} Available</span>
                          </div>
                        )}
                        {room.packages && room.packages.length > 0 && room.packages.map(pkg => (
                          <span key={pkg.id} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-[11px] font-semibold tracking-wide border border-stone-200 flex items-center gap-1">
                            <Plus className="w-3 h-3 text-stone-400" />
                            {pkg.name}
                            {(() => {
                              const amount = packagePrice(pkg, roomDisplayCurrency, roomPrimaryCurrency(room));
                              return amount && amount > 0 ? ` (${formatMoney(amount, roomDisplayCurrency)})` : '';
                            })()}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-4 pt-4 border-t border-stone-100">
                      <div>
                        <span className="text-stone-400 tracking-widest uppercase text-[9px] font-bold block mb-1">From</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-serif text-stone-900 tracking-tight">
                            {formatMoney(roomPrice(room, roomDisplayCurrency) ?? 0, roomDisplayCurrency)}
                          </span>
                          <span className="text-stone-500 uppercase text-[10px] font-bold">/ night</span>
                        </div>
                        {roomCurrencies(room).filter(c => c !== roomDisplayCurrency).map(code => (
                          <div key={code} className="text-xs text-stone-400 mt-1 font-medium">
                            or {formatMoney(roomPrice(room, code) ?? 0, code)} / night
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => initiateBooking(room)}
                        disabled={isSoldOut || !isBookable}
                        className="bg-stone-900 text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-emerald-700 active:scale-95 transition-all duration-300 disabled:bg-stone-300 disabled:hover:bg-stone-300 disabled:active:scale-100 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                      >
                        {isSoldOut ? 'Unavailable' : 'Reserve'}
                      </button>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </div>
          )}

          {/* Availability Calendar */}
          <div className="mb-16">
            <AvailabilityCalendar
              hotelId={id!}
              rooms={rooms}
              onDateSelect={(date) => {
                setCheckIn(date);
                document.getElementById('rooms-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </div>

                    {/* Restaurant Menu */}
          {restaurant && (
            <div className="lg:col-span-3 mb-24 pt-8 border-t border-stone-200">
              <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-10 tracking-tight">Restaurant & Menu</h2>
              {hasPublishedHours(restaurant.hours) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 text-sm">
                  <span className="flex items-center gap-2 text-stone-500">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold text-stone-700">Kitchen</span>
                  </span>
                  {summariseHours(restaurant.hours!).map(row => (
                    <span key={row.label} className="text-stone-600">
                      <span className="text-stone-400">{row.label}</span> {row.hours}
                    </span>
                  ))}
                  {isOpenAt(restaurant.hours) === true && (
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                      Serving now
                    </span>
                  )}
                </div>
              )}
              <MenuTemplateView
                restaurant={restaurant}
                currency={currency}
              />
            </div>
          )}

          <div id="reviews" className="mb-24 mt-8 border-t border-stone-200 pt-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div className="flex flex-wrap items-baseline gap-4">
                <h2 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-tight">Guest Reviews</h2>
                {ratingSummary && (
                  <span className="text-stone-500 text-lg">
                    {ratingSummary.average.toFixed(1)} average from {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-full text-sm font-bold transition shadow-sm self-start sm:self-auto"
              >
                <Star className="h-4 w-4" />
                Write a Review
              </button>
            </div>
            
            {allReviews.length === 0 ? (
              <p className="text-stone-500 italic">No reviews yet. Be the first to review this property!</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6">
                  {allReviews.slice((currentReviewPage - 1) * reviewsPerPage, currentReviewPage * reviewsPerPage).map(review => (
                    <div key={review.key} className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-600 font-serif font-bold text-lg">
                            {review.author.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-900">{review.author}</p>
                            <p className="text-sm text-stone-500">{review.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-stone-50 px-3 py-1.5 rounded-full">
                          <Star className="h-4 w-4 fill-current text-stone-900" />
                          <span className="font-semibold text-stone-900">{review.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-stone-700 leading-relaxed italic">"{review.text}"</p>
                      {/* Only a review written from a completed booking on this
                          platform can claim a verified stay; imported ones say
                          where they came from instead. */}
                      {review.verified ? (
                        <p className="text-xs text-emerald-700 mt-4 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4" /> Verified stay
                        </p>
                      ) : (
                        <p className="text-xs text-stone-400 mt-4 uppercase tracking-wider font-semibold">
                          Imported from {review.source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {allReviews.length > reviewsPerPage && (
                  <Pagination
                    currentPage={currentReviewPage}
                    totalPages={Math.ceil(allReviews.length / reviewsPerPage)}
                    onPageChange={setCurrentReviewPage}
                  />
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Sticky Sidebar / Highlights */}
        <div className="relative">
          <div className="sticky top-28 bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Property Highlights
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">Key amenities & features offered</p>
            </div>
            <ul className="space-y-3">
              {hotel.amenities && hotel.amenities.length > 0 ? (
                hotel.amenities.map((amenity, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-stone-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                    <span className="leading-snug">{amenity}</span>
                  </li>
                ))
              ) : (
                <li className="text-stone-500 text-xs">Standard amenities included.</li>
              )}
            </ul>
          </div>
        </div>
          {/* Full Directions & Navigation Panel for Guests */}
          <div className="lg:col-span-3 mb-24 pt-8 border-t border-stone-200">
            <div className="mb-8">
              <span className="text-[0.68rem] font-bold text-emerald-700 tracking-[0.16em] uppercase">Find Your Way</span>
              <h2 className="text-3xl md:text-4xl font-serif text-stone-900 mt-1 tracking-tight">Location &amp; Driving Directions</h2>
              <p className="text-stone-500 text-base mt-2">
                Turn-by-turn navigation launchers, travel distance estimator, and interactive map for {hotel.name}.
              </p>
            </div>
            <DirectionsPanel
              hotelName={hotel.name}
              location={hotel.location}
              coordinates={hotel.coordinates}
              locationNotes={hotel.locationNotes}
            />
          </div>

      </div>
      
      {/* Booking request */}
      {selectedRoom && (() => {
        const pricing = computeBookingPricing(
          selectedRoom, checkIn, checkOut, guestsCount, 1, selectedPackages, currency
        );
        const {
          nights, basePrice, extraGuestFee, extraGuestsCount, packagesTotal,
          total: grandTotal, currency: bookingCurrency,
        } = pricing;
        const roomPrimary = roomPrimaryCurrency(selectedRoom);

        return (
          <Modal
            open
            onClose={() => setSelectedRoom(null)}
            title={`Reserve · ${selectedRoom.name}`}
            description="Send your dates and details. Payment is settled at the property once they confirm."
            size="lg"
            footer={
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[0.7rem] font-semibold text-stone-400 uppercase tracking-wider">
                    {nights > 0 ? `Total · ${nights} night${nights === 1 ? '' : 's'}` : 'Total'}
                  </p>
                  {nights > 0 ? (
                    <p className="font-serif text-2xl font-semibold text-stone-900 leading-tight">
                      {formatMoney(grandTotal, bookingCurrency)}
                    </p>
                  ) : (
                    // A zero total reads as "free" rather than "not priced yet".
                    <p className="text-sm text-stone-500 leading-tight mt-1">Choose your dates</p>
                  )}
                </div>
                {/* Only disabled while the write is in flight. Disabling it for
                    missing dates left a dead button with no explanation, and
                    pre-empted the validation that would have said which field. */}
                <button
                  type="submit"
                  form="booking-form"
                  disabled={saving}
                  className="shrink-0 bg-stone-900 text-white px-7 py-3.5 rounded-full font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Submitting…' : 'Request booking'}
                </button>
              </div>
            }
          >
            <form id="booking-form" onSubmit={handleManualBook} className="space-y-5" noValidate>
              {/* Hidden from sight and from screen readers, and never focusable.
                  Anything that fills it in is not a person. */}
              <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="company-website">Do not fill this in</label>
                <input
                  id="company-website"
                  name="company-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Guest name</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  aria-invalid={!!fieldErrors.guestName}
                  className={`${fieldClass} ${fieldErrors.guestName ? 'border-red-400 focus:border-red-500' : ''}`}
                  placeholder="Full name"
                />
                {fieldErrors.guestName && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestName}</p>}
              </div>

              <div>
                <label className={labelClass}>Email <span className="text-stone-400 font-normal">· optional</span></label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.guestEmail}
                  className={`${fieldClass} ${fieldErrors.guestEmail ? 'border-red-400 focus:border-red-500' : ''}`}
                  placeholder="you@example.com"
                />
                {fieldErrors.guestEmail && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestEmail}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone number</label>
                  <PhoneInput
                    international
                    defaultCountry="MW"
                    value={guestPhone}
                    onChange={(val) => setGuestPhone(val || '')}
                    className={`${fieldClass} ${fieldErrors.guestPhone ? 'border-red-400 focus:border-red-500' : ''} !flex items-center`}
                  />
                  {fieldErrors.guestPhone && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestPhone}</p>}
                </div>
                <div>
                  <label className={labelClass}>WhatsApp <span className="text-stone-400 font-normal">· optional</span></label>
                  <PhoneInput
                    international
                    defaultCountry="MW"
                    value={guestWhatsapp}
                    onChange={(val) => setGuestWhatsapp(val || '')}
                    className={`${fieldClass} ${fieldErrors.guestWhatsapp ? 'border-red-400 focus:border-red-500' : ''} !flex items-center`}
                  />
                  {fieldErrors.guestWhatsapp && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestWhatsapp}</p>}
                </div>
              </div>

              <div className="mb-4">
                  <label className={labelClass}>Stay Dates</label>
                  <DatePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    isDateBlocked={(dateStr) => {
                      if (!selectedRoom) return false;
                      const nextDay = new Date(dateStr);
                      nextDay.setDate(nextDay.getDate() + 1);
                      const nextDayStr = nextDay.toISOString().split('T')[0];
                      return unitsRemaining(selectedRoom, bookings, dateStr, nextDayStr) === 0;
                    }}
                    onSelect={(inDate, outDate) => {
                      setCheckIn(inDate);
                      setCheckOut(outDate);
                      setFieldErrors(prev => {
                        const next = {...prev};
                        delete next.checkIn;
                        delete next.checkOut;
                        return next;
                      });
                    }}
                    
                  />
                  {(fieldErrors.checkIn || fieldErrors.checkOut) && (
                    <p className="text-xs text-red-600 mt-1.5">{fieldErrors.checkIn || fieldErrors.checkOut}</p>
                  )}
                </div>

              <div>
                <label className={labelClass}>Guests</label>
                <div className={`flex items-center justify-between bg-stone-50 border rounded-xl px-4 py-2.5 ${
                  fieldErrors.guests ? 'border-red-400' : 'border-stone-200'
                }`}>
                  <span className="text-sm text-stone-600">
                    {guestsCount} guest{guestsCount !== 1 ? 's' : ''}
                    <span className="text-stone-400"> · sleeps {selectedRoom.maxGuests}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Fewer guests"
                      disabled={guestsCount <= 1}
                      onClick={() => setGuestsCount(Math.max(1, guestsCount - 1))}
                      className="h-8 w-8 grid place-items-center rounded-full border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 disabled:hover:border-stone-300 transition"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{guestsCount}</span>
                    <button
                      type="button"
                      aria-label="More guests"
                      disabled={guestsCount >= selectedRoom.maxGuests}
                      onClick={() => setGuestsCount(Math.min(selectedRoom.maxGuests, guestsCount + 1))}
                      className="h-8 w-8 grid place-items-center rounded-full border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 disabled:hover:border-stone-300 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Special requests <span className="text-stone-400 font-normal">· optional</span></label>
                <textarea
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                  maxLength={MAX_SPECIAL_REQUESTS}
                  placeholder="Early check-in, dietary requirements, an occasion we should know about…"
                  className={`${fieldClass} resize-none h-24 ${fieldErrors.specialRequests ? 'border-red-400' : ''}`}
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-red-600">{fieldErrors.specialRequests ?? ''}</span>
                  {specialRequests.length > MAX_SPECIAL_REQUESTS * 0.8 && (
                    <span className="text-xs text-stone-400 tabular-nums">
                      {specialRequests.length}/{MAX_SPECIAL_REQUESTS}
                    </span>
                  )}
                </div>
              </div>

              {selectedRoom.packages && selectedRoom.packages.length > 0 && (
                <div>
                  <label className={labelClass}>Enhance your stay</label>
                  <div className="grid gap-2">
                    {selectedRoom.packages.map(pkg => {
                      const checked = selectedPackages.includes(pkg.id);
                      const amount = packagePrice(pkg, bookingCurrency, roomPrimary);
                      // A package the property never priced in this currency
                      // cannot be sold in it, so it is offered as unavailable
                      // rather than converted at a rate nobody set.
                      const unavailable = amount === null;
                      return (
                        <label
                          key={pkg.id}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                            unavailable
                              ? 'border-stone-200 bg-stone-50/60 opacity-60 cursor-not-allowed'
                              : checked
                                ? 'border-stone-900 bg-stone-50 cursor-pointer'
                                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/60 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                            checked={checked && !unavailable}
                            disabled={unavailable}
                            onChange={e => {
                              if (e.target.checked) setSelectedPackages([...selectedPackages, pkg.id]);
                              else setSelectedPackages(selectedPackages.filter(id => id !== pkg.id));
                            }}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-stone-900">{pkg.name}</span>
                            <span className="block text-xs text-stone-500">
                              {unavailable
                                ? `Not available in ${bookingCurrency}`
                                : <>
                                    {amount > 0 ? `+${formatMoney(amount, bookingCurrency)}` : 'Included'}
                                    {pkg.type === 'per_person' ? ' per person, per night' : pkg.type === 'per_room' ? ' per room, per night' : ' per stay'}
                                  </>}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5">
                <div className="border-b border-stone-200 pb-3 mb-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Price breakdown</h3>
                    {nights > 0 && (
                      <p className="text-xs text-stone-400">
                        {formatDateStr(checkIn, { month: 'short', day: 'numeric' })} &rarr; {formatDateStr(checkOut, { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {/* Switching here re-prices from the amounts the property
                      authored in that currency, not by converting this total. */}
                  {roomCurrencies(selectedRoom).length > 1 && (
                    <div className="flex gap-1 mt-3">
                      {roomCurrencies(selectedRoom).map(code => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => chooseCurrency(code)}
                          aria-pressed={bookingCurrency === code}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                            bookingCurrency === code
                              ? 'bg-stone-900 text-white'
                              : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {nights === 0 ? (
                  <p className="text-sm text-stone-500">Pick your dates to see the total.</p>
                ) : (
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between text-stone-600">
                      <span>{formatMoney(basePrice, bookingCurrency)} &times; {nights} night{nights === 1 ? '' : 's'}</span>
                      <span className="text-stone-900 tabular-nums">{formatMoney(basePrice * nights, bookingCurrency)}</span>
                    </div>

                    {extraGuestsCount > 0 && extraGuestFee > 0 && (
                      <div className="flex justify-between text-stone-600">
                        <span>Extra guests ({extraGuestsCount} &times; {formatMoney(extraGuestFee, bookingCurrency)} &times; {nights}n)</span>
                        <span className="text-stone-900 tabular-nums">{formatMoney(extraGuestsCount * extraGuestFee * nights, bookingCurrency)}</span>
                      </div>
                    )}

                    {packagesTotal > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Selected packages</span>
                        <span className="tabular-nums">+{formatMoney(packagesTotal, bookingCurrency)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-baseline border-t border-stone-200 pt-3 mt-3">
                      <span className="font-semibold text-stone-900">Total</span>
                      <div className="text-right">
                        <div className="font-serif text-xl font-semibold text-stone-900 tabular-nums">
                          {formatMoney(grandTotal, bookingCurrency)}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          Payable in {CURRENCIES[bookingCurrency].label}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="flex items-start gap-2 text-xs text-stone-500 leading-relaxed">
                <Info className="h-4 w-4 shrink-0 mt-px text-stone-400" />
                Sending this reserves nothing yet — the property reviews every request and confirms by phone or WhatsApp. Free cancellation up to 7 days before arrival.
              </p>
            </form>
          </Modal>
        );
      })()}

      {bookingStatus && !anyDialogOpen && (
        <div className="fixed bottom-24 right-6 bg-stone-900 text-white px-8 py-4 rounded-full shadow-2xl font-medium z-50">
          {bookingStatus}
        </div>
      )}
      
      {/* Floating Chat Trigger Button.
          Hidden whenever a dialog is up or when chat is already open/active in the global persistent dock. */}
      {hotel.chatEnabled !== false && !anyDialogOpen && !activeChat && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          <button
            type="button"
            id="btn-contact-host-floating"
            onClick={() => openInquiryChat(hotel)}
            className="bg-stone-900 text-white px-5 py-3.5 rounded-full shadow-2xl hover:bg-stone-800 transition-all hover:scale-105 flex items-center gap-2.5 border border-stone-700/60 cursor-pointer"
          >
            <div className="relative flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <span 
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-stone-900 ${
                  hotel.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
                }`} 
              />
            </div>
            <div className="text-left">
              <span className="font-bold text-xs block whitespace-nowrap">
                Contact Host
              </span>
              <span className="text-[10px] text-stone-300 block -mt-0.5 whitespace-nowrap">
                {hotel.isOnline !== false ? 'Online now' : 'Leave a message'}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Review Modal */}
      {hotel.id && (
        <ReviewModal
          hotelId={hotel.id}
          open={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onReviewSubmitted={() => {
            // Force a refresh of the page to show the new review, 
            // since the reviews effect runs on mount/id change.
            window.location.reload();
          }}
        />
      )}

      {/* Room Gallery Modal */}
      {activeGalleryRoom && (
        <Lightbox
          images={[activeGalleryRoom.imageUrl, ...(activeGalleryRoom.galleryUrls || [])].filter(Boolean) as string[]}
          onClose={() => setActiveGalleryRoom(null)}
        />
      )}

      {/* Hotel Gallery Modal */}
      {showHotelGallery && (
        <Lightbox
          images={hotelImages}
          onClose={() => setShowHotelGallery(false)}
        />
      )}
    </div>
  );
}
