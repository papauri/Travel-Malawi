import React, { useState, useEffect } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { Search, LogIn, User as UserIcon, Briefcase, Building2, Heart, Menu, X, LogOut, Settings } from 'lucide-react';
import { isHotelManager, isTraveller, describeRoles, isAdmin } from '../lib/roles';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileNav() {
  const { pathname } = useLocation();
  const { user, logOut } = useAuth();
  const { openAuth } = useAuthDialog();
  const [isOpen, setIsOpen] = useState(false);
  useBodyScrollLock(isOpen);
  const isManager = isHotelManager(user);

  // Close the sheet when location changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Hide bottom nav on hotel details pages on mobile to make room for the sticky "Book" bar
  if (pathname.includes('/hotel/')) return null;

  // If user is a manager or admin, they have the Concierge Assistant on bottom-right and full nav in the top Navbar avatar
  if (user && (isManager || isAdmin(user))) return null;

  return (
    <>
      {/* Floating Action Button */}
      <div className="md:hidden fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-stone-900 text-white p-3.5 sm:p-4 rounded-full shadow-2xl hover:bg-stone-800 transition-transform active:scale-95 flex items-center justify-center border border-stone-700/50"
          aria-label="Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              role="button"
              tabIndex={0}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setIsOpen(false);
                }
              }}
              className="md:hidden fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60] cursor-pointer"
            />
            
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[70] overflow-hidden flex flex-col pb-safe max-h-[85vh]"
            >
              <div className="p-5 flex items-center justify-between border-b border-stone-100 relative">
                <h2 className="font-serif font-bold text-xl text-stone-900">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-stone-100 transition text-stone-500 hover:text-stone-900"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-200 rounded-full" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {user && (
                  <div className="mb-4 px-4 py-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-sm font-bold text-stone-900 truncate">{user.displayName || user.email}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{describeRoles(user)}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <Link
                    to="/"
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition ${pathname === '/' ? 'bg-stone-100 text-stone-900 font-bold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                  >
                    <Search className="w-5 h-5" />
                    <span>Explore</span>
                  </Link>

                  {user && isTraveller(user) && (
                    <>
                      <Link
                        to="/saved"
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition ${pathname === '/saved' ? 'bg-stone-100 text-stone-900 font-bold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                      >
                        <Heart className="w-5 h-5" />
                        <span>Saved Properties</span>
                      </Link>
                      <Link
                        to="/my-bookings"
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition ${pathname === '/my-bookings' ? 'bg-stone-100 text-stone-900 font-bold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                      >
                        <Briefcase className="w-5 h-5" />
                        <span>My Trips</span>
                      </Link>
                    </>
                  )}
                </div>

                <div className="my-4 h-px bg-stone-100 w-full" />

                <div className="space-y-1">
                  {isManager ? (
                    <Link
                      to="/dashboard"
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition ${pathname.startsWith('/dashboard') ? 'bg-stone-100 text-stone-900 font-bold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                    >
                      <Building2 className="w-5 h-5" />
                      <span>Host Dashboard</span>
                    </Link>
                  ) : (
                    <Link
                      to="/list-your-property"
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition ${pathname === '/list-your-property' ? 'bg-stone-100 text-stone-900 font-bold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                    >
                      <Building2 className="w-5 h-5" />
                      <span>List your property</span>
                    </Link>
                  )}

                  {user ? (
                    <>
                      <Link
                        to="/profile"
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition ${pathname === '/profile' ? 'bg-stone-100 text-stone-900 font-bold' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                      >
                        <Settings className="w-5 h-5" />
                        <span>Profile Settings</span>
                      </Link>
                      <button
                        onClick={() => { logOut(); setIsOpen(false); }}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Sign out</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { openAuth('signin'); setIsOpen(false); }}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition text-stone-900 font-medium hover:bg-stone-50"
                    >
                      <LogIn className="w-5 h-5" />
                      <span>Sign in to your account</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
