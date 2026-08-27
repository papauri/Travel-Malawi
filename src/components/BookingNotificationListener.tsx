import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Booking } from '../types';
import toast from 'react-hot-toast';

export default function BookingNotificationListener() {
  const { user } = useAuth();
  
  // Track known booking statuses to detect changes.
  // We use a ref so we don't trigger re-renders.
  const knownStatuses = useRef<Record<string, Booking['status']>>({});
  // Track if this is the initial load, so we don't toast existing statuses when you refresh the page.
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!user) {
      knownStatuses.current = {};
      isInitialLoad.current = true;
      return;
    }

    const q = query(
      collection(db, 'bookings'),
      where('guestId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data() as Booking;
        const currentStatus = data.status;
        const previousStatus = knownStatuses.current[change.doc.id];
        
        // Update the known status
        knownStatuses.current[change.doc.id] = currentStatus;

        // Skip toasting on the first load for existing documents
        if (isInitialLoad.current && change.type === 'added') {
          return;
        }

        // Check if the status actually changed
        if (change.type === 'modified' && previousStatus && previousStatus !== currentStatus) {
          if (currentStatus === 'confirmed' && previousStatus === 'pending') {
            toast.success(`Your booking has been confirmed!`, {
              duration: 5000,
            });
          } else if (currentStatus === 'cancelled') {
            const byWho = data.cancelledBy === 'manager' ? 'the property' : 'you';
            toast(`Your booking was cancelled by ${byWho}.`, {
              icon: 'ℹ️',
              duration: 5000,
            });
          }
        }
      });
      
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    });

    return () => unsubscribe();
  }, [user]);

  return null; // This component doesn't render anything
}
