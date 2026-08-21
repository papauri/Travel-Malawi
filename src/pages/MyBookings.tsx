import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Hotel, RoomType } from '../types';
import { Calendar, MapPin, ExternalLink, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<(Booking & { hotel?: Hotel, room?: RoomType })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'traveller') {
      navigate('/');
      return;
    }

    async function fetchBookings() {
      try {
        const q = query(collection(db, 'bookings'), where('guestId', '==', user?.uid));
        const docs = await getDocs(q);
        const bookingsData = docs.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
        
        // Fetch hotel and room details for each booking
        const enrichedBookings = await Promise.all(bookingsData.map(async (booking) => {
          const hotelDocs = await getDocs(query(collection(db, 'hotels'), where('__name__', '==', booking.hotelId)));
          const roomDocs = await getDocs(query(collection(db, 'room_types'), where('__name__', '==', booking.roomTypeId)));
          return {
            ...booking,
            hotel: hotelDocs.docs[0]?.data() as Hotel,
            room: roomDocs.docs[0]?.data() as RoomType,
          };
        }));
        
        // Sort bookings by createdAt descending
        enrichedBookings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBookings(enrichedBookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [user, navigate]);

  if (loading) return (
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
            <XCircle className="w-3.5 h-3.5" /> Rejected
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

  return (
    <div className="min-h-screen bg-stone-50 pt-8 pb-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">My Itinerary</h1>
        <p className="text-stone-500 mb-10">Manage your upcoming stays and past bookings.</p>
        
        {bookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm mx-auto flex flex-col items-center">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-6">
              <Calendar className="h-10 w-10 text-stone-400" />
            </div>
            <h2 className="text-2xl text-stone-900 font-serif font-bold mb-3">No trips booked... yet!</h2>
            <p className="text-stone-500 mb-8 max-w-md">Time to dust off your bags and start planning your next adventure in Malawi.</p>
            <button onClick={() => navigate('/')} className="bg-stone-900 text-white px-8 py-3.5 rounded-full font-medium hover:bg-stone-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              Start Exploring
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map(booking => (
              <div key={booking.id} className="group flex flex-col md:flex-row bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="md:w-72 h-56 md:h-auto bg-stone-100 relative overflow-hidden">
                  {booking.hotel?.imageUrl ? (
                    <img src={booking.hotel?.imageUrl} alt={booking.hotel?.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400">No Image</div>
                  )}
                  <div className="absolute top-4 left-4">
                    {getStatusBadge(booking.status)}
                  </div>
                </div>
                
                <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <Link to={`/hotel/${booking.hotel?.id}`} className="hover:text-emerald-600 transition">
                        <h3 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
                          {booking.hotel?.name || 'Hotel'}
                          <ExternalLink className="w-4 h-4 text-stone-400 opacity-0 group-hover:opacity-100 transition" />
                        </h3>
                      </Link>
                    </div>
                    <div className="flex items-center text-stone-500 gap-1.5 mb-6 text-sm font-medium">
                      <MapPin className="h-4 w-4" /> {booking.hotel?.location || 'Location'}
                    </div>
                    
                    <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex flex-col sm:flex-row gap-4 sm:gap-8 mb-6">
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Check-in</p>
                        <p className="font-medium text-stone-900">{booking.checkIn ? new Date(booking.checkIn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A'}</p>
                      </div>
                      <div className="hidden sm:block w-px bg-stone-200"></div>
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Check-out</p>
                        <p className="font-medium text-stone-900">{booking.checkOut ? new Date(booking.checkOut).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A'}</p>
                      </div>
                      <div className="hidden sm:block w-px bg-stone-200"></div>
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Room</p>
                        <p className="font-medium text-stone-900 truncate max-w-[120px]" title={booking.room?.name || 'Room'}>{booking.room?.name || 'Room'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-auto">
                    <div>
                      {booking.status === 'pending' && (
                        <p className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                          Waiting for property confirmation. Payment on arrival.
                        </p>
                      )}
                      {(booking.status === 'confirmed' || booking.status === 'approved') && (
                        <p className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                          Your stay is confirmed! Payment on arrival.
                        </p>
                      )}
                    </div>
                    <div className="text-right w-full sm:w-auto">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Total Price</p>
                      <div className="text-2xl font-serif font-bold text-stone-900">
                        {booking.currency === 'MWK' ? 'MWK ' : '$'}{booking.total?.toLocaleString() ?? 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

