import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import {
  collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Hotel, RoomType, Broadcast } from '../types';
import {
  Calendar, MapPin, ExternalLink, Clock, CheckCircle2, XCircle, Ban, Star, Copy, ShieldCheck, Users, MessageCircle, Phone, Info, Map as MapIcon, MessageSquare, Megaphone, X, Check, Building2, Mail, Edit2, Filter as FilterIcon
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal, { fieldClass, labelClass } from '../components/Modal';
import Pagination from '../components/Pagination';
import FieldError from '../components/FieldError';
import BookingChat from '../components/BookingChat';
import { logSystemEvent } from '../lib/logger';
import { useChatModal } from '../contexts/ChatModalContext';
import StayVoucherModal from '../components/StayVoucherModal';
import { getHotelImage } from '../lib/images';
import { formatDateStr, daysUntil, nightsBetween } from '../lib/dates';
import { cancellationTerms, formatMoney, isStayComplete, FREE_CANCELLATION_DAYS } from '../lib/booking';
import { isTraveller } from '../lib/roles';
import PriceDisplay from '../components/PriceDisplay';

type EnrichedBooking = Booking & { hotel?: Hotel; room?: RoomType };
type Filter = 'upcoming' | 'past' | 'cancelled';

export default function MyBookings() {
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
    } catch (e) {
      console.warn('Failed to read bookings cache', e);
    }

    async function fetchHostData() {
      try {
        const querySnapshot = await getDocs(collection(db, 'hotels'));
        const allHotels = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        const userEmailLower = user?.email?.toLowerCase();
        const userIsAdmin = user ? (user.role === 'admin' || (user.roles && user.roles.includes('admin')) || userEmailLower === 'johnpaulchirwa@gmail.com') : false;

        const hotels = allHotels.filter(h => {
          if (userIsAdmin) return true;
          const hasAssignedManager = Boolean(
            h.managerId &&
            h.managerId !== 'unassigned' &&
            h.managerId !== 'none' &&
            h.managerId.trim() !== ''
          );
          if (hasAssignedManager && h.managerId === uid) return true;
          if (userEmailLower) {
            if (h.managerEmail && h.managerEmail.toLowerCase() === userEmailLower) return true;
            if (h.ownerEmail && h.ownerEmail.toLowerCase() === userEmailLower) return true;
            if (h.contactEmail && h.contactEmail.toLowerCase() === userEmailLower) return true;
          }
          return false;
        });

        setManagerHotels(hotels);
        if (hotels.length > 0) {
          setActiveMainTab('host');
          const hIds = hotels.map(h => h.id).filter(Boolean) as string[];
          if (hIds.length > 0) {
            const batches = [];
            for (let i = 0; i < hIds.length; i += 10) {
              batches.push(hIds.slice(i, i + 10));
            }
            let allHostBookings: Booking[] = [];
            for (const batch of batches) {
              const bDocs = await getDocs(query(collection(db, 'bookings'), where('hotelId', 'in', batch)));
              const batchBookings = bDocs.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
              allHostBookings = [...allHostBookings, ...batchBookings];
            }

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
        toast.error('Could not load your bookings.');
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
    setBusyId(booking.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'confirmed',
        confirmedAt: Date.now(),
        updatedAt: Date.now(),
      });
      setHostBookings(prev => prev.map(b => (b.id === booking.id ? { ...b, status: 'confirmed' } : b)));
      toast.success(`Booking ${booking.reference || ''} confirmed!`);

      await logSystemEvent('action', `Manager confirmed booking ${booking.reference}`, {
        bookingId: booking.id,
        reference: booking.reference,
        status: 'confirmed'
      }, user, 'booking');
    } catch (err) {
      console.error('Error confirming booking:', err);
      toast.error('Failed to confirm booking.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectHostBooking = async (booking: EnrichedBooking) => {
    if (!booking.id) return;
    setBusyId(booking.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'rejected',
        rejectedAt: Date.now(),
        cancelledBy: 'manager',
        updatedAt: Date.now(),
      });
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
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'cancelled',
        cancelledAt: Date.now(),
        cancelledBy: 'guest',
        updatedAt: Date.now(),
      });
      setBookings(prev =>
        prev.map(b => (b.id === booking.id ? { ...b, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'guest' } : b))
      );
      toast.success('Booking cancelled. The property has been notified.');

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
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider border border-red-200">
            <XCircle className="w-3.5 h-3.5" /> Declined
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-bold uppercase tracking-wider border border-stone-200">
            <Ban className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  if (authLoading || loading || loadingHost) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 pt-16 pb-24">
        <div className="max-w-xl mx-auto px-6 text-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
            <Calendar className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 mb-3">Your Bookings</h1>
          <p className="text-stone-600 mb-8 leading-relaxed">
            Please sign in to view your upcoming property bookings, manage guest reservations, and access your digital vouchers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => openAuth('signin')}
              className="bg-stone-900 hover:bg-stone-800 text-white font-semibold px-6 py-3 rounded-full transition shadow-md"
            >
              Sign In
            </button>
            <Link
              to="/"
              className="bg-white hover:bg-stone-100 text-stone-700 font-semibold px-6 py-3 rounded-full border border-stone-200 transition"
            >
              Explore Properties
            </Link>
          </div>
        </div>
      </div>
    );
  }
  

  return (
    <div className="min-h-screen bg-stone-50 pt-8 pb-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">
              {activeMainTab === 'host' ? 'Property Bookings' : 'My Trips'}
            </h1>
            <p className="text-stone-500">
              {activeMainTab === 'host' ? 'Manage bookings across your properties.' : 'Manage your upcoming stays and past trips.'}
            </p>
          </div>
          {managerHotels.length > 0 && (
            <div className="flex bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveMainTab('host')}
                className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeMainTab === 'host' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Property Bookings
              </button>
              <button
                onClick={() => setActiveMainTab('guest')}
                className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeMainTab === 'guest' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                My Trips
              </button>
            </div>
          )}
        </div>

        {activeMainTab === 'guest' && broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).length > 0 && filter === 'upcoming' && (
          <div className="mb-10 space-y-4">
            <h2 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
              <Megaphone className="w-5 h-5" /> Live Updates
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).map((broadcast, bIdx) => {
                const hotel = grouped.upcoming.find(b => b.hotelId === broadcast.hotelId)?.hotel;
                return (
                  <div key={`${broadcast.id || 'bc'}-${bIdx}`} className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-full shrink-0 ${
                      broadcast.type === 'alert' ? 'bg-red-100 text-red-600' :
                      broadcast.type === 'event' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                          {hotel?.name || 'Property Update'}
                        </span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{broadcast.type}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs text-stone-500">{new Date(broadcast.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-stone-900 font-medium">{broadcast.message}</p>
                    </div>
                    <button 
                      className="p-1.5 ml-auto text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition"
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="grid grid-cols-3 sm:flex gap-1.5 sm:gap-2 p-1 bg-stone-100/90 rounded-2xl border border-stone-200 w-full sm:w-auto">
            {activeTabs.map((tab, tIdx) => (
              <button
                key={`${tab.key}-${tIdx}`}
                onClick={() => { setFilter(tab.key); setCurrentPage(1); }}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  filter === tab.key
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-stone-200/80 text-stone-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeMainTab === 'host' && managerHotels.length > 1 && (
            <div className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-stone-400" />
              <select
                value={propertyFilter}
                onChange={e => setPropertyFilter(e.target.value)}
                className="bg-white border border-stone-200 text-stone-700 text-sm font-medium rounded-xl px-4 py-2 hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200 transition appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%2378716C%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_8px_center] bg-[length:16px_16px]"
              >
                <option value="all">All properties</option>
                {managerHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeBookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm mx-auto flex flex-col items-center">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-6">
              <Calendar className="h-10 w-10 text-stone-400" />
            </div>
            <h2 className="text-2xl text-stone-900 font-serif font-bold mb-3">
              {activeMainTab === 'host'
                ? (filter === 'upcoming' ? 'No upcoming bookings yet' : filter === 'past' ? 'No past bookings' : 'No cancelled bookings')
                : (filter === 'upcoming' ? 'No trips booked... yet!' : filter === 'past' ? 'No past stays' : 'Nothing cancelled')}
            </h2>
            <p className="text-stone-500 mb-8 max-w-md">
              {activeMainTab === 'host'
                ? 'Guest reservations for your properties will appear here along with their contact info and confirmation tools.'
                : (filter === 'upcoming'
                    ? 'Time to dust off your bags and start planning your next adventure in Malawi.'
                    : 'Bookings will show up here once they move into this stage.')}
            </p>
            {activeMainTab === 'guest' && filter === 'upcoming' && (
              <button onClick={() => navigate('/')} className="bg-stone-900 text-white px-8 py-3.5 rounded-full font-medium hover:bg-stone-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Start Exploring
              </button>
            )}
            {activeMainTab === 'host' && managerHotels.length > 0 && (
              <Link to={`/dashboard/hotel/${managerHotels[0]?.id}`} className="bg-stone-900 text-white px-8 py-3.5 rounded-full font-medium hover:bg-stone-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Open Host Dashboard
              </Link>
            )}
          </div>
        ) : activeMainTab === 'host' ? (
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-600 min-w-[800px]">
                <thead className="bg-stone-50 text-xs uppercase font-bold text-stone-400 border-b border-stone-200">
                  <tr>
                    <th className="px-6 py-4">Guest</th>
                    <th className="px-6 py-4">Property</th>
                    <th className="px-6 py-4">Dates</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
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
                          <Link to={`/dashboard/hotel/${booking.hotelId}`} className="font-semibold text-stone-900 hover:text-emerald-700 transition truncate max-w-[150px] inline-block">{booking.hotel?.name || 'Property'}</Link>
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
                              className="p-2 text-stone-400 hover:text-stone-900 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition"
                              title="Quick Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => setConfirmModalBooking(booking)}
                                className="p-2 text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition shadow-sm"
                                title="Approve Booking"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => handleRejectHostBooking(booking)}
                                className="p-2 text-red-600 hover:text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition shadow-sm"
                                title="Decline Booking"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setVoucherTarget(booking)}
                              className="p-2 text-stone-400 hover:text-stone-900 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition"
                              title="Guest Voucher"
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
          <div className="space-y-6">
            {activeBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((booking, bkIdx) => {
              const terms = cancellationTerms(booking);
              const nights = nightsBetween(booking.checkIn, booking.checkOut);
              const canReview = activeMainTab === 'guest' && isStayComplete(booking) && booking.id && !reviewedBookingIds.has(booking.id);
              return (
              <div key={`${booking.id || 'booking'}-${bkIdx}`} className="group flex flex-col md:flex-row bg-white border border-stone-200 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xs hover:shadow-sm transition-shadow">
                <div className="md:w-64 lg:w-72 h-36 sm:h-44 md:h-auto bg-stone-100 relative overflow-hidden shrink-0">
                  <SmartImage
                    src={booking.hotel ? getHotelImage(booking.hotel) : undefined}
                    alt={booking.hotel?.name || 'Property'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 left-3">
                    {getStatusBadge(booking.status)}
                  </div>
                </div>

                <div className="p-4 sm:p-5 md:p-6 lg:p-7 flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-2 sm:gap-3 min-w-0">
                      {booking.hotel?.id ? (
                        <Link to={`/hotel/${booking.hotel.id}`} className="hover:text-emerald-600 transition min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg md:text-xl font-serif font-bold text-stone-900 flex items-center gap-2 line-clamp-2 leading-snug">
                            <span className="line-clamp-2">{booking.hotel.name}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-stone-400 opacity-0 group-hover:opacity-100 transition" />
                          </h3>
                        </Link>
                      ) : (
                        <h3 className="text-base sm:text-lg md:text-xl font-serif font-bold text-stone-900 line-clamp-2 leading-snug flex-1 min-w-0">
                          {booking.hotel?.name || 'Property no longer listed'}
                        </h3>
                      )}
                      {booking.reference && (
                        <button
                          onClick={() => copyReference(booking.reference!)}
                          title="Copy booking reference"
                          className="shrink-0 flex items-center gap-1 text-[11px] sm:text-xs font-mono font-semibold text-stone-500 bg-stone-100 hover:bg-stone-200 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition"
                        >
                          {booking.reference}
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center text-stone-500 gap-1.5 mb-3 text-xs sm:text-sm font-medium truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{booking.hotel?.location || 'Location'}</span>
                    </div>

                    <div className="bg-stone-50 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-stone-100 flex flex-col sm:flex-row gap-2.5 sm:gap-6 mb-4 sm:mb-5">
                      <div>
                        <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider mb-0.5 sm:mb-1">Check-in</p>
                        <p className="text-xs sm:text-sm font-medium text-stone-900">{formatDateStr(booking.checkIn)}</p>
                      </div>
                      <div className="hidden sm:block w-px bg-stone-200"></div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider mb-0.5 sm:mb-1">Check-out</p>
                        <p className="text-xs sm:text-sm font-medium text-stone-900">{formatDateStr(booking.checkOut)}</p>
                      </div>
                      <div className="hidden sm:block w-px bg-stone-200"></div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider mb-0.5 sm:mb-1">Room</p>
                        <p className="text-xs sm:text-sm font-medium text-stone-900 truncate max-w-[160px]" title={booking.room?.name || 'Room'}>
                          {booking.room?.name || 'Room'}
                          <span className="text-stone-400 font-normal"> · {nights}n · {booking.guests}g</span>
                        </p>
                      </div>
                    </div>
                  </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-auto">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {booking.status === 'confirmed' && daysUntil(booking.checkOut) >= 0 && (
                            <button
                              type="button"
                              onClick={() => setVoucherTarget(booking)}
                              className="text-xs font-semibold text-emerald-900 border-2 border-emerald-900 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-900 hover:text-white transition flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-4 h-4" /> View Digital Voucher
                            </button>
                          )}
                          {(booking.status !== 'cancelled' && booking.status !== 'rejected') && (booking.hotel?.chatEnabled !== false && booking.hotel?.adminChatEnabled !== false) && (
                            <button
                              type="button"
                              onClick={() => openBookingChat(booking as unknown as Booking)}
                              className="text-xs font-semibold text-stone-900 border-2 border-stone-900 bg-white px-4 py-2 rounded-xl hover:bg-stone-900 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-4 h-4" /> Contact host
                            </button>
                          )}
                        </div>
                        {booking.status === 'pending' && (
                          <p className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                            Waiting for property confirmation. Payment on arrival.
                          </p>
                        )}
                        {booking.status === 'confirmed' && daysUntil(booking.checkOut) >= 0 && (
                          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            Your stay is confirmed! Payment on arrival.
                          </p>
                        )}
                        {booking.status === 'cancelled' && (
                          <p className="text-xs font-medium text-stone-500 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
                            Cancelled{booking.cancelledBy === 'manager' ? ' by the property' : ''}
                            {booking.cancelledAt ? ` on ${new Date(booking.cancelledAt).toLocaleDateString()}` : ''}.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {terms.canCancel && (
                            <button
                              onClick={() => setCancelTarget(booking)}
                              disabled={busyId === booking.id}
                              className="text-xs font-semibold text-stone-600 border border-stone-300 px-3 py-1.5 rounded-lg hover:bg-stone-100 hover:text-red-600 hover:border-red-200 transition disabled:opacity-50"
                            >
                              {busyId === booking.id ? 'Cancelling…' : 'Cancel booking'}
                            </button>
                          )}
                          {canReview && (
                            <button
                              onClick={() => setReviewTarget(booking)}
                              className="text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1.5"
                            >
                              <Star className="w-3.5 h-3.5" /> Write a review
                            </button>
                          )}
                          {booking.id && reviewedBookingIds.has(booking.id) && (
                            <span className="text-xs font-semibold text-stone-400 px-3 py-1.5">Reviewed — thank you</span>
                          )}
                        </div>
                      </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Total Price</p>
                      <div className="text-lg sm:text-xl md:text-2xl font-serif font-bold text-stone-900 tracking-tight">
                        <PriceDisplay amount={booking.total ?? ((booking.room?.price ?? 0) * nights)} currency={booking.currency} />
                      </div>
                    </div>
                  </div>

                  {/* Guest Reminders Section */}
                  {booking.status === 'confirmed' && (
                    <div className="mt-4 border-t border-stone-100 pt-3">
                      <button
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
                        {showRemindersFor === booking.id ? 'Hide Reminders' : 'View Upcoming Reminders'}
                      </button>
                      {showRemindersFor === booking.id && (
                        <div className="mt-2 space-y-2">
                          {(bookingReminders[booking.id!] || []).filter((r: any) => r.recipientType === 'guest').length === 0 ? (
                            <p className="text-xs text-stone-400">No reminders scheduled for this booking.</p>
                          ) : (
                            (bookingReminders[booking.id!] || []).filter((r: any) => r.recipientType === 'guest').map((rem: any, remIdx: number) => (
                              <div key={`rem-guest-${booking.id || 'b'}-${rem.id || remIdx}-${remIdx}`} className={`text-xs p-2 rounded-lg border ${rem.sent ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="flex justify-between items-start">
                                  <span className={`font-medium ${rem.sent ? 'text-green-700' : 'text-amber-700'}`}>
                                    {rem.type === 'check_in_24h' ? '24h Arrival Reminder' :
                                     rem.type === 'check_out' ? 'Check-out Reminder' : 'Update'}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${rem.sent ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {rem.sent ? '✓ Sent' : 'Upcoming'}
                                  </span>
                                </div>
                                <p className="text-stone-600 mt-1">{rem.message}</p>
                                <p className="text-stone-400 mt-0.5">
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
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModalBooking(null)}
                  className="flex-1 bg-stone-100 text-stone-900 px-6 py-3 rounded-full font-semibold text-sm hover:bg-stone-200 transition"
                >
                  Not yet
                </button>
                <button
                  onClick={() => {
                    handleConfirmHostBooking(booking);
                    setConfirmModalBooking(null);
                  }}
                  className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-emerald-700 transition"
                >
                  Approve booking
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              {booking && (
                <div className="rounded-2xl border border-stone-200 divide-y divide-stone-100 text-sm">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-stone-500">Guest</span>
                    <span className="font-semibold text-stone-900">{booking.guestName}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-stone-500">Stay</span>
                    <span className="font-semibold text-stone-900 tabular-nums">
                      {nightsBetween(booking.checkIn, booking.checkOut)} night{nightsBetween(booking.checkIn, booking.checkOut) === 1 ? '' : 's'} · {booking.guests} guest{booking.guests === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-stone-500">Total</span>
                    <PriceDisplay className="text-stone-900" amount={booking.total ?? 0} currency={booking.currency} />
                  </div>
                  {booking.guestPhone && (
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-stone-500">Phone</span>
                      <a href={`tel:${booking.guestPhone}`} className="font-semibold text-stone-900 hover:text-emerald-700">{booking.guestPhone}</a>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-amber-50 text-amber-900 px-4 py-3.5 rounded-xl text-sm border border-amber-200">
                <span className="font-semibold block mb-1">Before you approve</span>
                <p className="mb-3">Call the guest, or message them on WhatsApp, to agree an arrival time.</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/${(booking?.guestWhatsapp || booking?.guestPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${booking?.guestName}, we are processing your booking at ${hotel?.name} for ${booking ? formatDateStr(booking.checkIn) : ''}. Could we quickly confirm your estimated arrival time?`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#20bd5a] transition shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Guest
                  </a>
                  <a
                    href={`mailto:${booking?.guestEmail || ''}?subject=${encodeURIComponent(`Your booking request at ${hotel?.name}`)}&body=${encodeURIComponent(`Hello ${booking?.guestName},\n\nWe are processing your booking request for ${room?.name} from ${booking ? formatDateStr(booking.checkIn) : ''} to ${booking ? formatDateStr(booking.checkOut) : ''}.\n\nCould we quickly confirm your estimated arrival time before we finalize the booking?\n\nBest regards,\n${hotel?.name}`)}`}
                    className="inline-flex items-center gap-1.5 bg-stone-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-stone-800 transition shadow-sm"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email Guest
                  </a>
                </div>
              </div>
              <div className="bg-stone-50 text-stone-600 px-4 py-3.5 rounded-xl text-sm border border-stone-200">
                <span className="font-semibold block mb-1 text-stone-900">Payment</span>
                Remind them that payment is settled directly at the property on arrival.
              </div>
            </div>
          </Modal>
        );
      })()}

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Cancel this booking?"
        message={
          cancelTarget
            ? cancellationTerms(cancelTarget).isFree
              ? `Your stay at ${cancelTarget.hotel?.name ?? 'this property'} starts on ${formatDateStr(cancelTarget.checkIn)}. You are outside the ${FREE_CANCELLATION_DAYS}-day window, so cancelling is free.`
              : `Your stay starts in under ${FREE_CANCELLATION_DAYS} days, so the property's late-cancellation terms apply. Contact them directly if you need to reschedule instead.`
            : ''
        }
        confirmText="Cancel booking"
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
        authorName: booking.guestName || user.displayName || 'Guest',
        rating,
        text: text.trim(),
        createdAt: Date.now(),
      });
      toast.success('Thanks — your review is live.');
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-stone-100 text-stone-900 px-6 py-3 rounded-full font-semibold text-sm hover:bg-stone-200 transition"
          >
            Not now
          </button>
          <button
            type="submit"
            form="review-form"
            disabled={submitting}
            className="flex-1 bg-stone-900 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-50"
          >
            {submitting ? 'Publishing…' : 'Publish review'}
          </button>
        </div>
      }
    >
      <form id="review-form" onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <label className={labelClass}>Rating</label>
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
          <label className={labelClass}>Your review</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            maxLength={REVIEW_MAX}
            placeholder="What stood out? Rooms, food, staff, the setting…"
            className={`${fieldClass} resize-none`}
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
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestWhatsapp: guestPhone.trim(),
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
      title="Quick Edit Booking"
      description={`Update contact details for ${booking.guestName}`}
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-stone-600 hover:text-stone-900 transition">Cancel</button>
          <button type="button" onClick={submit} disabled={submitting} className="px-6 py-2.5 text-sm font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Guest Name</label>
          <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-stone-50 border border-stone-200 text-stone-900 text-sm font-medium rounded-xl px-4 py-3 focus:outline-none focus:border-stone-400 focus:bg-white transition" />
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Phone / WhatsApp</label>
          <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="w-full bg-stone-50 border border-stone-200 text-stone-900 text-sm font-medium rounded-xl px-4 py-3 focus:outline-none focus:border-stone-400 focus:bg-white transition" />
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Email Address</label>
          <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full bg-stone-50 border border-stone-200 text-stone-900 text-sm font-medium rounded-xl px-4 py-3 focus:outline-none focus:border-stone-400 focus:bg-white transition" />
        </div>
      </form>
    </Modal>
  );
}
