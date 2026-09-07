import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isHotelManager } from '../lib/roles';
import { playDingSound } from '../lib/notificationSound';
import { Booking } from '../types';

export interface UnreadMessageItem {
  id: string;
  type: 'inquiry' | 'booking';
  hotelId: string;
  hotelName: string;
  guestId?: string;
  guestName?: string;
  senderName: string;
  senderRoleTag: 'Guest Inquiry' | 'Host Reply' | 'Booking Chat';
  lastMessage: string;
  timestamp: number;
  booking?: Booking;
  isManagerView: boolean;
}

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadItems, setUnreadItems] = useState<UnreadMessageItem[]>([]);
  const [isVibrating, setIsVibrating] = useState<boolean>(false);

  const isInitialLoad = useRef(true);
  const knownMessageTimestamps = useRef<Map<string, number>>(new Map());
  const vibrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerVibration = useCallback(() => {
    setIsVibrating(true);
    if (vibrationTimeoutRef.current) {
      clearTimeout(vibrationTimeoutRef.current);
    }
    vibrationTimeoutRef.current = setTimeout(() => {
      setIsVibrating(false);
    }, 2800);
  }, []);

  const triggerDing = useCallback(() => {
    playDingSound(0.28);
    triggerVibration();
  }, [triggerVibration]);

  useEffect(() => {
    if (!user) {
      setUnreadItems([]);
      setIsVibrating(false);
      isInitialLoad.current = true;
      knownMessageTimestamps.current.clear();
      return;
    }

    const isManager = isHotelManager(user);
    const unsubs: (() => void)[] = [];

    let currentInquiriesGuest: UnreadMessageItem[] = [];
    let currentInquiriesManager: UnreadMessageItem[] = [];
    let currentBookingsGuest: UnreadMessageItem[] = [];
    let currentBookingsManager: UnreadMessageItem[] = [];

    const recalculateAndAlert = () => {
      // Deduplicate items by ID
      const itemsMap = new Map<string, UnreadMessageItem>();
      [
        ...currentInquiriesManager,
        ...currentInquiriesGuest,
        ...currentBookingsManager,
        ...currentBookingsGuest,
      ].forEach(item => {
        itemsMap.set(item.id, item);
      });

      const combined = Array.from(itemsMap.values()).sort((a, b) => b.timestamp - a.timestamp);

      // Check if any genuinely new incoming unread messages arrived since last snapshot
      let hasNewIncoming = false;

      combined.forEach(item => {
        const prevTime = knownMessageTimestamps.current.get(item.id);
        if (prevTime === undefined) {
          // Newly arrived unread message
          if (!isInitialLoad.current) {
            hasNewIncoming = true;
          }
        } else if (item.timestamp > prevTime) {
          // New message in existing conversation
          if (!isInitialLoad.current) {
            hasNewIncoming = true;
          }
        }
        knownMessageTimestamps.current.set(item.id, item.timestamp);
      });

      if (!isInitialLoad.current && hasNewIncoming) {
        playDingSound(0.26);
        triggerVibration();
      }

      isInitialLoad.current = false;
      setUnreadItems(combined);
    };

    // 1. Guest Inquiry Chats (when user is a traveler / client)
    const qGuestChats = query(
      collection(db, 'hotel_chats'),
      where('guestId', '==', user.uid)
    );
    unsubs.push(
      onSnapshot(qGuestChats, (snap) => {
        currentInquiriesGuest = snap.docs
          .map(d => {
            const data = d.data();
            const isUnread =
              data.lastSenderId &&
              data.lastSenderId !== user.uid &&
              Boolean(data.lastMessage) &&
              Boolean(data.updatedAt) &&
              (!data.guestLastOpenedAt || data.updatedAt > data.guestLastOpenedAt) &&
              (!data.guestLastSeenAt || data.updatedAt > data.guestLastSeenAt);

            if (!isUnread) return null;

            return {
              id: d.id,
              type: 'inquiry' as const,
              hotelId: data.hotelId || '',
              hotelName: data.hotelName || 'Property',
              guestId: data.guestId,
              guestName: data.guestName,
              senderName: data.hotelName || 'Property Host',
              senderRoleTag: 'Host Reply' as const,
              lastMessage: data.lastMessage || 'Sent you a message',
              timestamp: data.updatedAt || Date.now(),
              isManagerView: false,
            };
          })
          .filter(Boolean) as UnreadMessageItem[];

        recalculateAndAlert();
      }, (err) => console.warn('Error listening to guest chats:', err))
    );

    // 2. Manager Inquiry Chats (when user is a lodge manager)
    if (isManager) {
      const qManagerChats = query(
        collection(db, 'hotel_chats'),
        where('managerId', '==', user.uid)
      );
      unsubs.push(
        onSnapshot(qManagerChats, (snap) => {
          currentInquiriesManager = snap.docs
            .map(d => {
              const data = d.data();
              const isUnread =
                data.lastSenderId &&
                data.lastSenderId !== user.uid &&
                Boolean(data.lastMessage) &&
                Boolean(data.updatedAt) &&
                (!data.managerLastOpenedAt || data.updatedAt > data.managerLastOpenedAt) &&
                (!data.managerLastSeenAt || data.updatedAt > data.managerLastSeenAt);

              if (!isUnread) return null;

              return {
                id: d.id,
                type: 'inquiry' as const,
                hotelId: data.hotelId || '',
                hotelName: data.hotelName || 'Your Property',
                guestId: data.guestId,
                guestName: data.guestName,
                senderName: data.guestName || 'Guest',
                senderRoleTag: 'Guest Inquiry' as const,
                lastMessage: data.lastMessage || 'Sent an inquiry',
                timestamp: data.updatedAt || Date.now(),
                isManagerView: true,
              };
            })
            .filter(Boolean) as UnreadMessageItem[];

          recalculateAndAlert();
        }, (err) => console.warn('Error listening to manager chats:', err))
      );
    }

    // 3. Guest Bookings (chat messages on confirmed/pending bookings)
    const qGuestBookings = query(
      collection(db, 'bookings'),
      where('guestId', '==', user.uid)
    );
    unsubs.push(
      onSnapshot(qGuestBookings, (snap) => {
        currentBookingsGuest = snap.docs
          .map(d => {
            const data = { id: d.id, ...d.data() } as Booking;
            const msgText = (data as any).lastMessage || (data as any).lastMessageText;
            const msgTime = (data as any).lastMessageAt;
            const isUnread =
              (data as any).lastMessageSenderId &&
              (data as any).lastMessageSenderId !== user.uid &&
              Boolean(msgText) &&
              Boolean(msgTime) &&
              (!(data as any).guestLastOpenedAt || msgTime > (data as any).guestLastOpenedAt) &&
              (!(data as any).guestLastSeenAt || msgTime > (data as any).guestLastSeenAt);

            if (!isUnread) return null;

            return {
              id: `booking_${d.id}`,
              type: 'booking' as const,
              hotelId: data.hotelId,
              hotelName: data.hotelName || 'Property Stay',
              guestId: data.guestId,
              guestName: data.guestName,
              senderName: data.hotelName || 'Lodge Host',
              senderRoleTag: 'Booking Chat' as const,
              lastMessage: msgText || 'New booking message',
              timestamp: msgTime || Date.now(),
              booking: data,
              isManagerView: false,
            };
          })
          .filter(Boolean) as UnreadMessageItem[];

        recalculateAndAlert();
      }, (err) => console.warn('Error listening to guest booking messages:', err))
    );

    // 4. Manager Bookings (chat messages on guest bookings)
    if (isManager) {
      const qManagerBookings = query(
        collection(db, 'bookings'),
        where('managerId', '==', user.uid)
      );
      unsubs.push(
        onSnapshot(qManagerBookings, (snap) => {
          currentBookingsManager = snap.docs
            .map(d => {
              const data = { id: d.id, ...d.data() } as Booking;
              const msgText = (data as any).lastMessage || (data as any).lastMessageText;
              const msgTime = (data as any).lastMessageAt;
              const isUnread =
                (data as any).lastMessageSenderId &&
                (data as any).lastMessageSenderId !== user.uid &&
                Boolean(msgText) &&
                Boolean(msgTime) &&
                (!(data as any).managerLastOpenedAt || msgTime > (data as any).managerLastOpenedAt) &&
                (!(data as any).managerLastSeenAt || msgTime > (data as any).managerLastSeenAt);

              if (!isUnread) return null;

              return {
                id: `booking_${d.id}`,
                type: 'booking' as const,
                hotelId: data.hotelId,
                hotelName: data.hotelName || 'Your Property',
                guestId: data.guestId,
                guestName: data.guestName,
                senderName: data.guestName || 'Guest',
                senderRoleTag: 'Booking Chat' as const,
                lastMessage: msgText || 'New guest message',
                timestamp: msgTime || Date.now(),
                booking: data,
                isManagerView: true,
              };
            })
            .filter(Boolean) as UnreadMessageItem[];

          recalculateAndAlert();
        }, (err) => console.warn('Error listening to manager booking messages:', err))
      );
    }

    return () => {
      unsubs.forEach(unsub => unsub());
      if (vibrationTimeoutRef.current) {
        clearTimeout(vibrationTimeoutRef.current);
      }
    };
  }, [user, triggerVibration]);

  const markAsRead = async (item: UnreadMessageItem) => {
    if (!user) return;
    try {
      const now = Date.now();
      if (item.type === 'inquiry') {
        const chatRef = doc(db, 'hotel_chats', item.id);
        await updateDoc(chatRef, {
          [item.isManagerView ? 'managerLastOpenedAt' : 'guestLastOpenedAt']: now,
          [item.isManagerView ? 'managerLastSeenAt' : 'guestLastSeenAt']: now,
        });
      } else if (item.type === 'booking') {
        const rawBookingId = item.id.replace('booking_', '');
        const bookingRef = doc(db, 'bookings', rawBookingId);
        await updateDoc(bookingRef, {
          [item.isManagerView ? 'managerLastOpenedAt' : 'guestLastOpenedAt']: now,
          [item.isManagerView ? 'managerLastSeenAt' : 'guestLastSeenAt']: now,
        });
      }
    } catch (e) {
      console.warn('Error marking message as read:', e);
    }
  };

  return {
    unreadItems,
    unreadCount: unreadItems.length,
    isVibrating,
    triggerDing,
    markAsRead,
  };
}
