import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Booking, Broadcast } from '../types';
import { playChime } from '../lib/notificationSound';
import toast from 'react-hot-toast';

export function useUnreadBroadcasts() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  const isInitialLoad = useState<{ current: boolean }>({ current: true })[0];
  const knownBroadcastIds = useState<{ current: Set<string> }>({ current: new Set<string>() })[0];

  useEffect(() => {
    if (!user) {
      setBroadcasts([]);
      isInitialLoad.current = true;
      knownBroadcastIds.current.clear();
      return;
    }

    let unsubBroadcasts = () => {};

    // First fetch user's upcoming bookings
    const qBookings = query(
      collection(db, 'bookings'),
      where('guestId', '==', user.uid),
      where('status', 'in', ['pending', 'confirmed'])
    );

    const unsubBookings = onSnapshot(qBookings, (snap) => {
      const bookings = snap.docs.map(d => d.data() as Booking);
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const upcomingBookings = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        return checkOut >= now;
      });

      const hotelIds = Array.from(new Set(upcomingBookings.map(b => b.hotelId))).filter(Boolean) as string[];

      if (hotelIds.length === 0) {
        setBroadcasts([]);
        unsubBroadcasts();
        return;
      }

      const qBroadcasts = query(
        collection(db, 'broadcasts'),
        where('hotelId', 'in', hotelIds.slice(0, 30)),
        where('isActive', '==', true)
      );

      unsubBroadcasts = onSnapshot(qBroadcasts, (bSnap) => {
        const fetchedBroadcasts = bSnap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast));
        
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
          fetchedBroadcasts.forEach(b => {
            if (b.id) knownBroadcastIds.current.add(b.id);
          });
          setBroadcasts(fetchedBroadcasts);
          return;
        }

        const newBroadcasts = fetchedBroadcasts.filter(fb => fb.id && !knownBroadcastIds.current.has(fb.id));
        if (newBroadcasts.length > 0) {
          playChime();
          newBroadcasts.forEach(b => {
            if (b.id) knownBroadcastIds.current.add(b.id);
            toast.success(`New Update: ${b.message}`, { icon: '📣', duration: 8000 });
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const n = new Notification('New Property Update', { body: b.message, icon: '/favicon.ico' });
              n.onclick = () => { window.focus(); n.close(); };
            }
          });
        }
        setBroadcasts(fetchedBroadcasts);
      }, (err) => {
        console.warn('Failed to listen to broadcasts for badge:', err);
      });
    }, (err) => {
      console.warn('Failed to listen to bookings for badge:', err);
    });

    return () => {
      unsubBookings();
      unsubBroadcasts();
    };
  }, [user]);

  // Recalculate unread count when broadcasts change or when seen event occurs
  useEffect(() => {
    const calculateUnread = () => {
      const seenIds = JSON.parse(localStorage.getItem('seenBroadcasts') || '[]');
      const unread = broadcasts.filter(b => !seenIds.includes(b.id));
      setUnreadCount(unread.length);
    };

    calculateUnread();

    window.addEventListener('broadcasts-seen', calculateUnread);
    return () => window.removeEventListener('broadcasts-seen', calculateUnread);
  }, [broadcasts]);

  return unreadCount;
}
