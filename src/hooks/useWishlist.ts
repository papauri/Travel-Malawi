import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import toast from 'react-hot-toast';

export function useWishlist() {
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();
  const [savedHotelIds, setSavedHotelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSavedHotelIds([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setSavedHotelIds(docSnap.data()?.savedHotelIds || []);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const toggleSave = async (hotelId: string) => {
    if (!user) {
      openAuth('signin');
      return;
    }

    const isSaved = savedHotelIds.includes(hotelId);
    const userRef = doc(db, 'users', user.uid);
    
    // Optimistic update
    setSavedHotelIds(prev => 
      isSaved ? prev.filter(id => id !== hotelId) : [...prev, hotelId]
    );

    try {
      await setDoc(userRef, {
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
  };

  return { savedHotelIds, toggleSave, loading };
}
