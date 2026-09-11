import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Booking, RoomType } from '../types';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { 
  Building2, Plus, ChevronRight, Clock, CheckCircle2, XCircle, 
  BedDouble, CalendarCheck, Lock, KeyRound, UserCheck, ArrowRight, 
  Check, ChevronDown, Filter, ExternalLink, SlidersHorizontal, Radio,
  Percent
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthDialog } from '../contexts/AuthDialogContext';

import SmartImage from '../components/SmartImage';
import { getHotelImage } from '../lib/images';
import { isHotelManager, isAdmin } from '../lib/roles';
import MaskedPlaceName from '../components/MaskedPlaceName';
import BulkRoomEditor from '../components/BulkRoomEditor';

import Pagination from '../components/Pagination';

type StatusFilter = 'all' | 'live' | 'pending' | 'offline' | 'needs_attention';
type SortOption = 'default' | 'pending' | 'rooms' | 'name';

export default function ManagerDashboard() {
  const { user, loading: authLoading, becomeHost } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [togglingHotelId, setTogglingHotelId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [bulkEditorHotelId, setBulkEditorHotelId] = useState<string | undefined>(undefined);
  const itemsPerPage = 6;

  const handleOpenBulkEditor = (hotelId?: string) => {
    setBulkEditorHotelId(hotelId);
    setShowBulkEditor(true);
    // Smooth scroll into bulk editor
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleRoomsUpdated = (updatedRooms: RoomType[]) => {
    setRooms(prev => {
      const map = new Map(updatedRooms.map(r => [r.id!, r]));
      return prev.map(r => (r.id && map.has(r.id) ? map.get(r.id)! : r));
    });
  };

  const handleHotelsUpdated = (updatedHotels: Hotel[]) => {
    setHotels(prev => {
      const map = new Map(updatedHotels.map(h => [h.id!, h]));
      return prev.map(h => (h.id && map.has(h.id) ? map.get(h.id)! : h));
    });
  };

  const handleToggleHotelOnline = async (e: React.MouseEvent, hotel: Hotel) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hotel.id || togglingHotelId) return;
    const newStatus = hotel.isOnline === false ? true : false;
    setTogglingHotelId(hotel.id);
    try {
      await updateDoc(doc(db, 'hotels', hotel.id), { isOnline: newStatus });
      setHotels(prev => prev.map(h => h.id === hotel.id ? { ...h, isOnline: newStatus } : h));
      if (newStatus) {
        toast.success(`${hotel.name} is now ONLINE (Accepting guest chats)`);
      } else {
        toast(`${hotel.name} is now OFFLINE (Away)`, { icon: '🌙' });
      }
    } catch (err) {
      console.error('Error toggling online status:', err);
      toast.error('Failed to change online status.');
    } finally {
      setTogglingHotelId(null);
    }
  };
  

  const fetchMyHotels = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'hotels'));
      const allHotels = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];

      const userEmailLower = user?.email?.toLowerCase();
      const userIsAdmin = isAdmin(user);

      const hotelsData = allHotels.filter(h => {
        if (userIsAdmin) return true;
        const hasAssignedManager = Boolean(
          h.managerId &&
          h.managerId !== 'unassigned' &&
          h.managerId !== 'none' &&
          h.managerId.trim() !== ''
        );

        if (hasAssignedManager && h.managerId === user?.uid) return true;
        if (userEmailLower) {
          if (h.managerEmail && h.managerEmail.toLowerCase() === userEmailLower) return true;
          if (h.ownerEmail && h.ownerEmail.toLowerCase() === userEmailLower) return true;
          if (h.contactEmail && h.contactEmail.toLowerCase() === userEmailLower) return true;
        }
        if ((h as any).ownerId === user?.uid || (h as any).createdBy === user?.uid) return true;
        
        // Unassigned properties belong to the signed-in user
        if (!hasAssignedManager) return true;

        return false;
      });

      setHotels(hotelsData);

      // A dashboard that only lists names cannot tell you which property needs
      // you today, so each card carries its room count and pending requests.
      const ids = hotelsData.map(h => h.id).filter(Boolean) as string[];
      if (ids.length > 0) {
        // `in` takes at most 30 values per query, which is far more properties
        // than one manager will have, but the slice keeps it honest.
        const batch = ids.slice(0, 30);
        const [roomSnap, bookingSnap] = await Promise.all([
          getDocs(query(collection(db, 'room_types'), where('hotelId', 'in', batch))),
          getDocs(query(collection(db, 'bookings'), where('hotelId', 'in', batch))),
        ]);
        setRooms(roomSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
        setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      }
    } catch (error) {
      console.error("Error fetching hotels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isHotelManager(user)) {
      setLoading(false);
      return;
    }
    fetchMyHotels();
  }, [user, authLoading]);

  const handleActivateHost = async () => {
    setActivating(true);
    try {
      await becomeHost();
      toast.success('Property Owner tools activated! Loading your dashboard...');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate property owner status.');
    } finally {
      setActivating(false);
    }
  };

  /** Room count and outstanding requests, per property. */
  const summaryByHotel = useMemo(() => {
    const map = new Map<string, { rooms: number; pending: number }>();
    for (const hotel of hotels) {
      if (!hotel.id) continue;
      map.set(hotel.id, {
        rooms: rooms.filter(r => r.hotelId === hotel.id).length,
        pending: bookings.filter(b => b.hotelId === hotel.id && b.status === 'pending').length,
      });
    }
    return map;
  }, [hotels, rooms, bookings]);

  const totalPending = bookings.filter(b => b.status === 'pending').length;
  const liveCount = hotels.filter(h => (!h.status || h.status === 'approved') && h.isOnline !== false).length;
  const pendingApprovalCount = hotels.filter(h => h.status === 'pending').length;
  const offlineCount = hotels.filter(h => h.isOnline === false).length;
  const needsAttentionCount = hotels.filter(h => {
    const s = summaryByHotel.get(h.id!);
    return (s?.pending ?? 0) > 0 || (s?.rooms ?? 0) === 0 || h.status === 'pending';
  }).length;

  const filteredHotels = useMemo(() => {
    let list = [...hotels];
    if (statusFilter === 'live') {
      list = list.filter(h => (!h.status || h.status === 'approved') && h.isOnline !== false);
    } else if (statusFilter === 'pending') {
      list = list.filter(h => h.status === 'pending');
    } else if (statusFilter === 'offline') {
      list = list.filter(h => h.isOnline === false);
    } else if (statusFilter === 'needs_attention') {
      list = list.filter(h => {
        const s = summaryByHotel.get(h.id!);
        return (s?.pending ?? 0) > 0 || (s?.rooms ?? 0) === 0 || h.status === 'pending';
      });
    }

    if (sortBy === 'pending') {
      list.sort((a, b) => (summaryByHotel.get(b.id!)?.pending ?? 0) - (summaryByHotel.get(a.id!)?.pending ?? 0));
    } else if (sortBy === 'rooms') {
      list.sort((a, b) => (summaryByHotel.get(b.id!)?.rooms ?? 0) - (summaryByHotel.get(a.id!)?.rooms ?? 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [hotels, statusFilter, sortBy, summaryByHotel]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 py-8 sm:py-12 px-3.5 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-stone-200 shadow-2xs text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 mx-auto mb-4">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
              Host Dashboard Access
            </h1>
            <p className="text-stone-600 text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed">
              The Host Dashboard is reserved for registered Malawian property owners, B&B hosts, lodge managers, cottage operators, and safari camps.
            </p>

            <div className="mt-6 grid sm:grid-cols-2 gap-3 text-left">
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                <div className="font-bold text-stone-900 flex items-center justify-between">
                  <span>Guest Account</span>
                  <span className="text-[10px] text-stone-500 uppercase">Traveler</span>
                </div>
                <ul className="text-stone-600 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Browse stays, B&amp;Bs &amp; direct host chats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Booking vouchers &amp; trip list</span>
                  </li>
                  <li className="text-stone-400 italic">
                    (No dashboard or listing tools)
                  </li>
                </ul>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-stone-900 text-white border border-stone-800 text-xs space-y-2">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Property Owner Account</span>
                  <span className="text-[10px] text-stone-300 uppercase font-semibold">Host</span>
                </div>
                <ul className="text-stone-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Host Dashboard: Manage rooms &amp; rates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Host Starter Pack &amp; response templates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>0% commission direct WhatsApp stays</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
              <button
                onClick={() => openAuth('host')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-full text-xs sm:text-sm transition shadow-2xs cursor-pointer"
              >
                <span>Sign Up as Property Owner</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-full text-xs sm:text-sm transition border border-stone-200 cursor-pointer"
              >
                <span>Sign In to Existing Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isHotelManager(user)) {
    return (
      <div className="min-h-screen bg-stone-50 py-8 sm:py-12 px-3.5 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-stone-200 shadow-2xs text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium mb-4">
              <UserCheck className="w-3.5 h-3.5 text-stone-500" />
              <span className="truncate max-w-[200px] sm:max-w-none">Signed in as Guest ({user.email})</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
              Property Owner Permissions Required
            </h1>
            <p className="text-stone-600 text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed">
              You are currently signed in with a Guest account. To view the Host Dashboard and list properties, activate your free host permissions below.
            </p>

            <div className="mt-5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-stone-50 border border-stone-200 text-xs text-left space-y-2 max-w-md mx-auto">
              <div className="font-semibold text-stone-900">What will be enabled:</div>
              <ul className="text-stone-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Full access to this Host Dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Host Starter Pack &amp; onboarding toolkit</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-800 shrink-0" />
                  <span>Preserves all your current bookings &amp; favorites</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
              <button
                onClick={handleActivateHost}
                disabled={activating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-full text-xs sm:text-sm transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4 text-stone-300" />
                <span>{activating ? 'Activating Host Tools…' : 'Activate Property Owner Account (Free)'}</span>
              </button>
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-full text-xs sm:text-sm transition border border-stone-200"
              >
                <span>Back to Stays</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 md:py-10 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 sm:mb-7 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">Host Dashboard</h1>
          <p className="text-stone-500 mt-0.5 sm:mt-1 text-xs sm:text-sm">
            {totalPending > 0
              ? `${totalPending} booking request${totalPending === 1 ? '' : 's'} waiting for your reply.`
              : 'Overview of your properties, rooms, and booking requests.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {rooms.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenBulkEditor()}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs ${
                showBulkEditor
                  ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 ring-2 ring-amber-500/50'
                  : 'bg-white hover:bg-stone-100 text-stone-800 border border-stone-200'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 text-amber-600" />
              <span>{showBulkEditor ? 'Close Bulk Editor' : 'Bulk Room & Rates Editor'}</span>
            </button>
          )}

          <Link
            to="/list-your-property"
            className="inline-flex items-center justify-center gap-1.5 bg-stone-900 text-white px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold hover:bg-stone-800 transition shadow-2xs w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Add a property
          </Link>
        </div>
      </div>

      {/* Overview Stats Bar (2 cols on mobile/tablet, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3.5 mb-4 sm:mb-6">
        <button
          onClick={() => {
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          className={`p-2.5 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border text-left transition focus:outline-none focus:ring-2 focus:ring-stone-900 cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
              : 'bg-white text-stone-900 border-stone-200 shadow-2xs hover:border-stone-300'
          }`}
        >
          <div className={`w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center mb-1.5 ${
            statusFilter === 'all' ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600'
          }`}>
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <p className={`text-[10px] sm:text-xs font-medium mb-0.5 truncate ${statusFilter === 'all' ? 'text-stone-300' : 'text-stone-500'}`}>
            Properties
          </p>
          <p className="text-sm sm:text-lg lg:text-xl font-bold">{hotels.length}</p>
        </button>

        <button
          onClick={() => {
            setStatusFilter(statusFilter === 'live' ? 'all' : 'live');
            setCurrentPage(1);
          }}
          className={`p-2.5 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border text-left transition focus:outline-none focus:ring-2 focus:ring-stone-900 cursor-pointer ${
            statusFilter === 'live'
              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
              : 'bg-white text-stone-900 border-stone-200 shadow-2xs hover:border-stone-300'
          }`}
        >
          <div className={`w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center mb-1.5 ${
            statusFilter === 'live' ? 'bg-white/10 text-white' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <p className={`text-[10px] sm:text-xs font-medium mb-0.5 truncate ${statusFilter === 'live' ? 'text-stone-300' : 'text-stone-500'}`}>
            Live &amp; Online
          </p>
          <p className="text-sm sm:text-lg lg:text-xl font-bold">{liveCount}</p>
        </button>

        <button
          onClick={() => {
            setStatusFilter(statusFilter === 'needs_attention' ? 'all' : 'needs_attention');
            setCurrentPage(1);
          }}
          className={`p-2.5 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border text-left transition focus:outline-none focus:ring-2 focus:ring-stone-900 cursor-pointer ${
            statusFilter === 'needs_attention'
              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
              : 'bg-white text-stone-900 border-stone-200 shadow-2xs hover:border-stone-300'
          }`}
        >
          <div className={`w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center mb-1.5 ${
            statusFilter === 'needs_attention' ? 'bg-white/10 text-white' : 'bg-amber-50 text-amber-600'
          }`}>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <p className={`text-[10px] sm:text-xs font-medium mb-0.5 truncate ${statusFilter === 'needs_attention' ? 'text-stone-300' : 'text-stone-500'}`}>
            Needs Attention
          </p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-sm sm:text-lg lg:text-xl font-bold">{needsAttentionCount}</p>
            {totalPending > 0 && (
              <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                statusFilter === 'needs_attention' ? 'bg-amber-400 text-stone-950' : 'bg-amber-100 text-amber-800'
              }`}>
                {totalPending} req
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleOpenBulkEditor()}
          className="p-2.5 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-2xs bg-white text-stone-900 hover:border-amber-400 hover:shadow-xs transition text-left cursor-pointer group"
          title="Click to open Bulk Room & Rates Editor"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 group-hover:bg-amber-200 px-1.5 py-0.5 rounded-full transition">
              Bulk Rates ⚡
            </span>
          </div>
          <p className="text-stone-500 text-[10px] sm:text-xs font-medium mb-0.5 truncate">Total Rooms</p>
          <p className="text-sm sm:text-lg lg:text-xl font-bold">{rooms.length}</p>
        </button>
      </div>

      {/* Optional Bulk Room & Rate Editor Section */}
      {showBulkEditor && (
        <div className="mb-7 transition-all">
          <BulkRoomEditor
            hotels={hotels}
            rooms={rooms}
            initialHotelId={bulkEditorHotelId}
            isEmbedded={true}
            onClose={() => setShowBulkEditor(false)}
            onRoomsUpdated={handleRoomsUpdated}
            onHotelsUpdated={handleHotelsUpdated}
          />
        </div>
      )}

      {/* Quick Bulk Tool Invitation Banner */}
      {!showBulkEditor && rooms.length > 0 && (
        <div className="mb-6 bg-stone-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 border border-stone-800 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-sm sm:text-base text-white">Bulk Room &amp; Rates Editor</h3>
                <span className="text-[10px] font-bold bg-amber-400 text-stone-950 px-2 py-0.2 rounded-full uppercase tracking-wider">
                  Optional Tool
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Apply percentage discounts, price drops, or promotional campaigns across multiple rooms simultaneously with custom percentages or amounts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenBulkEditor()}
            className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shrink-0 shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Open Bulk Editor</span>
          </button>
        </div>
      )}

      {/* Filter & Sort Dropdown Bar */}
      {hotels.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-5">
          {/* Mobile dropdown (< md) */}
          <div className="md:hidden relative flex-1">
            <label htmlFor="host-status-filter" className="sr-only">Filter properties by status</label>
            <select
              id="host-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setCurrentPage(1);
              }}
              className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 appearance-none pr-8 shadow-2xs focus:ring-2 focus:ring-stone-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Properties ({hotels.length})</option>
              <option value="live">Live &amp; Online ({liveCount})</option>
              <option value="needs_attention">Needs Attention ({needsAttentionCount})</option>
              <option value="pending">Awaiting Approval ({pendingApprovalCount})</option>
              <option value="offline">Offline ({offlineCount})</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Desktop segmented buttons (>= md) */}
          <div className="hidden md:flex items-center gap-1.5 p-1 bg-stone-100/90 rounded-2xl border border-stone-200">
            {([
              { id: 'all' as StatusFilter, label: 'All', count: hotels.length },
              { id: 'live' as StatusFilter, label: 'Live', count: liveCount },
              { id: 'needs_attention' as StatusFilter, label: 'Needs Attention', count: needsAttentionCount },
              { id: 'pending' as StatusFilter, label: 'Pending Approval', count: pendingApprovalCount },
              { id: 'offline' as StatusFilter, label: 'Offline', count: offlineCount },
            ]).map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setStatusFilter(item.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === item.id
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
                }`}
              >
                <span>{item.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === item.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                }`}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative shrink-0 sm:w-44">
            <label htmlFor="host-sort-filter" className="sr-only">Sort properties</label>
            <select
              id="host-sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 appearance-none pr-8 shadow-2xs focus:ring-2 focus:ring-stone-900 focus:outline-none cursor-pointer"
            >
              <option value="default">Sort: Default</option>
              <option value="pending">Sort: Most Pending</option>
              <option value="rooms">Sort: Most Rooms</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Property Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 md:gap-5">
        {hotels.length === 0 ? (
          <div className="col-span-full bg-white p-6 sm:p-10 md:p-12 text-center rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xs">
            <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-stone-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-serif text-stone-900 mb-1.5">Nothing listed yet</h3>
            <p className="text-stone-500 text-xs sm:text-sm max-w-md mx-auto mb-5 sm:mb-6">
              Walk through your first listing in four steps — the basics, the description,
              your photographs, then rooms and rates.
            </p>
            <Link
              to="/list-your-property"
              className="inline-block bg-stone-900 text-white px-5 sm:px-6 py-2.5 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold hover:bg-stone-800 transition"
            >
              List your first property
            </Link>
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="col-span-full bg-white p-6 sm:p-10 text-center rounded-2xl border border-stone-200 shadow-2xs">
            <p className="text-sm font-semibold text-stone-700 mb-2">No properties matching this filter</p>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-xs text-emerald-700 font-bold underline cursor-pointer"
            >
              Reset filter to show all ({hotels.length})
            </button>
          </div>
        ) : (
          filteredHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((hotel) => {
            const summary = summaryByHotel.get(hotel.id!) || { rooms: 0, pending: 0 };
            const pendingCount = summary.pending;
            const roomsCount = summary.rooms;

            return (
              <div
                key={`mgr-hotel-${hotel.id}`}
                className="group bg-white rounded-2xl md:rounded-3xl shadow-2xs border border-stone-200 overflow-hidden flex flex-col hover:border-stone-300 hover:shadow-sm transition duration-200"
              >
                {/* Card Media Header */}
                <div className="w-full aspect-[16/10] sm:aspect-auto sm:h-36 md:h-44 bg-stone-100 relative shrink-0 overflow-hidden">
                  <SmartImage
                    src={getHotelImage(hotel)}
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-out"
                  />

                  {/* Status Badge */}
                  <span className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-2xs ${
                    hotel.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                    hotel.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {hotel.status === 'pending' ? <><Clock className="h-2.5 w-2.5" /> Pending</>
                      : hotel.status === 'rejected' ? <><XCircle className="h-2.5 w-2.5" /> Unpublished</>
                      : <><CheckCircle2 className="h-2.5 w-2.5" /> Live</>}
                  </span>

                  {/* Online/Offline Toggle */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleHotelOnline(e, hotel)}
                    disabled={togglingHotelId === hotel.id}
                    className={`absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-2xs backdrop-blur-md transition cursor-pointer ${
                      hotel.isOnline !== false
                        ? 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/40'
                        : 'bg-stone-900/80 text-stone-300 hover:bg-stone-800 border border-stone-700/60'
                    }`}
                    title="Click to toggle Host Online/Offline Status"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${hotel.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'}`} />
                    <span>{hotel.isOnline !== false ? 'Online' : 'Offline'}</span>
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-3 sm:p-3.5 md:p-4 flex-1 flex flex-col min-w-0">
                  <div className="mb-1.5 min-w-0">
                    <h3 className="text-sm sm:text-base font-serif font-bold text-stone-900 truncate">
                      <MaskedPlaceName name={hotel.name} fallback="[Your Listed Lodge]" />
                    </h3>
                    <p className="text-stone-500 text-[11px] sm:text-xs truncate">{hotel.location || 'Malawi'}</p>
                  </div>

                  {/* Room & Booking Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
                    <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2 py-0.5 rounded-lg font-medium text-[11px] sm:text-xs">
                      <BedDouble className="w-3 h-3 text-stone-400" />
                      {roomsCount} {roomsCount === 1 ? 'room type' : 'room types'}
                    </span>
                    {pendingCount > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg font-bold text-[11px] sm:text-xs">
                        <CalendarCheck className="w-3 h-3 text-amber-600" />
                        {pendingCount} awaiting reply
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-stone-50 text-stone-500 px-2 py-0.5 rounded-lg text-[11px] sm:text-xs border border-stone-100">
                        <CalendarCheck className="w-3 h-3 text-stone-400" />
                        0 requests
                      </span>
                    )}
                  </div>

                  {roomsCount === 0 && (
                    <p className="mb-3 text-[11px] sm:text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-2.5 py-1.5">
                      Add a room to accept bookings.
                    </p>
                  )}

                  {/* Quick Action Button Group */}
                  <div className="mt-auto pt-2.5 border-t border-stone-100 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Link
                        to={`/dashboard/hotel/${hotel.id}`}
                        className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1 transition"
                      >
                        <span>Manage</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                      <Link
                        to={`/dashboard/hotel/${hotel.id}?tab=bookings`}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1 transition"
                      >
                        <span>Bookings</span>
                        {pendingCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        )}
                      </Link>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5 px-1">
                      <Link
                        to={`/dashboard/hotel/${hotel.id}?tab=rooms`}
                        className="hover:text-stone-900 font-medium"
                      >
                        Edit Rooms &amp; Rates →
                      </Link>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOpenBulkEditor(hotel.id);
                          }}
                          className="hover:text-amber-700 text-stone-600 flex items-center gap-1 font-semibold cursor-pointer"
                          title="Open Bulk Rate Editor for this hotel"
                        >
                          <SlidersHorizontal className="w-3 h-3 text-amber-600" />
                          <span>Bulk Rates</span>
                        </button>

                        <Link
                          to={`/hotel/${hotel.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-700 flex items-center gap-0.5 font-medium"
                        >
                          <span>Preview</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredHotels.length > itemsPerPage && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredHotels.length / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
