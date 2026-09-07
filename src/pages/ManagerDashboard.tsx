import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Booking, RoomType } from '../types';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { Building2, Plus, ChevronRight, Clock, CheckCircle2, XCircle, BedDouble, CalendarCheck, Lock, Sparkles, UserCheck, ArrowRight, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthDialog } from '../contexts/AuthDialogContext';

import SmartImage from '../components/SmartImage';
import { getHotelImage } from '../lib/images';
import { isHotelManager, isAdmin } from '../lib/roles';
import MaskedPlaceName from '../components/MaskedPlaceName';

import Pagination from '../components/Pagination';

export default function ManagerDashboard() {
  const { user, loading: authLoading, becomeHost } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [togglingHotelId, setTogglingHotelId] = useState<string | null>(null);
  const itemsPerPage = 6;

  const handleToggleHotelOnline = async (e: React.MouseEvent, hotel: Hotel) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hotel.id || togglingHotelId) return;
    const newStatus = hotel.isOnline === false ? true : false;
    setTogglingHotelId(hotel.id);
    try {
      await updateDoc(doc(db, 'hotels', hotel.id), { isOnline: newStatus });
      setHotels(prev => prev.map(h => h.id === hotel.id ? { ...h, isOnline: newStatus } : h));
      if (newStatus) {
        toast.success(`${hotel.name} is now ONLINE (Accepting guest chats)`);
      } else {
        toast(`${hotel.name} is now OFFLINE (Away)`, { icon: '🌙' });
      }
    } catch (err) {
      console.error('Error toggling online status:', err);
      toast.error('Failed to change online status.');
    } finally {
      setTogglingHotelId(null);
    }
  };
  

  const fetchMyHotels = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'hotels'));
      const allHotels = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];

      const userEmailLower = user?.email?.toLowerCase();
      const userIsAdmin = isAdmin(user);

      const hotelsData = allHotels.filter(h => {
        if (userIsAdmin) return true;
        const hasAssignedManager = Boolean(
          h.managerId &&
          h.managerId !== 'unassigned' &&
          h.managerId !== 'none' &&
          h.managerId.trim() !== ''
        );

        if (hasAssignedManager && h.managerId === user?.uid) return true;
        if (userEmailLower) {
          if (h.managerEmail && h.managerEmail.toLowerCase() === userEmailLower) return true;
          if (h.ownerEmail && h.ownerEmail.toLowerCase() === userEmailLower) return true;
          if (h.contactEmail && h.contactEmail.toLowerCase() === userEmailLower) return true;
        }
        if ((h as any).ownerId === user?.uid || (h as any).createdBy === user?.uid) return true;
        
        // Unassigned properties belong to the signed-in user
        if (!hasAssignedManager) return true;

        return false;
      });

      setHotels(hotelsData);

      // A dashboard that only lists names cannot tell you which property needs
      // you today, so each card carries its room count and pending requests.
      const ids = hotelsData.map(h => h.id).filter(Boolean) as string[];
      if (ids.length > 0) {
        // `in` takes at most 30 values per query, which is far more properties
        // than one manager will have, but the slice keeps it honest.
        const batch = ids.slice(0, 30);
        const [roomSnap, bookingSnap] = await Promise.all([
          getDocs(query(collection(db, 'room_types'), where('hotelId', 'in', batch))),
          getDocs(query(collection(db, 'bookings'), where('hotelId', 'in', batch))),
        ]);
        setRooms(roomSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
        setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      }
    } catch (error) {
      console.error("Error fetching hotels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isHotelManager(user)) {
      setLoading(false);
      return;
    }
    fetchMyHotels();
  }, [user, authLoading]);

  const handleActivateHost = async () => {
    setActivating(true);
    try {
      await becomeHost();
      toast.success('Property Owner tools activated! Loading your dashboard...');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate property owner status.');
    } finally {
      setActivating(false);
    }
  };

  /** Room count and outstanding requests, per property. */
  const summaryByHotel = useMemo(() => {
    const map = new Map<string, { rooms: number; pending: number }>();
    for (const hotel of hotels) {
      if (!hotel.id) continue;
      map.set(hotel.id, {
        rooms: rooms.filter(r => r.hotelId === hotel.id).length,
        pending: bookings.filter(b => b.hotelId === hotel.id && b.status === 'pending').length,
      });
    }
    return map;
  }, [hotels, rooms, bookings]);

  const totalPending = bookings.filter(b => b.status === 'pending').length;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-stone-200 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 mx-auto mb-5">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Host Dashboard Access
            </h1>
            <p className="text-stone-600 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              The Host Dashboard is reserved for registered Malawian property owners, B&B hosts, lodge managers, cottage operators, and safari camps.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4 text-left">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                <div className="font-bold text-stone-900 flex items-center justify-between">
                  <span>Guest Account</span>
                  <span className="text-[10px] text-stone-500 uppercase">Traveler</span>
                </div>
                <ul className="text-stone-600 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Browse stays, B&amp;Bs &amp; direct host chats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Booking vouchers &amp; trip list</span>
                  </li>
                  <li className="text-stone-400 italic">
                    (No dashboard or listing tools)
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-stone-900 text-white border border-stone-800 text-xs space-y-2">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Property Owner Account</span>
                  <span className="text-[10px] text-stone-300 uppercase font-semibold">Host</span>
                </div>
                <ul className="text-stone-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Host Dashboard: Manage rooms &amp; rates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Host Starter Pack &amp; response templates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>0% commission direct WhatsApp stays</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => openAuth('host')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition shadow-sm cursor-pointer"
              >
                <span>Sign Up as Property Owner</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-6 py-3.5 rounded-full text-sm transition border border-stone-200 cursor-pointer"
              >
                <span>Sign In to Existing Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isHotelManager(user)) {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-stone-200 shadow-sm text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium mb-5">
              <UserCheck className="w-3.5 h-3.5 text-stone-500" />
              <span>Signed in as Guest ({user.email})</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Property Owner Permissions Required
            </h1>
            <p className="text-stone-600 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              You are currently signed in with a Guest account. To view the Host Dashboard and list properties, activate your free host permissions below.
            </p>

            <div className="mt-6 p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-left space-y-2 max-w-md mx-auto">
              <div className="font-semibold text-stone-900">What will be enabled:</div>
              <ul className="text-stone-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Full access to this Host Dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Host Starter Pack &amp; onboarding toolkit</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Preserves all your current bookings &amp; favorites</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleActivateHost}
                disabled={activating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-stone-300" />
                <span>{activating ? 'Activating Host Tools…' : 'Activate Property Owner Account (Free)'}</span>
              </button>
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-6 py-3.5 rounded-full text-sm transition border border-stone-200"
              >
                <span>Back to Stays</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 sm:mb-12 gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-stone-900">Dashboard</h1>
          <p className="text-stone-500 mt-2 text-lg">
            {totalPending > 0
              ? `${totalPending} booking request${totalPending === 1 ? '' : 's'} waiting for your reply.`
              : 'Your properties, rooms and booking requests.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/list-your-property"
            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full font-medium hover:bg-stone-800 transition"
          >
            <Plus className="h-4 w-4" /> Add a property
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 md:gap-8">
        {hotels.length === 0 ? (
          <div className="col-span-full bg-white p-16 text-center rounded-2xl border border-stone-200 shadow-sm">
            <Building2 className="h-16 w-16 text-stone-300 mx-auto mb-6" />
            <h3 className="text-2xl font-serif text-stone-900 mb-3">Nothing listed yet</h3>
            <p className="text-stone-500 text-lg max-w-md mx-auto mb-8">
              Walk through your first listing in four steps — the basics, the description,
              your photographs, then rooms and rates.
            </p>
            <Link
              to="/list-your-property"
              className="inline-block bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition"
            >
              List your first property
            </Link>
          </div>
        ) : (
          hotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((hotel, hIdx) => {
            const targetUrl = (summaryByHotel.get(hotel.id!)?.pending ?? 0) > 0
                  ? `/dashboard/hotel/${hotel.id}?tab=bookings`
                  : (summaryByHotel.get(hotel.id!)?.rooms ?? 0) === 0
                    ? `/dashboard/hotel/${hotel.id}?tab=rooms`
                    : `/dashboard/hotel/${hotel.id}`;
            return (
            <div
              key={`mgr-hotel-${hotel.id}`}
              className="group bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col hover:border-stone-400 transition duration-300 relative"
            >
              <Link to={targetUrl} className="absolute inset-0 z-0" aria-label={`Manage ${hotel.name}`} />
              <div className="w-full aspect-[4/3] sm:aspect-auto sm:h-56 md:h-60 bg-stone-100 relative shrink-0 pointer-events-none">
                <SmartImage
                  src={getHotelImage(hotel)}
                  alt={hotel.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out"
                />
                {/* Moderation status was previously only visible to admins, so a
                    manager had no way to tell whether their listing was live. */}
                <span className={`absolute top-3 left-3 sm:top-4 sm:left-4 z-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider shadow-sm pointer-events-auto ${
                  hotel.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  hotel.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {hotel.status === 'pending' ? <><Clock className="h-3 w-3" /> Awaiting approval</>
                    : hotel.status === 'rejected' ? <><XCircle className="h-3 w-3" /> Not published</>
                    : <><CheckCircle2 className="h-3 w-3" /> Live</>}
                </span>

                {/* 1-Click Online/Offline Toggle */}
                <button
                  type="button"
                  onClick={(e) => handleToggleHotelOnline(e, hotel)}
                  disabled={togglingHotelId === hotel.id}
                  className={`absolute top-3 right-3 sm:top-4 sm:right-4 z-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md transition pointer-events-auto ${
                    hotel.isOnline !== false
                      ? 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/40'
                      : 'bg-stone-900/80 text-stone-300 hover:bg-stone-800 border border-stone-700/60'
                  }`}
                  title="Click to toggle Host Online/Offline Status"
                >
                  <span className={`h-2 w-2 rounded-full ${hotel.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'}`} />
                  <span>{hotel.isOnline !== false ? 'Online' : 'Offline'}</span>
                </button>
              </div>
              <div className="p-4 sm:p-6 md:p-8 flex-1 flex flex-col pointer-events-none min-w-0">
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mb-1 sm:mb-2 truncate">
                  <MaskedPlaceName name={hotel.name} fallback="[Your Listed Lodge]" />
                </h3>
                <p className="text-stone-500 text-sm sm:text-base mb-4 sm:mb-5 truncate">{hotel.location}</p>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <BedDouble className="h-4 w-4 text-stone-400" />
                    {summaryByHotel.get(hotel.id!)?.rooms ?? 0} room type{(summaryByHotel.get(hotel.id!)?.rooms ?? 0) === 1 ? '' : 's'}
                  </span>
                  {(summaryByHotel.get(hotel.id!)?.pending ?? 0) > 0 ? (
                    <span className="flex items-center gap-1.5 font-semibold text-amber-700">
                      <CalendarCheck className="h-4 w-4" />
                      {summaryByHotel.get(hotel.id!)!.pending} awaiting reply
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-stone-400">
                      <CalendarCheck className="h-4 w-4" /> No pending requests
                    </span>
                  )}
                </div>

                {(summaryByHotel.get(hotel.id!)?.rooms ?? 0) === 0 && (
                  // Without a room a listing cannot take a single booking, so
                  // this is the one thing worth saying loudly.
                  <p className="mt-4 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
                    Add a room before this property can take bookings.
                  </p>
                )}

                <div className="mt-auto pt-6 border-t border-stone-100 flex items-center justify-between text-stone-900 font-medium">
                  <span>Manage property</span>
                  <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-stone-900 transition" />
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
      {hotels.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(hotels.length / itemsPerPage)}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
