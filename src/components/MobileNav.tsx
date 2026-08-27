import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Search, Heart, User as UserIcon, Briefcase } from 'lucide-react';
import { isHotelManager, isTraveller } from '../lib/roles';

export default function MobileNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  
  // Hide bottom nav on hotel details pages on mobile to make room for the sticky "Book" bar
  if (pathname.includes('/hotel/')) return null;

  const isManager = isHotelManager(user);
  
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-stone-200 pb-safe">
      <div className="flex items-center justify-around h-16 px-4">
        <Link 
          to="/" 
          className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition ${pathname === '/' ? 'text-stone-900' : 'text-stone-400'}`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-wide">Explore</span>
        </Link>

        {user && isTraveller(user) && (
          <Link 
            to="/my-bookings" 
            className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition ${pathname === '/my-bookings' ? 'text-stone-900' : 'text-stone-400'}`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Trips</span>
          </Link>
        )}

        {user && isManager && (
          <Link 
            to="/dashboard" 
            className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition ${pathname.startsWith('/dashboard') ? 'text-stone-900' : 'text-stone-400'}`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">Manage</span>
          </Link>
        )}
      </div>
    </div>
  );
}
