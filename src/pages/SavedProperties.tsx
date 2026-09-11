import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import HotelCard from '../components/HotelCard';
import { useWishlist } from '../hooks/useWishlist';
import { Link } from 'react-router-dom';
import { Search, Heart, Map } from 'lucide-react';
import { motion } from 'motion/react';
import TripPlannerD3 from '../components/TripPlannerD3';

export default function SavedProperties() {
  const { user, loading: authLoading } = useAuth();
  const { savedHotelIds, loading: wishlistLoading } = useWishlist();
  const [savedHotels, setSavedHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'planner'>('grid');

  useEffect(() => {
    async function loadSaved() {
      if (savedHotelIds.length === 0) {
        setSavedHotels([]);
        setLoading(false);
        return;
      }
      
      try {
        const cached = localStorage.getItem('savedHotelsCache');
        if (cached) {
          const parsed = JSON.parse(cached);
          // Only use cache if the saved IDs somewhat match to avoid stale data
          setSavedHotels(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.warn('Failed to read saved hotels cache', e);
      }
      
      try {
        const hotelPromises = savedHotelIds.map(id => getDoc(doc(db, 'hotels', id)));
        const docs = await Promise.all(hotelPromises);
        const hotels = docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() } as Hotel));
        setSavedHotels(hotels);
        try {
          localStorage.setItem('savedHotelsCache', JSON.stringify(hotels));
        } catch (e) {
          console.warn('Failed to cache saved hotels', e);
        }
      } catch (err) {
        console.error("Failed to load saved hotels:", err);
      } finally {
        setLoading(false);
      }
    }

    if (!wishlistLoading) {
      loadSaved();
    }
  }, [savedHotelIds, wishlistLoading]);

  if (authLoading || wishlistLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <Heart className="w-16 h-16 text-stone-200 mb-6" />
        <h1 className="text-3xl font-serif text-stone-900 mb-4 tracking-tight">Saved Properties</h1>
        <p className="text-stone-500 max-w-md mb-8">Sign in to view your saved properties.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 md:py-10 mb-20 md:mb-0">
      <div className="mb-5 sm:mb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900 tracking-tight">Saved Properties</h1>
          <p className="text-stone-500 mt-0.5 sm:mt-1 text-xs sm:text-sm">Your bookmarked lodges, cottages, and safari stays across Malawi.</p>
        </div>
        {savedHotels.length > 0 && (
          <div className="grid grid-cols-2 sm:flex items-center gap-1 bg-stone-100 p-1 rounded-2xl w-full sm:w-fit border border-stone-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${viewMode === 'grid' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
            >
              <span>Saved Grid</span>
              <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded-full font-bold">({savedHotels.length})</span>
            </button>
            <button
              onClick={() => setViewMode('planner')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${viewMode === 'planner' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
            >
              <Map className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Trip Planner</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">Route</span>
            </button>
          </div>
        )}
      </div>

      {savedHotels.length === 0 ? (
        <div className="py-12 sm:py-16 text-center border border-dashed border-stone-200 rounded-2xl sm:rounded-3xl bg-stone-50/50 px-4">
          <Heart className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <h2 className="text-base sm:text-lg font-bold text-stone-900 mb-1">No saved properties yet</h2>
          <p className="text-stone-500 text-xs sm:text-sm mb-6 max-w-sm mx-auto">
            When you see a property you like, tap the heart icon to save it here.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-full bg-stone-900 px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-stone-800 shadow-2xs"
          >
            <Search className="w-4 h-4" />
            Explore properties
          </Link>
        </div>
      ) : (
        <>
          {viewMode === 'planner' ? (
            <TripPlannerD3 hotels={savedHotels} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5 lg:gap-6">
              {savedHotels.map((hotel, index) => (
                <motion.div key={`${hotel.id || 'saved'}-${index}`} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <HotelCard hotel={hotel} index={index} searchParams={{}} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
