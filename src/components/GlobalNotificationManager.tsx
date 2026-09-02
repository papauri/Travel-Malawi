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

const showBrowserNotification = (title: string, body: string, onClick?: () => void) => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: '/favicon.ico' });
    if (onClick) {
      n.onclick = () => { window.focus(); onClick(); n.close(); };
    }
  }
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

  // Track known timestamps / statuses to avoid toasting existing records on first load
  const knownChatTimestamps = useRef<Record<string, number>>({});
  const knownBookingStatuses = useRef<Record<string, Booking['status']>>({});
    const knownBookingMessageTimestamps = useRef<Record<string, number>>({});
  const isInitialChatLoad = useRef(true);
  const isInitialBookingLoad = useRef(true);
  
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
      Object.values(callUnsubs.current).forEach(unsub => unsub());
      callUnsubs.current = {};
      stopRinging();
      isInitialChatLoad.current = true;
      isInitialBookingLoad.current = true;
      return;
    }

    const isManager = isHotelManager(user);

    // Helper to check if the current user currently has this specific chat open and active
    const isChatCurrentlyOpen = (hotelId: string, guestId?: string, chatData?: any) => {
      // 1. If Firestore data indicates current user is in this chat right now
      if (chatData) {
        const inChatFlag = isManager ? chatData.managerInChat : chatData.guestInChat;
        if (inChatFlag) return true;
      }
      // 2. If the global floating chat dock or modal is actively open and not minimized
      const currentActive = activeChatRef.current;
      const currentlyMinimized = isMinimizedRef.current;
      if (currentActive && !currentlyMinimized) {
        if (currentActive.type === 'inquiry') {
          const sameHotel = currentActive.hotel?.id === hotelId;
          if (!sameHotel) return false;
          if (isManager) {
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
    // 1. LISTEN TO HOTEL CHATS (GUEST INQUIRIES & REPLIES & CALLS)
    // ==========================================
    const chatField = isManager ? 'managerId' : 'guestId';
    const chatQuery = query(
      collection(db, 'hotel_chats'),
      where(chatField, '==', user.uid)
    );

    const unsubChats = onSnapshot(chatQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data() as any;
        const chatId = change.doc.id;
        
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
                  // If chat is already open, useWebRTC inside Messages.tsx will ring and show modal,
                  // so we don't necessarily want to duplicate it. But to be safe, if we are in another tab
                  // we should show a toast.
                  if (isChatCurrentlyOpen(data.hotelId, data.guestId, data)) {
                    // Chat is open, Messages.tsx handles it.
                    return;
                  }
                  
                  const hotel = await fetchHotelData(data.hotelId);
                  
                  startRinging();
                  const toastId = toast.custom(
                    (t) => {
                      const isVideo = callData.type === 'video';
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
                                isManager ? (data.guestId || undefined) : undefined,
                                isManager ? (data.guestName || undefined) : undefined
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
                    { duration: 30000, position: 'top-right', id: `call-${callId}` } // Hold for 30s
                  );
                  activeCallToasts.current[callId] = toastId;
                } else if (callData.status !== 'ringing') {
                  // Call ended, answered elsewhere, or rejected
                  if (activeCallToasts.current[callId]) {
                    toast.dismiss(activeCallToasts.current[callId]);
                    delete activeCallToasts.current[callId];
                  }
                  // Ensure ringing stops if there are no other calls
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
        // --- End Call Listener ---

        const updatedAt = data.updatedAt || 0;
        const previousTimestamp = knownChatTimestamps.current[chatId] || 0;
        
        knownChatTimestamps.current[chatId] = updatedAt;

        // Skip toasting on first snapshot
        if (isInitialChatLoad.current) return;

        // Check if there is a new message sent by the OTHER person
        if (
          updatedAt > previousTimestamp &&
          data.lastMessage &&
          data.lastSenderId &&
          data.lastSenderId !== user.uid
        ) {
          // If the user already has this chat open, no need for notification or sound!
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

          const senderTitle = isManager
            ? (data.guestName || 'Guest')
            : (data.hotelName || hotel.name || 'Property Host');

          toast.custom(
            (t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-stone-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-4 border border-stone-800`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        {isManager ? 'New Guest Inquiry' : 'Host Reply'}
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
                    <p className="text-xs text-stone-300 mt-1 line-clamp-2 italic bg-stone-800/80 p-2 rounded-lg border border-stone-700/50">
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
                        isManager ? (data.guestId || undefined) : undefined,
                        isManager ? (data.guestName || undefined) : undefined
                      );
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
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
      });

      if (isInitialChatLoad.current) {
        isInitialChatLoad.current = false;
      }
    });

    // ==========================================
    // 2. LISTEN TO BOOKING REQUESTS & UPDATES
    // ==========================================
    const bookingField = isManager ? 'managerId' : 'guestId';
    const bookingQuery = query(
      collection(db, 'bookings'),
      where(bookingField, '==', user.uid)
    );

    const unsubBookings = onSnapshot(bookingQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const booking = { id: change.doc.id, ...change.doc.data() } as Booking;
        const currentStatus = booking.status;
        const previousStatus = knownBookingStatuses.current[booking.id!];

        
        const currentMessageAt = booking.lastMessageAt || 0;
        const previousMessageAt = knownBookingMessageTimestamps.current[booking.id!] || 0;

        knownBookingStatuses.current[booking.id!] = currentStatus;
        knownBookingMessageTimestamps.current[booking.id!] = currentMessageAt;

        if (isInitialBookingLoad.current) return;
        
        // NEW BOOKING MESSAGE
        if (change.type === 'modified' && currentMessageAt > previousMessageAt && booking.lastMessageSenderId !== user.uid) {
            const chatContext = activeChatRef.current;
            if (chatContext?.type === 'booking' && chatContext.booking.id === booking.id && !isMinimizedRef.current) {
                // User is actively looking at it!
            } else {
                playChime();
                showBrowserNotification(
                  `New message from ${booking.lastMessageSenderName}`,
                  booking.lastMessageText || 'Sent an attachment',
                  () => openBookingChat(booking)
                );
                
                toast.custom(
                  (t) => (
                    <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-2 border border-stone-800 max-w-sm w-full">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <MessageSquare className="w-5 h-5 text-indigo-400" />
                             <span className="font-bold text-sm">New message from {booking.lastMessageSenderName}</span>
                         </div>
                         <button onClick={() => toast.dismiss(t.id)} className="text-stone-400 hover:text-white"><X className="w-4 h-4" /></button>
                      </div>
                      <p className="text-xs text-stone-300 italic px-7 line-clamp-2">"{booking.lastMessageText}"</p>
                      <button
                        onClick={() => {
                          toast.dismiss(t.id);
                          openBookingChat(booking);
                        }}
                        className="ml-7 mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm self-start transition"
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
        if (isManager && change.type === 'added' && currentStatus === 'pending') {
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
        if (!isManager && change.type === 'modified' && previousStatus && previousStatus !== currentStatus) {
          playChime();
          if (currentStatus === 'confirmed' && previousStatus === 'pending') {
            showBrowserNotification(
              'Booking Confirmed!',
              'The property has approved your stay request.',
              () => navigate('/my-bookings')
            );
            toast.custom(
              (t) => (
                <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-700">
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
                <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-stone-800">
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
      });

      if (isInitialBookingLoad.current) {
        isInitialBookingLoad.current = false;
      }
    });

    return () => {
      unsubChats();
      unsubBookings();
    };
  }, [user]);

  return null;
}
