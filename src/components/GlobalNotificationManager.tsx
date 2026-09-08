import React, { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Booking, Hotel } from '../types';
import { isHotelManager } from '../lib/roles';
import { playChime, startRinging, stopRinging } from '../lib/notificationSound';
import { useChatModal } from '../contexts/ChatModalContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MessageSquare, CalendarCheck, CheckCircle2, XCircle, X, Phone, PhoneOff, Video } from 'lucide-react';

export const showBrowserNotification = (title: string, body: string, onClick?: () => void) => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body, icon: '/favicon.ico' });
      if (onClick) {
        n.onclick = () => { window.focus(); onClick(); n.close(); };
      }
    } catch (e) {
      console.warn('Failed to display browser notification:', e);
    }
  }
};

export const requestBrowserNotifications = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        toast.success('Live notifications enabled!', { icon: '🔔' });
      }
      return perm;
    } catch {
      return 'default';
    }
  }
  return Notification.permission;
};

export default function GlobalNotificationManager() {
  const { user } = useAuth();
  const { activeChat, isMinimized, openInquiryChat, openBookingChat } = useChatModal();
  const navigate = useNavigate();

  // Keep references to active chat and minimize status for snapshot listeners
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;
  const isMinimizedRef = useRef(isMinimized);
  isMinimizedRef.current = isMinimized;

  // Track the timestamp when this app session started to prevent past messages from alerting on launch
  const sessionStartTime = useRef<number>(Date.now());

  // Track known timestamps / statuses to avoid toasting existing records on first load
  const knownChatTimestamps = useRef<Record<string, number>>({});
  const knownBookingStatuses = useRef<Record<string, Booking['status']>>({});
  const knownBookingMessageTimestamps = useRef<Record<string, number>>({});
  const hasPromptedPermission = useRef(false);
  
  // Track call listeners so we don't leak memory or duplicate ringing
  const callUnsubs = useRef<Record<string, () => void>>({});
  const activeCallToasts = useRef<Record<string, string>>({});

  // Cached hotels so we can immediately construct Hotel objects for the chat modal
  const hotelCache = useRef<Record<string, Hotel>>({});

  const fetchHotelData = async (hotelId: string): Promise<Hotel | null> => {
    if (hotelCache.current[hotelId]) return hotelCache.current[hotelId];
    try {
      const snap = await getDoc(doc(db, 'hotels', hotelId));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Hotel;
        hotelCache.current[hotelId] = data;
        return data;
      }
    } catch (e) {
      console.error('Error fetching hotel for notification:', e);
    }
    return null;
  };

  useEffect(() => {
    if (!user) {
      knownChatTimestamps.current = {};
      knownBookingStatuses.current = {};
      knownBookingMessageTimestamps.current = {};
      Object.values(callUnsubs.current).forEach(unsub => unsub());
      callUnsubs.current = {};
      stopRinging();
      hasPromptedPermission.current = false;
      return;
    }

    // Proactively request browser notification permission once per session if not decided
    if (!hasPromptedPermission.current && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      hasPromptedPermission.current = true;
      void requestBrowserNotifications();
    }

    const isManager = isHotelManager(user);

    // Helper to check if the current user currently has this specific chat open and active
    const isChatCurrentlyOpen = (hotelId: string, guestId?: string, chatData?: any) => {
      const amIManagerForChat = chatData ? (chatData.managerId === user.uid) : isManager;
      // 1. If Firestore data indicates current user is in this chat right now
      if (chatData) {
        const inChatFlag = amIManagerForChat ? chatData.managerInChat : chatData.guestInChat;
        if (inChatFlag) return true;
      }
      // 2. If the global floating chat dock or modal is actively open and not minimized
      const currentActive = activeChatRef.current;
      const currentlyMinimized = isMinimizedRef.current;
      if (currentActive && !currentlyMinimized) {
        if (currentActive.type === 'inquiry') {
          const sameHotel = currentActive.hotel?.id === hotelId;
          if (!sameHotel) return false;
          if (amIManagerForChat) {
            // For manager: check if the open chat is with the same guest
            const openGuestId = currentActive.guestId;
            return !openGuestId || openGuestId === guestId;
          } else {
            // For guest: if the same hotel chat is open
            return true;
          }
        }
      }
      return false;
    };

    // ==========================================
    // 1. CHAT DOCUMENT HANDLER
    // ==========================================
    const handleChatDocChange = async (change: any, isInitial: boolean) => {
      const data = change.doc.data() as any;
      // STRICT PRIVACY: Verify this chat is exclusively between this manager and guest
      if (data.guestId !== user.uid && data.managerId !== user.uid) {
        return;
      }
      // If deleted by this user, ignore
      if (Array.isArray(data.deletedBy) && data.deletedBy.includes(user.uid)) {
        return;
      }
      const chatId = change.doc.id;
      const amIManager = data.managerId === user.uid;

      // --- Call Listener per Chat ---
      if (change.type === 'added' || change.type === 'modified') {
        if (!callUnsubs.current[chatId]) {
          const callsQuery = query(
            collection(db, 'hotel_chats', chatId, 'calls'),
            where('calleeId', '==', user.uid)
          );
          callUnsubs.current[chatId] = onSnapshot(callsQuery, async (callSnap) => {
            callSnap.docChanges().forEach(async (callChange) => {
              const callData = callChange.doc.data();
              const callId = callChange.doc.id;
              
              if (callData.status === 'ringing') {
                // Ignore stale calls left over from earlier or from before session start
                if (callData.createdAt && (Date.now() - callData.createdAt > 45000 || callData.createdAt < sessionStartTime.current - 10000)) {
                  return;
                }

                if (isChatCurrentlyOpen(data.hotelId, data.guestId, data)) {
                  return;
                }
                
                const hotel = await fetchHotelData(data.hotelId);
                const isVideo = callData.type === 'video';
                
                startRinging();
                showBrowserNotification(
                  `Incoming ${isVideo ? 'Video' : 'Voice'} Call`,
                  `${callData.callerName || 'Guest'} is calling about ${hotel?.name || 'your property'}`,
                  () => {
                    openInquiryChat(
                      hotel!,
                      amIManager ? (data.guestId || undefined) : undefined,
                      amIManager ? (data.guestName || undefined) : undefined
                    );
                  }
                );

                const toastId = toast.custom(
                  (t) => {
                    const CallIcon = isVideo ? Video : Phone;
                    return (
                      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-stone-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-4 border border-stone-800`}>
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl shrink-0 animate-pulse">
                            <CallIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Incoming {isVideo ? 'Video' : 'Voice'} Call</p>
                            <p className="text-sm font-semibold text-white mt-0.5 truncate">
                              {callData.callerName || 'Guest'}
                            </p>
                            <p className="text-xs text-stone-300 mt-1 truncate">
                              Property: {hotel?.name || 'Loading...'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={async () => {
                              toast.dismiss(t.id);
                              stopRinging();
                              const callRef = doc(db, 'hotel_chats', chatId, 'calls', callId);
                              await updateDoc(callRef, { status: 'rejected', updatedAt: Date.now(), endedAt: Date.now() });
                            }}
                            className="flex-1 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                          >
                            <PhoneOff className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button
                            onClick={() => {
                              toast.dismiss(t.id);
                              stopRinging();
                              openInquiryChat(
                                hotel!,
                                amIManager ? (data.guestId || undefined) : undefined,
                                amIManager ? (data.guestName || undefined) : undefined
                              );
                            }}
                            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                          >
                            <CallIcon className="w-3.5 h-3.5" /> Accept {isVideo ? 'Video' : 'Voice'}
                          </button>
                        </div>
                      </div>
                    );
                  },
                  { duration: 30000, position: 'top-right', id: `call-${callId}` }
                );
                activeCallToasts.current[callId] = toastId;
              } else if (callData.status !== 'ringing') {
                if (activeCallToasts.current[callId]) {
                  toast.dismiss(activeCallToasts.current[callId]);
                  delete activeCallToasts.current[callId];
                }
                stopRinging();
              }
            });
          });
        }
      }

      if (change.type === 'removed') {
        if (callUnsubs.current[chatId]) {
          callUnsubs.current[chatId]();
          delete callUnsubs.current[chatId];
        }
      }

      const updatedAt = data.updatedAt || 0;
      const previousTimestamp = knownChatTimestamps.current[chatId] || 0;
      knownChatTimestamps.current[chatId] = updatedAt;

      // On initial snapshot of this listener, merely track the timestamps to avoid alerting on existing data
      if (isInitial) return;

      // Never alert for messages that were sent before the user launched/opened this session
      if (updatedAt <= sessionStartTime.current) return;

      // If the current user was the sender of the last message (they replied to it), do not notify!
      if (!data.lastSenderId || data.lastSenderId === user.uid) return;

      // If the message has already been seen or opened by the user
      if (amIManager) {
        if (data.managerLastOpenedAt && data.managerLastOpenedAt >= updatedAt) return;
        if (data.managerLastSeenAt && data.managerLastSeenAt >= updatedAt) return;
      } else {
        if (data.guestLastOpenedAt && data.guestLastOpenedAt >= updatedAt) return;
        if (data.guestLastSeenAt && data.guestLastSeenAt >= updatedAt) return;
      }

      if (
        updatedAt > previousTimestamp &&
        data.lastMessage
      ) {
        if (isChatCurrentlyOpen(data.hotelId, data.guestId, data)) {
          return;
        }

        playChime();

        const hotel = await fetchHotelData(data.hotelId) || {
          id: data.hotelId,
          name: data.hotelName || 'Property',
          managerId: data.managerId || user.uid,
          description: '',
          location: '',
          imageUrl: '',
          amenities: [],
          createdAt: Date.now(),
        };

        const senderTitle = amIManager
          ? (data.guestName || 'Guest')
          : (data.hotelName || hotel.name || 'Property Host');

        showBrowserNotification(
          amIManager ? `New inquiry from ${senderTitle}` : `Reply from ${senderTitle}`,
          data.lastMessage,
          () => openInquiryChat(
            hotel,
            amIManager ? (data.guestId || undefined) : undefined,
            amIManager ? (data.guestName || undefined) : undefined
          )
        );

        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-stone-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-4 border border-stone-800`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-stone-800 text-stone-200 border border-stone-700 rounded-xl shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-300">
                      {amIManager ? 'New Guest Inquiry' : 'Host Reply'}
                    </p>
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="text-stone-400 hover:text-white p-1 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-white mt-0.5 truncate">
                    {senderTitle} {data.hotelName ? `· ${data.hotelName}` : ''}
                  </p>
                  <p className="text-xs text-stone-200 mt-1 line-clamp-2 bg-stone-800 p-2 rounded-lg border border-stone-700">
                    "{data.lastMessage}"
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-400 hover:text-white rounded-lg transition"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    openInquiryChat(
                      hotel,
                      amIManager ? (data.guestId || undefined) : undefined,
                      amIManager ? (data.guestName || undefined) : undefined
                    );
                  }}
                  className="px-4 py-1.5 bg-stone-100 hover:bg-white text-stone-950 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Open Chat & Reply
                </button>
              </div>
            </div>
          ),
          { duration: 8000, position: 'top-right' }
        );
      }
    };

    // ==========================================
    // 2. BOOKING DOCUMENT HANDLER
    // ==========================================
    const handleBookingDocChange = async (change: any, isInitial: boolean) => {
      const booking = { id: change.doc.id, ...change.doc.data() } as Booking;
      // STRICT PRIVACY: Verify booking is exclusively for this account
      if (booking.guestId !== user.uid && booking.managerId !== user.uid) {
        return;
      }
      // If chat deleted by this user, ignore
      if (Array.isArray((booking as any).chatDeletedBy) && (booking as any).chatDeletedBy.includes(user.uid)) {
        return;
      }
      const currentStatus = booking.status;
      const previousStatus = knownBookingStatuses.current[booking.id!];
      const amIManager = booking.managerId === user.uid;

      const currentMessageAt = booking.lastMessageAt || 0;
      const previousMessageAt = knownBookingMessageTimestamps.current[booking.id!] || 0;

      knownBookingStatuses.current[booking.id!] = currentStatus;
      knownBookingMessageTimestamps.current[booking.id!] = currentMessageAt;

      // On initial snapshot load, track existing data and return immediately
      if (isInitial) return;
      
      // NEW BOOKING MESSAGE
      if (
        change.type === 'modified' &&
        currentMessageAt > previousMessageAt &&
        currentMessageAt > sessionStartTime.current &&
        booking.lastMessageSenderId &&
        booking.lastMessageSenderId !== user.uid
      ) {
        // If current user already saw this message
        if (amIManager && booking.managerLastSeenAt && booking.managerLastSeenAt >= currentMessageAt) {
          return;
        }
        if (!amIManager && booking.guestLastSeenAt && booking.guestLastSeenAt >= currentMessageAt) {
          return;
        }

        const chatContext = activeChatRef.current;
        if (chatContext?.type === 'booking' && chatContext.booking.id === booking.id && !isMinimizedRef.current) {
          // User is actively looking at it!
        } else {
          playChime();
          showBrowserNotification(
            `New message from ${booking.lastMessageSenderName || (amIManager ? 'Guest' : 'Host')}`,
            booking.lastMessageText || 'Sent an attachment',
            () => openBookingChat(booking)
          );
          
          toast.custom(
            (t) => (
              <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-2 border border-stone-800 max-w-sm w-full pointer-events-auto">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <MessageSquare className="w-5 h-5 text-stone-200" />
                       <span className="font-bold text-sm">New message from {booking.lastMessageSenderName || (amIManager ? 'Guest' : 'Host')}</span>
                   </div>
                   <button onClick={() => toast.dismiss(t.id)} className="text-stone-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-stone-200 px-7 line-clamp-2 bg-stone-800 p-2 rounded-lg border border-stone-700">"{booking.lastMessageText}"</p>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    openBookingChat(booking);
                  }}
                  className="ml-7 mt-2 px-3 py-1.5 bg-stone-100 hover:bg-white text-stone-950 font-bold text-xs rounded-xl shadow-sm self-start transition"
                >
                  Open Chat
                </button>
              </div>
            ),
            { duration: 8000, position: 'top-right' }
          );
        }
      }

      // NEW PENDING BOOKING FOR MANAGER
      if (amIManager && change.type === 'added' && currentStatus === 'pending') {
        const bookingCreatedAt = booking.createdAt || 0;
        if (bookingCreatedAt && bookingCreatedAt <= sessionStartTime.current) {
          return;
        }

        playChime();
        const hotel = await fetchHotelData(booking.hotelId);
        showBrowserNotification(
          'New Booking Request',
          `${booking.guestName} requested a stay at ${hotel?.name || 'your property'}`,
          () => navigate(`/dashboard/hotel/${booking.hotelId}?tab=bookings`)
        );
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-stone-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-4 border border-stone-800`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      New Booking Request
                    </p>
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="text-stone-400 hover:text-white p-1 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-white mt-0.5 truncate">
                    {booking.guestName} {hotel?.name ? `· ${hotel.name}` : ''}
                  </p>
                  <p className="text-xs text-stone-300 mt-1">
                    Dates: <span className="text-white font-medium">{booking.checkIn} to {booking.checkOut}</span> ({booking.guests} guest{booking.guests === 1 ? '' : 's'})
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-400 hover:text-white rounded-lg transition"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    navigate(`/dashboard/hotel/${booking.hotelId}?tab=bookings`);
                  }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  Review Request
                </button>
              </div>
            </div>
          ),
          { duration: 8000, position: 'top-right' }
        );
      }

      // BOOKING STATUS CHANGED FOR GUEST
      if (booking.guestId === user.uid && change.type === 'modified' && previousStatus && previousStatus !== currentStatus) {
        const bookingUpdatedAt = (booking as any).updatedAt || (booking as any).createdAt || 0;
        if (bookingUpdatedAt && bookingUpdatedAt <= sessionStartTime.current) {
          return;
        }

        playChime();
        if (currentStatus === 'confirmed' && previousStatus === 'pending') {
          showBrowserNotification(
            'Booking Confirmed!',
            'The property has approved your stay request.',
            () => navigate('/my-bookings')
          );
          toast.custom(
            (t) => (
              <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-700 pointer-events-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Booking Confirmed!</h4>
                  <p className="text-xs text-emerald-200 mt-0.5">The property has approved your stay request.</p>
                </div>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    navigate('/my-bookings');
                  }}
                  className="ml-auto px-3 py-1.5 bg-white text-emerald-950 font-bold text-xs rounded-xl shadow-xs"
                >
                  View
                </button>
              </div>
            ),
            { duration: 6000, position: 'top-right' }
          );
        } else if (currentStatus === 'cancelled') {
          const byWho = booking.cancelledBy === 'manager' ? 'the property' : 'you';
          showBrowserNotification(
            'Booking Cancelled',
            `Your booking was cancelled by ${byWho}.`,
            () => navigate('/my-bookings')
          );
          toast.custom(
            (t) => (
              <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-stone-800 pointer-events-auto">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Booking Cancelled</h4>
                  <p className="text-xs text-stone-400 mt-0.5">Your booking was cancelled by {byWho}.</p>
                </div>
              </div>
            ),
            { duration: 6000, position: 'top-right' }
          );
        }
      }
    };

    // ==========================================
    // 3. LISTEN TO QUERIES (BOTH GUEST AND MANAGER)
    // ==========================================
    const unsubs: (() => void)[] = [];

    // Guest chats
    let isInitialGuestChats = true;
    unsubs.push(onSnapshot(
      query(collection(db, 'hotel_chats'), where('guestId', '==', user.uid)),
      (snap) => {
        const isInitial = isInitialGuestChats;
        isInitialGuestChats = false;
        snap.docChanges().forEach(change => handleChatDocChange(change, isInitial));
      }
    ));

    // Manager chats
    if (isManager) {
      let isInitialManagerChats = true;
      unsubs.push(onSnapshot(
        query(collection(db, 'hotel_chats'), where('managerId', '==', user.uid)),
        (snap) => {
          const isInitial = isInitialManagerChats;
          isInitialManagerChats = false;
          snap.docChanges().forEach(change => handleChatDocChange(change, isInitial));
        }
      ));
    }

    // Guest bookings
    let isInitialGuestBookings = true;
    unsubs.push(onSnapshot(
      query(collection(db, 'bookings'), where('guestId', '==', user.uid)),
      (snap) => {
        const isInitial = isInitialGuestBookings;
        isInitialGuestBookings = false;
        snap.docChanges().forEach(change => handleBookingDocChange(change, isInitial));
      }
    ));

    // Manager bookings
    if (isManager) {
      let isInitialManagerBookings = true;
      unsubs.push(onSnapshot(
        query(collection(db, 'bookings'), where('managerId', '==', user.uid)),
        (snap) => {
          const isInitial = isInitialManagerBookings;
          isInitialManagerBookings = false;
          snap.docChanges().forEach(change => handleBookingDocChange(change, isInitial));
        }
      ));
    }

    return () => {
      unsubs.forEach(unsub => unsub());
      Object.values(callUnsubs.current).forEach(unsub => unsub());
      callUnsubs.current = {};
      stopRinging();
    };
  }, [user]);

  return null;
}
