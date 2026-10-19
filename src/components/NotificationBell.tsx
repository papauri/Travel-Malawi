import React, { useState, useRef, useEffect } from 'react';
import { Bell, Volume2, VolumeX, MessageSquare, CheckCheck, Radio, ExternalLink, Calendar, X, XCircle } from 'lucide-react';
import { UnreadMessageItem } from '../hooks/useUnreadMessages';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { useUnreadBroadcasts } from '../hooks/useUnreadBroadcasts';
import { useChatModal } from '../contexts/ChatModalContext';
import { isSoundEnabled, setSoundEnabled } from '../lib/notificationSound';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsHost } from '../hooks/useIsHost';
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

  const isManager = useIsHost();
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
              ? 'animate-bell-ring text-red-600'
              : totalAlertsCount > 0
              ? 'animate-bell-vibrate text-stone-800 group-hover:rotate-12'
              : 'hover:rotate-12'
          }`}
        />

        {/* Unread Message Count Badge */}
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            <span className="relative flex items-center justify-center min-w-[19px] h-[19px] px-1 text-[10.5px] font-bold text-white bg-red-600 rounded-full border border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        ) : unreadBroadcasts > 0 ? (
          /* Subtle dot for trip broadcasts if no direct unread chat messages */
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600 border border-white" />
          </span>
        ) : null}
      </button>

      {/* Subtle, slowly vanishing walkthrough callout on app launch / first sighting */}
      {!isOpen && (
        <WalkthroughTooltip
          id="walkthrough-notification-bell"
          icon={<Bell className="w-3.5 h-3.5 text-stone-300" />}
          title="Chats and notifications"
          description="Direct guest messages, booking inquiries & call alerts live right here."
          arrowPosition="top-right"
          className="fixed top-16 right-3 sm:absolute sm:top-full sm:right-0 mt-2.5 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] pointer-events-auto z-50"
        />
      )}

      {/* Notifications dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notification-bell-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-stone-950/30 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}

        {isOpen && (
          <motion.div
            key="notification-bell-popover-panel"
            ref={scrollIsolationRef}
            data-lenis-prevent="true"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[410px] max-w-[calc(100vw-1.5rem)] bg-white border border-stone-200 rounded-xl shadow-sm py-0 z-50 overflow-hidden max-h-[calc(100dvh-5rem)] flex flex-col overscroll-contain"
          >
              {/* Header */}
              <div className="px-4 py-3 bg-white flex items-center justify-between gap-2 shrink-0 border-b border-stone-200">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-serif font-semibold text-sm text-stone-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="tm-tag tm-tag-bad">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {/* Sound toggle and close */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                    title={soundOn ? 'Mute notification chimes' : 'Enable notification chimes'}
                  >
                    {soundOn ? <Volume2 className="w-3.5 h-3.5 text-stone-500" /> : <VolumeX className="w-3.5 h-3.5 text-stone-500" />}
                    <span className="text-[11px]">{soundOn ? 'Sound on' : 'Muted'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                    title="Close notifications"
                    aria-label="Close notifications"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs: unread / active chats */}
              <div className="p-1.5 bg-stone-100 border-b border-stone-200 flex gap-1 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setViewTab('unread')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    viewTab === 'unread'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Unread</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-600 text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('active')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    viewTab === 'active'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Active chats</span>
                  {activeChats.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-stone-200 text-stone-800">
                      {activeChats.length}
                    </span>
                  )}
                </button>
              </div>

              {/* List */}
              <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain scrollbar-slim divide-y divide-stone-100 max-h-[min(420px,calc(100dvh-12rem))]">
              {viewTab === 'unread' ? (
                unreadItems.length > 0 ? (
                  <div className="divide-y divide-stone-100">

                    {unreadItems.map((item, uIdx) => {
                      const initials = (item.senderName || 'U').slice(0, 2).toUpperCase();
                      const isOpenNow = item.type === 'inquiry'
                        ? isChatOpen('inquiry', item.hotelId, item.guestId)
                        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

                      return (
                        <div
                          key={`${item.id || 'notif'}-${uIdx}`}
                          onClick={() => handleOpenItem(item)}
                          className="w-full text-left px-4 py-3 bg-white hover:bg-stone-50 transition-colors flex items-start gap-3 group cursor-pointer"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-stone-100 text-stone-700 font-semibold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-sm font-semibold text-stone-900 truncate">
                                {item.senderName}
                              </span>
                              <span className="text-[11px] font-medium text-stone-500 shrink-0">
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1 min-w-0">
                              <span className="tm-tag shrink-0">
                                {item.senderRoleTag}
                              </span>
                              <span className="text-xs text-stone-600 font-medium truncate">
                                · {item.hotelName}
                              </span>
                            </div>

                            {/* Message snippet */}
                            <p className="text-xs text-stone-600 leading-relaxed mt-1 line-clamp-2 break-words">
                              {item.lastMessage}
                            </p>

                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => handleToggleChat(e, item)}
                                className={`tm-btn tm-btn-sm ${isOpenNow ? 'tm-btn-secondary' : 'tm-btn-primary'}`}
                              >
                                {isOpenNow ? 'Close' : 'Open chat'}
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
                    <p className="text-sm font-semibold text-stone-900">No unread messages</p>
                    {activeChats.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setViewTab('active')}
                        className="mt-3 tm-btn tm-btn-secondary tm-btn-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-stone-700" />
                        View active chats ({activeChats.length})
                      </button>
                    )}
                  </div>
                )
              ) : (
                /* Active Chats Tab */
                activeChats.length > 0 ? (
                  <div className="divide-y divide-stone-100">

                    {activeChats.map((item, aIdx) => {
                      const initials = (item.senderName || 'G').slice(0, 2).toUpperCase();
                      const isOpenNow = item.type === 'inquiry'
                        ? isChatOpen('inquiry', item.hotelId, item.guestId)
                        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

                      return (
                        <div
                          key={`${item.id || 'chat'}-${aIdx}`}
                          onClick={() => handleOpenItem(item)}
                          className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 group cursor-pointer ${
                            isOpenNow
                              ? 'bg-amber-50/60'
                              : 'bg-white hover:bg-stone-50'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 bg-stone-100 text-stone-700">
                            {initials}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-sm font-semibold text-stone-900 truncate flex items-center gap-1.5 min-w-0">
                                {item.senderName}
                                {item.isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" title="Unread" />
                                )}
                              </span>
                              <span className="text-[11px] font-medium text-stone-500 shrink-0">
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1 min-w-0">
                              <span className="tm-tag shrink-0">
                                {item.senderRoleTag}
                              </span>
                              <span className="text-xs text-stone-600 font-medium truncate">
                                · {item.hotelName}
                              </span>
                            </div>

                            {/* Message snippet */}
                            <p className="text-xs text-stone-600 leading-relaxed mt-1 line-clamp-2 break-words">
                              {item.lastMessage}
                            </p>

                            {/* Actions */}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              {isOpenNow ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  Open now
                                </span>
                              ) : (
                                <span />
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenItem(item)}
                                  className="tm-btn tm-btn-primary tm-btn-sm"
                                >
                                  {isOpenNow ? 'Focus' : 'Chat'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleCloseConversation(e, item)}
                                  className="tm-btn tm-btn-secondary tm-btn-sm"
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
                    <p className="text-sm font-semibold text-stone-900">No active chats yet</p>
                    <p className="text-xs text-stone-600 mt-1 max-w-[240px]">
                      New guest messages show up here.
                    </p>
                  </div>
                )
              )}

              {/* Trip announcements */}
              {unreadBroadcasts > 0 && (
                <div className="p-3 bg-stone-50 border-t border-stone-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-stone-700" />
                      Lodge announcements ({unreadBroadcasts})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/my-bookings');
                      }}
                      className="tm-link text-xs inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      View in bookings <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
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
                  <MessageSquare className="w-3.5 h-3.5 text-stone-600" /> Host dashboard
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
                  <Calendar className="w-3.5 h-3.5 text-stone-600" /> My bookings
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
