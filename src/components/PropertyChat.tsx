import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { Hotel, Message, User, HotelChat } from '../types';
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
  CheckCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { chimeForIncoming, newChimeState } from '../lib/notificationSound';
import ConfirmDialog from './ConfirmDialog';

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
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatDocData, setChatDocData] = useState<HotelChat | null>(null);
  
  // Real-time live hotel status so online/offline updates instantly on guest screen
  const [liveHotel, setLiveHotel] = useState<Hotel>(hotel);

  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEndingChat, setIsEndingChat] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenMessages = useRef(newChimeState());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const [chatId, setChatId] = useState<string | null>(null);

  const activeGuestId = guestId || currentUser?.uid;
  const activeGuestName = guestName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Guest';
  const isManager = guestId !== undefined || (currentUser && liveHotel.managerId === currentUser.uid);
  const effectiveManagerId = liveHotel.managerId || (isManager ? (currentUser?.uid || '') : '') || '';
  const otherParticipantName = isManager ? activeGuestName : (liveHotel.name || 'Host');

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
          updateDoc(doc(db, 'hotel_chats', computedChatId), {
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
    
    // Cleanup presence & typing when closing / unmounting chat
    return () => {
      unsubChatDoc();
      unsubMessages();

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewMessage(text);

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

  const handleInputBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingState(false);
  };

  // Determine if the other participant is typing
  const otherIsTypingRaw = isManager ? chatDocData?.guestTyping : chatDocData?.managerTyping;
  const otherTypingAt = isManager ? (chatDocData?.guestTypingAt || 0) : (chatDocData?.managerTypingAt || 0);
  const isOtherTyping = Boolean(otherIsTypingRaw && (Date.now() - otherTypingAt < 5000));

  // Determine if other participant has opened / is active in the chat
  const otherInChat = isManager ? chatDocData?.guestInChat : chatDocData?.managerInChat;
  const otherLastOpenedAt = isManager ? chatDocData?.guestLastOpenedAt : chatDocData?.managerLastOpenedAt;
  const otherLastSeenAt = isManager ? chatDocData?.guestLastSeenAt : chatDocData?.managerLastSeenAt;

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

  // Is the chat session currently ended?
  const isChatEnded = chatDocData?.status === 'ended';

  // Handle Ending the Chat (by Manager or Guest)
  const handleEndChat = async () => {
    if (!chatId || !currentUser || isEndingChat) return;
    setIsEndingChat(true);
    try {
      const senderDisplayName = isManager 
        ? liveHotel.name 
        : (currentUser.displayName || currentUser.email?.split('@')[0] || 'Guest');

      const endTimestamp = Date.now();

      await updateDoc(doc(db, 'hotel_chats', chatId), {
        status: 'ended',
        endedAt: endTimestamp,
        endedBy: isManager ? 'manager' : 'guest',
        endedByName: senderDisplayName,
        updatedAt: endTimestamp,
        [isManager ? 'managerTyping' : 'guestTyping']: false,
      });

      setShowEndChatConfirm(false);
      toast.success('Chat session ended.');
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
        updatedAt: Date.now(),
      });
      toast.success('Started a new conversation session!');
    } catch (error) {
      console.error('Error restarting chat:', error);
      toast.error('Failed to restart conversation.');
    }
  };

  // Handle Deleting Chat History (Manager / Admin action)
  const handleDeleteChatHistory = async () => {
    if (!chatId || !currentUser || isDeletingChat) return;
    setIsDeletingChat(true);
    try {
      // 1. Delete all messages inside the subcollection
      const messagesRef = collection(db, 'hotel_chats', chatId, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      const deletePromises = messagesSnap.docs.map(mDoc => deleteDoc(mDoc.ref));
      await Promise.all(deletePromises);

      // 2. Delete the chat parent document
      await deleteDoc(doc(db, 'hotel_chats', chatId));

      setShowDeleteConfirm(false);
      toast.success('Chat history deleted permanently.');
      onClose();
    } catch (error) {
      console.error('Error deleting chat history:', error);
      toast.error('Failed to delete chat history. Ensure you have manager permissions.');
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
        updatedAt: now
      }, { merge: true });
      
      setNewMessage('');
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

  // Find index of the last message sent by me
  const lastMyMessageIndex = (() => {
    if (!currentUser) return -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === currentUser.uid) {
        return i;
      }
    }
    return -1;
  })();

  return (
    <div className="flex flex-col h-[530px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-200">
      {/* Header Bar */}
      <div className="p-3.5 sm:p-4 bg-stone-900 text-white flex justify-between items-center gap-2 select-none border-b border-stone-800">
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
                    : liveHotel.isOnline !== false
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
                        liveHotel.isOnline !== false ? 'bg-emerald-400' : 'bg-stone-500'
                      }`} 
                    />
                    <span className="text-stone-300 truncate">
                      {liveHotel.isOnline !== false ? 'Host Online' : 'Host Away'}
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
          {/* End Chat Button (Both Guest & Manager) */}
          {!isChatEnded && currentUser && (
            <button
              type="button"
              id="btn-end-chat"
              onClick={() => setShowEndChatConfirm(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-stone-800/90 hover:bg-stone-750 text-stone-300 hover:text-white rounded-lg border border-stone-700/60 transition shadow-2xs cursor-pointer"
              title="End this conversation session"
            >
              <PhoneOff className="w-3 h-3 text-red-400" />
              <span className="hidden sm:inline">End Chat</span>
            </button>
          )}

          {/* Delete Chat History Button (Manager / Admin only) */}
          {isManager && currentUser && (
            <button
              type="button"
              id="btn-delete-chat-history"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg transition cursor-pointer"
              title="Delete entire chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Minimize Button */}
          {onMinimize && (
            <button 
              type="button"
              onClick={onMinimize} 
              className="p-1.5 hover:bg-stone-800 rounded-lg transition text-stone-400 hover:text-white cursor-pointer"
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
      {liveHotel.isOnline === false && liveHotel.outOfOfficeMessage && (
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-stone-50/70">
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
        ) : messages.length === 0 ? (
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
            {/* Conversation Messages */}
            {messages.map((msg, index) => {
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
                  key={msg.id || index} 
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
                  <div className="mt-2.5 flex justify-center">
                    <button
                      type="button"
                      onClick={handleRestartChat}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Start New Conversation</span>
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
        <div className="p-3 bg-white border-t border-stone-100">
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
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder={
                  liveHotel.isOnline !== false 
                    ? "Type your message..." 
                    : "Host is away. Leave a message..."
                }
                className="flex-1 bg-stone-100 border border-transparent focus:border-stone-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition outline-none"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-stone-900 text-white p-2.5 sm:px-4 rounded-xl hover:bg-stone-800 disabled:opacity-50 transition shrink-0 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                title="Send message"
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

      {/* Confirm Delete Chat History Dialog (Manager / Admin) */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Chat History"
        message="Are you sure you want to permanently delete all messages and history for this guest? This cannot be undone."
        confirmText="Delete History"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteChatHistory}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
