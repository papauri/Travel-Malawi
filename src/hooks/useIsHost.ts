import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isHotelManager } from '../lib/roles';

// One lookup per account per page load, shared by every caller.
const hostLookups = new Map<string, Promise<boolean>>();

function managesAnyHotel(uid: string): Promise<boolean> {
  let lookup = hostLookups.get(uid);
  if (!lookup) {
    lookup = getDocs(query(collection(db, 'hotels'), where('managerId', '==', uid), limit(1)))
      .then(snap => !snap.empty)
      .catch(() => {
        hostLookups.delete(uid);
        return false;
      });
    hostLookups.set(uid, lookup);
  }
  return lookup;
}

/**
 * True when the signed-in user hosts guests: the hotel_manager role, or any
 * listing whose managerId is theirs. Admins who run their own property and
 * new hosts whose role hasn't been granted yet are hosts too, so their
 * presence, chat inbox and notifications must work like any manager's.
 */
export function useIsHost(): boolean {
  const { user } = useAuth();
  const byRole = isHotelManager(user);
  const [byListing, setByListing] = useState(false);

  useEffect(() => {
    setByListing(false);
    if (!user || byRole) return;
    let cancelled = false;
    managesAnyHotel(user.uid).then(found => {
      if (!cancelled) setByListing(found);
    });
    return () => { cancelled = true; };
  }, [user?.uid, byRole]);

  return byRole || byListing;
}
