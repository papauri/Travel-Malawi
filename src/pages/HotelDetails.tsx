import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Calendar, Users, Star, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { motion } from 'motion/react';

export default function HotelDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const today = new Date().toISOString().split('T')[0];
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualBookingData, setManualBookingData] = useState({ name: '', email: '', phone: '', whatsapp: '' });
  const [saving, setSaving] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [guestsCount, setGuestsCount] = useState(searchParams.get('guests') ? parseInt(searchParams.get('guests')!) : 2);
  const [guestName, setGuestName] = useState(user?.displayName || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);

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
      setGuestEmail(user.email || '');
    }
  }, [user]);

  const initiateBooking = (room: RoomType) => {
    if (user && user.role !== 'traveller') {
      toast.error("Only guests and travellers can book rooms.");
      return;
    }
    if (guestsCount > room.maxGuests) {
      toast.error(`This room can only accommodate up to ${room.maxGuests} guests. Please select a different room or reduce your guest count.`);
      return;
    }
    setSelectedRoom(room);
      setSelectedPackages([]);
  };

  const handleManualBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    if (!guestName || !guestEmail || !guestPhone) {
      toast.error("Please provide your name, email, and phone number.");
      return;
    }
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = checkIn && checkOut && checkOutDate > checkInDate 
      ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
      : 0;
      
    if (nights <= 0) {
      toast.error("Please select valid check-in and check-out dates.");
      return;
    }
    
    setBookingStatus(`Submitting manual booking for ${selectedRoom.name}...`);
    try {
      await addDoc(collection(db, 'bookings'), {
        hotelId: hotel?.id,
        managerId: hotel?.managerId,
        roomTypeId: selectedRoom.id,
        guestId: user?.uid || 'anonymous',
        guestName: guestName,
        guestEmail: guestEmail,
        guestPhone: guestPhone,
        guestWhatsapp: guestWhatsapp,
        checkIn: checkIn,
        checkOut: checkOut,
        specialRequests: specialRequests,
        guests: guestsCount,
        quantity: 1,
        total: (() => {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = checkIn && checkOut && checkOutDate > checkInDate 
              ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
              : 0;
            const basePrice = selectedRoom.price || 0;
            const extraGuestFee = selectedRoom.extraGuestFee || 0;
            const baseGuests = selectedRoom.baseGuests || selectedRoom.maxGuests || 2;
            const extraGuestsCount = Math.max(0, guestsCount - baseGuests);
            const accommodationTotal = (basePrice + (extraGuestsCount * extraGuestFee)) * nights;
            let packagesTotal = 0;
            if (selectedRoom.packages) {
              selectedRoom.packages.forEach(pkg => {
                if (selectedPackages.includes(pkg.id)) {
                   if (pkg.type === "per_person") packagesTotal += pkg.price * guestsCount * nights;
                   else if (pkg.type === "per_room") packagesTotal += pkg.price * nights;
                   else packagesTotal += pkg.price;
                }
              });
            }
            return accommodationTotal + packagesTotal;
          })(),
          packageIds: selectedPackages,
          extraGuestTotal: Math.max(0, guestsCount - (selectedRoom.baseGuests || selectedRoom.maxGuests || 2)) * (selectedRoom.extraGuestFee || 0),
          packagesTotal: (() => {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = checkIn && checkOut && checkOutDate > checkInDate 
              ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
              : 0;
            let pTotal = 0;
            if (selectedRoom.packages) {
              selectedRoom.packages.forEach(pkg => {
                if (selectedPackages.includes(pkg.id)) {
                   if (pkg.type === "per_person") pTotal += pkg.price * guestsCount * nights;
                   else if (pkg.type === "per_room") pTotal += pkg.price * nights;
                   else pTotal += pkg.price;
                }
              });
            }
            return pTotal;
          })(),
        currency: selectedRoom.currency || 'USD',
        status: 'pending',
        createdAt: Date.now()
      });
      setSaving(false);
      toast.success('Manual booking requested! Manager will review.');
      setSelectedRoom(null);
      navigate('/my-bookings');
    } catch (error) {
      console.error("Booking error:", error);
      setSaving(false);
      toast.error('Failed to submit booking.');
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
      <div className="w-full max-w-[90rem] mx-auto px-4 lg:px-12 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[70vh]">
          {/* Main Hero Image */}
          <div className="md:col-span-2 md:row-span-2 relative rounded-2xl overflow-hidden h-[40vh] md:h-full">
            <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl lg:text-[6rem] font-serif font-medium tracking-tight text-white mb-4 leading-none"
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
            <div key={index} className={`relative rounded-2xl overflow-hidden hidden md:block ${index === 0 ? 'md:col-span-2 md:row-span-1' : 'md:col-span-2 md:row-span-1'}`}>
              <img src={url} alt={`${hotel.name} surroundings ${index + 1}`} className="w-full h-full object-cover hover:scale-105 transition duration-700 ease-out" />
            </div>
          ))}
          {!hotel.galleryUrls && (
            <>
              <div className="relative rounded-2xl overflow-hidden hidden md:block md:col-span-2 md:row-span-1 bg-stone-100 flex items-center justify-center">
                <span className="text-stone-400">No additional photo</span>
              </div>
              <div className="relative rounded-3xl overflow-hidden hidden md:block md:col-span-2 md:row-span-1 bg-stone-100 flex items-center justify-center">
                <span className="text-stone-400">No additional photo</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto px-4 lg:px-12 py-24 grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-24">
        <div className="lg:col-span-2">
          <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-8 tracking-tight">About this property</h2>
          <p className="text-stone-600 text-lg leading-relaxed mb-12">{hotel.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="bg-stone-50 rounded-3xl p-8 border border-stone-200/50">
              <h3 className="text-xl font-serif text-stone-900 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Location
              </h3>
              <p className="text-stone-600 leading-relaxed mb-4">{hotel.location}</p>
              <div className="w-full h-48 bg-stone-200 rounded-2xl overflow-hidden relative">
                {hotel.coordinates ? (
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${hotel.coordinates.lat},${hotel.coordinates.lng}&z=14&output=embed`}
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-300">
                    <span className="text-stone-500 font-medium text-sm">No map coordinates available</span>
                  </div>
                )}
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

          <h2 id="rooms-section" className="text-4xl md:text-5xl font-serif text-stone-900 mb-10 tracking-tight">Available Rooms</h2>
          {rooms.length === 0 ? (
            <p className="text-stone-500 italic">No rooms available at the moment.</p>
          ) : (
            <div className="flex flex-col gap-20 mb-24">
              {rooms.map((room, idx) => (
                <motion.div 
                  key={room.id} 
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={`flex flex-col ${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-10 lg:gap-20 items-center`}
                >
                  <div className="w-full lg:w-1/2 aspect-[4/3] lg:aspect-[4/5] overflow-hidden rounded-2xl relative shadow-xl">
                    {room.imageUrl ? (
                      <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 font-serif">No Photo</div>
                    )}
                  </div>
                  
                  <div className="w-full lg:w-1/2 flex flex-col justify-center py-6">
                    <h3 className="text-4xl md:text-5xl lg:text-6xl font-serif text-stone-900 mb-6 tracking-tight leading-none">{room.name}</h3>
                    <p className="text-stone-500 text-lg md:text-xl leading-relaxed mb-10 font-light">{room.description}</p>
                    
                    <div className="grid grid-cols-2 gap-6 text-stone-900 mb-10 border-y border-stone-200 py-8">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-emerald-600" /> 
                        <span className="font-serif text-lg">{room.maxGuests} Guests Max</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" /> 
                        <span className="font-serif text-lg">{room.quantity} Available</span>
                      </div>
                    </div>
                    
                    {room.packages && room.packages.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-10">
                        {room.packages.map(pkg => (
                          <span key={pkg.id} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-full text-sm font-medium tracking-wide">
                            + {pkg.name}{pkg.price > 0 ? ` ($${pkg.price})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-auto">
                      <div>
                        <span className="text-4xl font-serif text-stone-900">${room.price}</span>
                        <span className="text-stone-500 ml-2 tracking-widest uppercase text-xs font-bold">/ night</span>
                        {room.showDualCurrency && room.priceMWK ? (
                          <div className="text-sm text-stone-400 mt-1">MWK {room.priceMWK?.toLocaleString()} / night</div>
                        ) : null}
                      </div>
                      <button 
                        onClick={() => initiateBooking(room)}
                        className="bg-stone-900 text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-emerald-700 transition-colors duration-300"
                      >
                        Reserve
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {hotel.reviews && hotel.reviews.length > 0 && (
            <div className="mt-8 border-t border-stone-200 pt-12">
              <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-10 tracking-tight">Guest Reviews</h2>
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
              <div className="mb-4">
                <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Email</label>
                <input type="email" required value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Phone Number</label>
                  <input type="tel" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="+1234567890" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">WhatsApp (Optional)</label>
                  <input type="tel" value={guestWhatsapp} onChange={e => setGuestWhatsapp(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="+1234567890" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Check In</label>
                  <input type="date" required min={today} value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Check Out</label>
                  <input type="date" required min={checkIn || today} value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Special Requests</label>
                <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="E.g., early check-in, dietary requirements..." className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition resize-none h-24" />
              </div>
              
              {/* DYNAMIC PRICING AND PACKAGES SECTION */}
                {(() => {
                  const checkInDate = new Date(checkIn);
                  const checkOutDate = new Date(checkOut);
                  const nights = checkIn && checkOut && checkOutDate > checkInDate 
                    ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
                    : 0;
                  
                  const basePrice = selectedRoom.price || 0;
                  const extraGuestFee = selectedRoom.extraGuestFee || 0;
                  const baseGuests = selectedRoom.baseGuests || selectedRoom.maxGuests || 2;
                  const extraGuestsCount = Math.max(0, guestsCount - baseGuests);
                  
                  const roomTotalPerNight = basePrice + (extraGuestsCount * extraGuestFee);
                  const accommodationTotal = roomTotalPerNight * nights;
                  
                  let packagesTotal = 0;
                  if (selectedRoom.packages) {
                    selectedRoom.packages.forEach(pkg => {
                      if (selectedPackages.includes(pkg.id)) {
                         if (pkg.type === "per_person") packagesTotal += pkg.price * guestsCount * nights;
                         else if (pkg.type === "per_room") packagesTotal += pkg.price * nights;
                         else packagesTotal += pkg.price;
                      }
                    });
                  }
                  
                  const grandTotal = accommodationTotal + packagesTotal;
                  
                  return (
                    <div className="space-y-4">
                      {selectedRoom.packages && selectedRoom.packages.length > 0 && (
                        <div className="border border-stone-200 rounded-xl overflow-hidden mb-6 shadow-sm">
                          <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
                            <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wide">Enhance Your Stay</h3>
                          </div>
                          <div className="divide-y divide-stone-100 bg-white">
                            {selectedRoom.packages.map(pkg => (
                              <label key={pkg.id} className="flex items-center gap-4 p-5 hover:bg-stone-50 cursor-pointer transition">
                                <input 
                                  type="checkbox" 
                                  className="w-5 h-5 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                                  checked={selectedPackages.includes(pkg.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedPackages([...selectedPackages, pkg.id]);
                                    else setSelectedPackages(selectedPackages.filter(id => id !== pkg.id));
                                  }}
                                />
                                <div className="flex-1">
                                  <p className="font-bold text-stone-900">{pkg.name}</p>
                                  <p className="text-sm text-stone-500 font-medium">+${pkg.price} {pkg.type === "per_person" ? "per person/night" : pkg.type === "per_room" ? "per room/night" : "per stay"}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-white rounded-xl p-6 border border-stone-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wide border-b border-stone-100 pb-3 mb-4">Price Breakdown</h3>
                        
                        <div className="flex justify-between items-center text-stone-600 font-medium">
                          <span>${basePrice} x {nights} night{nights !== 1 && 's'}</span>
                          <span className="text-stone-900">${basePrice * nights}</span>
                        </div>
                        
                        {extraGuestsCount > 0 && (
                          <div className="flex justify-between items-center text-stone-600 font-medium">
                            <span>Extra Guests ({extraGuestsCount} x ${extraGuestFee} x {nights}n)</span>
                            <span className="text-stone-900">${extraGuestsCount * extraGuestFee * nights}</span>
                          </div>
                        )}
                        
                        {packagesTotal > 0 && (
                          <div className="flex justify-between items-center text-emerald-600 font-medium">
                            <span>Selected Packages</span>
                            <span>+${packagesTotal}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center border-t border-stone-100 pt-4 mt-4">
                          <span className="font-bold text-stone-900 uppercase tracking-wide">Total</span>
                          <div className="text-right">
                            <div className="font-serif font-bold text-3xl text-stone-900">${grandTotal}</div>
                            {selectedRoom.showDualCurrency && selectedRoom.priceMWK && selectedRoom.price && (
                              <div className="text-sm font-medium text-stone-500 mt-1">
                                MWK {(grandTotal * (selectedRoom.priceMWK / selectedRoom.price)).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
