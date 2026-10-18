import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogContext';
import toast from 'react-hot-toast';

interface WishlistContextType {
  savedHotelIds: string[];
  toggleSave: (hotelId: string) => Promise<void>;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

/**
 * Holds the signed-in user's saved properties. One Firestore listener serves
 * every card on the page instead of each card opening its own.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();
  const [savedHotelIds, setSavedHotelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) {
      setSavedHotelIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Start from this user's cache or nothing. Keeping the previous account's
    // list on screen while the new one loads showed one user another's saves.
    let cachedIds: string[] = [];
    try {
      const cached = localStorage.getItem(`wishlist_${uid}`);
      const parsed = cached ? JSON.parse(cached) : [];
      if (Array.isArray(parsed)) cachedIds = parsed.filter((id): id is string => typeof id === 'string');
    } catch (e) {}
    setSavedHotelIds(cachedIds);
    if (cachedIds.length > 0) setLoading(false);

    const unsub = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      // Offline with nothing in Firestore's cache looks like "no document";
      // that must not wipe the list we restored from localStorage.
      const fromCache = docSnap.metadata.fromCache;
      if (!docSnap.exists() && fromCache) {
        setLoading(false);
        return;
      }
      const raw = docSnap.exists() ? docSnap.data()?.savedHotelIds : [];
      const ids: string[] = Array.isArray(raw) ? raw : [];
      setSavedHotelIds(ids);
      try {
        localStorage.setItem(`wishlist_${uid}`, JSON.stringify(ids));
      } catch (e) {}
      setLoading(false);
    }, (error) => {
      console.warn('Wishlist fetch error:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  // Read through a ref so two quick taps on one heart see the first tap's result.
  const savedRef = useRef<string[]>([]);
  savedRef.current = savedHotelIds;

  const toggleSave = useCallback(async (hotelId: string) => {
    if (!uid) {
      openAuth('signin');
      return;
    }

    const isSaved = savedRef.current.includes(hotelId);
    savedRef.current = isSaved
      ? savedRef.current.filter(id => id !== hotelId)
      : [...savedRef.current, hotelId];

    // Optimistic update
    setSavedHotelIds(prev =>
      isSaved ? prev.filter(id => id !== hotelId) : [...prev, hotelId]
    );

    try {
      await setDoc(doc(db, 'users', uid), {
        savedHotelIds: isSaved ? arrayRemove(hotelId) : arrayUnion(hotelId)
      }, { merge: true });
      toast.success(isSaved ? 'Removed from saved' : 'Saved to wishlist', {
        position: 'bottom-center'
      });
    } catch (err) {
      console.error('Failed to toggle save', err);
      // Revert optimistic update on failure
      setSavedHotelIds(prev =>
        isSaved ? [...prev, hotelId] : prev.filter(id => id !== hotelId)
      );
      toast.error('Could not update saved properties');
    }
  }, [uid, openAuth]);

  const value = useMemo(() => ({ savedHotelIds, toggleSave, loading }), [savedHotelIds, toggleSave, loading]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlistContext(): WishlistContextType {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
