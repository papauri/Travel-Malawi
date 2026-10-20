import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import {
  collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc, onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Booking, Hotel, RoomType, Broadcast } from '../types';
import {
  Calendar, MapPin, ExternalLink, Clock, CheckCircle2, XCircle, Ban, Star, Copy, ShieldCheck, Users, MessageCircle, Phone, Info, Map as MapIcon, MessageSquare, Megaphone, X, Check, Building2, Mail, Edit2, Filter as FilterIcon, ChevronDown
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import FieldError from '../components/FieldError';
import BookingChat from '../components/BookingChat';
import { logSystemEvent } from '../lib/logger';
import { useChatModal } from '../contexts/ChatModalContext';
import { usePlatformMode } from '../contexts/PlatformModeContext';
import StayVoucherModal from '../components/StayVoucherModal';
import { getHotelImage } from '../lib/images';
import { formatDateStr, daysUntil, nightsBetween } from '../lib/dates';
import { cancellationTerms, formatMoney, isStayComplete, FREE_CANCELLATION_DAYS } from '../lib/booking';
import { isTraveller, isAdmin, isMarketing } from '../lib/roles';
import { updateBookingWithSlot, cancelBookingReminders } from '../lib/bookingWrites';
import { useConfirmBooking } from '../hooks/useConfirmBooking';
import { EMAIL_PATTERN } from '../lib/contact';
import { isCurrencyCode, roomPrice } from '../lib/currency';
import PriceMismatchNotice from '../components/PriceMismatchNotice';
import PriceDisplay from '../components/PriceDisplay';
import OfflineBookingsQueue from '../components/OfflineBookingsQueue';

type EnrichedBooking = Booking & { hotel?: Hotel; room?: RoomType };
type Filter = 'upcoming' | 'past' | 'cancelled';

/**
 * Directory mode (the default) switches bookings off: a direct link here shows
 * one line and a way home, and none of the booking listeners below are opened.
 */
export default function MyBookings() {
  const { bookingsEnabled, loading } = usePlatformMode();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-stone-700"></div>
    </div>
  );
  if (!bookingsEnabled) return (
    <div className="min-h-screen bg-stone-50 pt-16 pb-24">
      <div className="max-w-xl mx-auto px-6 text-center">
        <p className="tm-lead mx-auto mb-6">
          Bookings and in-app messages are switched off. Contact properties directly from their listing.
        </p>
        <Link to="/" className="tm-btn tm-btn-primary">Go to the home page</Link>
      </div>
    </div>
  );
  return <MyBookingsPage />;
}

