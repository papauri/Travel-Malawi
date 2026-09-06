import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isHotelManager } from '../lib/roles';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface Presence {
  status: PresenceStatus;
  lastActive: number;
}

export function useManagerPresence(managerId?: string) {
  const [presenceData, setPresenceData] = useState<Presence | null>(null);
  const [computedStatus, setComputedStatus] = useState<PresenceStatus>('offline');

  // Listen to Firestore
  useEffect(() => {
    if (!managerId) return;
    const unsub = onSnapshot(doc(db, "presence", managerId), (doc) => {
      if (doc.exists()) {
        setPresenceData(doc.data() as Presence);
      } else {
        setPresenceData({ status: "offline", lastActive: 0 });
      }
    });
    return unsub;
  }, [managerId]);

  // Compute live status every 10 seconds
  useEffect(() => {
    if (!presenceData) {
      setComputedStatus('offline');
      return;
    }

    const compute = () => {
      const age = Date.now() - presenceData.lastActive;
      if (age > 15 * 60 * 1000) { // 15 mins = offline
        setComputedStatus('offline');
      } else if (age > 5 * 60 * 1000 && presenceData.status === 'online') { // 5 mins = away
        setComputedStatus('away');
      } else {
        setComputedStatus(presenceData.status);
      }
    };

    compute();
    const interval = setInterval(compute, 10000);
    return () => clearInterval(interval);
  }, [presenceData]);

  return presenceData ? { ...presenceData, status: computedStatus } : null;
}

export function usePresence() {
  const { user } = useAuth();
  const [presence, setPresence] = useState<Presence | null>(null);

  useEffect(() => {
    if (!user) {
      setPresence(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'presence', user.uid), (doc) => {
      if (doc.exists()) {
        setPresence(doc.data() as Presence);
      } else {
        setPresence({ status: 'offline', lastActive: Date.now() });
      }
    });
    return unsub;
  }, [user]);

  // Activity tracking for managers
  useEffect(() => {
    if (!user || !isHotelManager(user)) return;

    let isActive = true;
    let manualOverride = false; // To respect manual status

    const updateActivity = async (status: PresenceStatus) => {
      try {
        await setDoc(doc(db, 'presence', user.uid), {
          status,
          lastActive: Date.now()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update presence', err);
      }
    };

    const handleActivity = () => {
      isActive = true;
    };

    // Heartbeat every 2 minutes
    const heartbeat = setInterval(() => {
      if (!manualOverride) {
        if (!document.hidden && isActive) {
          updateActivity('online');
        } else {
          updateActivity('away');
        }
      } else {
        // Even if manual override is on, bump lastActive so we don't go offline
        updateActivity(presence?.status || 'online');
      }
      isActive = false; // Reset activity flag
    }, 2 * 60 * 1000); 

    // Initial setup
    updateActivity('online');

    // Track real activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    // Visibility
    const handleVisibilityChange = () => {
      if (!manualOverride) {
        updateActivity(document.hidden ? 'away' : 'online');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]); // We intentionally do not depend on `presence` to avoid re-binding listeners every time it changes, but we have `manualOverride` limitation. We can export `setManualStatus` separately.

  const setManualStatus = async (status: PresenceStatus) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'presence', user.uid), {
        status,
        lastActive: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to set manual status', err);
    }
  };

  return { presence, setManualStatus };
}
