import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Booking, RoomType } from '../types';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { Building2, Plus, ChevronRight, Clock, CheckCircle2, XCircle, BedDouble, CalendarCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import SmartImage from '../components/SmartImage';
import { getHotelImage } from '../lib/images';
import { isHotelManager } from '../lib/roles';

import Pagination from '../components/Pagination';

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
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
      const q = query(collection(db, 'hotels'), where("managerId", "==", user?.uid));
      const querySnapshot = await getDocs(q);
      const hotelsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];
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
    // A signed-in traveller used to be bounced silently to the home page, with
    // no hint that hosting was something they could switch on.
    if (!user) {
      navigate('/');
      return;
    }
    if (!isHotelManager(user)) {
      navigate('/list-your-property', { replace: true });
      return;
    }
    fetchMyHotels();
  }, [user, authLoading, navigate]);

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


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {hotels.length === 0 ? (
          <div className="col-span-full bg-white p-16 text-center rounded-3xl border border-stone-200 shadow-sm">
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
          hotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(hotel => (
            <Link
              key={hotel.id}
              to={
                (summaryByHotel.get(hotel.id!)?.pending ?? 0) > 0
                  ? `/dashboard/hotel/${hotel.id}?tab=bookings`
                  : (summaryByHotel.get(hotel.id!)?.rooms ?? 0) === 0
                    ? `/dashboard/hotel/${hotel.id}?tab=rooms`
                    : `/dashboard/hotel/${hotel.id}`
              }
              className="group bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden flex flex-col hover:border-stone-400 transition duration-300"
            >
              <div className="h-56 bg-stone-100 relative">
                <SmartImage
                  src={getHotelImage(hotel)}
                  alt={hotel.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out"
                />
                {/* Moderation status was previously only visible to admins, so a
                    manager had no way to tell whether their listing was live. */}
                <span className={`absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider shadow-sm ${
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
                  className={`absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md transition ${
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
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">{hotel.name}</h3>
                <p className="text-stone-500 mb-5">{hotel.location}</p>

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
            </Link>
          ))
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
