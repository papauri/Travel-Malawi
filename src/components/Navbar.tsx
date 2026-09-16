/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { LogOut, Bell, Palmtree, ChevronDown, LayoutDashboard, Briefcase, ShieldCheck, Building2, Volume2, VolumeX, Heart, UserCircle, BookOpen, MessageSquare, WifiOff } from 'lucide-react';
import { isSoundEnabled, onSoundPreferenceChange, setSoundEnabled } from '../lib/notificationSound';
import { requestBrowserNotifications } from './GlobalNotificationManager';
import { describeRoles, isAdmin, isGlobalAdmin, isMarketing, isHotelManager, isTraveller } from '../lib/roles';
import { useUnreadBroadcasts } from '../hooks/useUnreadBroadcasts';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { usePresence, PresenceStatus } from '../hooks/usePresence';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import NotificationBell from './NotificationBell';
import ActiveChatsMenu from './ActiveChatsMenu';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logOut } = useAuth();
  const { openAuth } = useAuthDialog();
  const unreadBroadcasts = useUnreadBroadcasts();
  const { activeChatsCount } = useUnreadMessages();
  const { presence, setManualStatus } = usePresence();
  const { isOnline } = useNetworkStatus();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatsMenuRef = useRef<{ openMenu: () => void }>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showUserMenu]);

  // Kept in step with anything else that changes the preference.
  useEffect(() => onSoundPreferenceChange(setSoundOn), []);

  useEffect(() => {
    if (isHotelManager(user)) {
      const q = query(
        collection(db, 'bookings'),
        where('managerId', '==', user.uid),
        // JS filter instead
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPendingCount(snapshot.docs.filter(d => d.data().status === 'pending').length);
      });
      return () => unsubscribe();
    }
    // Otherwise clear any count left over from a previous session.
    setPendingCount(0);
  }, [user]);

  // User initials for avatar
  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const [hasProperties, setHasProperties] = useState(false);
  useEffect(() => {
    if (user && !isHotelManager(user)) {
      const checkProperties = async () => {
        try {
          const q = query(collection(db, 'hotels'), where('managerId', '==', user.uid), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            setHasProperties(true);
          }
        } catch (e) {
          console.error(e);
        }
      };
      checkProperties();
    }
  }, [user]);

  const hosting = isHotelManager(user) || hasProperties;

  return (
    <nav className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-stone-200/70 shadow-2xs transition-all">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between h-14 sm:h-16 md:h-16 lg:h-18">
          {/* Logo & Network Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group shrink-0">
              <div className="relative flex items-center justify-center">
                <Palmtree className="h-4.5 w-4.5 sm:h-5 sm:w-5 md:h-5.5 md:w-5.5 text-stone-900 transition group-hover:text-emerald-700" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <span className="text-lg sm:text-xl md:text-2xl font-serif font-bold tracking-tight text-stone-900 group-hover:text-stone-700 transition whitespace-nowrap">
                Travel Malawi
              </span>
            </Link>

            {!isOnline && (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900 text-stone-200 border border-stone-800 text-[11px] font-semibold shadow-2xs"
                title="Internet connection is offline. Cached guides and stays remain available."
              >
                <div className="relative">
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                </div>
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}
          </div>

          {/* Right side navigation container */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3.5 shrink-0">
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3.5">
                {/* Secondary navigation options (Tablet & Desktop) */}
                <div className="hidden md:flex items-center md:gap-1 lg:gap-1.5 xl:gap-3">
                  {hosting ? (
                    <Link
                      to="/dashboard"
                      className={`text-xs xl:text-sm font-medium transition-colors px-2 py-1 xl:px-2.5 xl:py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap ${
                        location.pathname.startsWith('/dashboard')
                          ? 'bg-stone-100 text-stone-950 font-semibold'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                      }`}
                    >
                      <span>Dashboard</span>
                      {pendingCount > 0 && (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center justify-center leading-none">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <Link
                      to="/list-your-property"
                      className="inline-flex items-center gap-1.5 px-2.5 xl:px-3.5 py-1 xl:py-1.5 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50/80 hover:bg-stone-100 text-stone-700 hover:text-stone-900 text-xs font-medium transition shadow-2xs whitespace-nowrap"
                    >
                      <Building2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span className="hidden xl:inline">List Your Property</span>
                      <span className="xl:hidden">List Property</span>
                    </Link>
                  )}
                  {(isAdmin(user) || isMarketing(user)) && (
                    <Link
                      to="/admin"
                      className={`text-xs xl:text-sm font-medium transition-colors px-2 py-1 xl:px-2.5 xl:py-1.5 rounded-lg whitespace-nowrap ${
                        location.pathname.startsWith('/admin')
                          ? 'bg-stone-100 text-stone-950 font-semibold'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                      }`}
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/saved"
                    className={`text-xs xl:text-sm font-medium transition-colors px-2 py-1 xl:px-2.5 xl:py-1.5 rounded-lg whitespace-nowrap ${
                      location.pathname === '/saved'
                        ? 'bg-stone-100 text-stone-950 font-semibold'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    Saved
                  </Link>
                  <Link
                    to="/my-bookings"
                    className={`text-xs xl:text-sm font-medium transition-colors px-2 py-1 xl:px-2.5 xl:py-1.5 rounded-lg whitespace-nowrap ${
                      location.pathname.startsWith('/my-bookings')
                        ? 'bg-stone-100 text-stone-950 font-semibold'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    <span className="hidden xl:inline">My Bookings</span>
                    <span className="xl:hidden">Bookings</span>
                  </Link>
                </div>

                {/* Active Chats & Notification Bell */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <ActiveChatsMenu ref={activeChatsMenuRef} />
                  <NotificationBell />
                </div>

                {/* User avatar + dropdown */}
                <div className="relative pl-1.5 sm:pl-2 md:pl-2.5 border-l border-stone-200/80 shrink-0" ref={menuRef}>
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-1.5 rounded-full p-0.5 sm:p-1 md:px-1.5 md:py-0.5 hover:bg-stone-100/80 transition cursor-pointer select-none"
                    aria-label="User profile menu"
                    aria-expanded={showUserMenu}
                  >
                    <div className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 md:h-7.5 md:w-7.5 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] sm:text-xs font-bold tracking-wide shrink-0 shadow-2xs ring-1 ring-white">
                      {initials}
                    </div>
                    <span className="text-xs font-medium text-stone-900 hidden xl:block max-w-[100px] truncate">
                      {user.displayName ?? user.email}
                    </span>
                    <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-stone-400 shrink-0" />
                  </button>

                  {showUserMenu && (
                    <div
                      className="absolute right-0 mt-2 w-52 sm:w-56 max-w-[calc(100vw-1.5rem)] bg-white border border-stone-200 rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden"
                      onMouseLeave={() => setShowUserMenu(false)}
                    >
                      <div className="px-3.5 py-2.5 border-b border-stone-100">
                        <p className="text-[10px] sm:text-xs text-stone-400 uppercase tracking-wider font-semibold mb-0.5">Signed in as</p>
                        <p className="text-xs sm:text-sm font-medium text-stone-900 truncate">{user.email}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">{describeRoles(user)}</p>
                      </div>

                      {/* The links below are shown when on mobile */}
                      <div className="md:hidden py-1 border-b border-stone-100">
                        {user && (
                          <>
                            <Link
                              to="/saved"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <Heart className="h-3.5 w-3.5" /> Saved properties
                            </Link>
                            <Link
                              to="/my-bookings"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <Briefcase className="h-3.5 w-3.5" /> My bookings
                            </Link>
                          </>
                        )}
                        {hosting ? (
                          <>
                            <Link
                              to="/dashboard"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <LayoutDashboard className="h-3.5 w-3.5" />
                              <span>Host dashboard</span>
                            </Link>
                            <Link
                              to="/host-guide"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-stone-500" />
                              <span>Host Starter Guide</span>
                            </Link>
                          </>
                        ) : (
                          <Link
                            to="/list-your-property"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            <span>List your property</span>
                          </Link>
                        )}
                        {(isAdmin(user) || isMarketing(user)) && (
                          <Link
                            to="/admin"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Admin
                          </Link>
                        )}
                      </div>

                      <div className="py-1 border-b border-stone-100">
                        <Link
                          to="/profile"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                        >
                          <UserCircle className="h-3.5 w-3.5" /> Profile Settings
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            if (activeChatsMenuRef.current) {
                              activeChatsMenuRef.current.openMenu();
                            }
                          }}
                          className="w-full flex items-center justify-between px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-stone-500" />
                            <span>{hosting ? 'Active Guest Chats' : 'Active Chats'}</span>
                          </span>
                          {activeChatsCount > 0 && (
                            <span className="bg-stone-900 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                              {activeChatsCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Chat notification sound */}
                      <button
                        onClick={() => {
                          const next = !soundOn;
                          setSoundEnabled(next);
                          if (next) {
                            void requestBrowserNotifications();
                          }
                        }}
                        role="switch"
                        aria-checked={soundOn}
                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                      >
                        <span className="flex items-center gap-2">
                          {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                          Notification sounds
                        </span>
                        <span
                          aria-hidden="true"
                          className={`relative h-4 w-7 sm:h-5 sm:w-8 shrink-0 rounded-full transition ${soundOn ? 'bg-emerald-600' : 'bg-stone-300'}`}
                        >
                          <span
                            className={`absolute top-0.5 h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-white shadow transition-all ${soundOn ? 'left-[1.05rem] sm:left-[1.05rem]' : 'left-0.5'}`}
                          />
                        </span>
                      </button>

                      <button
                        onClick={() => { logOut(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition border-t border-stone-100"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
                {/* Secondary navigation options for visitors */}
                <div className="hidden sm:flex items-center">
                  <Link
                    to="/list-your-property"
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 text-xs font-medium transition shadow-2xs whitespace-nowrap"
                  >
                    <Building2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>List Property</span>
                  </Link>
                </div>

                <button
                  onClick={() => openAuth('signin')}
                  className="rounded-full bg-stone-900 px-3.5 sm:px-4 md:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-stone-800 transition shadow-sm cursor-pointer whitespace-nowrap"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