function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHost, setLoadingHost] = useState(true);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [cancelTarget, setCancelTarget] = useState<EnrichedBooking | null>(null);
  const [editBookingTarget, setEditBookingTarget] = useState<EnrichedBooking | null>(null);
  const [reviewTarget, setReviewTarget] = useState<EnrichedBooking | null>(null);
  const [voucherTarget, setVoucherTarget] = useState<EnrichedBooking | null>(null);
  const [confirmModalBooking, setConfirmModalBooking] = useState<EnrichedBooking | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const confirmFlow = useConfirmBooking();
  const { openBookingChat } = useChatModal();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [bookingReminders, setBookingReminders] = useState<Record<string, any[]>>({});
  const [showRemindersFor, setShowRemindersFor] = useState<string | null>(null);

  const fetchReminders = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/reminders/${bookingId}`);
      const data = await res.json();
      setBookingReminders(prev => ({ ...prev, [bookingId]: data.reminders || [] }));
    } catch { /* ignore */ }
  };

  const { openAuth } = useAuthDialog();
  const [activeMainTab, setActiveMainTab] = useState<'guest' | 'host'>('guest');
  const [managerHotels, setManagerHotels] = useState<Hotel[]>([]);
  const [hostBookings, setHostBookings] = useState<EnrichedBooking[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const uid = user.uid;

    try {
      const cached = localStorage.getItem(`myBookingsCache_${uid}`);
      if (cached) {
        setBookings(JSON.parse(cached));
        setLoading(false);
      }
      const cachedHost = localStorage.getItem(`hostBookingsCache_${uid}`);
      if (cachedHost) {
        setHostBookings(JSON.parse(cachedHost));
        setLoadingHost(false);
      }
      const cachedHotels = localStorage.getItem(`managerHotelsCache_${uid}`);
      if (cachedHotels) {
        const parsed = JSON.parse(cachedHotels);
        setManagerHotels(parsed);
        if (parsed.length > 0) setActiveMainTab('host');
      }
    } catch (e) {
      console.warn('Failed to read bookings cache', e);
    }

    async function fetchHostData() {
      try {
        const querySnapshot = await getDocs(collection(db, 'hotels'));
        const allHotels = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        const userEmailLower = user?.email?.toLowerCase();
        const userIsAdmin = isAdmin(user) || isMarketing(user);

        const hotels = allHotels.filter(h => {
          if (userIsAdmin) return true;
          const hasAssignedManager = Boolean(
            h.managerId &&
            h.managerId !== 'unassigned' &&
            h.managerId !== 'none' &&
            h.managerId.trim() !== ''
          );
          if (hasAssignedManager && h.managerId === uid) return true;
          // Same owner fields the security rules accept.
          const extra = h as Hotel & { ownerId?: string; createdBy?: string };
          if (extra.ownerId === uid || extra.createdBy === uid) return true;
          if (userEmailLower) {
            if (h.managerEmail && h.managerEmail.toLowerCase() === userEmailLower) return true;
            if (h.ownerEmail && h.ownerEmail.toLowerCase() === userEmailLower) return true;
            if (h.contactEmail && h.contactEmail.toLowerCase() === userEmailLower) return true;
          }
          return false;
        });

        // The rules only honour an email match once the address is verified;
        // say so instead of showing an empty host tab.
        if (!userIsAdmin && auth.currentUser && !auth.currentUser.emailVerified
            && hotels.some(h => h.managerId !== uid && [h.managerEmail, h.ownerEmail, h.contactEmail]
              .some(e => e && e.toLowerCase() === userEmailLower))) {
          toast.error('Verify your email address to see bookings for the properties listed under it, then sign in again.', { id: 'verify-email-bookings' });
        }

        setManagerHotels(hotels);
        try {
          localStorage.setItem(`managerHotelsCache_${uid}`, JSON.stringify(hotels));
        } catch {}

        if (hotels.length > 0) {
          setActiveMainTab('host');
          const hIds = hotels.map(h => h.id).filter(Boolean) as string[];
          if (hIds.length > 0) {
            // One equality query per property: the rules authorise a manager's
            // read through the hotel document, which they cannot do for an
            // 'in' query. A hotel the rules refuse is skipped, not fatal.
            const perHotel = await Promise.all(hIds.map(hid =>
              getDocs(query(collection(db, 'bookings'), where('hotelId', '==', hid)))
                .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)))
                .catch(err => {
                  console.warn(`Bookings for ${hid} unavailable:`, err?.message ?? err);
                  return [] as Booking[];
                })
            ));
            const allHostBookings: Booking[] = perHotel.flat();

            const roomIds = [...new Set(allHostBookings.map(b => b.roomTypeId).filter(Boolean) as string[])];
            const roomSnaps = await Promise.all(roomIds.map(rid => getDoc(doc(db, 'room_types', rid))));
            const roomsById = new Map(roomSnaps.filter(s => s.exists()).map(s => [s.id, { id: s.id, ...s.data() } as RoomType]));

            const enrichedHost: EnrichedBooking[] = allHostBookings.map(b => ({
              ...b,
              hotel: hotels.find(h => h.id === b.hotelId),
              room: roomsById.get(b.roomTypeId),
            }));
            enrichedHost.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setHostBookings(enrichedHost);
            try {
              localStorage.setItem(`hostBookingsCache_${uid}`, JSON.stringify(enrichedHost));
            } catch {}
          }
        }
      } catch (err) {
        console.error("Error fetching host data:", err);
      } finally {
        setLoadingHost(false);
      }
    }

    async function fetchBookings() {
      try {
        const docs = await getDocs(query(collection(db, 'bookings'), where('guestId', '==', uid)));
        const bookingsData = docs.docs.map(d => ({ id: d.id, ...d.data() } as Booking));

        const hotelIds = [...new Set(bookingsData.map(b => b.hotelId).filter(Boolean))];
        const roomIds = [...new Set(bookingsData.map(b => b.roomTypeId).filter(Boolean))];

        const [hotelSnaps, roomSnaps] = await Promise.all([
          Promise.all(hotelIds.map(hid => getDoc(doc(db, 'hotels', hid)))),
          Promise.all(roomIds.map(rid => getDoc(doc(db, 'room_types', rid)))),
        ]);

        const hotelsById = new Map(
          hotelSnaps.filter(s => s.exists()).map(s => [s.id, { id: s.id, ...s.data() } as Hotel])
        );
        const roomsById = new Map(
          roomSnaps.filter(s => s.exists()).map(s => [s.id, { id: s.id, ...s.data() } as RoomType])
        );

        const enriched: EnrichedBooking[] = bookingsData.map(booking => ({
          ...booking,
          hotel: hotelsById.get(booking.hotelId),
          room: roomsById.get(booking.roomTypeId),
        }));
        enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBookings(enriched);
        try {
          localStorage.setItem(`myBookingsCache_${uid}`, JSON.stringify(enriched));
        } catch (e) {
          console.warn('Failed to cache bookings', e);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
        if (navigator.onLine) {
          toast.error('Could not load your bookings.');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
    fetchHostData();

    getDocs(query(collection(db, 'reviews'), where('guestId', '==', uid)))
      .then(snap => setReviewedBookingIds(new Set(snap.docs.map(d => d.data().bookingId as string))))
      .catch(error => console.warn('Could not load your reviews:', error?.message ?? error));
  }, [user, authLoading, navigate]);

  const handleConfirmHostBooking = async (booking: EnrichedBooking) => {
    if (!booking.id) return;
    const { hotel, room, ...plain } = booking;
    const newPin = booking.arrivalPin || Math.floor(1000 + Math.random() * 9000).toString();
    await confirmFlow.confirm(plain as Booking, {
      room: room ?? null,
      hotel: hotel ?? null,
      extraPatch: { updatedAt: Date.now(), voucherIssued: true, arrivalPin: newPin },
      onConfirmed: async (written) => {
        setHostBookings(prev => prev.map(b => (b.id === booking.id ? { ...b, ...written, status: 'confirmed', voucherIssued: true, arrivalPin: newPin } : b)));
        toast.success(`Booking ${booking.reference || ''} confirmed! Digital voucher issued.`);
        
        // Trigger automated reminder sequences
        try {
          await fetch('/api/reminders/auto-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: booking.id,
              bookingId: booking.id,
              reference: booking.reference,
              hotelId: booking.hotelId,
              hotelName: hotel?.name,
              guestName: booking.guestName,
              guestEmail: booking.guestEmail,
              guestPhone: booking.guestPhone,
              guestWhatsapp: booking.guestWhatsapp,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              roomName: room?.name,
              arrivalPin: newPin,
              totalPrice: booking.total ? `${booking.currency || 'MWK'} ${Number(booking.total).toLocaleString()}` : undefined,
              automationSettings: hotel?.emailAutomationSettings,
              wifiName: hotel?.infrastructure?.wifiSSID,
              wifiPassword: hotel?.infrastructure?.wifiPassword,
              managerPhone: hotel?.contactPhone || hotel?.contactWhatsapp || hotel?.managerPhone,
              managerEmail: hotel?.contactEmail || hotel?.managerEmail,
            }),
          });
        } catch { /* non-blocking */ }

        // Send confirmation email notice to guest
        if (booking.guestEmail) {
          const hotelName = hotel?.name || 'the property';
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: booking.guestEmail,
              bookingId: booking.id,
              hotelId: booking.hotelId,
              subject: `Booking Confirmed: ${hotelName} (Ref: #${booking.reference})`,
              message: `Dear ${booking.guestName},\n\nGreat news! Your booking at ${hotelName} has been confirmed and your digital voucher is now available.\n\nDates: ${booking.checkIn} to ${booking.checkOut}\nRoom: ${room?.name || 'Reserved Room'}\nBooking Reference: #${booking.reference}\nArrival / Security Gate PIN: ${newPin}\n\nYou can access your digital voucher and arrival pass anytime from your Travel Malawi account: /my-bookings.\n\nWe look forward to hosting you!`,
            }),
          }).catch(console.error);
        }

        await logSystemEvent('action', `Manager confirmed booking ${booking.reference}`, {
          bookingId: booking.id,
          reference: booking.reference,
          status: 'confirmed'
        }, user, 'booking');
      },
    });
  };

  const handleRejectHostBooking = async (booking: EnrichedBooking) => {
    if (!booking.id) return;
    setBusyId(booking.id);
    try {
      await updateBookingWithSlot(booking.id, {
        status: 'rejected',
        rejectedAt: Date.now(),
        cancelledBy: 'manager',
        updatedAt: Date.now(),
      }, booking as any);
      cancelBookingReminders(booking.id);
      setHostBookings(prev => prev.map(b => (b.id === booking.id ? { ...b, status: 'rejected' } : b)));
      toast.success(`Booking ${booking.reference || ''} declined.`);

      await logSystemEvent('action', `Manager rejected booking ${booking.reference}`, {
        bookingId: booking.id,
        reference: booking.reference,
        status: 'rejected'
      }, user, 'booking');
    } catch (err) {
      console.error('Error declining booking:', err);
      toast.error('Failed to decline booking.');
    } finally {
      setBusyId(null);
    }
  };

  const grouped = useMemo(() => {
    const upcoming: EnrichedBooking[] = [];
    const past: EnrichedBooking[] = [];
    const cancelled: EnrichedBooking[] = [];
    for (const booking of bookings) {
      if (booking.status === 'cancelled' || booking.status === 'rejected') cancelled.push(booking);
      else if (daysUntil(booking.checkOut) < 0) past.push(booking);
      else upcoming.push(booking);
    }
    return { upcoming, past, cancelled };
  }, [bookings]);

  const visible = grouped[filter];

  
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [hiddenBroadcastIds, setHiddenBroadcastIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hiddenBroadcasts') || '[]');
    } catch {
      return [];
    }
  });

  const upcomingHotelIds = useMemo(() => {
    return Array.from(new Set(grouped.upcoming.map(b => b.hotelId))).filter(Boolean) as string[];
  }, [grouped.upcoming]);

  // Mark broadcasts as seen when viewed
  useEffect(() => {
    if (filter === 'upcoming' && broadcasts.length > 0) {
      const seenIds = JSON.parse(localStorage.getItem('seenBroadcasts') || '[]');
      let updated = false;
      broadcasts.forEach(b => {
        if (!seenIds.includes(b.id)) {
          seenIds.push(b.id);
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem('seenBroadcasts', JSON.stringify(seenIds));
        // We dispatch a custom event so the Navbar badge can update instantly
        window.dispatchEvent(new Event('broadcasts-seen'));
      }
    }
  }, [broadcasts, filter]);

  useEffect(() => {
    if (upcomingHotelIds.length === 0) {
      setBroadcasts([]);
      return;
    }
    const batch = upcomingHotelIds.slice(0, 30);
    const q = query(
      collection(db, 'broadcasts'),
      where('hotelId', 'in', batch),
      where('isActive', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast));
      docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBroadcasts(docs);
    }, (err) => {
      console.warn('Failed to listen to broadcasts:', err);
    });
    return () => unsub();
  }, [upcomingHotelIds]);

  const handleCancel = async (booking: EnrichedBooking) => {
    if (!booking.id) return;
    setBusyId(booking.id);
    try {
      await updateBookingWithSlot(booking.id, {
        status: 'cancelled',
        cancelledAt: Date.now(),
        cancelledBy: 'guest',
        updatedAt: Date.now(),
      }, booking as any);
      cancelBookingReminders(booking.id);
      setBookings(prev =>
        prev.map(b => (b.id === booking.id ? { ...b, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'guest' } : b))
      );
      toast.success('Booking cancelled. The property has been notified.');

      if (booking.hotel?.managerEmail || booking.hotel?.contactEmail) {
        const managerEmail = booking.hotel.managerEmail || booking.hotel.contactEmail;
        if (managerEmail) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: managerEmail,
              hotelId: booking.hotelId,
              bookingId: booking.id,
              subject: `Guest Cancellation: ${booking.guestName} - ${booking.hotel?.name || 'Your Property'}`,
              message: `Dear Manager,\n\nThe guest ${booking.guestName} has cancelled their booking (Ref: #${booking.reference}) for ${booking.checkIn} to ${booking.checkOut}.\n\nPlease check your host dashboard for details.`
            })
          }).catch(console.error);
        }
      }

      await logSystemEvent('action', `Guest cancelled booking ${booking.reference}`, {
        bookingId: booking.id,
        reference: booking.reference,
        status: 'cancelled',
        cancelledBy: 'guest'
      }, user, 'booking');
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Could not cancel this booking. Please contact the property directly.');
    } finally {
      setBusyId(null);
    }
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      toast.success('Reference copied.');
    } catch {
      // Clipboard access is denied in some browsers; the code is on screen anyway.
      toast('Reference: ' + reference, { icon: '🔖' });
    }
  };

  const hostGrouped = useMemo(() => {
    const upcoming: EnrichedBooking[] = [];
    const past: EnrichedBooking[] = [];
    const cancelled: EnrichedBooking[] = [];
    for (const booking of hostBookings) {
      if (booking.status === 'cancelled' || booking.status === 'rejected') cancelled.push(booking);
      else if (daysUntil(booking.checkOut) < 0) past.push(booking);
      else upcoming.push(booking);
    }
    return { upcoming, past, cancelled };
  }, [hostBookings]);

  const hostVisible = useMemo(() => {
    const list = hostGrouped[filter] || [];
    if (propertyFilter === 'all') return list;
    return list.filter(b => b.hotelId === propertyFilter);
  }, [hostGrouped, filter, propertyFilter]);

  const activeBookings = activeMainTab === 'host' ? hostVisible : visible;
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: grouped.upcoming.length },
    { key: 'past', label: 'Past stays', count: grouped.past.length },
    { key: 'cancelled', label: 'Cancelled', count: grouped.cancelled.length },
  ];
  const activeTabs = activeMainTab === 'host' ? [
    { key: 'upcoming' as Filter, label: 'Upcoming', count: hostGrouped.upcoming.length },
    { key: 'past' as Filter, label: 'Past stays', count: hostGrouped.past.length },
    { key: 'cancelled' as Filter, label: 'Cancelled', count: hostGrouped.cancelled.length },
  ] : tabs;

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'approved':
        return (
          <span className="tm-tag tm-tag-good">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </span>
        );
      case 'rejected':
        return (
          <span className="tm-tag tm-tag-bad">
            <XCircle className="w-3.5 h-3.5" /> Declined
          </span>
        );
      case 'cancelled':
        return (
          <span className="tm-tag border border-stone-200">
            <Ban className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="tm-tag tm-tag-warn">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  if (authLoading || loading || loadingHost) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-stone-700"></div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 pt-16 pb-24">
        <div className="max-w-xl mx-auto px-6 text-center">
          <Calendar className="w-8 h-8 text-stone-400 mx-auto mb-4" />
          <h1 className="tm-h1 mb-2">Your bookings</h1>
          <p className="tm-lead mx-auto mb-6">Sign in to see your trips and vouchers.</p>
          <div className="tm-actions justify-center">
            <button
              onClick={() => openAuth('signin')}
              className="tm-btn tm-btn-primary"
            >
              Sign in
            </button>
            <Link
              to="/"
              className="tm-btn tm-btn-secondary"
            >
              Browse stays
            </Link>
          </div>
        </div>
      </div>
    );
  }
  

  return (
    <div className="min-h-screen bg-stone-50 pt-8 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
          <div className="min-w-0">
            <h1 className="tm-h1 mb-1">
              {activeMainTab === 'host' ? 'Property bookings' : 'My trips'}
            </h1>
            <p className="tm-muted">
              {activeMainTab === 'host' ? 'Bookings across your properties.' : 'Your upcoming and past stays.'}
            </p>
          </div>
          {managerHotels.length > 0 && (
            <div className="flex bg-stone-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveMainTab('host')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeMainTab === 'host' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Property bookings
              </button>
              <button
                onClick={() => setActiveMainTab('guest')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeMainTab === 'guest' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                My trips
              </button>
            </div>
          )}
        </div>

        {/* Offline Bookings Queue (IndexedDB) */}
        <OfflineBookingsQueue className="mb-6" />

        {activeMainTab === 'guest' && broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).length > 0 && filter === 'upcoming' && (
          <div className="mb-8 space-y-3">
            <h2 className="tm-h2 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-stone-500" /> News from your hosts
            </h2>
            <div className="tm-panel !py-1 divide-y divide-stone-100">
              {broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).map((broadcast, bIdx) => {
                const hotel = grouped.upcoming.find(b => b.hotelId === broadcast.hotelId)?.hotel;
                return (
                  <div key={`${broadcast.id || 'bc'}-${bIdx}`} className="py-3 flex items-start gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-x-2 gap-y-1 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-stone-900 truncate">
                          {hotel?.name || 'Property update'}
                        </span>
                        <span className={`tm-tag ${broadcast.type === 'alert' ? 'tm-tag-bad' : broadcast.type === 'event' ? 'tm-tag-warn' : ''}`}>{broadcast.type}</span>
                        <span className="text-xs text-stone-500">{new Date(broadcast.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-stone-800 break-words">{broadcast.message}</p>
                    </div>
                    <button 
                      type="button"
                      aria-label="Hide this update"
                      className="p-1.5 shrink-0 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                      onClick={() => {
                        const newHidden = [...hiddenBroadcastIds, broadcast.id!];
                        setHiddenBroadcastIds(newHidden);
                        localStorage.setItem('hiddenBroadcasts', JSON.stringify(newHidden));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 border-b border-stone-200/90 pb-0">
          <div className="flex items-center overflow-x-auto scrollbar-none gap-6 sm:gap-8" role="tablist">
            {activeTabs.map((tab, tIdx) => (
              <button
                key={`${tab.key}-${tIdx}`}
                type="button"
                role="tab"
                aria-selected={filter === tab.key}
                onClick={() => { setFilter(tab.key); setCurrentPage(1); }}
                className={`pb-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  filter === tab.key
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded-md ${
                  filter === tab.key ? 'bg-stone-100 text-stone-900 font-semibold' : 'text-stone-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeMainTab === 'host' && managerHotels.length > 1 && (
            <div className="relative inline-flex items-center">
              <select
                value={propertyFilter}
                onChange={e => setPropertyFilter(e.target.value)}
                className="h-8 pl-3 pr-7.5 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 text-stone-700 text-xs font-medium rounded-lg focus:outline-none transition appearance-none cursor-pointer"
              >
                <option value="all">All properties</option>
                {managerHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 pointer-events-none absolute right-2.5" />
            </div>
          )}
        </div>

        {activeBookings.length === 0 ? (
          <div className="tm-panel text-center py-12 flex flex-col items-center">
            <Calendar className="h-8 w-8 text-stone-400 mb-3" />
            <h2 className="tm-h2 mb-1">
              {activeMainTab === 'host'
                ? (filter === 'upcoming' ? 'No upcoming bookings yet' : filter === 'past' ? 'No past bookings' : 'No cancelled bookings')
                : (filter === 'upcoming' ? 'No trips booked yet' : filter === 'past' ? 'No past stays' : 'Nothing cancelled')}
            </h2>
            <p className="tm-muted mb-5 max-w-md">
              {activeMainTab === 'host'
                ? 'New guest bookings will show here.'
                : (filter === 'upcoming'
                    ? 'Find a place to stay and your trip will show here.'
                    : 'Bookings show here once they reach this stage.')}
            </p>
            {activeMainTab === 'guest' && filter === 'upcoming' && (
              <button type="button" onClick={() => navigate('/')} className="tm-btn tm-btn-primary">
                Browse stays
              </button>
            )}
            {activeMainTab === 'host' && managerHotels.length > 0 && (
              <Link to={`/dashboard/hotel/${managerHotels[0]?.id}`} className="tm-btn tm-btn-primary">
                Open dashboard
              </Link>
            )}
          </div>
        ) : activeMainTab === 'host' ? (
          <div className="tm-panel !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600 min-w-[760px]">
                <thead className="bg-stone-50 text-xs font-medium text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {activeBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((booking, bkIdx) => {
                    const nights = nightsBetween(booking.checkIn, booking.checkOut);
                    return (
                      <tr key={`${booking.id || 'booking'}-${bkIdx}`} className="hover:bg-stone-50/50 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-stone-900">{booking.guestName || 'Guest'}</div>
                          <div className="text-xs">{booking.guestPhone || booking.guestEmail}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Link to={`/dashboard/hotel/${booking.hotelId}`} className="font-semibold text-stone-900 hover:text-amber-800 transition-colors truncate max-w-[150px] inline-block">{booking.hotel?.name || 'Property'}</Link>
                          <div className="text-xs text-stone-500 truncate max-w-[150px]">{booking.room?.name || 'Room'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-stone-900">{formatDateStr(booking.checkIn)}</div>
                          <div className="text-xs text-stone-500">{nights} night{nights !== 1 ? 's' : ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-stone-900"><PriceDisplay amount={booking.total ?? 0} currency={booking.currency} /></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(booking.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditBookingTarget(booking)}
                              className="tm-btn tm-btn-secondary tm-btn-sm !px-2"
                              title="Edit booking"
                              aria-label="Edit booking"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => setConfirmModalBooking(booking)}
                                disabled={busyId === booking.id || confirmFlow.busyId === booking.id}
                                className="tm-btn tm-btn-secondary tm-btn-sm !px-2 !text-emerald-800"
                                title="Confirm booking"
                                aria-label="Confirm booking"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => handleRejectHostBooking(booking)}
                                disabled={busyId === booking.id || confirmFlow.busyId === booking.id}
                                className="tm-btn tm-btn-danger tm-btn-sm !px-2"
                                title="Decline booking"
                                aria-label="Decline booking"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setVoucherTarget(booking)}
                              className="tm-btn tm-btn-secondary tm-btn-sm !px-2"
                              title="Guest voucher"
                              aria-label="Guest voucher"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((booking, bkIdx) => {
              const terms = cancellationTerms(booking);
              const nights = nightsBetween(booking.checkIn, booking.checkOut);
              const canReview = activeMainTab === 'guest' && booking.status === 'confirmed' && booking.id && !reviewedBookingIds.has(booking.id);
              return (
              <div key={`${booking.id || 'booking'}-${bkIdx}`} className="group tm-panel !p-0 flex flex-col md:flex-row overflow-hidden min-w-0">
                <div className="md:w-64 lg:w-72 h-36 sm:h-44 md:h-auto bg-stone-100 relative overflow-hidden shrink-0">
                  <SmartImage
                    src={booking.hotel ? getHotelImage(booking.hotel) : undefined}
                    alt={booking.hotel?.name || 'Property'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    {getStatusBadge(booking.status)}
                  </div>
                </div>

                <div className="p-4 sm:p-5 md:p-6 lg:p-7 flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-2 sm:gap-3 min-w-0">
                      {booking.hotel?.id ? (
                        <Link to={`/hotel/${booking.hotel.id}`} className="hover:text-amber-800 transition-colors min-w-0 flex-1">
                          <h3 className="tm-h2 flex items-center gap-2 leading-snug">
                            <span className="line-clamp-2">{booking.hotel.name}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-stone-400 opacity-0 group-hover:opacity-100 transition" />
                          </h3>
                        </Link>
                      ) : (
                        <h3 className="tm-h2 line-clamp-2 leading-snug flex-1 min-w-0">
                          {booking.hotel?.name || 'Property no longer listed'}
                        </h3>
                      )}
                      {booking.reference && (
                        <button
                          type="button"
                          onClick={() => copyReference(booking.reference!)}
                          title="Copy booking reference"
                          className="tm-tag font-mono shrink-0 hover:bg-stone-200 transition-colors cursor-pointer"
                        >
                          {booking.reference}
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center text-stone-500 gap-1.5 mb-3 text-sm truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{booking.hotel?.location || 'Location'}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mb-4 text-sm">
                      <div>
                        <p className="tm-muted">Check-in</p>
                        <p className="font-medium text-stone-900">{formatDateStr(booking.checkIn)}</p>
                      </div>
                      <div>
                        <p className="tm-muted">Check-out</p>
                        <p className="font-medium text-stone-900">{formatDateStr(booking.checkOut)}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-1 min-w-0">
                        <p className="tm-muted">Room</p>
                        <p className="font-medium text-stone-900 truncate" title={booking.room?.name || 'Room'}>
                          {booking.room?.name || 'Room'}
                          <span className="text-stone-500 font-normal"> · {nights} night{nights === 1 ? '' : 's'} · {booking.guests} guest{booking.guests === 1 ? '' : 's'}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-auto">
                      <div className="space-y-3 min-w-0">
                        <div className="tm-actions">
                          {booking.status === 'confirmed' && daysUntil(booking.checkOut) >= 0 && (
                            <button
                              type="button"
                              onClick={() => setVoucherTarget(booking)}
                              className="tm-btn tm-btn-primary tm-btn-sm"
                            >
                              <ShieldCheck className="w-4 h-4" /> View voucher
                            </button>
                          )}
                          {(booking.status !== 'cancelled' && booking.status !== 'rejected') && (booking.hotel?.chatEnabled !== false && booking.hotel?.adminChatEnabled !== false) && (
                            <button
                              type="button"
                              onClick={() => openBookingChat(booking as unknown as Booking)}
                              className="tm-btn tm-btn-secondary tm-btn-sm"
                            >
                              <MessageSquare className="w-4 h-4" /> Contact host
                            </button>
                          )}
                        </div>
                        {booking.status === 'pending' && (
                          <p className="text-sm text-amber-800">
                            Waiting for the property to confirm. You pay on arrival.
                          </p>
                        )}
                        {booking.status === 'confirmed' && daysUntil(booking.checkOut) >= 0 && (
                          <p className="text-sm text-emerald-800">
                            Your stay is confirmed. You pay on arrival.
                          </p>
                        )}
                        {booking.status === 'cancelled' && (
                          <p className="text-sm text-stone-500">
                            Cancelled{booking.cancelledBy === 'manager' ? ' by the property' : ''}
                            {booking.cancelledAt ? ` on ${new Date(booking.cancelledAt).toLocaleDateString()}` : ''}.
                          </p>
                        )}

                        <div className="tm-actions">
                          {terms.canCancel && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(booking)}
                              disabled={busyId === booking.id}
                              className="tm-btn tm-btn-quiet tm-btn-sm hover:!text-red-700"
                            >
                              {busyId === booking.id ? 'Cancelling…' : 'Cancel booking'}
                            </button>
                          )}
                          {canReview && (
                            <button
                              type="button"
                              onClick={() => setReviewTarget(booking)}
                              className="tm-btn tm-btn-secondary tm-btn-sm"
                            >
                              <Star className="w-3.5 h-3.5" /> Write a review
                            </button>
                          )}
                          {booking.id && reviewedBookingIds.has(booking.id) && (
                            <span className="text-xs text-stone-500 px-1 py-1.5">Reviewed. Zikomo.</span>
                          )}
                        </div>
                      </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <p className="tm-muted">Total</p>
                      <div className="text-lg sm:text-xl font-serif font-semibold text-stone-900">
                        <PriceDisplay amount={booking.total ?? (booking.room && isCurrencyCode(booking.currency) ? (roomPrice(booking.room, booking.currency) ?? 0) * nights : null)} currency={booking.currency} />
                      </div>
                    </div>
                  </div>

                  {/* Guest Reminders Section */}
                  {booking.status === 'confirmed' && (
                    <div className="mt-4 border-t border-stone-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (showRemindersFor === booking.id) {
                            setShowRemindersFor(null);
                          } else {
                            setShowRemindersFor(booking.id!);
                            fetchReminders(booking.id!);
                          }
                        }}
                        className="text-xs font-medium text-stone-500 hover:text-stone-700 flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {showRemindersFor === booking.id ? 'Hide reminders' : 'Show reminders'}
                      </button>
                      {showRemindersFor === booking.id && (
                        <div className="mt-2 divide-y divide-stone-100">
                          {(bookingReminders[booking.id!] || []).filter((r: any) => r.recipientType === 'guest').length === 0 ? (
                            <p className="text-xs text-stone-500">No reminders scheduled.</p>
                          ) : (
                            (bookingReminders[booking.id!] || []).filter((r: any) => r.recipientType === 'guest').map((rem: any, remIdx: number) => (
                              <div key={`rem-guest-${booking.id || 'b'}-${rem.id || remIdx}-${remIdx}`} className="text-xs py-2">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="font-medium text-stone-800">
                                    {rem.type === 'check_in_24h' ? 'Day-before arrival reminder' :
                                     rem.type === 'check_out' ? 'Check-out reminder' : 'Update'}
                                  </span>
                                  <span className={`tm-tag ${rem.sent ? 'tm-tag-good' : 'tm-tag-warn'}`}>
                                    {rem.sent ? 'Sent' : 'Upcoming'}
                                  </span>
                                </div>
                                <p className="text-stone-600 mt-1 break-words">{rem.message}</p>
                                <p className="text-stone-500 mt-0.5">
                                  Scheduled: {new Date(rem.scheduledFor).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
        
        {activeBookings.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(activeBookings.length / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <PriceMismatchNotice
        mismatch={confirmFlow.mismatch}
        busy={!!confirmFlow.busyId}
        onConfirmAnyway={() => { confirmFlow.confirmAnyway(); }}
        onDismiss={confirmFlow.dismiss}
      />

      {confirmModalBooking && (() => {
        const booking = confirmModalBooking;
        const hotel = booking.hotel;
        const room = booking.room;
        return (
          <Modal
            open
            onClose={() => setConfirmModalBooking(null)}
            size="md"
            title="Confirm this booking"
            description={
              booking
                ? `${booking.guestName} · ${room?.name ?? 'Room'} · ${formatDateStr(booking.checkIn)} – ${formatDateStr(booking.checkOut)}`
                : undefined
            }
            footer={
              <div className="tm-actions justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmModalBooking(null)}
                  className="tm-btn tm-btn-secondary"
                >
                  Not yet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleConfirmHostBooking(booking);
                    setConfirmModalBooking(null);
                  }}
                  className="tm-btn tm-btn-primary"
                >
                  Confirm booking
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              {booking && (
                <div className="divide-y divide-stone-100 border-y border-stone-100 text-sm">
                  <div className="flex justify-between gap-3 py-2.5">
                    <span className="text-stone-500">Guest</span>
                    <span className="font-semibold text-stone-900 truncate">{booking.guestName}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <span className="text-stone-500">Stay</span>
                    <span className="font-semibold text-stone-900 tabular-nums">
                      {nightsBetween(booking.checkIn, booking.checkOut)} night{nightsBetween(booking.checkIn, booking.checkOut) === 1 ? '' : 's'} · {booking.guests} guest{booking.guests === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <span className="text-stone-500">Total</span>
                    <PriceDisplay className="text-stone-900" amount={booking.total ?? 0} currency={booking.currency} />
                  </div>
                  {booking.guestPhone && (
                    <div className="flex justify-between gap-3 py-2.5">
                      <span className="text-stone-500">Phone</span>
                      <a href={`tel:${booking.guestPhone}`} className="tm-link">{booking.guestPhone}</a>
                    </div>
                  )}
                </div>
              )}

              <div className="text-sm text-stone-700">
                <p className="mb-2">Before you confirm, agree an arrival time with the guest. They pay the property on arrival.</p>
                <div className="tm-actions">
                  <a
                    href={`https://wa.me/${(booking?.guestWhatsapp || booking?.guestPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${booking?.guestName}, we are processing your booking at ${hotel?.name} for ${booking ? formatDateStr(booking.checkIn) : ''}. Could we quickly confirm your estimated arrival time?`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp guest
                  </a>
                  <a
                    href={`mailto:${booking?.guestEmail || ''}?subject=${encodeURIComponent(`Your booking request at ${hotel?.name}`)}&body=${encodeURIComponent(`Hello ${booking?.guestName},\n\nWe are processing your booking request for ${room?.name} from ${booking ? formatDateStr(booking.checkIn) : ''} to ${booking ? formatDateStr(booking.checkOut) : ''}.\n\nCould we quickly confirm your estimated arrival time before we finalize the booking?\n\nBest regards,\n${hotel?.name}`)}`}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email guest
                  </a>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Cancel this booking request?"
        message={
          cancelTarget
            ? `Your cancellation request will be sent directly to ${cancelTarget.hotel?.name ?? 'the property'}. Please note that Travel Malawi does not hold funds or handle refunds; any deposit return, refund, or cancellation terms are governed strictly by the property at its sole discretion. Please contact the host directly to resolve any deposit settlements.`
            : ''
        }
        confirmText="Confirm cancellation"
        cancelText="Keep booking"
        isDestructive
        onConfirm={() => { if (cancelTarget) handleCancel(cancelTarget); }}
        onCancel={() => setCancelTarget(null)}
      />

      <StayVoucherModal 
        booking={voucherTarget} 
        isOpen={!!voucherTarget} 
        onClose={() => setVoucherTarget(null)} 
      />
      {reviewTarget && (
        <ReviewDialog
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={bookingId => {
            setReviewedBookingIds(prev => new Set(prev).add(bookingId));
            setReviewTarget(null);
          }}
        />
      )}
      {editBookingTarget && (
        <QuickEditBookingModal
          booking={editBookingTarget}
          onClose={() => setEditBookingTarget(null)}
          onUpdated={() => {
             // We can just rely on a page reload or state refresh. 
             // Currently the data might need a refetch if we don't have listeners, but this is acceptable for a quick edit as the user can refresh, or we mutate state manually.
             window.location.reload();
          }}
        />
      )}

    </div>
  );
}

/**
 * Review composer. Only reachable from a confirmed booking whose check-out has
 * passed, which is what lets the property page mark the result a verified stay.
 */
/** Mirrors the bounds the reviews security rule enforces on write. */
const REVIEW_MIN = 10;
const REVIEW_MAX = 1500;

function ReviewDialog({
  booking,
  onClose,
  onSubmitted,
}: {
  booking: EnrichedBooking;
  onClose: () => void;
  onSubmitted: (bookingId: string) => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // The rules the security rules also enforce, said here so a rejected write
  // is never how a guest first learns their review was too short.
  const trimmed = text.trim();
  const problem =
    !trimmed
      ? 'Write a line or two about your stay.'
      : trimmed.length < REVIEW_MIN
        ? `A little more — ${REVIEW_MIN - trimmed.length} more character${REVIEW_MIN - trimmed.length === 1 ? '' : 's'} to go.`
        : trimmed.length > REVIEW_MAX
          ? `That is over the ${REVIEW_MAX} character limit.`
          : rating < 1 || rating > 5
            ? 'Pick a rating from one to five stars.'
            : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !booking.id || submitting) return;
    if (problem) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        hotelId: booking.hotelId,
        bookingId: booking.id,
        guestId: user.uid,
        authorName: booking.guestName || user.displayName || 'Verified Guest',
        rating,
        title: title.trim() || undefined,
        text: text.trim(),
        createdAt: Date.now(),
      });
      toast.success('Thanks — your verified review is live.');
      onSubmitted(booking.id);
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Could not publish your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Exceptional'];

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`How was ${booking.hotel?.name ?? 'your stay'}?`}
      description={`${formatDateStr(booking.checkIn)} – ${formatDateStr(booking.checkOut)} · your review shows as a verified stay`}
      footer={
        <div className="tm-actions justify-end">
          <button
            type="button"
            onClick={onClose}
            className="tm-btn tm-btn-secondary"
          >
            Not now
          </button>
          <button
            type="submit"
            form="review-form"
            disabled={submitting}
            className="tm-btn tm-btn-primary"
          >
            {submitting ? 'Publishing…' : 'Publish review'}
          </button>
        </div>
      }
    >
      <form id="review-form" onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <span className="tm-label">Rating</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(value => (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                onClick={() => setRating(value)}
                className="p-1 rounded-lg hover:bg-stone-50 transition"
              >
                <Star
                  className={`w-8 h-8 transition ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`}
                />
              </button>
            ))}
            <span className="ml-3 text-sm font-semibold text-stone-600">{RATING_WORDS[rating]}</span>
          </div>
        </div>

        <div>
          <label className="tm-label" htmlFor="review-title">Title (optional)</label>
          <input
            id="review-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Lovely lake views and a kind host"
            className="tm-input"
          />
        </div>

        <div>
          <label className="tm-label" htmlFor="review-text">Your review</label>
          <textarea
            id="review-text"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            maxLength={REVIEW_MAX}
            placeholder="What stood out? Rooms, food, staff, the setting…"
            className="tm-input resize-none"
          />
          <p className="text-xs text-stone-400 mt-1.5 text-right tabular-nums">{trimmed.length}/{REVIEW_MAX}</p>
          <FieldError message={showErrors ? problem : ''} />
        </div>
      </form>
    </Modal>
  );
}

function QuickEditBookingModal({ booking, onClose, onUpdated }: { booking: EnrichedBooking, onClose: () => void, onUpdated: () => void }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [guestName, setGuestName] = useState(booking.guestName || '');
  const [guestPhone, setGuestPhone] = useState(booking.guestPhone || booking.guestWhatsapp || '');
  const [guestEmail, setGuestEmail] = useState(booking.guestEmail || '');
  
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking.id) return;
    if (guestName.trim().length < 2 || !EMAIL_PATTERN.test(guestEmail.trim())) {
      toast.error('Please give a name and a valid email address.');
      return;
    }
    // A separate WhatsApp number on the booking is kept; it only follows the
    // phone when it was empty or the same number.
    const keepsWhatsapp = !!booking.guestWhatsapp && booking.guestWhatsapp !== booking.guestPhone;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestWhatsapp: keepsWhatsapp ? booking.guestWhatsapp : guestPhone.trim(),
        guestEmail: guestEmail.trim(),
        updatedAt: Date.now()
      });
      toast.success('Booking updated.');

      await logSystemEvent('action', `Quick edited booking ${booking.reference}`, {
        bookingId: booking.id,
        reference: booking.reference,
        updatedFields: { guestName, guestPhone, guestEmail }
      }, user, 'booking');

      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update booking.');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Edit guest details"
      description={booking.guestName ? `Contact details for ${booking.guestName}` : undefined}
      footer={
        <div className="tm-actions justify-end w-full">
          <button type="button" onClick={onClose} className="tm-btn tm-btn-quiet">Cancel</button>
          <button type="button" onClick={submit} disabled={submitting} className="tm-btn tm-btn-primary">
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="tm-label" htmlFor="qe-name">Guest name</label>
          <input id="qe-name" type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="tm-input" />
        </div>
        <div>
          <label className="tm-label" htmlFor="qe-phone">Phone / WhatsApp</label>
          <input id="qe-phone" type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="tm-input" />
        </div>
        <div>
          <label className="tm-label" htmlFor="qe-email">Email</label>
          <input id="qe-email" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="tm-input" />
        </div>
      </form>
    </Modal>
  );
}
