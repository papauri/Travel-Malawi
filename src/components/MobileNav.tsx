import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { Search, LogIn, User as UserIcon, Briefcase, Building2 } from 'lucide-react';
import { isHotelManager, isTraveller } from '../lib/roles';

export default function MobileNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();

  // Hide bottom nav on hotel details pages on mobile to make room for the sticky "Book" bar
  if (pathname.includes('/hotel/')) return null;

  const isManager = isHotelManager(user);
  const itemClass = (active: boolean) =>
    `flex flex-col items-center justify-center w-16 h-full gap-1 transition ${active ? 'text-stone-900' : 'text-stone-400'}`;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-stone-200 pb-safe">
      <div className="flex items-center justify-around h-16 px-4">
        <Link to="/" className={itemClass(pathname === '/')}>
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-wide">Explore</span>
        </Link>

        {user && isTraveller(user) && (
          <Link to="/my-bookings" className={itemClass(pathname === '/my-bookings')}>
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Trips</span>
          </Link>
        )}

        {isManager ? (
          <Link to="/dashboard" className={itemClass(pathname.startsWith('/dashboard'))}>
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Manage</span>
          </Link>
        ) : (
          // Hosting was reachable on a phone only by knowing the URL: this slot
          // existed solely for accounts that already had the manager role.
          <Link to="/list-your-property" className={itemClass(pathname === '/list-your-property')}>
            <Building2 className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Host</span>
          </Link>
        )}

        {!user && (
          <button onClick={() => openAuth('signin')} className={itemClass(false)}>
            <LogIn className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Sign in</span>
          </button>
        )}
      </div>
    </div>
  );
}
