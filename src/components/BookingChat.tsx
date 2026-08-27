import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, Message, User } from '../types';
import { Send, Loader2 } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Which messages have already been seen, so the chime fires for new arrivals
  // and not for the conversation the chat opens with.
  const seenMessages = useRef(newChimeState());

  useEffect(() => {
    if (!booking.id) return;
    
    const q = query(
      collection(db, 'bookings', booking.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
      setMessages(msgs);
      chimeForIncoming(msgs, currentUser?.uid, seenMessages);
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
  }, [booking.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !booking.id) return;
    
    setSending(true);
    try {
      await addDoc(collection(db, 'bookings', booking.id, 'messages'), {
        bookingId: booking.id,
        hotelId: booking.hotelId,
        managerId: booking.managerId,
        guestId: booking.guestId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        text: newMessage.trim(),
        createdAt: Date.now(),
      });
      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden min-h-[400px] max-h-[600px]">
      <div className="p-4 border-b border-stone-100 bg-stone-50">
        <h3 className="font-bold text-stone-900">Messages</h3>
        <p className="text-xs text-stone-500">Communicate directly regarding this booking.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/30">
        {loading ? (
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
    </div>
  );
}
