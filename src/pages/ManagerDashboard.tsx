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
import { usePlatformMode } from '../contexts/PlatformModeContext';

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
  // Directory mode (D3): no bookings, revenue, iCal or chat presence here;
  // the dashboard is for keeping listings accurate. Booking data is untouched.
  const { bookingsEnabled } = usePlatformMode();

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

  // Pending requests per card. Read only while the booking platform is on (D3).
  const hotelIdsKey = hotels.map(h => h.id).filter(Boolean).join(',');
  useEffect(() => {
    const ids = hotelIdsKey ? hotelIdsKey.split(',') : [];
    if (!bookingsEnabled || ids.length === 0) {
      setBookings([]);
      return;
    }
    let cancelled = false;
    // Bookings are private: the rules authorise a manager per property, which
    // needs one equality query per hotel rather than an 'in' query.
    Promise.all(ids.map(hid =>
      getDocs(query(collection(db, 'bookings'), where('hotelId', '==', hid)))
        .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)))
        .catch(err => {
          console.warn(`Bookings for ${hid} unavailable:`, err?.message ?? err);
          return [] as Booking[];
        })
    )).then(results => {
      if (!cancelled) setBookings(results.flat());
    });
    return () => { cancelled = true; };
  }, [bookingsEnabled, hotelIdsKey]);

  const handleActivateHost = async () => {
    setActivating(true);
    try {
      await becomeHost();
      toast.success('Host tools are on. Loading your dashboard…');
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
  const isLive = (h: Hotel) => (!h.status || h.status === 'approved') && (!bookingsEnabled || h.isOnline !== false);
  const liveCount = hotels.filter(isLive).length;
  const pendingApprovalCount = hotels.filter(h => h.status === 'pending').length;
  const offlineCount = bookingsEnabled ? hotels.filter(h => h.isOnline === false).length : 0;
  const needsAttentionCount = hotels.filter(h => {
    const s = summaryByHotel.get(h.id!);
    return (s?.pending ?? 0) > 0 || (s?.rooms ?? 0) === 0 || h.status === 'pending';
  }).length;

  const filteredHotels = useMemo(() => {
    let list = [...hotels];
    if (statusFilter === 'live') {
      list = list.filter(isLive);
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
  }, [hotels, statusFilter, sortBy, summaryByHotel, bookingsEnabled]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 py-10 sm:py-14">
        <div className="tm-page max-w-xl">
          <div className="tm-panel text-center">
            <Lock className="w-6 h-6 text-stone-400 mx-auto mb-3" />
            <h1 className="tm-h1">Host dashboard</h1>
            <p className="tm-lead mt-2 mx-auto">
              For property owners and managers in Malawi. Sign in or create a host account to manage your stays.
            </p>

            <ul className="mt-5 mx-auto max-w-xs space-y-1.5 text-left text-sm text-stone-600">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-stone-500 shrink-0" />
                <span>Manage rooms and rates</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-stone-500 shrink-0" />
                <span>{bookingsEnabled ? 'Reply to booking requests' : 'Keep your contact details current'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-stone-500 shrink-0" />
                <span>{bookingsEnabled ? 'No commission on direct stays' : 'Travellers contact you directly'}</span>
              </li>
            </ul>

            <div className="mt-6 tm-actions justify-center">
              <button
                onClick={() => openAuth('host')}
                className="tm-btn tm-btn-primary w-full sm:w-auto"
              >
                <span>Create a host account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="tm-btn tm-btn-secondary w-full sm:w-auto"
              >
                <span>Sign in</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isHotelManager(user) && !isAdmin(user) && !isMarketing(user)) {
    return (
      <div className="min-h-screen bg-stone-50 py-10 sm:py-14">
        <div className="tm-page max-w-xl">
          <div className="tm-panel text-center">
            <p className="tm-tag max-w-full mb-4">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Signed in as {user.email}</span>
            </p>
            <h1 className="tm-h1">Turn on host tools</h1>
            <p className="tm-lead mt-2 mx-auto">
              Your account is a guest account. Turn on host tools (free) to list and manage properties. {bookingsEnabled ? 'Your bookings and favourites stay as they are.' : 'Your saved places stay as they are.'}
            </p>

            <div className="mt-6 tm-actions justify-center">
              <button
                onClick={handleActivateHost}
                disabled={activating}
                className="tm-btn tm-btn-primary w-full sm:w-auto"
              >
                <KeyRound className="w-4 h-4" />
                <span>{activating ? 'Turning on host tools…' : 'Turn on host tools'}</span>
              </button>
              <Link to="/" className="tm-btn tm-btn-secondary w-full sm:w-auto">
                <span>Back to stays</span>
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
    <div className="tm-page py-6 sm:py-8 pb-24 min-w-0">
      {isShadowing && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <UserCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="min-w-0 break-words">
            Viewing as {user?.displayName || user?.email}. Actions you take are logged for support.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="tm-h1">Host dashboard</h1>
          <p className="tm-muted mt-1">
            {totalPending > 0
              ? `${totalPending} booking request${totalPending === 1 ? '' : 's'} waiting for your reply.`
              : bookingsEnabled ? 'Your listings, rooms and booking requests.' : 'Your listings and rooms. Keep them accurate; travellers contact you directly.'}
          </p>
        </div>
        <div className="tm-actions shrink-0">
          <Link to="/list-your-property" className="tm-btn tm-btn-primary">
            <Plus className="h-4 w-4" />
            <span>Add a property</span>
          </Link>
        </div>
      </div>

      {/* Summary row */}
      {hotels.length > 0 && (
        <div className={`grid grid-cols-2 ${bookingsEnabled ? 'lg:grid-cols-4' : ''} gap-3 mb-5`}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setStatusFilter('all');
              setCurrentPage(1);
            }}
            className="tm-stat text-left hover:border-stone-300 transition-colors cursor-pointer"
          >
            <p className="tm-stat-label">Properties</p>
            <p className="tm-stat-value">{hotels.length}</p>
            <p className="mt-0.5 text-xs text-stone-500 truncate">
              {liveCount} live
              {pendingApprovalCount > 0
                ? ` · ${pendingApprovalCount} pending review`
                : offlineCount > 0
                ? ` · ${offlineCount} offline`
                : ''}
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleOpenBulkEditor()}
            className="tm-stat text-left hover:border-stone-300 transition-colors cursor-pointer"
          >
            <p className="tm-stat-label">Rooms</p>
            <p className="tm-stat-value">{totalRoomUnits}</p>
            <p className="mt-0.5 text-xs text-stone-500 truncate">
              {rooms.length} {rooms.length === 1 ? 'type' : 'types'}
              {bookingsEnabled && syncedPropertiesCount > 0 ? ` · ${syncedPropertiesCount} calendar synced` : ''}
            </p>
          </button>

          {bookingsEnabled && (<>
          <button
            type="button"
            onClick={() => {
              setActiveTab('needs_attention');
              setStatusFilter('needs_attention');
              setCurrentPage(1);
            }}
            className={`tm-stat text-left hover:border-stone-300 transition-colors cursor-pointer ${
              totalPending > 0 ? 'ring-1 ring-amber-300' : ''
            }`}
          >
            <p className="tm-stat-label">Bookings</p>
            <p className="tm-stat-value">{bookings.length}</p>
            <p className={`mt-0.5 text-xs truncate ${totalPending > 0 ? 'text-amber-800 font-medium' : 'text-stone-500'}`}>
              {totalPending > 0 ? `${totalPending} awaiting reply` : `${confirmedBookingsCount} confirmed`}
            </p>
          </button>

          <div className="tm-stat">
            <p className="tm-stat-label">Confirmed revenue</p>
            <p className="tm-stat-value truncate">
              MK {revenueMWK.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-stone-500 tabular-nums truncate">
              + ${revenueUSD.toLocaleString()} · no commission
            </p>
          </div>
          </>)}
        </div>
      )}

      {/* View tabs */}
      <div
        className="tm-tabs mb-5"
        role="tablist"
        aria-label="Dashboard views"
      >
        {([
          { id: 'all', label: 'All', count: hotels.length, show: true },
          { id: 'live', label: 'Live', count: liveCount, show: true },
          { id: 'pending', label: 'Pending review', count: pendingApprovalCount, show: pendingApprovalCount > 0 },
          { id: 'needs_attention', label: 'Needs attention', count: needsAttentionCount, show: true },
          { id: 'bulk_editor', label: 'Rooms & rates', count: rooms.length, show: true },
        ] as const).filter((t) => t.show).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => {
              if (t.id === 'bulk_editor') {
                handleOpenBulkEditor();
                return;
              }
              setActiveTab(t.id);
              setStatusFilter(t.id);
              setCurrentPage(1);
            }}
            className={`tm-tab inline-flex items-center gap-1.5 ${activeTab === t.id ? 'tm-tab-active' : ''}`}
          >
            <span>{t.label}</span>
            <span className={`tabular-nums ${activeTab === t.id ? 'text-stone-600' : 'text-stone-400'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content 1: Bulk Room & Rate Editor Section */}
      {activeTab === 'bulk_editor' ? (
        <div className="mb-7 min-w-0">
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
      {hotels.length > 1 && (
        <div className="flex justify-end mb-4">
          <div className="relative shrink-0 w-full sm:w-48 text-left">
            <button
              type="button"
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="tm-btn tm-btn-secondary tm-btn-sm w-full justify-between"
            >
              <span>
                {sortBy === 'default' && 'Sort: default'}
                {sortBy === 'pending' && 'Sort: most pending'}
                {sortBy === 'rooms' && 'Sort: most rooms'}
                {sortBy === 'name' && 'Sort: name (A–Z)'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1.5 p-1 bg-white border border-stone-200 rounded-lg shadow-sm z-20 flex flex-col gap-0.5">
                  {[
                    { value: 'default', label: 'Default' },
                    ...(bookingsEnabled ? [{ value: 'pending', label: 'Most pending' }] : []),
                    { value: 'rooms', label: 'Most rooms' },
                    { value: 'name', label: 'Name (A–Z)' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.value as SortOption);
                        setSortMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {hotels.length === 0 ? (
          <div className="col-span-full tm-panel text-center py-10">
            <Building2 className="h-10 w-10 text-stone-300 mx-auto mb-3" />
            <h3 className="tm-h2 mb-1">Nothing listed yet</h3>
            <p className="tm-muted max-w-md mx-auto mb-5">
              Add your first property in four short steps.
            </p>
            <Link to="/list-your-property" className="tm-btn tm-btn-secondary">
              List your first property
            </Link>
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="col-span-full tm-panel text-center py-8">
            <p className="text-sm text-stone-700 mb-2">No properties match this filter.</p>
            <button
              onClick={() => setStatusFilter('all')}
              className="tm-link text-sm cursor-pointer"
            >
              Show all ({hotels.length})
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
                className="bg-white rounded-xl border border-stone-200 flex flex-col min-w-0 hover:border-stone-300 transition-colors"
              >
                {/* Card Media Header */}
                <div className="w-full aspect-[16/10] sm:aspect-auto sm:h-36 md:h-40 bg-stone-100 relative shrink-0 overflow-hidden rounded-t-xl">
                  <SmartImage
                    src={getHotelImage(hotel)}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Status badge (admins approve from the card body or the More menu) */}
                  {hotel.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toast('This listing is waiting for review before it goes live.');
                      }}
                      className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-white/95 text-amber-900 border border-amber-200 hover:bg-amber-50 transition-colors cursor-pointer"
                      title="Listing is pending review"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                      <span>Pending review</span>
                    </button>
                  ) : (
                    <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-white/95 text-stone-800 border border-stone-200">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        hotel.status === 'rejected' ? 'bg-stone-400' :
                        'bg-emerald-600'
                      }`} />
                      <span>
                        {hotel.status === 'rejected' ? 'Unpublished' : 'Live'}
                      </span>
                    </span>
                  )}

                  {/* Online/Offline Toggle (chat presence: booking mode only) */}
                  {bookingsEnabled && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleHotelOnline(e, hotel)}
                    disabled={togglingHotelId === hotel.id}
                    className={`absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer select-none border ${
                      hotel.isOnline !== false
                        ? 'bg-white/95 hover:bg-white text-stone-800 border-stone-200'
                        : 'bg-white/90 hover:bg-white text-stone-500 border-stone-200'
                    }`}
                    title="Switch this listing online or offline"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hotel.isOnline !== false ? 'bg-emerald-600' : 'bg-stone-300'}`} />
                    <span>{hotel.isOnline !== false ? 'Online' : 'Offline'}</span>
                  </button>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col min-w-0">
                  <div className="mb-2 min-w-0">
                    <h3 className="font-serif text-base font-semibold text-stone-900 truncate">
                      <MaskedPlaceName name={hotel.name} fallback="[Your Listed Lodge]" />
                    </h3>
                    <p className="text-stone-500 text-xs truncate">{hotel.location || 'Malawi'}</p>
                  </div>

                  {/* Room & Booking Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 min-w-0">
                    <span className="tm-tag">
                      <BedDouble className="w-3 h-3 text-stone-400" />
                      {roomsCount} {roomsCount === 1 ? 'room type' : 'room types'}
                    </span>
                    {pendingCount > 0 && (
                      <span className="tm-tag tm-tag-warn">
                        <CalendarCheck className="w-3 h-3" />
                        {pendingCount} awaiting reply
                      </span>
                    )}
                    {bookingsEnabled && (() => {
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
                            className="inline-flex items-center gap-1 text-stone-500 hover:text-amber-800 text-xs font-medium transition-colors cursor-pointer"
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
                          className="tm-tag tm-tag-good hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="View and test calendar sync"
                        >
                          <CalendarSync className="w-3 h-3" />
                          <span>Calendar synced ({syncedFeedsCount})</span>
                        </button>
                      );
                    })()}
                  </div>

                  {roomsCount === 0 && (
                    <p className="mb-3 text-xs text-amber-800">
                      {bookingsEnabled ? 'Add a room to accept bookings.' : 'Add a room so travellers can see what you offer.'}
                    </p>
                  )}

                  {hotel.status === 'pending' && userIsAdmin && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 min-w-0 text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-medium truncate">Waiting for your review</span>
                      </div>
                      <button
                        type="button"
                        disabled={approvingHotelId === hotel.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleApproveListing(hotel);
                        }}
                        className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                        title="Approve this stay to make it live"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{approvingHotelId === hotel.id ? 'Approving…' : 'Approve'}</span>
                      </button>
                    </div>
                  )}

                  {/* Quick Action Button Group */}
                  <div className="mt-auto pt-3 tm-divider tm-actions">
                    <Link
                      to={`/dashboard/hotel/${hotel.id}`}
                      className="tm-btn tm-btn-primary tm-btn-sm flex-1 min-w-0"
                    >
                      <span className="truncate">Manage</span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    </Link>
                    {bookingsEnabled && (
                    <Link
                      to={`/dashboard/hotel/${hotel.id}?tab=bookings`}
                      className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                      title="View bookings"
                    >
                      <span>Bookings</span>
                      {pendingCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </Link>
                    )}

                    <div className="relative shrink-0 text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenCardMenuId(openCardMenuId === hotel.id ? null : hotel.id!);
                        }}
                        className="tm-btn tm-btn-quiet tm-btn-sm"
                        aria-label="More actions"
                      >
                        <span>More</span>
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
                          <div className="absolute right-0 bottom-full mb-1.5 w-52 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-sm border border-stone-200 py-1 z-40 text-left">
                            {/* Admin moderation actions */}
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
                                  className="w-full px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{approvingHotelId === hotel.id ? 'Approving…' : 'Approve and go live'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenCardMenuId(null);
                                    handleRejectListing(hotel);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 font-medium transition cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                  <span>Reject</span>
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
                              <span>Rooms and rates</span>
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
                              <span>Edit rates in bulk</span>
                            </button>

                            {bookingsEnabled && (
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
                              <CalendarSync className="w-3.5 h-3.5 text-stone-400" />
                              <span>Calendar sync</span>
                            </button>
                            )}

                            <a
                              href={`/hotel/${hotel.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenCardMenuId(null)}
                              className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                              <span>Preview listing</span>
                            </a>

                            {bookingsEnabled && (<>
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
                                <span>{hotel.isOnline !== false ? 'Set offline' : 'Set online'}</span>
                              </span>
                            </button>
                            </>)}

                            <div className="my-1 border-t border-stone-100" />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenCardMenuId(null);
                                setHotelToDelete(hotel);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              <span>Delete listing</span>
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
        title="Delete property listing"
        message={`Are you sure you want to permanently delete "${hotelToDelete?.name}"? All associated room inventory and listings settings will be permanently removed. This action cannot be undone.`}
        confirmText={isDeletingHotel ? "Deleting…" : "Yes, delete property"}
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDeleteHotel}
        onCancel={() => {
          if (!isDeletingHotel) setHotelToDelete(null);
        }}
      />

      {/* 2-Way Calendar Synchronization Modal */}
      <Modal
        open={bookingsEnabled && Boolean(icalModalHotel)}
        onClose={() => setIcalModalHotel(null)}
        title={`Calendar Sync — ${icalModalHotel?.name || 'Property'}`}
        description="2-way calendar sync with RoomRaccoon, Airbnb, Booking.com, NightsBridge, and other PMS systems."
        size="3xl"
      >
        {bookingsEnabled && icalModalHotel && (
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
