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

  useEffect(() => {
    if (!user) {
      setBroadcasts([]);
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
        
        setBroadcasts(prev => {
          if (prev.length > 0) {
            const newBroadcasts = fetchedBroadcasts.filter(fb => !prev.find(p => p.id === fb.id));
            newBroadcasts.forEach(b => {
              toast.success(`New Update: ${b.message}`, { icon: '📣', duration: 8000 });
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New Property Update', { body: b.message });
              }
            });
          }
          return fetchedBroadcasts;
        });
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
