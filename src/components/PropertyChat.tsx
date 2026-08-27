import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, Message, User } from '../types';
import { Send, Loader2, X, MessageSquare, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  hotel: Hotel;
  currentUser: User | null;
  onClose: () => void;
  guestId?: string; // If provided (by manager), use this to compute chat ID instead of currentUser.uid
  guestName?: string; // If provided (by manager), use this for display name
}

export default function PropertyChat({ hotel, currentUser, onClose, guestId, guestName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const activeGuestId = guestId || currentUser?.uid;
  const activeGuestName = guestName || currentUser?.displayName || 'Guest';
  const isManager = guestId !== undefined; // If guestId is explicitly passed, the current user is acting as the manager

  useEffect(() => {
    if (!currentUser || !hotel.id || !activeGuestId) {
      setLoading(false);
      return;
    }
    
    const computedChatId = `${hotel.id}_${activeGuestId}`;
    setChatId(computedChatId);

    const ensureChatDoc = async () => {
      try {
        const chatRef = doc(db, 'hotel_chats', computedChatId);
        const chatDoc = await getDoc(chatRef);
        if (!chatDoc.exists()) {
          await setDoc(chatRef, {
            hotelId: hotel.id,
            guestId: activeGuestId,
            managerId: hotel.managerId,
            guestName: activeGuestName,
            updatedAt: Date.now()
          });
        }
      } catch (err) {
        console.error('Error ensuring chat doc:', err);
      }
    };
    if (!isManager) {
       ensureChatDoc(); // Only guest initializes the chat doc if missing
    }

    const q = query(
      collection(db, 'hotel_chats', computedChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error('Error fetching messages:', error);
      toast.error('Could not load messages.');
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [hotel.id, currentUser, activeGuestId, activeGuestName, isManager]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !currentUser || !hotel.id || !activeGuestId) return;
    
    setSending(true);
    try {
      await addDoc(collection(db, 'hotel_chats', chatId, 'messages'), {
        chatId: chatId,
        hotelId: hotel.id,
        managerId: hotel.managerId,
        guestId: activeGuestId,
        senderId: currentUser.uid,
        senderName: isManager ? hotel.name : (currentUser.displayName || 'Guest'),
        text: newMessage.trim(),
        createdAt: Date.now(),
      });
      
      // Update the chat doc's updatedAt
      await setDoc(doc(db, 'hotel_chats', chatId), {
        hotelId: hotel.id,
        guestId: activeGuestId,
        managerId: hotel.managerId,
        guestName: activeGuestName,
        updatedAt: Date.now()
      }, { merge: true });
      
      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-200">
      <div className="p-4 bg-stone-900 text-white flex justify-between items-center">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            {isManager ? `Chat with ${activeGuestName}` : `Chat with ${hotel.name}`}
          </h3>
          {!isManager && (
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${hotel.isOnline ? 'bg-emerald-400' : 'bg-stone-500'}`}></div>
              <span className="text-xs text-stone-300">
                {hotel.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-full transition text-stone-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {!hotel.isOnline && hotel.outOfOfficeMessage && (
        <div className="bg-amber-50 border-b border-amber-100 p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Out of Office</p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{hotel.outOfOfficeMessage}</p>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
        {!currentUser ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <MessageSquare className="w-12 h-12 text-stone-300 mb-4" />
            <h4 className="font-semibold text-stone-900 mb-2">Sign in to Chat</h4>
            <p className="text-sm text-stone-500">You need to be signed in to send messages to the property manager.</p>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-stone-300 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400">
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Send a message to start the conversation.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-stone-400 mb-1 px-1">{msg.senderName}</span>
                <div 
                  className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${
                    isMe 
                      ? 'bg-stone-900 text-white rounded-tr-sm' 
                      : 'bg-white border border-stone-200 text-stone-800 rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-stone-300 mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {currentUser && (
        <div className="p-3 bg-white border-t border-stone-100">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-stone-100 border-transparent focus:bg-white focus:border-stone-300 focus:ring-0 rounded-full px-4 py-2.5 text-sm"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-stone-900 text-white p-3 rounded-full hover:bg-stone-800 disabled:opacity-50 transition shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
