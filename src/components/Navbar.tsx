/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { LogOut, Bell, Palmtree, ChevronDown, LayoutDashboard, Briefcase, ShieldCheck, Building2, Volume2, VolumeX, Heart, UserCircle, BookOpen, MessageSquare, Sparkles, Compass } from 'lucide-react';
import { isSoundEnabled, onSoundPreferenceChange, setSoundEnabled } from '../lib/notificationSound';
import { requestBrowserNotifications } from './GlobalNotificationManager';
import { describeRoles, isAdmin, isGlobalAdmin, isMarketing, isHotelManager, isTraveller } from '../lib/roles';
import { useUnreadBroadcasts } from '../hooks/useUnreadBroadcasts';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { usePresence, PresenceStatus } from '../hooks/usePresence';
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
    <nav className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-stone-200/60 shadow-xs">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="relative">
              <Palmtree className="h-6 w-6 text-stone-900 transition group-hover:text-emerald-700" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-2xl font-serif font-bold tracking-tight text-stone-900 group-hover:text-stone-700 transition">
              Travel Malawi
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {user ? (
              <div className="flex items-center space-x-3 sm:space-x-4">
                {/* Secondary navigation options */}
                <div className="hidden md:flex items-center space-x-5">
                  {hosting ? (
                    <Link
                      to="/dashboard"
                      className={`text-sm font-medium transition relative after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all flex items-center gap-1 ${location.pathname.startsWith('/dashboard') ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}
                    >
                      Dashboard
                      {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  ) : (
                    // Someone who joined to book a stay had no route to hosting at
                    // all: this entry was shown only to signed-out visitors, and
                    // /dashboard bounces a non-host back to the home page.
                    <Link
                      to="/list-your-property"
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 text-xs font-medium transition shadow-2xs"
                    >
                      <Building2 className="w-3.5 h-3.5 text-stone-500" />
                      <span>List Your Property</span>
                    </Link>
                  )}
                  <Link
                    to="/planner"
                    className={`text-sm font-medium transition relative flex items-center gap-1.5 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all ${location.pathname.startsWith('/planner') ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}
                  >
                    <span>Trip Planner</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>AI</span>
                    </span>
                  </Link>
                  {(isAdmin(user) || isMarketing(user)) && (
                    <Link
                      to="/admin"
                      className={`text-sm font-medium transition relative after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all ${location.pathname.startsWith('/admin') ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}
                    >
                      Admin
                    </Link>
                  )}
                  {user && (
                    <>
                      <Link
                        to="/saved"
                        className={`text-sm font-medium transition relative after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all ${location.pathname === '/saved' ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}
                      >
                        Saved
                      </Link>
                      <Link
                        to="/my-bookings"
                        className={`text-sm font-medium transition relative after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all ${location.pathname.startsWith('/my-bookings') ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}
                      >
                        My Bookings
                      </Link>
                    </>
                  )}
                </div>

                {/* Active Chats & Notification Bell */}
                {user && (
                  <div className="flex items-center gap-1">
                    <ActiveChatsMenu ref={activeChatsMenuRef} />
                    <NotificationBell />
                  </div>
                )}

                {/* User avatar + dropdown */}
                <div className="relative pl-3 sm:pl-4 border-l border-stone-200" ref={menuRef}>
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-2.5 rounded-full px-2 sm:px-3 py-1.5 hover:bg-stone-100 transition"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">
                      {initials}
                    </div>
                    <span className="text-sm font-medium text-stone-900 hidden sm:block max-w-[120px] truncate">
                      {user.displayName ?? user.email}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                  </button>

                  {showUserMenu && (
                    <div
                      className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-2xl shadow-xl py-2 z-50"
                      onMouseLeave={() => setShowUserMenu(false)}
                    >
                      <div className="px-4 py-3 border-b border-stone-100">
                        <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-0.5">Signed in as</p>
                        <p className="text-sm font-medium text-stone-900 truncate">{user.email}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{describeRoles(user)}</p>
                      </div>

                      {/* The links below are shown when on mobile */}
                      <div className="md:hidden py-1 border-b border-stone-100">
                        {user && (
                          <>
                            <Link
                              to="/saved"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <Heart className="h-4 w-4" /> Saved properties
                            </Link>
                            <Link
                              to="/my-bookings"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <Briefcase className="h-4 w-4" /> My bookings
                            </Link>
                          </>
                        )}
                        {hosting ? (
                          <>
                            <Link
                              to="/dashboard"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <LayoutDashboard className="h-4 w-4" />
                              <span>Host dashboard</span>
                            </Link>
                            <Link
                              to="/host-guide"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                            >
                              <BookOpen className="h-4 w-4 text-stone-500" />
                              <span>Host Starter Guide</span>
                            </Link>
                          </>
                        ) : (
                          <Link
                            to="/list-your-property"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                          >
                            <Building2 className="h-4 w-4" />
                            <span>List your property</span>
                          </Link>
                        )}
                        {(isAdmin(user) || isMarketing(user)) && (
                          <Link
                            to="/admin"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                          >
                            <ShieldCheck className="h-4 w-4" /> Admin
                          </Link>
                        )}
                      </div>

                      <div className="py-1 border-b border-stone-100">
                        <Link
                          to="/profile"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                        >
                          <UserCircle className="h-4 w-4" /> Profile Settings
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            if (activeChatsMenuRef.current) {
                              activeChatsMenuRef.current.openMenu();
                            }
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <MessageSquare className="h-4 w-4 text-stone-500" />
                            <span>{hosting ? 'Active Guest Chats' : 'Active Chats'}</span>
                          </span>
                          {activeChatsCount > 0 && (
                            <span className="bg-stone-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {activeChatsCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Chat notification sound. Off until asked for: a page
                          that starts making noise on its own is worse than a
                          quiet one, and the click that turns it on is also the
                          gesture browsers require before audio may play. */}
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
                        className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
                      >
                        <span className="flex items-center gap-2.5">
                          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                          Notification sounds
                        </span>
                        <span
                          aria-hidden="true"
                          className={`relative h-5 w-9 shrink-0 rounded-full transition ${soundOn ? 'bg-emerald-600' : 'bg-stone-300'}`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${soundOn ? 'left-[1.125rem]' : 'left-0.5'}`}
                          />
                        </span>
                      </button>

                      <button
                        onClick={() => { logOut(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition border-t border-stone-100"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3 sm:space-x-4">
                {/* Secondary navigation options for visitors */}
                <div className="hidden sm:flex items-center space-x-3 sm:space-x-4">
                  <Link
                    to="/planner"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 text-xs font-medium transition shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Trip Planner</span>
                  </Link>
                  <Link
                    to="/list-your-property"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 text-xs font-medium transition shadow-2xs"
                  >
                    <Building2 className="w-3.5 h-3.5 text-stone-500" />
                    <span>List Your Property</span>
                  </Link>
                </div>

                <button
                  onClick={() => openAuth('signin')}
                  className="rounded-full bg-stone-900 px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-stone-700 transition shadow-sm cursor-pointer"
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
