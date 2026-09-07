import React, { createContext, useContext, useState, useEffect } from 'react';
import { Hotel, Booking, HotelChat } from '../types';
import PropertyChat from '../components/PropertyChat';
import BookingChat from '../components/BookingChat';
import Modal from '../components/Modal';
import { useAuth } from './AuthContext';
import { isAdmin, isHotelManager } from '../lib/roles';
import { useManagerPresence } from '../hooks/usePresence';
import { MessageSquare, Minus, X, Maximize2 } from 'lucide-react';
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
  isChatOpen: (type: 'inquiry' | 'booking', idOrHotelId: string, guestId?: string) => boolean;
  toggleInquiryChat: (hotel: Hotel, guestId?: string, guestName?: string) => void;
  toggleBookingChat: (booking: Booking) => void;
}

const ChatModalContext = createContext<ChatModalContextType | undefined>(undefined);

const CHAT_STORAGE_PREFIX = 'kaza_active_chat_session_';

export function ChatModalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState<ActiveChatState>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [liveHotelStatus, setLiveHotelStatus] = useState<{ isOnline?: boolean; name?: string }>({});

  // Reset active chat immediately whenever the logged-in user changes or logs out
  // Ensures one user's chat never leaks to another user, and cleans up when session ends
  useEffect(() => {
    setActiveChat(null);
    setIsMinimized(false);
    try {
      localStorage.removeItem('kaza_active_chat_session_v1');
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }
  }, [user?.uid]);

  const isChatOpen = (type: 'inquiry' | 'booking', idOrHotelId: string, guestId?: string): boolean => {
    if (!activeChat) return false;
    if (type === 'inquiry' && activeChat.type === 'inquiry') {
      const hotelMatch = activeChat.hotel?.id === idOrHotelId;
      if (!hotelMatch) return false;
      if (guestId && activeChat.guestId) {
        return activeChat.guestId === guestId;
      }
      return true;
    }
    if (type === 'booking' && activeChat.type === 'booking') {
      return activeChat.booking?.id === idOrHotelId;
    }
    return false;
  };

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

  const toggleInquiryChat = (hotel: Hotel, guestId?: string, guestName?: string) => {
    if (isChatOpen('inquiry', hotel.id || '', guestId)) {
      closeChat();
    } else {
      openInquiryChat(hotel, guestId, guestName);
    }
  };

  const toggleBookingChat = (booking: Booking) => {
    if (isChatOpen('booking', booking.id)) {
      closeChat();
    } else {
      openBookingChat(booking);
    }
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
      localStorage.removeItem('kaza_active_chat_session_v1');
      sessionStorage.clear();
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
        isChatOpen,
        toggleInquiryChat,
        toggleBookingChat,
      }}
    >
      {children}

      {/* Global Persistent Floating Chat Dock (Follows user across all pages) */}
      {activeChat && user && (
        <>
          {isMinimized ? (
            /* Minimized Floating Icon in bottom-right corner */
            <div 
              id="minimized-floating-chat-pill"
              className={`fixed bottom-6 z-[140] pointer-events-none transition-all duration-200 ${
                user && (isAdmin(user) || isHotelManager(user))
                  ? 'right-[4.75rem] sm:right-24'
                  : 'right-[4.75rem] md:right-8'
              }`}
            >
              <div className="relative pointer-events-auto group">
                <button
                  type="button"
                  onClick={maximizeChat}
                  className="relative flex items-center justify-center w-12 h-12 rounded-full bg-stone-900/95 hover:bg-stone-900 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-stone-700/80 hover:border-emerald-400/70 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer select-none"
                  title={activeChat.type === 'inquiry' 
                    ? (activeChat.guestId ? `Chat: ${activeChat.guestName || 'Guest'}` : currentHotelName)
                    : `Booking: ${activeChat.booking.guestName || 'Guest'}`}
                  aria-label="Expand chat"
                >
                  <div className="relative flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
                    <span 
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-stone-900 ${
                        isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'
                      }`} 
                    />
                  </div>
                </button>

                {/* Quick Close Button on hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeChat();
                  }}
                  className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-stone-800 border border-stone-600 text-stone-300 hover:text-white hover:bg-stone-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                  title="Close chat"
                  aria-label="Close chat"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Floating Chat Card Docked at Bottom Right */
            <div 
              id="expanded-floating-chat-container"
              className="fixed inset-x-0 bottom-0 top-10 sm:top-auto sm:inset-x-auto sm:bottom-6 sm:right-6 z-[200] sm:w-[440px] h-[calc(100dvh-2.5rem)] sm:h-[660px] sm:max-h-[calc(100dvh-5rem)] origin-bottom-right animate-fadeIn flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-2xl"
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
                <BookingChat
                  booking={activeChat.booking}
                  currentUser={user!}
                  onClose={closeChat}
                  onMinimize={minimizeChat}
                />
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
