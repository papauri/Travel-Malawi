import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Hotel, RoomType, Broadcast } from '../types';
import {
  Calendar, MapPin, ExternalLink, Clock, CheckCircle2, XCircle, Ban, Star, Copy, ShieldCheck, Users, MessageCircle, Phone, Info, Map as MapIcon,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal, { fieldClass, labelClass } from '../components/Modal';
import Pagination from '../components/Pagination';
import FieldError from '../components/FieldError';
import BookingChat from '../components/BookingChat';
import StayVoucherModal from '../components/StayVoucherModal';
import { MessageSquare, Megaphone, X } from 'lucide-react';
import { getHotelImage } from '../lib/images';
import { formatDateStr, daysUntil, nightsBetween } from '../lib/dates';
import { cancellationTerms, formatMoney, isStayComplete, FREE_CANCELLATION_DAYS } from '../lib/booking';
import { isTraveller } from '../lib/roles';

type EnrichedBooking = Booking & { hotel?: Hotel; room?: RoomType };
type Filter = 'upcoming' | 'past' | 'cancelled';

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<EnrichedBooking | null>(null);
  const [reviewTarget, setReviewTarget] = useState<EnrichedBooking | null>(null);
  const [voucherTarget, setVoucherTarget] = useState<EnrichedBooking | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<EnrichedBooking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isTraveller(user)) {
      navigate('/');
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

    async function fetchBookings() {
      try {
        const docs = await getDocs(query(collection(db, 'bookings'), where('guestId', '==', uid)));
        const bookingsData = docs.docs.map(d => ({ id: d.id, ...d.data() } as Booking));

        // One read per referenced document, de-duplicated: several bookings
        // commonly share a hotel, and the previous code issued a fresh
        // collection query per booking.
        const hotelIds = [...new Set(bookingsData.map(b => b.hotelId).filter(Boolean))];
        const roomIds = [...new Set(bookingsData.map(b => b.roomTypeId).filter(Boolean))];

        const [hotelSnaps, roomSnaps] = await Promise.all([
          Promise.all(hotelIds.map(hid => getDoc(doc(db, 'hotels', hid)))),
          Promise.all(roomIds.map(rid => getDoc(doc(db, 'room_types', rid)))),
        ]);

        // The id is merged in here. Without it every "view property" link
        // pointed at /hotel/undefined.
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

    // Which stays this guest has already reviewed, so the prompt is not offered
    // twice. Kept out of the fetch above so that a failure here cannot report
    // itself as "could not load your bookings".
    getDocs(query(collection(db, 'reviews'), where('guestId', '==', uid)))
      .then(snap => setReviewedBookingIds(new Set(snap.docs.map(d => d.data().bookingId as string))))
      .catch(error => console.warn('Could not load your reviews:', error?.message ?? error));
  }, [user, authLoading, navigate]);

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

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
    </div>
  );

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

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: grouped.upcoming.length },
    { key: 'past', label: 'Past stays', count: grouped.past.length },
    { key: 'cancelled', label: 'Cancelled', count: grouped.cancelled.length },
  ];

  return (
    <div className="min-h-screen bg-stone-50 pt-8 pb-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">My Itinerary</h1>
        <p className="text-stone-500 mb-8">Manage your upcoming stays and past bookings.</p>

        {broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).length > 0 && filter === 'upcoming' && (
          <div className="mb-10 space-y-4">
            <h2 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
              <Megaphone className="w-5 h-5" /> Live Updates
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).map(broadcast => {
                const hotel = grouped.upcoming.find(b => b.hotelId === broadcast.hotelId)?.hotel;
                return (
                  <div key={broadcast.id} className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm flex items-start gap-4">
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

        <div className="flex gap-2 mb-10 border-b border-stone-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setCurrentPage(1); }}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
                filter === tab.key
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs text-stone-400">{tab.count}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm mx-auto flex flex-col items-center">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-6">
              <Calendar className="h-10 w-10 text-stone-400" />
            </div>
            <h2 className="text-2xl text-stone-900 font-serif font-bold mb-3">
              {filter === 'upcoming' ? 'No trips booked... yet!' : filter === 'past' ? 'No past stays' : 'Nothing cancelled'}
            </h2>
            <p className="text-stone-500 mb-8 max-w-md">
              {filter === 'upcoming'
                ? 'Time to dust off your bags and start planning your next adventure in Malawi.'
                : 'Bookings will show up here once they move into this stage.'}
            </p>
            {filter === 'upcoming' && (
              <button onClick={() => navigate('/')} className="bg-stone-900 text-white px-8 py-3.5 rounded-full font-medium hover:bg-stone-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Start Exploring
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {visible.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(booking => {
              const terms = cancellationTerms(booking);
              const nights = nightsBetween(booking.checkIn, booking.checkOut);
              const canReview = isStayComplete(booking) && booking.id && !reviewedBookingIds.has(booking.id);
              return (
              <div key={booking.id} className="group flex flex-col md:flex-row bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="md:w-72 h-56 md:h-auto bg-stone-100 relative overflow-hidden">
                  {/* Resolved centrally, so a record with no stored imageUrl
                      still gets bundled photography instead of "No Image". */}
                  <SmartImage
                    src={booking.hotel ? getHotelImage(booking.hotel) : undefined}
                    alt={booking.hotel?.name || 'Property'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 left-4">
                    {getStatusBadge(booking.status)}
                  </div>
                </div>

                <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-4">
                      {booking.hotel?.id ? (
                        <Link to={`/hotel/${booking.hotel.id}`} className="hover:text-emerald-600 transition">
                          <h3 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
                            {booking.hotel.name}
                            <ExternalLink className="w-4 h-4 text-stone-400 opacity-0 group-hover:opacity-100 transition" />
                          </h3>
                        </Link>
                      ) : (
                        <h3 className="text-2xl font-serif font-bold text-stone-900">
                          {booking.hotel?.name || 'Property no longer listed'}
                        </h3>
                      )}
                      {booking.reference && (
                        <button
                          onClick={() => copyReference(booking.reference!)}
                          title="Copy booking reference"
                          className="shrink-0 flex items-center gap-1.5 text-xs font-mono font-semibold text-stone-500 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg transition"
                        >
                          {booking.reference}
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center text-stone-500 gap-1.5 mb-6 text-sm font-medium">
                      <MapPin className="h-4 w-4" /> {booking.hotel?.location || 'Location'}
                    </div>

                    <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex flex-col sm:flex-row gap-4 sm:gap-8 mb-6">
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Check-in</p>
                        {/* Formatted from local calendar parts: passing the raw
                            string to new Date() renders the previous day for
                            viewers west of Greenwich. */}
                        <p className="font-medium text-stone-900">{formatDateStr(booking.checkIn)}</p>
                      </div>
                      <div className="hidden sm:block w-px bg-stone-200"></div>
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Check-out</p>
                        <p className="font-medium text-stone-900">{formatDateStr(booking.checkOut)}</p>
                      </div>
                      <div className="hidden sm:block w-px bg-stone-200"></div>
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Room</p>
                        <p className="font-medium text-stone-900 truncate max-w-[160px]" title={booking.room?.name || 'Room'}>
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
                            onClick={() => setChatTarget(booking)}
                            className="text-xs font-semibold text-stone-900 border-2 border-stone-900 bg-white px-4 py-2 rounded-xl hover:bg-stone-900 hover:text-white transition flex items-center gap-1.5"
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
                    <div className="text-right w-full sm:w-auto">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Total Price</p>
                      <div className="text-2xl font-serif font-bold text-stone-900">
                        {formatMoney(booking.total ?? ((booking.room?.price ?? 0) * nights), booking.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
        
        {visible.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(visible.length / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

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

      {chatTarget && user && (
        <Modal
          open={true}
          onClose={() => setChatTarget(null)}
          title={"Message " + (chatTarget.hotel?.name || 'Property')}
          description={"Reference: " + (chatTarget.reference || 'N/A')}
        >
          <div className="mt-2 h-[500px]">
             <BookingChat booking={chatTarget} currentUser={user} />
          </div>
        </Modal>
      )}
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
