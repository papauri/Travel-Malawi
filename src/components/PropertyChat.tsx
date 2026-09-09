import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useManagerPresence } from '../hooks/usePresence';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, Message, User, HotelChat, Call } from '../types';
import { fastDeleteOrClearChat } from '../lib/chatDeletion';
import { 
  Send, 
  Loader2, 
  X, 
  MessageSquare, 
  AlertCircle, 
  PhoneOff, 
  Trash2, 
  Minus, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle2, 
  Clock,
  Eye,
  Check,
  CheckCheck,
  Phone,
  Video,
  PhoneMissed,
  Wallet,
  ChevronDown,
  MoreVertical,
  Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import { chimeForIncoming, newChimeState } from '../lib/notificationSound';
import ConfirmDialog from './ConfirmDialog';
import { useWebRTC } from '../lib/useWebRTC';
import { CallModal } from './CallModal';
import { getHotelDepositInfo, formatDepositSnippet } from '../lib/depositInfo';
import { isAdmin } from '../lib/roles';

interface Props {
  hotel: Hotel;
  currentUser: User | null;
  onClose: () => void;
  onMinimize?: () => void;
  guestId?: string; // If provided (by manager), use this to compute chat ID instead of currentUser.uid
  guestName?: string; // If provided (by manager), use this for display name
}

export default function PropertyChat({ 
  hotel, 
  currentUser, 
  onClose, 
  onMinimize, 
  guestId, 
  guestName 
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatDocData, setChatDocData] = useState<HotelChat | null>(null);
  
  // Real-time live hotel status so online/offline updates instantly on guest screen
  const [liveHotel, setLiveHotel] = useState<Hotel>(hotel);
  const managerPresence = useManagerPresence(hotel.managerId);
  const hostIsOnline = managerPresence?.status === 'online';

  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDepositMenu, setShowDepositMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isEndingChat, setIsEndingChat] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const depositMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const seenMessages = useRef(newChimeState());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const [chatId, setChatId] = useState<string | null>(null);

  const activeGuestId = guestId || currentUser?.uid;
  const activeGuestName = guestName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Guest';
  const isManager = guestId !== undefined || (currentUser && liveHotel.managerId === currentUser.uid);
  const effectiveManagerId = liveHotel.managerId || (isManager ? (currentUser?.uid || '') : '') || '';
  const otherParticipantName = isManager ? activeGuestName : (liveHotel.name || 'Host');

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
  } = useWebRTC(chatId || '', currentUser?.uid || '', isManager ? (liveHotel.name || 'Manager') : activeGuestName);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 40), 320);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleStartCall = (video: boolean) => {
    if (!currentUser) return;
    const calleeId = isManager ? activeGuestId : effectiveManagerId;
    if (!calleeId) {
      toast.error('Cannot initiate call. Participant details not found.');
      return;
    }
    startCall(calleeId, video);
  };

  // Toggle call functionality on or off for managers and admins
  const handleToggleCalls = async () => {
    if (!liveHotel.id) return;
    const isCurrentlyEnabled = liveHotel.callsEnabled !== false && liveHotel.adminCallsEnabled !== false;
    const nextState = !isCurrentlyEnabled;
    try {
      await updateDoc(doc(db, 'hotels', liveHotel.id), { callsEnabled: nextState });
      toast.success(nextState ? 'Audio & video calls enabled for guests! 📞' : 'Calls disabled for guests. 🔕');
    } catch (e) {
      console.error('Error updating call settings:', e);
      toast.error('Failed to update call settings.');
    }
  };

  // Insert deposit instructions template with real lodge details
  const handleInsertDepositSnippet = (type: 'mobile_money' | 'bank' | 'general') => {
    const depositInfo = getHotelDepositInfo(liveHotel);
    const snippet = formatDepositSnippet(type, depositInfo, {
      guestName: activeGuestName,
      roomName: 'your stay'
    });

    setNewMessage(snippet);
    setShowDepositMenu(false);
    toast.success('Deposit request template loaded! Details visible in the chat box.');

    setTimeout(() => {
      adjustTextareaHeight();
      textareaRef.current?.focus();
    }, 50);
  };

  // Close deposit menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (depositMenuRef.current && !depositMenuRef.current.contains(event.target as Node)) {
        setShowDepositMenu(false);
      }
    }
    if (showDepositMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showDepositMenu]);

  // Close more options menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMoreMenu]);

  // 1. Listen in real-time to the Hotel doc for live online/offline status & out of office message
  useEffect(() => {
    if (!hotel.id) return;
    const unsubHotel = onSnapshot(doc(db, 'hotels', hotel.id), (docSnap) => {
      if (docSnap.exists()) {
        setLiveHotel({ id: docSnap.id, ...docSnap.data() } as Hotel);
      }
    }, (err) => {
      console.warn('Could not listen to hotel status changes:', err);
    });

    return () => unsubHotel();
  }, [hotel.id]);

  // 2. Ensure Chat Doc and Listen to Chat Metadata & Messages in real-time
  useEffect(() => {
    if (!currentUser || !hotel.id || !activeGuestId) {
      setLoading(false);
      return;
    }
    
    const computedChatId = `${hotel.id}_${activeGuestId}`;
    setChatId(computedChatId);

    // Ensure base chat doc exists & mark current user as inChat + opened/seen
    const ensureChatDocAndSetPresence = async () => {
      try {
        const chatRef = doc(db, 'hotel_chats', computedChatId);
        const chatDocSnap = await getDoc(chatRef);
        const now = Date.now();

        const presenceUpdate = isManager
          ? {
              managerInChat: true,
              managerLastOpenedAt: now,
              managerLastSeenAt: now,
              managerTyping: false
            }
          : {
              guestInChat: true,
              guestLastOpenedAt: now,
              guestLastSeenAt: now,
              guestTyping: false
            };

        if (!chatDocSnap.exists()) {
          const initialData: HotelChat = {
            hotelId: hotel.id!,
            hotelName: liveHotel.name || hotel.name,
            guestId: activeGuestId,
            managerId: effectiveManagerId,
            guestName: activeGuestName,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            ...presenceUpdate
          };
          await setDoc(chatRef, initialData);
        } else {
          await updateDoc(chatRef, presenceUpdate);
        }
      } catch (err) {
        console.error('Error ensuring chat doc / updating presence:', err);
      }
    };
    ensureChatDocAndSetPresence();

    const presenceInterval = setInterval(() => {
      if (computedChatId) {
        const chatRef = doc(db, 'hotel_chats', computedChatId);
        updateDoc(chatRef, {
          [isManager ? 'managerInChat' : 'guestInChat']: true,
          [isManager ? 'managerLastSeenAt' : 'guestLastSeenAt']: Date.now()
        }).catch(() => {});
      }
    }, 10000);

    // Listen to chat metadata changes (e.g. status, typing, presence, seenAt)
    const unsubChatDoc = onSnapshot(doc(db, 'hotel_chats', computedChatId), (docSnap) => {
      if (docSnap.exists()) {
        setChatDocData({ id: docSnap.id, ...docSnap.data() } as HotelChat);
      } else {
        setChatDocData(null);
      }
    }, (err) => {
      console.warn('Error listening to chat metadata:', err);
    });

    // Listen to messages subcollection
    const q = query(
      collection(db, 'hotel_chats', computedChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);
      chimeForIncoming(msgs, currentUser?.uid, seenMessages);
      setLoading(false);

      // If new messages arrived while we have the chat open, update our lastSeenAt
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== currentUser.uid) {
          const now = Date.now();
          updateDoc(doc(db, 'hotel_chats', computedChatId), {
            [isManager ? 'managerLastSeenAt' : 'guestLastSeenAt']: now,
            [isManager ? 'managerLastOpenedAt' : 'guestLastOpenedAt']: now
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

    const callsQuery = query(
      collection(db, 'hotel_chats', computedChatId, 'calls'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubCalls = onSnapshot(callsQuery, (snapshot) => {
      const cls = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Call[];
      setCalls(cls);
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.warn('Error fetching calls:', error);
    });
    
    // Cleanup presence & typing when closing / unmounting chat
    return () => {
      unsubChatDoc();
      unsubMessages();
      unsubCalls();
      clearInterval(presenceInterval);

      if (computedChatId) {
        updateDoc(doc(db, 'hotel_chats', computedChatId), {
          [isManager ? 'managerInChat' : 'guestInChat']: false,
          [isManager ? 'managerTyping' : 'guestTyping']: false
        }).catch(() => {});
      }
    };
  }, [hotel.id, liveHotel.name, hotel.name, currentUser, activeGuestId, activeGuestName, effectiveManagerId, isManager]);

  // Handle typing state updates
  const setTypingState = useCallback(async (isTyping: boolean) => {
    if (!chatId || !currentUser) return;
    try {
      const field = isManager ? 'managerTyping' : 'guestTyping';
      const atField = isManager ? 'managerTypingAt' : 'guestTypingAt';
      await updateDoc(doc(db, 'hotel_chats', chatId), {
        [field]: isTyping,
        [atField]: isTyping ? Date.now() : 0
      });
    } catch (e) {
      // ignore transient network/permission errors
    }
  }, [chatId, currentUser, isManager]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewMessage(text);
    adjustTextareaHeight();

    if (!chatId || !currentUser) return;

    if (text.trim().length > 0) {
      const now = Date.now();
      // Throttle typing updates so we don't spam Firestore on every single keypress
      if (now - lastTypingSentRef.current > 2000) {
        lastTypingSentRef.current = now;
        setTypingState(true);
      }

      // Reset debounce timer
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleInputBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingState(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '';
    }
  };

  // Determine if the other participant is typing
  const otherIsTypingRaw = isManager ? chatDocData?.guestTyping : chatDocData?.managerTyping;
  const otherTypingAt = isManager ? (chatDocData?.guestTypingAt || 0) : (chatDocData?.managerTypingAt || 0);
  const isOtherTyping = Boolean(otherIsTypingRaw && (Date.now() - otherTypingAt < 5000));

  // Determine if other participant has opened / is active in the chat
  const otherLastOpenedAt = isManager ? chatDocData?.guestLastOpenedAt : chatDocData?.managerLastOpenedAt;
  const otherLastSeenAt = isManager ? chatDocData?.guestLastSeenAt : chatDocData?.managerLastSeenAt;
  const otherInChatRaw = isManager ? chatDocData?.guestInChat : chatDocData?.managerInChat;
  const otherInChat = Boolean(otherInChatRaw && (Date.now() - (otherLastSeenAt || 0) < 20000));

  // Format readable time for opened/seen receipts
  const formatReceiptTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return timeStr;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  // Is the chat session currently ended or closed?
  const isChatEnded = chatDocData?.status === 'ended' || chatDocData?.status === 'closed';

  // Handle Ending/Closing the Chat (by Manager or Guest)
  const handleEndChat = async () => {
    if (!chatId || !currentUser || isEndingChat) return;
    setIsEndingChat(true);
    try {
      const senderDisplayName = isManager 
        ? liveHotel.name 
        : (currentUser.displayName || currentUser.email?.split('@')[0] || 'Guest');

      const endTimestamp = Date.now();

      await updateDoc(doc(db, 'hotel_chats', chatId), {
        status: 'closed',
        closedAt: endTimestamp,
        closedBy: currentUser.uid,
        closedByName: senderDisplayName,
        endedAt: endTimestamp,
        endedBy: isManager ? 'manager' : 'guest',
        endedByName: senderDisplayName,
        updatedAt: endTimestamp,
        [isManager ? 'managerTyping' : 'guestTyping']: false,
      });

      setShowEndChatConfirm(false);
      toast.success('Chat conversation closed and removed from active chats.');
    } catch (error: any) {
      console.error('Error ending chat:', error);
      toast.error('Failed to end chat session.');
    } finally {
      setIsEndingChat(false);
    }
  };

  // Handle Restarting a New Chat Session after it was ended
  const handleRestartChat = async () => {
    if (!chatId || !currentUser) return;
    try {
      await updateDoc(doc(db, 'hotel_chats', chatId), {
        status: 'active',
        endedAt: null,
        endedBy: null,
        endedByName: null,
        closedAt: null,
        closedBy: null,
        closedByName: null,
        clearedAt: null,
        clearedBy: null,
        updatedAt: Date.now(),
      });
      toast.success('Started a new conversation session!');
    } catch (error) {
      console.error('Error restarting chat:', error);
      toast.error('Failed to restart conversation.');
    }
  };

  // Handle Clearing/Deleting Chat History (Both Guest & Manager action)
  const handleDeleteChatHistory = async () => {
    if (!chatId || !currentUser || isDeletingChat) return;
    setIsDeletingChat(true);
    try {
      // Optimistic UI state reset
      setMessages([]);
      setCalls([]);
      setShowDeleteConfirm(false);

      await fastDeleteOrClearChat({
        chatType: 'inquiry',
        id: chatId,
        userId: currentUser.uid,
        mode: 'clear'
      });

      toast.success('Chat history cleared successfully.');
      onClose();
    } catch (error) {
      console.error('Error clearing chat history:', error);
      toast.error('Failed to clear chat history.');
    } finally {
      setIsDeletingChat(false);
    }
  };

  // Handle Sending a Message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !currentUser || !hotel.id || !activeGuestId) return;
    
    const textToSend = newMessage.trim();
    const senderDisplayName = isManager 
      ? liveHotel.name 
      : (currentUser.displayName || currentUser.email?.split('@')[0] || 'Guest');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setSending(true);
    try {
      // If chat was ended, sending a new message automatically reactivates the session!
      const isReactivating = isChatEnded;
      const now = Date.now();

      await addDoc(collection(db, 'hotel_chats', chatId, 'messages'), {
        chatId: chatId,
        hotelId: hotel.id,
        managerId: effectiveManagerId,
        guestId: activeGuestId,
        senderId: currentUser.uid,
        senderName: senderDisplayName,
        text: textToSend,
        createdAt: now,
      });
      
      // Update the chat doc's updatedAt & preview metadata for notification listeners
      await setDoc(doc(db, 'hotel_chats', chatId), {
        hotelId: hotel.id,
        hotelName: liveHotel.name || hotel.name,
        guestId: activeGuestId,
        managerId: effectiveManagerId,
        guestName: activeGuestName,
        lastMessage: textToSend,
        lastSenderId: currentUser.uid,
        lastSenderName: senderDisplayName,
        status: 'active',
        endedAt: isReactivating ? null : (chatDocData?.endedAt || null),
        endedBy: isReactivating ? null : (chatDocData?.endedBy || null),
        endedByName: isReactivating ? null : (chatDocData?.endedByName || null),
        [isManager ? 'managerTyping' : 'guestTyping']: false,
        [isManager ? 'managerLastSeenAt' : 'guestLastSeenAt']: now,
        [isManager ? 'managerLastOpenedAt' : 'guestLastOpenedAt']: now,
        updatedAt: now
      }, { merge: true });
      
      // Trigger offline notification if sending to offline manager
      if (!isManager && !liveHotel.isOnline && liveHotel.managerEmail) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: liveHotel.managerEmail,
            subject: `New message from ${senderDisplayName}`,
            message: `You have a new message on Stay OS from ${senderDisplayName} regarding ${liveHotel.name}:\n\n"${textToSend}"\n\nPlease log in to reply.`
          })
        }).catch(err => console.error('Failed to trigger offline notification', err));
      }
      setNewMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '';
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Format timestamp for ended banner
  const endedDateStr = chatDocData?.endedAt 
    ? new Date(chatDocData.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    : '';

  type TimelineItem = 
    | { type: 'message'; data: Message; id: string; createdAt: number }
    | { type: 'call'; data: Call; id: string; createdAt: number };

  const timelineItems: TimelineItem[] = [
    ...messages.map(m => ({ type: 'message' as const, data: m, id: m.id || String(m.createdAt), createdAt: m.createdAt })),
    ...calls.map(c => ({ type: 'call' as const, data: c, id: c.id || String(c.createdAt), createdAt: c.createdAt }))
  ].sort((a, b) => a.createdAt - b.createdAt);

  // Find index of the last message sent by me
  const lastMyMessageIndex = (() => {
    if (!currentUser) return -1;
    for (let i = timelineItems.length - 1; i >= 0; i--) {
      if (timelineItems[i].type === 'message' && (timelineItems[i].data as Message).senderId === currentUser.uid) {
        return i;
      }
    }
    return -1;
  })();

  return (
    <div className="flex flex-col h-full bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-stone-200">
      {/* Header Bar */}
      <div className="p-3.5 pt-[max(14px,env(safe-area-inset-top))] sm:p-4 bg-stone-900 text-white flex justify-between items-center gap-2 select-none border-b border-stone-800">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-stone-800 flex items-center justify-center text-emerald-400 shrink-0 shadow-2xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              {/* Presence dot on avatar */}
              <span 
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-stone-900 transition-colors ${
                  otherInChat
                    ? 'bg-emerald-400 animate-pulse'
                    : hostIsOnline
                    ? 'bg-emerald-500'
                    : 'bg-stone-500'
                }`}
              />
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate leading-tight">
                {isManager ? `Chat with ${activeGuestName}` : `Chat with ${liveHotel.name}`}
              </h3>
              
              {/* Dynamic Status: Typing / In Chat Now / Opened at / Online / Offline */}
              <div className="flex items-center gap-1.5 mt-0.5">
                {isOtherTyping ? (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-300 font-medium animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{otherParticipantName} is typing...</span>
                  </div>
                ) : otherInChat ? (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-300 font-medium">
                    <Eye className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Viewing chat right now</span>
                  </div>
                ) : otherLastOpenedAt ? (
                  <div className="flex items-center gap-1 text-[11px] text-stone-300">
                    <span className="text-stone-400">Opened by {otherParticipantName}:</span>
                    <span className="font-medium text-stone-200">{formatReceiptTime(otherLastOpenedAt)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-stone-300">
                    <span 
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        hostIsOnline ? 'bg-emerald-400' : 'bg-stone-500'
                      }`} 
                    />
                    <span className="text-stone-300 truncate">
                      {hostIsOnline ? 'Host Online' : 'Host Away'}
                    </span>
                  </div>
                )}

                {isChatEnded && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-stone-800 text-stone-300 px-1.5 py-0.2 rounded-md ml-1">
                    Ended
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Call Button (Mobile & Desktop) */}
          {!isChatEnded && currentUser && (
            (liveHotel.callsEnabled !== false && liveHotel.adminCallsEnabled !== false) || isManager || isAdmin(currentUser)
          ) && (
            <button
              type="button"
              onClick={() => handleStartCall(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Audio Call"
              aria-label="Audio Call"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {/* Desktop Only: Direct Video Call Button */}
          {!isChatEnded && currentUser && (
            (liveHotel.callsEnabled !== false && liveHotel.adminCallsEnabled !== false) || isManager || isAdmin(currentUser)
          ) && (
            <button
              type="button"
              onClick={() => handleStartCall(true)}
              className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Video Call"
              aria-label="Video Call"
            >
              <Video className="w-4 h-4" />
            </button>
          )}

          {/* More / Hamburger Options Menu (Mobile uses Menu icon, Desktop uses MoreVertical) */}
          {currentUser && (!isChatEnded || isManager || isAdmin(currentUser)) && (
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                id="btn-property-chat-menu"
                onClick={() => setShowMoreMenu(v => !v)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  showMoreMenu ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white hover:bg-stone-800'
                }`}
                title="Chat options"
                aria-label="Chat options"
              >
                {/* Hamburger on mobile, MoreVertical on desktop */}
                <Menu className="w-4 h-4 sm:hidden" />
                <MoreVertical className="w-4 h-4 hidden sm:block" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 mt-1.5 w-52 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                  {/* Mobile Only: Video Call in Menu */}
                  {!isChatEnded && (
                    (liveHotel.callsEnabled !== false && liveHotel.adminCallsEnabled !== false) || isManager || isAdmin(currentUser)
                  ) && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleStartCall(true);
                      }}
                      className="sm:hidden w-full text-left px-3.5 py-2.5 text-stone-200 hover:bg-stone-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Start Video Call</span>
                    </button>
                  )}

                  {/* Manager / Admin Call Functionality Toggle */}
                  {(isManager || isAdmin(currentUser)) && liveHotel.id && (
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleCalls();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-stone-200 hover:bg-stone-800 flex items-center justify-between gap-2 cursor-pointer border-t border-stone-800/80 sm:border-0"
                    >
                      <span className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        <span>Allow Guest Calls</span>
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        liveHotel.callsEnabled !== false && liveHotel.adminCallsEnabled !== false
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-stone-800 text-stone-400 border border-stone-700'
                      }`}>
                        {liveHotel.callsEnabled !== false && liveHotel.adminCallsEnabled !== false ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  )}

                  {/* End Chat Option */}
                  {!isChatEnded && (
                    <button
                      type="button"
                      id="btn-end-chat"
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

                  {/* Clear Chat History Option */}
                  <button
                    type="button"
                    id="btn-clear-chat-history"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-rose-400 hover:bg-stone-800 flex items-center gap-2 cursor-pointer border-t border-stone-800/80"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Clear Chat History</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Desktop Only: Minimize Button */}
          {onMinimize && (
            <button 
              type="button"
              onClick={onMinimize} 
              className="hidden sm:flex p-1.5 hover:bg-stone-800 rounded-lg transition text-stone-400 hover:text-white cursor-pointer"
              title="Minimize chat"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}

          {/* Close Button */}
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-stone-800 rounded-lg transition text-stone-400 hover:text-white cursor-pointer"
            title="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Offline Out of Office Banner */}
      {!hostIsOnline && liveHotel.outOfOfficeMessage && (
        <div className="bg-amber-50 border-b border-amber-200/80 p-3 flex items-start gap-2.5 transition-all animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-900">Host is currently away</p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              {liveHotel.outOfOfficeMessage}
            </p>
          </div>
        </div>
      )}
      
      {/* Active in chat banner when other participant is actively viewing */}
      {otherInChat && !isOtherTyping && (
        <div className="bg-emerald-50/80 border-b border-emerald-100/90 px-3 py-1.5 flex items-center justify-between gap-2 text-emerald-900 text-xs animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-[11px]">
              {otherParticipantName} is active in this chat now
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded-full">
            Live
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3.5 bg-stone-50/70">
        {!currentUser ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <MessageSquare className="w-12 h-12 text-stone-300 mb-3" />
            <h4 className="font-semibold text-stone-900 text-sm mb-1">Sign in to Chat</h4>
            <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
              Please sign in to send messages and connect directly with the property hosts.
            </p>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
          </div>
        ) : timelineItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3 text-stone-400 shadow-2xs">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-700">No messages yet</p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs leading-relaxed">
              Send a question to the host about rooms, arrival, activities, or dining.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation Timeline */}
            {timelineItems.map((item, index) => {
              if (item.type === 'call') {
                const call = item.data;
                const isMe = call.callerId === currentUser.uid;
                const callDate = new Date(call.createdAt);
                const timeFormatted = callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                const isMissed = call.status === 'missed' || call.status === 'rejected' || (!call.answer && call.status === 'ended');
                const isVideo = call.type === 'video';
                const CallIcon = isMissed ? PhoneMissed : (isVideo ? Video : Phone);
                const iconColor = isMissed ? 'text-red-500' : (call.status === 'connected' ? 'text-blue-500' : 'text-emerald-500');
                
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
                  <div key={`call-${item.id}`} className="flex justify-center my-3 animate-fadeIn">
                    <div className="flex items-center gap-2.5 px-4 py-2 bg-stone-100/80 rounded-full border border-stone-200 shadow-2xs">
                       <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-white shadow-sm border border-stone-100 ${iconColor}`}>
                         <CallIcon className="w-3.5 h-3.5" />
                       </div>
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-stone-700 leading-tight">
                           {isMissed ? (isMe ? 'Unanswered Call' : 'Missed Call') : (isVideo ? 'Video Call' : 'Voice Call')}
                         </span>
                         <span className="text-[10px] font-medium text-stone-400 mt-0.5">
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
              const isLastMyMsg = index === lastMyMessageIndex;

              // Has the other person seen this message?
              const isSeenByOther = Boolean(
                isMe && (
                  (otherLastSeenAt && otherLastSeenAt >= msg.createdAt) ||
                  (otherLastOpenedAt && otherLastOpenedAt >= msg.createdAt) ||
                  otherInChat
                )
              );

              return (
                <div 
                  key={`msg-${item.id}`} 
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fadeIn`}
                >
                  <span className="text-[10px] font-medium text-stone-400 mb-1 px-1">
                    {msg.senderName}
                  </span>
                  <div 
                    className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-2xs ${
                      isMe 
                        ? 'bg-stone-900 text-white rounded-tr-xs' 
                        : 'bg-white border border-stone-200 text-stone-900 rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Read Receipts & Timestamps */}
                  <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px]">
                    <span className="text-stone-400">
                      {timeFormatted}
                    </span>

                    {isMe && (
                      <div className="flex items-center gap-1 ml-1">
                        {isSeenByOther ? (
                          <span 
                            className="inline-flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.2 rounded-md"
                            title={`Opened & seen by ${otherParticipantName} ${otherLastSeenAt ? 'at ' + formatReceiptTime(otherLastSeenAt) : ''}`}
                          >
                            <CheckCheck className="w-3 h-3 text-emerald-500" />
                            <span>Seen {isLastMyMsg && otherInChat ? '(Active)' : isLastMyMsg && otherLastSeenAt ? formatReceiptTime(otherLastSeenAt) : ''}</span>
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-0.5 text-stone-400"
                            title="Delivered to chat"
                          >
                            <Check className="w-3 h-3 text-stone-400" />
                            <span>Delivered</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Real-time Typing Bubble in Message Thread */}
            {isOtherTyping && (
              <div className="flex flex-col items-start animate-fadeIn pt-1">
                <span className="text-[10px] font-medium text-stone-400 mb-1 px-1">
                  {otherParticipantName}
                </span>
                <div className="bg-white border border-stone-200 text-stone-700 px-4 py-3 rounded-2xl rounded-tl-xs shadow-2xs flex items-center gap-2.5">
                  <span className="text-xs text-stone-600 font-medium">typing</span>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            {/* Chat Ended Session Banner */}
            {isChatEnded && (
              <div className="pt-3 pb-1">
                <div className="bg-stone-200/70 border border-stone-300/80 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-stone-700 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-stone-500" />
                    <span>This chat session was ended</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Ended by {chatDocData?.endedByName || (chatDocData?.endedBy === 'manager' ? 'Host' : 'Guest')} {endedDateStr && `on ${endedDateStr}`}.
                  </p>
                                      <div className="mt-2.5 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleRestartChat}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Start New Conversation</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear History</span>
                      </button>
                    </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Bottom Message Input Bar */}
      {currentUser && (
        <div className="p-3 pb-6 sm:pb-3 bg-white border-t border-stone-100 shrink-0">
          {isChatEnded ? (
            <div className="flex items-center justify-between gap-2 p-1.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 pl-2">Session ended. Send a message to restart.</span>
              <button
                type="button"
                onClick={handleRestartChat}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer"
              >
                Reopen Chat
              </button>
            </div>
          ) : (
            <div>
              {isManager && (
                <div className="relative mb-2" ref={depositMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowDepositMenu(!showDepositMenu)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-lg text-xs transition cursor-pointer select-none"
                    aria-expanded={showDepositMenu}
                  >
                    <Wallet className="w-3.5 h-3.5 text-amber-600" /> Send Deposit Details
                    <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform duration-200 ${showDepositMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showDepositMenu && (
                    <div className="absolute left-0 bottom-full mb-1.5 w-72 max-w-[calc(100vw-2.5rem)] bg-white border border-stone-200 rounded-2xl shadow-xl p-2 z-50 animate-fadeIn space-y-1">
                      <div className="px-2.5 py-1.5 border-b border-stone-100 flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-stone-400">
                          Deposit Instructions
                        </span>
                        {getHotelDepositInfo(liveHotel).depositPercentage && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {getHotelDepositInfo(liveHotel).depositPercentage}% Policy
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
                            {getHotelDepositInfo(liveHotel).airtelMoneyNumber || 'Airtel'} • {getHotelDepositInfo(liveHotel).mpambaNumber || 'Mpamba'}
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
                            {getHotelDepositInfo(liveHotel).bankName || 'Direct bank transfer'}
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
              )}

              <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleInputBlur}
                  onFocus={adjustTextareaHeight}
                  placeholder={
                    hostIsOnline 
                      ? "Type your message... (Enter to send, Shift+Enter for newline)" 
                      : "Host is away. Leave a message..."
                  }
                  className="flex-1 max-h-[320px] min-h-[54px] bg-stone-100 border border-transparent focus:border-stone-400 focus:bg-white focus:ring-0 rounded-xl px-4 pt-3 pb-4 text-sm transition outline-none resize-y leading-relaxed overflow-y-auto scrollbar-slim"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-stone-900 text-white p-2.5 sm:px-4 rounded-xl hover:bg-stone-800 disabled:opacity-50 transition shrink-0 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer mb-0.5"
                  title="Send message (Enter)"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs font-semibold">Send</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Confirm End Chat Dialog */}
      <ConfirmDialog
        isOpen={showEndChatConfirm}
        title="End Chat Session"
        message="Are you sure you want to end this conversation? Either participant can review past messages or start a fresh session at any time."
        confirmText="End Chat"
        cancelText="Keep Chatting"
        isDestructive={false}
        onConfirm={handleEndChat}
        onCancel={() => setShowEndChatConfirm(false)}
      />

      {/* Confirm Clear Chat History Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Clear Chat History"
        message="Are you sure you want to permanently clear this chat history? All messages and call records in this chat will be removed."
        confirmText="Clear History"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteChatHistory}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <CallModal
        activeCall={activeCall}
        incomingCall={incomingCall}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        localStream={localStream}
        remoteStream={remoteStream}
        networkQuality={networkQuality}
        onAnswer={answerCall}
        onReject={rejectCall}
        onEndCall={endCall}
      />
    </div>
  );
}
