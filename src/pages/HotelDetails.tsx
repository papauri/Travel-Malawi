import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Review } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Calendar, Users, Star, CheckCircle2, ChevronRight, Info, Plus, Minus, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { motion } from 'motion/react';
import SmartImage from '../components/SmartImage';
import { getHotelImages, getRoomImage } from '../lib/images';
import { formatDateStr, nightsBetween, todayStr } from '../lib/dates';
import { BookingLike, isRoomAvailable, unitsRemaining } from '../lib/availability';
import { computeBookingPricing, formatMoney, makeBookingReference } from '../lib/booking';
import { isTraveller } from '../lib/roles';
import Modal, { fieldClass, labelClass } from '../components/Modal';

export default function HotelDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const today = todayStr();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [guestsCount, setGuestsCount] = useState(() => {
    const parsed = parseInt(searchParams.get('guests') ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
  });
  const [guestName, setGuestName] = useState(user?.displayName || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);

  // The property and its rooms are what the page is for; each secondary read
  // is issued separately and swallowed on failure. Bundling them into one
  // Promise.all means any single denied collection blanks the whole page —
  // which is exactly what a `bookings` read denied by undeployed rules did.
  useEffect(() => {
    async function fetchHotelDetails() {
      if (!id) return;
      try {
        const docRef = doc(db, 'hotels', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setHotel({ id: docSnap.id, ...docSnap.data() } as Hotel);
        }

        const roomDocs = await getDocs(query(collection(db, 'room_types'), where('hotelId', '==', id)));
        setRooms(roomDocs.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
      } catch (error) {
        console.error("Error fetching hotel:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchHotelDetails();
  }, [id]);

  // Live occupancy. Without it the page still sells rooms — it just falls back
  // to the manager's stated inventory, and the final pre-write check catches a
  // clash.
  useEffect(() => {
    if (!id) return;
    getDocs(query(collection(db, 'bookings'), where('hotelId', '==', id)))
      .then(snap => setBookings(snap.docs.map(d => d.data() as BookingLike)))
      .catch(err => console.warn('Live availability unavailable:', err?.message ?? err));
  }, [id]);

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

  /** Remaining inventory per room for the dates currently selected. */
  const roomAvailability = useMemo(() => {
    const hasDates = !!checkIn && !!checkOut && checkIn < checkOut;
    const map: Record<string, { available: boolean; remaining: number | null }> = {};
    for (const room of rooms) {
      if (!room.id) continue;
      map[room.id] = hasDates
        ? {
            available: isRoomAvailable(room, bookings, checkIn, checkOut, 1),
            remaining: unitsRemaining(room, bookings, checkIn, checkOut),
          }
        : { available: (room.quantity ?? 0) > 0, remaining: null };
    }
    return map;
  }, [rooms, bookings, checkIn, checkOut]);

  /** Combined rating across imported and guest-written reviews. */
  const ratingSummary = useMemo(() => {
    const ratings = [
      ...(hotel?.reviews ?? []).map(r => r.rating),
      ...reviews.map(r => r.rating),
    ].filter(r => typeof r === 'number' && r > 0);
    if (!ratings.length) return null;
    return {
      average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
      count: ratings.length,
    };
  }, [hotel?.reviews, reviews]);

  /** Imported and guest-written reviews in one list, verified stays first. */
  const allReviews = useMemo(() => {
    const written = reviews.map(r => ({
      key: r.id ?? `review-${r.createdAt}`,
      author: r.authorName || 'Guest',
      rating: r.rating,
      text: r.text,
      date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      source: 'Travel-Malawi',
      verified: true,
    }));
    const imported = (hotel?.reviews ?? []).map((r, i) => ({
      key: `imported-${i}`,
      author: r.author || 'Guest',
      rating: r.rating,
      text: r.text,
      date: r.date,
      source: r.source,
      verified: false,
    }));
    return [...written, ...imported];
  }, [hotel?.reviews, reviews]);

  /**
   * Re-verifies availability against live Firestore data immediately before
   * writing a booking, so two guests racing for the last room can't both win.
   *
   * If the read itself is refused — a signed-out guest against rules that
   * require auth to read `bookings` — this deliberately allows the request
   * through. A booking is a request, not a confirmation: the property re-checks
   * inventory before confirming, and refusing every guest checkout because a
   * verification query was denied is by far the worse failure.
   */
  async function checkRoomAvailability(room: RoomType, quantity: number): Promise<boolean> {
    try {
      const snap = await getDocs(query(collection(db, 'bookings'), where('roomTypeId', '==', room.id)));
      const live = snap.docs.map(d => d.data() as BookingLike);
      return isRoomAvailable(room, live, checkIn, checkOut, quantity);
    } catch (error) {
      console.warn('Could not verify live availability; deferring to the property:', error);
      return true;
    }
  }

  const initiateBooking = (room: RoomType) => {
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
  };

  const handleManualBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || saving) return;

    if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
      toast.error("Please provide your name, email, and phone number.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    // At least seven digits, so a placeholder cannot be saved as the only way
    // the property has to reach the guest.
    if (guestPhone.replace(/\D/g, '').length < 7) {
      toast.error("Please enter a valid phone number, including country code.");
      return;
    }
    if (nightsBetween(checkIn, checkOut) <= 0) {
      toast.error("Please select valid check-in and check-out dates.");
      return;
    }
    if (checkIn < today) {
      toast.error("Check-in cannot be in the past.");
      return;
    }
    if (guestsCount < 1 || guestsCount > selectedRoom.maxGuests) {
      toast.error(`This room accommodates between 1 and ${selectedRoom.maxGuests} guests.`);
      return;
    }

    setSaving(true);
    setBookingStatus(`Submitting booking request for ${selectedRoom.name}...`);
    try {
      // Availability may have changed while the form was open, so it is
      // re-checked against live data rather than trusting the render-time view.
      const isAvailable = await checkRoomAvailability(selectedRoom, 1);
      if (!isAvailable) {
        toast.error("Sorry, that room was just taken for these dates. Please try different dates.");
        return;
      }

      // Same helper that renders the on-screen breakdown, so the stored total
      // can never disagree with the price the guest was shown.
      const pricing = computeBookingPricing(selectedRoom, checkIn, checkOut, guestsCount, 1, selectedPackages);
      const reference = makeBookingReference();

      await addDoc(collection(db, 'bookings'), {
        reference,
        hotelId: hotel?.id,
        managerId: hotel?.managerId ?? null,
        roomTypeId: selectedRoom.id,
        guestId: user?.uid || 'anonymous',
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        guestWhatsapp: guestWhatsapp.trim(),
        checkIn,
        checkOut,
        specialRequests: specialRequests.trim(),
        guests: guestsCount,
        quantity: 1,
        total: pricing.total,
        packageIds: selectedPackages,
        extraGuestTotal: pricing.extraGuestTotal,
        packagesTotal: pricing.packagesTotal,
        currency: selectedRoom.currency || 'USD',
        status: 'pending',
        createdAt: Date.now()
      });

      // The reference is the only handle a signed-out guest has on the booking,
      // so it is surfaced rather than only stored.
      toast.success(`Booking requested — reference ${reference}. The property will review and confirm.`, { duration: 8000 });
      setSelectedRoom(null);
      // A guest booking without an account has nothing to show on the bookings
      // page, which is traveller-only.
      if (user) navigate('/my-bookings');
    } catch (error) {
      console.error("Booking error:", error);
      toast.error('Failed to submit booking.');
    } finally {
      setSaving(false);
      setBookingStatus(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
    </div>
  );
  if (!hotel) return <div className="p-20 text-center text-xl font-serif">Property not found.</div>;

  // Falls back to bundled photography when the record has no usable images.
  const hotelImages = getHotelImages(hotel);
  // A single photograph gets the full width rather than a third of the grid.
  const galleryImages = hotelImages.slice(1, 3);
  const hasGallery = galleryImages.length > 0;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header image and gallery.
          The layout follows how many photographs a listing actually has.
          It used to be a fixed three-up grid padded with "No additional photo"
          boxes, so a listing with one image gave over half its header to two
          empty grey panels. */}
      <div className="w-full max-w-[90rem] mx-auto px-4 lg:px-12 mt-4">
        <div className={`grid gap-3 md:h-[68vh] ${hasGallery ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Main image */}
          <div className={`relative rounded-3xl overflow-hidden h-[46vh] md:h-full ${hasGallery ? 'md:col-span-2 md:row-span-2' : ''}`}>
            <SmartImage src={hotelImages[0]} alt={hotel.name} loading="eager" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/10 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full p-7 md:p-10">
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
                {hotel.name}
              </motion.h1>
            </div>
          </div>

          {/* Supporting photographs, only when they exist */}
          {galleryImages.map((url, index) => (
            <div key={url} className="relative rounded-3xl overflow-hidden hidden md:block md:col-span-2 md:row-span-1 group">
              <SmartImage
                src={url}
                alt={`${hotel.name} — photograph ${index + 2}`}
                className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-700 ease-out"
              />
            </div>
          ))}
        </div>

        {/* A listing awaiting moderation is reachable by direct link, so it says
            plainly that it cannot be booked rather than failing at submit. */}
        {!isBookable && (
          <div className="mt-6 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-6 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">This property is not taking bookings yet</p>
              <p className="text-sm text-amber-800/80 mt-0.5">
                {hotel.status === 'rejected'
                  ? 'The listing is not currently published on Travel-Malawi.'
                  : 'The listing is awaiting review by our team. Check back shortly.'}
              </p>
            </div>
          </div>
        )}

        {ratingSummary && (
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-full">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold">{ratingSummary.average.toFixed(1)}</span>
            </div>
            <span className="text-stone-500 text-sm">
              {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}
            </span>
          </div>
        )}
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
              {rooms.map((room, idx) => {
                const status = room.id ? roomAvailability[room.id] : undefined;
                const isSoldOut = status ? !status.available : (room.quantity ?? 0) <= 0;
                const hasDates = !!checkIn && !!checkOut && checkIn < checkOut;
                return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={`flex flex-col ${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-10 lg:gap-20 items-center`}
                >
                  <div className="w-full lg:w-1/2 aspect-[4/3] lg:aspect-[4/5] overflow-hidden rounded-2xl relative shadow-xl">
                    <SmartImage
                      src={getRoomImage(room, hotel)}
                      alt={room.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000"
                    />
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
                        {isSoldOut ? (
                          <>
                            <Info className="h-5 w-5 text-red-500" />
                            <span className="font-serif text-lg text-red-600">
                              {hasDates ? 'Sold out for these dates' : 'Not available'}
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <span className="font-serif text-lg">
                              {status?.remaining != null ? status.remaining : room.quantity} Available
                            </span>
                          </>
                        )}
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
                        disabled={isSoldOut || !isBookable}
                        className="bg-stone-900 text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-emerald-700 transition-colors duration-300 disabled:bg-stone-300 disabled:hover:bg-stone-300 disabled:cursor-not-allowed"
                      >
                        {isSoldOut ? 'Unavailable' : 'Reserve'}
                      </button>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </div>
          )}
          {allReviews.length > 0 && (
            <div className="mt-8 border-t border-stone-200 pt-12">
              <div className="flex flex-wrap items-baseline gap-4 mb-10">
                <h2 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-tight">Guest Reviews</h2>
                {ratingSummary && (
                  <span className="text-stone-500 text-lg">
                    {ratingSummary.average.toFixed(1)} average from {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-6">
                {allReviews.map(review => (
                  <div key={review.key} className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
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
                        <span className="font-semibold text-stone-900">{review.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="text-stone-700 leading-relaxed italic">"{review.text}"</p>
                    {/* Only a review written from a completed booking on this
                        platform can claim a verified stay; imported ones say
                        where they came from instead. */}
                    {review.verified ? (
                      <p className="text-xs text-emerald-700 mt-4 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4" /> Verified stay
                      </p>
                    ) : (
                      <p className="text-xs text-stone-400 mt-4 uppercase tracking-wider font-semibold">
                        Imported from {review.source}
                      </p>
                    )}
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
      
      {/* Booking request */}
      {selectedRoom && (() => {
        const pricing = computeBookingPricing(selectedRoom, checkIn, checkOut, guestsCount, 1, selectedPackages);
        const { nights, basePrice, extraGuestFee, extraGuestsCount, packagesTotal, total: grandTotal } = pricing;
        const canSubmit = nights > 0 && !saving;

        return (
          <Modal
            open
            onClose={() => setSelectedRoom(null)}
            title={`Reserve · ${selectedRoom.name}`}
            description="Send your dates and details. Payment is settled at the property once they confirm."
            size="lg"
            footer={
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[0.7rem] font-semibold text-stone-400 uppercase tracking-wider">
                    {nights > 0 ? `Total · ${nights} night${nights === 1 ? '' : 's'}` : 'Total'}
                  </p>
                  <p className="font-serif text-2xl font-semibold text-stone-900 leading-tight">
                    {formatMoney(grandTotal, selectedRoom.currency)}
                  </p>
                </div>
                <button
                  type="submit"
                  form="booking-form"
                  disabled={!canSubmit}
                  className="shrink-0 bg-stone-900 text-white px-7 py-3.5 rounded-full font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Submitting…' : 'Request booking'}
                </button>
              </div>
            }
          >
            <form id="booking-form" onSubmit={handleManualBook} className="space-y-5">
              <div>
                <label className={labelClass}>Guest name</label>
                <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} className={fieldClass} placeholder="Full name" />
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input type="email" required value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className={fieldClass} placeholder="you@example.com" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone number</label>
                  <input type="tel" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className={fieldClass} placeholder="+265 …" />
                </div>
                <div>
                  <label className={labelClass}>WhatsApp <span className="text-stone-400 font-normal">· optional</span></label>
                  <input type="tel" value={guestWhatsapp} onChange={e => setGuestWhatsapp(e.target.value)} className={fieldClass} placeholder="+265 …" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Check in</label>
                  <input type="date" required min={today} value={checkIn} onChange={e => setCheckIn(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Check out</label>
                  <input type="date" required min={checkIn || today} value={checkOut} onChange={e => setCheckOut(e.target.value)} className={fieldClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Guests</label>
                <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-stone-600">
                    {guestsCount} guest{guestsCount !== 1 ? 's' : ''}
                    <span className="text-stone-400"> · sleeps {selectedRoom.maxGuests}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Fewer guests"
                      disabled={guestsCount <= 1}
                      onClick={() => setGuestsCount(Math.max(1, guestsCount - 1))}
                      className="h-8 w-8 grid place-items-center rounded-full border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 disabled:hover:border-stone-300 transition"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{guestsCount}</span>
                    <button
                      type="button"
                      aria-label="More guests"
                      disabled={guestsCount >= selectedRoom.maxGuests}
                      onClick={() => setGuestsCount(Math.min(selectedRoom.maxGuests, guestsCount + 1))}
                      className="h-8 w-8 grid place-items-center rounded-full border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 disabled:opacity-30 disabled:hover:border-stone-300 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Special requests <span className="text-stone-400 font-normal">· optional</span></label>
                <textarea
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                  placeholder="Early check-in, dietary requirements, an occasion we should know about…"
                  className={`${fieldClass} resize-none h-24`}
                />
              </div>

              {selectedRoom.packages && selectedRoom.packages.length > 0 && (
                <div>
                  <label className={labelClass}>Enhance your stay</label>
                  <div className="grid gap-2">
                    {selectedRoom.packages.map(pkg => {
                      const checked = selectedPackages.includes(pkg.id);
                      return (
                        <label
                          key={pkg.id}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                            checked
                              ? 'border-stone-900 bg-stone-50'
                              : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) setSelectedPackages([...selectedPackages, pkg.id]);
                              else setSelectedPackages(selectedPackages.filter(id => id !== pkg.id));
                            }}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-stone-900">{pkg.name}</span>
                            <span className="block text-xs text-stone-500">
                              {pkg.price > 0 ? `+$${pkg.price}` : 'Included'}
                              {pkg.type === 'per_person' ? ' per person, per night' : pkg.type === 'per_room' ? ' per room, per night' : ' per stay'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5">
                <div className="flex items-baseline justify-between border-b border-stone-200 pb-3 mb-4">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Price breakdown</h3>
                  {nights > 0 && (
                    <p className="text-xs text-stone-400">
                      {formatDateStr(checkIn, { month: 'short', day: 'numeric' })} &rarr; {formatDateStr(checkOut, { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>

                {nights === 0 ? (
                  <p className="text-sm text-stone-500">Pick your dates to see the total.</p>
                ) : (
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between text-stone-600">
                      <span>${basePrice} &times; {nights} night{nights === 1 ? '' : 's'}</span>
                      <span className="text-stone-900 tabular-nums">${(basePrice * nights).toLocaleString()}</span>
                    </div>

                    {extraGuestsCount > 0 && (
                      <div className="flex justify-between text-stone-600">
                        <span>Extra guests ({extraGuestsCount} &times; ${extraGuestFee} &times; {nights}n)</span>
                        <span className="text-stone-900 tabular-nums">${(extraGuestsCount * extraGuestFee * nights).toLocaleString()}</span>
                      </div>
                    )}

                    {packagesTotal > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Selected packages</span>
                        <span className="tabular-nums">+${packagesTotal.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-baseline border-t border-stone-200 pt-3 mt-3">
                      <span className="font-semibold text-stone-900">Total</span>
                      <div className="text-right">
                        <div className="font-serif text-xl font-semibold text-stone-900 tabular-nums">
                          {formatMoney(grandTotal, selectedRoom.currency)}
                        </div>
                        {selectedRoom.showDualCurrency && selectedRoom.priceMWK && selectedRoom.price ? (
                          <div className="text-xs text-stone-500 mt-0.5 tabular-nums">
                            {/* Rounded: the implied rate produces fractional
                                kwacha, which is not a real amount. */}
                            MWK {Math.round(grandTotal * (selectedRoom.priceMWK / selectedRoom.price)).toLocaleString()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="flex items-start gap-2 text-xs text-stone-500 leading-relaxed">
                <Info className="h-4 w-4 shrink-0 mt-px text-stone-400" />
                Sending this reserves nothing yet — the property reviews every request and confirms by phone or WhatsApp. Free cancellation up to 7 days before arrival.
              </p>
            </form>
          </Modal>
        );
      })()}

      {bookingStatus && (
        <div className="fixed bottom-6 right-6 bg-stone-900 text-white px-8 py-4 rounded-full shadow-2xl font-medium z-50">
          {bookingStatus}
        </div>
      )}
    </div>
  );
}
