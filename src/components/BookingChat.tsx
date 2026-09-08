import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Message, User, ChatPresenceState, Hotel, RoomType, Call } from '../types';
import { 
  Send, Loader2, MessageSquare, Eye, Check, CheckCheck, 
  ShieldCheck, Ticket, CheckCircle2, Clock, Key, 
  Wallet, XCircle, ChevronDown, 
  Phone, Video, Minus, X, PhoneMissed, PhoneOff, Settings,
  Trash2, MoreVertical, Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import { chimeForIncoming, newChimeState } from '../lib/notificationSound';
import { formatDateStr, nightsBetween } from '../lib/dates';
import PriceDisplay from './PriceDisplay';
import StayVoucherModal from './StayVoucherModal';
import { useWebRTC } from '../lib/useWebRTC';
import { CallModal } from './CallModal';
import { getHotelDepositInfo, formatDepositSnippet, isCallingAllowed } from '../lib/depositInfo';
import { isAdmin } from '../lib/roles';
import { fastDeleteOrClearChat } from '../lib/chatDeletion';

interface Props {
  booking: Booking & { hotel?: Hotel; room?: RoomType };
  currentUser: User;
  onClose?: () => void;
  onMinimize?: () => void;
}

export default function BookingChat({ booking, currentUser, onClose, onMinimize }: Props) {
  const [liveBooking, setLiveBooking] = useState<Booking & { hotel?: Hotel; room?: RoomType }>(booking);
  const [hotel, setHotel] = useState<Hotel | null>(booking.hotel || null);
  const [room, setRoom] = useState<RoomType | null>(booking.room || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showDepositMenu, setShowDepositMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [isEndingChat, setIsEndingChat] = useState(false);
  const [presenceState, setPresenceState] = useState<ChatPresenceState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const depositMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const seenMessages = useRef(newChimeState());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const isChatEnded = (liveBooking as any).chatStatus === 'ended' || (liveBooking as any).chatStatus === 'closed';

  const isManager = currentUser.uid === liveBooking.managerId || (hotel && hotel.managerId === currentUser.uid);
  const otherParticipantName = isManager ? liveBooking.guestName : (hotel?.name || 'Host');

  // Callee / Caller details for WebRTC
  const calleeId = isManager ? liveBooking.guestId : (liveBooking.managerId || hotel?.managerId || '');
  const callerDisplayName = isManager ? (hotel?.name || 'Lodge Host') : (currentUser.displayName || liveBooking.guestName || 'Guest');

  // WebRTC Hook configured for 'bookings' collection
  const {
    activeCall,
    incomingCall,
    localVideoRef,
    remoteVideoRef,
    localStream,
    remoteStream,
    networkQuality,
    startCall,
    answerCall,
    rejectCall,
    endCall
  } = useWebRTC(liveBooking.id, currentUser.uid, callerDisplayName, 'bookings');

  // 1. Fetch and listen to live hotel status
  useEffect(() => {
    const hotelId = booking.hotelId || booking.hotel?.id;
    if (!hotelId) return;
    const unsub = onSnapshot(doc(db, 'hotels', hotelId), (snap) => {
      if (snap.exists()) {
        setHotel({ id: snap.id, ...snap.data() } as Hotel);
      }
    }, (err) => {
      console.warn('Error listening to hotel updates:', err);
    });
    return () => unsub();
  }, [booking.hotelId, booking.hotel?.id]);

  // 1b. Fetch room if not provided
  useEffect(() => {
    if (booking.room) {
      setRoom(booking.room);
    } else if (booking.roomTypeId) {
      getDoc(doc(db, 'room_types', booking.roomTypeId))
        .then(snap => {
          if (snap.exists()) setRoom({ id: snap.id, ...snap.data() } as RoomType);
        })
        .catch(err => console.warn('Error fetching room for chat:', err));
    }
  }, [booking.room, booking.roomTypeId]);

  // 2. Real-time listener on the booking document itself
  useEffect(() => {
    if (!booking.id) return;
    const unsub = onSnapshot(doc(db, 'bookings', booking.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Booking;
        setLiveBooking(prev => ({
          ...prev,
          ...data,
          id: snap.id,
        }));
      }
    }, (err) => {
      console.warn('Error listening to live booking updates:', err);
    });
    return () => unsub();
  }, [booking.id]);

  // 3. Listen to messages and presence in real-time
  useEffect(() => {
    if (!liveBooking.id) return;
    
    const presenceDocRef = doc(db, 'bookings', liveBooking.id, 'presence', 'chat_state');

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

    const unsubPresence = onSnapshot(presenceDocRef, (snap) => {
      if (snap.exists()) {
        setPresenceState(snap.data() as ChatPresenceState);
      }
    }, (err) => {
      console.warn('Error listening to booking chat presence:', err);
    });

    // Messages subscription
    const qMessages = query(
      collection(db, 'bookings', liveBooking.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);
      chimeForIncoming(msgs, currentUser?.uid, seenMessages);
      setLoading(false);

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

    // Calls subscription
    const qCalls = query(
      collection(db, 'bookings', liveBooking.id, 'calls'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeCalls = onSnapshot(qCalls, (snapshot) => {
      const cls = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Call[];
      setCalls(cls);
    }, (error) => {
      console.warn('Error listening to booking calls:', error);
    });
    
    return () => {
      unsubscribeMessages();
      unsubscribeCalls();
      unsubPresence();
      clearInterval(presenceInterval);

      updateDoc(presenceDocRef, {
        [isManager ? 'managerInChat' : 'guestInChat']: false,
        [isManager ? 'managerTyping' : 'guestTyping']: false
      }).catch(() => {});
    };
  }, [liveBooking.id, currentUser.uid, isManager]);

  // Close deposit & more dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (depositMenuRef.current && !depositMenuRef.current.contains(event.target as Node)) {
        setShowDepositMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    if (showDepositMenu || showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showDepositMenu, showMoreMenu]);

  // Handle typing state
  const setTypingState = useCallback(async (isTyping: boolean) => {
    if (!liveBooking.id) return;
    try {
      const presenceDocRef = doc(db, 'bookings', liveBooking.id, 'presence', 'chat_state');
      const field = isManager ? 'managerTyping' : 'guestTyping';
      const atField = isManager ? 'managerTypingAt' : 'guestTypingAt';
      await updateDoc(presenceDocRef, {
        [field]: isTyping,
        [atField]: isTyping ? Date.now() : 0
      });
    } catch {
      // ignore transient error
    }
  }, [liveBooking.id, isManager]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 40), 140);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewMessage(text);
    adjustTextareaHeight();

    if (!liveBooking.id) return;

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // Participant presence info
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

  // Calling permissions & state
  const callPerm = isCallingAllowed(hotel, currentUser);
  const isCallsEnabled = hotel ? (hotel.callsEnabled !== false && hotel.adminCallsEnabled !== false) : true;
  const canStartCall = isCallsEnabled || isManager || isAdmin(currentUser);

  // Toggle call functionality on or off for managers and admins
  const handleToggleCalls = async () => {
    const hotelId = hotel?.id || liveBooking.hotelId;
    if (!hotelId) return;
    const nextState = !isCallsEnabled;
    try {
      await updateDoc(doc(db, 'hotels', hotelId), { callsEnabled: nextState });
      toast.success(nextState ? 'Audio & video calls enabled for guests! 📞' : 'Calls disabled for guests. 🔕');
    } catch (e) {
      console.error('Error updating call settings:', e);
      toast.error('Failed to update call settings.');
    }
  };

  const handleStartCall = (video: boolean) => {
    if (!currentUser) return;
    if (!calleeId) {
      toast.error('Cannot initiate call. Guest details not found.');
      return;
    }
    if (!isCallsEnabled && !isManager && !isAdmin(currentUser)) {
      toast.error(callPerm.reason || 'Calls are currently disabled by the property.');
      return;
    }
    startCall(calleeId, video);
  };

  // --- ACTIONS: Approve & Issue Voucher ---
  const handleApproveAndIssueVoucher = async () => {
    if (!liveBooking.id) return;
    setActionLoading(true);
    try {
      const newPin = liveBooking.arrivalPin || Math.floor(1000 + Math.random() * 9000).toString();
      const now = Date.now();
      
      const patch = {
        status: 'confirmed' as const,
        arrivalPin: newPin,
        voucherIssued: true,
        updatedAt: now,
      };

      await updateDoc(doc(db, 'bookings', liveBooking.id), patch);
      setLiveBooking(prev => ({ ...prev, ...patch }));

      const voucherNoticeText = `🎉 Reservation Confirmed! Your Stay OS Digital Voucher has been issued.\n\n• Ref: ${liveBooking.reference || liveBooking.id.slice(0, 8)}\n• Dates: ${formatDateStr(liveBooking.checkIn)} – ${formatDateStr(liveBooking.checkOut)}\n• Room: ${room?.name || 'Selected Room'}\n• Balance Due: ${liveBooking.currency} ${liveBooking.total?.toLocaleString() ?? 0} (Payment on arrival)\n\nTap "View Digital Voucher" to access your verified booking pass, directions, and arrival PIN.`;

      await addDoc(collection(db, 'bookings', liveBooking.id, 'messages'), {
        bookingId: liveBooking.id,
        hotelId: liveBooking.hotelId,
        managerId: liveBooking.managerId,
        guestId: liveBooking.guestId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Host',
        text: voucherNoticeText,
        isVoucherNotice: true,
        createdAt: now,
      });

      await updateDoc(doc(db, 'bookings', liveBooking.id), {
        lastMessageAt: now,
        lastMessageText: '🎉 Booking Confirmed! Digital Voucher Issued.',
        lastMessageSenderId: currentUser.uid,
        lastMessageSenderName: currentUser.displayName || 'Host',
      }).catch(() => {});

      try {
        await fetch('/api/reminders/auto-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: liveBooking.id,
            bookingId: liveBooking.id,
            reference: liveBooking.reference,
            hotelId: liveBooking.hotelId,
            hotelName: hotel?.name || 'Your Property',
            guestName: liveBooking.guestName,
            guestPhone: liveBooking.guestPhone || '',
            guestWhatsapp: liveBooking.guestWhatsapp || liveBooking.guestPhone || '',
            guestEmail: liveBooking.guestEmail || '',
            checkIn: liveBooking.checkIn,
            checkOut: liveBooking.checkOut,
            roomName: room?.name,
            totalPrice: liveBooking.total ? `${liveBooking.total} ${liveBooking.currency || 'MWK'}` : undefined,
            automationSettings: hotel?.emailAutomationSettings,
            wifiName: hotel?.infrastructure?.wifiSSID,
            wifiPassword: hotel?.infrastructure?.wifiPassword,
            managerPhone: hotel?.contactPhone || hotel?.managerPhone,
            managerEmail: hotel?.contactEmail || hotel?.managerEmail,
          }),
        });
      } catch {
        // non-blocking
      }

      toast.success('Booking confirmed & Digital Voucher issued!');
    } catch (err) {
      console.error('Failed to confirm booking:', err);
      toast.error('Failed to approve booking.');
    } finally {
      setActionLoading(false);
    }
  };

  // --- ACTIONS: Insert Deposit Request Snippet with Real Lodge Details ---
  const handleInsertDepositSnippet = (type: 'mobile_money' | 'bank' | 'general') => {
    const depositInfo = getHotelDepositInfo(hotel);
    const dates = `${formatDateStr(liveBooking.checkIn)} to ${formatDateStr(liveBooking.checkOut)}`;
    const snippet = formatDepositSnippet(type, depositInfo, {
      guestName: liveBooking.guestName,
      dates,
      roomName: room?.name,
      totalAmount: liveBooking.total,
      currency: liveBooking.currency,
      reference: liveBooking.reference || liveBooking.id.slice(0, 8)
    });

    setNewMessage(snippet);
    setShowDepositMenu(false);
    toast.success('Deposit request template loaded! Details visible in the chat box.');

    setTimeout(() => {
      adjustTextareaHeight();
      textareaRef.current?.focus();
    }, 50);
  };

  // --- ACTIONS: Share Check-in Credentials (PIN & Wi-Fi) ---
  const handleShareCredentials = async () => {
    if (!liveBooking.id) return;
    setActionLoading(true);
    try {
      const now = Date.now();
      const pin = liveBooking.arrivalPin || 'Available on arrival';
      const wifiSSID = hotel?.infrastructure?.wifiSSID || 'Available at reception';
      const wifiPass = hotel?.infrastructure?.wifiPassword ? `\n• Wi-Fi Password: ${hotel.infrastructure.wifiPassword}` : '';
      
      const credText = `🔑 Check-in Credentials for ${hotel?.name || 'your stay'}:\n\n• Arrival PIN: ${pin}\n• Wi-Fi Network: ${wifiSSID}${wifiPass}\n• Check-in time: 14:00 onwards\n• Location: ${hotel?.location || 'See voucher for directions'}\n\nPresent your digital voucher at the front desk when you arrive. Safe travels!`;

      await addDoc(collection(db, 'bookings', liveBooking.id, 'messages'), {
        bookingId: liveBooking.id,
        hotelId: liveBooking.hotelId,
        managerId: liveBooking.managerId,
        guestId: liveBooking.guestId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Host',
        text: credText,
        isCredentialNotice: true,
        createdAt: now,
      });

      await updateDoc(doc(db, 'bookings', liveBooking.id), {
        lastMessageAt: now,
        lastMessageText: '🔑 Check-in Credentials sent.',
        lastMessageSenderId: currentUser.uid,
        lastMessageSenderName: currentUser.displayName || 'Host',
      }).catch(() => {});

      toast.success('Credentials shared with guest!');
    } catch (err) {
      console.error('Failed to share credentials:', err);
      toast.error('Failed to send credentials.');
    } finally {
      setActionLoading(false);
    }
  };

  // Send message handler
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !liveBooking.id) return;

    setSending(true);
    const textToSend = newMessage.trim();
    setNewMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

    try {
      const now = Date.now();
      await addDoc(collection(db, 'bookings', liveBooking.id, 'messages'), {
        bookingId: liveBooking.id,
        hotelId: liveBooking.hotelId,
        managerId: liveBooking.managerId,
        guestId: liveBooking.guestId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || (isManager ? 'Host' : 'Guest'),
        text: textToSend,
        createdAt: now,
      });

      await updateDoc(doc(db, 'bookings', liveBooking.id), {
        lastMessageAt: now,
        lastMessageText: textToSend,
        lastMessage: textToSend,
        lastMessageSenderId: currentUser.uid,
        lastMessageSenderName: currentUser.displayName || (isManager ? 'Host' : 'Guest'),
        chatStatus: 'active',
        chatClosedAt: null,
        chatClosedBy: null,
        chatClearedAt: null,
        chatClearedBy: null,
      }).catch(() => {});

      setTypingState(false);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message.');
      setNewMessage(textToSend);
      adjustTextareaHeight();
    } finally {
      setSending(false);
    }
  };

  // Close chat session
  const handleEndChat = async () => {
    if (!liveBooking.id || !currentUser || isEndingChat) return;
    setIsEndingChat(true);
    try {
      const now = Date.now();
      await updateDoc(doc(db, 'bookings', liveBooking.id), {
        chatStatus: 'closed',
        chatClosedAt: now,
        chatClosedBy: currentUser.uid,
      });
      setShowEndChatConfirm(false);
      toast.success('Chat closed and removed from active chats.');
    } catch (err) {
      console.error('Error closing booking chat:', err);
      toast.error('Failed to close chat session.');
    } finally {
      setIsEndingChat(false);
    }
  };

  // Reopen chat session
  const handleRestartChat = async () => {
    if (!liveBooking.id || !currentUser) return;
    try {
      await updateDoc(doc(db, 'bookings', liveBooking.id), {
        chatStatus: 'active',
        chatClosedAt: null,
        chatClosedBy: null,
        chatClearedAt: null,
        chatClearedBy: null,
      });
      toast.success('Conversation reopened.');
    } catch (err) {
      console.error('Error reopening chat:', err);
      toast.error('Failed to reopen conversation.');
    }
  };

  // Clear chat history for this booking
  const handleClearChatHistory = async () => {
    if (!liveBooking.id || !currentUser || isClearingChat) return;
    setIsClearingChat(true);
    try {
      // Optimistic state reset
      setMessages([]);
      setCalls([]);
      setShowClearConfirm(false);

      await fastDeleteOrClearChat({
        chatType: 'booking',
        id: liveBooking.id,
        userId: currentUser.uid,
        mode: 'clear'
      });

      toast.success('Chat history cleared successfully.');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error clearing booking chat history:', error);
      toast.error('Failed to clear chat history.');
    } finally {
      setIsClearingChat(false);
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

  const nights = nightsBetween(liveBooking.checkIn, liveBooking.checkOut);
  const depositInfo = getHotelDepositInfo(hotel);

  // Merge messages and calls sorted by createdAt
  const timelineItems = [
    ...messages.map(m => ({ type: 'message' as const, data: m, createdAt: m.createdAt, id: m.id || `${m.createdAt}` })),
    ...calls.map(c => ({ type: 'call' as const, data: c, createdAt: c.createdAt, id: c.id || `${c.createdAt}` }))
  ].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="flex flex-col h-full bg-stone-50 relative overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-2xl">
      
      {/* 1. Top Header Bar with Sleek Dark Finish & Call Controls */}
      <div className="px-3.5 py-2.5 bg-stone-900 text-white flex items-center justify-between gap-2 shrink-0 border-b border-stone-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center text-amber-300 font-bold text-xs shadow-xs ring-1 ring-stone-600">
              {(otherParticipantName || 'U').slice(0, 2).toUpperCase()}
            </div>
            <span 
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-stone-900 transition-colors ${
                otherInChat ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
              }`} 
              title={otherInChat ? 'Currently active in chat' : 'Away'}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-stone-100 text-xs sm:text-sm truncate">
                {otherParticipantName}
              </h3>
              {liveBooking.status === 'confirmed' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Confirmed
                </span>
              ) : liveBooking.status === 'pending' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-700 text-stone-300">
                  <XCircle className="w-3 h-3" /> {liveBooking.status}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-stone-400 truncate">
              {isOtherTyping ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  typing...
                </span>
              ) : otherInChat ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Eye className="w-3 h-3 text-emerald-400" /> In chat now
                </span>
              ) : otherLastOpenedAt ? (
                <span>Opened {formatReceiptTime(otherLastOpenedAt)}</span>
              ) : (
                <span>Ref: {liveBooking.reference || liveBooking.id.slice(0, 8)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Audio Call Button (Mobile & Desktop) */}
          {canStartCall && (
            <button
              type="button"
              onClick={() => handleStartCall(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title="Audio Call"
              aria-label="Audio Call"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {/* Desktop Only: Quick Video Call */}
          {canStartCall && (
            <button
              type="button"
              onClick={() => handleStartCall(true)}
              className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title="Video Call"
              aria-label="Video Call"
            >
              <Video className="w-4 h-4" />
            </button>
          )}

          {/* Desktop Only: Manager / Admin Quick Call Switch */}
          {(isManager || isAdmin(currentUser)) && (
            <button
              type="button"
              onClick={handleToggleCalls}
              className={`hidden sm:inline-flex p-1.5 rounded-lg text-xs font-semibold transition items-center gap-1 cursor-pointer ${
                isCallsEnabled
                  ? 'text-emerald-400 hover:bg-emerald-950/60 border border-emerald-500/30'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-700'
              }`}
              title={isCallsEnabled ? 'Calls enabled. Click to disable for this lodge.' : 'Calls disabled. Click to turn on.'}
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="text-[10px]">{isCallsEnabled ? 'Calls On' : 'Calls Off'}</span>
            </button>
          )}


          {/* More / Hamburger Menu (Mobile uses Menu icon, Desktop uses MoreVertical) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              id="btn-booking-chat-more"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                showMoreMenu ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white hover:bg-stone-800'
              }`}
              title="More options"
              aria-label="More options"
            >
              <Menu className="w-4 h-4 sm:hidden" />
              <MoreVertical className="w-4 h-4 hidden sm:block" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">

                {/* Mobile Only: Video call in menu */}
                {canStartCall && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleStartCall(true);
                    }}
                    className="sm:hidden w-full text-left px-3.5 py-2.5 text-stone-200 hover:bg-stone-800 flex items-center gap-2 cursor-pointer border-t border-stone-800/80"
                  >
                    <Video className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Start Video Call</span>
                  </button>
                )}

                {/* Manager / Admin Quick Call Switch */}
                {(isManager || isAdmin(currentUser)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleToggleCalls();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-stone-200 hover:bg-stone-800 flex items-center justify-between gap-2 cursor-pointer border-t border-stone-800/80 sm:border-0"
                  >
                    <span className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span>Allow Guest Calls</span>
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isCallsEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-stone-800 text-stone-400 border border-stone-700'
                    }`}>
                      {isCallsEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                )}

                {/* Mobile Only: Minimize chat */}
                {onMinimize && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onMinimize();
                    }}
                    className="sm:hidden w-full text-left px-3.5 py-2.5 text-stone-300 hover:bg-stone-800 flex items-center gap-2 cursor-pointer border-t border-stone-800/80"
                  >
                    <Minus className="w-3.5 h-3.5 text-stone-400" />
                    <span>Minimize Chat</span>
                  </button>
                )}

                {/* End / Close Chat Session */}
                {!isChatEnded && (
                  <button
                    type="button"
                    id="btn-end-booking-chat"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowEndChatConfirm(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-stone-200 hover:bg-stone-800 flex items-center gap-2 cursor-pointer border-t border-stone-800/80"
                  >
                    <PhoneOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>End Chat Session</span>
                  </button>
                )}

                {/* Reopen Chat if ended */}
                {isChatEnded && (
                  <button
                    type="button"
                    id="btn-reopen-booking-chat"
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleRestartChat();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-emerald-400 hover:bg-stone-800 flex items-center gap-2 cursor-pointer border-t border-stone-800/80"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Reopen Chat</span>
                  </button>
                )}

                {/* Clear Chat History */}
                <button
                  type="button"
                  id="btn-clear-booking-chat-history"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowClearConfirm(true);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-rose-400 hover:bg-stone-800 flex items-center gap-2 cursor-pointer border-t border-stone-800/80"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear Chat History</span>
                </button>
              </div>
            )}
          </div>

          {/* Desktop Only: Minimize button */}
          {onMinimize && (
            <button 
              type="button" 
              onClick={onMinimize}
              className="hidden sm:flex p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition cursor-pointer"
              title="Minimize chat"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}

          {/* Close control */}
          {onClose && (
            <button 
              type="button" 
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition cursor-pointer"
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Closed Chat Notice Banner */}
      {isChatEnded && (
        <div className="bg-stone-900 text-stone-200 text-xs px-4 py-2.5 flex items-center justify-between gap-2 shrink-0 border-b border-stone-800 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <PhoneOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate text-stone-300">This chat is closed. Send a message or reopen to continue.</span>
          </div>
          <button
            type="button"
            onClick={handleRestartChat}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-emerald-400 font-bold rounded-lg transition shrink-0 cursor-pointer"
          >
            Reopen Chat
          </button>
        </div>
      )}

      {/* 2. Interactive Booking Action Bar */}
      <div className="bg-stone-100/95 border-b border-stone-200/90 px-3.5 py-2 text-xs text-stone-700 relative z-30 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Stay Quick Summary */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-stone-900">
              {formatDateStr(liveBooking.checkIn)} – {formatDateStr(liveBooking.checkOut)}
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-stone-600 font-medium">
              {nights} night{nights === 1 ? '' : 's'}
            </span>
            <span className="text-stone-300">·</span>
            <PriceDisplay amount={liveBooking.total ?? 0} currency={liveBooking.currency} className="font-bold text-stone-900" />
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {liveBooking.status === 'confirmed' ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs transition text-xs cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5" /> View Voucher
                </button>

                {isManager && (
                  <button
                    type="button"
                    onClick={handleShareCredentials}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-medium rounded-lg shadow-2xs transition text-xs cursor-pointer disabled:opacity-50"
                    title="Send Arrival PIN & Wi-Fi into chat"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-500" /> Share PIN &amp; Wi-Fi
                  </button>
                )}
              </>
            ) : liveBooking.status === 'pending' && isManager ? (
              <>
                {/* Request Deposit Dropdown - Fixed positioning so never cut off */}
                <div className="relative" ref={depositMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowDepositMenu(!showDepositMenu)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-semibold rounded-lg shadow-2xs transition text-xs cursor-pointer select-none"
                    aria-expanded={showDepositMenu}
                  >
                    <Wallet className="w-3.5 h-3.5 text-amber-600" /> Request Deposit
                    <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform duration-200 ${showDepositMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu - Left aligned on mobile, right aligned on desktop with max-width safeguard */}
                  {showDepositMenu && (
                    <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2.5rem)] bg-white border border-stone-200 rounded-2xl shadow-xl p-2 z-50 animate-fadeIn space-y-1">
                      <div className="px-2.5 py-1.5 border-b border-stone-100 flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-stone-400">
                          Deposit Instructions
                        </span>
                        {depositInfo.depositPercentage && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {depositInfo.depositPercentage}% Policy
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInsertDepositSnippet('mobile_money')}
                        className="w-full text-left p-2 rounded-xl hover:bg-stone-50 text-stone-800 transition flex items-start gap-2.5 cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-100 font-bold text-xs">
                          📱
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-stone-900">Airtel Money &amp; Mpamba</p>
                          <p className="text-[11px] text-stone-500 truncate">
                            {depositInfo.airtelMoneyNumber || 'Airtel'} • {depositInfo.mpambaNumber || 'Mpamba'}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInsertDepositSnippet('bank')}
                        className="w-full text-left p-2 rounded-xl hover:bg-stone-50 text-stone-800 transition flex items-start gap-2.5 cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-100 font-bold text-xs">
                          🏦
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-stone-900">Bank Wire Transfer</p>
                          <p className="text-[11px] text-stone-500 truncate">
                            {depositInfo.bankName || 'Direct bank transfer'}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInsertDepositSnippet('general')}
                        className="w-full text-left p-2 rounded-xl hover:bg-stone-50 text-stone-800 transition flex items-start gap-2.5 cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-100 font-bold text-xs">
                          💬
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-stone-900">General Payment Inquiry</p>
                          <p className="text-[11px] text-stone-500 truncate">Ask preference &amp; share terms</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleApproveAndIssueVoucher}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-lg shadow-2xs transition text-xs cursor-pointer disabled:opacity-50"
                  title="Accept reservation and generate voucher"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                  Confirm Booking
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 3. Messages & Calls Scroll Area */}
      <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 bg-stone-50/40">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-stone-300 animate-spin" />
          </div>
        ) : timelineItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 py-8">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-stone-700">No messages yet</p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs text-center">
              Chat directly regarding dates, mobile money deposits, directions, and arrival arrangements.
            </p>
          </div>
        ) : (
          timelineItems.map((item) => {
            if (item.type === 'call') {
              const call = item.data;
              const isMe = call.callerId === currentUser.uid;
              const isVideo = call.type === 'video';
              const isMissed = call.status === 'rejected' || (call.status === 'ringing' && !call.connectedAt);
              const callDate = new Date(call.createdAt);
              const timeFormatted = callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              let CallIcon = Phone;
              let iconColor = 'text-stone-600';
              if (isMissed) {
                CallIcon = PhoneMissed;
                iconColor = 'text-red-500';
              } else if (isVideo) {
                CallIcon = Video;
                iconColor = 'text-blue-600';
              } else {
                CallIcon = Phone;
                iconColor = 'text-emerald-600';
              }

              let durationText = '';
              if (call.status === 'connected' || call.status === 'ended') {
                if (call.connectedAt && call.endedAt) {
                  const seconds = Math.floor((call.endedAt - call.connectedAt) / 1000);
                  if (seconds < 60) durationText = `${seconds}s`;
                  else durationText = `${Math.floor(seconds/60)}m ${seconds % 60}s`;
                } else if (call.status === 'connected') {
                  durationText = 'Ongoing...';
                }
              }

              return (
                <div key={`call-${item.id}`} className="flex justify-center my-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-stone-100/90 rounded-full border border-stone-200/80 shadow-2xs text-xs">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-2xs border border-stone-100 ${iconColor}`}>
                      <CallIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-stone-700 text-xs leading-tight">
                        {isMissed ? (isMe ? 'Unanswered Call' : 'Missed Call') : (isVideo ? 'Video Call' : 'Voice Call')}
                      </span>
                      <span className="text-[10px] text-stone-400 font-medium">
                        {timeFormatted} {durationText && <span className="text-stone-500 font-semibold">• {durationText}</span>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            const msg = item.data;
            const isMe = msg.senderId === currentUser.uid;
            const msgDate = new Date(msg.createdAt);
            const timeFormatted = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isLastMyMsg = messages.findIndex(m => m.id === msg.id) === lastMyMessageIndex;

            const isSeenByOther = Boolean(
              isMe && (
                (otherLastSeenAt && otherLastSeenAt >= msg.createdAt) ||
                (otherLastOpenedAt && otherLastOpenedAt >= msg.createdAt) ||
                otherInChat
              )
            );

            // Special Interactive Cards
            const isVoucherMessage = (msg as any).isVoucherNotice || msg.text?.includes('Stay OS Digital Voucher');
            const isCredentialMessage = (msg as any).isCredentialNotice || msg.text?.includes('Arrival PIN:');

            return (
              <div key={`msg-${item.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fadeIn`}>
                <span className="text-[10px] text-stone-400 mb-1 px-1">{msg.senderName}</span>
                
                {isVoucherMessage ? (
                  <div className="bg-emerald-950 text-white rounded-2xl p-4 max-w-[90%] sm:max-w-md shadow-md border border-emerald-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <span className="font-serif font-bold text-sm tracking-wide text-white">
                          Stay OS Digital Voucher
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded">
                        REF: {liveBooking.reference || liveBooking.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-white text-sm">{hotel?.name || 'Confirmed Stay'}</p>
                      <p className="text-emerald-200">
                        {formatDateStr(liveBooking.checkIn)} – {formatDateStr(liveBooking.checkOut)} · {room?.name || 'Selected Room'}
                      </p>
                      <p className="text-[11px] text-emerald-300">
                        Balance due on arrival: {liveBooking.currency} {liveBooking.total?.toLocaleString() ?? 0}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowVoucherModal(true)}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Ticket className="w-4 h-4" /> Open Digital Voucher
                    </button>
                  </div>
                ) : isCredentialMessage ? (
                  <div className="bg-amber-950 text-white rounded-2xl p-4 max-w-[90%] sm:max-w-md shadow-md border border-amber-800 space-y-2.5">
                    <div className="flex items-center gap-2 border-b border-amber-800/80 pb-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span className="font-serif font-bold text-xs tracking-wide text-amber-200">
                        Arrival Credentials &amp; Access
                      </span>
                    </div>
                    <p className="text-xs text-amber-100 whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                    {liveBooking.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => setShowVoucherModal(true)}
                        className="w-full mt-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Ticket className="w-3.5 h-3.5" /> Unlock in Voucher
                      </button>
                    )}
                  </div>
                ) : (
                  <div 
                    className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-2xs leading-relaxed whitespace-pre-wrap ${
                      isMe 
                        ? 'bg-stone-900 text-white rounded-tr-xs' 
                        : 'bg-white border border-stone-200 text-stone-800 rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                )}

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

        {/* Live Typing indicator */}
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
      
      {/* 4. Chat Input Bar with Auto-expanding Textarea - Displays ALL text within the box */}
      <div className="p-3 bg-white border-t border-stone-100 shrink-0">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleInputBlur}
            placeholder={
              isManager 
                ? "Reply to guest or send deposit details... (Enter to send, Shift+Enter for newline)" 
                : "Ask about payment, transport, or arrival..."
            }
            className="flex-1 max-h-[140px] min-h-[42px] bg-stone-100 border border-transparent focus:border-stone-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition outline-none resize-none leading-relaxed overflow-y-auto scrollbar-slim"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-stone-900 text-white p-2.5 rounded-xl hover:bg-stone-800 disabled:opacity-50 transition shrink-0 cursor-pointer shadow-2xs flex items-center justify-center mb-0.5"
            title="Send message (Enter)"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* 5. Stay Voucher Modal Integration */}
      {showVoucherModal && (
        <StayVoucherModal
          booking={{
            ...liveBooking,
            hotel: hotel || undefined,
            room: room || undefined,
          }}
          isOpen={showVoucherModal}
          onClose={() => setShowVoucherModal(false)}
        />
      )}

      {/* 6. WebRTC Call Modal Integration */}
      <CallModal
        activeCall={activeCall}
        incomingCall={incomingCall}
        localVideoRef={localVideoRef as React.RefObject<HTMLVideoElement>}
        remoteVideoRef={remoteVideoRef as React.RefObject<HTMLVideoElement>}
        onAnswer={answerCall}
        onReject={rejectCall}
        onEndCall={endCall}
        localStream={localStream}
        remoteStream={remoteStream}
        networkQuality={networkQuality}
      />

      {/* Confirm End Chat Session Dialog */}
      <ConfirmDialog
        isOpen={showEndChatConfirm}
        title="End Chat Session"
        message="Are you sure you want to end and close this chat session? This will remove the conversation from active chats. You can reopen it anytime."
        confirmText="End & Close"
        cancelText="Cancel"
        isDestructive={false}
        onConfirm={handleEndChat}
        onCancel={() => setShowEndChatConfirm(false)}
      />

      {/* Confirm Clear Chat History Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Chat History"
        message="Are you sure you want to permanently clear this chat history? All messages and call records for this reservation will be removed."
        confirmText="Clear History"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleClearChatHistory}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
