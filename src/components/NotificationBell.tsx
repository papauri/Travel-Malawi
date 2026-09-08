import React, { useState, useRef, useEffect } from 'react';
import { Bell, Volume2, VolumeX, MessageSquare, CheckCheck, Sparkles, ExternalLink, Calendar, X, XCircle } from 'lucide-react';
import { useUnreadMessages, UnreadMessageItem } from '../hooks/useUnreadMessages';
import { useUnreadBroadcasts } from '../hooks/useUnreadBroadcasts';
import { useChatModal } from '../contexts/ChatModalContext';
import { isSoundEnabled, setSoundEnabled } from '../lib/notificationSound';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isHotelManager } from '../lib/roles';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import WalkthroughTooltip from './WalkthroughTooltip';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { 
    unreadItems, 
    unreadCount, 
    activeChats, 
    isVibrating, 
    triggerDing, 
    markAsRead, 
    closeConversation 
  } = useUnreadMessages();
  const unreadBroadcasts = useUnreadBroadcasts();
  const { openInquiryChat, openBookingChat, closeChat, isChatOpen, maximizeChat } = useChatModal();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [viewTab, setViewTab] = useState<'unread' | 'active'>('unread');
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(isOpen);

  const isManager = isHotelManager(user);
  const totalAlertsCount = unreadCount + unreadBroadcasts;

  // Whenever opened, if no unread messages, default to active chats tab
  useEffect(() => {
    if (isOpen) {
      if (unreadCount === 0 && activeChats.length > 0) {
        setViewTab('active');
      } else {
        setViewTab('unread');
      }
    }
  }, [isOpen, unreadCount, activeChats.length]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      triggerDing();
      toast.success('Chime sound enabled! 🔔', { duration: 2000 });
    } else {
      toast('Chime sound muted 🔕', { duration: 2000 });
    }
  };

  const handleOpenItem = async (item: UnreadMessageItem) => {
    setIsOpen(false);
    if (item.isUnread) {
      await markAsRead(item);
    }

    if (item.type === 'inquiry') {
      const isCurrentlyOpen = isChatOpen('inquiry', item.hotelId, item.guestId);
      if (isCurrentlyOpen) {
        maximizeChat();
      } else {
        openInquiryChat(
          {
            id: item.hotelId,
            name: item.hotelName,
            managerId: item.isManagerView ? user?.uid : '',
          } as any,
          item.isManagerView ? item.guestId : undefined,
          item.isManagerView ? item.guestName : undefined
        );
      }
    } else if (item.type === 'booking' && item.booking) {
      const isCurrentlyOpen = isChatOpen('booking', item.booking.id);
      if (isCurrentlyOpen) {
        maximizeChat();
      } else {
        openBookingChat(item.booking);
      }
    }
  };

  const handleCloseConversation = async (e: React.MouseEvent, item: UnreadMessageItem) => {
    e.stopPropagation();
    try {
      const isOpenNow = item.type === 'inquiry'
        ? isChatOpen('inquiry', item.hotelId, item.guestId)
        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

      if (isOpenNow) {
        closeChat();
      }
      await closeConversation(item);
      toast.success('Conversation closed and removed from active chats.');
    } catch (err) {
      toast.error('Failed to close conversation.');
    }
  };

  const handleToggleChat = (e: React.MouseEvent, item: UnreadMessageItem) => {
    e.stopPropagation();
    const isOpenNow = item.type === 'inquiry'
      ? isChatOpen('inquiry', item.hotelId, item.guestId)
      : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

    if (isOpenNow) {
      closeChat();
    } else {
      handleOpenItem(item);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative p-2 rounded-full transition-all duration-300 select-none cursor-pointer ${
          isOpen
            ? 'bg-amber-100/80 text-amber-900 ring-2 ring-amber-400/40 shadow-xs'
            : totalAlertsCount > 0
            ? 'text-stone-900 hover:bg-stone-100 hover:text-stone-950'
            : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
        }`}
        title={
          totalAlertsCount > 0
            ? `${totalAlertsCount} unread notification${totalAlertsCount === 1 ? '' : 's'}`
            : 'Notifications'
        }
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell
          className={`w-5 h-5 transition-transform duration-300 ${
            isVibrating
              ? 'animate-bell-ring text-rose-600'
              : totalAlertsCount > 0
              ? 'animate-bell-vibrate text-stone-800 group-hover:rotate-12'
              : 'hover:rotate-12'
          }`}
        />

        {/* Unread Message Count Badge */}
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            {/* Pulsing halo */}
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            {/* Number Pill */}
            <span className="relative flex items-center justify-center min-w-[19px] h-[19px] px-1 text-[10.5px] font-black text-white bg-rose-600 rounded-full shadow-sm border border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        ) : unreadBroadcasts > 0 ? (
          /* Subtle dot for trip broadcasts if no direct unread chat messages */
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white" />
          </span>
        ) : null}
      </button>

      {/* Subtle, slowly vanishing walkthrough callout on app launch / first sighting */}
      {!isOpen && (
        <WalkthroughTooltip
          id="walkthrough-notification-bell"
          icon="🔔"
          title="Chat & Notifications"
          description="Direct guest messages, booking inquiries & call alerts live right here."
          arrowPosition="top-right"
          className="fixed top-16 right-3 sm:absolute sm:top-full sm:right-0 mt-2.5 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] pointer-events-auto z-50"
        />
      )}

      {/* Floating Notifications Popover */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop to dismiss cleanly */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs z-40 sm:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              ref={scrollIsolationRef}
              data-lenis-prevent="true"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[410px] max-w-[calc(100vw-1.5rem)] bg-white/95 backdrop-blur-xl border border-stone-200/90 rounded-2xl shadow-2xl py-0 z-50 overflow-hidden max-h-[calc(100dvh-5rem)] flex flex-col overscroll-contain"
            >
              {/* Header */}
              <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between shrink-0 border-b border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-stone-800 text-stone-200 border border-stone-700 flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-serif font-bold text-sm tracking-tight text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {/* Quick Sound Toggle & Close Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-stone-700"
                    title={soundOn ? 'Mute notification chimes' : 'Enable notification chimes'}
                  >
                    {soundOn ? <Volume2 className="w-3.5 h-3.5 text-stone-300" /> : <VolumeX className="w-3.5 h-3.5 text-stone-400" />}
                    <span className="text-[11px]">{soundOn ? 'Sound on' : 'Muted'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition cursor-pointer"
                    title="Close notifications"
                    aria-label="Close notifications"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Segmented Tab Switcher: Unread vs Active Chats */}
              <div className="p-1.5 bg-stone-100/90 border-b border-stone-200/90 flex gap-1 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setViewTab('unread')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    viewTab === 'unread'
                      ? 'bg-white text-stone-950 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Unread</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('active')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    viewTab === 'active'
                      ? 'bg-white text-stone-950 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Active Chats</span>
                  {activeChats.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-stone-200 text-stone-800">
                      {activeChats.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Content List */}
              <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain scrollbar-slim divide-y divide-stone-100 max-h-[min(420px,calc(100dvh-12rem))]">
              {viewTab === 'unread' ? (
                unreadItems.length > 0 ? (
                  <div className="p-2 space-y-1.5">
                    <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-stone-600 uppercase tracking-wider bg-stone-100/70 rounded-lg">
                      <span>Unread Messages</span>
                      <span>Click to reply</span>
                    </div>

                    {unreadItems.map((item) => {
                      const initials = (item.senderName || 'U').slice(0, 2).toUpperCase();
                      const isOpenNow = item.type === 'inquiry'
                        ? isChatOpen('inquiry', item.hotelId, item.guestId)
                        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleOpenItem(item)}
                          className="w-full text-left p-3 rounded-xl bg-white hover:bg-stone-50 border border-stone-200/70 hover:border-stone-300 transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-stone-300 shadow-2xs">
                            {initials}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-sm font-bold text-stone-950 truncate group-hover:text-black">
                                {item.senderName}
                              </span>
                              <span className="text-[11px] font-medium text-stone-500 shrink-0">
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 border border-stone-300">
                                {item.senderRoleTag}
                              </span>
                              <span className="text-xs text-stone-600 font-medium truncate">
                                · {item.hotelName}
                              </span>
                            </div>

                            {/* Message snippet */}
                            <p className="text-xs text-stone-900 font-normal leading-relaxed mt-1.5 line-clamp-2 bg-stone-100/80 group-hover:bg-white p-2 rounded-lg border border-stone-200 transition">
                              "{item.lastMessage}"
                            </p>

                            <div className="mt-2 flex items-center justify-between pt-1">
                              <span className="text-[11px] font-medium text-stone-500">
                                Click to open chat
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleToggleChat(e, item)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isOpenNow
                                    ? 'bg-stone-200 text-stone-800 hover:bg-rose-100 hover:text-rose-800'
                                    : 'bg-stone-900 hover:bg-stone-800 text-white shadow-xs'
                                }`}
                              >
                                {isOpenNow ? 'Close' : 'Open Chat'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 px-6 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center mb-2.5 border border-stone-200">
                      <CheckCheck className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-serif font-bold text-stone-900">All caught up!</p>
                    <p className="text-xs text-stone-600 mt-1 max-w-[240px]">
                      You have no unread messages.
                    </p>
                    {activeChats.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setViewTab('active')}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-full transition cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-stone-700" />
                        View Active Chats ({activeChats.length})
                      </button>
                    )}
                  </div>
                )
              ) : (
                /* Active Chats Tab */
                activeChats.length > 0 ? (
                  <div className="p-2 space-y-1.5">
                    <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-stone-600 uppercase tracking-wider bg-stone-100/70 rounded-lg">
                      <span>Active Conversations</span>
                      <span>Open / Close anytime</span>
                    </div>

                    {activeChats.map((item) => {
                      const initials = (item.senderName || 'G').slice(0, 2).toUpperCase();
                      const isOpenNow = item.type === 'inquiry'
                        ? isChatOpen('inquiry', item.hotelId, item.guestId)
                        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleOpenItem(item)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group cursor-pointer shadow-2xs ${
                            isOpenNow
                              ? 'bg-stone-50/90 border-stone-400 ring-1 ring-stone-400'
                              : 'bg-white hover:bg-stone-50 border-stone-200/70 hover:border-stone-300'
                          }`}
                        >
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border shadow-2xs ${
                            isOpenNow
                              ? 'bg-stone-900 text-white border-stone-400 ring-2 ring-emerald-400/40'
                              : 'bg-stone-900 text-white border-stone-300'
                          }`}>
                            {initials}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-sm font-bold text-stone-950 truncate group-hover:text-black flex items-center gap-1.5">
                                {item.senderName}
                                {item.isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Unread" />
                                )}
                              </span>
                              <span className="text-[11px] font-medium text-stone-500 shrink-0">
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 border border-stone-300">
                                {item.senderRoleTag}
                              </span>
                              <span className="text-xs text-stone-600 font-medium truncate">
                                · {item.hotelName}
                              </span>
                            </div>

                            {/* Message snippet */}
                            <p className="text-xs text-stone-900 font-normal leading-relaxed mt-1.5 line-clamp-2 bg-stone-100/80 group-hover:bg-white p-2 rounded-lg border border-stone-200 transition">
                              "{item.lastMessage}"
                            </p>

                            {/* Action Row */}
                            <div className="mt-2 flex items-center justify-between pt-1">
                              {isOpenNow ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Open Now
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-stone-500">
                                  Click to chat
                                </span>
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenItem(item)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-xs transition cursor-pointer"
                                >
                                  {isOpenNow ? 'Focus' : 'Chat'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleCloseConversation(e, item)}
                                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 border border-stone-300 transition flex items-center gap-1 cursor-pointer"
                                  title="Close conversation and remove from active chats"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-stone-500" />
                                  <span>Close</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 px-6 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center mb-2.5 border border-stone-200">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-serif font-bold text-stone-900">No active chats yet</p>
                    <p className="text-xs text-stone-600 mt-1 max-w-[240px]">
                      When guests send messages, active conversations will appear here so you can open or close them at any time.
                    </p>
                  </div>
                )
              )}

              {/* Trip Broadcasts */}
              {unreadBroadcasts > 0 && (
                <div className="p-3 bg-stone-50 border-t border-stone-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-stone-700" />
                      Lodge Guest Announcements ({unreadBroadcasts})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/my-bookings');
                      }}
                      className="text-xs font-bold text-stone-800 hover:text-stone-950 underline flex items-center gap-0.5 cursor-pointer"
                    >
                      View in Bookings <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs">
              {isManager ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/dashboard');
                  }}
                  className="font-semibold text-stone-800 hover:text-stone-950 flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-stone-600" /> Open Host Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/my-bookings');
                  }}
                  className="font-semibold text-stone-800 hover:text-stone-950 flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-stone-600" /> My Trips & Bookings
                </button>
              )}

              {unreadCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live real-time sync
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </div>
  );
}
