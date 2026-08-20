import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Users, CheckCircle2, Star } from 'lucide-react';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { motion } from 'motion/react';

export default function HotelDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [guestsCount, setGuestsCount] = useState(searchParams.get('guests') ? parseInt(searchParams.get('guests')!) : 2);
  const [guestName, setGuestName] = useState(user?.displayName || '');
  const [specialRequests, setSpecialRequests] = useState('');

  useEffect(() => {
    async function fetchHotelDetails() {
      if (!id) return;
      try {
        const docRef = doc(db, 'hotels', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setHotel({ id: docSnap.id, ...docSnap.data() } as Hotel);
        }

        const q = query(collection(db, 'room_types'), where('hotelId', '==', id));
        const roomDocs = await getDocs(q);
        setRooms(roomDocs.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
      } catch (error) {
        console.error("Error fetching hotel:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchHotelDetails();
  }, [id]);

  useEffect(() => {
    if (user) {
      setGuestName(user.displayName || '');
    }
  }, [user]);

  const initiateBooking = (room: RoomType) => {
    if (!user) {
      alert("Please sign in as a traveller to book.");
      return;
    }
    if (user.role !== 'traveller') {
      alert("Only travellers can book rooms. Please sign in as a traveller.");
      return;
    }
    setSelectedRoom(room);
  };

  const handleManualBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRoom) return;
    
    setBookingStatus(`Submitting manual booking for ${selectedRoom.name}...`);
    try {
      await addDoc(collection(db, 'bookings'), {
        hotelId: hotel?.id,
        roomTypeId: selectedRoom.id,
        guestId: user.uid,
        guestName: guestName,
        checkIn: checkIn,
        checkOut: checkOut,
        specialRequests: specialRequests,
        guests: 2,
        quantity: 1,
        total: selectedRoom.price,
        currency: selectedRoom.currency || 'USD',
        status: 'pending',
        createdAt: Date.now()
      });
      setBookingStatus('Manual booking requested! Manager will review.');
      setTimeout(() => {
        setSelectedRoom(null);
        navigate('/my-bookings');
      }, 2000);
    } catch (error) {
      console.error("Booking error:", error);
      setBookingStatus('Failed to submit booking. Please try again.');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
    </div>
  );
  if (!hotel) return <div className="p-20 text-center text-xl font-serif">Property not found.</div>;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Cinematic Header Image & Gallery */}
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[60vh]">
          {/* Main Hero Image */}
          <div className="md:col-span-2 md:row-span-2 relative rounded-3xl overflow-hidden h-[40vh] md:h-full">
            <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight"
              >
                {hotel.name}
              </motion.h1>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center text-white/90 gap-2 text-lg"
              >
                <MapPin className="h-5 w-5" />
                <span>{hotel.location}</span>
              </motion.div>
            </div>
          </div>
          
          {/* Secondary Gallery Images */}
          {hotel.galleryUrls && hotel.galleryUrls.map((url, index) => (
            <div key={index} className={`relative rounded-3xl overflow-hidden hidden md:block ${index === 0 ? 'md:col-span-2 md:row-span-1' : 'md:col-span-2 md:row-span-1'}`}>
              <img src={url} alt={`${hotel.name} surroundings ${index + 1}`} className="w-full h-full object-cover hover:scale-105 transition duration-700 ease-out" referrerPolicy="no-referrer" />
            </div>
          ))}
          {!hotel.galleryUrls && (
            <>
              <div className="relative rounded-3xl overflow-hidden hidden md:block md:col-span-2 md:row-span-1 bg-stone-100 flex items-center justify-center">
                <span className="text-stone-400">No additional photo</span>
              </div>
              <div className="relative rounded-3xl overflow-hidden hidden md:block md:col-span-2 md:row-span-1 bg-stone-100 flex items-center justify-center">
                <span className="text-stone-400">No additional photo</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2">
          <h2 className="text-3xl font-serif text-stone-900 mb-6">About this property</h2>
          <p className="text-stone-600 text-lg leading-relaxed mb-12">{hotel.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="bg-stone-50 rounded-3xl p-8 border border-stone-200/50">
              <h3 className="text-xl font-serif text-stone-900 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Location
              </h3>
              <p className="text-stone-600 leading-relaxed mb-4">{hotel.location}</p>
              <div className="w-full h-48 bg-stone-200 rounded-2xl overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center bg-stone-300">
                  <span className="text-stone-500 font-medium text-sm">Map View (Placeholder)</span>
                </div>
              </div>
            </div>
            
            <div className="bg-stone-50 rounded-3xl p-8 border border-stone-200/50">
              <h3 className="text-xl font-serif text-stone-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Policies
              </h3>
              <ul className="space-y-4 text-stone-600">
                <li className="flex justify-between border-b border-stone-200 pb-2">
                  <span className="font-medium">Check-in</span>
                  <span>From 14:00</span>
                </li>
                <li className="flex justify-between border-b border-stone-200 pb-2">
                  <span className="font-medium">Check-out</span>
                  <span>Until 11:00</span>
                </li>
                <li className="flex justify-between border-b border-stone-200 pb-2">
                  <span className="font-medium">Cancellation</span>
                  <span>Free up to 7 days prior</span>
                </li>
                <li className="flex justify-between border-b border-stone-200 pb-2">
                  <span className="font-medium">Payment</span>
                  <span>Pay at property</span>
                </li>
              </ul>
            </div>
          </div>

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

          <h2 id="rooms-section" className="text-3xl font-serif text-stone-900 mb-8">Available Rooms</h2>
          {rooms.length === 0 ? (
            <p className="text-stone-500 italic">No rooms available at the moment.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              {rooms.map(room => (
                <div key={room.id} className="bg-stone-50 rounded-3xl overflow-hidden flex flex-col border border-stone-200/60 shadow-sm hover:shadow-md transition">
                  <div className="h-48 bg-stone-200 relative">
                    {room.imageUrl ? (
                      <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400">No Room Photo</div>
                    )}
                  </div>
                  <div className="p-8 flex flex-col flex-1">
                    <h3 className="text-2xl font-serif font-semibold text-stone-900 mb-3">{room.name}</h3>
                    <p className="text-stone-500 mb-6 flex-1">{room.description}</p>
                    <div className="flex items-center gap-6 text-sm text-stone-600 mb-8 font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> {room.maxGuests} Guests
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> {room.quantity} Available
                      </div>
                    </div>
                    <div className="flex items-end justify-between border-t border-stone-200 pt-6">
                      <div>
                        <span className="text-3xl font-serif text-stone-900">{room.currency === 'MWK' ? 'MWK ' : '$'}{room.price}</span>
                        <span className="text-sm font-medium text-stone-500 ml-1">/ night</span>
                      </div>
                      <button 
                        onClick={() => initiateBooking(room)}
                        className="bg-stone-900 text-white px-6 py-2.5 rounded-full font-medium hover:bg-stone-800 transition"
                      >
                        Request Booking
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hotel.reviews && hotel.reviews.length > 0 && (
            <div className="mt-8 border-t border-stone-200 pt-12">
              <h2 className="text-3xl font-serif text-stone-900 mb-8">Guest Reviews</h2>
              <div className="grid grid-cols-1 gap-6">
                {hotel.reviews.map((review, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
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
                        <span className="font-semibold text-stone-900">{review.rating}.0</span>
                      </div>
                    </div>
                    <p className="text-stone-700 leading-relaxed italic">"{review.text}"</p>
                    <p className="text-xs text-stone-400 mt-4 uppercase tracking-wider font-semibold">Verified on {review.source}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Sticky Sidebar / Amenities */}
        <div className="relative">
          <div className="sticky top-32 bg-white border border-stone-200 rounded-3xl p-8 shadow-sm">
            <h3 className="text-2xl font-serif text-stone-900 mb-6">Property Highlights</h3>
            <ul className="space-y-4">
              {hotel.amenities?.map((amenity, i) => (
                <li key={i} className="flex items-center gap-3 text-stone-600 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-stone-900" />
                  {amenity}
                </li>
              )) || <li className="text-stone-500">Premium amenities included.</li>}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Manual Booking Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-stone-100">
              <h2 className="text-2xl font-serif text-stone-900 font-bold">Manual Booking Request</h2>
              <p className="text-stone-500 mt-2 text-sm">Submit your dates and details. Payment will be settled at the property after confirmation.</p>
            </div>
            <form onSubmit={handleManualBook} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Guest Name</label>
                <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Check In</label>
                  <input type="date" required value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Check Out</label>
                  <input type="date" required value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Special Requests</label>
                <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="E.g., early check-in, dietary requirements..." className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition resize-none h-24" />
              </div>
              
              <div className="bg-stone-50 rounded-xl p-4 flex justify-between items-center border border-stone-200">
                <span className="text-stone-600 font-medium">{selectedRoom.name}</span>
                <span className="font-serif font-bold text-lg text-stone-900">{selectedRoom.currency === 'MWK' ? 'MWK ' : '$'}{selectedRoom.price}/night</span>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setSelectedRoom(null)} className="flex-1 bg-stone-100 text-stone-900 px-6 py-3 rounded-full font-medium hover:bg-stone-200 transition">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-stone-900 text-white px-6 py-3 rounded-full font-medium hover:bg-stone-800 transition">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bookingStatus && (
        <div className="fixed bottom-6 right-6 bg-stone-900 text-white px-8 py-4 rounded-full shadow-2xl font-medium z-50">
          {bookingStatus}
        </div>
      )}
    </div>
  );
}
