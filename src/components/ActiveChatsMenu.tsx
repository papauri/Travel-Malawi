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
import { useUnreadMessages, ActiveChatItem } from '../hooks/useUnreadMessages';
import { isHotelManager } from '../lib/roles';

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
  const isManager = isHotelManager(user);
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
            ? 'bg-stone-900 text-white shadow-xs'
            : activeChat
            ? 'text-stone-900 hover:bg-stone-100 hover:text-stone-950 ring-2 ring-emerald-500/50'
            : unreadCount > 0
            ? 'text-stone-900 hover:bg-stone-100 hover:text-stone-950'
            : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
        }`}
        title={activeChat ? `Active chat: ${currentOpenTitle}` : 'Active Chats'}
        aria-label="Active Chats"
        aria-expanded={isOpen}
      >
        <MessageSquare className="w-5 h-5" />

        {/* Live indicator if chat is currently open in dock */}
        {activeChat && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white" />
          </span>
        )}

        {/* Unread message badge if no active chat dock indicator */}
        {!activeChat && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-600 rounded-full shadow-xs border border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Active Chats Dropdown */}
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
              onClick={() => {
                setIsOpen(false);
                setActiveItemMenuId(null);
              }}
            />

            <motion.div
              ref={scrollIsolationRef}
              data-lenis-prevent="true"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="fixed top-16 inset-x-3 sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[430px] max-w-[calc(100vw-1.5rem)] bg-white/95 backdrop-blur-xl border border-stone-200/90 rounded-2xl shadow-2xl py-0 z-50 overflow-hidden max-h-[calc(100dvh-5rem)] flex flex-col overscroll-contain"
            >
              {/* Header */}
              <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between shrink-0 border-b border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-stone-800 text-stone-200 border border-stone-700 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-serif font-bold text-sm tracking-tight text-white">Conversations</h3>
                </div>

                {/* Tabs: Active vs Closed */}
                <div className="flex items-center bg-stone-800 p-0.5 rounded-lg border border-stone-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('active')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'active'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span>Active</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-stone-700 text-stone-300'
                    }`}>
                      {activeChats.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('closed')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'closed'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span>Closed</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === 'closed' ? 'bg-stone-700 text-stone-200' : 'bg-stone-700 text-stone-300'
                    }`}>
                      {inactiveChats.length}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition cursor-pointer"
                  title="Close menu"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Currently Open in Dock Banner */}
              {activeChat && (
                <div className="px-3.5 py-2.5 bg-stone-950 text-white border-b border-stone-800 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9.5px] uppercase font-bold tracking-wider text-emerald-400 block leading-none">
                        Floating Chat Window Open
                      </span>
                      <p className="text-xs font-bold text-stone-100 truncate mt-0.5">
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
                      className="px-2.5 py-1 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition cursor-pointer"
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      onClick={closeChat}
                      className="px-2.5 py-1 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Hide floating dock"
                    >
                      <X className="w-3.5 h-3.5" /> Hide
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation Modals for Clear / Delete */}
              {confirmClearItem && (
                <div className="p-3 bg-amber-50 border-b border-amber-200 shrink-0 text-xs">
                  <div className="flex items-start gap-2 text-amber-900 font-semibold mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span>Clear conversation history with {confirmClearItem.senderName}?</span>
                      <p className="font-normal text-amber-800 text-[11px] mt-0.5">
                        All messages will be cleared and the conversation will be removed from active chats.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmClearItem(null)}
                      className="px-3 py-1 rounded-lg font-medium text-stone-600 hover:bg-amber-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteClear}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition cursor-pointer"
                    >
                      {isProcessing ? 'Clearing...' : 'Yes, Clear Chat'}
                    </button>
                  </div>
                </div>
              )}

              {confirmDeleteItem && (
                <div className="p-3 bg-rose-50 border-b border-rose-200 shrink-0 text-xs">
                  <div className="flex items-start gap-2 text-rose-900 font-semibold mb-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span>Permanently delete chat with {confirmDeleteItem.senderName}?</span>
                      <p className="font-normal text-rose-800 text-[11px] mt-0.5">
                        This deletes all messages and removes the chat permanently.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmDeleteItem(null)}
                      className="px-3 py-1 rounded-lg font-medium text-stone-600 hover:bg-rose-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteDelete}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition cursor-pointer"
                    >
                      {isProcessing ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              )}

              {/* Conversations List */}
              <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain scrollbar-slim divide-y divide-stone-100 max-h-[min(420px,calc(100dvh-12rem))]">
                {currentDisplayList.length > 0 ? (
                  <div className="p-2 space-y-2">
                    {currentDisplayList.map((item) => {
                      const initials = (item.senderName || 'G').slice(0, 2).toUpperCase();
                      const isCurrentlyOpen = item.type === 'inquiry'
                        ? isChatOpen('inquiry', item.hotelId, item.guestId)
                        : isChatOpen('booking', item.booking?.id || item.id.replace('booking_', ''));

                      const isMenuOpen = activeItemMenuId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group relative shadow-2xs ${
                            isCurrentlyOpen
                              ? 'bg-stone-50/90 border-stone-400 ring-1 ring-stone-400'
                              : 'bg-white hover:bg-stone-50/80 border-stone-200/80 hover:border-stone-300'
                          }`}
                        >
                          {/* Avatar */}
                          <div 
                            onClick={() => handleOpenItem(item)}
                            className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border shadow-2xs cursor-pointer ${
                              isCurrentlyOpen
                                ? 'bg-stone-900 text-white border-stone-400 ring-2 ring-emerald-400/40'
                                : 'bg-stone-900 text-white border-stone-300'
                            }`}
                          >
                            {initials}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <span 
                                onClick={() => handleOpenItem(item)}
                                className="text-sm font-bold text-stone-950 truncate group-hover:text-black flex items-center gap-1.5 cursor-pointer"
                              >
                                {item.senderName}
                                {item.isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Unread message" />
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
                              {activeTab === 'closed' && (
                                <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                                  Closed
                                </span>
                              )}
                            </div>

                            {/* Message snippet */}
                            <p 
                              onClick={() => handleOpenItem(item)}
                              className="text-xs text-stone-900 font-normal leading-relaxed mt-1.5 line-clamp-2 bg-stone-100/80 group-hover:bg-white p-2 rounded-lg border border-stone-200 transition cursor-pointer"
                            >
                              "{item.lastMessage}"
                            </p>

                            {/* Action Row */}
                            <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-stone-100">
                              <div className="flex items-center gap-1.5">
                                {isCurrentlyOpen ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Dock Open
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenItem(item)}
                                    className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline cursor-pointer"
                                  >
                                    Open Chat
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {activeTab === 'active' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenItem(item)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-xs transition cursor-pointer"
                                    >
                                      {isCurrentlyOpen ? 'Focus' : 'Chat'}
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
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleReopenConversation(e, item)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-xs transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Reopen</span>
                                  </button>
                                )}

                                {/* More Dropdown (Clear / Delete) */}
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
                                      className="absolute right-0 bottom-full mb-1 w-44 bg-stone-900 border border-stone-800 rounded-xl shadow-xl py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveItemMenuId(null);
                                          setConfirmClearItem(item);
                                        }}
                                        className="w-full text-left px-3 py-2 text-stone-300 hover:bg-stone-800 hover:text-white flex items-center gap-2 cursor-pointer"
                                      >
                                        <Eraser className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Clear Messages</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveItemMenuId(null);
                                          setConfirmDeleteItem(item);
                                        }}
                                        className="w-full text-left px-3 py-2 text-rose-400 hover:bg-stone-800 hover:text-rose-300 flex items-center gap-2 cursor-pointer border-t border-stone-800"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete Chat</span>
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
                    <p className="text-sm font-serif font-bold text-stone-900">
                      {activeTab === 'active' ? 'No active chats' : 'No closed chats'}
                    </p>
                    <p className="text-xs text-stone-600 mt-1 max-w-[260px]">
                      {activeTab === 'active' 
                        ? 'When inquiries arrive or you chat with guests, active conversations appear here. Closing a chat moves it to the Closed tab.'
                        : 'Conversations you have ended or closed will appear here. You can reopen them at any time.'}
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
                    <MessageSquare className="w-3.5 h-3.5 text-stone-600" /> Host Dashboard
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
                    <Calendar className="w-3.5 h-3.5 text-stone-600" /> My Bookings
                  </button>
                )}

                <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live sync
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

export default ActiveChatsMenu;
