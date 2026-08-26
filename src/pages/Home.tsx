import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, MapPin, Calendar, Users, Star, LocateFixed, ChevronDown, Plus, Minus, ShieldCheck, MessageCircle, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { Link } from 'react-router-dom';
import HotelCard from '../components/HotelCard';
import SmartImage from '../components/SmartImage';
import { DECORATIVE_IMAGE, getHotelImage } from '../lib/images';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

export default function Home() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  const [searchLocation, setSearchLocation] = useState('');
  const [searchCheckIn, setSearchCheckIn] = useState('');
  const [searchCheckOut, setSearchCheckOut] = useState('');
  
  // Advanced Guest Selector
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const totalGuests = adults + children;

  const [searchProximity, setSearchProximity] = useState(50);
  const [appliedSearch, setAppliedSearch] = useState<{
    location: string;
    checkIn: string;
    checkOut: string;
    guests: number | '';
    coords: { lat: number; lng: number } | null;
    proximity: number;
  }>({ location: '', checkIn: '', checkOut: '', guests: '', coords: null, proximity: 50 });

  const fetchHotels = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'hotels'));
      const hotelsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];
      setHotels(hotelsData.filter(h => h.status === 'approved' || !h.status));
    } catch (error) {
      console.error("Error fetching hotels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const handleSearch = () => {
    setAppliedSearch({ location: searchLocation, checkIn: searchCheckIn, checkOut: searchCheckOut, guests: totalGuests, coords: null, proximity: searchProximity });
  };

  const handleNearMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setAppliedSearch({
          location: 'Near Me',
          checkIn: searchCheckIn,
          checkOut: searchCheckOut,
          guests: totalGuests,
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          proximity: searchProximity
        });
        setSearchLocation('Near Me');
        toast.success(`Found your location! Showing places within ${searchProximity}km.`);
      }, () => toast.error("Could not get your location. Please check browser permissions."));
    } else {
      toast.error("Geolocation is not supported by your browser.");
    }
  };

  const approvedHotels = hotels.filter(h => !h.status || h.status === 'approved');
  const filteredHotels = (activeCategory === 'All' 
    ? approvedHotels 
    : approvedHotels.filter(h => h.categories?.includes(activeCategory)))
    .filter(h => {
      if (appliedSearch.coords) {
        if (!h.coordinates) return false;
        const dist = getDistance(appliedSearch.coords.lat, appliedSearch.coords.lng, h.coordinates.lat, h.coordinates.lng);
        if (dist > appliedSearch.proximity) return false;
      } else if (appliedSearch.location) {
        const query = appliedSearch.location.toLowerCase();
        if (!h.name.toLowerCase().includes(query) && !h.location.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });

  

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-stone-900">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/60 via-stone-900/40 to-stone-900/70 z-10" />
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 1.1 }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          className="absolute inset-0 z-0"
        >
          <SmartImage
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2940&auto=format&fit=crop"
            fallbacks={[DECORATIVE_IMAGE]}
            alt="Luxury Resort"
            loading="eager"
            showSkeleton={false}
            className="w-full h-full object-cover object-center"
          />
        </motion.div>
        
        <div className="relative z-20 w-full max-w-7xl px-6 lg:px-8 flex flex-col items-center text-center mt-12">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl sm:text-6xl md:text-8xl lg:text-[7rem] font-serif text-white max-w-5xl leading-[1] tracking-tighter mb-12 drop-shadow-2xl px-4"
          >
            Discover the warm heart of Africa.
          </motion.h1>

          {/* Search Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2rem] md:rounded-full p-2 md:p-2 shadow-2xl flex flex-col md:flex-row items-center w-[90%] md:w-full max-w-4xl border border-stone-200"
          >
            {/* Location & Near Me */}
            <div className="flex-1 flex items-center px-4 md:px-6 py-3 hover:bg-stone-50 rounded-3xl md:rounded-full cursor-pointer w-full transition relative group">
              <MapPin className="h-5 w-5 text-stone-400 mr-3 shrink-0" />
              <div className="text-left w-full flex-1">
                <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-0.5">Where</p>
                <div className="flex items-center">
                  <input 
                    type="text" 
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    placeholder="Search destinations" 
                    list="malawi-cities"
                    className="bg-transparent border-none p-0 focus:ring-0 text-stone-600 text-sm w-full outline-none"
                  />
                  <datalist id="malawi-cities">
                    <option value="Lilongwe" />
                    <option value="Blantyre" />
                    <option value="Mzuzu" />
                    <option value="Zomba" />
                    <option value="Mangochi" />
                    <option value="Salima" />
                    <option value="Cape Maclear" />
                    <option value="Likoma Island" />
                    <option value="Nkhata Bay" />
                  </datalist>
                  
                  {/* Near Me Target Button inside input */}
                  <div className="relative flex items-center">
                    <button 
                      title="Near Me"
                      onClick={handleNearMe}
                      className={`p-1.5 rounded-full transition ${searchLocation === 'Near Me' ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-stone-200 text-stone-400 hover:text-stone-600'}`}
                    >
                      <LocateFixed className="w-4 h-4" />
                    </button>
                    
                    {/* Proximity Dropdown (Visible only when 'Near Me' is active) */}
                    {searchLocation === 'Near Me' && (
                      <div className="absolute top-full right-0 mt-4 bg-white rounded-2xl shadow-xl border border-stone-100 p-4 w-64 z-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-stone-900">Radius</span>
                          <span className="text-sm font-medium text-emerald-600">{searchProximity} km</span>
                        </div>
                        <input 
                          type="range" 
                          min="5" 
                          max="200" 
                          step="5"
                          value={searchProximity} 
                          onChange={(e) => {
                            setSearchProximity(Number(e.target.value));
                            // Update applied search if already active
                            if (appliedSearch.coords) {
                              setAppliedSearch(prev => ({ ...prev, proximity: Number(e.target.value) }));
                            }
                          }}
                          className="w-full accent-emerald-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-stone-400 mt-2 font-medium">
                          <span>5km</span>
                          <span>200km</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="hidden md:block w-px h-10 bg-stone-200 mx-2" /><div className="block md:hidden w-[90%] h-px bg-stone-200 my-1" />
            
            {/* Dates */}
            <div className="flex-[1.2] flex items-center px-4 md:px-6 py-3 hover:bg-stone-50 rounded-3xl md:rounded-full cursor-pointer w-full transition">
              <Calendar className="h-5 w-5 text-stone-400 mr-3 shrink-0" />
              <div className="text-left w-full flex gap-4">
                <div className="flex-1">
                  <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-0.5">Check in</p>
                  <input type="date" min={new Date().toISOString().split('T')[0]} value={searchCheckIn} onChange={(e) => setSearchCheckIn(e.target.value)} className="bg-transparent border-none p-0 focus:ring-0 text-stone-600 text-sm w-full outline-none" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-0.5">Check out</p>
                  <input type="date" min={searchCheckIn || new Date().toISOString().split('T')[0]} value={searchCheckOut} onChange={(e) => setSearchCheckOut(e.target.value)} className="bg-transparent border-none p-0 focus:ring-0 text-stone-600 text-sm w-full outline-none" />
                </div>
              </div>
            </div>
            
            <div className="hidden md:block w-px h-10 bg-stone-200 mx-2" /><div className="block md:hidden w-[90%] h-px bg-stone-200 my-1" />
            
            {/* Guests & Search Button */}
            <div className="flex-[0.8] flex items-center pl-4 md:pl-6 pr-2 py-2 hover:bg-stone-50 rounded-3xl md:rounded-full cursor-pointer w-full transition justify-between relative">
              <div 
                className="flex items-center flex-1 h-full"
                onClick={() => setShowGuestDropdown(!showGuestDropdown)}
              >
                <Users className="h-5 w-5 text-stone-400 mr-3 shrink-0" />
                <div className="text-left w-full pr-4">
                  <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-0.5">Who</p>
                  <p className={`text-sm ${totalGuests === 0 ? 'text-stone-400' : 'text-stone-600 truncate'}`}>
                    {totalGuests === 0 ? 'Add guests' : `${totalGuests} guest${totalGuests > 1 ? 's' : ''}, ${rooms} room${rooms > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              
              {/* Guest Selector Dropdown */}
              {showGuestDropdown && (
                <div className="absolute top-[110%] right-0 md:right-0 left-0 md:left-auto mt-4 bg-white rounded-2xl shadow-xl border border-stone-100 p-4 w-[calc(100vw-2rem)] md:w-72 z-50">
                  {/* Adults */}
                  <div className="flex items-center justify-between py-3 border-b border-stone-100">
                    <div>
                      <span className="block font-bold text-stone-900">Adults</span>
                      <span className="text-xs text-stone-400">Ages 13 or above</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setAdults(Math.max(1, adults - 1)); }}
                        className={`p-1 rounded-full border ${adults <= 1 ? 'border-stone-100 text-stone-300' : 'border-stone-300 text-stone-600 hover:border-stone-400'}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-4 text-center text-sm font-medium">{adults}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setAdults(adults + 1); }}
                        className="p-1 rounded-full border border-stone-300 text-stone-600 hover:border-stone-400"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Children */}
                  <div className="flex items-center justify-between py-3 border-b border-stone-100">
                    <div>
                      <span className="block font-bold text-stone-900">Children</span>
                      <span className="text-xs text-stone-400">Ages 2-12</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setChildren(Math.max(0, children - 1)); }}
                        className={`p-1 rounded-full border ${children <= 0 ? 'border-stone-100 text-stone-300' : 'border-stone-300 text-stone-600 hover:border-stone-400'}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-4 text-center text-sm font-medium">{children}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setChildren(children + 1); }}
                        className="p-1 rounded-full border border-stone-300 text-stone-600 hover:border-stone-400"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Rooms */}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <span className="block font-bold text-stone-900">Rooms</span>
                      <span className="text-xs text-stone-400">Max 8 rooms</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setRooms(Math.max(1, rooms - 1)); }}
                        className={`p-1 rounded-full border ${rooms <= 1 ? 'border-stone-100 text-stone-300' : 'border-stone-300 text-stone-600 hover:border-stone-400'}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-4 text-center text-sm font-medium">{rooms}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setRooms(Math.min(8, rooms + 1)); }}
                        className={`p-1 rounded-full border ${rooms >= 8 ? 'border-stone-100 text-stone-300' : 'border-stone-300 text-stone-600 hover:border-stone-400'}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleSearch}
                className="bg-stone-900 h-12 w-12 rounded-full flex items-center justify-center text-white hover:bg-stone-800 transition shrink-0"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </motion.div>

        </div>
      </section>

        {/* Featured Destinations */}
        {!appliedSearch.location && !appliedSearch.coords && !appliedSearch.guests && hotels.length > 0 && (
          <section className="bg-stone-50 py-16 border-b border-stone-200">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-serif text-stone-900 mb-2">Featured Destinations</h2>
                  <p className="text-stone-500 text-lg">Top-rated spots across Malawi hand-picked for you.</p>
                </div>
                <button 
                  onClick={() => document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-stone-900 font-medium hover:text-stone-600 transition"
                >
                  View all properties &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {hotels.slice(0, 3).map((hotel, index) => (
                  <Link key={hotel.id} to={`/hotel/${hotel.id}`} className="group block">
                    <div className="bg-white rounded-3xl overflow-hidden border border-stone-200 hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1">
                      <div className="aspect-[4/3] overflow-hidden relative">
                        <SmartImage
                          src={getHotelImage(hotel)}
                          alt={hotel.name}
                          className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                        />
                        {index === 0 && (
                          <div className="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                            Top Choice
                          </div>
                        )}
                        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-stone-900 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          {hotel.reviews && hotel.reviews.length > 0 
                            ? (hotel.reviews.reduce((acc, rev) => acc + rev.rating, 0) / hotel.reviews.length).toFixed(1) 
                            : 'New'}
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-xl font-bold text-stone-900 leading-tight group-hover:text-emerald-600 transition">{hotel.name}</h3>
                        </div>
                        <p className="text-stone-500 text-sm flex items-center gap-1.5 mb-4">
                          <MapPin className="w-4 h-4" />
                          {hotel.location}
                        </p>
                        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                          <span className="text-stone-900 font-bold">Discover</span>
                          <span className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition">
                            &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Categories */}
      <section id="search-results" className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center gap-10 overflow-x-auto py-6 scrollbar-hide text-sm font-medium text-stone-500">
            {['All', 'Lake & Beach', 'Safari & Wildlife', 'Romantic Escape', 'Family', 'Adventure', 'Luxury'].map((category) => (
              <button 
                key={category} 
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap transition pb-2 ${activeCategory === category ? 'text-stone-900 border-b-2 border-stone-900' : 'hover:text-stone-900'}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Property Grid */}
      <section className="max-w-[90rem] mx-auto px-6 lg:px-12 py-32 w-full flex-1">
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-serif text-stone-900 mb-4 tracking-tight">
            {(appliedSearch.location || appliedSearch.coords || appliedSearch.guests) ? 'Search Results' : 'Exceptional Stays'}
          </h2>
          <p className="text-stone-500 text-lg">
            {(appliedSearch.location || appliedSearch.coords || appliedSearch.guests) ? 'Based on your search filters.' : 'Curated properties offering the best of Malawi.'}
          </p>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="animate-pulse bg-stone-200 rounded-2xl aspect-[4/3] w-full" />
                <div className="animate-pulse bg-stone-200 h-5 w-2/3 rounded mt-1" />
                <div className="animate-pulse bg-stone-200 h-4 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : hotels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {filteredHotels.length > 0 ? filteredHotels.map((hotel, index) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                index={index}
                searchParams={{
                  checkIn: appliedSearch.checkIn,
                  checkOut: appliedSearch.checkOut,
                  guests: appliedSearch.guests || undefined,
                }}
              />
            )) : (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">No properties found</h3>
                <p className="text-stone-500 text-lg max-w-md mb-8">
                  We couldn't find any places matching your exact search criteria. Try adjusting your dates, location, or guest count.
                </p>
                <button 
                  onClick={() => {
                    setAppliedSearch({ location: '', checkIn: '', checkOut: '', guests: '', coords: null, proximity: 50 });
                    setSearchLocation('');
                    setSearchCheckIn('');
                    setSearchCheckOut('');
                    setActiveCategory('All');
                  }}
                  className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                <MapPin className="w-8 h-8 text-stone-400" />
             </div>
             <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">No properties available</h3>
             <p className="text-stone-500 text-lg max-w-md">
               There are no properties listed at the moment. Please check back later!
             </p>
          </div>
        )}
      </section>

      {/* List Your Property CTA */}
      <section className="bg-stone-900 text-white py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <SmartImage src={DECORATIVE_IMAGE} alt="" aria-hidden="true" showSkeleton={false} className="w-full h-full object-cover" />
        </div>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl md:text-6xl font-serif mb-8 leading-tight tracking-tight">Own a hotel, lodge, resort, or suite?</h2>
              <p className="text-emerald-100 text-xl mb-8 leading-relaxed max-w-lg">Get more bookings with Travel-Malawi. No setup fees, no monthly fees, and instant WhatsApp confirmations.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/dashboard" className="bg-white text-emerald-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-stone-100 transition shadow-xl text-center">
                  List Your Property
                </Link>
              </div>
            </div>
            <div className="hidden lg:grid grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">Free Listing</h3>
                <p className="text-emerald-100 text-sm">List your property at absolutely no upfront cost.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20 mt-12">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">Instant Bookings</h3>
                <p className="text-emerald-100 text-sm">Guests receive automatic WhatsApp confirmations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
