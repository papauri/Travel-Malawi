import React, { createContext, useContext, useState, useEffect } from 'react';
import { Hotel, Booking, HotelChat } from '../types';
import PropertyChat from '../components/PropertyChat';
import BookingChat from '../components/BookingChat';
import Modal from '../components/Modal';
import { useAuth } from './AuthContext';
import { useManagerPresence } from '../hooks/usePresence';
import { MessageSquare, Minus, X, Maximize2, Sparkles } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface InquiryChatPayload {
  type: 'inquiry';
  hotel: Hotel;
  guestId?: string;
  guestName?: string;
}

export interface BookingChatPayload {
  type: 'booking';
  booking: Booking;
}

export type ActiveChatState = InquiryChatPayload | BookingChatPayload | null;

interface ChatModalContextType {
  activeChat: ActiveChatState;
  isMinimized: boolean;
  openInquiryChat: (hotel: Hotel, guestId?: string, guestName?: string) => void;
  openBookingChat: (booking: Booking) => void;
  minimizeChat: () => void;
  maximizeChat: () => void;
  closeChat: () => void;
}

const ChatModalContext = createContext<ChatModalContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'kaza_active_chat_session_v1';

export function ChatModalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Initialize from localStorage if available so navigating / refreshing keeps session
  const [activeChat, setActiveChat] = useState<ActiveChatState>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored chat session:', e);
    }
    return null;
  });

  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [liveHotelStatus, setLiveHotelStatus] = useState<{ isOnline?: boolean; name?: string }>({});

  // Sync activeChat state to localStorage whenever it changes
  useEffect(() => {
    try {
      if (activeChat) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(activeChat));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to persist active chat session:', e);
    }
  }, [activeChat]);



  const openInquiryChat = (hotel: Hotel, guestId?: string, guestName?: string) => {
    setActiveChat({
      type: 'inquiry',
      hotel,
      guestId,
      guestName,
    });
    setIsMinimized(false);
  };

  const openBookingChat = (booking: Booking) => {
    setActiveChat({
      type: 'booking',
      booking,
    });
    setIsMinimized(false);
  };

  const minimizeChat = () => {
    setIsMinimized(true);
  };

  const maximizeChat = () => {
    setIsMinimized(false);
  };

  const closeChat = () => {
    setActiveChat(null);
    setIsMinimized(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  };

  const currentHotelName = activeChat?.type === 'inquiry' ? activeChat.hotel.name : 'Property';
  const activeManagerId = activeChat?.type === 'inquiry' ? activeChat.hotel.managerId : 
                          activeChat?.type === 'booking' ? activeChat.booking.managerId : undefined;
  const managerPresence = useManagerPresence(activeManagerId);
  const isOnline = managerPresence?.status === 'online';

  return (
    <ChatModalContext.Provider
      value={{
        activeChat,
        isMinimized,
        openInquiryChat,
        openBookingChat,
        minimizeChat,
        maximizeChat,
        closeChat,
      }}
    >
      {children}

      {/* Global Persistent Floating Chat Dock (Follows user across all pages) */}
      {activeChat && user && (
        <>
          {isMinimized ? (
            /* Minimized Floating Pill in bottom-right corner */
            <div 
              id="minimized-floating-chat-pill"
              className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 bg-stone-900 text-white pl-4 pr-2 py-2.5 rounded-full shadow-2xl border border-stone-700/80 cursor-pointer hover:bg-stone-800 transition-all hover:scale-105 select-none animate-fadeIn"
            >
              <div 
                onClick={maximizeChat}
                className="flex items-center gap-2.5 min-w-0"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span 
                    className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-stone-900 ${
                      isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
                    }`} 
                  />
                </div>

                <div className="text-left min-w-0 max-w-[160px] sm:max-w-[200px]">
                  <p className="text-xs font-bold text-white truncate">
                    {activeChat.type === 'inquiry' 
                      ? (activeChat.guestId ? `Chat: ${activeChat.guestName || 'Guest'}` : currentHotelName)
                      : `Booking: ${activeChat.booking.guestName || 'Guest'}`}
                  </p>
                  <p className="text-[10px] text-stone-300 truncate">
                    {isOnline ? 'Online • Tap to chat' : 'Away • Session active'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 pl-1 border-l border-stone-700/80">
                <button
                  type="button"
                  onClick={maximizeChat}
                  className="p-1.5 hover:bg-stone-700 text-stone-300 hover:text-white rounded-full transition"
                  title="Expand chat window"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={closeChat}
                  className="p-1.5 hover:bg-stone-700 text-stone-400 hover:text-white rounded-full transition"
                  title="Close chat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Floating Chat Card Docked at Bottom Right */
            <div 
              id="expanded-floating-chat-container"
              className="fixed bottom-6 right-6 z-[200] w-[calc(100vw-32px)] sm:w-[410px] max-w-full origin-bottom-right animate-fadeIn"
            >
              {activeChat.type === 'inquiry' ? (
                <PropertyChat
                  hotel={activeChat.hotel}
                  currentUser={user}
                  guestId={activeChat.guestId}
                  guestName={activeChat.guestName}
                  onClose={closeChat}
                  onMinimize={minimizeChat}
                />
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-stone-200">
                  <div className="p-3 bg-stone-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <div>
                        <h4 className="font-bold text-xs">
                          {activeChat.booking.guestName || 'Guest'}
                        </h4>
                        <span className="text-[10px] text-stone-300">
                          Ref: {activeChat.booking.reference || activeChat.booking.id}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        type="button" 
                        onClick={minimizeChat}
                        className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white"
                        title="Minimize"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button 
                        type="button" 
                        onClick={closeChat}
                        className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white"
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="h-[460px]">
                    <BookingChat booking={activeChat.booking} currentUser={user} />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </ChatModalContext.Provider>
  );
}

export function useChatModal() {
  const context = useContext(ChatModalContext);
  if (!context) {
    throw new Error('useChatModal must be used within a ChatModalProvider');
  }
  return context;
}
