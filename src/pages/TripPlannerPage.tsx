import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { useWishlist } from '../hooks/useWishlist';
import { Link } from 'react-router-dom';
import { 
  Map, 
  Sparkles, 
  Compass, 
  Plus, 
  ArrowRight, 
  Check, 
  RefreshCw,
  Search,
  Heart
} from 'lucide-react';
import TripPlannerD3 from '../components/TripPlannerD3';
import { MALAWI_KNOWN_PLACES } from '../lib/geo';

// Pre-curated authentic Malawi road trips for instant exploration
const CURATED_SAMPLE_ROUTES = [
  {
    id: 'lake-safari-classic',
    title: 'The Great Lake & Safari Classic',
    duration: '7–9 Days',
    tagline: 'Capital Gateway &rarr; Liwonde Safari &rarr; Lake Malawi Beach Retreat',
    description: 'The definitive southern circuit: wildlife river safaris in Liwonde National Park, historic Zomba plateau views, and crystal waters at Cape Maclear.',
    lodgeNames: ['Kumbali Country Lodge', 'Pumulani Lodge', 'The Makokola Retreat (Club Makokola)', 'Sunbird Ku Chawe']
  },
  {
    id: 'southern-highlands-tea',
    title: 'Highlands & Tea Plantation Explorer',
    duration: '5–6 Days',
    tagline: 'Blantyre &rarr; Mount Mulanje &rarr; Zomba Plateau',
    description: 'Crisp mountain air, rolling green tea estates in Thyolo, and colonial charm on the rim of the Great Rift Valley.',
    lodgeNames: ['Protea Hotel Ryalls', 'Sunbird Ku Chawe', 'The Makokola Retreat (Club Makokola)']
  },
  {
    id: 'northern-island-adventure',
    title: 'Northern Waters & Likoma Island Voyage',
    duration: '8–10 Days',
    tagline: 'Lilongwe &rarr; Nkhata Bay &rarr; Likoma Island',
    description: 'Scenic northern coastline, freshwater diving in turquoise waters, and barefoot luxury on remote Likoma Island.',
    lodgeNames: ['Latitude 13° Hotel', 'Mayoka Village', 'Kaya Mawa']
  }
];

export default function TripPlannerPage() {
  const { user } = useAuth();
  const { savedHotelIds, loading: wishlistLoading } = useWishlist();
  
  const [allHotels, setAllHotels] = useState<Hotel[]>([]);
  const [activeItineraryHotels, setActiveItineraryHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoutePreset, setSelectedRoutePreset] = useState<string>('lake-safari-classic');

  // Load properties from firestore / cache
  useEffect(() => {
    async function loadProperties() {
      try {
        const q = query(collection(db, 'hotels'), limit(50));
        const snap = await getDocs(q);
        const list: Hotel[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        setAllHotels(list);

        // If user has saved properties, default to them
        if (savedHotelIds.length > 0) {
          const savedDocs = list.filter(h => savedHotelIds.includes(h.id));
          if (savedDocs.length > 0) {
            setActiveItineraryHotels(savedDocs);
            setLoading(false);
            return;
          }
        }

        // Otherwise populate with curated preset
        loadPresetRoute('lake-safari-classic', list);
      } catch (err) {
        console.error('Failed to load hotels for planner:', err);
        // Fallback sample hotels
        loadPresetRoute('lake-safari-classic', []);
      } finally {
        setLoading(false);
      }
    }

    if (!wishlistLoading) {
      loadProperties();
    }
  }, [savedHotelIds, wishlistLoading]);

  // Load a preset route by finding matching lodges in catalog or creating lightweight place objects
  const loadPresetRoute = (presetId: string, catalog = allHotels) => {
    setSelectedRoutePreset(presetId);
    const preset = CURATED_SAMPLE_ROUTES.find(r => r.id === presetId) || CURATED_SAMPLE_ROUTES[0];

    const matchedHotels: Hotel[] = [];

    preset.lodgeNames.forEach((name, idx) => {
      // 1. Try finding in loaded catalog
      const foundInCatalog = catalog.find(h => 
        h.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(h.name.toLowerCase())
      );

      if (foundInCatalog) {
        matchedHotels.push(foundInCatalog);
      } else {
        // 2. Fallback to Known Places metadata
        const known = MALAWI_KNOWN_PLACES.find(p => p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()));
        matchedHotels.push({
          id: known ? known.id : `sample-${idx}`,
          name: name,
          location: known ? known.location : 'Malawi',
          description: known?.description || 'Authentic lodge accommodation in Malawi',
          managerId: 'sample',
          amenities: ['Wi-Fi', 'Breakfast', 'Swimming Pool', 'Scenic Views', 'Tour Desk'],
          categories: ['Lodge & Resort'],
          imageUrl: '',
          status: 'approved',
          featured: true,
          createdAt: Date.now()
        });
      }
    });

    setActiveItineraryHotels(matchedHotels);
  };

  if (loading || wishlistLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-8 py-10 mb-20 md:mb-0 space-y-8">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-700" />
              <span>AI Route Copilot</span>
            </span>
            <span className="text-xs text-stone-400">• Direct Host Booking</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 tracking-tight">
            Trip Planner &amp; Itinerary Studio
          </h1>
          <p className="text-stone-500 mt-1.5 text-sm max-w-2xl">
            Design, optimize, and map your custom journey across Malawi. Get AI-powered travel intelligence, driving times, hidden stops, and direct reservations.
          </p>
        </div>

        {/* Wishlist quick switch */}
        {savedHotelIds.length > 0 && (
          <button
            onClick={() => {
              const savedDocs = allHotels.filter(h => savedHotelIds.includes(h.id));
              if (savedDocs.length) setActiveItineraryHotels(savedDocs);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-bold shadow-xs transition shrink-0"
          >
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>Load Saved Properties ({savedHotelIds.length})</span>
          </button>
        )}
      </div>

      {/* Preset Curated Itinerary Selector Pills */}
      <div className="bg-stone-50 p-4 sm:p-5 rounded-3xl border border-stone-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>Explore Curated Malawi Road Trips</span>
          </span>
          <span className="text-xs text-stone-400 hidden sm:inline">
            Click any route to load and customize with AI
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CURATED_SAMPLE_ROUTES.map((route) => {
            const isSelected = selectedRoutePreset === route.id;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => loadPresetRoute(route.id)}
                className={`p-4 rounded-2xl text-left border transition cursor-pointer flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-white border-emerald-600 shadow-xs ring-1 ring-emerald-600/30' 
                    : 'bg-white/70 border-stone-200 hover:bg-white hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-serif font-bold text-sm text-stone-900">{route.title}</h3>
                    <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">
                      {route.duration}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-medium mb-1.5">{route.tagline}</p>
                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{route.description}</p>
                </div>
                
                <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                  <span className="text-stone-400">{route.lodgeNames.length} Stops Included</span>
                  {isSelected ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active Route</span>
                    </span>
                  ) : (
                    <span className="text-stone-600 font-semibold flex items-center gap-1 group-hover:text-stone-900">
                      <span>Load Route &rarr;</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Trip Planner D3 and AI Engine Component */}
      <TripPlannerD3 hotels={activeItineraryHotels} />

    </div>
  );
}
