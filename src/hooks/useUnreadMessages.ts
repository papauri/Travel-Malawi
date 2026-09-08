import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isHotelManager } from '../lib/roles';
import { playDingSound } from '../lib/notificationSound';
import { Booking } from '../types';
import { fastDeleteOrClearChat } from '../lib/chatDeletion';

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
  status: string;
  isClosed?: boolean;
  lastSenderId?: string;
}

export type UnreadMessageItem = ActiveChatItem;

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadItems, setUnreadItems] = useState<ActiveChatItem[]>([]);
  const [activeChats, setActiveChats] = useState<ActiveChatItem[]>([]);
  const [inactiveChats, setInactiveChats] = useState<ActiveChatItem[]>([]);
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
      setInactiveChats([]);
      setIsVibrating(false);
      isInitialLoad.current = true;
      knownMessageTimestamps.current.clear();
      return;
    }

    const isManager = isHotelManager(user);
    const unsubs: (() => void)[] = [];

    let currentInquiriesGuestActive: ActiveChatItem[] = [];
    let currentInquiriesGuestInactive: ActiveChatItem[] = [];

    let currentInquiriesManagerActive: ActiveChatItem[] = [];
    let currentInquiriesManagerInactive: ActiveChatItem[] = [];

    let currentBookingsGuestActive: ActiveChatItem[] = [];
    let currentBookingsGuestInactive: ActiveChatItem[] = [];

    let currentBookingsManagerActive: ActiveChatItem[] = [];
    let currentBookingsManagerInactive: ActiveChatItem[] = [];

    const recalculateAndAlert = () => {
      // Deduplicate active items by ID
      const activeMap = new Map<string, ActiveChatItem>();
      [
        ...currentInquiriesManagerActive,
        ...currentInquiriesGuestActive,
        ...currentBookingsManagerActive,
        ...currentBookingsGuestActive,
      ].forEach(item => {
        activeMap.set(item.id, item);
      });

      const sortedActive = Array.from(activeMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      const unreadOnly = sortedActive.filter(item => item.isUnread);

      // Deduplicate inactive items by ID (excluding any that are currently active)
      const inactiveMap = new Map<string, ActiveChatItem>();
      [
        ...currentInquiriesManagerInactive,
        ...currentInquiriesGuestInactive,
        ...currentBookingsManagerInactive,
        ...currentBookingsGuestInactive,
      ].forEach(item => {
        if (!activeMap.has(item.id)) {
          inactiveMap.set(item.id, item);
        }
      });

      const sortedInactive = Array.from(inactiveMap.values()).sort((a, b) => b.timestamp - a.timestamp);

      // Check if any genuinely new incoming unread messages arrived since last snapshot
      let hasNewIncoming = false;

      unreadOnly.forEach(item => {
        const prevTime = knownMessageTimestamps.current.get(item.id);
        if (prevTime === undefined) {
          if (!isInitialLoad.current) {
            hasNewIncoming = true;
          }
        } else if (item.timestamp > prevTime) {
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
      setActiveChats(sortedActive);
      setInactiveChats(sortedInactive);
    };

    // 1. Guest Inquiry Chats
    const qGuestChats = query(
      collection(db, 'hotel_chats'),
      where('guestId', '==', user.uid)
    );
    unsubs.push(
      onSnapshot(qGuestChats, (snap) => {
        const activeList: ActiveChatItem[] = [];
        const inactiveList: ActiveChatItem[] = [];

        snap.docs.forEach(d => {
          const data = d.data();
          // STRICT SECURITY: Only allow chats where this user is the guest
          if (data.guestId && data.guestId !== user.uid) return;
          const hasText = Boolean(data.lastMessage) && data.lastMessage.trim().length > 0;
          const isDeleted = Boolean(data.isDeleted) || 
            data.status === 'deleted' || 
            (Array.isArray(data.deletedBy) && data.deletedBy.includes(user.uid));
          const isCleared = data.status === 'cleared' || 
            (data.clearedBy === user.uid && (data.clearedAt || 0) >= (data.updatedAt || 0));
          const isClosedOrEnded = data.status === 'ended' || data.status === 'closed' || data.status === 'inactive';

          if (isDeleted || isCleared || !hasText) {
            return;
          }

          const isUnread =
            !isClosedOrEnded &&
            data.lastSenderId &&
            data.lastSenderId !== user.uid &&
            Boolean(data.updatedAt) &&
            (!data.guestLastOpenedAt || data.updatedAt > data.guestLastOpenedAt) &&
            (!data.guestLastSeenAt || data.updatedAt > data.guestLastSeenAt);

          const item: ActiveChatItem = {
            id: d.id,
            type: 'inquiry' as const,
            hotelId: data.hotelId || '',
            hotelName: data.hotelName || 'Property',
            guestId: data.guestId,
            guestName: data.guestName,
            senderName: data.hotelName || 'Property Host',
            senderRoleTag: 'Host Reply' as const,
            lastMessage: data.lastMessage,
            timestamp: data.updatedAt || data.createdAt || Date.now(),
            isManagerView: false,
            isUnread: Boolean(isUnread),
            status: data.status || (isClosedOrEnded ? 'closed' : 'active'),
            isClosed: isClosedOrEnded,
            lastSenderId: data.lastSenderId,
          };

          if (isClosedOrEnded) {
            inactiveList.push(item);
          } else {
            activeList.push(item);
          }
        });

        currentInquiriesGuestActive = activeList;
        currentInquiriesGuestInactive = inactiveList;
        recalculateAndAlert();
      }, (err) => console.warn('Error listening to guest chats:', err))
    );

    // 2. Manager Inquiry Chats
    if (isManager) {
      const qManagerChats = query(
        collection(db, 'hotel_chats'),
        where('managerId', '==', user.uid)
      );
      unsubs.push(
        onSnapshot(qManagerChats, (snap) => {
          const activeList: ActiveChatItem[] = [];
          const inactiveList: ActiveChatItem[] = [];

          snap.docs.forEach(d => {
            const data = d.data();
            // STRICT SECURITY: Only allow chats where this user is the assigned manager
            if (data.managerId && data.managerId !== user.uid) return;
            const hasText = Boolean(data.lastMessage) && data.lastMessage.trim().length > 0;
            const isDeleted = Boolean(data.isDeleted) || 
              data.status === 'deleted' || 
              (Array.isArray(data.deletedBy) && data.deletedBy.includes(user.uid));
            const isCleared = data.status === 'cleared' || 
              (data.clearedBy === user.uid && (data.clearedAt || 0) >= (data.updatedAt || 0));
            const isClosedOrEnded = data.status === 'ended' || data.status === 'closed' || data.status === 'inactive';

            if (isDeleted || isCleared || !hasText) {
              return;
            }

            const isUnread =
              !isClosedOrEnded &&
              data.lastSenderId &&
              data.lastSenderId !== user.uid &&
              Boolean(data.updatedAt) &&
              (!data.managerLastOpenedAt || data.updatedAt > data.managerLastOpenedAt) &&
              (!data.managerLastSeenAt || data.updatedAt > data.managerLastSeenAt);

            const item: ActiveChatItem = {
              id: d.id,
              type: 'inquiry' as const,
              hotelId: data.hotelId || '',
              hotelName: data.hotelName || 'Your Property',
              guestId: data.guestId,
              guestName: data.guestName,
              senderName: data.guestName || 'Guest',
              senderRoleTag: 'Guest Inquiry' as const,
              lastMessage: data.lastMessage,
              timestamp: data.updatedAt || data.createdAt || Date.now(),
              isManagerView: true,
              isUnread: Boolean(isUnread),
              status: data.status || (isClosedOrEnded ? 'closed' : 'active'),
              isClosed: isClosedOrEnded,
              lastSenderId: data.lastSenderId,
            };

            if (isClosedOrEnded) {
              inactiveList.push(item);
            } else {
              activeList.push(item);
            }
          });

          currentInquiriesManagerActive = activeList;
          currentInquiriesManagerInactive = inactiveList;
          recalculateAndAlert();
        }, (err) => console.warn('Error listening to manager chats:', err))
      );
    }

    // 3. Guest Bookings Chats (only bookings with actual chat messages)
    const qGuestBookings = query(
      collection(db, 'bookings'),
      where('guestId', '==', user.uid)
    );
    unsubs.push(
      onSnapshot(qGuestBookings, (snap) => {
        const activeList: ActiveChatItem[] = [];
        const inactiveList: ActiveChatItem[] = [];

        snap.docs.forEach(d => {
          const data = { id: d.id, ...d.data() } as Booking;
          // STRICT SECURITY: Only allow bookings where this user is the guest
          if (data.guestId && data.guestId !== user.uid) return;
          const msgText = (data as any).lastMessageText || (data as any).lastMessage || '';
          const hasText = Boolean(msgText) && msgText.trim().length > 0;
          const isCancelled = data.status === 'cancelled' || data.status === 'rejected';
          const isDeleted = Boolean((data as any).chatDeleted) || 
            (data as any).chatStatus === 'deleted' || 
            (Array.isArray((data as any).chatDeletedBy) && (data as any).chatDeletedBy.includes(user.uid));
          const isCleared = (data as any).chatStatus === 'cleared' || 
            ((data as any).chatClearedBy === user.uid && ((data as any).chatClearedAt || 0) >= ((data as any).lastMessageAt || 0));
          const isClosedOrEnded = (data as any).chatStatus === 'ended' || (data as any).chatStatus === 'closed' || (data as any).chatStatus === 'inactive';

          // Strictly require real messages; do not show empty bookings in active chats
          if (isCancelled || isDeleted || isCleared || !hasText) {
            return;
          }

          const msgTime = (data as any).lastMessageAt || (data as any).updatedAt || data.createdAt;
          const isUnread =
            !isClosedOrEnded &&
            (data as any).lastMessageSenderId &&
            (data as any).lastMessageSenderId !== user.uid &&
            Boolean(msgTime) &&
            (!(data as any).guestLastOpenedAt || msgTime > (data as any).guestLastOpenedAt) &&
            (!(data as any).guestLastSeenAt || msgTime > (data as any).guestLastSeenAt);

          const item: ActiveChatItem = {
            id: `booking_${d.id}`,
            type: 'booking' as const,
            hotelId: data.hotelId,
            hotelName: data.hotelName || 'Property Stay',
            guestId: data.guestId,
            guestName: data.guestName,
            senderName: data.hotelName || 'Lodge Host',
            senderRoleTag: 'Booking Chat' as const,
            lastMessage: msgText,
            timestamp: msgTime || Date.now(),
            booking: data,
            isManagerView: false,
            isUnread: Boolean(isUnread),
            status: (data as any).chatStatus || (isClosedOrEnded ? 'closed' : 'active'),
            isClosed: isClosedOrEnded,
            lastSenderId: (data as any).lastMessageSenderId,
          };

          if (isClosedOrEnded) {
            inactiveList.push(item);
          } else {
            activeList.push(item);
          }
        });

        currentBookingsGuestActive = activeList;
        currentBookingsGuestInactive = inactiveList;
        recalculateAndAlert();
      }, (err) => console.warn('Error listening to guest booking messages:', err))
    );

    // 4. Manager Bookings Chats
    if (isManager) {
      const qManagerBookings = query(
        collection(db, 'bookings'),
        where('managerId', '==', user.uid)
      );
      unsubs.push(
        onSnapshot(qManagerBookings, (snap) => {
          const activeList: ActiveChatItem[] = [];
          const inactiveList: ActiveChatItem[] = [];

          snap.docs.forEach(d => {
            const data = { id: d.id, ...d.data() } as Booking;
            // STRICT SECURITY: Only allow bookings where this user is the assigned manager
            if (data.managerId && data.managerId !== user.uid) return;
            const msgText = (data as any).lastMessageText || (data as any).lastMessage || '';
            const hasText = Boolean(msgText) && msgText.trim().length > 0;
            const isCancelled = data.status === 'cancelled' || data.status === 'rejected';
            const isDeleted = Boolean((data as any).chatDeleted) || 
              (data as any).chatStatus === 'deleted' || 
              (Array.isArray((data as any).chatDeletedBy) && (data as any).chatDeletedBy.includes(user.uid));
            const isCleared = (data as any).chatStatus === 'cleared' || 
              ((data as any).chatClearedBy === user.uid && ((data as any).chatClearedAt || 0) >= ((data as any).lastMessageAt || 0));
            const isClosedOrEnded = (data as any).chatStatus === 'ended' || (data as any).chatStatus === 'closed' || (data as any).chatStatus === 'inactive';

            if (isCancelled || isDeleted || isCleared || !hasText) {
              return;
            }

            const msgTime = (data as any).lastMessageAt || (data as any).updatedAt || data.createdAt;
            const isUnread =
              !isClosedOrEnded &&
              (data as any).lastMessageSenderId &&
              (data as any).lastMessageSenderId !== user.uid &&
              Boolean(msgTime) &&
              (!(data as any).managerLastOpenedAt || msgTime > (data as any).managerLastOpenedAt) &&
              (!(data as any).managerLastSeenAt || msgTime > (data as any).managerLastSeenAt);

            const item: ActiveChatItem = {
              id: `booking_${d.id}`,
              type: 'booking' as const,
              hotelId: data.hotelId,
              hotelName: data.hotelName || 'Your Property',
              guestId: data.guestId,
              guestName: data.guestName,
              senderName: data.guestName || 'Guest',
              senderRoleTag: 'Booking Chat' as const,
              lastMessage: msgText,
              timestamp: msgTime || Date.now(),
              booking: data,
              isManagerView: true,
              isUnread: Boolean(isUnread),
              status: (data as any).chatStatus || (isClosedOrEnded ? 'closed' : 'active'),
              isClosed: isClosedOrEnded,
              lastSenderId: (data as any).lastMessageSenderId,
            };

            if (isClosedOrEnded) {
              inactiveList.push(item);
            } else {
              activeList.push(item);
            }
          });

          currentBookingsManagerActive = activeList;
          currentBookingsManagerInactive = inactiveList;
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

  // Action: Mark Conversation As Read
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

  // Action: Close Conversation (moves out of Active Chats into Inactive/Closed)
  const closeConversation = async (item: ActiveChatItem) => {
    if (!user) return;
    const now = Date.now();
    try {
      if (item.type === 'inquiry') {
        const chatRef = doc(db, 'hotel_chats', item.id);
        await updateDoc(chatRef, {
          status: 'closed',
          closedAt: now,
          closedBy: user.uid,
          closedByName: user.displayName || user.email?.split('@')[0] || 'User',
          updatedAt: now,
        });
      } else if (item.type === 'booking') {
        const rawBookingId = item.id.replace('booking_', '');
        const bookingRef = doc(db, 'bookings', rawBookingId);
        await updateDoc(bookingRef, {
          chatStatus: 'closed',
          chatClosedAt: now,
          chatClosedBy: user.uid,
        });
      }
    } catch (e) {
      console.error('Error closing conversation:', e);
      throw e;
    }
  };

  // Action: Reopen Conversation (moves back into Active Chats)
  const reopenConversation = async (item: ActiveChatItem) => {
    if (!user) return;
    const now = Date.now();
    try {
      if (item.type === 'inquiry') {
        const chatRef = doc(db, 'hotel_chats', item.id);
        await updateDoc(chatRef, {
          status: 'active',
          closedAt: null,
          closedBy: null,
          closedByName: null,
          endedAt: null,
          endedBy: null,
          endedByName: null,
          updatedAt: now,
        });
      } else if (item.type === 'booking') {
        const rawBookingId = item.id.replace('booking_', '');
        const bookingRef = doc(db, 'bookings', rawBookingId);
        await updateDoc(bookingRef, {
          chatStatus: 'active',
          chatClosedAt: null,
          chatClosedBy: null,
        });
      }
    } catch (e) {
      console.error('Error reopening conversation:', e);
      throw e;
    }
  };

  // Action: Clear Chat History (fast atomic reset)
  const clearChatHistory = async (item: ActiveChatItem) => {
    if (!user) return;
    try {
      // Optimistic update
      setActiveChats(prev => prev.map(c => c.id === item.id ? { ...c, lastMessage: '', isUnread: false } : c));
      setUnreadItems(prev => prev.filter(c => c.id !== item.id));

      await fastDeleteOrClearChat({
        chatType: item.type,
        id: item.id,
        userId: user.uid,
        mode: 'clear',
      });
    } catch (e) {
      console.error('Error clearing chat history:', e);
      throw e;
    }
  };

  // Action: Delete Chat (instantly removes from account & atomic background cleanup)
  const deleteChat = async (item: ActiveChatItem) => {
    if (!user) return;
    try {
      // Optimistic removal: UI reflects deletion in 0ms
      setActiveChats(prev => prev.filter(c => c.id !== item.id));
      setInactiveChats(prev => prev.filter(c => c.id !== item.id));
      setUnreadItems(prev => prev.filter(c => c.id !== item.id));

      await fastDeleteOrClearChat({
        chatType: item.type,
        id: item.id,
        userId: user.uid,
        mode: 'delete',
      });
    } catch (e) {
      console.error('Error deleting chat:', e);
      throw e;
    }
  };

  return {
    unreadItems,
    unreadCount: unreadItems.length,
    activeChats,
    activeChatsCount: activeChats.length,
    inactiveChats,
    inactiveChatsCount: inactiveChats.length,
    isVibrating,
    triggerDing,
    markAsRead,
    closeConversation,
    reopenConversation,
    clearChatHistory,
    deleteChat,
  };
}
