import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Message, User, ChatPresenceState } from '../types';
import { Send, Loader2, MessageSquare, Eye, Check, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { chimeForIncoming, newChimeState } from '../lib/notificationSound';

interface Props {
  booking: Booking;
  currentUser: User;
}

export default function BookingChat({ booking, currentUser }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [presenceState, setPresenceState] = useState<ChatPresenceState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenMessages = useRef(newChimeState());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const isManager = currentUser.uid === booking.managerId;
  const otherParticipantName = isManager ? booking.guestName : 'Host';

  // 1. Listen to messages and presence in real-time
  useEffect(() => {
    if (!booking.id) return;
    
    const presenceDocRef = doc(db, 'bookings', booking.id, 'presence', 'chat_state');

    // Mark current user as inChat & update opened/seen timestamps
    const setInitialPresence = async () => {
      try {
        const now = Date.now();
        const payload = isManager 
          ? { managerInChat: true, managerLastOpenedAt: now, managerLastSeenAt: now, managerTyping: false }
          : { guestInChat: true, guestLastOpenedAt: now, guestLastSeenAt: now, guestTyping: false };
        
        await setDoc(presenceDocRef, payload, { merge: true });
      } catch (e) {
        console.warn('Error setting booking chat presence:', e);
      }
    };
    setInitialPresence();

    const presenceInterval = setInterval(() => {
      const payload = {
        [isManager ? 'managerInChat' : 'guestInChat']: true,
        [isManager ? 'managerLastSeenAt' : 'guestLastSeenAt']: Date.now()
      };
      setDoc(presenceDocRef, payload, { merge: true }).catch(() => {});
    }, 10000);

    // Listen to presence updates (typing, opened, active)
    const unsubPresence = onSnapshot(presenceDocRef, (snap) => {
      if (snap.exists()) {
        setPresenceState(snap.data() as ChatPresenceState);
      }
    }, (err) => {
      console.warn('Error listening to booking chat presence:', err);
    });

    // Listen to messages
    const q = query(
      collection(db, 'bookings', booking.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);
      chimeForIncoming(msgs, currentUser?.uid, seenMessages);
      setLoading(false);

      // Update last seen timestamp if new messages arrived
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== currentUser.uid) {
          updateDoc(presenceDocRef, {
            [isManager ? 'managerLastSeenAt' : 'guestLastSeenAt']: Date.now()
          }).catch(() => {});
        }
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error('Error fetching messages:', error);
      toast.error('Could not load messages.');
      setLoading(false);
    });
    
    return () => {
      unsubscribe();
      unsubPresence();
      clearInterval(presenceInterval);

      // Clear presence on unmount
      updateDoc(presenceDocRef, {
        [isManager ? 'managerInChat' : 'guestInChat']: false,
        [isManager ? 'managerTyping' : 'guestTyping']: false
      }).catch(() => {});
    };
  }, [booking.id, currentUser.uid, isManager]);

  // Handle typing state
  const setTypingState = useCallback(async (isTyping: boolean) => {
    if (!booking.id) return;
    try {
      const presenceDocRef = doc(db, 'bookings', booking.id, 'presence', 'chat_state');
      const field = isManager ? 'managerTyping' : 'guestTyping';
      const atField = isManager ? 'managerTypingAt' : 'guestTypingAt';
      await updateDoc(presenceDocRef, {
        [field]: isTyping,
        [atField]: isTyping ? Date.now() : 0
      });
    } catch (e) {
      // ignore transient error
    }
  }, [booking.id, isManager]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    if (!booking.id) return;

    if (text.trim().length > 0) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 2000) {
        lastTypingSentRef.current = now;
        setTypingState(true);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingState(false);
      }, 2500);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setTypingState(false);
    }
  };

  const handleInputBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingState(false);
  };

  // Determine typing & presence of other participant
  const otherIsTypingRaw = isManager ? presenceState?.guestTyping : presenceState?.managerTyping;
  const otherTypingAt = isManager ? (presenceState?.guestTypingAt || 0) : (presenceState?.managerTypingAt || 0);
  const isOtherTyping = Boolean(otherIsTypingRaw && (Date.now() - otherTypingAt < 5000));

  const otherLastOpenedAt = isManager ? presenceState?.guestLastOpenedAt : presenceState?.managerLastOpenedAt;
  const otherLastSeenAt = isManager ? presenceState?.guestLastSeenAt : presenceState?.managerLastSeenAt;
  const otherInChatRaw = isManager ? presenceState?.guestInChat : presenceState?.managerInChat;
  const otherInChat = Boolean(otherInChatRaw && (Date.now() - (otherLastSeenAt || 0) < 20000));

  const formatReceiptTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !booking.id) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setSending(true);
    try {
      const now = Date.now();
      await addDoc(collection(db, 'bookings', booking.id, 'messages'), {
        bookingId: booking.id,
        hotelId: booking.hotelId,
        managerId: booking.managerId,
        guestId: booking.guestId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || (isManager ? 'Host' : 'Guest'),
        text: newMessage.trim(),
        createdAt: now,
      });

      // Update presence
      const presenceDocRef = doc(db, 'bookings', booking.id, 'presence', 'chat_state');
      await updateDoc(presenceDocRef, {
        [isManager ? 'managerTyping' : 'guestTyping']: false,
        [isManager ? 'managerLastSeenAt' : 'guestLastSeenAt']: now
      }).catch(() => {});

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Find index of the last message sent by me
  const lastMyMessageIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === currentUser.uid) {
        return i;
      }
    }
    return -1;
  })();

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden min-h-[420px] max-h-[620px]">
      {/* Header Bar */}
      <div className="p-4 border-b border-stone-100 bg-stone-50/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-stone-200 flex items-center justify-center text-stone-700 shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span 
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-stone-50 transition-colors ${
                  otherInChat ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'
                }`}
              />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                Chat with {otherParticipantName}
              </h3>
              
              {/* Dynamic Status */}
              <div className="flex items-center gap-1 mt-0.5">
                {isOtherTyping ? (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    {otherParticipantName} is typing...
                  </span>
                ) : otherInChat ? (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Eye className="w-3 h-3 text-emerald-500 animate-pulse" />
                    In chat right now
                  </span>
                ) : otherLastOpenedAt ? (
                  <span className="text-[11px] text-stone-500">
                    Opened {formatReceiptTime(otherLastOpenedAt)}
                  </span>
                ) : (
                  <span className="text-[11px] text-stone-500">
                    Booking ref: {booking.reference || booking.id.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Active in chat banner */}
      {otherInChat && !isOtherTyping && (
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-3.5 py-1.5 flex items-center justify-between text-xs text-emerald-800 animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium">{otherParticipantName} has opened this chat</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-stone-50/30">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-stone-300 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 py-8">
            <MessageSquare className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-sm font-semibold text-stone-600">No messages yet</p>
            <p className="text-xs text-stone-400 mt-0.5">Send a message regarding this reservation.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.uid;
            const msgDate = new Date(msg.createdAt);
            const timeFormatted = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isLastMyMsg = index === lastMyMessageIndex;

            const isSeenByOther = Boolean(
              isMe && (
                (otherLastSeenAt && otherLastSeenAt >= msg.createdAt) ||
                (otherLastOpenedAt && otherLastOpenedAt >= msg.createdAt) ||
                otherInChat
              )
            );

            return (
              <div key={msg.id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fadeIn`}>
                <span className="text-[10px] text-stone-400 mb-1 px-1">{msg.senderName}</span>
                <div 
                  className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-2xs leading-relaxed ${
                    isMe 
                      ? 'bg-stone-900 text-white rounded-tr-xs' 
                      : 'bg-white border border-stone-200 text-stone-800 rounded-tl-xs'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Timestamp & Read receipts */}
                <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px]">
                  <span className="text-stone-400">
                    {timeFormatted}
                  </span>

                  {isMe && (
                    <div className="flex items-center gap-1 ml-1">
                      {isSeenByOther ? (
                        <span 
                          className="inline-flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.2 rounded-md"
                          title={`Opened by ${otherParticipantName}`}
                        >
                          <CheckCheck className="w-3 h-3 text-emerald-500" />
                          <span>Seen {isLastMyMsg && otherInChat ? '(Active)' : isLastMyMsg && otherLastSeenAt ? formatReceiptTime(otherLastSeenAt) : ''}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-stone-400" title="Delivered">
                          <Check className="w-3 h-3 text-stone-400" />
                          <span>Delivered</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Live Typing indicator bubble */}
        {isOtherTyping && (
          <div className="flex flex-col items-start animate-fadeIn pt-1">
            <span className="text-[10px] font-medium text-stone-400 mb-1 px-1">
              {otherParticipantName}
            </span>
            <div className="bg-white border border-stone-200 text-stone-700 px-3.5 py-2.5 rounded-2xl rounded-tl-xs shadow-2xs flex items-center gap-2">
              <span className="text-xs text-stone-600 font-medium">typing</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      
      {/* Input bar */}
      <div className="p-3 bg-white border-t border-stone-100">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="Type your message..."
            className="flex-1 bg-stone-100 border border-transparent focus:border-stone-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition outline-none"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-stone-900 text-white p-3 rounded-xl hover:bg-stone-800 disabled:opacity-50 transition shrink-0 cursor-pointer shadow-2xs flex items-center justify-center"
            title="Send message"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
