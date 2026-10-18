import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Booking, RoomType } from '../types';
import { db, auth } from '../lib/firebase';
import { Hotel } from '../types';
import { 
  Building2, Plus, ChevronRight, Clock, CheckCircle2, XCircle, 
  BedDouble, CalendarCheck, CalendarSync, Lock, KeyRound, UserCheck, ArrowRight, 
  Check, ChevronDown, Filter, ExternalLink, SlidersHorizontal, Radio,
  Percent, Trash2, AlertCircle, X, TrendingUp
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthDialog } from '../contexts/AuthDialogContext';

import SmartImage from '../components/SmartImage';
import { getHotelImage } from '../lib/images';
import { isHotelManager, isAdmin, isMarketing } from '../lib/roles';
import { logSystemEvent } from '../lib/logger';
import MaskedPlaceName from '../components/MaskedPlaceName';
import BulkRoomEditor from '../components/BulkRoomEditor';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import IcalSyncManager from '../components/IcalSyncManager';

import Pagination from '../components/Pagination';

type StatusFilter = 'all' | 'live' | 'pending' | 'offline' | 'needs_attention';
type SortOption = 'default' | 'pending' | 'rooms' | 'name';

export default function ManagerDashboard() {
  const { user, loading: authLoading, becomeHost, isShadowing, shadowedUser, actualUser } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [togglingHotelId, setTogglingHotelId] = useState<string | null>(null);
  const userIsAdmin = Boolean(!isShadowing && (actualUser || user) && (isAdmin(actualUser || user) || isMarketing(actualUser || user)));
  const [approvingHotelId, setApprovingHotelId] = useState<string | null>(null);
  const [icalModalHotel, setIcalModalHotel] = useState<Hotel | null>(null);

  const handleApproveListing = async (hotel: Hotel) => {
    if (!hotel.id) return;
    setApprovingHotelId(hotel.id);
    try {
      await updateDoc(doc(db, 'hotels', hotel.id), {
        status: 'approved',
        updatedAt: Date.now(),
      });
      setHotels(prev => prev.map(h => h.id === hotel.id ? { ...h, status: 'approved' } : h));
      await logSystemEvent(
        'action',
        `Approved stay from host dashboard: ${hotel.name}`,
        { hotelId: hotel.id, status: 'approved' },
        user,
        'property'
      );
      toast.success(`"${hotel.name}" has been approved and is now live!`);
    } catch (err: any) {
      console.error('Failed to approve property:', err);
      toast.error('Failed to approve property: ' + (err?.message || 'Permission denied'));
    } finally {
      setApprovingHotelId(null);
    }
  };

  const handleRejectListing = async (hotel: Hotel) => {
    if (!hotel.id) return;
    const confirmed = window.confirm(`Reject listing "${hotel.name}"? It will be unpublished.`);
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'hotels', hotel.id), {
        status: 'rejected',
        updatedAt: Date.now(),
      });
      setHotels(prev => prev.map(h => h.id === hotel.id ? { ...h, status: 'rejected' } : h));
      await logSystemEvent(
        'action',
        `Rejected stay from host dashboard: ${hotel.name}`,
        { hotelId: hotel.id, status: 'rejected' },
        user,
        'property'
      );
      toast.success(`"${hotel.name}" marked as rejected.`);
    } catch (err: any) {
      console.error('Failed to reject property:', err);
      toast.error('Failed to reject property: ' + (err?.message || 'Permission denied'));
    }
  };

  type DashboardTab = 'all' | 'live' | 'pending' | 'needs_attention' | 'bulk_editor';
  const [activeTab, setActiveTab] = useState<DashboardTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [bulkEditorHotelId, setBulkEditorHotelId] = useState<string | undefined>(undefined);
  const [hotelToDelete, setHotelToDelete] = useState<Hotel | null>(null);
  const [isDeletingHotel, setIsDeletingHotel] = useState(false);
  const itemsPerPage = 6;

  const handleConfirmDeleteHotel = async () => {
    if (!hotelToDelete?.id || isDeletingHotel) return;
    const targetHotel = hotelToDelete;
    setIsDeletingHotel(true);
    try {
      const roomsSnap = await getDocs(query(collection(db, 'room_types'), where('hotelId', '==', targetHotel.id)));
      const batch = writeBatch(db);
      roomsSnap.docs.forEach(rDoc => batch.delete(rDoc.ref));
      batch.delete(doc(db, 'hotels', targetHotel.id));
      await batch.commit();

      setHotels(prev => prev.filter(h => h.id !== targetHotel.id));
      setRooms(prev => prev.filter(r => r.hotelId !== targetHotel.id));
      toast.success(`"${targetHotel.name}" permanently deleted.`);
      setHotelToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete property:', err);
      toast.error(err?.message || 'Failed to delete property listing.');
    } finally {
      setIsDeletingHotel(false);
    }
  };

  const handleOpenBulkEditor = (hotelId?: string) => {
    setBulkEditorHotelId(hotelId);
    setActiveTab('bulk_editor');
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

      // firestore.rules only honours an email match for a verified address;
      // listing an unverified match would show a property whose saves all fail.
      const emailTrusted = isShadowing || auth.currentUser?.emailVerified === true;
      const rawEmailLower = user?.email?.toLowerCase();
      const userEmailLower = emailTrusted ? rawEmailLower : undefined;
      const userIsAdmin = !isShadowing && Boolean(user && (isAdmin(user) || isMarketing(user)));
      const shadowedHotelIds: string[] = Array.isArray((user as any)?.managedHotelIds)
        ? (user as any).managedHotelIds
        : [];

      const hotelsData = allHotels.filter(h => {
        if (userIsAdmin) return true;
        if (h.id && shadowedHotelIds.includes(h.id)) return true;
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

        // Unassigned properties are managed by admins only.
        return false;
      });

      if (!emailTrusted && rawEmailLower && allHotels.some(h =>
        !hotelsData.includes(h) && [h.managerEmail, h.ownerEmail, h.contactEmail].some(e => e?.toLowerCase() === rawEmailLower)
      )) {
        toast(`Verify ${user?.email} to manage the properties listed under it: open the link we emailed you, then sign in again.`, { duration: 8000, id: 'verify-host-email' });
      }

      setHotels(hotelsData);
      if (hotelsData.length > 0 && user && !isShadowing && !isHotelManager(user) && !isAdmin(user) && !isMarketing(user)) {
        becomeHost().catch(() => {});
      }

      // A dashboard that only lists names cannot tell you which property needs
      // you today, so each card carries its room count and pending requests.
      const ids = hotelsData.map(h => h.id).filter(Boolean) as string[];
      if (ids.length > 0) {
        // `in` takes at most 30 values per query, so admins with many
        // properties are fetched in chunks rather than silently truncated.
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
        const roomResults = await Promise.all(chunks.map(batch =>
          getDocs(query(collection(db, 'room_types'), where('hotelId', 'in', batch)))
        ));
        setRooms(roomResults.flatMap(roomSnap => roomSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType))));
        // Bookings are private: the rules authorise a manager per property, which
        // needs one equality query per hotel rather than an 'in' query.
        const bookingResults = await Promise.all(ids.map(hid =>
          getDocs(query(collection(db, 'bookings'), where('hotelId', '==', hid)))
            .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)))
            .catch(err => {
              console.warn(`Bookings for ${hid} unavailable:`, err?.message ?? err);
              return [] as Booking[];
            })
        ));
        setBookings(bookingResults.flat());
      }
    } catch (error) {
      console.error("Error fetching hotels:", error);
      toast.error('Could not load your properties. Check your connection and refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
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

  /** Room count, units, and reservation metrics per property. */
  const summaryByHotel = useMemo(() => {
    const map = new Map<string, { rooms: number; units: number; pending: number; confirmed: number }>();
    for (const hotel of hotels) {
      if (!hotel.id) continue;
      const hotelRooms = rooms.filter(r => r.hotelId === hotel.id);
      const hotelBookings = bookings.filter(b => b.hotelId === hotel.id);
      map.set(hotel.id, {
        rooms: hotelRooms.length,
        units: hotelRooms.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
        pending: hotelBookings.filter(b => b.status === 'pending').length,
        confirmed: hotelBookings.filter(b => b.status === 'confirmed').length,
      });
    }
    return map;
  }, [hotels, rooms, bookings]);

  const totalPending = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookingsList = bookings.filter(b => b.status === 'confirmed');
  const confirmedBookingsCount = confirmedBookingsList.length;
  const revenueMWK = confirmedBookingsList
    .filter(b => !b.currency || b.currency === 'MWK')
    .reduce((sum, b) => sum + (Number(b.total) || 0), 0);
  const revenueUSD = confirmedBookingsList
    .filter(b => b.currency === 'USD')
    .reduce((sum, b) => sum + (Number(b.total) || 0), 0);
  const totalRoomUnits = rooms.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const syncedPropertiesCount = hotels.filter(
    h => (h.icalSyncUrls?.length || 0) > 0 || rooms.some(r => r.hotelId === h.id && (r.icalSyncUrls?.length || 0) > 0)
  ).length;
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
          <div className="bg-white rounded-2xl p-5 sm:p-8 border border-stone-200 shadow-2xs text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-800 mx-auto mb-4">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
              Host Dashboard Access
            </h1>
            <p className="text-stone-600 text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed">
              The Host Dashboard is reserved for registered Malawian property owners, B&B hosts, lodge managers, cottage operators, and safari camps.
            </p>

            <div className="mt-6 grid sm:grid-cols-2 gap-3 text-left">
              <div className="p-3.5 sm:p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
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

              <div className="p-3.5 sm:p-4 rounded-xl bg-stone-900 text-white border border-stone-800 text-xs space-y-2">
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

  if (!isHotelManager(user) && !isAdmin(user) && !isMarketing(user)) {
    return (
      <div className="min-h-screen bg-stone-50 py-8 sm:py-12 px-3.5 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-8 border border-stone-200 shadow-2xs text-center">
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

            <div className="mt-5 p-3.5 sm:p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-left space-y-2 max-w-md mx-auto">
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
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 md:py-10 pb-24 w-full">
      {isShadowing && (
        <div className="mb-5 sm:mb-6 p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 text-stone-100 flex items-center justify-between gap-3.5 flex-wrap shadow-2xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">
                Shadowing Host: {user?.displayName || user?.email}
              </p>
              <p className="text-xs text-stone-300 mt-0.5">
                Viewing dashboard and listings from this property manager&apos;s perspective. Actions taken are securely logged for support.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-5 sm:mb-6 bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">Host Dashboard</h1>
          <p className="text-stone-500 mt-0.5 text-xs sm:text-sm">
            {totalPending > 0
              ? `${totalPending} booking request${totalPending === 1 ? '' : 's'} waiting for your reply.`
              : 'Overview of your listings, units, and booking requests.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {rooms.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'bulk_editor' ? 'all' : 'bulk_editor')}
              className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs border ${
                activeTab === 'bulk_editor'
                  ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                  : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{activeTab === 'bulk_editor' ? 'View Properties' : 'Bulk Room & Rates Editor'}</span>
            </button>
          )}

          <Link
            to="/list-your-property"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add a property</span>
          </Link>
        </div>
      </div>

      {/* Host Telemetry & Performance Summary Strip */}
      {hotels.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 mb-5 sm:mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setStatusFilter('all');
              setCurrentPage(1);
            }}
            className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">Portfolio &amp; Status</span>
              <Building2 className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums">{hotels.length}</p>
              <span className="text-xs text-emerald-700 font-semibold">{liveCount} live</span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {pendingApprovalCount > 0
                ? `${pendingApprovalCount} pending review`
                : offlineCount > 0
                ? `${offlineCount} offline`
                : 'All stays active'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleOpenBulkEditor()}
            className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">Room Inventory &amp; Sync</span>
              <BedDouble className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums">{totalRoomUnits}</p>
              <span className="text-xs text-stone-500 font-normal">units ({rooms.length} types)</span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {syncedPropertiesCount > 0
                ? `${syncedPropertiesCount} ${syncedPropertiesCount === 1 ? 'stay' : 'stays'} iCal synced`
                : 'Click to manage rooms & rates'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('needs_attention');
              setStatusFilter('needs_attention');
              setCurrentPage(1);
            }}
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xs text-left transition cursor-pointer ${
              totalPending > 0
                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">Reservation Requests</span>
              <CalendarCheck className={`w-3.5 h-3.5 ${totalPending > 0 ? 'text-amber-600 animate-pulse' : 'text-stone-400'}`} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className={`text-xl sm:text-2xl font-bold tabular-nums ${totalPending > 0 ? 'text-amber-900' : 'text-stone-900'}`}>
                {bookings.length}
              </p>
              <span className="text-xs text-emerald-700 font-semibold">
                {confirmedBookingsCount} confirmed
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {totalPending > 0 ? `${totalPending} awaiting host reply` : '0 pending requests'}
            </p>
          </button>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-2xs text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">Confirmed Volume (0% Fee)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-stone-900 tabular-nums truncate">
              MK {revenueMWK.toLocaleString()}
            </p>
            <div className="flex items-center justify-between mt-0.5 text-xs">
              <span className="font-mono font-semibold text-emerald-800">
                + USD ${revenueUSD.toLocaleString()}
              </span>
              <span className="text-stone-400 hidden sm:inline">100% direct</span>
            </div>
          </div>
        </div>
      )}

      {/* Uniform Wrapping Grid Navigation Tabs (Matching ManageHotel) */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-1.5 sm:gap-2 p-2 bg-white border border-stone-200 rounded-2xl shadow-2xs mb-5 sm:mb-6"
        role="tablist"
        aria-label="Dashboard views"
      >
        {/* Tab 1: All Properties */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => {
            setActiveTab('all');
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          className={`flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none min-w-0 ${
            activeTab === 'all'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'bg-stone-50/90 text-stone-700 hover:text-stone-950 hover:bg-stone-100 border border-stone-200/70'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'all' ? 'text-white' : 'text-stone-500'}`} />
            <span className="truncate">All Properties</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 font-bold ${
            activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-stone-200/70 text-stone-700'
          }`}>
            {hotels.length}
          </span>
        </button>

        {/* Tab 2: Live & Online */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'live'}
          onClick={() => {
            setActiveTab('live');
            setStatusFilter('live');
            setCurrentPage(1);
          }}
          className={`flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none min-w-0 ${
            activeTab === 'live'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'bg-stone-50/90 text-stone-700 hover:text-stone-950 hover:bg-stone-100 border border-stone-200/70'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'live' ? 'text-emerald-300' : 'text-emerald-600'}`} />
            <span className="truncate">Live &amp; Online</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 font-bold ${
            activeTab === 'live' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
          }`}>
            {liveCount}
          </span>
        </button>

        {/* Tab: Pending Review */}
        {pendingApprovalCount > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending'}
            onClick={() => {
              setActiveTab('pending');
              setStatusFilter('pending');
              setCurrentPage(1);
            }}
            className={`flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none min-w-0 ${
              activeTab === 'pending'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100/80 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'pending' ? 'text-amber-300' : 'text-amber-600'}`} />
              <span className="truncate">Pending Review</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 font-bold ${
              activeTab === 'pending' ? 'bg-amber-400 text-stone-950' : 'bg-amber-100 text-amber-900 border border-amber-200'
            }`}>
              {pendingApprovalCount}
            </span>
          </button>
        )}

        {/* Tab 3: Needs Attention */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'needs_attention'}
          onClick={() => {
            setActiveTab('needs_attention');
            setStatusFilter('needs_attention');
            setCurrentPage(1);
          }}
          className={`flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none min-w-0 ${
            activeTab === 'needs_attention'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'bg-stone-50/90 text-stone-700 hover:text-stone-950 hover:bg-stone-100 border border-stone-200/70'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Clock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'needs_attention' ? 'text-white' : 'text-stone-500'}`} />
            <span className="truncate">Needs Attention</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold ${
              activeTab === 'needs_attention' ? 'bg-white/20 text-white' : 'bg-stone-200/70 text-stone-700'
            }`}>
              {needsAttentionCount}
            </span>
            {totalPending > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                activeTab === 'needs_attention' ? 'bg-amber-400 text-stone-950' : 'bg-amber-100 text-amber-900'
              }`}>
                {totalPending} req
              </span>
            )}
          </div>
        </button>

        {/* Tab 4: Room Inventory & Bulk Rates */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bulk_editor'}
          onClick={() => {
            handleOpenBulkEditor();
          }}
          className={`flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none min-w-0 ${
            activeTab === 'bulk_editor'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'bg-stone-50/90 text-stone-700 hover:text-stone-950 hover:bg-stone-100 border border-stone-200/70'
          }`}
          title="Open Bulk Room & Rates Editor"
        >
          <div className="flex items-center gap-2 min-w-0">
            <BedDouble className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'bulk_editor' ? 'text-white' : 'text-stone-500'}`} />
            <span className="truncate">Rooms &amp; Rates</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 font-bold ${
            activeTab === 'bulk_editor' ? 'bg-white/20 text-white' : 'bg-stone-200/70 text-stone-700'
          }`}>
            {rooms.length}
          </span>
        </button>
      </div>

      {/* Tab Content 1: Bulk Room & Rate Editor Section */}
      {activeTab === 'bulk_editor' ? (
        <div className="mb-7 transition-all animate-in fade-in duration-150">
          <BulkRoomEditor
            hotels={hotels}
            rooms={rooms}
            initialHotelId={bulkEditorHotelId}
            isEmbedded={true}
            onClose={() => {
              setActiveTab('all');
              setStatusFilter('all');
            }}
            onRoomsUpdated={handleRoomsUpdated}
            onHotelsUpdated={handleHotelsUpdated}
          />
        </div>
      ) : (
        <>

      {/* Sort Dropdown */}
      {hotels.length > 0 && (
        <div className="flex justify-end mb-5">
          <div className="relative shrink-0 w-full sm:w-48 text-left">
            <button
              type="button"
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="w-full flex items-center justify-between h-9 bg-white border border-stone-200 rounded-xl px-3.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-stone-900"
            >
              <span>
                {sortBy === 'default' && 'Sort: Default'}
                {sortBy === 'pending' && 'Sort: Most Pending'}
                {sortBy === 'rooms' && 'Sort: Most Rooms'}
                {sortBy === 'name' && 'Sort: Name (A-Z)'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1.5 p-1 bg-white border border-stone-200 rounded-xl shadow-lg z-20 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  {[
                    { value: 'default', label: 'Default' },
                    { value: 'pending', label: 'Most Pending' },
                    { value: 'rooms', label: 'Most Rooms' },
                    { value: 'name', label: 'Name (A-Z)' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.value as SortOption);
                        setSortMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                        sortBy === opt.value ? 'bg-stone-100 text-stone-900 font-semibold' : 'text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Property Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 md:gap-5">
        {hotels.length === 0 ? (
          <div className="col-span-full bg-white p-6 sm:p-10 md:p-12 text-center rounded-2xl border border-stone-200 shadow-2xs">
            <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-stone-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-serif font-bold text-stone-900 mb-1.5">Nothing listed yet</h3>
            <p className="text-stone-500 text-xs sm:text-sm max-w-md mx-auto mb-5 sm:mb-6">
              Walk through your first listing in four steps — the basics, the description,
              your photographs, then rooms and rates.
            </p>
            <Link
              to="/list-your-property"
              className="inline-flex items-center justify-center h-10 bg-stone-900 text-white px-5 rounded-xl text-xs sm:text-sm font-semibold hover:bg-stone-800 transition shadow-2xs"
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
                className="group bg-white rounded-2xl shadow-2xs border border-stone-200/90 overflow-visible flex flex-col hover:border-stone-300 hover:shadow-xs transition duration-200"
              >
                {/* Card Media Header */}
                <div className="w-full aspect-[16/10] sm:aspect-auto sm:h-36 md:h-44 bg-stone-100 relative shrink-0 overflow-hidden rounded-t-2xl">
                  <SmartImage
                    src={getHotelImage(hotel)}
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-102 transition duration-500 ease-out"
                  />

                  {/* Status Badge / Quick Moderation Action */}
                  {hotel.status === 'pending' ? (
                    userIsAdmin ? (
                      <button
                        type="button"
                        disabled={approvingHotelId === hotel.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleApproveListing(hotel);
                        }}
                        className="absolute top-2.5 left-2.5 z-20 max-w-[calc(100%-6rem)] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-emerald-600 active:scale-95 text-white border border-amber-600/40 hover:border-emerald-700/40 shadow-xs transition cursor-pointer select-none"
                        title="Click to approve this stay and make it live on Travel Malawi"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {approvingHotelId === hotel.id ? 'Approving...' : 'Pending · Approve'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toast('This listing has been submitted and is awaiting administrator verification before going live.');
                        }}
                        className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/95 backdrop-blur-xs text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-50 transition cursor-pointer"
                        title="Listing is pending review"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                        <span>Pending review</span>
                      </button>
                    )
                  ) : (
                    <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/95 backdrop-blur-xs text-stone-800 border border-stone-200/90 shadow-2xs">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        hotel.status === 'rejected' ? 'bg-stone-400' :
                        'bg-emerald-600'
                      }`} />
                      <span>
                        {hotel.status === 'rejected' ? 'Unpublished' : 'Live'}
                      </span>
                    </span>
                  )}

                  {/* Online/Offline Toggle */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleHotelOnline(e, hotel)}
                    disabled={togglingHotelId === hotel.id}
                    className={`absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer select-none shadow-2xs border ${
                      hotel.isOnline !== false
                        ? 'bg-white/95 hover:bg-white text-stone-800 border-stone-200/90'
                        : 'bg-white/90 hover:bg-white text-stone-500 border-stone-200/70'
                    }`}
                    title="Click to toggle Host Online/Offline Status"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hotel.isOnline !== false ? 'bg-emerald-600' : 'bg-stone-300'}`} />
                    <span>{hotel.isOnline !== false ? 'Online' : 'Offline'}</span>
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-3.5 sm:p-4 flex-1 flex flex-col min-w-0">
                  <div className="mb-2 min-w-0">
                    <h3 className="text-sm sm:text-base font-serif font-bold text-stone-900 truncate">
                      <MaskedPlaceName name={hotel.name} fallback="[Your Listed Lodge]" />
                    </h3>
                    <p className="text-stone-500 text-xs truncate">{hotel.location || 'Malawi'}</p>
                  </div>

                  {/* Room & Booking Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
                    <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2 py-0.5 rounded-lg font-medium text-[11px]">
                      <BedDouble className="w-3 h-3 text-stone-400" />
                      {roomsCount} {roomsCount === 1 ? 'room type' : 'room types'}
                    </span>
                    {pendingCount > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg font-bold text-[11px]">
                        <CalendarCheck className="w-3 h-3 text-amber-600" />
                        {pendingCount} awaiting reply
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-stone-50 text-stone-500 px-2 py-0.5 rounded-lg text-[11px] border border-stone-100">
                        <CalendarCheck className="w-3 h-3 text-stone-400" />
                        0 requests
                      </span>
                    )}
                    {(() => {
                      const syncedFeedsCount = (hotel.icalSyncUrls?.length || 0) +
                        rooms.filter(r => r.hotelId === hotel.id).reduce((sum, r) => sum + (r.icalSyncUrls?.length || 0), 0);
                      if (syncedFeedsCount === 0) {
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIcalModalHotel(hotel);
                            }}
                            className="inline-flex items-center gap-1 text-stone-500 hover:text-amber-800 text-[11px] font-medium transition cursor-pointer"
                            title="Connect RoomRaccoon, Airbnb, or external PMS calendar"
                          >
                            <CalendarSync className="w-3 h-3 text-stone-400" />
                            <span>Connect iCal</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIcalModalHotel(hotel);
                          }}
                          className="inline-flex items-center gap-1.5 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                          title="Click to view & test live 2-way calendar sync connections"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <CalendarSync className="w-3 h-3 text-emerald-700" />
                          <span>iCal Synced ({syncedFeedsCount})</span>
                        </button>
                      );
                    })()}
                  </div>

                  {roomsCount === 0 && (
                    <p className="mb-3 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-1.5">
                      Add a room to accept bookings.
                    </p>
                  )}

                  {hotel.status === 'pending' && userIsAdmin && (
                    <div className="mb-3 flex items-center justify-between gap-2 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-950">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-semibold text-[11px] truncate">Pending Review</span>
                      </div>
                      <button
                        type="button"
                        disabled={approvingHotelId === hotel.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleApproveListing(hotel);
                        }}
                        className="inline-flex items-center gap-1 h-7 px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-semibold text-[11px] transition shadow-2xs shrink-0 cursor-pointer"
                        title="Approve this stay to make it live"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{approvingHotelId === hotel.id ? 'Approving...' : 'Approve Stay'}</span>
                      </button>
                    </div>
                  )}

                  {/* Quick Action Button Group */}
                  <div className="mt-auto pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Link
                        to={`/dashboard/hotel/${hotel.id}`}
                        className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold h-9 px-3 rounded-xl flex items-center justify-center gap-1 transition shadow-2xs flex-1 truncate"
                      >
                        <span>Manage</span>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      </Link>
                      <Link
                        to={`/dashboard/hotel/${hotel.id}?tab=bookings`}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold h-9 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0"
                        title="View Bookings"
                      >
                        <span>Bookings</span>
                        {pendingCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </Link>
                    </div>

                    <div className="relative shrink-0 text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenCardMenuId(openCardMenuId === hotel.id ? null : hotel.id!);
                        }}
                        className="h-9 px-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition cursor-pointer flex items-center gap-1 text-xs font-semibold shadow-2xs"
                        aria-label="More actions"
                      >
                        <span>Actions</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${openCardMenuId === hotel.id ? 'rotate-180' : ''}`} />
                      </button>

                      {openCardMenuId === hotel.id && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCardMenuId(null);
                            }}
                          />
                          <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-40 text-left animate-in fade-in zoom-in-95 duration-150">
                            {/* Elevated Moderation Actions */}
                            {userIsAdmin && hotel.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={approvingHotelId === hotel.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenCardMenuId(null);
                                    handleApproveListing(hotel);
                                  }}
                                  className="w-full px-3 py-2 text-xs text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 flex items-center gap-2 font-bold transition cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{approvingHotelId === hotel.id ? 'Approving...' : 'Approve Stay (Go Live)'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenCardMenuId(null);
                                    handleRejectListing(hotel);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 font-medium transition cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>Reject Stay</span>
                                </button>

                                <div className="my-1 border-t border-stone-100" />
                              </>
                            )}

                            <Link
                              to={`/dashboard/hotel/${hotel.id}?tab=rooms`}
                              onClick={() => setOpenCardMenuId(null)}
                              className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition"
                            >
                              <BedDouble className="w-3.5 h-3.5 text-stone-400" />
                              <span>Rooms &amp; Rates</span>
                            </Link>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenCardMenuId(null);
                                handleOpenBulkEditor(hotel.id);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition cursor-pointer"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
                              <span>Bulk Rate Editor</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenCardMenuId(null);
                                setIcalModalHotel(hotel);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition cursor-pointer"
                            >
                              <CalendarSync className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Calendar Sync (iCal / PMS)</span>
                            </button>

                            <a
                              href={`/hotel/${hotel.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenCardMenuId(null)}
                              className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                              <span>Preview Listing</span>
                            </a>

                            <div className="my-1 border-t border-stone-100" />

                            <button
                              type="button"
                              onClick={(e) => {
                                handleToggleHotelOnline(e, hotel);
                                setOpenCardMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hotel.isOnline !== false ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                                <span>{hotel.isOnline !== false ? 'Set Offline (Away)' : 'Set Online'}</span>
                              </span>
                            </button>

                            <div className="my-1 border-t border-stone-100" />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenCardMenuId(null);
                                setHotelToDelete(hotel);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Delete Listing</span>
                            </button>
                          </div>
                        </>
                      )}
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
        </>
      )}

      <ConfirmDialog
        isOpen={!!hotelToDelete}
        title="Delete Property Listing"
        message={`Are you sure you want to permanently delete "${hotelToDelete?.name}"? All associated room inventory and listings settings will be permanently removed. This action cannot be undone.`}
        confirmText={isDeletingHotel ? "Deleting..." : "Yes, delete property"}
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDeleteHotel}
        onCancel={() => {
          if (!isDeletingHotel) setHotelToDelete(null);
        }}
      />

      {/* 2-Way Calendar Synchronization Modal */}
      <Modal
        open={Boolean(icalModalHotel)}
        onClose={() => setIcalModalHotel(null)}
        title={`Calendar Sync — ${icalModalHotel?.name || 'Property'}`}
        description="2-way calendar sync with RoomRaccoon, Airbnb, Booking.com, NightsBridge, and other PMS systems."
        size="3xl"
      >
        {icalModalHotel && (
          <IcalSyncManager
            hotel={icalModalHotel}
            onHotelUpdated={(updated) => {
              setHotels(prev => prev.map(h => h.id === updated.id ? updated : h));
              setIcalModalHotel(updated);
            }}
            onClose={() => setIcalModalHotel(null)}
          />
        )}
      </Modal>
    </div>
  );
}
