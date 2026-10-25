import { getActivePromotion, calculateSlashedPrice, getSaleTypeLabel, getAllActivePromotions } from '../lib/promotions';
import PromotionIcon from '../components/PromotionIcon';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, collection, query, where, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { createBookingWithSlot } from '../lib/bookingWrites';
import { loadHotelSlots, loadRoomSlots } from '../lib/transactions';
import { malawiToday } from '../lib/promotions';
import { db } from '../lib/firebase';
import { Hotel, RoomType, ConferenceRoom, Review, CurrencyCode, Broadcast } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import SEOHead from '../components/SEOHead';
import { useChatModal } from '../contexts/ChatModalContext';
import { usePlatformMode } from '../contexts/PlatformModeContext';
import { useManagerPresence, PresenceStatus } from '../hooks/usePresence';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { MapPin, Megaphone, Calendar, Users, Star, CheckCircle2, ChevronDown, Compass, Info, Plus, Minus, ShieldCheck, AlertTriangle, UtensilsCrossed, Clock, BedDouble, MessageSquare, MessageCircle, Images, Mail, PhoneCall, Navigation, CreditCard, LogIn, LogOut, Share, Share2, Zap, Droplets, Map, Wifi, HardDrive, Monitor, Building, ExternalLink, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { saveOfflineBooking } from '../lib/offlineBookingsDB';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { motion } from 'motion/react';
import Pagination from '../components/Pagination';
import SmartImage from '../components/SmartImage';
import DirectionsPanel from '../components/DirectionsPanel';
import FormattedDescription from '../components/FormattedDescription';
import { ReviewModal } from '../components/ReviewModal';
import { useBreadcrumbLabel } from '../components/Breadcrumbs';
import WalkthroughTooltip from '../components/WalkthroughTooltip';
import MaskedPlaceName from '../components/MaskedPlaceName';
import { getHotelImage, getHotelImages, getRoomImage } from '../lib/images';
import { addDays, formatDateStr, nightsBetween, todayStr } from '../lib/dates';
import { formatTime, hasPublishedHours, isOpenAt, summariseHours } from '../lib/hours';
import MenuTemplateView from '../components/MenuTemplates';
import { BookingLike, isRoomAvailable, unitsRemaining, normalizeBlockedDates } from '../lib/availability';
import { hasAnyContact, mailtoLink, telLink, whatsappLink } from '../lib/contact';
import { hasSocialLinks } from '../lib/social';
import SocialLinks from '../components/SocialLinks';
import { resolveHotelCoordinates, isValidLatLng } from '../lib/geo';
import { getSingleCachedHotel, saveSingleCachedHotel, getCachedRooms } from '../lib/mapCache';
import DatePicker from '../components/DatePicker';
import { computeBookingPricing, entirePlaceRoom, formatMoney, makeBookingReference } from '../lib/booking';
import { isTraveller, isAdmin, isHotelManager, isMarketing } from '../lib/roles';
import { logSystemEvent } from '../lib/logger';
import { validateBooking, errorsByField, BookingField, MAX_SPECIAL_REQUESTS } from '../lib/validateBooking';
import { assessBooking, readSubmissionLog, recordSubmission } from '../lib/spam';
import {
  CURRENCIES, currenciesForRooms, packagePrice, readStoredCurrency, resolveCurrency,
  roomCurrencies, roomPrice, roomPrimaryCurrency, storeCurrency, onCurrencyChange,
} from '../lib/currency';
import Modal from '../components/Modal';
import Lightbox from '../components/Lightbox';
import PriceDisplay from '../components/PriceDisplay';
import RoomGallery from '../components/RoomGallery';
import { useWhatsAppSettings } from '../hooks/useWhatsAppSettings';
import { parseReviewDateToTimestamp, formatReviewDate, sanitizeReviewSourceUrl, getReviewSourceLabel, isBrokenOrFakeReviewUrl } from '../lib/reviewDates';
import { PageLoading } from '../components/Loading';

interface CompactReviewItem {
  key: string;
  author: string;
  rating: number;
  title?: string;
  text: string;
  date: string;
  timestamp?: number;
  source: string;
  sourceUrl?: string;
  verified: boolean;
}

function CompactReviewCard({ review, hotelName, hotelLocation }: { review: CompactReviewItem; hotelName?: string; hotelLocation?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textLength = (review.text || '').length;
  // Consider long if body text exceeds 120 characters or if has title and exceeds 90 chars
  const isLong = textLength > 120 || (Boolean(review.title) && textLength > 90);

  const isGuestBook = (review.source || '').toLowerCase().includes('guest book') || (review.source || '').toLowerCase().includes('guestbook');

  // URL integrity: Never display broken, fake, or bare root URLs.
  // If invalid or empty, synthesize guaranteed authentic search/verification query URL on that platform.
  const cleanUrl = isGuestBook
    ? undefined
    : review.sourceUrl && !isBrokenOrFakeReviewUrl(review.sourceUrl)
    ? review.sourceUrl
    : sanitizeReviewSourceUrl(review.sourceUrl, review.source, hotelName, hotelLocation);

  const sourceLabel = getReviewSourceLabel(review.source);

  const handleCardClick = (e: React.MouseEvent) => {
    if (!isLong) return;
    const target = e.target as HTMLElement;
    // Don't toggle if user clicked an explicit link or button with its own handler
    if (target.closest('a, button, input, textarea')) return;
    // If text is being highlighted/selected, do not toggle
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return;
    setIsExpanded(prev => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isLong) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded(prev => !prev);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role={isLong ? 'button' : undefined}
      tabIndex={isLong ? 0 : undefined}
      aria-expanded={isLong ? isExpanded : undefined}
      title={isLong ? (isExpanded ? 'Click to show less' : 'Click to see more details') : undefined}
      className={`bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200/90 shadow-2xs transition-all duration-200 flex flex-col justify-between ${
        isLong ? 'cursor-pointer hover:border-stone-300 hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-stone-400/40 select-text' : ''
      }`}
    >
      <div>
        {/* Header: Author & Rating */}
        <div className="flex justify-between items-start mb-2 sm:mb-2.5 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-stone-100 rounded-full flex items-center justify-center text-stone-700 font-serif font-bold text-xs shrink-0 border border-stone-200/60">
              {review.author ? review.author.charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-stone-900 text-xs sm:text-sm truncate leading-snug">{review.author}</p>
              <p className="text-[10px] sm:text-[11px] text-stone-500 leading-none mt-0.5">{review.date}</p>
            </div>
          </div>
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border shrink-0 text-xs font-bold ${
              review.rating >= 4
                ? 'bg-stone-50 border-stone-200/80 text-stone-900'
                : review.rating >= 3
                ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <Star
              className={`h-3 w-3 fill-current ${
                review.rating >= 4 ? 'text-amber-400' : review.rating >= 3 ? 'text-amber-500' : 'text-rose-500'
              }`}
            />
            <span>{review.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Title */}
        {review.title && (
          <h4 className={`font-serif font-bold text-stone-900 text-xs sm:text-sm mb-1 leading-snug ${isExpanded ? '' : 'line-clamp-1'}`}>
            "{review.title}"
          </h4>
        )}

        {/* Body Text */}
        <p className={`text-stone-700 leading-relaxed italic text-xs sm:text-sm transition-all duration-200 ${
          isLong && !isExpanded ? 'line-clamp-2' : ''
        }`}>
          "{review.text}"
        </p>

        {/* Toggle Button */}
        {isLong && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(prev => !prev);
            }}
            className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-stone-900 hover:text-emerald-800 underline underline-offset-2 decoration-stone-300 hover:decoration-stone-600 mt-1.5 cursor-pointer select-none transition"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Show less' : 'See more details'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Footer: Attribution, Badges & Verification Link */}
      <div className="mt-2.5 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-[11px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {review.verified ? (
            <span className="text-emerald-700 uppercase tracking-wider font-semibold flex items-center gap-1 text-[10px]">
              <ShieldCheck className="h-3 w-3 shrink-0" /> Verified stay
            </span>
          ) : isGuestBook ? (
            <span className="text-stone-600 uppercase tracking-wider font-semibold text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Lodge Reception Guest Book
            </span>
          ) : (
            <span className="text-stone-500 uppercase tracking-wider font-semibold text-[10px]">
              Imported from {review.source}
            </span>
          )}
          {review.rating <= 2.5 && (
            <span className="font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider">
              Transparent Critique
            </span>
          )}
          {review.rating > 2.5 && review.rating <= 3.8 && (
            <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider">
              Constructive Feedback
            </span>
          )}
        </div>

        {cleanUrl && !isGuestBook && (
          <a
            href={cleanUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold transition hover:underline text-[10px] sm:text-[11px]"
            title={`Verify on ${review.source}`}
          >
            <span>{sourceLabel}</span>
            <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function HotelDetails() {
  const { whatsappEnabled } = useWhatsAppSettings();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();
  const { openInquiryChat, activeChat } = useChatModal();
  // Directory mode (the default) switches off every booking flow and in-app
  // chat: the page becomes a listing with the property's own contact details.
  const { bookingsEnabled } = usePlatformMode();

  const handleOpenChat = () => {
    if (!hotel || !bookingsEnabled) return;
    if (!user) {
      openAuth();
      return;
    }
    openInquiryChat(hotel);
  };

  const { isOnline } = useNetworkStatus();
  const [hotel, setHotel] = useState<Hotel | null>(() => (id ? getSingleCachedHotel(id) : null));
  const managerPresence = useManagerPresence(bookingsEnabled ? hotel?.managerId : undefined);
  // The host's own "Show as online" switch wins over activity: set to away, they read as away.
  const hostStatus: PresenceStatus = !managerPresence
    ? 'offline'
    : managerPresence.status === 'online' && hotel?.isOnline === false ? 'away' : managerPresence.status;
  // Chat is offered whether or not the host is online; offline hosts get the message by email.
  const canChat = Boolean(bookingsEnabled && hotel && hotel.chatEnabled !== false && hotel.adminChatEnabled !== false && user?.uid !== hotel.managerId);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [conferenceRooms, setConferenceRooms] = useState<ConferenceRoom[]>([]);
  const [activeSpaceTab, setActiveSpaceTab] = useState<'rooms' | 'conferences'>('rooms');
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(() => !id || !getSingleCachedHotel(id));
  const [saving, setSaving] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeGalleryRoom, setActiveGalleryRoom] = useState<RoomType | null>(null);
  const [showHotelGallery, setShowHotelGallery] = useState(false);
  const [hotelGalleryInitialIndex, setHotelGalleryInitialIndex] = useState(0);
  const [mobileHeroIdx, setMobileHeroIdx] = useState(0);
  const mobileHeroScrollRef = useRef<HTMLDivElement>(null);
  const heroTouchStartX = useRef<number | null>(null);
  const heroTouchStartY = useRef<number | null>(null);
  const heroTouchDeltaX = useRef<number>(0);
  const heroIsHorizontal = useRef<boolean | null>(null);
  const heroHasDragged = useRef<boolean>(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [adultsCount, setAdultsCount] = useState(() => {
    const parsed = parseInt(searchParams.get('adults') ?? searchParams.get('guests') ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
  });
  const [childrenCount, setChildrenCount] = useState(() => {
    const parsed = parseInt(searchParams.get('children') ?? '', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });
  const [guestsCount, setGuestsCount] = useState(() => {
    const parsed = parseInt(searchParams.get('guests') ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
  });

  useEffect(() => {
    setGuestsCount(adultsCount + childrenCount);
  }, [adultsCount, childrenCount]);
  const [guestName, setGuestName] = useState(user?.displayName || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [currentReviewPage, setCurrentReviewPage] = useState(1);
  const [reviewSort, setReviewSort] = useState<'recent' | 'highest' | 'critical'>('recent');
  const reviewsPerPage = 6;
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>(readStoredCurrency);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BookingField, string>>>({});

  useEffect(() => {
    return onCurrencyChange(setCurrency);
  }, []);
  // A field positioned off-screen and hidden from assistive technology. No
  // person can fill it in; something submitting the form blindly will.
  const [honeypot, setHoneypot] = useState('');
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);
  const [isDirectionsOpenMobile, setIsDirectionsOpenMobile] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show when scrolled past roughly the hero image
      setIsScrolledPastHero(window.scrollY > 400);
    };
    const handleOutsideClick = (e: MouseEvent) => {
      const details = document.getElementById('sticky-quick-nav-details') as HTMLDetailsElement | null;
      if (details && details.open && !details.contains(e.target as Node)) {
        details.removeAttribute('open');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleOutsideClick);
    };
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
      } else {
        const cached = getSingleCachedHotel(id);
        if (cached) setHotel(cached);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to hotel details:", error);
      const cached = getSingleCachedHotel(id);
      if (cached) {
        setHotel(cached);
        toast('Viewing cached offline details', { icon: '📡' });
      }
      setLoading(false);
    });

    async function fetchRooms() {
      try {
        const [roomDocs, confDocs] = await Promise.all([
          getDocs(query(collection(db, 'room_types'), where('hotelId', '==', id))),
          getDocs(query(collection(db, 'conference_rooms'), where('hotelId', '==', id)))
        ]);
        setRooms(roomDocs.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
        setConferenceRooms(confDocs.docs.map(d => ({ id: d.id, ...d.data() } as ConferenceRoom)));
      } catch (error) {
        console.error("Error fetching rooms:", error);
        const cachedRooms = getCachedRooms().filter(r => r.hotelId === id);
        if (cachedRooms.length > 0) {
          setRooms(cachedRooms);
        }
      }
    }
    fetchRooms();

    return () => unsubHotel();
  }, [id]);

  // Live occupancy. Without it the page still sells rooms — it just falls back
  // to the manager's stated inventory, and the final pre-write check catches a
  // clash.
  useEffect(() => {
    if (!id || !bookingsEnabled) return;
    // Public inventory mirror: bookings themselves are private to the guest,
    // the manager and admins.
    loadHotelSlots(id)
      .then(slots => setBookings(slots))
      .catch(err => console.warn('Live availability unavailable:', err?.message ?? err));
  }, [id, bookingsEnabled]);

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

  const [hasStayBooking, setHasStayBooking] = useState(false);

  // Broadcasts are strictly for logged-in guests who have a booking with this stay (or the property manager)
  useEffect(() => {
    if (!user || !id) {
      setHasStayBooking(false);
      setBroadcasts([]);
      return;
    }

    if (hotel && hotel.managerId === user.uid) {
      setHasStayBooking(true);
      return;
    }
    // No booking listener in directory mode; property notices reach the manager only.
    if (!bookingsEnabled) {
      setHasStayBooking(false);
      return;
    }

    const q = query(
      collection(db, 'bookings'),
      where('guestId', '==', user.uid),
      where('hotelId', '==', id),
      where('status', 'in', ['pending', 'confirmed'])
    );

    const unsub = onSnapshot(q, (snap) => {
      // Date strings compare lexically; "today" is Malawi's date, not UTC's.
      const today = malawiToday();
      const active = snap.docs.some(d => String(d.data().checkOut || '') >= today);
      setHasStayBooking(active);
    }, () => {
      setHasStayBooking(false);
    });

    return () => unsub();
  }, [user, id, hotel?.managerId, bookingsEnabled]);

  // Only subscribe to broadcasts if user is logged in AND has an active booking with this stay
  useEffect(() => {
    if (!id || !user || !hasStayBooking) {
      setBroadcasts([]);
      return;
    }
    const q = query(
      collection(db, 'broadcasts'),
      where('hotelId', '==', id),
      where('isActive', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast));
      docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBroadcasts(docs);
    }, (err) => {
      console.warn('Live broadcasts unavailable:', err?.message ?? err);
    });
    return () => unsub();
  }, [id, user, hasStayBooking]);

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
  const isElevatedUser = Boolean(user && (isAdmin(user) || isMarketing(user)));

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApproveListing = async () => {
    if (!hotel || !id) return;
    setIsApproving(true);
    try {
      await updateDoc(doc(db, 'hotels', id), {
        status: 'approved',
        updatedAt: Date.now(),
      });
      setHotel(prev => prev ? { ...prev, status: 'approved' } : null);
      await logSystemEvent(
        'action',
        `Admin/Marketing approved hotel listing: ${hotel.name}`,
        { hotelId: id, status: 'approved' },
        user,
        'property'
      );
      toast.success(`"${hotel.name}" is now approved and live on Travel Malawi!`);
    } catch (err: any) {
      console.error('Failed to approve listing:', err);
      toast.error('Failed to approve listing: ' + (err?.message || 'Permission denied'));
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectListing = async () => {
    if (!hotel || !id) return;
    const confirmed = window.confirm(`Are you sure you want to reject the listing "${hotel.name}"?`);
    if (!confirmed) return;
    setIsRejecting(true);
    try {
      await updateDoc(doc(db, 'hotels', id), {
        status: 'rejected',
        updatedAt: Date.now(),
      });
      setHotel(prev => prev ? { ...prev, status: 'rejected' } : null);
      await logSystemEvent(
        'action',
        `Admin/Marketing rejected hotel listing: ${hotel.name}`,
        { hotelId: id, status: 'rejected' },
        user,
        'property'
      );
      toast.success(`Listing "${hotel.name}" marked as rejected.`);
    } catch (err: any) {
      console.error('Failed to reject listing:', err);
      toast.error('Failed to reject listing: ' + (err?.message || 'Permission denied'));
    } finally {
      setIsRejecting(false);
    }
  };



  /** The Menu tab only exists when the property has published a restaurant. */
  const restaurant = hotel?.restaurant?.enabled ? hotel.restaurant : null;

  /**
   * Rooms with both room-specific blocked dates and property-level blocked dates
   * (e.g. whole house closures or property maintenance) folded in.
   * If stayType === 'entire_place' and no room_types exist in Firestore,
   * synthesizes a whole-space room record so all availability, calendar, and booking logic works.
   */
  const effectiveRooms = useMemo(() => {
    const hotelBlocked = [...normalizeBlockedDates(hotel?.blockedDates), ...normalizeBlockedDates(hotel?.icalBlockedDates)];
    let baseRooms = [...rooms];

    if (hotel?.stayType === 'entire_place' && baseRooms.length === 0) {
      baseRooms = [entirePlaceRoom(hotel)];
    }

    return baseRooms.map(r => {
      const roomBlocked = normalizeBlockedDates(r.blockedDates);
      const combined = [...new Set([...roomBlocked, ...hotelBlocked])];
      return {
        ...r,
        blockedDates: combined,
      };
    });
  }, [rooms, hotel]);

  /** Maximum guest capacity for the property across its rooms or whole house */
  const propertyMaxGuests = useMemo(() => {
    if (hotel?.stayType === 'entire_place') {
      return hotel.entirePlaceDetails?.maxGuests || (effectiveRooms[0]?.maxGuests ?? 6);
    }
    const maxInRooms = effectiveRooms.reduce((max, r) => Math.max(max, r.maxGuests || 2), 2);
    return Math.max(maxInRooms, 2);
  }, [hotel, effectiveRooms]);

  /** Checks if any calendar date is fully blocked for the entire property */
  const isDateBlockedForProperty = useMemo(() => {
    const hotelBlocked = new Set([...normalizeBlockedDates(hotel?.blockedDates), ...normalizeBlockedDates(hotel?.icalBlockedDates)]);
    return (dateStr: string) => {
      if (hotelBlocked.has(dateStr)) return true;
      if (effectiveRooms.length === 0) return false;
      const nextDay = addDays(dateStr, 1);
      return effectiveRooms.every(r => !isRoomAvailable(r, bookings, dateStr, nextDay, 1));
    };
  }, [hotel?.blockedDates, hotel?.icalBlockedDates, effectiveRooms, bookings]);

  const [dateSelectMode, setDateSelectMode] = useState<'inputs' | 'calendar'>('inputs');

  const scrollToRooms = () => {
    setTimeout(() => {
      const el = document.getElementById('available-rooms-list') || document.getElementById('accommodations-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
  };

  const switchToCalendar = () => {
    setDateSelectMode('calendar');
    setTimeout(() => {
      const el = document.getElementById('stay-dates-selector');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const jumpToSection = (targetId: string, options?: { setSpaceTab?: 'rooms' | 'conferences'; openDirections?: boolean }) => {
    if (options?.setSpaceTab) {
      setActiveSpaceTab(options.setSpaceTab);
    }
    if (options?.openDirections) {
      setIsDirectionsOpenMobile(true);
    }
    const details = document.getElementById('sticky-quick-nav-details') as HTMLDetailsElement | null;
    if (details) {
      details.removeAttribute('open');
    }

    const delay = options?.openDirections || options?.setSpaceTab ? 100 : 30;
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, delay);
  };

  // Close mobile explore menu when tapping outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const details = document.getElementById('sticky-quick-nav-details') as HTMLDetailsElement | null;
      if (details && details.hasAttribute('open')) {
        if (!details.contains(e.target as Node)) {
          details.removeAttribute('open');
        }
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  /** Currencies this property sells in, across all its rooms. */
  const offeredCurrencies = useMemo(() => currenciesForRooms(effectiveRooms), [effectiveRooms]);

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
    for (const room of effectiveRooms) {
      if (!room.id) continue;
      map[room.id] = hasDates
        ? {
            available: isRoomAvailable(room, bookings, checkIn, checkOut, 1),
            remaining: unitsRemaining(room, bookings, checkIn, checkOut),
          }
        : { available: (room.quantity ?? 0) > 0, remaining: null };
    }
    return map;
  }, [effectiveRooms, bookings, checkIn, checkOut]);

  const availableRoomNames = useMemo(() => {
    return effectiveRooms
      .filter(r => r.id && roomAvailability[r.id]?.available)
      .map(r => r.name);
  }, [effectiveRooms, roomAvailability]);

  /** Combined rating across imported and guest-written reviews. */
  const ratingSummary = useMemo(() => {
    const hotelReviews = Array.isArray(hotel?.reviews) ? hotel.reviews : [];
    const guestReviews = Array.isArray(reviews) ? reviews : [];
    const ratings = [
      ...hotelReviews.map(r => r?.rating),
      ...guestReviews.map(r => r?.rating),
    ].filter((r): r is number => typeof r === 'number' && r > 0);
    if (!ratings.length) return null;
    return {
      average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
      count: ratings.length,
    };
  }, [hotel?.reviews, reviews]);

  /** Imported and guest-written reviews in one list, sorted by chosen sort order (most recent first by default). */
  const allReviews = useMemo(() => {
    const guestReviews = Array.isArray(reviews) ? reviews : [];
    const written = guestReviews.map((r, i) => {
      const ts = r?.createdAt || Date.now();
      return {
        key: r?.id ? `rev-${r.id}-${i}` : `review-${ts}-${i}`,
        author: r?.authorName || 'Guest',
        rating: typeof r?.rating === 'number' ? r.rating : 5,
        title: (r?.title || undefined) as string | undefined,
        text: r?.text || '',
        date: formatReviewDate(ts),
        timestamp: ts,
        source: 'Travel-Malawi',
        sourceUrl: undefined as string | undefined,
        verified: true,
      };
    });

    const hotelReviews = Array.isArray(hotel?.reviews) ? hotel.reviews : [];
    const imported = hotelReviews.map((r, i) => {
      const comment = ((r?.text || (r as any)?.comment || '') as string).trim();
      const rawDate = r?.date || (r as any)?.createdAt || (r as any)?.scrapedAt || null;
      const ts = parseReviewDateToTimestamp(rawDate, (r as any)?.createdAt || 0);
      const formattedDate = formatReviewDate(rawDate || ts);
      const isGb = (r?.source || '').toLowerCase().includes('guest book') || (r?.source || '').toLowerCase().includes('guestbook');
      const sanitizedUrl = isGb
        ? undefined
        : sanitizeReviewSourceUrl(r?.sourceUrl, r?.source, hotel?.name, hotel?.location);

      return {
        key: r?.id || `imported-${i}`,
        author: r?.author || 'Guest',
        rating: typeof r?.rating === 'number' ? r.rating : 5,
        title: r?.title || undefined,
        text: comment,
        date: formattedDate,
        timestamp: ts,
        source: r?.source || 'TripAdvisor',
        sourceUrl: sanitizedUrl,
        verified: false,
      };
    });

    const combined = [...written, ...imported];

    return combined.sort((a, b) => {
      if (reviewSort === 'highest') {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
      if (reviewSort === 'critical') {
        if (a.rating !== b.rating) return a.rating - b.rating;
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
      // 'recent' (default): most recent first by timestamp
      if ((b.timestamp || 0) !== (a.timestamp || 0)) {
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
      // Secondary sort: verified stays first
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return b.rating - a.rating;
    });
  }, [hotel?.reviews, reviews, reviewSort]);

  /** Direct Google Maps lookup URL for viewing all community reviews, ratings & traveler photos. */
  const googleMapsReviewsUrl = useMemo(() => {
    if (!hotel?.name) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${hotel.location || 'Malawi'}`)}`;
  }, [hotel?.name, hotel?.location]);

  /**
   * Re-verifies availability against the live inventory mirror immediately
   * before writing a booking. If the check itself fails the booking is not
   * sent: the caller tells the guest to retry rather than risk a clash.
   */
  async function checkRoomAvailability(room: RoomType, quantity: number): Promise<boolean> {
    const live = await loadRoomSlots(room.id!);
    const eff = effectiveRooms.find(r => r.id === room.id) ?? room;
    return isRoomAvailable(eff, live, checkIn, checkOut, quantity);
  }

  /** The promotion for a room, ranked by its real value at the displayed price. */
  function roomPromotionFor(room: RoomType, date: string) {
    if (!hotel) return null;
    const roomCurrency = resolveCurrency(room, currency);
    return getActivePromotion(hotel, date, 'room', room.id, { price: roomPrice(room, roomCurrency) ?? 0, currency: roomCurrency });
  }

  const initiateBooking = (room: RoomType) => {
    if (!bookingsEnabled) return;
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
    if (!selectedRoom || saving || !bookingsEnabled) return;

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
        setTimeout(() => document.querySelector('.text-red-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
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
    setBookingStatus(isOnline ? `Submitting booking request for ${selectedRoom.name}...` : `Saving offline booking to device...`);
    try {
      // Calculate pricing and reference
      const activePromo = selectedRoom ? roomPromotionFor(selectedRoom, checkIn) : null;
      const pricing = computeBookingPricing(
        selectedRoom, checkIn, checkOut, guestsCount, 1, selectedPackages, currency, activePromo,
        { adults: adultsCount, children: childrenCount }, hotel?.childPolicy
      );
      const reference = makeBookingReference();

      // Common helper to save booking request to IndexedDB when offline
      const saveOfflineAndNotify = async () => {
        await saveOfflineBooking({
          reference,
          hotelId: hotel?.id || '',
          hotelName: hotel?.name || 'Property',
          roomTypeId: selectedRoom.id,
          roomName: selectedRoom.name,
          guestId: user?.uid || 'anonymous',
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: (guestPhone || '').trim(),
          guestWhatsapp: (guestWhatsapp || '').trim(),
          checkIn,
          checkOut,
          guests: guestsCount,
          adults: adultsCount,
          children: childrenCount,
          quantity: 1,
          total: pricing.total,
          currency: pricing.currency,
          specialRequests: specialRequests.trim(),
          packageIds: selectedPackages,
          extraGuestTotal: pricing.extraGuestTotal,
          packagesTotal: pricing.packagesTotal,
          promotionId: activePromo?.id ?? null,
          discountAmount: pricing.discountAmount,
          managerId: hotel?.managerId ?? null,
          managerEmail: hotel?.managerEmail ?? null,
          bookingData: {
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
            adults: adultsCount,
            children: childrenCount,
            quantity: 1,
            total: pricing.total,
            packageIds: selectedPackages,
            extraGuestTotal: pricing.extraGuestTotal,
            packagesTotal: pricing.packagesTotal,
            currency: pricing.currency,
            promotionId: activePromo?.id ?? null,
            discountAmount: pricing.discountAmount,
            status: 'pending',
            createdAt: Date.now()
          }
        });

        recordSubmission();

        toast.custom(
          (t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white text-stone-900 shadow-sm rounded-xl pointer-events-auto p-4 border border-stone-200`}>
              <div className="flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5">Saved on this device</p>
                  <p className="text-sm text-stone-600 mb-2">We will send your request when you are back online.</p>
                  <span className="tm-tag font-mono">Ref {reference}</span>
                </div>
              </div>
            </div>
          ),
          { duration: 9000 }
        );

        setSelectedRoom(null);
        if (user) navigate('/my-bookings');
      };

      // If user is currently offline, store directly to IndexedDB
      if (!isOnline) {
        await saveOfflineAndNotify();
        return;
      }

      // Online: check live availability
      let isAvailable: boolean;
      try {
        isAvailable = await checkRoomAvailability(selectedRoom, 1);
      } catch (err) {
        console.warn('Could not verify live availability online, fallback to offline IndexedDB storage:', err);
        await saveOfflineAndNotify();
        return;
      }
      if (!isAvailable) {
        toast.error('This room is not free on those dates. Try other dates.');
        return;
      }

      let bookingId: string;
      try {
        bookingId = await createBookingWithSlot({
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
          adults: adultsCount,
          children: childrenCount,
          quantity: 1,
          total: pricing.total,
          packageIds: selectedPackages,
          extraGuestTotal: pricing.extraGuestTotal,
          packagesTotal: pricing.packagesTotal,
          currency: pricing.currency,
          promotionId: activePromo?.id ?? null,
          discountAmount: pricing.discountAmount,
          status: 'pending',
          ...(assessment.verdict === 'review'
            ? { flagged: true, flagReasons: assessment.codes, flagScore: assessment.score }
            : {}),
          createdAt: Date.now()
        });
      } catch (writeErr: any) {
        // Only a connectivity failure is queued; a rejected write (rules,
        // validation) would fail again on every replay, so it is reported now.
        const code = String(writeErr?.code || '');
        if (code && !['unavailable', 'deadline-exceeded', 'resource-exhausted', 'aborted'].includes(code)) {
          console.error('Booking write rejected:', writeErr);
          toast.error('We could not send this request. Check your details or message the property.');
          return;
        }
        console.warn('Firebase booking write encountered network issue, saving to IndexedDB queue:', writeErr);
        await saveOfflineAndNotify();
        return;
      }

      recordSubmission();

      await logSystemEvent('action', `New booking requested at ${hotel?.name || 'Property'} (Ref: ${reference})`, {
        reference,
        hotelId: hotel?.id,
        roomTypeId: selectedRoom.id,
        checkIn,
        checkOut,
        guestsCount,
        currency,
        total: pricing.total
      }, user, 'booking');

      if (hotel?.managerEmail) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: hotel.managerEmail,
            hotelId: hotel.id,
            bookingId,
            subject: `New booking request: ${guestName.trim()} at ${hotel.name}`,
            message: `You have received a new booking request on Travel Malawi.\n\nGuest: ${guestName.trim()}\nDates: ${checkIn} to ${checkOut}\nRoom: ${selectedRoom.name}\nTotal: ${pricing.total} ${pricing.currency}\n\nPlease log in to review and confirm this booking.`
          })
        }).catch(err => console.error('Failed to trigger offline notification', err));
      }

      // The reference is surfaced to the guest
      toast.custom(
        (t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white text-stone-900 shadow-sm rounded-xl pointer-events-auto p-4 border border-stone-200`}>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-0.5">Request sent. Zikomo.</p>
                <p className="text-sm text-stone-600 mb-2">The property will confirm soon and we will let you know.</p>
                <span className="tm-tag font-mono">Ref {reference}</span>
              </div>
            </div>
          </div>
        ),
        { duration: 8000 }
      );
      setSelectedRoom(null);
      if (user) navigate('/my-bookings');
    } catch (error) {
      console.error("Booking error:", error);
      toast.error('Your request did not go through. Please try again.');
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
    <PageLoading />
  );
  if (!hotel) return <div className="p-20 text-center text-xl font-serif">Property not found.</div>;

  // Falls back to bundled photography when the record has no usable images.
  const hotelImages = getHotelImages(hotel);
  // Respect property-configured hero bento layout ('duo-3', 'bento-4', 'bento-5')
  // Default to 'bento-5' if >= 5 photos, or 'duo-3' if fewer photos.
  const activeHeroLayout: 'duo-3' | 'bento-4' | 'bento-5' = hotel.heroLayout || (hotelImages.length >= 5 ? 'bento-5' : 'duo-3');
  const maxHeroSupporting = activeHeroLayout === 'duo-3' ? 2 : activeHeroLayout === 'bento-4' ? 3 : 4;
  const galleryImages = hotelImages.slice(1, 1 + maxHeroSupporting);
  const hasGallery = galleryImages.length > 0;

  const handleMobileHeroScroll = useCallback(() => {
    if (!mobileHeroScrollRef.current) return;
    const { scrollLeft, clientWidth } = mobileHeroScrollRef.current;
    if (clientWidth > 0) {
      const idx = Math.round(scrollLeft / clientWidth);
      const clamped = Math.max(0, Math.min(hotelImages.length - 1, idx));
      setMobileHeroIdx(clamped);
    }
  }, [hotelImages.length]);

  const scrollToHeroIndex = useCallback((targetIndex: number) => {
    if (!mobileHeroScrollRef.current) return;
    const { clientWidth } = mobileHeroScrollRef.current;
    const clamped = Math.max(0, Math.min(hotelImages.length - 1, targetIndex));
    mobileHeroScrollRef.current.scrollTo({
      left: clamped * clientWidth,
      behavior: 'smooth',
    });
    setMobileHeroIdx(clamped);
  }, [hotelImages.length]);

  const handleMobileHeroTouchStart = (e: React.TouchEvent) => {
    heroTouchStartX.current = e.touches[0].clientX;
    heroTouchStartY.current = e.touches[0].clientY;
    heroTouchDeltaX.current = 0;
    heroIsHorizontal.current = null;
    heroHasDragged.current = false;
  };

  const handleMobileHeroTouchMove = (e: React.TouchEvent) => {
    if (heroTouchStartX.current === null || heroTouchStartY.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - heroTouchStartX.current;
    const deltaY = currentY - heroTouchStartY.current;

    if (heroIsHorizontal.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        heroIsHorizontal.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (heroIsHorizontal.current) {
      heroTouchDeltaX.current = deltaX;
      if (Math.abs(deltaX) > 10) {
        heroHasDragged.current = true;
      }
    }
  };

  const handleMobileHeroTouchEnd = () => {
    if (heroTouchStartX.current === null) return;
    const deltaX = heroTouchDeltaX.current;
    const wasHorizontal = heroIsHorizontal.current;

    heroTouchStartX.current = null;
    heroTouchStartY.current = null;
    heroTouchDeltaX.current = 0;
    heroIsHorizontal.current = null;

    if (wasHorizontal && Math.abs(deltaX) > 35) {
      if (deltaX < 0 && mobileHeroIdx < hotelImages.length - 1) {
        scrollToHeroIndex(mobileHeroIdx + 1);
      } else if (deltaX > 0 && mobileHeroIdx > 0) {
        scrollToHeroIndex(mobileHeroIdx - 1);
      }
    }
    setTimeout(() => {
      heroHasDragged.current = false;
    }, 150);
  };

  // Rich Schema.org structured data for LodgingBusiness / Hotel Knowledge Graph
  const hotelSchema = useMemo(() => {
    if (!hotel) return undefined;
    const coords = resolveHotelCoordinates(hotel);
    const safeReviews = Array.isArray(reviews) ? reviews : [];
    const avgRating = safeReviews.length > 0
      ? (safeReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / safeReviews.length).toFixed(1)
      : undefined;

    const roomPricesMwk = rooms
      .map((r) => roomPrice(r, 'MWK'))
      .filter((p): p is number => typeof p === 'number' && p > 0);
    const minMwk = roomPricesMwk.length > 0 ? Math.min(...roomPricesMwk) : null;
    const maxMwk = roomPricesMwk.length > 0 ? Math.max(...roomPricesMwk) : null;

    const roomPricesUsd = rooms
      .map((r) => roomPrice(r, 'USD'))
      .filter((p): p is number => typeof p === 'number' && p > 0);
    const minUsd = roomPricesUsd.length > 0 ? Math.min(...roomPricesUsd) : null;
    const maxUsd = roomPricesUsd.length > 0 ? Math.max(...roomPricesUsd) : null;

    let computedPriceRange: string | undefined = undefined;
    if (minMwk !== null && maxMwk !== null) {
      const mwkStr = minMwk === maxMwk
        ? `MK ${minMwk.toLocaleString()}`
        : `MK ${minMwk.toLocaleString()} - MK ${maxMwk.toLocaleString()}`;
      const usdStr = minUsd !== null && maxUsd !== null
        ? (minUsd === maxUsd ? `$${minUsd}` : `$${minUsd} - $${maxUsd}`)
        : '';
      computedPriceRange = usdStr ? `${mwkStr} / ${usdStr}` : mwkStr;
    }

    let aggregateRatingNode: Record<string, any> | undefined = undefined;
    if (safeReviews.length > 0 && avgRating) {
      aggregateRatingNode = {
        '@type': 'AggregateRating',
        ratingValue: avgRating,
        reviewCount: String(safeReviews.length),
        bestRating: '5',
        worstRating: '1',
      };
    } else if (hotel.reviewsSummary && hotel.reviewsSummary.averageRating > 0) {
      aggregateRatingNode = {
        '@type': 'AggregateRating',
        ratingValue: hotel.reviewsSummary.averageRating.toFixed(1),
        reviewCount: String(hotel.reviewsSummary.count || 1),
        bestRating: '5',
        worstRating: '1',
      };
    }

    const schemaNode: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': ['LodgingBusiness', hotel.category === 'Luxury' ? 'Resort' : 'Hotel'],
      name: hotel.name,
      description: hotel.description || '',
      image: hotelImages.slice(0, 5),
      url: `https://ulendomalawi.com/hotel/${hotel.id}`,
      telephone: hotel.contactPhone || undefined,
      currenciesAccepted: 'MWK, USD',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'MW',
        addressLocality: hotel.location || 'Malawi',
        addressRegion: 'Malawi',
      },
      checkinTime: hotel.checkInTime || '14:00',
      checkoutTime: hotel.checkOutTime || '10:30',
    };

    if (computedPriceRange) {
      schemaNode.priceRange = computedPriceRange;
    }

    if (coords && isValidLatLng(coords)) {
      schemaNode.geo = {
        '@type': 'GeoCoordinates',
        latitude: coords.lat,
        longitude: coords.lng,
      };
    }

    if (aggregateRatingNode) {
      schemaNode.aggregateRating = aggregateRatingNode;
    }

    if (hotel.amenities && hotel.amenities.length > 0) {
      schemaNode.amenityFeature = hotel.amenities.map((amenity) => ({
        '@type': 'LocationFeatureSpecification',
        name: amenity,
        value: true,
      }));
    }

    if (rooms && rooms.length > 0) {
      schemaNode.containsPlace = rooms.map((room) => ({
        '@type': 'HotelRoom',
        name: room.name,
        description: room.description,
        occupancy: {
          '@type': 'QuantitativeValue',
          maxValue: room.maxGuests || 2,
        },
      }));
    }

    return schemaNode;
  }, [hotel, hotelImages, rooms, reviews]);

  return (
    <div className="min-h-screen bg-white pb-24">
      <SEOHead
        title={`${hotel.name} — ${hotel.category || 'Luxury'} Lodge in ${hotel.location || 'Lake Malawi'}`}
        description={bookingsEnabled
          ? `${((hotel.description || '').trim()).substring(0, 150)}... Book direct in MWK and USD with zero booking commissions on Travel Malawi.`
          : `${((hotel.description || '').trim()).substring(0, 150)}... Rooms, rates, photos, directions and the property's own contact details on Travel Malawi.`}
        keywords={`Malawi lodge, ${hotel.name}, ${hotel.location || 'Lake Malawi'}, ${hotel.category || 'Lodge'}, ${bookingsEnabled ? `book ${hotel.name}` : `${hotel.name} contact`}, Lake Malawi accommodation, safari stay`}
        image={hotel.imageUrl || hotelImages[0]}
        url={`https://ulendomalawi.com/hotel/${hotel.id}`}
        type="hotel"
        schema={hotelSchema}
      />
      {/* Moderation Preview Banner for Admins and Marketing */}
      {isElevatedUser && hotel.status !== 'approved' && (
        <aside
          aria-label="Listing Moderation Preview"
          className="sticky top-14 sm:top-16 z-50 bg-amber-50 text-stone-900 border-b border-amber-200 px-4 sm:px-6 py-2.5"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <span className={`tm-tag ${hotel.status === 'rejected' ? 'tm-tag-bad' : 'tm-tag-warn'}`}>
                {hotel.status === 'rejected' ? 'Rejected' : 'Waiting for approval'}
              </span>
              <p className="text-sm text-stone-700">
                Preview only. Guests cannot see this listing yet.
              </p>
            </div>
            <div className="tm-actions">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/hotel/${hotel.id}`)}
                className="tm-btn tm-btn-secondary tm-btn-sm"
              >
                <Building className="w-3.5 h-3.5" />
                <span>Edit listing</span>
              </button>
              {hotel.status !== 'rejected' && (
                <button
                  type="button"
                  disabled={isRejecting || isApproving}
                  onClick={handleRejectListing}
                  className="tm-btn tm-btn-danger tm-btn-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isRejecting ? 'Rejecting…' : 'Reject'}</span>
                </button>
              )}
              <button
                type="button"
                disabled={isApproving || isRejecting}
                onClick={handleApproveListing}
                className="tm-btn tm-btn-primary tm-btn-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isApproving ? 'Approving…' : 'Approve and publish'}</span>
              </button>
            </div>
          </div>
        </aside>
      )}
      {/* Owner / Host Preview Banner when viewing a Pending Listing */}
      {!isElevatedUser && hotel.status && hotel.status !== 'approved' && (
        <aside
          aria-label="Property Owner Listing Preview"
          className="sticky top-14 sm:top-16 z-50 bg-amber-50 text-stone-900 border-b border-amber-200 px-4 sm:px-6 py-2.5"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <span className={`tm-tag ${hotel.status === 'rejected' ? 'tm-tag-bad' : 'tm-tag-warn'}`}>
                {hotel.status === 'rejected' ? 'Unpublished' : 'Being checked'}
              </span>
              <p className="text-sm text-stone-700">
                {hotel.status === 'rejected'
                  ? 'This listing is not published. Update it from your dashboard.'
                  : 'Only you can see this while we check your listing. You can still edit it.'}
              </p>
            </div>
            <div className="tm-actions">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/hotel/${hotel.id}`)}
                className="tm-btn tm-btn-secondary tm-btn-sm"
              >
                <Building className="w-3.5 h-3.5" />
                <span>Edit listing</span>
              </button>
            </div>
          </div>
        </aside>
      )}
      {/* Sticky Header when scrolled past hero */}
      <div
        id="sticky-property-bar"
        className={`fixed top-14 sm:top-16 md:top-16 lg:top-18 left-0 right-0 z-40 bg-white border-b border-stone-200 transition-transform duration-300 ease-in-out ${
          isScrolledPastHero ? 'translate-y-0' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4 w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="font-serif text-xs min-[400px]:text-sm sm:text-base md:text-lg font-bold text-stone-900 tracking-tight truncate min-w-0">
              <MaskedPlaceName name={hotel.name} fallback="[Your Lodge Name]" />
            </h2>
            {hotel.stayType === 'entire_place' && (
              <span className="hidden md:inline-flex tm-tag shrink-0">
                <Building className="w-3 h-3" /> Entire place
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Quick Navigation & Action Pills */}
            <div className="hidden md:flex items-center gap-1 sm:gap-1.5 text-[11px] lg:text-xs font-semibold text-stone-700">
              <a 
                href="#rooms-section" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('rooms-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="tm-btn tm-btn-quiet tm-btn-sm"
              >
                {hotel.stayType === 'entire_place' ? (
                  <>
                    <Building className="w-3.5 h-3.5 text-stone-500" />
                    <span>The space</span>
                  </>
                ) : (
                  <>
                    <BedDouble className="w-3.5 h-3.5 text-stone-500" />
                    <span>Rooms</span>
                  </>
                )}
              </a>

              {hotel.restaurant && hotel.restaurant.enabled !== false && (
                <a 
                  href="#restaurant-menu" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('restaurant-menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="tm-btn tm-btn-quiet tm-btn-sm"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-stone-500" />
                  <span>Dining</span>
                </a>
              )}

              <a 
                href="#reviews" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="tm-btn tm-btn-quiet tm-btn-sm"
              >
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Reviews</span>
              </a>

              <a 
                href="#directions" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('directions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="tm-btn tm-btn-quiet tm-btn-sm"
              >
                <MapPin className="w-3.5 h-3.5 text-stone-500" />
                <span>Location</span>
              </a>
            </div>

            {/* Mobile Quick Jump Dropdown */}
            <details id="sticky-quick-nav-details" className="relative group md:hidden">
              <summary className="list-none tm-btn tm-btn-secondary tm-btn-sm cursor-pointer select-none [&::-webkit-details-marker]:hidden">
                <Compass className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>Jump to</span>
                <ChevronDown className="w-3 h-3 text-stone-400 group-open:rotate-180 transition-transform ml-0.5" />
              </summary>
              <div className="absolute right-0 mt-2 w-60 sm:w-64 max-h-[75vh] overflow-y-auto bg-white border border-stone-200 rounded-xl shadow-sm z-50 p-1.5 flex flex-col gap-0.5 text-sm">
                <a
                  href="#about-property"
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToSection('about-property');
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>About</span>
                </a>
                {bookingsEnabled && (
                <a
                  href="#stay-dates-selector"
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToSection('stay-dates-selector');
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Dates and prices</span>
                  </span>
                </a>
                )}
                <a
                  href="#rooms-section"
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToSection('rooms-section', { setSpaceTab: 'rooms' });
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    {hotel.stayType === 'entire_place' ? (
                      <Building className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    ) : (
                      <BedDouble className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    )}
                    <span>{hotel.stayType === 'entire_place' ? 'The space' : 'Rooms'}</span>
                  </span>
                  {rooms.length > 0 && (
                    <span className="text-xs text-stone-500 tabular-nums">
                      {rooms.length}
                    </span>
                  )}
                </a>
                {conferenceRooms.length > 0 && (
                  <a
                    href="#rooms-section"
                    onClick={(e) => {
                      e.preventDefault();
                      jumpToSection('rooms-section', { setSpaceTab: 'conferences' });
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Users className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>Meeting rooms</span>
                    </span>
                    <span className="text-xs text-stone-500 tabular-nums">
                      {conferenceRooms.length}
                    </span>
                  </a>
                )}

                {/* Details & Hospitality */}
                <div className="border-t border-stone-100 my-1"></div>
                {(hasAnyContact(hotel) || canChat || hasSocialLinks(hotel)) && (
                  <a
                    href="#contact-host-section"
                    onClick={(e) => {
                      e.preventDefault();
                      jumpToSection('contact-host-section');
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <PhoneCall className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>{bookingsEnabled ? 'Contact host' : 'Contact the property'}</span>
                    </span>
                    {bookingsEnabled && <span className={`w-2 h-2 rounded-full ${hostStatus === 'online' ? 'bg-emerald-500' : 'bg-stone-300'}`} />}
                  </a>
                )}
                <a
                  href="#property-highlights"
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToSection('property-highlights');
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>Amenities</span>
                </a>
                <a
                  href="#policies-section"
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToSection('policies-section');
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                  <span>House rules</span>
                </a>
                {hotel.restaurant && hotel.restaurant.enabled !== false && (
                  <a
                    href="#restaurant-menu"
                    onClick={(e) => {
                      e.preventDefault();
                      jumpToSection('restaurant-menu');
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Dining</span>
                  </a>
                )}

                {/* Location & Reviews */}
                <div className="border-t border-stone-100 my-1"></div>
                <a
                  href="#location-setting"
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToSection('location-setting');
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>Location</span>
                </a>
                {activeSpaceTab === 'rooms' && (
                  <a
                    href="#reviews"
                    onClick={(e) => {
                      e.preventDefault();
                      jumpToSection('reviews');
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      <span>Reviews</span>
                    </span>
                    {ratingSummary && (
                      <span className="text-xs text-stone-500 tabular-nums">
                        {ratingSummary.average.toFixed(1)} ★
                      </span>
                    )}
                  </a>
                )}
                <a
                  href="#directions"
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToSection('directions', { openDirections: true });
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Navigation className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Directions</span>
                  </span>
                </a>
              </div>
            </details>

            {/* Share button with icon matching Reviews and Location */}
            <button
              type="button"
              onClick={handleShare}
              className="tm-btn tm-btn-quiet tm-btn-sm shrink-0"
              title="Share this property"
            >
              <Share2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span className="hidden min-[400px]:inline">Share</span>
            </button>

            {/* Divider between navigational actions and primary CTA */}
            <div className="h-5 w-px bg-stone-200/80 mx-0.5 sm:mx-1" aria-hidden="true" />

            {/* Primary CTA: book in booking mode, contact details in directory mode */}
            <button
              type="button"
              onClick={() => {
                document.getElementById(bookingsEnabled ? 'rooms-section' : 'contact-host-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="tm-btn tm-btn-primary tm-btn-sm shrink-0 whitespace-nowrap"
            >
              {bookingsEnabled ? (hotel.stayType === 'entire_place' ? 'Book the space' : 'Book') : 'Contact'}
            </button>
          </div>
        </div>
      </div>

      {/* Header image and gallery.
          The layout follows how many photographs a listing actually has.
          It used to be a fixed three-up grid padded with "No additional photo"
          boxes, so a listing with one image gave over half its header to two
          empty grey panels. */}
      <div className="w-full">
        {/* MOBILE ONLY: Touch-swipeable full-bleed photo gallery */}
        <div className="block md:hidden relative w-full h-[46vh] min-h-[320px] max-h-[460px] bg-stone-950 overflow-hidden select-none">
          <div
            ref={mobileHeroScrollRef}
            onScroll={handleMobileHeroScroll}
            onTouchStart={handleMobileHeroTouchStart}
            onTouchMove={handleMobileHeroTouchMove}
            onTouchEnd={handleMobileHeroTouchEnd}
            style={{ touchAction: 'pan-y' }}
            className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
          >
            {hotelImages.map((imgUrl, i) => (
              <div
                key={`mobile-hero-${imgUrl ? imgUrl.slice(-20) : 'img'}-${i}`}
                className="min-w-full h-full shrink-0 snap-center relative cursor-pointer"
                onClick={() => {
                  if (!heroHasDragged.current) {
                    setHotelGalleryInitialIndex(i);
                    setShowHotelGallery(true);
                  }
                }}
              >
                <SmartImage
                  src={imgUrl}
                  alt={`${hotel.name} — photograph ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/25 to-stone-950/30 pointer-events-none" />

          {/* Top-Right Actions: Share and Photo Counter */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10 pointer-events-auto">
            <button
              type="button"
              onClick={handleShare}
              className="bg-stone-950/60 hover:bg-stone-900/80 text-white p-2 rounded-lg transition-colors cursor-pointer"
              title="Share property"
              aria-label="Share property"
            >
              <Share className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setHotelGalleryInitialIndex(mobileHeroIdx);
                setShowHotelGallery(true);
              }}
              className="bg-stone-950/60 hover:bg-stone-900/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="View all photos"
            >
              <Images className="h-3.5 w-3.5" />
              <span>{mobileHeroIdx + 1} / {hotelImages.length}</span>
            </button>
          </div>

          {/* Bottom Overlay: Title, Location, and Dot Indicators */}
          <div className="absolute bottom-0 left-0 w-full p-5 sm:p-6 flex flex-col justify-end pointer-events-none">
            <div className="pointer-events-auto">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-white/80 text-xs sm:text-sm font-medium mb-1.5"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{hotel.location}</span>
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="font-serif font-medium tracking-[-0.02em] text-white leading-[1.05] text-2xl sm:text-3xl line-clamp-2"
              >
                <MaskedPlaceName name={hotel.name} fallback="[Your Lodge Name]" />
              </motion.h1>
            </div>

            {hotelImages.length > 1 && (
              <div className="flex items-center justify-between mt-3 pt-1 pointer-events-auto">
                {/* Swipeable Indicator Dots */}
                <div className="flex items-center gap-1.5">
                  {hotelImages.slice(0, 7).map((_, i) => (
                    <button
                      key={`hero-dot-${i}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToHeroIndex(i);
                      }}
                      aria-label={`Go to photo ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                        i === mobileHeroIdx ? 'w-5 bg-white shadow-sm' : 'w-1.5 bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                  {hotelImages.length > 7 && (
                    <span className="text-[10px] text-white/70 font-bold ml-0.5">•</span>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

        {/* DESKTOP ONLY: Bento grid layout */}
        <div className={`hidden md:grid gap-0 md:h-[50vh] lg:h-[66vh] ${hasGallery ? 'grid-cols-4' : 'grid-cols-1'}`}>
          {/* Main image */}
          <div className={`relative rounded-none overflow-hidden h-full group cursor-pointer ${hasGallery ? 'col-span-2 row-span-2' : ''}`} onClick={() => { setHotelGalleryInitialIndex(0); setShowHotelGallery(true); }}>
            <SmartImage src={hotelImages[0]} alt={hotel.name} loading="eager" className="w-full h-full object-cover" />
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
                  <MaskedPlaceName name={hotel.name} fallback="[Your Lodge Name]" />
                </motion.h1>
              </div>
              
              <div className="hidden md:flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 pointer-events-auto">
                <button 
                  type="button"
                  onClick={handleShare}
                  className="bg-stone-950/60 hover:bg-stone-900/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share className="h-4 w-4" />
                  Share
                </button>
                <button 
                  type="button"
                  onClick={() => { setHotelGalleryInitialIndex(0); setShowHotelGallery(true); }}
                  className="bg-stone-950/60 hover:bg-stone-900/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Images className="h-4 w-4" />
                  {hotelImages.length} photos
                </button>
              </div>
            </div>
          </div>

          {/* Supporting photographs, only when they exist */}
          {galleryImages.map((url, index) => {
            const isLast = index === galleryImages.length - 1;
            const remainingCount = hotelImages.length - (galleryImages.length + 1);

            let gridSpanClass = 'col-span-1 row-span-1';
            if (activeHeroLayout === 'duo-3') {
              gridSpanClass = 'col-span-2 row-span-1';
            } else if (activeHeroLayout === 'bento-4') {
              gridSpanClass = index === 0 ? 'col-span-2 row-span-1' : 'col-span-1 row-span-1';
            } else {
              gridSpanClass = 'col-span-1 row-span-1';
            }

            return (
              <div
                key={`${url}-${index}`}
                className={`relative rounded-none overflow-hidden group cursor-pointer ${gridSpanClass}`}
                onClick={() => { setHotelGalleryInitialIndex(index + 1); setShowHotelGallery(true); }}
              >
                <SmartImage
                  src={url}
                  alt={`${hotel.name} — photograph ${index + 2}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-stone-950/10 group-hover:bg-transparent transition pointer-events-none" />
                {isLast && remainingCount > 0 && (
                  <div className="absolute inset-0 bg-stone-950/45 hover:bg-stone-950/35 transition flex items-center justify-center p-2">
                    <span className="bg-white text-stone-900 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <Images className="w-3.5 h-3.5 text-stone-700" />
                      <span>+{remainingCount} photos</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="max-w-[90rem] mx-auto px-4 lg:px-12">
          {/* Active Property Broadcasts / Live Alerts - Strictly for logged-in guests with a stay booking */}
          {user && hasStayBooking && broadcasts.length > 0 && (
            <div className="mt-6 tm-panel !py-1 divide-y divide-stone-100">
              {broadcasts.map((b, bIdx) => (
                <div key={`${b.id || 'bc'}-${bIdx}`} className="flex items-start gap-3 py-3 min-w-0">
                  <Megaphone className={`w-4 h-4 shrink-0 mt-0.5 ${b.type === 'alert' ? 'text-red-700' : 'text-stone-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-stone-900">Note for your stay</span>
                      <span className={`tm-tag ${b.type === 'alert' ? 'tm-tag-bad' : b.type === 'event' ? 'tm-tag-warn' : ''}`}>{b.type}</span>
                      <span className="text-xs text-stone-500">
                        {new Date(b.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-stone-700 break-words">{b.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* A listing awaiting moderation is reachable by direct link, so it says
              plainly that it cannot be booked rather than failing at submit. */}
          {!isBookable && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 sm:px-5 py-3.5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-700" />
                <div>
                  <p className="font-semibold">{bookingsEnabled ? 'This property is not taking bookings yet' : 'This listing is not published yet'}</p>
                  <p className="text-sm text-amber-800 mt-0.5">
                    {hotel.status === 'rejected'
                      ? 'This listing is not published.'
                      : 'We are still checking this listing. Please check back soon.'}
                  </p>
                </div>
              </div>
              {isElevatedUser && (
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <button
                    type="button"
                    disabled={isApproving}
                    onClick={handleApproveListing}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isApproving ? 'Approving…' : 'Approve and publish'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {hotel.stayType === 'entire_place' && (
              <span className="tm-tag">
                <Building className="h-3.5 w-3.5" />
                <span>Entire place</span>
              </span>
            )}

            {ratingSummary && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                <span className="font-semibold text-stone-900">{ratingSummary.average.toFixed(1)}</span>
                <span className="text-stone-500">
                  ({ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'})
                </span>
              </div>
            )}

            <a
              href="#directions"
              className="lg:hidden tm-link inline-flex items-center gap-1"
            >
              <Navigation className="h-3.5 w-3.5 shrink-0" />
              <span>Directions</span>
            </a>
            <a
              href="#reviews"
              className="lg:hidden tm-link inline-flex items-center gap-1"
            >
              <Star className="h-3.5 w-3.5 shrink-0" />
              <span>Reviews</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto px-3.5 sm:px-6 lg:px-12 py-5 sm:py-8 lg:py-16 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 xl:gap-16">
        <div className="md:col-span-7 lg:col-span-8">

          <div id="about-property" className="scroll-mt-28 sm:scroll-mt-32">
            <h2 className="tm-h1 mb-3">About this property</h2>
            <FormattedDescription
              text={hotel.description}
              collapsible={true}
              collapsedHeight={130}
              expandLabel="Read more"
              collapseLabel="Show less"
              fadeGradientClass="from-transparent to-white"
              buttonClassName="text-stone-900 font-semibold text-xs sm:text-sm underline decoration-stone-300 hover:decoration-stone-800"
              className={`text-stone-600 text-sm sm:text-base leading-relaxed ${hotel.tourismLicenceNumber?.trim() ? 'mb-3' : 'mb-8 lg:mb-10'}`}
            />
            {/* Stated by the property; Travel Malawi has not verified it, so no badge. */}
            {hotel.tourismLicenceNumber?.trim() && (
              <p className="text-xs text-stone-500 mb-8 lg:mb-10">
                Tourism licence no. {hotel.tourismLicenceNumber.trim()} (provided by the property)
              </p>
            )}
          </div>

          {/* Spaces Section */}
          <div className="mb-8 sm:mb-10 lg:mb-14">
            <div id="rooms-section" className="scroll-mt-28 sm:scroll-mt-32 lg:scroll-mt-28 mb-4 sm:mb-6 lg:mb-8">
              {conferenceRooms.length > 0 ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Mobile/Tablet Dropdown */}
                    <div className="sm:hidden relative w-full mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('space-tab-dropdown');
                          if (el) el.classList.toggle('hidden');
                        }}
                        onBlur={(e) => {
                          setTimeout(() => {
                            const el = document.getElementById('space-tab-dropdown');
                            if (el) el.classList.add('hidden');
                          }, 150);
                        }}
                        className="tm-input flex items-center justify-between font-medium"
                      >
                        <span>{activeSpaceTab === 'rooms' ? 'Rooms' : 'Meeting rooms'}</span>
                        <ChevronDown className="w-5 h-5 text-stone-400 shrink-0" />
                      </button>
                      
                      <div 
                        id="space-tab-dropdown"
                        className="hidden absolute top-full left-0 right-0 mt-1.5 p-1.5 bg-white border border-stone-200 rounded-xl shadow-sm z-20 flex flex-col gap-0.5"
                      >
                        {[
                          { value: 'rooms', label: 'Rooms' },
                          { value: 'conferences', label: 'Meeting rooms' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setActiveSpaceTab(opt.value as 'rooms' | 'conferences');
                              const el = document.getElementById('space-tab-dropdown');
                              if (el) el.classList.add('hidden');
                            }}
                            className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                              activeSpaceTab === opt.value ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Desktop Tabs */}
                    <div className="hidden sm:flex items-center gap-6 border-b border-stone-200">
                      <button 
                        onClick={() => setActiveSpaceTab('rooms')}
                        className={`pb-3 tm-h2 whitespace-nowrap shrink-0 transition-colors border-b-2 ${activeSpaceTab === 'rooms' ? 'border-stone-900' : 'border-transparent !text-stone-400 hover:!text-stone-600'}`}
                      >
                        Rooms
                      </button>
                      <button 
                        onClick={() => setActiveSpaceTab('conferences')}
                        className={`pb-3 tm-h2 whitespace-nowrap shrink-0 transition-colors border-b-2 ${activeSpaceTab === 'conferences' ? 'border-stone-900' : 'border-transparent !text-stone-400 hover:!text-stone-600'}`}
                      >
                        Meeting rooms
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <div>
                    <h2 className="tm-h1">
                      {hotel.stayType === 'entire_place' ? (bookingsEnabled ? 'Book the whole place' : 'The whole place') : 'Rooms'}
                    </h2>
                    {hotel.stayType === 'entire_place' && (
                      <p className="tm-muted mt-1">{bookingsEnabled ? 'You book the whole property, just for your group.' : 'The whole property is let to one group at a time.'}</p>
                    )}
                  </div>
                  {hotel.stayType === 'entire_place' && hotel.entirePlaceDetails && (
                    <div className="tm-tag shrink-0">
                      <Building className="w-3.5 h-3.5" />
                      <span>
                        {hotel.entirePlaceDetails.bedrooms || 2} bedrooms · {hotel.entirePlaceDetails.bathrooms || 2} bathrooms · up to {hotel.entirePlaceDetails.maxGuests || 6} guests
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {activeSpaceTab === 'rooms' ? (
              <>
              {/* Directory mode: a display-only availability calendar, for
                  properties an admin switched it on for. Nothing is booked here. */}
              {!bookingsEnabled && hotel.availabilityCalendarEnabled === true && (
                <div id="availability-calendar" className="mb-6 sm:mb-8 scroll-mt-28 sm:scroll-mt-32 min-w-0">
                  <AvailabilityCalendar hotelId={id!} rooms={effectiveRooms} enabled readOnly />
                </div>
              )}
              {/* Top Inline Hybrid Date Bar (booking mode only: no dates or availability in the directory) */}
              {bookingsEnabled && (() => {
                const isEntirePlace = hotel.stayType === 'entire_place';
                const entireRoom = isEntirePlace && effectiveRooms.length > 0 ? effectiveRooms[0] : null;
                const entireRoomAvailable = entireRoom ? (roomAvailability[entireRoom.id || '']?.available ?? false) : false;
                const hasValidDates = Boolean(checkIn && checkOut && checkIn < checkOut);
                const stayNights = hasValidDates ? nightsBetween(checkIn, checkOut) : 0;
                const dateAvailableCount = effectiveRooms.filter(r => r.id && roomAvailability[r.id]?.available).length;
                const matchingRoomsCount = effectiveRooms.filter(r => r.id && roomAvailability[r.id]?.available && (isEntirePlace || (r.maxGuests || 2) >= guestsCount)).length;
                const entirePromo = entireRoom ? roomPromotionFor(entireRoom, checkIn) : null;
                const entirePricing = entireRoom && hasValidDates
                  ? computeBookingPricing(
                      entireRoom, checkIn, checkOut, guestsCount, 1, [], currency, entirePromo,
                      { adults: adultsCount, children: childrenCount }, hotel?.childPolicy
                    )
                  : null;

                return (
                  <div id="stay-dates-selector" className="tm-panel mb-6 sm:mb-8 scroll-mt-28 sm:scroll-mt-32 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                      <div className="min-w-0">
                        <h3 className="tm-h2 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-stone-500 shrink-0" />
                          Your dates
                        </h3>
                        <p className="tm-muted mt-0.5">
                          {hasValidDates
                            ? `${stayNights} night${stayNights === 1 ? '' : 's'} · ${formatDateStr(checkIn)} → ${formatDateStr(checkOut)}`
                            : 'Pick dates and guests to see what is free.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Compact switcher: Check-in / Out vs Calendar View */}
                        <div className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => setDateSelectMode('inputs')}
                            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                              dateSelectMode === 'inputs'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5 text-stone-500" />
                            <span>Dates</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDateSelectMode('calendar')}
                            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                              dateSelectMode === 'calendar'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5 text-stone-500" />
                            <span>Calendar</span>
                          </button>
                        </div>

                        {hasValidDates && (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckIn('');
                              setCheckOut('');
                            }}
                            className="tm-btn tm-btn-quiet tm-btn-sm"
                            title="Clear dates"
                          >
                            <X className="w-3.5 h-3.5 text-stone-400" />
                            <span className="hidden sm:inline">Clear</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mode Content: Check-in / Out Inputs vs Visual Calendar View */}
                    {dateSelectMode === 'inputs' ? (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3.5 items-stretch">
                        {/* Date Picker (Check-in & Check-out) */}
                        <div className={hotel.childPolicy?.enabled && hotel.childPolicy.allowed !== false ? "md:col-span-7 min-w-0" : "md:col-span-7 min-w-0"}>
                          <DatePicker
                            checkIn={checkIn}
                            checkOut={checkOut}
                            onSelect={(inDate, outDate) => {
                              setCheckIn(inDate);
                              setCheckOut(outDate);
                              if (inDate && outDate && inDate < outDate) {
                                toast('Dates set. Check the number of guests.');
                              }
                            }}
                            isDateBlocked={isDateBlockedForProperty}
                          />
                        </div>

                        {/* Guests / Adults & Children Controls */}
                        <div className="md:col-span-5 flex flex-col justify-center gap-2 min-w-0">
                          {hotel.childPolicy?.enabled && hotel.childPolicy.allowed !== false ? (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                {/* Adults Stepper */}
                                <div className="flex items-center justify-between flex-1 min-w-0 gap-1.5">
                                  <span className="text-sm text-stone-700">Adults</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!hasValidDates) {
                                          toast('Pick your dates first.');
                                          return;
                                        }
                                        setAdultsCount(prev => Math.max(1, prev - 1));
                                      }}
                                      disabled={adultsCount <= 1}
                                      className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                      aria-label="Decrease adults"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="w-5 text-center text-sm font-medium text-stone-900 tabular-nums">{adultsCount}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!hasValidDates) {
                                          toast('Pick your dates first.');
                                          return;
                                        }
                                        setAdultsCount(prev => Math.min(propertyMaxGuests - childrenCount, prev + 1));
                                      }}
                                      disabled={(adultsCount + childrenCount) >= propertyMaxGuests}
                                      className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                      aria-label="Increase adults"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Children Stepper */}
                                <div className="flex items-center justify-between flex-1 min-w-0 gap-1.5">
                                  <span className="text-sm text-stone-700">Children</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!hasValidDates) {
                                          toast('Pick your dates first.');
                                          return;
                                        }
                                        setChildrenCount(prev => Math.max(0, prev - 1));
                                      }}
                                      disabled={childrenCount <= 0}
                                      className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                      aria-label="Decrease children"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="w-5 text-center text-sm font-medium text-stone-900 tabular-nums">{childrenCount}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!hasValidDates) {
                                          toast('Pick your dates first.');
                                          return;
                                        }
                                        setChildrenCount(prev => Math.min(propertyMaxGuests - adultsCount, prev + 1));
                                      }}
                                      disabled={(adultsCount + childrenCount) >= propertyMaxGuests}
                                      className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                      aria-label="Increase children"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Child policy helper badge */}
                              <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                                <span className="truncate">
                                  {!hasValidDates ? (
                                    <span className="text-amber-800">Pick dates to change guests</span>
                                  ) : hotel.childPolicy.freeUnderAge ? (
                                    <span className="text-emerald-800">Under {hotel.childPolicy.freeUnderAge}s stay free</span>
                                  ) : hotel.childPolicy.rateType === 'free' ? (
                                    <span className="text-emerald-800">Children stay free</span>
                                  ) : (
                                    <span>Total {guestsCount} of max {propertyMaxGuests}</span>
                                  )}
                                </span>
                                <span className="shrink-0">Max {propertyMaxGuests}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div 
                                  onClick={() => {
                                    if (!hasValidDates) {
                                      toast('Pick your dates first.');
                                    }
                                  }}
                                  className="flex items-center gap-2 min-w-0 cursor-pointer"
                                >
                                  <Users className="w-4 h-4 text-stone-500 shrink-0" />
                                  <div className="min-w-0 text-sm text-stone-900 truncate">
                                    {guestsCount} {guestsCount === 1 ? 'guest' : 'guests'}
                                    {hotel.childPolicy?.enabled && hotel.childPolicy.allowed === false && (
                                      <span className="text-stone-500 ml-1">(adults only)</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {!hasValidDates && (
                                    <span 
                                      onClick={() => toast("Please choose your check-in and check-out dates first to verify room capacity.", { icon: '📅' })}
                                      className="text-xs text-amber-800 mr-1 cursor-pointer"
                                    >
                                      Pick dates first
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!hasValidDates) {
                                        toast('Pick your dates first.');
                                        return;
                                      }
                                      const next = Math.max(1, guestsCount - 1);
                                      setGuestsCount(next);
                                      setAdultsCount(next);
                                    }}
                                    disabled={guestsCount <= 1}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                    aria-label="Decrease guests"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-5 text-center text-sm font-medium text-stone-900 tabular-nums">{guestsCount}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!hasValidDates) {
                                        toast('Pick your dates first.');
                                        return;
                                      }
                                      const next = Math.min(propertyMaxGuests, guestsCount + 1);
                                      setGuestsCount(next);
                                      setAdultsCount(next);
                                    }}
                                    disabled={guestsCount >= propertyMaxGuests}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                    aria-label="Increase guests"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Calendar View Mode */
                      <div className="mt-3.5 space-y-3">
                        {/* Compact Occupancy bar in Calendar Mode */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="tm-muted">Tap a check-in day, then a check-out day.</p>

                          {/* Occupancy Stepper */}
                          <div className="shrink-0">
                            {hotel.childPolicy?.enabled && hotel.childPolicy.allowed !== false ? (
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-stone-700">Adults</span>
                                  <button
                                    type="button"
                                    onClick={() => setAdultsCount(prev => Math.max(1, prev - 1))}
                                    disabled={adultsCount <= 1}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="w-5 text-center text-sm font-medium text-stone-900 tabular-nums">{adultsCount}</span>
                                  <button
                                    type="button"
                                    onClick={() => setAdultsCount(prev => Math.min(propertyMaxGuests - childrenCount, prev + 1))}
                                    disabled={(adultsCount + childrenCount) >= propertyMaxGuests}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-stone-700">Children</span>
                                  <button
                                    type="button"
                                    onClick={() => setChildrenCount(prev => Math.max(0, prev - 1))}
                                    disabled={childrenCount <= 0}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="w-5 text-center text-sm font-medium text-stone-900 tabular-nums">{childrenCount}</span>
                                  <button
                                    type="button"
                                    onClick={() => setChildrenCount(prev => Math.min(propertyMaxGuests - adultsCount, prev + 1))}
                                    disabled={(adultsCount + childrenCount) >= propertyMaxGuests}
                                    className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                <span className="text-sm text-stone-700">Guests</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.max(1, guestsCount - 1);
                                    setGuestsCount(next);
                                    setAdultsCount(next);
                                  }}
                                  disabled={guestsCount <= 1}
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="w-5 text-center text-sm font-medium text-stone-900 tabular-nums">{guestsCount}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.min(propertyMaxGuests, guestsCount + 1);
                                    setGuestsCount(next);
                                    setAdultsCount(next);
                                  }}
                                  disabled={guestsCount >= propertyMaxGuests}
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 disabled:opacity-30 border border-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive Monthly Grid */}
                        <div>
                          <AvailabilityCalendar
                            hotelId={id!}
                            rooms={effectiveRooms}
                            checkIn={checkIn}
                            checkOut={checkOut}
                            availableRoomNames={availableRoomNames}
                            onRangeSelect={(inDate, outDate) => {
                              setCheckIn(inDate);
                              setCheckOut(outDate);
                              if (inDate && outDate && inDate < outDate) {
                                toast('Dates set. Check the number of guests.');
                              }
                            }}
                            onDateSelect={(date) => {
                              setCheckIn(date);
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Real-time Status / Total Pricing Banner */}
                    {hasValidDates && (
                      <div className="mt-3 pt-3 border-t border-stone-100">
                        {isEntirePlace ? (
                          entireRoomAvailable ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-stone-900">Free for your dates</span>
                                    <span className="tm-tag tm-tag-good">
                                      {stayNights} night{stayNights === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                  <div className="text-sm text-stone-600 mt-1 flex items-baseline gap-2 flex-wrap">
                                    <span>Total</span>
                                    {entirePricing && (
                                      <span className="font-serif font-semibold text-lg sm:text-xl text-stone-900">
                                        <PriceDisplay amount={entirePricing.total} currency={currency} />
                                      </span>
                                    )}
                                    {entirePricing && entirePricing.discountAmount > 0 && (
                                      <span className="text-xs text-stone-400 line-through">
                                        <PriceDisplay amount={entirePricing.basePrice + entirePricing.extraGuestFee} currency={currency} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                <button
                                  type="button"
                                  onClick={scrollToRooms}
                                  className="tm-btn tm-btn-quiet tm-btn-sm"
                                >
                                  See details
                                </button>
                                {entireRoom && (
                                  <button
                                    type="button"
                                    onClick={() => initiateBooking(entireRoom)}
                                    className="tm-btn tm-btn-primary"
                                  >
                                    Book the whole place
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <h4 className="text-sm font-semibold text-stone-900">Not free on these dates</h4>
                                  <p className="text-sm text-stone-600 mt-0.5">
                                    Booked or closed between {formatDateStr(checkIn)} and {formatDateStr(checkOut)}.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={switchToCalendar}
                                className="tm-btn tm-btn-secondary tm-btn-sm shrink-0 self-start sm:self-auto"
                              >
                                See free dates
                              </button>
                            </div>
                          )
                        ) : (
                          matchingRoomsCount > 0 ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-start gap-2 min-w-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                                <span className="text-sm text-stone-700">
                                  <strong className="font-semibold text-stone-900">{matchingRoomsCount}</strong> of {effectiveRooms.length} room type{effectiveRooms.length === 1 ? '' : 's'} fit {guestsCount} {guestsCount === 1 ? 'guest' : 'guests'} for {stayNights} night{stayNights === 1 ? '' : 's'}.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={scrollToRooms}
                                className="tm-btn tm-btn-primary tm-btn-sm shrink-0"
                              >
                                <span>See rooms</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : dateAvailableCount > 0 ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-start gap-2 min-w-0">
                                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-sm font-semibold text-stone-900">No single room fits {guestsCount} guests (largest fits {propertyMaxGuests})</span>
                                  <p className="text-sm text-stone-600 mt-0.5">Lower the guest count or book more than one room.</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const maxFit = Math.min(propertyMaxGuests, 2);
                                  setGuestsCount(maxFit);
                                  setAdultsCount(maxFit);
                                  setChildrenCount(0);
                                  scrollToRooms();
                                }}
                                className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                              >
                                Try {Math.min(propertyMaxGuests, 2)} guests
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-start gap-2 min-w-0">
                                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-sm font-semibold text-stone-900">Fully booked on these dates</span>
                                  <p className="text-sm text-stone-600 mt-0.5">
                                    Nothing is free between {formatDateStr(checkIn)} and {formatDateStr(checkOut)}.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={switchToCalendar}
                                className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                              >
                                See free dates
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            {(() => {
              const activePromos = hotel ? getAllActivePromotions(hotel, checkIn || todayStr()) : [];
              if (activePromos.length === 0) return null;
              const leadPromo = activePromos[0];
              const saleLabel = getSaleTypeLabel(leadPromo.saleType, leadPromo.saleTypeCustomLabel);

              return (
                <div className="mb-6 flex items-start sm:items-center justify-between gap-3 flex-wrap border-l-2 border-amber-700 pl-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <PromotionIcon saleType={leadPromo.saleType} className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="tm-tag tm-tag-warn">{saleLabel}</span>
                        <span className="text-sm font-semibold text-stone-900">
                          Up to {leadPromo.discountPercentage}% off
                        </span>
                      </div>
                      <p className="tm-muted mt-0.5">
                        {leadPromo.appliesTo === 'conferences_only'
                          ? 'On meeting rooms. Prices below already include it.'
                          : leadPromo.appliesTo === 'rooms_only'
                          ? 'On rooms. Prices below already include it.'
                          : 'On rooms and meeting rooms. Prices below already include it.'}
                      </p>
                    </div>
                  </div>
                  {leadPromo.endDate && (
                    <div className="shrink-0 text-xs text-stone-500">
                      Until {leadPromo.endDate}
                    </div>
                  )}
                </div>
              );
            })()}

            {effectiveRooms.length === 0 ? (
              <p className="tm-muted">No rooms listed yet. {bookingsEnabled ? 'Message the property to ask.' : 'Contact the property to ask.'}</p>
            ) : (
              <div id="available-rooms-list" className="flex flex-col gap-4 mb-8 sm:mb-10 pb-2 scroll-mt-28 sm:scroll-mt-32">
                {effectiveRooms.map((room, index) => {
                  const status = room.id ? roomAvailability[room.id] : undefined;
                  const roomDisplayCurrency = resolveCurrency(room, currency);
                  const isSoldOut = status ? !status.available : (room.quantity ?? 0) <= 0;
                  const hasDates = !!checkIn && !!checkOut && checkIn < checkOut;
                  const isOverCapacity = hotel?.stayType !== 'entire_place' && hasDates && ((room.maxGuests || 2) < guestsCount);
                  const roomPromo = roomPromotionFor(room, checkIn || malawiToday());
                  const baseRoomPrice = roomPrice(room, roomDisplayCurrency) ?? 0;
                  const roomSlashed = calculateSlashedPrice(baseRoomPrice, roomPromo, roomDisplayCurrency);

                  return (
                  <motion.div
                    key={room.id || `room-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="tm-panel !p-3 sm:!p-4 w-full flex flex-col sm:flex-row md:flex-col lg:flex-row overflow-hidden gap-4 sm:gap-5 min-w-0"
                  >
                    <div className="w-full sm:w-[240px] md:w-full lg:w-[280px] xl:w-[320px] aspect-video overflow-hidden rounded-lg relative group shrink-0">
                      <RoomGallery 
                        images={Array.from(new Set([getRoomImage(room, hotel), ...(room.galleryUrls || [])]))}
                        altPrefix={room.name}
                      />
                    </div>
                    
                    <div className="w-full flex flex-col flex-1 sm:py-1 min-w-0">
                      <div className="flex-1">
                        {roomSlashed.hasDiscount && (
                          <div className="tm-tag tm-tag-warn mb-2">
                            <PromotionIcon saleType={roomSlashed.saleType} className="w-3 h-3" />
                            <span>{roomSlashed.saleTypeLabel} · {roomSlashed.discountPercentage}% off</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-start justify-between gap-2.5 mb-2 sm:mb-2.5">
                          <h3 className="tm-h2 leading-snug flex-1 min-w-0 break-words">{room.name}</h3>
                          <span className="tm-tag shrink-0">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            <span>Up to {room.maxGuests}</span>
                          </span>
                        </div>
                        
                        <FormattedDescription
                          text={room.description}
                          collapsible={true}
                          collapsedHeight={64}
                          expandLabel="Read more"
                          collapseLabel="Show less"
                          fadeGradientClass="from-transparent to-white"
                          buttonClassName="text-stone-900 font-semibold text-xs"
                          className="text-stone-600 text-sm leading-relaxed mb-3"
                        />
                        
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          {!bookingsEnabled ? null : isSoldOut ? (
                            <span className="tm-tag tm-tag-bad">
                              <Info className="h-3.5 w-3.5" />
                              <span>{hasDates ? 'Full on your dates' : 'Not available'}</span>
                            </span>
                          ) : (
                            <span className="tm-tag tm-tag-good">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{status?.remaining != null ? status.remaining : room.quantity} available</span>
                            </span>
                          )}
                          {bookingsEnabled && isOverCapacity && !isSoldOut && (
                            <span className="tm-tag tm-tag-warn">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>Fits {room.maxGuests}, you have {guestsCount}</span>
                            </span>
                          )}
                          {room.packages && room.packages.length > 0 && room.packages.map((pkg, pIdx) => (
                            <span key={`${pkg.id || 'pkg'}-${pIdx}`} className="tm-tag">
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
                      
                      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-stone-100 flex-wrap">
                        <div>
                          {roomSlashed.hasDiscount ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <PriceDisplay amount={baseRoomPrice} currency={roomDisplayCurrency} className="text-stone-400 font-medium line-through decoration-stone-300 text-sm" />
                                <span className="text-xl sm:text-2xl font-serif font-semibold text-stone-900">
                                  <PriceDisplay amount={roomSlashed.slashedPrice} currency={roomDisplayCurrency} />
                                </span>
                                <span className="text-stone-500 text-xs">/ night</span>
                              </div>
                              <div className="text-xs text-emerald-800">
                                You save <PriceDisplay amount={roomSlashed.slashedAmount} currency={roomDisplayCurrency} /> ({roomSlashed.discountPercentage}%)
                              </div>
                              {roomCurrencies(room).filter(c => c !== roomDisplayCurrency).map((code, cIdx) => {
                                const origOther = roomPrice(room, code) ?? 0;
                                const slashedOther = calculateSlashedPrice(origOther, roomPromo, code);
                                return (
                                  <div key={`${code}-${cIdx}`} className="text-xs text-stone-500 mt-0.5">
                                    or <PriceDisplay amount={origOther} currency={code} className="line-through decoration-stone-300" /> <PriceDisplay amount={slashedOther.slashedPrice} currency={code} className="font-semibold text-stone-700" /> / night
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xs text-stone-500 mr-0.5">From</span>
                                <span className="text-xl sm:text-2xl font-serif font-semibold text-stone-900">
                                  <PriceDisplay amount={baseRoomPrice} currency={roomDisplayCurrency} />
                                </span>
                                <span className="text-stone-500 text-xs">
                                  / night {hotel.stayType === 'entire_place' ? '(whole place)' : ''}
                                </span>
                              </div>
                              {roomCurrencies(room).filter(c => c !== roomDisplayCurrency).map((code, cIdx) => (
                                <div key={`${code}-${cIdx}`} className="text-xs text-stone-500 mt-0.5">
                                  or <PriceDisplay amount={roomPrice(room, code) ?? 0} currency={code} /> / night {hotel.stayType === 'entire_place' ? '(whole place)' : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {bookingsEnabled && (
                        <button
                          type="button"
                          onClick={() => initiateBooking(room)}
                          disabled={isSoldOut || !isBookable || isOverCapacity}
                          className="tm-btn tm-btn-secondary whitespace-nowrap"
                        >
                          {isSoldOut ? 'Unavailable' : isOverCapacity ? `Fits ${room.maxGuests}` : (hotel.stayType === 'entire_place' ? 'Book the whole place' : 'Book this room')}
                        </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}

            {/* Reach the property directly. In directory mode this is the only way
                to reach a property, so it always shows (with a note when empty). */}
            {(!bookingsEnabled || hasAnyContact(hotel) || canChat || hasSocialLinks(hotel)) && (
              <div id="contact-host-section" className="tm-panel scroll-mt-28 sm:scroll-mt-32 mt-6 sm:mt-8 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                      <h3 className="tm-h2 flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-stone-500" /> Contact the property
                      </h3>
                      {bookingsEnabled && (
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2.5 w-2.5">
                          {hostStatus === 'online' && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60"></span>
                          )}
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hostStatus === 'online' ? 'bg-emerald-500' : hostStatus === 'away' ? 'bg-amber-400' : 'bg-stone-300'}`}></span>
                        </span>
                        <span className="text-xs font-medium text-stone-500">
                          {hostStatus === 'online' ? 'Online' : hostStatus === 'away' ? 'Away' : 'Offline'}
                        </span>
                      </div>
                      )}
                    </div>
                    {bookingsEnabled ? (
                      <p className="tm-muted">
                        Ask about activities, special requests or your arrival.
                      </p>
                    ) : (
                      <>
                        <p className="tm-muted">
                          {hasAnyContact(hotel)
                            ? 'Ask the property about rooms, rates, dates and your arrival.'
                            : 'This property has not listed contact details yet.'}
                        </p>
                        <p className="text-xs text-stone-500 mt-1">
                          Travel Malawi does not take bookings or payments. Arrangements are made directly with the property.
                        </p>
                      </>
                    )}
                    <SocialLinks
                      facebook={hotel.socialFacebook}
                      instagram={hotel.socialInstagram}
                      name={hotel.name}
                      className="-ml-2 mt-1"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto mt-3 md:mt-0">
                    {canChat && (
                      <div className="relative inline-block w-full sm:w-auto">
                        <button
                          type="button"
                          id="btn-hotel-host-chat"
                          onClick={handleOpenChat}
                          className="tm-btn tm-btn-secondary w-full sm:w-auto"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>{hostStatus === 'online' ? 'Chat with the host' : 'Send a message'}</span>
                        </button>
                        <WalkthroughTooltip
                          id="walkthrough-hotel-host-chat"
                          icon="💬"
                          title="Direct Host Chat"
                          description="Have questions before booking? Chat directly with the host right here."
                          arrowPosition="top-center"
                          className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2.5 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] pointer-events-auto z-30"
                        />
                      </div>
                    )}
                    {telLink(hotel.contactPhone) && (
                      <a
                        href={telLink(hotel.contactPhone)!}
                        className="tm-btn tm-btn-secondary w-full sm:w-auto"
                      >
                        <PhoneCall className="h-4 w-4" /> {hotel.contactPhone}
                      </a>
                    )}
                    {(whatsappEnabled || !bookingsEnabled) && whatsappLink(hotel.contactWhatsapp || hotel.contactPhone, `Hello ${hotel.name}, I have a question about staying with you.`) && (
                      <a
                        href={whatsappLink(hotel.contactWhatsapp || hotel.contactPhone, `Hello ${hotel.name}, I have a question about staying with you.`)!}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="tm-btn tm-btn-secondary w-full sm:w-auto"
                      >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    )}
                    {mailtoLink(hotel.contactEmail, `Enquiry about ${hotel.name}`) && (
                      <a
                        href={mailtoLink(hotel.contactEmail, `Enquiry about ${hotel.name}`)!}
                        className="tm-btn tm-btn-secondary w-full sm:w-auto min-w-0"
                      >
                        <Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{hotel.contactEmail}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            </>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                <div className="tm-panel flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="tm-h2 mb-0.5">{bookingsEnabled ? 'Book a meeting room' : 'Meeting rooms'}</h3>
                    <p className="tm-muted">{bookingsEnabled ? 'Contact the property to reserve a room or ask about event packages.' : 'Ask the property directly about meeting rooms and event packages.'}</p>
                  </div>
                  <div className="tm-actions shrink-0">
                    {canChat && (
                      <button
                        type="button"
                        onClick={handleOpenChat}
                        className="tm-btn tm-btn-primary"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Chat
                      </button>
                    )}
                    {hotel.contactPhone && (
                      <a href={`tel:${hotel.contactPhone}`} className="tm-btn tm-btn-secondary">
                        Call {hotel.contactPhone}
                      </a>
                    )}
                    {hotel.contactEmail && (
                      <a href={`mailto:${hotel.contactEmail}`} className="tm-btn tm-btn-secondary">
                        Email
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4 pb-2">
                {conferenceRooms.map((room, cIdx) => {
                  const confPromo = hotel ? getActivePromotion(hotel, checkIn || malawiToday(), 'conference') : null;
                  const confDisplayCurrency = room.priceCurrency || 'MWK';
                  const confBasePrice = room.price ?? null;
                  const confSlashed = confBasePrice != null && confPromo ? calculateSlashedPrice(confBasePrice, confPromo, confDisplayCurrency) : null;
                  const rateTypeStr = room.rateType === 'per_half_day' ? 'half day' : room.rateType === 'per_hour' ? 'hour' : room.rateType === 'per_delegate' ? 'delegate' : 'day';

                  return (
                  <motion.div
                    key={room.id || `conf-room-${cIdx}`}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="tm-panel !p-3 sm:!p-4 w-full flex flex-col sm:flex-row overflow-hidden gap-4 sm:gap-5 min-w-0"
                  >
                    <div className="w-full sm:w-[240px] md:w-[280px] lg:w-[320px] aspect-video overflow-hidden rounded-lg relative group shrink-0">
                      <RoomGallery 
                        images={Array.from(new Set([room.imageUrl, ...(room.galleryUrls || [])]))}
                        altPrefix={room.name}
                      />
                    </div>
                    
                    <div className="w-full flex flex-col flex-1 sm:py-1 min-w-0">
                      <div className="flex-1">
                        {confPromo && (
                          <div className="tm-tag tm-tag-warn mb-2">
                            <PromotionIcon saleType={confPromo.saleType} className="w-3 h-3" />
                            <span>{getSaleTypeLabel(confPromo.saleType, confPromo.saleTypeCustomLabel)} · {confPromo.discountPercentage}% off</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-start justify-between gap-2.5 mb-2">
                          <h3 className="tm-h2 leading-snug min-w-0 break-words">{room.name}</h3>
                          <div className="tm-tag shrink-0">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            <span>Up to {room.capacity}</span>
                          </div>
                        </div>
                        
                        <FormattedDescription
                          text={room.description}
                          collapsible={true}
                          collapsedHeight={64}
                          expandLabel="Read more"
                          collapseLabel="Show less"
                          fadeGradientClass="from-transparent to-white"
                          buttonClassName="text-stone-900 font-semibold text-xs"
                          className="text-stone-600 text-sm leading-relaxed mb-3"
                        />
                        
                        {room.amenities && room.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3 sm:mb-4">
                            {room.amenities.map((a, aIdx) => (
                              <span key={`${a}-${aIdx}`} className="tm-tag">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Conference Pricing & Policies Card */}
                      {(room.pricing || confBasePrice != null || (room.policies && room.policies.length > 0)) && (
                        <div className="mt-3 pt-3 border-t border-stone-100">
                          {/* Slashed Structured Rate */}
                          {confBasePrice != null && confSlashed ? (
                            <div className="mb-3">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <PriceDisplay amount={confBasePrice} currency={confDisplayCurrency} className="text-stone-400 font-medium line-through decoration-stone-300 text-sm" />
                                <span className="text-lg sm:text-xl font-serif font-semibold text-stone-900">
                                  <PriceDisplay amount={confSlashed.slashedPrice} currency={confDisplayCurrency} />
                                </span>
                                <span className="text-stone-500 text-xs">/ {rateTypeStr}</span>
                              </div>
                              <div className="text-xs text-emerald-800">
                                You save <PriceDisplay amount={confSlashed.slashedAmount} currency={confDisplayCurrency} /> ({confSlashed.discountPercentage}%)
                              </div>
                            </div>
                          ) : confBasePrice != null ? (
                            <div className="mb-3">
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-serif font-semibold text-stone-900">
                                  <PriceDisplay amount={confBasePrice} currency={confDisplayCurrency} />
                                </span>
                                <span className="text-stone-500 text-xs">/ {rateTypeStr}</span>
                              </div>
                            </div>
                          ) : null}

                          {room.pricing && (
                            <div className="mb-3">
                              <h4 className="tm-muted mb-0.5">Prices and packages</h4>
                              <p className="text-sm text-stone-800 break-words">{room.pricing}</p>
                              {confPromo && confBasePrice == null && (
                                <p className="text-[11px] text-stone-700 font-medium mt-1 flex items-center gap-1.5">
                                  <PromotionIcon saleType={confPromo.saleType} className="w-3 h-3 text-stone-700" />
                                  <span>{confPromo.discountPercentage}% discount applies to this space under {getSaleTypeLabel(confPromo.saleType, confPromo.saleTypeCustomLabel)}.</span>
                                </p>
                              )}
                            </div>
                          )}
                          
                          {room.policies && room.policies.length > 0 && (
                            <div>
                              <h4 className="tm-muted mb-1">Good to know</h4>
                              <ul className="space-y-1">
                                {room.policies.map((policy, idx) => (
                                  <li key={idx} className="text-sm text-stone-600 flex items-start gap-1.5">
                                    <span className="text-stone-400 mt-0.5">•</span>
                                    <span className="leading-tight">{policy}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                  );
                })}
                </div>
              </div>
            )}
          </div>

          {/* Property Policies Card (Directly Below Rooms) */}
          {(activeSpaceTab === 'rooms' ? rooms.length > 0 : conferenceRooms.length > 0) && (
          <div id="policies-section" className="tm-panel scroll-mt-28 sm:scroll-mt-36 mb-8 sm:mb-10 lg:mb-12 min-w-0">
            <h3 className="tm-h2 flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-stone-500 shrink-0" /> {activeSpaceTab === 'rooms' ? 'House rules' : 'Meeting room rules'}
            </h3>

            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
              {activeSpaceTab === 'rooms' && (<>
                <div className="min-w-0">
                  <dt className="tm-muted flex items-center gap-1"><LogIn className="w-3.5 h-3.5 shrink-0" /> Check-in</dt>
                  <dd className="font-medium text-stone-900 break-words">From {formatTime(hotel.checkInTime ?? '14:00')}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="tm-muted flex items-center gap-1"><LogOut className="w-3.5 h-3.5 shrink-0" /> Check-out</dt>
                  <dd className="font-medium text-stone-900 break-words">Until {formatTime(hotel.checkOutTime ?? '11:00')}</dd>
                </div>
              </>)}
              {/* Directory mode: only the property's own stated cancellation terms, no payment row */}
              {(bookingsEnabled || (activeSpaceTab === 'rooms' ? hotel.cancellationPolicy : hotel.conferenceCancellationPolicy)) && (
              <div className="min-w-0">
                <dt className="tm-muted flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Cancellation</dt>
                <dd className="font-medium text-stone-900 break-words">
                  {activeSpaceTab === 'rooms' ? (hotel.cancellationPolicy || "Free 7d prior") : (hotel.conferenceCancellationPolicy || "Non-refundable")}
                </dd>
              </div>
              )}
              {bookingsEnabled && (
              <div className="min-w-0">
                <dt className="tm-muted flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 shrink-0" /> Payment</dt>
                <dd className="font-medium text-stone-900 break-words">
                  {activeSpaceTab === 'rooms' ? (hotel.paymentPolicy || "Pay at property") : (hotel.conferencePaymentPolicy || "Deposit required")}
                </dd>
              </div>
              )}
              {activeSpaceTab === 'rooms' && hotel.childPolicy?.enabled && (
                <div className="min-w-0">
                  <dt className="tm-muted flex items-center gap-1"><Users className="w-3.5 h-3.5 shrink-0" /> Children</dt>
                  <dd className="font-medium text-stone-900 break-words">
                    {hotel.childPolicy.allowed === false ? 'Adults only (18+)' : hotel.childPolicy.freeUnderAge ? `Free under ${hotel.childPolicy.freeUnderAge}` : 'Children welcome'}
                  </dd>
                </div>
              )}
            </dl>

            {/* Reception Hours */}
            {hasPublishedHours(hotel.hours) && (
              <div className="tm-divider mt-4 pt-4 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                    <Clock className="h-4 w-4 text-stone-500 shrink-0" /> Reception hours
                  </span>
                  {isOpenAt(hotel.hours) === true ? (
                    <span className="tm-tag tm-tag-good">Open now</span>
                  ) : isOpenAt(hotel.hours) === false ? (
                    <span className="tm-tag">Closed now</span>
                  ) : null}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {summariseHours(hotel.hours!).map((row, rIdx) => (
                    <div key={`${row.label}-${rIdx}`} className="flex justify-between gap-2 min-w-0">
                      <dt className="text-stone-500 shrink-0">{row.label}</dt>
                      <dd className="font-medium text-stone-900 text-right">{row.hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Conference guidelines */}
            {activeSpaceTab === 'conferences' && hotel.conferenceGuidelines && (
              <div className="tm-divider mt-4 pt-4">
                <p className="text-sm font-semibold text-stone-900 mb-1">Guidelines</p>
                <FormattedDescription
                  text={hotel.conferenceGuidelines}
                  collapsible={true}
                  collapsedHeight={75}
                  expandLabel="Read more"
                  collapseLabel="Show less"
                  fadeGradientClass="from-transparent to-white"
                  buttonClassName="text-stone-900 font-semibold text-xs"
                  className="text-stone-700 text-sm"
                  paragraphClassName="text-stone-700 leading-relaxed mb-1.5 last:mb-0"
                />
              </div>
            )}

            {/* Deposit & payment instructions (booking mode only) */}
            {bookingsEnabled && hotel.depositInfo?.instructions && (
              <div className="tm-divider mt-4 pt-4">
                <p className="text-sm font-semibold text-stone-900 mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-stone-500 shrink-0" /> How to pay a deposit
                </p>
                <FormattedDescription
                  text={hotel.depositInfo.instructions}
                  collapsible={true}
                  collapsedHeight={75}
                  expandLabel="Read more"
                  collapseLabel="Show less"
                  fadeGradientClass="from-transparent to-white"
                  buttonClassName="text-stone-900 font-semibold text-xs"
                  className="text-stone-700 text-sm"
                  paragraphClassName="text-stone-700 leading-relaxed mb-1.5 last:mb-0"
                />
              </div>
            )}

            <p className="tm-muted mt-4">Need a special request or a different arrival time? {bookingsEnabled ? 'Ask the host.' : 'Ask the property directly.'}</p>
          </div>
          )}

          {/* Location: one map with Map · Directions · Notes tabs */}
          <div id="location-setting" className="scroll-mt-28 sm:scroll-mt-36 mb-8 sm:mb-10 lg:mb-12">
            <DirectionsPanel
              hotelName={hotel.name}
              location={hotel.location}
              coordinates={resolveHotelCoordinates(hotel)}
              locationNotes={hotel.locationNotes}
              hotelImage={getHotelImage(hotel)}
              hotelId={hotel.id}
              openDirections={isDirectionsOpenMobile}
            />
          </div>

                    {/* Restaurant Menu */}
          {restaurant && (
            <div id="restaurant-menu" className="scroll-mt-28 sm:scroll-mt-36 mb-12 sm:mb-16 lg:mb-20 pt-6 sm:pt-8 border-t border-stone-200">
              <div className="mb-4 sm:mb-6">
                <h2 className="tm-h1">Food and drink</h2>
              </div>
              {hasPublishedHours(restaurant.hours) && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
                  <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1.5 text-xs sm:text-sm">
                    <span className="flex items-center gap-2 font-semibold text-stone-900">
                      <Clock className="h-4 w-4 text-stone-500" />
                      <span>Kitchen hours</span>
                    </span>
                    {summariseHours(restaurant.hours!).map((row, rIdx) => (
                      <span key={`${row.label}-${rIdx}`} className="text-stone-600 font-medium text-xs sm:text-sm">
                        <span className="text-stone-400 font-normal">{row.label}:</span> {row.hours}
                      </span>
                    ))}
                  </div>
                  {isOpenAt(restaurant.hours) === true ? (
                    <span className="tm-tag tm-tag-good">
                      Serving now
                    </span>
                  ) : (
                    <span className="tm-tag">
                      Kitchen closed
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
        </div>
        
        {/* Sticky Sidebar / Highlights (Attached Div - CSS Selector 1) */}
        <div id="property-highlights" className="scroll-mt-28 sm:scroll-mt-36 md:col-span-5 lg:col-span-4 md:row-span-2 md:sticky md:top-24 lg:top-36 flex flex-col gap-4 sm:gap-5 lg:gap-6 md:max-h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-9rem)] md:overflow-y-auto pb-4 sm:pb-6 lg:pb-8 pr-0 md:pr-1 lg:pr-2 pt-0 md:pt-1 lg:pt-2">
          {/* What the place offers: amenities, then host-reported facilities */}
          <div className="tm-panel min-w-0">
            <h3 className="tm-h2 mb-3">What this place offers</h3>
            {hotel.amenities && hotel.amenities.length > 0 ? (
              <ul className="space-y-2">
                {hotel.amenities.map((amenity, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                    <CheckCircle2 className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                    <span className="leading-snug break-words">{amenity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tm-muted">Standard amenities included.</p>
            )}

            {hotel.infrastructure && (() => {
              const infra = hotel.infrastructure;
              const rows = [
                infra.powerSource && infra.powerSource !== 'None' ? { icon: Zap, label: 'Power', value: infra.powerSource } : null,
                infra.waterSource ? { icon: Droplets, label: 'Water', value: infra.waterSource } : null,
                infra.internetSource && infra.internetSource !== 'None' ? { icon: Wifi, label: 'Internet', value: infra.internetSource } : null,
                infra.workspaceSetup && infra.workspaceSetup !== 'None' ? { icon: Monitor, label: 'Workspace', value: infra.workspaceSetup } : null,
                infra.roadAccess ? { icon: Map, label: 'Road access', value: infra.roadAccess } : null,
              ].filter(Boolean) as { icon: typeof Zap; label: string; value: string }[];
              if (rows.length === 0) return null;
              return (
                <div className="tm-divider mt-4 pt-4">
                  <p className="text-sm font-semibold text-stone-900 mb-2">Facilities (from the host)</p>
                  <dl className="space-y-2.5 text-sm">
                    {rows.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="tm-muted">{label}</dt>
                          <dd className="font-medium text-stone-900 break-words">{value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Guest Reviews Section - Positioned as the last section on Mobile before Location & Driving Directions, and in left column on desktop */}
        {activeSpaceTab === 'rooms' && (
          <div id="reviews" className="scroll-mt-28 sm:scroll-mt-36 lg:scroll-mt-28 col-span-1 md:col-span-7 lg:col-span-8 mb-12 sm:mb-16 lg:mb-20 mt-6 sm:mt-8 border-t border-stone-200 pt-6 sm:pt-8 md:pt-10 relative z-10 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                <h2 className="tm-h1">Reviews</h2>
                {ratingSummary && (
                  <span className="tm-muted">
                    {ratingSummary.average.toFixed(1)} average from {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="tm-actions">
                {allReviews.length > 1 && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 min-h-8 text-xs">
                    <span className="text-stone-500">Sort</span>
                    <select
                      value={reviewSort}
                      onChange={(e) => {
                        setReviewSort(e.target.value as 'recent' | 'highest' | 'critical');
                        setCurrentReviewPage(1);
                      }}
                      className="bg-transparent border-none text-stone-800 font-medium text-xs focus:outline-hidden cursor-pointer pr-1"
                      aria-label="Sort guest reviews"
                    >
                      <option value="recent">Newest</option>
                      <option value="highest">Highest rated</option>
                      <option value="critical">Lowest rated</option>
                    </select>
                  </div>
                )}
                {googleMapsReviewsUrl && (
                  <a
                    href={googleMapsReviewsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="tm-btn tm-btn-quiet tm-btn-sm"
                    title="See reviews on Google Maps"
                  >
                    <MapPin className="h-3.5 w-3.5 text-stone-500" />
                    <span>Google reviews</span>
                    <ExternalLink className="h-3 w-3 text-stone-400" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="tm-btn tm-btn-secondary tm-btn-sm"
                >
                  <Star className="h-3.5 w-3.5" />
                  Write a review
                </button>
              </div>
            </div>
            
            {allReviews.length === 0 ? (
              <div className="tm-panel text-center py-8 space-y-3">
                <Star className="w-6 h-6 text-stone-400 mx-auto" />
                <p className="text-sm text-stone-700">No reviews here yet. Stayed here? Share how it went.</p>
                <div className="tm-actions justify-center">
                  {googleMapsReviewsUrl && (
                    <a
                      href={googleMapsReviewsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="tm-btn tm-btn-quiet tm-btn-sm"
                    >
                      <MapPin className="w-3.5 h-3.5 text-stone-600" />
                      <span>Google reviews</span>
                      <ExternalLink className="w-3 h-3 text-stone-400" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(true)}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>Write a review</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {allReviews.slice((currentReviewPage - 1) * reviewsPerPage, currentReviewPage * reviewsPerPage).map((review, rIdx) => (
                    <CompactReviewCard
                      key={`${review.key}-${rIdx}`}
                      review={review}
                      hotelName={hotel?.name}
                      hotelLocation={hotel?.location}
                    />
                  ))}
                </div>
                {allReviews.length > reviewsPerPage && (
                  <Pagination
                    currentPage={currentReviewPage}
                    totalPages={Math.ceil(allReviews.length / reviewsPerPage)}
                    onPageChange={setCurrentReviewPage}
                  />
                )}
                {googleMapsReviewsUrl && (
                  <div className="mt-4 pt-3.5 border-t border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-stone-500">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>Reviews marked verified come from guests who stayed.</span>
                    </span>
                    <a
                      href={googleMapsReviewsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="tm-link inline-flex items-center gap-1 shrink-0"
                    >
                      <span>More on Google Maps</span>
                      <ExternalLink className="w-3 h-3 text-stone-400" />
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
      
      {/* Booking request */}
      {bookingsEnabled && selectedRoom && (() => {
        const activePromo = roomPromotionFor(selectedRoom, checkIn);
        const pricing = computeBookingPricing(
          selectedRoom, checkIn, checkOut, guestsCount, 1, selectedPackages, currency, activePromo,
          { adults: adultsCount, children: childrenCount }, hotel?.childPolicy
        );
        const {
          nights, basePrice, extraGuestFee, extraGuestsCount, packagesTotal,
          total: grandTotal, currency: bookingCurrency, discountPercentage, discountAmount
        } = pricing;
        const roomPrimary = roomPrimaryCurrency(selectedRoom);

        return (
          <Modal
            open
            onClose={() => setSelectedRoom(null)}
            title={`Book · ${selectedRoom.name}`}
            description="Send your dates and details. You pay the property after they confirm."
            size="lg"
            footer={
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-500">
                    {nights > 0 ? `Total · ${nights} night${nights === 1 ? '' : 's'}` : 'Total'}
                  </p>
                  {nights > 0 ? (
                    <p className="text-2xl font-semibold text-stone-900 leading-tight">
                      <PriceDisplay amount={grandTotal} currency={bookingCurrency} />
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
                  className="tm-btn tm-btn-primary shrink-0"
                >
                  {saving ? (isOnline ? 'Sending…' : 'Saving…') : !isOnline ? 'Save and send later' : 'Send request'}
                </button>
              </div>
            }
          >
            <form id="booking-form" onSubmit={handleManualBook} className="space-y-5" noValidate>
              {!isOnline && (
                <p className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <HardDrive className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                  <span>You are offline. We will save this request on your device and send it when you reconnect.</span>
                </p>
              )}
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
                <label className="tm-label" htmlFor="bk-name">Guest name</label>
                <input
                  id="bk-name"
                  type="text"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  aria-invalid={!!fieldErrors.guestName}
                  className={`tm-input ${fieldErrors.guestName ? '!border-red-400' : ''}`}
                  placeholder="Full name"
                />
                {fieldErrors.guestName && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestName}</p>}
              </div>

              <div>
                <label className="tm-label" htmlFor="bk-email">Email</label>
                <input
                  id="bk-email"
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.guestEmail}
                  className={`tm-input ${fieldErrors.guestEmail ? '!border-red-400' : ''}`}
                  placeholder="you@example.com"
                />
                {fieldErrors.guestEmail && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestEmail}</p>}
              </div>

              <div className={`grid grid-cols-1 ${whatsappEnabled ? 'sm:grid-cols-2' : ''} gap-4`}>
                <div>
                  <label className="tm-label">Phone number</label>
                  <PhoneInput
                    international
                    defaultCountry="MW"
                    value={guestPhone}
                    onChange={(val) => setGuestPhone(val || '')}
                    className={`tm-input ${fieldErrors.guestPhone ? '!border-red-400' : ''} !flex items-center`}
                  />
                  {fieldErrors.guestPhone && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestPhone}</p>}
                </div>
                {whatsappEnabled && (
                  <div>
                    <label className="tm-label">WhatsApp <span className="text-stone-400 font-normal">· optional</span></label>
                    <PhoneInput
                      international
                      defaultCountry="MW"
                      value={guestWhatsapp}
                      onChange={(val) => setGuestWhatsapp(val || '')}
                      className={`tm-input ${fieldErrors.guestWhatsapp ? '!border-red-400' : ''} !flex items-center`}
                    />
                    {fieldErrors.guestWhatsapp && <p className="text-xs text-red-600 mt-1.5">{fieldErrors.guestWhatsapp}</p>}
                  </div>
                )}
              </div>

              <div>
                  <span className="tm-label">Dates</span>
                  <DatePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    isDateBlocked={(dateStr) => {
                      if (!selectedRoom) return false;
                      const nextDayStr = addDays(dateStr, 1);
                      const eff = effectiveRooms.find(r => r.id === selectedRoom.id) ?? selectedRoom;
                      return unitsRemaining(eff, bookings, dateStr, nextDayStr) === 0;
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
                <div className="flex items-center justify-between mb-1">
                  <span className="tm-label !mb-0">Guests</span>
                  {hotel?.childPolicy?.enabled && (
                    <span className="tm-muted">
                      {hotel.childPolicy.allowed === false
                        ? 'Adults only (18+)'
                        : hotel.childPolicy.freeUnderAge
                        ? `Children under ${hotel.childPolicy.freeUnderAge} stay free`
                        : hotel.childPolicy.rateType === 'free'
                        ? 'Children stay free'
                        : 'Child policy active'}
                    </span>
                  )}
                </div>

                {hotel?.childPolicy?.enabled && hotel.childPolicy.allowed !== false ? (
                  <div className="divide-y divide-stone-100 border-y border-stone-100">
                    {/* Adults row */}
                    <div className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-sm font-medium text-stone-900">Adults</div>
                        <div className="text-xs text-stone-500">18 and older</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={adultsCount <= 1}
                          onClick={() => setAdultsCount(Math.max(1, adultsCount - 1))}
                          className="h-8 w-8 grid place-items-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">{adultsCount}</span>
                        <button
                          type="button"
                          disabled={(adultsCount + childrenCount) >= selectedRoom.maxGuests}
                          onClick={() => setAdultsCount(Math.min(selectedRoom.maxGuests - childrenCount, adultsCount + 1))}
                          className="h-8 w-8 grid place-items-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Children row */}
                    <div className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-sm font-medium text-stone-900">Children</div>
                        <div className="text-xs text-stone-500">
                          {hotel.childPolicy.freeUnderAge ? `Under ${hotel.childPolicy.freeUnderAge} free` : 'Ages 0 to 17'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={childrenCount <= 0}
                          onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                          className="h-8 w-8 grid place-items-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">{childrenCount}</span>
                        <button
                          type="button"
                          disabled={(adultsCount + childrenCount) >= selectedRoom.maxGuests}
                          onClick={() => setChildrenCount(Math.min(selectedRoom.maxGuests - adultsCount, childrenCount + 1))}
                          className="h-8 w-8 grid place-items-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
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
                        onClick={() => {
                          const next = Math.max(1, guestsCount - 1);
                          setGuestsCount(next);
                          setAdultsCount(next);
                        }}
                        className="h-8 w-8 grid place-items-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{guestsCount}</span>
                      <button
                        type="button"
                        aria-label="More guests"
                        disabled={guestsCount >= selectedRoom.maxGuests}
                        onClick={() => {
                          const next = Math.min(selectedRoom.maxGuests, guestsCount + 1);
                          setGuestsCount(next);
                          setAdultsCount(next);
                        }}
                        className="h-8 w-8 grid place-items-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="tm-label" htmlFor="bk-requests">Special requests <span className="text-stone-400 font-normal">· optional</span></label>
                <textarea
                  id="bk-requests"
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                  maxLength={MAX_SPECIAL_REQUESTS}
                  placeholder="Early check-in, dietary requirements, an occasion we should know about…"
                  className={`tm-input resize-none h-24 ${fieldErrors.specialRequests ? '!border-red-400' : ''}`}
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
                  <span className="tm-label">Add-ons</span>
                  <div className="grid gap-2">
                    {selectedRoom.packages.map((pkg, pIdx) => {
                      const checked = selectedPackages.includes(pkg.id);
                      const amount = packagePrice(pkg, bookingCurrency, roomPrimary);
                      // A package the property never priced in this currency
                      // cannot be sold in it, so it is offered as unavailable
                      // rather than converted at a rate nobody set.
                      const unavailable = amount === null;
                      return (
                        <label
                          key={`${pkg.id || 'pkg'}-${pIdx}`}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
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
                                    {amount > 0 ? <><span className="opacity-60">+</span><PriceDisplay amount={amount} currency={bookingCurrency} /></> : 'Included'}
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

              <div className="border-t border-stone-200 pt-4">
                <div className="pb-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-stone-900">Price</h3>
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
                      {roomCurrencies(selectedRoom).map((code, cIdx) => (
                        <button
                          key={`${code}-${cIdx}`}
                          type="button"
                          onClick={() => chooseCurrency(code)}
                          aria-pressed={bookingCurrency === code}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
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
                      <span className="flex items-center gap-1"><PriceDisplay amount={basePrice} currency={bookingCurrency} /> &times; {nights} night{nights === 1 ? '' : 's'}</span>
                      <PriceDisplay className="text-stone-900" amount={basePrice * nights} currency={bookingCurrency} />
                    </div>

                    {extraGuestsCount > 0 && extraGuestFee > 0 && (
                      <div className="flex justify-between text-stone-600">
                        <span className="flex items-center gap-1">Extra guests ({extraGuestsCount} &times; <PriceDisplay amount={extraGuestFee} currency={bookingCurrency} /> &times; {nights}n)</span>
                        <PriceDisplay className="text-stone-900" amount={extraGuestsCount * extraGuestFee * nights} currency={bookingCurrency} />
                      </div>
                    )}

                    {packagesTotal > 0 && (
                      <div className="flex justify-between text-stone-600">
                        <span>Add-ons</span>
                        <span className="flex items-center"><span className="opacity-60">+</span><PriceDisplay amount={packagesTotal} currency={bookingCurrency} /></span>
                      </div>
                    )}
                    
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-800 font-medium">
                        <span className="flex items-center gap-1.5">
                          {activePromo && <PromotionIcon saleType={activePromo.saleType} className="w-3.5 h-3.5 text-stone-600" />}
                          <span>Discount ({discountPercentage}% off)</span>
                        </span>
                        <span className="flex items-center font-semibold"><span className="opacity-60">-</span><PriceDisplay amount={discountAmount} currency={bookingCurrency} /></span>
                      </div>
                    )}

                    <div className="flex justify-between items-baseline border-t border-stone-200 pt-3 mt-3">
                      <span className="font-semibold text-stone-900">Total</span>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-stone-900 tabular-nums">
                          <PriceDisplay amount={grandTotal} currency={bookingCurrency} />
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
                Nothing is charged now. The property confirms, then you pay them directly. Always check details with the property before sending money.
              </p>
            </form>
          </Modal>
        );
      })()}

      {bookingStatus && !anyDialogOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 bg-stone-900 text-white px-5 py-3 rounded-lg shadow-sm text-sm font-medium z-50 max-w-[calc(100vw-2rem)]">
          {bookingStatus}
        </div>
      )}
      
      {/* Floating Chat Trigger Button.
          Hidden whenever a dialog is up or when chat is already open/active in the global persistent dock. */}
      {canChat && !anyDialogOpen && !activeChat && (
        <div 
          className={`fixed bottom-6 z-50 pointer-events-none transition-all duration-200 ${
            user && (isAdmin(user) || isHotelManager(user))
              ? 'right-[4.75rem] sm:right-24'
              : 'right-[4.75rem] md:right-8'
          }`}
        >
          <motion.button
            type="button"
            id="btn-contact-host-floating"
            onClick={handleOpenChat}
            className="pointer-events-auto relative flex items-center justify-center w-12 h-12 rounded-full bg-stone-900 hover:bg-stone-800 text-white shadow-sm transition-colors cursor-pointer select-none"
            whileTap={{ scale: 0.96 }}
            title={hostStatus === 'online' ? 'Chat with the host (online)' : 'Chat with the host'}
            aria-label="Chat with the host"
          >
            <div className="relative flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
              <span 
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-stone-900 ${
                  hostStatus === 'online' ? 'bg-emerald-500' : 'bg-stone-400'
                }`} 
              />
            </div>
          </motion.button>
        </div>
      )}

      {/* Review Modal */}
      {hotel.id && (
        <ReviewModal
          hotelId={hotel.id}
          hotelName={hotel.name}
          googleMapsReviewsUrl={googleMapsReviewsUrl}
          open={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onReviewSubmitted={(newRev) => {
            if (newRev) {
              setReviews(prev => [newRev, ...prev.filter(r => r.id !== newRev.id)]);
            } else {
              window.location.reload();
            }
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
          initialIndex={hotelGalleryInitialIndex}
          onClose={() => setShowHotelGallery(false)}
        />
      )}
    </div>
  );
}

