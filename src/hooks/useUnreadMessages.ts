import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isHotelManager } from '../lib/roles';
import { playDingSound } from '../lib/notificationSound';
import { Booking } from '../types';

export interface ActiveChatItem {
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
  isUnread: boolean;
  status?: string;
}

export type UnreadMessageItem = ActiveChatItem;

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadItems, setUnreadItems] = useState<ActiveChatItem[]>([]);
  const [activeChats, setActiveChats] = useState<ActiveChatItem[]>([]);
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
      setActiveChats([]);
      setIsVibrating(false);
      isInitialLoad.current = true;
      knownMessageTimestamps.current.clear();
      return;
    }

    const isManager = isHotelManager(user);
    const unsubs: (() => void)[] = [];

    let currentInquiriesGuest: ActiveChatItem[] = [];
    let currentInquiriesManager: ActiveChatItem[] = [];
    let currentBookingsGuest: ActiveChatItem[] = [];
    let currentBookingsManager: ActiveChatItem[] = [];

    const recalculateAndAlert = () => {
      // Deduplicate items by ID
      const itemsMap = new Map<string, ActiveChatItem>();
      [
        ...currentInquiriesManager,
        ...currentInquiriesGuest,
        ...currentBookingsManager,
        ...currentBookingsGuest,
      ].forEach(item => {
        itemsMap.set(item.id, item);
      });

      const sortedAll = Array.from(itemsMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      const unreadOnly = sortedAll.filter(item => item.isUnread);

      // Check if any genuinely new incoming unread messages arrived since last snapshot
      let hasNewIncoming = false;

      unreadOnly.forEach(item => {
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
      setUnreadItems(unreadOnly);
      setActiveChats(sortedAll);
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
            const hasConversation = Boolean(data.lastMessage) || Boolean(data.updatedAt) || data.status === 'active';
            if (!hasConversation) return null;

            const isUnread =
              data.lastSenderId &&
              data.lastSenderId !== user.uid &&
              Boolean(data.lastMessage) &&
              Boolean(data.updatedAt) &&
              (!data.guestLastOpenedAt || data.updatedAt > data.guestLastOpenedAt) &&
              (!data.guestLastSeenAt || data.updatedAt > data.guestLastSeenAt);

            return {
              id: d.id,
              type: 'inquiry' as const,
              hotelId: data.hotelId || '',
              hotelName: data.hotelName || 'Property',
              guestId: data.guestId,
              guestName: data.guestName,
              senderName: data.hotelName || 'Property Host',
              senderRoleTag: 'Host Reply' as const,
              lastMessage: data.lastMessage || 'Conversation active',
              timestamp: data.updatedAt || Date.now(),
              isManagerView: false,
              isUnread: Boolean(isUnread),
              status: data.status || 'active',
            };
          })
          .filter(Boolean) as ActiveChatItem[];

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
              const hasConversation = Boolean(data.lastMessage) || Boolean(data.updatedAt) || data.status === 'active';
              if (!hasConversation) return null;

              const isUnread =
                data.lastSenderId &&
                data.lastSenderId !== user.uid &&
                Boolean(data.lastMessage) &&
                Boolean(data.updatedAt) &&
                (!data.managerLastOpenedAt || data.updatedAt > data.managerLastOpenedAt) &&
                (!data.managerLastSeenAt || data.updatedAt > data.managerLastSeenAt);

              return {
                id: d.id,
                type: 'inquiry' as const,
                hotelId: data.hotelId || '',
                hotelName: data.hotelName || 'Your Property',
                guestId: data.guestId,
                guestName: data.guestName,
                senderName: data.guestName || 'Guest',
                senderRoleTag: 'Guest Inquiry' as const,
                lastMessage: data.lastMessage || 'Guest inquiry',
                timestamp: data.updatedAt || Date.now(),
                isManagerView: true,
                isUnread: Boolean(isUnread),
                status: data.status || 'active',
              };
            })
            .filter(Boolean) as ActiveChatItem[];

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
            const msgTime = (data as any).lastMessageAt || (data as any).updatedAt || data.createdAt;
            const hasConversation = Boolean(msgText) || data.status === 'pending' || data.status === 'confirmed';
            if (!hasConversation) return null;

            const isUnread =
              (data as any).lastMessageSenderId &&
              (data as any).lastMessageSenderId !== user.uid &&
              Boolean(msgText) &&
              Boolean(msgTime) &&
              (!(data as any).guestLastOpenedAt || msgTime > (data as any).guestLastOpenedAt) &&
              (!(data as any).guestLastSeenAt || msgTime > (data as any).guestLastSeenAt);

            return {
              id: `booking_${d.id}`,
              type: 'booking' as const,
              hotelId: data.hotelId,
              hotelName: data.hotelName || 'Property Stay',
              guestId: data.guestId,
              guestName: data.guestName,
              senderName: data.hotelName || 'Lodge Host',
              senderRoleTag: 'Booking Chat' as const,
              lastMessage: msgText || `Booking stay: ${data.checkIn} to ${data.checkOut}`,
              timestamp: msgTime || Date.now(),
              booking: data,
              isManagerView: false,
              isUnread: Boolean(isUnread),
              status: data.status,
            };
          })
          .filter(Boolean) as ActiveChatItem[];

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
              const msgTime = (data as any).lastMessageAt || (data as any).updatedAt || data.createdAt;
              const hasConversation = Boolean(msgText) || data.status === 'pending' || data.status === 'confirmed';
              if (!hasConversation) return null;

              const isUnread =
                (data as any).lastMessageSenderId &&
                (data as any).lastMessageSenderId !== user.uid &&
                Boolean(msgText) &&
                Boolean(msgTime) &&
                (!(data as any).managerLastOpenedAt || msgTime > (data as any).managerLastOpenedAt) &&
                (!(data as any).managerLastSeenAt || msgTime > (data as any).managerLastSeenAt);

              return {
                id: `booking_${d.id}`,
                type: 'booking' as const,
                hotelId: data.hotelId,
                hotelName: data.hotelName || 'Your Property',
                guestId: data.guestId,
                guestName: data.guestName,
                senderName: data.guestName || 'Guest',
                senderRoleTag: 'Booking Chat' as const,
                lastMessage: msgText || `Booking stay: ${data.checkIn} to ${data.checkOut}`,
                timestamp: msgTime || Date.now(),
                booking: data,
                isManagerView: true,
                isUnread: Boolean(isUnread),
                status: data.status,
              };
            })
            .filter(Boolean) as ActiveChatItem[];

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

  const markAsRead = async (item: ActiveChatItem) => {
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
    activeChats,
    activeChatsCount: activeChats.length,
    isVibrating,
    triggerDing,
    markAsRead,
  };
}
