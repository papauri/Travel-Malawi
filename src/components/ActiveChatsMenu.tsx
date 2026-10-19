import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  X, 
  Calendar, 
  Check, 
  RotateCcw, 
  Trash2, 
  XCircle, 
  MoreVertical, 
  AlertTriangle,
  Eraser
} from 'lucide-react';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useChatModal } from '../contexts/ChatModalContext';
import { ActiveChatItem } from '../hooks/useUnreadMessages';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { useIsHost } from '../hooks/useIsHost';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface ActiveChatsMenuRef { openMenu: () => void; }

const ActiveChatsMenu = forwardRef<ActiveChatsMenuRef, {}>((props, ref) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    activeChat, 
    openInquiryChat, 
    openBookingChat, 
    closeChat, 
    maximizeChat,
    isChatOpen 
  } = useChatModal();
  const { 
    activeChats, 
    inactiveChats, 
    unreadCount, 
    markAsRead, 
    closeConversation, 
    reopenConversation, 
    clearChatHistory, 
    deleteChat 
  } = useUnreadMessages();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [activeItemMenuId, setActiveItemMenuId] = useState<string | null>(null);
  const [confirmClearItem, setConfirmClearItem] = useState<ActiveChatItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ActiveChatItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const isManager = useIsHost();
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(isOpen);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveItemMenuId(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveItemMenuId(null);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpenItem = async (item: ActiveChatItem) => {
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
    setIsOpen(false);
  };

  const handleCloseConversation = async (e: React.MouseEvent, item: ActiveChatItem) => {
    e.stopPropagation();
    try {
      // If this conversation is currently open in the floating dock, close the dock
      const isCurrentlyOpen = item.type === 'inquiry'
        ? isChatOpen('inquiry', item.hotelId, item.guestId)
        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));
      if (isCurrentlyOpen) {
        closeChat();
      }

      await closeConversation(item);
      toast.success('Conversation closed and removed from active chats.');
    } catch (err) {
      toast.error('Failed to close conversation.');
    }
  };

  const handleReopenConversation = async (e: React.MouseEvent, item: ActiveChatItem) => {
    e.stopPropagation();
    try {
      await reopenConversation(item);
      toast.success('Conversation reopened.');
      setActiveTab('active');
    } catch (err) {
      toast.error('Failed to reopen conversation.');
    }
  };

  const handleExecuteClear = async () => {
    if (!confirmClearItem || isProcessing) return;
    setIsProcessing(true);
    try {
      const item = confirmClearItem;
      const isCurrentlyOpen = item.type === 'inquiry'
        ? isChatOpen('inquiry', item.hotelId, item.guestId)
        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));
      if (isCurrentlyOpen) {
        closeChat();
      }

      await clearChatHistory(item);
      setConfirmClearItem(null);
      setActiveItemMenuId(null);
      toast.success('Chat history cleared successfully.');
    } catch (err) {
      toast.error('Failed to clear chat history.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!confirmDeleteItem || isProcessing) return;
    setIsProcessing(true);
    try {
      const item = confirmDeleteItem;
      const isCurrentlyOpen = item.type === 'inquiry'
        ? isChatOpen('inquiry', item.hotelId, item.guestId)
        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));
      if (isCurrentlyOpen) {
        closeChat();
      }

      await deleteChat(item);
      setConfirmDeleteItem(null);
      setActiveItemMenuId(null);
      toast.success('Chat deleted successfully.');
    } catch (err) {
      toast.error('Failed to delete chat.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentOpenTitle = activeChat
    ? activeChat.type === 'inquiry'
      ? `${activeChat.guestName || 'Guest'} · ${activeChat.hotel.name}`
      : `${activeChat.booking.guestName || 'Guest'} · ${activeChat.booking.hotelName || 'Property'}`
    : null;

  const currentDisplayList = activeTab === 'active' ? activeChats : inactiveChats;

  useImperativeHandle(ref, () => ({ openMenu: () => setIsOpen(true) }));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Chats Menu Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setActiveItemMenuId(null);
        }}
        className={`relative p-2 rounded-full transition-all duration-300 select-none cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-stone-100 text-stone-900'
            : activeChat
            ? 'text-stone-900 hover:bg-stone-100 hover:text-stone-950'
            : unreadCount > 0
            ? 'text-stone-900 hover:bg-stone-100 hover:text-stone-950'
            : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
        }`}
        title={activeChat ? `Open chat: ${currentOpenTitle}` : 'Chats'}
        aria-label="Chats"
        aria-expanded={isOpen}
      >
        <MessageSquare className="w-5 h-5" />

        {/* Live indicator if chat is currently open in dock */}
        {activeChat && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white" />
          </span>
        )}

        {/* Unread message badge if no active chat dock indicator */}
        {!activeChat && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full border border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chats dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="active-chats-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-stone-950/30 z-40 sm:hidden"
            onClick={() => {
              setIsOpen(false);
              setActiveItemMenuId(null);
            }}
          />
        )}

        {isOpen && (
          <motion.div
            key="active-chats-dropdown-panel"
            ref={scrollIsolationRef}
            data-lenis-prevent="true"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[430px] max-w-[calc(100vw-1.5rem)] bg-white border border-stone-200 rounded-xl shadow-sm py-0 z-50 overflow-hidden max-h-[calc(100dvh-5rem)] flex flex-col overscroll-contain"
          >
              {/* Header */}
              <div className="px-4 py-3 bg-white flex items-center justify-between gap-2 shrink-0 border-b border-stone-200">
                <h3 className="font-serif font-semibold text-sm text-stone-900">Chats</h3>

                {/* Tabs: Active vs Closed */}
                <div className="flex items-center bg-stone-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveTab('active')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'active'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>Active</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === 'active' ? 'bg-stone-100 text-stone-700' : 'bg-stone-200 text-stone-600'
                    }`}>
                      {activeChats.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('closed')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'closed'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>Closed</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === 'closed' ? 'bg-stone-100 text-stone-700' : 'bg-stone-200 text-stone-600'
                    }`}>
                      {inactiveChats.length}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition cursor-pointer"
                  title="Close menu"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat window currently open */}
              {activeChat && (
                <div className="px-3.5 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[11px] text-stone-500 block leading-none">
                        Open now
                      </span>
                      <p className="text-xs font-semibold text-stone-900 truncate mt-0.5">
                        {currentOpenTitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        maximizeChat();
                        setIsOpen(false);
                      }}
                      className="tm-btn tm-btn-primary tm-btn-sm"
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      onClick={closeChat}
                      className="tm-btn tm-btn-secondary tm-btn-sm"
                      title="Hide the chat window"
                    >
                      <X className="w-3.5 h-3.5" /> Hide
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm clear / delete */}
              {confirmClearItem && (
                <div className="p-3 bg-amber-50 border-b border-amber-200 shrink-0 text-xs">
                  <div className="flex items-start gap-2 text-amber-900 font-semibold mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span>Clear conversation history with {confirmClearItem.senderName}?</span>
                      <p className="font-normal text-amber-800 text-[11px] mt-0.5">
                        Messages are cleared and the chat leaves your active list.
                      </p>
                    </div>
                  </div>
                  <div className="tm-actions justify-end">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmClearItem(null)}
                      className="tm-btn tm-btn-quiet tm-btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteClear}
                      className="tm-btn tm-btn-primary tm-btn-sm"
                    >
                      {isProcessing ? 'Clearing...' : 'Clear chat'}
                    </button>
                  </div>
                </div>
              )}

              {confirmDeleteItem && (
                <div className="p-3 bg-red-50 border-b border-red-200 shrink-0 text-xs">
                  <div className="flex items-start gap-2 text-red-900 font-semibold mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <div>
                      <span>Permanently delete chat with {confirmDeleteItem.senderName}?</span>
                      <p className="font-normal text-red-800 text-[11px] mt-0.5">
                        This deletes all messages and removes the chat permanently.
                      </p>
                    </div>
                  </div>
                  <div className="tm-actions justify-end">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmDeleteItem(null)}
                      className="tm-btn tm-btn-quiet tm-btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteDelete}
                      className="tm-btn tm-btn-danger tm-btn-sm"
                    >
                      {isProcessing ? 'Deleting...' : 'Delete chat'}
                    </button>
                  </div>
                </div>
              )}

              {/* Chat list */}
              <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain scrollbar-slim divide-y divide-stone-100 max-h-[min(420px,calc(100dvh-12rem))]">
                {currentDisplayList.length > 0 ? (
                  <div className="divide-y divide-stone-100">
                    {currentDisplayList.map((item, idx) => {
                      const initials = (item.senderName || 'G').slice(0, 2).toUpperCase();
                      const isCurrentlyOpen = item.type === 'inquiry'
                        ? isChatOpen('inquiry', item.hotelId, item.guestId)
                        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

                      const isMenuOpen = activeItemMenuId === item.id;

                      return (
                        <div
                          key={`${item.id || 'chat'}-${idx}`}
                          className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 group relative ${
                            isCurrentlyOpen
                              ? 'bg-amber-50/60'
                              : 'bg-white hover:bg-stone-50'
                          }`}
                        >
                          {/* Avatar */}
                          <div 
                            onClick={() => handleOpenItem(item)}
                            className="w-9 h-9 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 bg-stone-100 text-stone-700 cursor-pointer"
                          >
                            {initials}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span 
                                onClick={() => handleOpenItem(item)}
                                className="text-sm font-semibold text-stone-900 truncate flex items-center gap-1.5 cursor-pointer min-w-0"
                              >
                                {item.senderName}
                                {item.isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" title="Unread message" />
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
                              {activeTab === 'closed' && (
                                <span className="tm-tag shrink-0">
                                  Closed
                                </span>
                              )}
                            </div>

                            {/* Message snippet */}
                            <p 
                              onClick={() => handleOpenItem(item)}
                              className="text-xs text-stone-600 leading-relaxed mt-1 line-clamp-2 break-words cursor-pointer"
                            >
                              {item.lastMessage}
                            </p>

                            {/* Actions */}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                {isCurrentlyOpen ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Open now
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenItem(item)}
                                    className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline cursor-pointer"
                                  >
                                    Open chat
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {activeTab === 'active' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenItem(item)}
                                      className="tm-btn tm-btn-primary tm-btn-sm"
                                    >
                                      {isCurrentlyOpen ? 'Focus' : 'Chat'}
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
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleReopenConversation(e, item)}
                                    className="tm-btn tm-btn-primary tm-btn-sm"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Reopen</span>
                                  </button>
                                )}

                                {/* More (clear / delete) */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveItemMenuId(isMenuOpen ? null : item.id);
                                    }}
                                    className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-md transition cursor-pointer"
                                    title="More options"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {isMenuOpen && (
                                    <div 
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-stone-200 rounded-xl shadow-sm py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveItemMenuId(null);
                                          setConfirmClearItem(item);
                                        }}
                                        className="w-full text-left px-3 py-2 text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Eraser className="w-3.5 h-3.5 text-stone-500" />
                                        <span>Clear messages</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveItemMenuId(null);
                                          setConfirmDeleteItem(item);
                                        }}
                                        className="w-full text-left px-3 py-2 text-red-700 hover:bg-red-50 flex items-center gap-2 cursor-pointer border-t border-stone-100"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete chat</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 px-6 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center mb-2.5 border border-stone-200">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-stone-900">
                      {activeTab === 'active' ? 'No active chats' : 'No closed chats'}
                    </p>
                    <p className="text-xs text-stone-600 mt-1 max-w-[260px]">
                      {activeTab === 'active' 
                        ? 'New questions and guest chats show up here.'
                        : 'Chats you close show up here. You can reopen them.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs shrink-0">
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
});

export default ActiveChatsMenu;
