import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import HotelCard from '../components/HotelCard';
import { useWishlist } from '../hooks/useWishlist';
import { Link } from 'react-router-dom';
import { Search, Heart } from 'lucide-react';
import { motion } from 'motion/react';

export default function SavedProperties() {
  const { user, loading: authLoading } = useAuth();
  const { savedHotelIds, loading: wishlistLoading } = useWishlist();
  const [savedHotels, setSavedHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="mx-auto max-w-7xl px-4 lg:px-8 py-10 mb-20 md:mb-0">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-serif font-medium text-stone-900 tracking-tight">Saved Properties</h1>
        <p className="text-stone-500 mt-2">Properties you have liked and saved for later.</p>
      </div>

      {savedHotels.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-stone-200 rounded-3xl bg-stone-50/50">
          <Heart className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-stone-900 mb-2">No saved properties yet</h2>
          <p className="text-stone-500 mb-8 max-w-sm mx-auto">
            When you see a property you like, tap the heart icon to save it here.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-stone-800"
          >
            <Search className="w-4 h-4" />
            Explore properties
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {savedHotels.map((hotel, index) => (
            <motion.div key={hotel.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <HotelCard hotel={hotel} index={index} searchParams={{}} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
