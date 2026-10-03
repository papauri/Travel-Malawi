import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
    try {
      const cached = localStorage.getItem(`wishlist_${uid}`);
      if (cached) {
        setSavedHotelIds(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {}

    const unsub = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        const ids = docSnap.data()?.savedHotelIds || [];
        setSavedHotelIds(ids);
        try {
          localStorage.setItem(`wishlist_${uid}`, JSON.stringify(ids));
        } catch (e) {}
      }
      setLoading(false);
    }, (error) => {
      console.warn('Wishlist fetch error:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  const toggleSave = useCallback(async (hotelId: string) => {
    if (!uid) {
      openAuth('signin');
      return;
    }

    const isSaved = savedHotelIds.includes(hotelId);

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
  }, [uid, savedHotelIds, openAuth]);

  const value = useMemo(() => ({ savedHotelIds, toggleSave, loading }), [savedHotelIds, toggleSave, loading]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlistContext(): WishlistContextType {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
