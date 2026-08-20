import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Hotel, RoomType } from '../types';
import { Calendar, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
        
        setBookings(enrichedBookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [user, navigate]);

  if (loading) return <div className="p-20 text-center text-stone-500 font-medium">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-serif font-bold text-stone-900 mb-12">My Itinerary</h1>
      {bookings.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-stone-200 shadow-sm max-w-2xl mx-auto">
          <Calendar className="h-16 w-16 text-stone-300 mx-auto mb-6" />
          <p className="text-xl text-stone-500 font-serif mb-6">You have no upcoming trips.</p>
          <button onClick={() => navigate('/')} className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition">
            Explore Places to Stay
          </button>
        </div>
      ) : (
        <div className="grid gap-8">
          {bookings.map(booking => (
            <div key={booking.id} className="flex flex-col md:flex-row bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="md:w-80 h-56 md:h-auto bg-stone-100 relative">
                {booking.hotel?.imageUrl && (
                  <img src={booking.hotel?.imageUrl} alt={booking.hotel?.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
              </div>
              <div className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-2xl font-serif font-bold text-stone-900">{booking.hotel?.name || 'Hotel'}</h3>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-900'}`}>
                      {booking.status}
                    </span>
                  </div>
                  <div className="flex items-center text-stone-500 gap-2 mb-6 font-medium">
                    <MapPin className="h-4 w-4" /> {booking.hotel?.location || 'Location'}
                  </div>
                  <p className="text-stone-900 font-medium text-lg">{booking.room?.name || 'Room'}</p>
                </div>
                <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                  <div className="text-stone-500 font-medium">
                    <p className="mb-1">Check-in: <span className="text-stone-900">{booking.checkIn}</span></p>
                    <p>Check-out: <span className="text-stone-900">{booking.checkOut}</span></p>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-3xl font-serif font-bold text-stone-900 mb-2">
                      {booking.currency === 'MWK' ? 'MWK ' : '$'}{booking.total} <span className="text-sm font-sans font-medium text-stone-500">total</span>
                    </div>
                    {booking.status === 'pending' && (
                      <p className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-wider border border-amber-200">Payment: Settle at property</p>
                    )}
                    {booking.status === 'confirmed' && (
                      <p className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full uppercase tracking-wider border border-green-200">Payment: Settle at property</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
