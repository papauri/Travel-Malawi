import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, MapPin, Calendar, Users, Star } from 'lucide-react';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user, signIn, isSigningIn } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  const [searchLocation, setSearchLocation] = useState('');
  const [searchCheckIn, setSearchCheckIn] = useState('');
  const [searchCheckOut, setSearchCheckOut] = useState('');
  const [searchGuests, setSearchGuests] = useState<number | ''>('');
  const [appliedSearch, setAppliedSearch] = useState({ location: '', checkIn: '', checkOut: '', guests: '' as number | '' });

  const fetchHotels = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'hotels'));
      const hotelsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];
      setHotels(hotelsData);
    } catch (error) {
      console.error("Error fetching hotels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const seedData = async () => {
    setSeeding(true);
    const managerId = user?.uid || 'demo_manager_123';
    const testHotels = [
      {
        name: "Pumulani Lodge",
        location: "Lake Malawi National Park",
        description: "Situated on the lush hills of the Nankumba Peninsula, Pumulani offers luxurious villas with stunning views over Lake Malawi. The ultimate in elegant, sustainable luxury.",
        imageUrl: "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?q=80&w=2874&auto=format&fit=crop",
        categories: ["Lake & Beach", "Luxury", "Romantic Escape"],
        galleryUrls: [
          "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=2940&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2946&auto=format&fit=crop"
        ],
        reviews: [
          { author: "Sarah M.", rating: 5, text: "Paradise on Lake Malawi! Spectacular location and views. The villas are incredibly spacious and the staff goes above and beyond.", source: "TripAdvisor", date: "Oct 2023" },
          { author: "David K.", rating: 5, text: "Most relaxing place we've ever been. The sunset cruise on the traditional dhow was unforgettable.", source: "TripAdvisor", date: "Sep 2023" }
        ]
      },
      {
        name: "Kaya Mawa",
        location: "Likoma Island, Lake Malawi",
        description: "An award-winning luxury eco-lodge offering exclusive accommodation on a beautiful crescent beach on Likoma Island. Voted one of the most romantic places on earth.",
        imageUrl: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2940&auto=format&fit=crop",
        categories: ["Lake & Beach", "Luxury", "Romantic Escape"],
        galleryUrls: [
          "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?q=80&w=2940&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=2940&auto=format&fit=crop"
        ],
        reviews: [
          { author: "Jessica T.", rating: 5, text: "A slice of heaven. The rooms are stunning and right on the beach. You can literally walk out of your room into the crystal clear water.", source: "TripAdvisor", date: "Aug 2023" },
          { author: "Mark R.", rating: 5, text: "The perfect honeymoon destination. Private, romantic, and the food is Michelin-star quality.", source: "TripAdvisor", date: "Jul 2023" }
        ]
      },
      {
        name: "Sunbird Ku Chawe",
        location: "Zomba Plateau",
        description: "Perched on the edge of the Zomba Plateau, this premier mountain resort offers breathtaking panoramic views of southern Malawi and serene forest walks.",
        imageUrl: "https://images.unsplash.com/photo-1542314831-c6a4d1409e1c?q=80&w=2865&auto=format&fit=crop",
        categories: ["Adventure", "Family"],
        galleryUrls: [
          "https://images.unsplash.com/photo-1506905925208-8f8597f74bb0?q=80&w=2940&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2940&auto=format&fit=crop"
        ],
        reviews: [
          { author: "Emily B.", rating: 4, text: "The view from the restaurant terrace is unmatched. A great base for hiking the plateau.", source: "TripAdvisor", date: "Nov 2023" },
          { author: "James W.", rating: 4, text: "Beautiful location in the clouds. Very peaceful, especially sitting by the log fire in the evenings.", source: "TripAdvisor", date: "Aug 2023" }
        ]
      },
      {
        name: "Blue Zebra Island Lodge",
        location: "Nankoma Island",
        description: "A wild paradise on a private island, part of the UNESCO World Heritage Site, offering safari tents and chalets hidden in the pristine wilderness.",
        imageUrl: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=2940&auto=format&fit=crop",
        categories: ["Safari & Wildlife", "Lake & Beach", "Adventure"],
        galleryUrls: [
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=2940&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1544365558-35aa4afcf11f?q=80&w=2936&auto=format&fit=crop"
        ],
        reviews: [
          { author: "Oliver C.", rating: 5, text: "Incredible snorkeling right off the island. We saw so many colorful cichlid fish. A true eco-lodge.", source: "TripAdvisor", date: "Dec 2023" },
          { author: "Anna S.", rating: 5, text: "Felt like we were on our own private island. The birdlife is spectacular.", source: "TripAdvisor", date: "Oct 2023" }
        ]
      },
      {
        name: "Mvuu Camp & Lodge",
        location: "Liwonde National Park",
        description: "Nestled along the banks of the Shire River, this lodge offers unparalleled wildlife viewing and incredible river safaris with elephants and hippos.",
        imageUrl: "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2936&auto=format&fit=crop",
        categories: ["Safari & Wildlife", "Family", "Adventure"],
        galleryUrls: [
          "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2936&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1614531341773-3bff8b7cb3fc?q=80&w=2932&auto=format&fit=crop"
        ],
        reviews: [
          { author: "Robert T.", rating: 5, text: "The boat safari on the Shire river is an absolute must! Saw hundreds of hippos and elephants bathing.", source: "TripAdvisor", date: "Jan 2024" },
          { author: "Linda P.", rating: 5, text: "Authentic wilderness experience. Waking up to the sound of hippos outside our tent was incredible.", source: "TripAdvisor", date: "Nov 2023" }
        ]
      }
    ];

    try {
      const existingHotels = await getDocs(collection(db, 'hotels'));
      for (const h of existingHotels.docs) {
        await deleteDoc(doc(db, 'hotels', h.id));
      }
      const existingRooms = await getDocs(collection(db, 'room_types'));
      for (const r of existingRooms.docs) {
        await deleteDoc(doc(db, 'room_types', r.id));
      }

      for (const h of testHotels) {
        const hotelDocRef = await addDoc(collection(db, 'hotels'), {
          managerId: managerId,
          name: h.name,
          description: h.description,
          location: h.location,
          imageUrl: h.imageUrl,
          galleryUrls: h.galleryUrls,
          reviews: h.reviews,
          amenities: ["WiFi", "Pool", "Restaurant", "Lake Access"],
          categories: h.categories,
          createdAt: Date.now()
        });

        await addDoc(collection(db, 'room_types'), {
          hotelId: hotelDocRef.id,
          name: "Standard Suite",
          description: "Comfortable suite with beautiful surrounding views.",
          price: 250,
          maxGuests: 2,
          quantity: 10,
          amenities: ["Air Conditioning", "En-suite Bathroom"],
          imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=2940&auto=format&fit=crop"
        });

        await addDoc(collection(db, 'room_types'), {
          hotelId: hotelDocRef.id,
          name: "Luxury Villa",
          description: "Spacious private villa with premium amenities and uninterrupted views.",
          price: 550,
          maxGuests: 4,
          quantity: 3,
          amenities: ["Private Deck", "Minibar"],
          imageUrl: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=2940&auto=format&fit=crop"
        });
      }
      await fetchHotels();
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      setSeeding(false);
    }
  };

  const handleSearch = () => {
    setAppliedSearch({ location: searchLocation, checkIn: searchCheckIn, checkOut: searchCheckOut, guests: searchGuests });
  };

  const filteredHotels = (activeCategory === 'All' 
    ? hotels 
    : hotels.filter(h => h.categories?.includes(activeCategory)))
    .filter(h => {
      if (appliedSearch.location) {
        const query = appliedSearch.location.toLowerCase();
        if (!h.name.toLowerCase().includes(query) && !h.location.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });

  const getBentoClasses = (index: number) => {
    const modulo = index % 5;
    switch (modulo) {
      case 0: return 'md:col-span-2 md:row-span-2';
      case 1: return 'md:col-span-1 md:row-span-1';
      case 2: return 'md:col-span-1 md:row-span-1';
      case 3: return 'md:col-span-2 md:row-span-1';
      case 4: return 'md:col-span-2 md:row-span-1';
      default: return 'md:col-span-1 md:row-span-1';
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[80vh] w-full flex flex-col items-center justify-center overflow-hidden rounded-b-[2.5rem] shadow-2xl bg-stone-900">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/60 via-stone-900/40 to-stone-900/70 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=2940&auto=format&fit=crop"
          alt="Luxury Resort"
          className="absolute inset-0 w-full h-full object-cover object-center z-0 animate-pulse-slow"
          referrerPolicy="no-referrer"
        />
        
        <div className="relative z-20 w-full max-w-7xl px-6 lg:px-8 flex flex-col items-center text-center mt-12">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl lg:text-8xl font-serif text-white max-w-4xl leading-[1.1] mb-12 drop-shadow-xl"
          >
            Find the perfect place to stay.
          </motion.h1>

          {/* Search Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-4 shadow-2xl flex flex-col md:flex-row items-center gap-3 w-full max-w-4xl border border-white/40 ring-1 ring-black/5"
          >
            <div className="flex-1 flex items-center px-4 py-3 hover:bg-stone-50 rounded-xl cursor-pointer w-full transition">
              <MapPin className="h-5 w-5 text-stone-400 mr-4 shrink-0" />
              <div className="text-left w-full">
                <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-0.5">Where</p>
                <input 
                  type="text" 
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder="Search destinations" 
                  className="bg-transparent border-none p-0 focus:ring-0 text-stone-600 text-sm w-full outline-none"
                />
              </div>
            </div>
            <div className="hidden md:block w-px h-10 bg-stone-200" />
            <div className="flex-1 flex items-center px-4 py-3 hover:bg-stone-50 rounded-xl cursor-pointer w-full transition">
              <Calendar className="h-5 w-5 text-stone-400 mr-4 shrink-0" />
              <div className="text-left w-full flex gap-2">
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
            <div className="hidden md:block w-px h-10 bg-stone-200" />
            <div className="flex-1 flex items-center px-4 py-3 hover:bg-stone-50 rounded-xl cursor-pointer w-full transition">
              <Users className="h-5 w-5 text-stone-400 mr-4 shrink-0" />
              <div className="text-left w-full">
                <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-0.5">Who</p>
                <input 
                  type="number" 
                  min="1"
                  value={searchGuests}
                  onChange={(e) => setSearchGuests(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Guests" 
                  className="bg-transparent border-none p-0 focus:ring-0 text-stone-600 text-sm w-full outline-none"
                />
              </div>
            </div>
            <button 
              onClick={handleSearch}
              className="bg-stone-900 px-8 py-5 rounded-xl text-white hover:bg-stone-800 transition w-full md:w-auto font-medium"
            >
              Search
            </button>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b border-stone-200 bg-white">
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

      {/* Featured Properties */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20 w-full flex-1">
        <div className="mb-12">
          <h2 className="text-3xl font-serif text-stone-900 mb-3">Exceptional Stays</h2>
          <p className="text-stone-500 text-lg">Curated properties offering the best of Malawi.</p>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[300px] gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`animate-pulse bg-stone-100 rounded-3xl ${getBentoClasses(i)}`} />
            ))}
          </div>
        ) : hotels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[300px] gap-6">
            {filteredHotels.length > 0 ? filteredHotels.map((hotel, index) => (
              <Link 
                to={`/hotel/${hotel.id}?checkIn=${appliedSearch.checkIn || ''}&checkOut=${appliedSearch.checkOut || ''}&guests=${appliedSearch.guests || ''}`} 
                key={hotel.id} 
                className={`group ${getBentoClasses(index)}`}
              >
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="relative w-full h-full overflow-hidden rounded-3xl bg-stone-100 block"
                >
                  {hotel.imageUrl ? (
                    <img 
                      src={hotel.imageUrl} 
                      alt={hotel.name} 
                      className="absolute inset-0 object-cover w-full h-full group-hover:scale-105 transition duration-700 ease-out"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center text-stone-400">
                      No Image
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 w-full p-6 lg:p-8 flex flex-col justify-end text-white">
                    <div className="flex justify-between items-end gap-4">
                      <div>
                        <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2 leading-tight drop-shadow-sm">{hotel.name}</h3>
                        <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                          <MapPin className="h-4 w-4" />
                          <p>{hotel.location}</p>
                        </div>
                      </div>
                      <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                        <Star className="h-3.5 w-3.5 fill-current text-white" />
                        <span className="font-semibold text-white text-sm tracking-wide">4.9</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            )) : (
              <div className="col-span-full py-12 text-center text-stone-500 text-lg">
                No properties found in this category.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-stone-200/60 shadow-sm max-w-3xl mx-auto">
            <h3 className="text-2xl font-serif text-stone-900 mb-4">No properties available yet</h3>
            <p className="text-stone-500 text-lg mb-8 max-w-lg mx-auto">The database is currently empty. Populate the marketplace to see how the properties are displayed in the new bento design.</p>
            <button 
              disabled={seeding}
              onClick={seedData}
              className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition disabled:opacity-50"
            >
              {seeding ? 'Loading Properties...' : 'Load Demo Properties'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
