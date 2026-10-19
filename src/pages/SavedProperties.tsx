import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import HotelCard from '../components/HotelCard';
import { useWishlist } from '../hooks/useWishlist';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Heart, Compass, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import TripPlannerD3 from '../components/TripPlannerD3';

export default function SavedProperties() {
  const { user, loading: authLoading } = useAuth();
  const { openAuth } = useAuthDialog();
  const { savedHotelIds, loading: wishlistLoading } = useWishlist();
  const [savedHotels, setSavedHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const viewMode: 'grid' | 'planner' = searchParams.get('tab') === 'planner' ? 'planner' : 'grid';

  const handleTabChange = (mode: 'grid' | 'planner') => {
    if (mode === 'planner') {
      setSearchParams({ tab: 'planner' }, { replace: true });
    } else {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
  };

  const uid = user?.uid ?? null;
  // Cache is per account so a shared device never shows one user's saved
  // stays to another.
  const cacheKey = uid ? `savedHotelsCache_${uid}` : null;

  useEffect(() => {
    try {
      // Drop the old account-agnostic cache.
      localStorage.removeItem('savedHotelsCache');
    } catch (e) {}
    if (!uid) setSavedHotels([]);
  }, [uid]);

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      if (!cacheKey || savedHotelIds.length === 0) {
        setSavedHotels([]);
        setLoadError(false);
        setLoading(false);
        return;
      }

      // Un-saving a stay only removes it from the list; nothing needs fetching.
      const loadedIds = new Set(savedHotels.map(h => h.id));
      if (reloadKey === 0 && savedHotelIds.every(id => loadedIds.has(id))) {
        setSavedHotels(prev => prev.filter(h => savedHotelIds.includes(h.id)));
        setLoading(false);
        return;
      }

      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed: Hotel[] = JSON.parse(cached);
          if (!cancelled && Array.isArray(parsed)) {
            setSavedHotels(parsed.filter(h => savedHotelIds.includes(h.id)));
            setLoading(false);
          }
        }
      } catch (e) {
        console.warn('Failed to read saved hotels cache', e);
      }

      // One removed or no-longer-readable listing must not hide the rest.
      const results = await Promise.allSettled(savedHotelIds.map(id => getDoc(doc(db, 'hotels', id))));
      if (cancelled) return;
      const hotels: Hotel[] = [];
      let failed = 0;
      for (const result of results) {
        if (result.status === 'rejected') {
          failed++;
        } else if (result.value.exists()) {
          const hotel = { id: result.value.id, ...result.value.data() } as Hotel;
          if (!hotel.status || hotel.status === 'approved') hotels.push(hotel);
        }
      }
      if (failed < results.length || results.length === 0) {
        setSavedHotels(hotels);
        setLoadError(false);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(hotels));
        } catch (e) {
          console.warn('Failed to cache saved hotels', e);
        }
      } else {
        console.error('Failed to load saved hotels');
        setLoadError(true);
      }
      setLoading(false);
    }

    if (!wishlistLoading) {
      loadSaved();
    }
    return () => {
      cancelled = true;
    };
    // savedHotels is read only to skip refetching; it must not retrigger the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedHotelIds, wishlistLoading, cacheKey, reloadKey]);

  if (authLoading || wishlistLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-amber-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <Heart className="w-16 h-16 text-stone-200 mb-6" />
        <h1 className="tm-h1 mb-3">Saved stays</h1>
        <p className="tm-muted max-w-md mb-6">Sign in to see your saved stays and plan a route.</p>
        <button
          type="button"
          onClick={() => openAuth('signin')}
          className="tm-btn tm-btn-primary"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 md:py-10 mb-20 md:mb-0">
      <div className="mb-5 sm:mb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="tm-h1">Saved stays</h1>
          <p className="tm-muted mt-1">Your saved places and the route between them.</p>
        </div>
        <div className="tm-tabs w-full sm:w-fit" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'grid'}
            onClick={() => handleTabChange('grid')}
            className={`tm-tab flex items-center gap-1.5 ${viewMode === 'grid' ? 'tm-tab-active' : ''}`}
          >
            <Heart className="w-3.5 h-3.5 shrink-0" />
            <span>Saved</span>
            <span className="tm-tag">{savedHotels.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'planner'}
            onClick={() => handleTabChange('planner')}
            className={`tm-tab flex items-center gap-1.5 ${viewMode === 'planner' ? 'tm-tab-active' : ''}`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>Trip planner</span>
          </button>
        </div>
      </div>

      {loadError && savedHotels.length === 0 ? (
        <div className="py-12 sm:py-16 text-center border border-dashed border-amber-200 rounded-xl bg-amber-50/50 px-4">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h2 className="tm-h2 mb-1">We could not load your saved stays</h2>
          <p className="text-stone-500 text-xs sm:text-sm mb-6 max-w-sm mx-auto">
            Check your connection and try again. Your saved stays are safe.
          </p>
          <button
            type="button"
            onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}
            className="tm-btn tm-btn-primary"
          >
            Try again
          </button>
        </div>
      ) : savedHotels.length === 0 ? (
        viewMode === 'planner' ? (
          <div className="py-12 sm:py-16 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50 px-4">
            <Compass className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h2 className="tm-h2 mb-1.5">Plan a route from your saved stays</h2>
            <p className="tm-muted mb-6 max-w-md mx-auto">
              Save a few stays and they will appear here with driving distances between them.
            </p>
            <Link
              to="/"
              className="tm-btn tm-btn-primary"
            >
              <Search className="w-4 h-4" />
              Find stays
            </Link>
          </div>
        ) : (
          <div className="py-12 sm:py-16 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50 px-4">
            <Heart className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h2 className="tm-h2 mb-1">No saved stays yet</h2>
            <p className="tm-muted mb-6 max-w-sm mx-auto">
              Tap the heart on any stay to save it here.
            </p>
            <Link
              to="/"
              className="tm-btn tm-btn-primary"
            >
              <Search className="w-4 h-4" />
              Find stays
            </Link>
          </div>
        )
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
