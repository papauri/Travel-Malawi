import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where, writeBatch } from 'firebase/firestore';
import { todayStr } from '../lib/dates';
import { db, auth } from '../lib/firebase';
import { Hotel, User, Booking, Role, RoomType } from '../types';
import { SystemSettings } from '../hooks/useSystemSettings';
import { 
  Shield, ShieldCheck, Building2, CheckCircle, CheckCircle2, XCircle, Clock, MapPin, 
  MapPinOff, Users, Edit2, Edit3, Key, Trash2, Star, ExternalLink, 
  MessageSquare, MessageSquareOff, LayoutDashboard, CalendarRange, CalendarSync, RefreshCw, FileText, 
  Search, Activity, Cpu, Target, Download, ChevronDown, MoreHorizontal, Check, X, Eye,
  Radio
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import { PIN_PROBLEM_LABELS, mapLinkUrl, pinProblem } from '../lib/geo';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import ReviewListingModal from '../components/ReviewListingModal';
import AdminAISettings from '../components/AdminAISettings';
import AdminDocsHub from '../components/AdminDocsHub';
import AdminReviewScraper from '../components/AdminReviewScraper';
import AdminEmailSettings from '../components/AdminEmailSettings';
import AdminWhatsAppSettings from '../components/AdminWhatsAppSettings';
import AdminIcalMonitor from '../components/AdminIcalMonitor';
import AdminLogs from '../components/AdminLogs';
import AdminTrafficMonitor from '../components/AdminTrafficMonitor';
import { logSystemEvent } from '../lib/logger';
import { getHotelImage } from '../lib/images';
import { isAdmin, isGlobalAdmin, isMarketing, isHotelManager, userRoles, toRoleFields, isOwnerEmail } from '../lib/roles';
import { formatMoney } from '../lib/booking';
import { updateBookingWithSlot, deleteBookingWithSlot, cancelBookingReminders } from '../lib/bookingWrites';
import { useConfirmBooking } from '../hooks/useConfirmBooking';
import PriceMismatchNotice from '../components/PriceMismatchNotice';
import { Navigation, TrendingUp, BookOpen, Mail, Settings } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import PriceDisplay from '../components/PriceDisplay';

type Tab = 'overview' | 'traffic' | 'analytics' | 'properties' | 'reviews' | 'users' | 'bookings' | 'destinations' | 'content' | 'ai' | 'logs' | 'docs' | 'settings' | 'channels';

export default function AdminDashboard() {
  const { user, actualUser, loading: authLoading, resetPassword } = useAuth();
  const confirmFlow = useConfirmBooking();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const urlTab = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['overview', 'traffic', 'analytics', 'properties', 'reviews', 'users', 'bookings', 'destinations', 'content', 'ai', 'logs', 'docs', 'settings', 'channels'];
  const initialTab = urlTab && validTabs.includes(urlTab) ? urlTab : 'overview';
  
  const [activeTab, setActiveTabState] = useState<Tab>(initialTab);

  const scrollToTopInstant = () => {
    if (typeof window === 'undefined') return;
    try {
      const lenis = (window as any).__lenis;
      if (lenis && typeof lenis.scrollTo === 'function') {
        lenis.scrollTo(0, { immediate: true });
      }
    } catch {}
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
    scrollToTopInstant();
  };

  useEffect(() => {
    const currentTab = searchParams.get('tab') as Tab | null;
    if (currentTab && validTabs.includes(currentTab) && currentTab !== activeTab) {
      setActiveTabState(currentTab);
    } else if (!currentTab && activeTab !== 'overview') {
      setActiveTabState('overview');
    }
  }, [searchParams]);

  const [settingsSubTab, setSettingsSubTab] = useState<'channels' | 'whatsapp' | 'email'>('channels');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const navContainerRef = useRef<HTMLElement | null>(null);

  // Reset main page scroll to top when switching Admin sections, and keep active tab visible inside sidebar nav container only
  useEffect(() => {
    scrollToTopInstant();
    const rafId = requestAnimationFrame(() => {
      scrollToTopInstant();
      if (activeTabRef.current && navContainerRef.current) {
        const container = navContainerRef.current;
        const btn = activeTabRef.current;
        const btnTop = btn.offsetTop;
        const btnBottom = btnTop + btn.offsetHeight;
        const viewTop = container.scrollTop;
        const viewBottom = viewTop + container.clientHeight;
        if (btnTop < viewTop) {
          container.scrollTop = Math.max(0, btnTop - 12);
        } else if (btnBottom > viewBottom) {
          container.scrollTop = btnBottom - container.clientHeight + 12;
        }
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeTab, settingsSubTab]);
  
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [inspectingHotel, setInspectingHotel] = useState<Hotel | null>(null);
  const [reviewScraperHotelId, setReviewScraperHotelId] = useState<string>('');
  const [hotelStatusFilter, setHotelStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [currentHotelPage, setCurrentHotelPage] = useState(1);
  const [currentFeaturedPage, setCurrentFeaturedPage] = useState(1);
  const [onlyBadPins, setOnlyBadPins] = useState(false);
  const [hotelSearch, setHotelSearch] = useState('');
  
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  
  const [currentBookingPage, setCurrentBookingPage] = useState(1);
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [togglingPremium, setTogglingPremium] = useState(false);
  const [customDestinations, setCustomDestinations] = useState<string[]>([]);
  const [manualDestinationsEnabled, setManualDestinationsEnabled] = useState(false);
  const [featuredMode, setFeaturedMode] = useState<'auto' | 'manual' | 'disabled'>('auto');
  const [savingFeaturedMode, setSavingFeaturedMode] = useState(false);
  const [contentSettings, setContentSettings] = useState<SystemSettings>({});
  const [savingContent, setSavingContent] = useState(false);

  useEffect(() => {
    if (activeTab === 'content') {
      getDoc(doc(db, 'system', 'content')).then(snap => {
        if(snap.exists()) setContentSettings(snap.data() as SystemSettings);
      });
    }
  }, [activeTab]);

  const handleSaveContent = async () => {
    setSavingContent(true);
    try {
      await setDoc(doc(db, 'system', 'content'), contentSettings, { merge: true });
      toast.success('Content saved successfully');
    } catch(e) {
      toast.error('Failed to save content');
    } finally {
      setSavingContent(false);
    }
  };
  const [confirmAction, setConfirmAction] = useState<{
    hotelId: string;
    hotelName: string;
    newStatus: 'approved' | 'rejected' | 'pending';
    actionName: string;
  } | null>(null);
  const [hotelToDelete, setHotelToDelete] = useState<Hotel | null>(null);
  const [isDeletingHotel, setIsDeletingHotel] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userToToggleSuspension, setUserToToggleSuspension] = useState<User | null>(null);
  const [resetEmailTarget, setResetEmailTarget] = useState<string | null>(null);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [openHotelMenuId, setOpenHotelMenuId] = useState<string | null>(null);
  const [savingDestinations, setSavingDestinations] = useState(false);
  const [newDestination, setNewDestination] = useState('');
  const [quickResetEmail, setQuickResetEmail] = useState('');
  const [sendingQuickReset, setSendingQuickReset] = useState(false);
  const [showQuickResetModal, setShowQuickResetModal] = useState(false);

  // Property Manager & Owner Assignment State
  const [hotelToAssignManager, setHotelToAssignManager] = useState<Hotel | null>(null);
  const [assignManagerSelectedUid, setAssignManagerSelectedUid] = useState<string>('');
  const [assignManagerCustomEmail, setAssignManagerCustomEmail] = useState<string>('');
  const [assignManagerCustomName, setAssignManagerCustomName] = useState<string>('');
  const [assignManagerOwnerEmail, setAssignManagerOwnerEmail] = useState<string>('');
  const [isAssigningManager, setIsAssigningManager] = useState(false);
  const [syncingAllFeeds, setSyncingAllFeeds] = useState(false);

  const handleRunGlobalIcalSync = async () => {
    setSyncingAllFeeds(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/calendar/sync-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Global calendar sync complete! Synced ${data.roomsSynced} rooms, ${data.hotelsSynced} properties (${data.totalFeeds} feeds).`);
      } else {
        toast.error(data.error || 'Global sync failed.');
      }
    } catch (err: any) {
      toast.error('Network error triggering global sync.');
    } finally {
      setSyncingAllFeeds(false);
    }
  };

  const propertiesWithIcal = useMemo(() => {
    return hotels.filter(h => (h.icalSyncUrls?.length || 0) > 0 || rooms.some(r => r.hotelId === h.id && (r.icalSyncUrls?.length || 0) > 0));
  }, [hotels, rooms]);

  const totalIcalFeedsCount = useMemo(() => {
    let count = 0;
    for (const h of hotels) count += (h.icalSyncUrls?.length || 0);
    for (const r of rooms) count += (r.icalSyncUrls?.length || 0);
    return count;
  }, [hotels, rooms]);
  
  const itemsPerPage = 10;

  const fetchData = async () => {
    try {
      const [hotelsSnapshot, usersSnapshot, bookingsSnapshot, settingsSnapshot, roomsSnapshot] = await Promise.all([
        getDocs(collection(db, 'hotels')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'bookings')),
        getDoc(doc(db, 'system', 'settings')),
        getDocs(collection(db, 'room_types'))
      ]);
      
      if (settingsSnapshot.exists()) {
        const data = settingsSnapshot.data();
        setPremiumEnabled(!!data.premiumListingsEnabled);
        setCustomDestinations(data.popularDestinations || []);
        setManualDestinationsEnabled(!!data.manualDestinationsEnabled);
        setFeaturedMode(data.featuredMode || 'auto');
      }

      const hotelsData = hotelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];
      setHotels(hotelsData);

      const roomsData = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RoomType[];
      setRooms(roomsData);

      const usersData = usersSnapshot.docs.map(doc => ({
        ...doc.data()
      })) as User[];
      setUsers(usersData);
      
      const bookingsData = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      // Sort bookings by creation date descending
      bookingsData.sort((a, b) => b.createdAt - a.createdAt);
      setBookings(bookingsData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      const effectiveAdmin = actualUser || user;
      if (!effectiveAdmin || (!isAdmin(effectiveAdmin) && !isMarketing(effectiveAdmin))) {
        navigate('/');
        return;
      }
      fetchData();
    }
  }, [user, actualUser, authLoading, navigate]);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleTogglePremium = async () => {
    if (togglingPremium) return;
    setTogglingPremium(true);
    try {
      const next = !premiumEnabled;
      await setDoc(doc(db, 'system', 'settings'), { premiumListingsEnabled: next }, { merge: true });
      setPremiumEnabled(next);
      toast.success(next ? 'Premium plans enabled' : 'Premium plans disabled');
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle premium settings');
    } finally {
      setTogglingPremium(false);
    }
  };



  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return;
    const logChange = () => logSystemEvent('action', `Admin updated booking status: Ref ${targetBooking.reference || bookingId} to ${newStatus}`, {
      bookingId,
      reference: targetBooking.reference,
      newStatus,
      previousStatus: targetBooking.status,
    }, user, 'booking');

    // Confirmation goes through the shared availability transaction, so an
    // admin cannot overbook a room either.
    if (newStatus === 'confirmed') {
      await confirmFlow.confirm(targetBooking, {
        extraPatch: { updatedAt: Date.now() },
        onConfirmed: async (written) => {
          setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...written } as Booking : b));
          toast.success('Booking confirmed.');
          await logChange();
        },
      });
      return;
    }

    try {
      const patch: Record<string, unknown> = { status: newStatus, updatedAt: Date.now() };
      await updateBookingWithSlot(bookingId, patch, targetBooking as any);
      if (newStatus === 'cancelled' || newStatus === 'rejected') cancelBookingReminders(bookingId);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus as any } : b));
      toast.success(`Booking status updated to ${newStatus}`);

      await logChange();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update booking status.');
    }
  };

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete?.id || isDeletingBooking) return;
    const targetBooking = bookingToDelete;
    setIsDeletingBooking(true);
    try {
      await deleteBookingWithSlot(targetBooking.id);
      cancelBookingReminders(targetBooking.id);
      setBookings(prev => prev.filter(b => b.id !== targetBooking.id));
      toast.success('Booking permanently deleted.');
      setBookingToDelete(null);

      await logSystemEvent('action', `${isAdmin(user) ? 'Admin' : 'Marketing'} permanently deleted booking: Ref ${targetBooking?.reference || targetBooking.id}`, {
        bookingId: targetBooking.id,
        reference: targetBooking?.reference,
      }, user, 'booking');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete booking.');
    } finally {
      setIsDeletingBooking(false);
    }
  };

  const handleToggleFeatured = async (hotel: Hotel) => {
    const next = !hotel.featured;
    if (next && !hotel.status) {
      // Legacy import treat as approved
    } else if (next && hotel.status !== 'approved') {
      toast.error('Approve the listing before featuring it.');
      return;
    }
    try {
      await updateDoc(doc(db, 'hotels', hotel.id!), {
        featured: next,
        featuredAt: next ? Date.now() : null,
      });
      setHotels(hotels.map(h => (h.id === hotel.id ? { ...h, featured: next, featuredAt: next ? Date.now() : undefined } : h)));
      toast.success(next ? `${hotel.name} is now featured.` : `${hotel.name} is no longer featured.`);

      await logSystemEvent('action', `Admin toggled featured status: ${hotel.name} -> ${next ? 'Featured' : 'Standard'}`, {
        hotelId: hotel.id,
        hotelName: hotel.name,
        featured: next,
      }, user, 'property');
    } catch (error) {
      console.error('Error updating featured flag:', error);
      toast.error('Could not change the featured status.');
    }
  };

  const handleUpdateStatus = async (hotelId: string, newStatus: 'approved' | 'rejected' | 'pending', reason?: string) => {
    if (updatingId) return;
    setUpdatingId(hotelId);
    const targetHotel = hotels.find(h => h.id === hotelId);
    try {
      const hotelRef = doc(db, 'hotels', hotelId);
      const updatePayload: Record<string, any> = { status: newStatus };
      if (reason) {
        updatePayload.moderationNotes = reason;
        updatePayload.moderatedAt = Date.now();
      }
      await updateDoc(hotelRef, updatePayload);
      setHotels(hotels.map(h => h.id === hotelId ? { ...h, status: newStatus, moderationNotes: reason || h.moderationNotes } : h));
      if (inspectingHotel && inspectingHotel.id === hotelId) {
        setInspectingHotel(prev => prev ? { ...prev, status: newStatus, moderationNotes: reason || prev.moderationNotes } : null);
      }
      // Tell the host once per real status change (not on a repeated click or a no-op update).
      const hostEmail = targetHotel?.managerEmail || targetHotel?.ownerEmail;
      if (targetHotel && targetHotel.status !== newStatus && hostEmail) {
        fetch('/api/admin/email-listing-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: hostEmail,
            name: targetHotel.managerName || targetHotel.ownerName,
            hotelName: targetHotel.name,
            status: newStatus,
            reason,
          }),
        }).catch(() => {});
      }
      toast.success(newStatus === 'approved'
        ? `${targetHotel?.name || 'Property'} approved and live on Travel Malawi!` 
        : `Property status updated to ${newStatus}`);

      await logSystemEvent('action', `Admin set property status: "${targetHotel?.name || hotelId}" -> ${newStatus.toUpperCase()}${reason ? ` (Reason: ${reason})` : ''}`, {
        hotelId,
        hotelName: targetHotel?.name,
        status: newStatus,
        reason,
      }, user, 'property');
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error('Failed to update hotel status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmDeleteHotel = async () => {
    if (!hotelToDelete?.id || isDeletingHotel) return;
    const targetHotel = hotelToDelete;

    // Check if property has active upcoming bookings that would become orphans
    const today = todayStr();
    const upcoming = bookings.filter(b =>
      b.hotelId === targetHotel.id &&
      (b.status === 'confirmed' || b.status === 'pending') &&
      (b.checkOut ?? '') >= today
    );
    if (upcoming.length > 0) {
      toast.error(`"${targetHotel.name}" has ${upcoming.length} active or upcoming booking${upcoming.length === 1 ? '' : 's'}. Cancel or move them before deleting.`);
      setHotelToDelete(null);
      return;
    }

    setIsDeletingHotel(true);
    try {
      // 1. Fetch & delete all associated room types for this property
      const roomsSnap = await getDocs(query(collection(db, 'room_types'), where('hotelId', '==', targetHotel.id)));
      const roomRefs = roomsSnap.docs.map(d => d.ref);
      for (let i = 0; i < roomRefs.length; i += 450) {
        const batch = writeBatch(db);
        roomRefs.slice(i, i + 450).forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      // 2. Delete the hotel doc
      await deleteDoc(doc(db, 'hotels', targetHotel.id));

      // 3. Best-effort archive images
      try {
        await fetch(`/api/hotels/${targetHotel.id}/archive-images`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to archive images:', err);
      }

      // 4. Update local state
      setHotels(prev => prev.filter(h => h.id !== targetHotel.id));
      setRooms(prev => prev.filter(r => r.hotelId !== targetHotel.id));
      if (inspectingHotel && inspectingHotel.id === targetHotel.id) {
        setInspectingHotel(null);
      }
      toast.success(`"${targetHotel.name}" permanently deleted.`);
      setHotelToDelete(null);

      // 5. Audit logging
      await logSystemEvent('action', `${isAdmin(user) ? 'Admin' : 'Marketing'} permanently deleted property listing: "${targetHotel.name}"`, {
        hotelId: targetHotel.id,
        hotelName: targetHotel.name,
        roomsDeleted: roomsSnap.docs.length,
      }, user, 'property');
    } catch (err: any) {
      console.error('Failed to delete hotel listing:', err);
      toast.error(err?.message || 'Failed to delete property listing.');
    } finally {
      setIsDeletingHotel(false);
    }
  };

  const handleSaveManagerAssignment = async () => {
    if (!hotelToAssignManager) return;
    setIsAssigningManager(true);
    try {
      const selectedUser = users.find(u => u.uid === assignManagerSelectedUid);
      let managerId = '';
      let managerName = '';
      let managerEmail = '';

      if (assignManagerSelectedUid === 'unassigned') {
        managerId = '';
        managerName = '';
        managerEmail = '';
      } else if (selectedUser) {
        managerId = selectedUser.uid;
        managerName = selectedUser.displayName || selectedUser.email?.split('@')[0] || 'Property Manager';
        managerEmail = selectedUser.email || '';
      } else {
        managerId = hotelToAssignManager.managerId || '';
        managerName = assignManagerCustomName.trim() || hotelToAssignManager.managerName || '';
        managerEmail = assignManagerCustomEmail.trim() || hotelToAssignManager.managerEmail || '';
      }

      const ownerEmail = assignManagerOwnerEmail.trim();

      const patch: Partial<Hotel> = {
        managerId,
        managerName,
        managerEmail,
        ownerEmail: ownerEmail || (hotelToAssignManager.ownerEmail ?? ''),
      };

      await updateDoc(doc(db, 'hotels', hotelToAssignManager.id!), patch);

      setHotels(prev => prev.map(h => h.id === hotelToAssignManager.id ? { ...h, ...patch } : h));
      toast.success(`Manager assignment updated for ${hotelToAssignManager.name}`);
      setHotelToAssignManager(null);

      await logSystemEvent('action', `Admin updated property manager: "${hotelToAssignManager.name}" -> ${managerName || managerEmail || 'Unassigned'}`, {
        hotelId: hotelToAssignManager.id,
        managerId,
        managerEmail,
        managerName,
        ownerEmail,
      }, user, 'property');
    } catch (err: any) {
      console.error('Failed to assign manager:', err);
      toast.error(err?.message || 'Failed to update manager assignment.');
    } finally {
      setIsAssigningManager(false);
    }
  };

  const handleToggleUserRole = async (targetUser: User, role: Role) => {
    if (targetUser.uid === user?.uid && (role === 'admin' || role === 'global_admin')) {
      toast.error('Cannot modify your own administrative access here.');
      return;
    }

    if (isMarketing(user) && !isAdmin(user) && role !== 'hotel_manager') {
      toast.error('Marketing team members may only toggle host permissions.');
      return;
    }

    if (!isGlobalAdmin(user) && role === 'global_admin') {
      toast.error('Only Global Admins can grant or remove Global Admin access.');
      return;
    }

    if (!isGlobalAdmin(user) && (userRoles(targetUser).includes('global_admin') || isOwnerEmail(targetUser.email))) {
      toast.error('Cannot modify permissions for a Global Admin account.');
      return;
    }
    
    try {
      const currentRoles = userRoles(targetUser);
      let newRoles = [...currentRoles];
      
      if (newRoles.includes(role)) {
        newRoles = newRoles.filter(r => r !== role);
      } else {
        newRoles.push(role);
      }
      
      const { role: legacyRole, roles } = toRoleFields(newRoles);
      
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: legacyRole,
        roles: roles
      });
      
      setUsers(users.map(u => u.uid === targetUser.uid ? { ...u, role: legacyRole, roles } : u));
      toast.success(`Roles updated for ${targetUser.displayName || targetUser.email}`);

      await logSystemEvent('action', `Admin updated roles for ${targetUser.displayName || targetUser.email}: [${newRoles.join(', ')}]`, {
        targetUserId: targetUser.uid,
        targetEmail: targetUser.email,
        roles: newRoles,
      }, user, 'admin');
    } catch (error) {
      console.error('Error updating user roles:', error);
      toast.error('Failed to update roles.');
    }
  };

  const handleToggleUserSuspension = (targetUser: User) => {
    if (targetUser.uid === user?.uid) {
      toast.error('Cannot suspend your own account.');
      return;
    }
    setUserToToggleSuspension(targetUser);
  };

  const confirmToggleUserSuspension = async () => {
    if (!userToToggleSuspension) return;
    const targetUser = userToToggleSuspension;
    const isSuspended = targetUser.status === 'suspended' || targetUser.accessRevoked;
    const nextStatus = isSuspended ? 'active' : 'suspended';
    
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        status: nextStatus,
        accessRevoked: !isSuspended,
        accessRevokedAt: !isSuspended ? Date.now() : null,
        revokedBy: !isSuspended ? user?.uid : null
      });
      
      setUsers(users.map(u => u.uid === targetUser.uid ? { 
        ...u, 
        status: nextStatus, 
        accessRevoked: !isSuspended 
      } : u));
      
      toast.success(`Account access ${isSuspended ? 'restored' : 'suspended'}.`);

      await logSystemEvent('action', `Admin ${isSuspended ? 'restored' : 'suspended'} user account: ${targetUser.displayName || targetUser.email}`, {
        targetUserId: targetUser.uid,
        targetEmail: targetUser.email,
        status: nextStatus,
      }, user, 'security');
      
      // Notify via server API
      if (targetUser.email) {
        fetch('/api/admin/notify-account-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: targetUser.email, 
            status: !isSuspended ? 'revoked' : 'active',
            name: targetUser.displayName
          })
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error suspending user:', error);
      toast.error('Failed to update suspension status.');
    } finally {
      setUserToToggleSuspension(null);
    }
  };

  const handleResendUserOnboardingEmail = async (targetUser: User) => {
    if (!targetUser.email) {
      toast.error('This user does not have an email address.');
      return;
    }

    // Check if the user is associated with any property as manager or owner
    const userProperty = hotels.find(
      h => h.managerId === targetUser.uid ||
           (h.ownerEmail && h.ownerEmail.toLowerCase() === targetUser.email!.toLowerCase()) ||
           (h.managerEmail && h.managerEmail.toLowerCase() === targetUser.email!.toLowerCase()) ||
           (h.contactEmail && h.contactEmail.toLowerCase() === targetUser.email!.toLowerCase())
    );

    const toastId = toast.loading(`Sending onboarding details to ${targetUser.email}…`);
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/onboarding/welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          hotelId: userProperty?.id || 'host-onboarding',
          hotelName: userProperty?.name || 'Ulendo Partner Host',
          propertyName: userProperty?.name || 'Ulendo Partner Host',
          location: userProperty?.location || 'Malawi',
          category: userProperty?.category || 'Boutique Stay',
          status: userProperty?.status || 'pending',
          ownerName: targetUser.displayName || userProperty?.ownerName || 'Valued Partner Host',
          ownerEmail: targetUser.email,
          managerName: targetUser.displayName || userProperty?.managerName || 'Property Host',
          managerEmail: targetUser.email,
          submittedByEmail: (actualUser || user)?.email,
        }),
      });
      const data = await res.json();
      if ((data.ok || data.success) && (data.sentCount > 0 || data.sent)) {
        const count = data.sentCount || data.recipients?.length || 1;
        toast.success(`Onboarding details email sent via SMTP to ${targetUser.email}! (${count} email${count > 1 ? 's' : ''})`, { id: toastId });
        await logSystemEvent('action', `Admin/Marketing resent onboarding details email to ${targetUser.email}`, {
          targetUserId: targetUser.uid,
          targetEmail: targetUser.email,
          associatedProperty: userProperty?.name || 'Host Account',
        }, user, 'admin');
      } else {
        toast.error(data.error || 'Could not dispatch onboarding email. Verify SMTP settings in Email Config.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to dispatch onboarding details.', { id: toastId });
    }
  };

  const handleDeleteUser = (targetUser: User) => {
    if (targetUser.uid === user?.uid) {
      toast.error('Cannot delete your own account.');
      return;
    }
    setUserToDelete(targetUser);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const targetUser = userToDelete;
    setIsDeletingUser(true);

    try {
      // 1. Delete user doc directly in Firestore client-side
      try {
        await deleteDoc(doc(db, 'users', targetUser.uid));
      } catch (firestoreErr) {
        console.warn('Direct Firestore deleteDoc warning:', firestoreErr);
      }

      // 2. Also call backend endpoint to delete from Firebase Auth and notify
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ uid: targetUser.uid })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Backend delete-user response:', errData);
        }
      } catch (backendErr) {
        console.warn('Backend delete-user fetch warning:', backendErr);
      }

      setUsers(prev => prev.filter(u => u.uid !== targetUser.uid));
      toast.success('User profile deleted successfully.');
      setUserToDelete(null);

      // 3. Audit logging (non-blocking)
      logSystemEvent('action', `Admin deleted user profile: ${targetUser.displayName || targetUser.email || targetUser.uid}`, {
        targetUserId: targetUser.uid,
        targetEmail: targetUser.email,
      }, user, 'security').catch(() => {});

      // 4. Send notification if email exists (non-blocking)
      if (targetUser.email) {
        fetch('/api/admin/notify-account-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: targetUser.email, 
            status: 'revoked',
            name: targetUser.displayName
          })
        }).catch(() => {});
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error?.message || 'Failed to delete user profile.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const badPinCount = useMemo(() => hotels.filter(h => pinProblem(h.coordinates)).length, [hotels]);

  const visibleHotels = useMemo(() => {
    let filtered = hotels;
    if (hotelStatusFilter !== 'all') {
      if (hotelStatusFilter === 'approved') {
        filtered = filtered.filter(h => h.status === 'approved' || !h.status);
      } else {
        filtered = filtered.filter(h => h.status === hotelStatusFilter);
      }
    }
    if (onlyBadPins) {
      filtered = filtered.filter(h => pinProblem(h.coordinates));
    }
    if (hotelSearch) {
      const q = hotelSearch.toLowerCase();
      filtered = filtered.filter(h => 
        h.name.toLowerCase().includes(q) || 
        (h.location && h.location.toLowerCase().includes(q)) ||
        (h.managerName && h.managerName.toLowerCase().includes(q)) ||
        (h.ownerName && h.ownerName.toLowerCase().includes(q)) ||
        (h.managerEmail && h.managerEmail.toLowerCase().includes(q)) ||
        (h.managerId && h.managerId.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [hotels, hotelStatusFilter, onlyBadPins, hotelSearch]);

  const visibleUsers = useMemo(() => {
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u => 
      (u.displayName?.toLowerCase().includes(q)) || 
      (u.email?.toLowerCase().includes(q)) ||
      (u.uid.toLowerCase().includes(q))
    );
  }, [users, userSearch]);
  
  // Overview Stats
  const destinationStats = useMemo(() => {
    const dStats = new Map<string, { listings: number, bookings: number }>();
    
    for (const hotel of hotels) {
      const loc = hotel.location?.trim();
      if (!loc || !/^[A-Za-z][A-Za-z\s'&.,-]{2,}$/.test(loc)) continue;
      if (!dStats.has(loc)) dStats.set(loc, { listings: 0, bookings: 0 });
      dStats.get(loc)!.listings += 1;
    }
    
    for (const booking of bookings) {
      const hotel = hotels.find(h => h.id === booking.hotelId);
      if (!hotel) continue;
      const loc = hotel.location?.trim();
      if (!loc || !/^[A-Za-z][A-Za-z\s'&.,-]{2,}$/.test(loc)) continue;
      if (!dStats.has(loc)) dStats.set(loc, { listings: 0, bookings: 0 });
      dStats.get(loc)!.bookings += 1;
    }
    
    return Array.from(dStats.entries())
      .map(([location, data]) => ({ location, ...data }))
      .sort((a, b) => (b.bookings * 2 + b.listings) - (a.bookings * 2 + a.listings));
  }, [hotels, bookings]);

  
  const saveFeaturedMode = async (mode: 'auto' | 'manual' | 'disabled') => {
    setSavingFeaturedMode(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), { featuredMode: mode }, { merge: true });
      setFeaturedMode(mode);
      toast.success('Featured mode updated');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save featured mode');
    } finally {
      setSavingFeaturedMode(false);
    }
  };

  const saveDestinations = async () => {
    setSavingDestinations(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), { popularDestinations: customDestinations, manualDestinationsEnabled }, { merge: true });
      toast.success('Popular destinations updated');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save destinations');
    } finally {
      setSavingDestinations(false);
    }
  };

  const chartData = useMemo(() => {
    // We can also compute properties growth here
    const propertiesByMonth = new Map<string, number>();
    // Group by month
    const months = new Map<string, { month: string; bookings: number; users: number; properties: number; timestamp: number }>();
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      months.set(key, { month: key, bookings: 0, users: 0, properties: 0, timestamp: d.getTime() });
    }

    bookings.forEach(b => {
      const d = new Date(b.createdAt);
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (months.has(key)) {
        months.get(key)!.bookings += 1;
      }
    });

    users.forEach(u => {
      if (!u.createdAt) return;
      const d = new Date(u.createdAt);
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (months.has(key)) {
        months.get(key)!.users += 1;
      }
    });

    hotels.forEach(h => {
      if (!h.createdAt) return;
      const d = new Date(h.createdAt);
      const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (months.has(key)) {
        months.get(key)!.properties += 1;
      }
    });

    return Array.from(months.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [bookings, users, hotels]);

  const featuredCandidateStats = useMemo(() => {
    const propertyStats = new Map<string, { hotel: Hotel; bookings: number }>();
    hotels.forEach(h => propertyStats.set(h.id!, { hotel: h, bookings: 0 }));
    bookings.forEach(b => {
      if (propertyStats.has(b.hotelId)) {
        propertyStats.get(b.hotelId)!.bookings += 1;
      }
    });
    return Array.from(propertyStats.values())
      .filter(s => s.hotel.status === 'approved' || !s.hotel.status)
      .sort((a, b) => {
        // Sort by featured first, then by bookings
        if (a.hotel.featured && !b.hotel.featured) return -1;
        if (!a.hotel.featured && b.hotel.featured) return 1;
        return b.bookings - a.bookings;
      });
  }, [hotels, bookings]);

  const stats = useMemo(() => {
    const pendingList = hotels.filter(h => h.status === 'pending');
    const approvedList = hotels.filter(h => h.status === 'approved' || !h.status);
    const rejectedList = hotels.filter(h => h.status === 'rejected');
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
    const pendingBookings = bookings.filter(b => b.status === 'pending');
    const revenueMWK = confirmedBookings
      .filter(b => !b.currency || b.currency === 'MWK')
      .reduce((sum, b) => sum + (Number(b.total) || 0), 0);
    const revenueUSD = confirmedBookings
      .filter(b => b.currency === 'USD')
      .reduce((sum, b) => sum + (Number(b.total) || 0), 0);
    const totalRoomTypes = rooms.length;
    const totalRoomUnits = rooms.reduce((sum, r) => sum + (Number(r.quantity) || 1), 0);
    const syncedPropertiesCount = hotels.filter(
      h => (h.icalSyncUrls?.length || 0) > 0 || rooms.some(r => r.hotelId === h.id && (r.icalSyncUrls?.length || 0) > 0)
    ).length;

    return {
      totalProperties: hotels.length,
      pendingProperties: pendingList.length,
      approvedProperties: approvedList.length,
      rejectedProperties: rejectedList.length,
      totalUsers: users.length,
      totalBookings: bookings.length,
      confirmedBookingsCount: confirmedBookings.length,
      pendingBookingsCount: pendingBookings.length,
      conversionRate: bookings.length > 0 ? Math.round((confirmedBookings.length / bookings.length) * 100) : 0,
      managersCount: users.filter(u => isHotelManager(u)).length,
      revenueMWK,
      revenueUSD,
      totalRoomTypes,
      totalRoomUnits,
      syncedPropertiesCount,
      totalRevenue: revenueMWK
    };
  }, [hotels, users, bookings, rooms]);

  const adminTabs = useMemo(() => {
    return [
      { id: 'overview' as Tab, label: 'Overview', icon: LayoutDashboard },
      { id: 'properties' as Tab, label: 'Properties', icon: Building2 },
      { id: 'bookings' as Tab, label: 'Bookings', icon: CalendarRange },
      { id: 'users' as Tab, label: 'Users', icon: Users, visible: isAdmin(user) || isMarketing(user) },
      { id: 'analytics' as Tab, label: 'Analytics', icon: TrendingUp },
      { id: 'traffic' as Tab, label: 'Live Visitors', icon: Radio, visible: isGlobalAdmin(user) || isMarketing(user) },
      { id: 'reviews' as Tab, label: 'Reviews', icon: Star },
      { id: 'destinations' as Tab, label: 'Destinations', icon: Navigation },
      { id: 'settings' as Tab, label: 'Channels & Settings', icon: Settings, visible: isGlobalAdmin(user) },
      { id: 'ai' as Tab, label: 'AI Providers', icon: Cpu, visible: isGlobalAdmin(user) },
      { id: 'content' as Tab, label: 'Content & Legal', icon: FileText },
      { id: 'logs' as Tab, label: 'Audit Logs', icon: ShieldCheck, visible: isGlobalAdmin(user) },
      { id: 'docs' as Tab, label: 'Partner Docs', icon: BookOpen },
    ].filter(t => t.visible !== false);
  }, [user]);

  // A tab hidden from this role must not render even when reached through ?tab=
  const canViewTab = (id: Tab) => adminTabs.some(t => t.id === id);

  const currentTabItem = useMemo(() => {
    return adminTabs.find(t => t.id === activeTab) || adminTabs[0];
  }, [adminTabs, activeTab]);
  const CurrentTabIcon = currentTabItem.icon;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 w-full flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-screen">
      
      <PriceMismatchNotice
        mismatch={confirmFlow.mismatch}
        busy={!!confirmFlow.busyId}
        onConfirmAnyway={() => { confirmFlow.confirmAnyway(); }}
        onDismiss={confirmFlow.dismiss}
      />

      {/* Sidebar Navigation */}
      <div className="w-full lg:w-60 xl:w-64 shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:flex lg:flex-col min-w-0">
        <div className="flex items-center justify-between px-1 lg:px-2 pb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
              <Shield className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="tm-h1 leading-tight">Admin</h1>
              <p className="text-stone-500 text-xs sm:text-sm font-medium truncate mt-0.5">
                {isGlobalAdmin(user) ? 'Global Admin' : isMarketing(user) ? 'Marketing' : 'Platform Management'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Mobile & Tablet Collapsible Menu Trigger */}
        <div className="lg:hidden space-y-2 mb-4">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-full flex items-center justify-between bg-white border border-stone-200 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-stone-900 shadow-2xs hover:bg-stone-50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CurrentTabIcon className="w-4 h-4 text-stone-500 shrink-0" />
              <span className="truncate">{currentTabItem.label}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Collapsible Drawer on Mobile & Tablet */}
          {isMobileMenuOpen && (
            <div 
              id="mobile-admin-drawer"
              className="mt-2 p-2.5 bg-white rounded-xl border border-stone-200 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-xs font-medium text-stone-500">Sections</span>
                <span className="text-xs text-stone-400">{adminTabs.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[55vh] overflow-y-auto pr-1">
                {adminTabs.map(tab => {
                  const TabIcon = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={`mob-tab-${tab.id}`}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left min-h-[44px] ${
                        isSelected
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <TabIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-stone-500'}`} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Team Resources inside mobile drawer */}
              <div className="pt-2 border-t border-stone-100 space-y-1.5">
                <span className="text-xs font-medium text-stone-500 px-2 block">Partner resources</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <Link
                    to="/concept-validation"
                    target="_blank"
                    className="inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200/60"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                      <span>Concept Survey (PDF)</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </Link>
                  <Link
                    to="/stay-owner-leaflet"
                    target="_blank"
                    className="inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200/60"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                      <span>Stay Owner Leaflet</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </Link>
                  <Link
                    to="/marketing"
                    target="_blank"
                    className="inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium border border-stone-200/60"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                      <span>Marketing Playbook</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </Link>
                  <Link
                    to="/host-guide"
                    target="_blank"
                    className="inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium border border-stone-200/60"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                      <span>Host Starter Pack</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Vertical Navigation */}
        <nav 
          ref={navContainerRef}
          className="hidden lg:flex lg:flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-slim pr-1.5 space-y-4 pt-1 w-full min-w-0 overscroll-contain"
          role="tablist"
          aria-label="Admin Sections"
        >
          {/* Navigation Tabs */}
          <div className="flex flex-col gap-0.5 w-full min-w-0">
            {adminTabs.map(tab => {
              const TabIcon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={`desk-tab-${tab.id}`}
                  ref={isSelected ? activeTabRef : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer min-h-[36px] text-left min-w-0 ${
                    isSelected
                      ? 'bg-stone-900 text-white font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <TabIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </span>
                  {tab.id === 'properties' && stats.pendingProperties > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                      isSelected ? 'bg-amber-400 text-stone-950' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {stats.pendingProperties}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Partner Resources */}
          <div className="pt-3 border-t border-stone-200/70 space-y-1 w-full min-w-0 pb-4">
            <span className="text-xs font-medium text-stone-500 px-3 block">
              Partner resources
            </span>
            <Link
              to="/concept-validation"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <span className="truncate">Concept Survey (PDF)</span>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
            <Link
              to="/stay-owner-leaflet"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <span className="truncate">Stay Owner Leaflet</span>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
            <Link
              to="/marketing"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <span className="truncate">Marketing Playbook</span>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
            <Link
              to="/host-guide"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <span className="truncate">Host Starter Pack</span>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full">
        
        {/* ===================== OVERVIEW TAB ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="pb-2 border-b border-stone-200">
              <h2 className="tm-h1">Overview</h2>
              <p className="tm-muted mt-0.5">Key numbers and partner documents.</p>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <button
                onClick={() => setActiveTab('properties')}
                className="tm-panel min-w-0 text-left hover:border-stone-300 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Total Properties</span>
                  <Building2 className="w-4 h-4 text-stone-400" />
                </div>
                <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">{stats.totalProperties}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">{stats.approvedProperties} live · {stats.pendingProperties} pending</p>
              </button>
              
              <button
                onClick={() => setActiveTab('users')}
                className="tm-panel min-w-0 text-left hover:border-stone-300 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Total Users</span>
                  <Users className="w-4 h-4 text-stone-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">{stats.totalUsers}</p>
                  <span className="text-xs text-stone-400 font-normal">· {stats.managersCount} hosts</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Guests &amp; property managers</p>
              </button>
              
              <button
                onClick={() => setActiveTab('bookings')}
                className="tm-panel min-w-0 text-left hover:border-stone-300 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Total Bookings</span>
                  <CalendarRange className="w-4 h-4 text-stone-400" />
                </div>
                <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">{stats.totalBookings}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Recorded reservations</p>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('properties');
                  setHotelStatusFilter('pending');
                  setCurrentHotelPage(1);
                }}
                className={`rounded-xl border p-4 min-w-0 text-left transition cursor-pointer ${
                  stats.pendingProperties > 0 
                    ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300' 
                    : 'bg-white border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Pending Review</span>
                  <Clock className={`w-4 h-4 ${stats.pendingProperties > 0 ? 'text-amber-600' : 'text-stone-400'}`} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className={`text-2xl font-serif font-bold tabular-nums ${stats.pendingProperties > 0 ? 'text-amber-900' : 'text-stone-900'}`}>
                    {stats.pendingProperties}
                  </p>
                  {stats.pendingProperties > 0 && (
                    <span className="text-xs text-amber-700 font-medium">awaiting approval</span>
                  )}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Click to open review queue</p>
              </button>
            </div>

            {/* Active Visitors Summary */}
            <div className="tm-panel min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div className="min-w-0">
                  <h3 className="tm-h2">Live visitors</h3>
                  <p className="tm-muted mt-0.5">Who is browsing right now.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('traffic')}
                  className="tm-btn tm-btn-secondary tm-btn-sm"
                >
                  <span>All visitors</span>
                  <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                </button>
              </div>

              <AdminTrafficMonitor compactMode={true} />
            </div>

            {/* Partner Outreach & Guides */}
            <div className="tm-panel min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <h3 className="tm-h2">Partner documents</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className="tm-link cursor-pointer text-sm"
                >
                  All documents
                </button>
              </div>
              <ul className="divide-y divide-stone-200 border-t border-stone-200">
                {[
                  { title: 'Concept validation survey', desc: 'Partner feedback questionnaire.', to: '/concept-validation', doc: 'concept-validation-survey' },
                  { title: 'Stay owner leaflet', desc: 'One-page flyer for new hosts.', to: '/stay-owner-leaflet', doc: 'stay-owner-leaflet' },
                ].map(d => (
                  <li key={d.doc} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{d.title}</p>
                      <p className="tm-muted truncate">{d.desc}</p>
                    </div>
                    <div className="tm-actions">
                      <Link to={d.to} target="_blank" className="tm-btn tm-btn-secondary tm-btn-sm">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View and print</span>
                      </Link>
                      <a href={`/api/admin/docs/${d.doc}?format=html&download=1`} className="tm-btn tm-btn-quiet tm-btn-sm">
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {isGlobalAdmin(user) && (
              <div className="tm-panel min-w-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-stone-900">Premium listing plans</h4>
                  <p className="tm-muted mt-0.5">Let hosts pick a premium plan when they sign up.</p>
                </div>
                <button
                  onClick={handleTogglePremium}
                  disabled={togglingPremium}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${premiumEnabled ? 'bg-emerald-600' : 'bg-stone-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${premiumEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================== LIVE TRAFFIC & WAITING TAB ===================== */}
        {activeTab === 'traffic' && canViewTab('traffic') && (
          <AdminTrafficMonitor />
        )}
        
        {/* ===================== ANALYTICS TAB ===================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="pb-2 border-b border-stone-200">
              <h2 className="tm-h1">Analytics</h2>
              <p className="tm-muted mt-0.5">Bookings, growth and featured stays.</p>
            </div>

            {/* Platform Telemetry & Dual-Currency Revenue Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="tm-panel min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Confirmed volume</span>
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                </div>
                <p className="text-xl font-serif font-bold text-stone-900 tabular-nums">
                  MK {stats.revenueMWK.toLocaleString()}
                </p>
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="font-semibold text-emerald-800">
                    + USD ${stats.revenueUSD.toLocaleString()}
                  </span>
                  <span className="text-stone-400">0% platform fee</span>
                </div>
              </div>

              <div className="tm-panel min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Reservations</span>
                  <CalendarRange className="w-4 h-4 text-stone-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">
                    {stats.confirmedBookingsCount}
                  </p>
                  <span className="text-xs text-emerald-700 font-semibold">
                    confirmed ({stats.conversionRate}%)
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  {stats.pendingBookingsCount} pending · {stats.totalBookings} total requests
                </p>
              </div>

              <div className="tm-panel min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Rooms</span>
                  <Building2 className="w-4 h-4 text-stone-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">
                    {stats.totalRoomUnits}
                  </p>
                  <span className="text-xs text-stone-500 font-medium">
                    units ({stats.totalRoomTypes} types)
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Across {stats.approvedProperties} live · {stats.pendingProperties} pending stays
                </p>
              </div>

              <div className="tm-panel min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Hosts</span>
                  <CalendarSync className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">
                    {stats.managersCount}
                  </p>
                  <span className="text-xs text-stone-500 font-medium">
                    active hosts
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  {stats.syncedPropertiesCount} properties connected via 2-way iCal
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Bookings Trend Chart */}
              <div className="tm-panel min-w-0 flex flex-col h-full">
                <h3 className="tm-h2 mb-0.5">Booking Volume</h3>
                <p className="text-xs text-stone-500 mb-4">Confirmed bookings over the last 6 months.</p>
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                        labelStyle={{ color: '#292524', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorBookings)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Users Growth Chart */}
              <div className="tm-panel min-w-0 flex flex-col h-full">
                <h3 className="tm-h2 mb-0.5">User Sign-Ups</h3>
                <p className="text-xs text-stone-500 mb-4">New user accounts over the last 6 months.</p>
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#78716c" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#78716c" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                        labelStyle={{ color: '#292524', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="users" name="New Users" stroke="#57534e" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Property Growth Chart */}
              <div className="tm-panel min-w-0 flex flex-col h-full">
                <h3 className="tm-h2 mb-0.5">Property Listings</h3>
                <p className="text-xs text-stone-500 mb-4">New properties onboarded over the last 6 months.</p>
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f5f5f4' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                        labelStyle={{ color: '#292524', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Bar dataKey="properties" name="New Properties" fill="#d97706" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Featured Stays Manager */}
            <div className="tm-panel min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div className="min-w-0">
                  <h3 className="tm-h2">Featured stays</h3>
                  <p className="tm-muted mt-0.5">
                    Shown on the explore page under "The ones guests go back to".
                  </p>
                </div>
                <div className="flex max-w-full flex-wrap items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 text-xs">
                  <button
                    onClick={() => saveFeaturedMode('auto')}
                    disabled={savingFeaturedMode}
                    className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer ${featuredMode === 'auto' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    Auto-fill
                  </button>
                  <button
                    onClick={() => saveFeaturedMode('manual')}
                    disabled={savingFeaturedMode}
                    className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer ${featuredMode === 'manual' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    Manual only
                  </button>
                  <button
                    onClick={() => saveFeaturedMode('disabled')}
                    disabled={savingFeaturedMode}
                    className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer ${featuredMode === 'disabled' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    Disabled
                  </button>
                </div>
              </div>

              <p className="tm-muted">
                {featuredMode === 'disabled' && 'The featured section is hidden from the home page.'}
                {featuredMode === 'manual' && 'Only stays marked Featured below are shown (up to 3).'}
                {featuredMode === 'auto' && 'Featured stays come first; open slots fill with the highest-rated stays.'}
              </p>

              <div className="overflow-x-auto border border-stone-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-stone-50 text-stone-500 text-xs font-medium border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-4">Property</th>
                      <th className="py-2.5 px-4">Location</th>
                      <th className="py-2.5 px-4">Bookings</th>
                      <th className="py-2.5 px-4 text-right">Featured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {featuredCandidateStats.slice((currentFeaturedPage - 1) * itemsPerPage, currentFeaturedPage * itemsPerPage).map(({ hotel, bookings }, idx) => (
                      <tr key={`feat-candidate-${hotel.id || 'hotel'}-${idx}`} className={`hover:bg-stone-50/70 transition ${hotel.featured ? 'bg-amber-50/20' : ''}`}>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 bg-stone-100">
                              <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-medium text-stone-900 truncate">{hotel.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-stone-500">
                          {hotel.location}
                        </td>
                        <td className="py-2.5 px-4 tabular-nums text-stone-800">
                          {bookings}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleToggleFeatured(hotel)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                              hotel.featured 
                                ? 'bg-stone-900 text-white hover:bg-stone-800' 
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            <Star className={`h-3 w-3 ${hotel.featured ? 'fill-amber-400 text-amber-400' : ''}`} />
                            <span>{hotel.featured ? 'Featured' : 'Promote'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {featuredCandidateStats.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-stone-500">
                          No properties available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
                <div>
                  Showing <span className="font-semibold text-stone-900 tabular-nums">{featuredCandidateStats.length === 0 ? 0 : (currentFeaturedPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 tabular-nums">{Math.min(currentFeaturedPage * itemsPerPage, featuredCandidateStats.length)}</span> of <span className="font-semibold text-stone-900 tabular-nums">{featuredCandidateStats.length}</span> properties
                </div>
                {featuredCandidateStats.length > itemsPerPage && (
                  <Pagination
                    currentPage={currentFeaturedPage}
                    totalPages={Math.ceil(featuredCandidateStats.length / itemsPerPage)}
                    onPageChange={setCurrentFeaturedPage}
                    className="flex items-center gap-1.5 my-0"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== PROPERTIES TAB ===================== */}
        {activeTab === 'properties' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header & Inline Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200">
              <div className="min-w-0">
                <h2 className="tm-h1">Properties</h2>
                <p className="tm-muted mt-0.5">
                  Review, approve and manage listings.
                </p>
              </div>
              
              <div className="tm-actions">
                <button
                  type="button"
                  onClick={handleRunGlobalIcalSync}
                  disabled={syncingAllFeeds}
                  className="tm-btn tm-btn-secondary tm-btn-sm"
                  title={`${totalIcalFeedsCount} external iCal feeds connected across ${propertiesWithIcal.length} properties`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-stone-500 ${syncingAllFeeds ? 'animate-spin' : ''}`} />
                  <span>{syncingAllFeeds ? 'Syncing iCal…' : `Sync iCal (${totalIcalFeedsCount})`}</span>
                </button>

                {badPinCount > 0 && (
                  <button
                    onClick={() => { setOnlyBadPins(v => !v); setCurrentHotelPage(1); }}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      onlyBadPins ? 'bg-amber-800 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100/70'
                    }`}
                  >
                    <MapPinOff className="h-3.5 w-3.5" />
                    <span>{badPinCount} missing pin{badPinCount === 1 ? '' : 's'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Unified Filter & Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {[
                  { id: 'all', label: 'All', count: stats.totalProperties },
                  { id: 'pending', label: 'Pending', count: stats.pendingProperties, highlight: stats.pendingProperties > 0 },
                  { id: 'approved', label: 'Live', count: stats.approvedProperties },
                  { id: 'rejected', label: 'Unpublished', count: stats.rejectedProperties },
                ].map(pill => {
                  const isSelected = hotelStatusFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => {
                        setHotelStatusFilter(pill.id as any);
                        setCurrentHotelPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-stone-900 text-white font-semibold'
                          : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-medium ${
                        isSelected
                          ? 'bg-stone-800 text-stone-200'
                          : pill.highlight
                            ? 'bg-amber-100 text-amber-900 font-semibold'
                            : 'bg-stone-100 text-stone-600'
                      }`}>
                        {pill.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search property, city or host"
                  value={hotelSearch}
                  onChange={e => { setHotelSearch(e.target.value); setCurrentHotelPage(1); }}
                  className="tm-input pl-8 pr-7"
                />
                {hotelSearch && (
                  <button
                    type="button"
                    onClick={() => { setHotelSearch(''); setCurrentHotelPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Clean Property Directory (Table on md+, Stacked Cards on <md) */}
            <div className="rounded-xl border border-stone-200 bg-white">
              {visibleHotels.length === 0 ? (
                <div className="p-10 text-center tm-muted">
                  No properties match this filter.
                </div>
              ) : (() => {
                const pageHotels = visibleHotels.slice(
                  (currentHotelPage - 1) * itemsPerPage,
                  currentHotelPage * itemsPerPage
                );

                const renderStatusBadge = (hotel: Hotel) => {
                  if (!hotel.status || hotel.status === 'approved') {
                    return (
                      <span className="tm-tag tm-tag-good whitespace-nowrap shrink-0">
                        Live
                      </span>
                    );
                  }
                  if (hotel.status === 'pending') {
                    return (
                      <span className="tm-tag tm-tag-warn whitespace-nowrap shrink-0">
                        Pending
                      </span>
                    );
                  }
                  return (
                    <span className="tm-tag whitespace-nowrap shrink-0">
                      Rejected
                    </span>
                  );
                };

                const renderMoreMenu = (hotel: Hotel, menuKey: string, openUpwards: boolean) => (
                  <div className="relative inline-block text-left shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenHotelMenuId(openHotelMenuId === menuKey ? null : menuKey)}
                      className="tm-btn tm-btn-secondary tm-btn-sm gap-1"
                      aria-label="More property actions"
                    >
                      <span>More</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${openHotelMenuId === menuKey ? 'rotate-180' : ''}`} />
                    </button>

                    {openHotelMenuId === menuKey && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setOpenHotelMenuId(null)}
                        />
                        <div
                          className={`absolute right-0 w-56 bg-white rounded-xl shadow-sm border border-stone-200 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-150 ${
                            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                          }`}
                        >
                          {(isAdmin(user) || isMarketing(user)) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setHotelToAssignManager(hotel);
                                  setAssignManagerSelectedUid(hotel.managerId || '');
                                  setAssignManagerCustomEmail(hotel.managerEmail || '');
                                  setAssignManagerCustomName(hotel.managerName || '');
                                  setAssignManagerOwnerEmail(hotel.ownerEmail || '');
                                  setOpenHotelMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <Users className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                <span>Assign or change host</span>
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenHotelMenuId(null);
                                  const targetEmail =
                                    hotel.ownerEmail ||
                                    hotel.managerEmail ||
                                    hotel.contactEmail ||
                                    (hotel.managerId && users.find(u => u.uid === hotel.managerId)?.email);
                                  if (!targetEmail) {
                                    toast.error('No owner, manager, or contact email on this listing. Assign an email first.');
                                    return;
                                  }
                                  const toastId = toast.loading(`Sending login credentials to ${targetEmail}…`);
                                  try {
                                    const token = await auth.currentUser?.getIdToken().catch(() => null);
                                    const res = await fetch('/api/onboarding/welcome-email', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                      },
                                      body: JSON.stringify({
                                        hotelId: hotel.id,
                                        hotelName: hotel.name,
                                        propertyName: hotel.name,
                                        location: hotel.location,
                                        category: hotel.category,
                                        status: hotel.status || 'pending',
                                        ownerName: hotel.ownerName,
                                        ownerEmail: hotel.ownerEmail,
                                        ownerPhone: hotel.ownerPhone,
                                        managerName: hotel.managerName,
                                        managerEmail: hotel.managerEmail || targetEmail,
                                        managerPhone: hotel.managerPhone,
                                        contactEmail: hotel.contactEmail,
                                        contactPhone: hotel.contactPhone,
                                        contactWhatsapp: hotel.contactWhatsapp,
                                        submittedByEmail: (actualUser || user)?.email,
                                      }),
                                    });
                                    const data = await res.json();
                                    if ((data.ok || data.success) && (data.sentCount > 0 || data.sent)) {
                                      const count = data.sentCount || data.recipients?.length || 1;
                                      toast.success(`Host login credentials sent via SMTP (${count} email${count > 1 ? 's' : ''})!`, { id: toastId });
                                    } else {
                                      toast.error(data.error || 'Could not dispatch SMTP email. Verify SMTP settings.', { id: toastId });
                                    }
                                  } catch (err: any) {
                                    toast.error(err?.message || 'Failed to send host credentials.', { id: toastId });
                                  }
                                }}
                                className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>Resend onboarding email</span>
                              </button>
                              <div className="my-1 border-t border-stone-100" />
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setOpenHotelMenuId(null);
                              if (hotel.id) {
                                setReviewScraperHotelId(hotel.id);
                                setActiveTab('reviews');
                              }
                            }}
                            className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>Manage reviews</span>
                            </span>
                            {(hotel.reviews?.length || hotel.reviewsSummary?.count || 0) > 0 && (
                              <span className="text-[10px] font-semibold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                                {hotel.reviews?.length || hotel.reviewsSummary?.count}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleToggleFeatured(hotel);
                              setOpenHotelMenuId(null);
                            }}
                            className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Star className={`w-3.5 h-3.5 shrink-0 ${hotel.featured ? 'fill-amber-500 text-amber-500' : 'text-stone-400'}`} />
                              <span>{hotel.featured ? 'Remove from featured' : 'Feature on home'}</span>
                            </span>
                            {hotel.featured && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const nextState = hotel.adminChatEnabled === false ? true : false;
                                await updateDoc(doc(db, 'hotels', hotel.id!), { adminChatEnabled: nextState });
                                setHotels(hotels.map(h => h.id === hotel.id ? { ...h, adminChatEnabled: nextState } : h));
                                toast.success(`Chat has been ${nextState ? 'enabled' : 'disabled'} for ${hotel.name}`);
                                setOpenHotelMenuId(null);
                              } catch (error) {
                                console.error(error);
                                toast.error('Failed to update chat status');
                              }
                            }}
                            className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span>{hotel.adminChatEnabled === false ? 'Turn on guest chat' : 'Turn off guest chat'}</span>
                            </span>
                            {hotel.adminChatEnabled !== false && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>

                          <a
                            href={`/hotel/${hotel.id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setOpenHotelMenuId(null)}
                            className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <ExternalLink className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span>View public page</span>
                            </span>
                          </a>

                          <div className="my-1 border-t border-stone-100" />

                          {hotel.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateStatus(hotel.id!, 'approved');
                                  setOpenHotelMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 transition cursor-pointer font-medium"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Approve listing</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateStatus(hotel.id!, 'rejected');
                                  setOpenHotelMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-rose-800 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>Reject listing</span>
                              </button>
                            </>
                          )}

                          {(!hotel.status || hotel.status === 'approved') && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateStatus(hotel.id!, 'pending');
                                setOpenHotelMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-50 flex items-center gap-2 transition cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Move to pending</span>
                            </button>
                          )}

                          {hotel.status === 'rejected' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateStatus(hotel.id!, 'approved');
                                setOpenHotelMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 transition cursor-pointer font-medium"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Approve listing</span>
                            </button>
                          )}

                          {(isAdmin(user) || isMarketing(user)) && (
                            <>
                              <div className="my-1 border-t border-stone-100" />
                              <button
                                type="button"
                                onClick={() => {
                                  setHotelToDelete(hotel);
                                  setOpenHotelMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Delete listing</span>
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );

                return (
                  <>
                    {/* Wide screens: table. Below xl the sidebar leaves too little width, so rows stack as cards. */}
                    <div className="hidden xl:block">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-stone-50/80 border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                            <th className="py-2.5 pl-4 pr-3 rounded-tl-xl">Property</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Rooms and rates</th>
                            <th className="hidden 2xl:table-cell py-2.5 px-3 whitespace-nowrap">Host</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                            <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap rounded-tr-xl">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {pageHotels.map((hotel, index) => {
                            const hotelRooms = rooms.filter(r => r.hotelId === hotel.id);
                            const minPriceUsd = hotelRooms.length > 0
                              ? Math.min(...hotelRooms.map(r => r.prices?.USD ?? r.price ?? 0).filter(p => p > 0))
                              : (hotel.entirePlaceDetails?.ratePerNightUsd || 0);
                            const minPriceMwk = hotelRooms.length > 0
                              ? Math.min(...hotelRooms.map(r => r.prices?.MWK ?? r.priceMWK ?? 0).filter(p => p > 0))
                              : (hotel.entirePlaceDetails?.ratePerNightMwk || 0);
                            const syncCount = (hotel.icalSyncUrls?.length || 0) +
                              hotelRooms.reduce((acc, r) => acc + (r.icalSyncUrls?.length || 0), 0);
                            const problem = pinProblem(hotel.coordinates);
                            const hostDisplay =
                              hotel.managerName ||
                              (hotel.managerId && users.find(u => u.uid === hotel.managerId)?.email) ||
                              hotel.managerEmail ||
                              hotel.ownerName ||
                              hotel.ownerEmail ||
                              null;
                            const openUpwards = index >= Math.max(0, pageHotels.length - 2) && pageHotels.length > 2;

                            return (
                              <tr
                                key={`admin-hotel-row-${hotel.id || index}-${index}`}
                                className={`transition hover:bg-stone-50/70 ${
                                  hotel.status === 'pending' ? 'bg-amber-50/20' : ''
                                }`}
                              >
                                {/* Col 1: Property */}
                                <td className="py-3 pl-4 pr-3 align-middle min-w-0">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-14 h-11 xl:w-16 xl:h-12 rounded-lg bg-stone-100 overflow-hidden shrink-0 border border-stone-200/70">
                                      <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <h3 className="text-xs sm:text-sm font-semibold text-stone-900 truncate max-w-[175px] lg:max-w-[210px] xl:max-w-[280px]" title={hotel.name}>
                                          {hotel.name}
                                        </h3>
                                        {hotel.featured && (
                                          <span title="Featured on home page" className="shrink-0">
                                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5 truncate max-w-[190px] lg:max-w-[230px] xl:max-w-[300px]">
                                        <span className="truncate">{hotel.location}</span>
                                        {hotel.categories?.[0] && (
                                          <>
                                            <span className="shrink-0">·</span>
                                            <span className="text-stone-400 shrink-0">{hotel.categories[0]}</span>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px]">
                                        {problem ? (
                                          <span className="text-amber-700 inline-flex items-center gap-1 font-medium whitespace-nowrap">
                                            <MapPinOff className="h-3 w-3 shrink-0" />
                                            <span>{PIN_PROBLEM_LABELS[problem]}</span>
                                          </span>
                                        ) : (
                                          <a
                                            href={mapLinkUrl(hotel)}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="text-stone-400 hover:text-stone-700 inline-flex items-center gap-1 transition whitespace-nowrap"
                                          >
                                            <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                                            <span>Map pin verified</span>
                                          </a>
                                        )}
                                        {syncCount > 0 && (
                                          <span className="text-emerald-700 inline-flex items-center gap-1 whitespace-nowrap">
                                            <span>·</span>
                                            <CalendarSync className="w-3 h-3 shrink-0" />
                                            <span>{syncCount} iCal</span>
                                          </span>
                                        )}
                                        {/* Inline Host info on md/lg screens where dedicated Host column is hidden */}
                                        <span className="2xl:hidden inline-flex items-center gap-1 text-stone-500 truncate max-w-[190px]">
                                          <span>·</span>
                                          <span className="truncate">Host: {hostDisplay || 'Unassigned'}</span>
                                          {(isAdmin(user) || isMarketing(user)) && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setHotelToAssignManager(hotel);
                                                setAssignManagerSelectedUid(hotel.managerId || '');
                                                setAssignManagerCustomEmail(hotel.managerEmail || '');
                                                setAssignManagerCustomName(hotel.managerName || '');
                                                setAssignManagerOwnerEmail(hotel.ownerEmail || '');
                                              }}
                                              className="text-stone-700 hover:text-stone-950 underline cursor-pointer shrink-0 ml-0.5"
                                            >
                                              ({hostDisplay ? 'Change' : 'Assign'})
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Col 2: Rooms & Rates */}
                                <td className="py-3 px-3 align-middle whitespace-nowrap">
                                  <div className="font-medium text-stone-900">
                                    {hotel.stayType === 'entire_place'
                                      ? 'Entire place'
                                      : `${hotelRooms.length} room type${hotelRooms.length === 1 ? '' : 's'}`}
                                  </div>
                                  <div className="text-[11px] text-stone-500 tabular-nums mt-0.5">
                                    {minPriceMwk > 0 || minPriceUsd > 0 ? (
                                      <>
                                        {minPriceMwk > 0 ? `MK ${minPriceMwk.toLocaleString()}` : `$${minPriceUsd}`}
                                        {minPriceMwk > 0 && minPriceUsd > 0 ? ` ($${minPriceUsd})` : ''}
                                        <span className="font-sans text-stone-400"> / night</span>
                                      </>
                                    ) : (
                                      <span className="font-sans text-stone-400">No rates set</span>
                                    )}
                                  </div>
                                </td>

                                {/* Col 3: Host / Manager (xl+) */}
                                <td className="hidden 2xl:table-cell py-3 px-3 align-middle max-w-[180px]">
                                  <div className="text-stone-800 truncate font-medium" title={hostDisplay || 'Unassigned'}>
                                    {hostDisplay || <span className="text-stone-400 font-normal">Unassigned</span>}
                                  </div>
                                  {(isAdmin(user) || isMarketing(user)) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHotelToAssignManager(hotel);
                                        setAssignManagerSelectedUid(hotel.managerId || '');
                                        setAssignManagerCustomEmail(hotel.managerEmail || '');
                                        setAssignManagerCustomName(hotel.managerName || '');
                                        setAssignManagerOwnerEmail(hotel.ownerEmail || '');
                                      }}
                                      className="text-[11px] text-stone-500 hover:text-stone-900 underline cursor-pointer mt-0.5 block whitespace-nowrap"
                                    >
                                      {hostDisplay ? 'Change host' : 'Assign host'}
                                    </button>
                                  )}
                                </td>

                                {/* Col 4: Status */}
                                <td className="py-3 px-3 align-middle whitespace-nowrap">
                                  {renderStatusBadge(hotel)}
                                </td>

                                {/* Col 5: Actions */}
                                <td className="py-3 pl-3 pr-4 align-middle text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                                    {hotel.status === 'pending' && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                                        className="tm-btn tm-btn-primary tm-btn-sm shrink-0"
                                      >
                                        Approve
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setInspectingHotel(hotel)}
                                      className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                                    >
                                      Review
                                    </button>

                                    <Link
                                      to={`/admin/hotel/${hotel.id}`}
                                      className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                                    >
                                      Edit
                                    </Link>

                                    {renderMoreMenu(hotel, `table-${hotel.id}`, openUpwards)}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile & Small Screen Stacked Card List (<md) */}
                    <div className="xl:hidden divide-y divide-stone-100">
                      {pageHotels.map((hotel, index) => {
                        const hotelRooms = rooms.filter(r => r.hotelId === hotel.id);
                        const minPriceUsd = hotelRooms.length > 0
                          ? Math.min(...hotelRooms.map(r => r.prices?.USD ?? r.price ?? 0).filter(p => p > 0))
                          : (hotel.entirePlaceDetails?.ratePerNightUsd || 0);
                        const minPriceMwk = hotelRooms.length > 0
                          ? Math.min(...hotelRooms.map(r => r.prices?.MWK ?? r.priceMWK ?? 0).filter(p => p > 0))
                          : (hotel.entirePlaceDetails?.ratePerNightMwk || 0);
                        const syncCount = (hotel.icalSyncUrls?.length || 0) +
                          hotelRooms.reduce((acc, r) => acc + (r.icalSyncUrls?.length || 0), 0);
                        const problem = pinProblem(hotel.coordinates);
                        const hostDisplay =
                          hotel.managerName ||
                          (hotel.managerId && users.find(u => u.uid === hotel.managerId)?.email) ||
                          hotel.managerEmail ||
                          hotel.ownerName ||
                          hotel.ownerEmail ||
                          null;
                        const openUpwards = index >= Math.max(0, pageHotels.length - 2) && pageHotels.length > 2;

                        return (
                          <div
                            key={`admin-hotel-card-${hotel.id || index}-${index}`}
                            className={`p-3.5 space-y-2.5 ${
                              hotel.status === 'pending' ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            {/* Top Row: Image + Name/Location + Status Badge */}
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-14 h-11 rounded-lg bg-stone-100 overflow-hidden shrink-0 border border-stone-200/70">
                                  <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-stone-900 truncate">{hotel.name}</h3>
                                    {hotel.featured && (
                                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-stone-500 truncate mt-0.5">
                                    {hotel.location}
                                    {hotel.categories?.[0] ? ` · ${hotel.categories[0]}` : ''}
                                  </p>
                                </div>
                              </div>
                              {renderStatusBadge(hotel)}
                            </div>

                            {/* Middle Info Strip: Rooms & Rates + Host */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="min-w-0">
                                <span className="text-xs text-stone-500 block">
                                  Rooms and rates
                                </span>
                                <div className="font-medium text-stone-900 truncate mt-0.5">
                                  {hotel.stayType === 'entire_place'
                                    ? 'Entire place'
                                    : `${hotelRooms.length} room type${hotelRooms.length === 1 ? '' : 's'}`}
                                </div>
                                <div className="text-[11px] text-stone-500 tabular-nums truncate">
                                  {minPriceMwk > 0 || minPriceUsd > 0 ? (
                                    <>
                                      {minPriceMwk > 0 ? `MK ${minPriceMwk.toLocaleString()}` : `$${minPriceUsd}`}
                                      {minPriceMwk > 0 && minPriceUsd > 0 ? ` ($${minPriceUsd})` : ''}
                                    </>
                                  ) : (
                                    <span className="font-sans text-stone-400">No rates set</span>
                                  )}
                                </div>
                              </div>

                              <div className="min-w-0">
                                <span className="text-xs text-stone-500 block">
                                  Host
                                </span>
                                <div className="text-stone-800 font-medium truncate mt-0.5">
                                  {hostDisplay || <span className="text-stone-400 font-normal">Unassigned</span>}
                                </div>
                                {(isAdmin(user) || isMarketing(user)) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHotelToAssignManager(hotel);
                                      setAssignManagerSelectedUid(hotel.managerId || '');
                                      setAssignManagerCustomEmail(hotel.managerEmail || '');
                                      setAssignManagerCustomName(hotel.managerName || '');
                                      setAssignManagerOwnerEmail(hotel.ownerEmail || '');
                                    }}
                                    className="text-[11px] text-stone-600 hover:text-stone-900 underline cursor-pointer"
                                  >
                                    {hostDisplay ? 'Change host' : 'Assign host'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Map Pin & Action Footer */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex items-center gap-2 text-[11px]">
                                {problem ? (
                                  <span className="text-amber-700 inline-flex items-center gap-1 font-medium">
                                    <MapPinOff className="h-3 w-3 shrink-0" />
                                    <span>{PIN_PROBLEM_LABELS[problem]}</span>
                                  </span>
                                ) : (
                                  <a
                                    href={mapLinkUrl(hotel)}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
                                  >
                                    <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                                    <span>Pin OK</span>
                                  </a>
                                )}
                                {syncCount > 0 && (
                                  <span className="text-emerald-700 inline-flex items-center gap-1">
                                    <span>·</span>
                                    <CalendarSync className="w-3 h-3 shrink-0" />
                                    <span>{syncCount} iCal</span>
                                  </span>
                                )}
                              </div>

                              <div className="tm-actions ml-auto">
                                {hotel.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                                    className="tm-btn tm-btn-primary tm-btn-sm"
                                  >
                                    Approve
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setInspectingHotel(hotel)}
                                  className="tm-btn tm-btn-secondary tm-btn-sm"
                                >
                                  Review
                                </button>

                                <Link
                                  to={`/admin/hotel/${hotel.id}`}
                                  className="tm-btn tm-btn-secondary tm-btn-sm"
                                >
                                  Edit
                                </Link>

                                {renderMoreMenu(hotel, `card-${hotel.id}`, openUpwards)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
              <div>
                Showing <span className="font-semibold text-stone-900 tabular-nums">{visibleHotels.length === 0 ? 0 : (currentHotelPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 tabular-nums">{Math.min(currentHotelPage * itemsPerPage, visibleHotels.length)}</span> of <span className="font-semibold text-stone-900 tabular-nums">{visibleHotels.length}</span> properties
              </div>
              {visibleHotels.length > itemsPerPage && (
                <Pagination
                  currentPage={currentHotelPage}
                  totalPages={Math.ceil(visibleHotels.length / itemsPerPage)}
                  onPageChange={setCurrentHotelPage}
                  className="flex items-center gap-1.5 my-0"
                />
              )}
            </div>
          </div>
        )}
        {/* ===================== USERS TAB ===================== */}
        {activeTab === 'users' && canViewTab('users') && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-stone-200">
              <div className="min-w-0">
                <h2 className="tm-h1">Users</h2>
                <p className="tm-muted mt-0.5">Accounts, roles and password resets.</p>
              </div>

              <div className="tm-actions">
                <div className="relative min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search users"
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setCurrentUserPage(1); }}
                    className="tm-input pl-8 sm:w-56"
                  />
                </div>

                {isGlobalAdmin(user) && (
                  <button
                    type="button"
                    onClick={() => setShowQuickResetModal(true)}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    <Key className="h-3.5 w-3.5" />
                    <span>Reset password</span>
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white flex flex-col">
              {(() => {
                const pageUsers = visibleUsers.slice(
                  (currentUserPage - 1) * itemsPerPage,
                  currentUserPage * itemsPerPage
                );

                const renderRoleBadges = (rolesList: string[]) => (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rolesList.includes('global_admin') && (
                      <span className="tm-tag bg-stone-900 text-white whitespace-nowrap">
                        Global Admin
                      </span>
                    )}
                    {rolesList.includes('admin') && !rolesList.includes('global_admin') && (
                      <span className="tm-tag tm-tag-warn whitespace-nowrap">
                        Admin
                      </span>
                    )}
                    {rolesList.includes('marketing') && (
                      <span className="tm-tag whitespace-nowrap">
                        Marketing
                      </span>
                    )}
                    {rolesList.includes('hotel_manager') && (
                      <span className="tm-tag whitespace-nowrap">
                        Manager
                      </span>
                    )}
                    {rolesList.includes('traveller') && !rolesList.includes('hotel_manager') && !rolesList.includes('admin') && !rolesList.includes('global_admin') && !rolesList.includes('marketing') && (
                      <span className="text-xs text-stone-400">
                        Traveller
                      </span>
                    )}
                  </div>
                );

                const renderUserActions = (u: any, rolesList: string[], menuKey: string, openUpwards: boolean) => (
                  <div className="relative inline-block text-left shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenUserMenuId(openUserMenuId === menuKey ? null : menuKey)}
                      className="tm-btn tm-btn-secondary tm-btn-sm gap-1.5"
                      aria-label="User actions"
                    >
                      <span>Actions</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${openUserMenuId === menuKey ? 'rotate-180' : ''}`} />
                    </button>

                    {openUserMenuId === menuKey && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setOpenUserMenuId(null)}
                        />
                        <div className={`absolute right-0 w-52 bg-white rounded-xl shadow-sm border border-stone-200 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-150 ${
                          openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                        }`}>
                          <div className="px-3 py-1 text-xs text-stone-500">
                            Roles
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              handleToggleUserRole(u, 'hotel_manager');
                              setOpenUserMenuId(null);
                            }}
                            className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                          >
                            <span>Host / property manager</span>
                            {rolesList.includes('hotel_manager') && (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </button>

                          {isAdmin(user) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleUserRole(u, 'marketing');
                                  setOpenUserMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                              >
                                <span>Marketing</span>
                                {rolesList.includes('marketing') && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleUserRole(u, 'admin');
                                  setOpenUserMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                              >
                                <span>Administrator</span>
                                {rolesList.includes('admin') && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                              </button>
                            </>
                          )}

                          {isGlobalAdmin(user) && (
                            <button
                              type="button"
                              onClick={() => {
                                handleToggleUserRole(u, 'global_admin');
                                setOpenUserMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-stone-900 font-semibold hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                            >
                              <span>Global Admin</span>
                              {rolesList.includes('global_admin') && (
                                <Check className="w-3.5 h-3.5 text-stone-950 shrink-0" />
                              )}
                            </button>
                          )}

                          {(isAdmin(user) || isMarketing(user)) && (
                            <>
                              <div className="my-1 border-t border-stone-100" />
                              <div className="px-3 py-1 text-xs text-stone-500">
                                Account
                              </div>

                              {u.email && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleResendUserOnboardingEmail(u);
                                    setOpenUserMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition cursor-pointer"
                                  title="Resend partner onboarding credentials and listing access details via SMTP"
                                >
                                  <Mail className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>Resend onboarding email</span>
                                </button>
                              )}

                              {isAdmin(user) && u.email && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetEmailTarget(u.email!);
                                    setOpenUserMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Key className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                  <span>Reset password</span>
                                </button>
                              )}

                              {(!rolesList.includes('global_admin') || isGlobalAdmin(user)) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleToggleUserSuspension(u);
                                    setOpenUserMenuId(null);
                                  }}
                                  className={`w-full px-3 py-1.5 text-xs flex items-center gap-2 transition cursor-pointer ${
                                    (u.status === 'suspended' || u.accessRevoked)
                                      ? 'text-emerald-700 hover:bg-emerald-50'
                                      : 'text-amber-800 hover:bg-amber-50'
                                  }`}
                                >
                                  <Shield className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                  <span>{(u.status === 'suspended' || u.accessRevoked) ? 'Restore access' : 'Revoke access'}</span>
                                </button>
                              )}

                              {isAdmin(user) && (isGlobalAdmin(user) || (!rolesList.includes('admin') && !rolesList.includes('global_admin'))) && (
                                <>
                                  <div className="my-1 border-t border-stone-100" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteUser(u);
                                      setOpenUserMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    <span>Delete profile</span>
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );

                return (
                  <>
                    {/* Desktop & Laptop Table (md+) */}
                    <div className="hidden md:block min-h-[300px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50 text-xs font-medium text-stone-500">
                            <th className="px-4 py-3 rounded-tl-xl">User</th>
                            <th className="px-4 py-3 whitespace-nowrap">Joined</th>
                            <th className="px-4 py-3">Roles</th>
                            <th className="px-4 py-3 text-right whitespace-nowrap rounded-tr-xl">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {pageUsers.map((u, index) => {
                            const rolesList = userRoles(u);
                            const userMenuKey = `table-${u.uid || index}`;
                            const openUpwards = index >= Math.max(0, pageUsers.length - 2) && pageUsers.length > 2;
                            return (
                              <tr key={`admin-user-${u.uid || index}-${index}`} className={`hover:bg-stone-50/70 transition ${u.status === 'suspended' || u.accessRevoked ? 'opacity-50 grayscale' : ''}`}>
                                <td className="px-4 py-3.5 min-w-0">
                                  <p className="font-medium text-stone-900 flex items-center gap-2 text-sm min-w-0">
                                    <span className="truncate max-w-[240px]">{u.displayName || 'No Name'}</span>
                                    {(u.status === 'suspended' || u.accessRevoked) && (
                                      <span className="tm-tag tm-tag-bad shrink-0">
                                        Suspended
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-stone-500 truncate max-w-[260px]">{u.email}</p>
                                  <p className="text-[11px] text-stone-400 mt-0.5 font-mono truncate max-w-[260px]" title="User ID">{u.uid}</p>
                                </td>
                                <td className="px-4 py-3.5 text-xs text-stone-600 whitespace-nowrap">
                                  {new Date(u.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3.5">
                                  {renderRoleBadges(rolesList)}
                                </td>
                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                  {renderUserActions(u, rolesList, userMenuKey, openUpwards)}
                                </td>
                              </tr>
                            );
                          })}
                          {visibleUsers.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                                No users found matching "{userSearch}".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Stacked Card List (<md) */}
                    <div className="md:hidden divide-y divide-stone-100">
                      {pageUsers.map((u, index) => {
                        const rolesList = userRoles(u);
                        const userMenuKey = `card-${u.uid || index}`;
                        const openUpwards = index >= Math.max(0, pageUsers.length - 2) && pageUsers.length > 2;
                        return (
                          <div
                            key={`admin-user-card-${u.uid || index}-${index}`}
                            className={`p-3.5 space-y-2.5 ${u.status === 'suspended' || u.accessRevoked ? 'opacity-50 grayscale' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-stone-900 text-sm truncate">{u.displayName || 'No Name'}</p>
                                  {(u.status === 'suspended' || u.accessRevoked) && (
                                    <span className="tm-tag tm-tag-bad shrink-0">
                                      Suspended
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-500 truncate mt-0.5">{u.email}</p>
                              </div>
                              {renderUserActions(u, rolesList, userMenuKey, openUpwards)}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                              {renderRoleBadges(rolesList)}
                              <span className="text-[11px] text-stone-400 whitespace-nowrap">
                                Joined {new Date(u.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {visibleUsers.length === 0 && (
                        <div className="px-6 py-12 text-center text-stone-500 text-xs">
                          No users found matching "{userSearch}".
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              
              <div className="px-4 sm:px-5 py-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 shrink-0">
                <div>
                  Showing <span className="font-semibold text-stone-900 tabular-nums">{visibleUsers.length === 0 ? 0 : (currentUserPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 tabular-nums">{Math.min(currentUserPage * itemsPerPage, visibleUsers.length)}</span> of <span className="font-semibold text-stone-900 tabular-nums">{visibleUsers.length}</span> users
                </div>
                {visibleUsers.length > itemsPerPage && (
                  <Pagination
                    currentPage={currentUserPage}
                    totalPages={Math.ceil(visibleUsers.length / itemsPerPage)}
                    onPageChange={setCurrentUserPage}
                    className="flex items-center gap-1.5 my-0"
                  />
                )}
              </div>
            </div>

            {/* Quick Password Reset Modal */}
            {showQuickResetModal && (
              <Modal
                open={showQuickResetModal}
                onClose={() => { setShowQuickResetModal(false); setQuickResetEmail(''); }}
                size="sm"
                title="Send password reset"
                description="Email a reset link to a registered user."
                footer={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowQuickResetModal(false); setQuickResetEmail(''); }}
                      className="tm-btn tm-btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="admin-quick-reset-form"
                      disabled={sendingQuickReset || !quickResetEmail.trim()}
                      className="tm-btn tm-btn-primary flex-1"
                    >
                      {sendingQuickReset ? 'Sending…' : 'Send link'}
                    </button>
                  </div>
                }
              >
                <form
                  id="admin-quick-reset-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const target = quickResetEmail.trim();
                    if (!target) return;
                    setSendingQuickReset(true);
                    try {
                      await resetPassword(target);
                      toast.success(`Password reset email sent to ${target}`);
                      setShowQuickResetModal(false);
                      setQuickResetEmail('');
                    } catch (err: any) {
                      const msg =
                        err?.code === 'auth/user-not-found'
                          ? 'No account found with this email in Firebase Auth.'
                          : err?.code === 'auth/invalid-email'
                          ? 'Invalid email format.'
                          : err?.code === 'auth/too-many-requests'
                          ? 'Too many attempts. Please wait a moment.'
                          : err?.message || 'Failed to send password reset email';
                      toast.error(msg);
                    } finally {
                      setSendingQuickReset(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 tracking-wide mb-1.5">
                      User Email Address
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={quickResetEmail}
                      onChange={(e) => setQuickResetEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:bg-white focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition"
                    />
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Firebase will email a secure link allowing the user to select a new password. The link expires after 1 hour.
                  </p>
                </form>
              </Modal>
            )}
          </div>
        )}
        {/* ===================== BOOKINGS TAB ===================== */}
        {activeTab === 'bookings' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="pb-2 border-b border-stone-200">
              <h2 className="tm-h1">Bookings</h2>
              <p className="tm-muted mt-0.5">All reservations across properties.</p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden flex flex-col">
              {/* Table from xl; below that the sidebar leaves too little width, so rows stack. */}
              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-xs font-medium text-stone-500">
                      <th className="px-4 py-3 whitespace-nowrap">Ref</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Guest</th>
                      <th className="px-4 py-3 whitespace-nowrap">Dates</th>
                      <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {bookings.slice((currentBookingPage - 1) * itemsPerPage, currentBookingPage * itemsPerPage).map((b, index) => {
                      const hotelName = hotels.find(h => h.id === b.hotelId)?.name || 'Unknown Property';
                      return (
                        <tr key={`admin-booking-${b.id || index}-${index}`} className="hover:bg-stone-50/70 transition">
                          <td className="px-4 py-3.5 text-xs font-mono text-stone-500 whitespace-nowrap">{b.reference || 'N/A'}</td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-stone-900 max-w-[180px] truncate" title={hotelName}>{hotelName}</td>
                          <td className="px-4 py-3.5 text-xs text-stone-700 max-w-[180px]">
                            <div className="truncate font-medium">{b.guestName}</div>
                            <div className="text-[11px] text-stone-400 truncate">{b.guestEmail || 'No Email'}</div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-stone-600 whitespace-nowrap">
                            {b.checkIn} <br/>to {b.checkOut}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-stone-900 whitespace-nowrap">
                            {b.total ? (b.currency === 'USD' ? `$${Number(b.total).toLocaleString()}` : `MK ${Number(b.total).toLocaleString()}`) : '—'}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`tm-tag capitalize whitespace-nowrap ${
                              b.status === 'confirmed' ? 'tm-tag-good' :
                              b.status === 'rejected' ? 'tm-tag-bad' :
                              b.status === 'cancelled' ? '' :
                              'tm-tag-warn'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                              <select
                                value={b.status}
                                onChange={(e) => handleUpdateBookingStatus(b.id!, e.target.value as any)}
                                className="tm-input w-auto! max-w-[125px] py-1.5! text-xs cursor-pointer"
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setBookingToDelete(b)}
                                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                                title="Delete booking" aria-label="Delete booking"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                          No bookings yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card List (<md) */}
              <div className="xl:hidden divide-y divide-stone-100">
                {bookings.slice((currentBookingPage - 1) * itemsPerPage, currentBookingPage * itemsPerPage).map((b, index) => {
                  const hotelName = hotels.find(h => h.id === b.hotelId)?.name || 'Unknown Property';
                  return (
                    <div key={`admin-booking-card-${b.id || index}-${index}`} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-stone-900 truncate">{hotelName}</h3>
                          <p className="text-[11px] font-mono text-stone-500 mt-0.5">Ref: {b.reference || 'N/A'}</p>
                        </div>
                        <span className={`tm-tag capitalize whitespace-nowrap shrink-0 ${
                          b.status === 'confirmed' ? 'tm-tag-good' :
                          b.status === 'rejected' ? 'tm-tag-bad' :
                          b.status === 'cancelled' ? '' :
                          'tm-tag-warn'
                        }`}>
                          {b.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="text-xs text-stone-500 block">Guest</span>
                          <div className="font-medium text-stone-900 truncate mt-0.5">{b.guestName}</div>
                          <div className="text-[11px] text-stone-500 truncate">{b.guestEmail || 'No Email'}</div>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-stone-500 block">Stay and total</span>
                          <div className="text-[11px] text-stone-700 truncate mt-0.5">{b.checkIn} → {b.checkOut}</div>
                          <div className="text-xs font-semibold text-stone-900 mt-0.5">
                            {b.total ? (b.currency === 'USD' ? `$${Number(b.total).toLocaleString()}` : `MK ${Number(b.total).toLocaleString()}`) : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <select
                          value={b.status}
                          onChange={(e) => handleUpdateBookingStatus(b.id!, e.target.value as any)}
                          className="tm-input flex-1 min-w-0 py-1.5! text-xs cursor-pointer"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="rejected">Rejected</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setBookingToDelete(b)}
                          className="tm-btn tm-btn-danger tm-btn-sm shrink-0"
                          title="Delete booking"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {bookings.length === 0 && (
                  <div className="px-6 py-12 text-center text-stone-500 text-xs">
                    No bookings yet.
                  </div>
                )}
              </div>
              
              <div className="px-4 sm:px-5 py-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 shrink-0">
                <div>
                  Showing <span className="font-semibold text-stone-900 tabular-nums">{bookings.length === 0 ? 0 : (currentBookingPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 tabular-nums">{Math.min(currentBookingPage * itemsPerPage, bookings.length)}</span> of <span className="font-semibold text-stone-900 tabular-nums">{bookings.length}</span> bookings
                </div>
                {bookings.length > itemsPerPage && (
                  <Pagination
                    currentPage={currentBookingPage}
                    totalPages={Math.ceil(bookings.length / itemsPerPage)}
                    onPageChange={setCurrentBookingPage}
                    className="flex items-center gap-1.5 my-0"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== DESTINATIONS TAB ===================== */}
        {activeTab === 'destinations' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-stone-200">
              <div className="min-w-0">
                <h2 className="tm-h1">Popular destinations</h2>
                <p className="tm-muted mt-0.5">Places shown on the explore page and home page.</p>
              </div>
              <div className="tm-actions">
                <label className="flex items-center gap-2.5 text-sm font-medium text-stone-700">
                  <span>Choose the list myself</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={manualDestinationsEnabled}
                    onClick={() => setManualDestinationsEnabled(!manualDestinationsEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${manualDestinationsEnabled ? 'bg-emerald-600' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${manualDestinationsEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </label>
                <button
                  onClick={saveDestinations}
                  disabled={savingDestinations}
                  className="tm-btn tm-btn-primary"
                >
                  {savingDestinations ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>

            {!manualDestinationsEnabled && (
              <p className="tm-muted">The home page picks popular destinations from live listings and bookings.</p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Custom Destinations Manager */}
              <div className="tm-panel min-w-0 flex flex-col h-full">
                <h3 className="tm-h2 mb-1">Your list</h3>
                <p className="tm-muted mb-4">
                  Shown exactly as listed when you choose the list yourself.
                </p>

                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newDestination}
                    onChange={e => setNewDestination(e.target.value)}
                    placeholder="E.g. Cape Maclear"
                    className="tm-input min-w-0 flex-1"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newDestination.trim() && !customDestinations.includes(newDestination.trim())) {
                        setCustomDestinations([...customDestinations, newDestination.trim()]);
                        setNewDestination('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newDestination.trim() && !customDestinations.includes(newDestination.trim())) {
                        setCustomDestinations([...customDestinations, newDestination.trim()]);
                        setNewDestination('');
                      }
                    }}
                    className="tm-btn tm-btn-primary shrink-0"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  {customDestinations.map((dest, i) => (
                    <div key={`custom-dest-${dest}-${i}`} className="flex items-center justify-between gap-2 border-b border-stone-100 py-2.5 group">
                      <span className="font-medium text-stone-900 truncate">{i + 1}. {dest}</span>
                      <button
                        type="button"
                        onClick={() => setCustomDestinations(customDestinations.filter(d => d !== dest))}
                        className="text-stone-400 hover:text-red-600 transition shrink-0 p-1 rounded-md hover:bg-red-50 cursor-pointer"
                        title={`Remove ${dest}`}
                        aria-label={`Remove ${dest}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {customDestinations.length === 0 && (
                    <div className="flex-1 flex items-center justify-center p-6 text-center tm-muted"
                    >
                      No destinations yet. Add one above.
                    </div>
                  )}
                </div>
              </div>

              {/* Data-driven Recommendations */}
              <div className="tm-panel min-w-0 flex flex-col h-full max-h-[600px]">
                <h3 className="tm-h2 mb-1">Suggestions</h3>
                <p className="tm-muted mb-4">
                  Ranked from live listings and bookings. Add any to your list.
                </p>
                
                <div className="overflow-y-auto pr-2 space-y-2 flex-1 scrollbar-slim">
                  {destinationStats.map((stat, sIdx) => (
                    <div key={`dest-stat-${stat.location}-${sIdx}`} className="flex items-center justify-between gap-2 py-2.5 border-b border-stone-100">
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900 truncate">{stat.location}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {stat.listings}</span>
                          <span className="flex items-center gap-1"><CalendarRange className="w-3 h-3" /> {stat.bookings}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!customDestinations.includes(stat.location)) {
                            setCustomDestinations([...customDestinations, stat.location]);
                          }
                        }}
                        disabled={customDestinations.includes(stat.location)}
                        className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                      >
                        {customDestinations.includes(stat.location) ? 'Added' : 'Add'}
                      </button>
                    </div>
                  ))}
                  {destinationStats.length === 0 && (
                    <p className="tm-muted text-center py-6">No destination data yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CONTENT TAB ===================== */}
        {activeTab === 'content' && (
          <div className="space-y-6 animate-in fade-in duration-200 pb-20">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200">
              <div className="min-w-0">
                <h2 className="tm-h1">Content and legal</h2>
                <p className="tm-muted mt-0.5">
                  Domain, footer contact, social links and policies.
                </p>
              </div>
              <button
                onClick={handleSaveContent}
                disabled={savingContent}
                className="tm-btn tm-btn-primary"
              >
                {savingContent ? 'Saving…' : 'Save changes'}
              </button>
            </div>
            
            <div className="tm-panel min-w-0 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 mb-3 pb-2 border-b border-stone-100">Domain and footer contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="tm-label">Platform domain</label>
                    <input
                      type="url"
                      value={contentSettings.platformDomain || ''}
                      onChange={e => setContentSettings({...contentSettings, platformDomain: e.target.value})}
                      placeholder="https://ulendomalawi.com"
                      className="tm-input"
                    />
                    <p className="tm-muted mt-1 text-xs">Used in emails and partner guides.</p>
                  </div>
                  <div>
                    <label className="tm-label">Support email</label>
                    <input
                      type="email"
                      value={contentSettings.contactEmail || ''}
                      onChange={e => setContentSettings({...contentSettings, contactEmail: e.target.value})}
                      placeholder="info@ulendomalawi.com"
                      className="tm-input"
                    />
                    <p className="tm-muted mt-1 text-xs">Shown in the footer and on receipts.</p>
                  </div>
                  <div>
                    <label className="tm-label">Support phone</label>
                    <input
                      type="text"
                      value={contentSettings.contactPhone || ''}
                      onChange={e => setContentSettings({...contentSettings, contactPhone: e.target.value})}
                      placeholder="+265 99 123 4567"
                      className="tm-input"
                    />
                    <p className="tm-muted mt-1 text-xs">Leave blank to hide it from the footer.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-stone-900 mb-3 pb-2 border-b border-stone-100">Social links</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="tm-label">Facebook URL</label>
                    <input
                      type="url"
                      value={contentSettings.socialFacebook || ''}
                      onChange={e => setContentSettings({...contentSettings, socialFacebook: e.target.value})}
                      placeholder="https://facebook.com/..."
                      className="tm-input"
                    />
                  </div>
                  <div>
                    <label className="tm-label">Instagram URL</label>
                    <input
                      type="url"
                      value={contentSettings.socialInstagram || ''}
                      onChange={e => setContentSettings({...contentSettings, socialInstagram: e.target.value})}
                      placeholder="https://instagram.com/..."
                      className="tm-input"
                    />
                  </div>
                  <div>
                    <label className="tm-label">X / Twitter URL</label>
                    <input
                      type="url"
                      value={contentSettings.socialTwitter || ''}
                      onChange={e => setContentSettings({...contentSettings, socialTwitter: e.target.value})}
                      placeholder="https://twitter.com/..."
                      className="tm-input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-stone-900 mb-3 pb-2 border-b border-stone-100">Legal policies (Markdown works)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="tm-label">Privacy policy</label>
                    <textarea
                      value={contentSettings.privacyPolicy || ''}
                      onChange={e => setContentSettings({...contentSettings, privacyPolicy: e.target.value})}
                      rows={5}
                      placeholder="Leave blank to use the default text"
                      className="tm-input"
                    />
                  </div>
                  <div>
                    <label className="tm-label">Terms of service</label>
                    <textarea
                      value={contentSettings.termsOfService || ''}
                      onChange={e => setContentSettings({...contentSettings, termsOfService: e.target.value})}
                      rows={5}
                      placeholder="Leave blank to use the default text"
                      className="tm-input"
                    />
                  </div>
                  <div>
                    <label className="tm-label">Refund policy</label>
                    <textarea
                      value={contentSettings.refundPolicy || ''}
                      onChange={e => setContentSettings({...contentSettings, refundPolicy: e.target.value})}
                      rows={5}
                      placeholder="Leave blank to use the default text"
                      className="tm-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== AI CONFIGURATION TAB ===================== */}
        {activeTab === 'ai' && canViewTab('ai') && (
          <AdminAISettings />
        )}

        {/* ===================== SYSTEM LOGS TAB ===================== */}
        {activeTab === 'logs' && canViewTab('logs') && (
          <AdminLogs />
        )}

        {/* ===================== EXECUTIVE DOCS TAB ===================== */}
        {activeTab === 'docs' && (
          <AdminDocsHub />
        )}

        {/* ===================== SETTINGS & CHANNELS CONFIGURATION TAB ===================== */}
        {activeTab === 'settings' && canViewTab('settings') && (
          <div className="space-y-6">
            <div className="flex items-center gap-5 sm:gap-8 border-b border-stone-200 pb-0 w-full max-w-full overflow-x-auto no-scrollbar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={settingsSubTab === 'channels'}
                onClick={() => setSettingsSubTab('channels')}
                className={`pb-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  settingsSubTab === 'channels'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
                }`}
              >
                <CalendarSync className="w-3.5 h-3.5 shrink-0" />
                <span>iCal and channels</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={settingsSubTab === 'whatsapp'}
                onClick={() => setSettingsSubTab('whatsapp')}
                className={`pb-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  settingsSubTab === 'whatsapp'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={settingsSubTab === 'email'}
                onClick={() => setSettingsSubTab('email')}
                className={`pb-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  settingsSubTab === 'email'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
                }`}
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>Email</span>
              </button>
            </div>

            {settingsSubTab === 'channels' && (
              <AdminIcalMonitor
                hotels={hotels}
                rooms={rooms}
                onHotelsUpdated={setHotels}
                onRoomsUpdated={setRooms}
              />
            )}
            {settingsSubTab === 'whatsapp' && <AdminWhatsAppSettings />}
            {settingsSubTab === 'email' && <AdminEmailSettings />}
          </div>
        )}

        {/* ===================== DIRECT CHANNELS & ICAL MONITOR TAB ===================== */}
        {activeTab === 'channels' && (
          <AdminIcalMonitor
            hotels={hotels}
            rooms={rooms}
            onHotelsUpdated={setHotels}
            onRoomsUpdated={setRooms}
          />
        )}

        {/* ===================== REVIEW SCRAPER TAB ===================== */}
        {activeTab === 'reviews' && (
          <AdminReviewScraper 
            hotels={hotels} 
            initialHotelId={reviewScraperHotelId}
            onHotelUpdated={(updatedHotel) => {
              setHotels(prev => prev.map(h => h.id === updatedHotel.id ? updatedHotel : h));
              setInspectingHotel(prev => prev?.id === updatedHotel.id ? updatedHotel : prev);
            }} 
          />
        )}

        <ConfirmDialog
          isOpen={!!confirmAction}
          title={`${confirmAction?.actionName} Property`}
          message={`Are you sure you want to ${confirmAction?.actionName?.toLowerCase()} "${confirmAction?.hotelName}"?`}
          confirmText={`Yes, ${confirmAction?.actionName?.toLowerCase()}`}
          cancelText="Cancel"
          isDestructive={confirmAction?.newStatus === 'rejected' || confirmAction?.newStatus === 'pending'}
          onConfirm={() => {
            if (confirmAction) {
              handleUpdateStatus(confirmAction.hotelId, confirmAction.newStatus);
              setConfirmAction(null);
            }
          }}
          onCancel={() => setConfirmAction(null)}
        />

        <ConfirmDialog
          isOpen={!!hotelToDelete}
          title="Delete property listing"
          message={`Are you sure you want to permanently delete "${hotelToDelete?.name}"? All associated room types, inventory, and configurations will be permanently deleted from the database. This action cannot be undone.`}
          confirmText={isDeletingHotel ? "Deleting..." : "Yes, delete listing"}
          cancelText="Cancel"
          isDestructive={true}
          onConfirm={handleConfirmDeleteHotel}
          onCancel={() => {
            if (!isDeletingHotel) setHotelToDelete(null);
          }}
        />

        <ConfirmDialog
          isOpen={!!bookingToDelete}
          title="Delete booking"
          message={`Are you sure you want to permanently delete booking Ref #${bookingToDelete?.reference || bookingToDelete?.id?.slice(0, 8)} for ${bookingToDelete?.guestName}? Room availability will be restored and any automated reminders will be cancelled.`}
          confirmText={isDeletingBooking ? "Deleting..." : "Yes, delete booking"}
          cancelText="Cancel"
          isDestructive={true}
          onConfirm={confirmDeleteBooking}
          onCancel={() => {
            if (!isDeletingBooking) setBookingToDelete(null);
          }}
        />

        <ConfirmDialog
          isOpen={!!userToDelete}
          title="Delete user profile"
          message={`Are you sure you want to permanently delete the profile for ${userToDelete?.email || userToDelete?.displayName || userToDelete?.uid}? This will remove all their access and data.`}
          confirmText={isDeletingUser ? "Deleting..." : "Yes, delete user"}
          cancelText="Cancel"
          isDestructive={true}
          onConfirm={confirmDeleteUser}
          onCancel={() => {
            if (!isDeletingUser) setUserToDelete(null);
          }}
        />

        <ConfirmDialog
          isOpen={!!resetEmailTarget}
          title="Reset password"
          message={`Send a password reset email to ${resetEmailTarget}?`}
          confirmText="Send reset link"
          cancelText="Cancel"
          isDestructive={false}
          onConfirm={async () => {
            if (!resetEmailTarget) return;
            const target = resetEmailTarget;
            setResetEmailTarget(null);
            try {
              await resetPassword(target);
              toast.success(`Reset link sent to ${target}`);
            } catch (err: any) {
              const errorMsg =
                err?.code === 'auth/user-not-found'
                  ? 'No user found with this email in Firebase Auth.'
                  : err?.code === 'auth/invalid-email'
                  ? 'Invalid email format.'
                  : err?.code === 'auth/too-many-requests'
                  ? 'Too many reset attempts. Please wait a moment.'
                  : err?.message || 'Failed to send reset link';
              toast.error(errorMsg);
            }
          }}
          onCancel={() => setResetEmailTarget(null)}
        />

        <ConfirmDialog
          isOpen={!!userToToggleSuspension}
          title={userToToggleSuspension?.status === 'suspended' || userToToggleSuspension?.accessRevoked ? 'Restore User Access' : 'Suspend User Access'}
          message={`Are you sure you want to ${userToToggleSuspension?.status === 'suspended' || userToToggleSuspension?.accessRevoked ? 'restore' : 'suspend'} access for ${userToToggleSuspension?.email}?`}
          confirmText={userToToggleSuspension?.status === 'suspended' || userToToggleSuspension?.accessRevoked ? 'Restore Access' : 'Suspend Access'}
          cancelText="Cancel"
          isDestructive={!(userToToggleSuspension?.status === 'suspended' || userToToggleSuspension?.accessRevoked)}
          onConfirm={confirmToggleUserSuspension}
          onCancel={() => setUserToToggleSuspension(null)}
        />

        {/* Assign / Reassign Manager Modal */}
        {hotelToAssignManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 animate-in fade-in duration-150">
            <div className="tm-panel max-w-lg w-full max-h-[90vh] overflow-y-auto sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h3 className="tm-h2">
                    Assign property manager
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {hotelToAssignManager.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHotelToAssignManager(null)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="tm-label">
                    Registered host or user
                  </label>
                  <select
                    value={assignManagerSelectedUid}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setAssignManagerSelectedUid(uid);
                      const matched = users.find(u => u.uid === uid);
                      if (matched) {
                        setAssignManagerCustomEmail(matched.email || '');
                        setAssignManagerCustomName(matched.displayName || matched.email?.split('@')[0] || '');
                      }
                    }}
                    className="tm-input cursor-pointer"
                  >
                    <option value="">Choose a user, or enter details below</option>
                    <option value="unassigned">Unassigned (platform admins only)</option>
                    <optgroup label="Hosts and managers">
                      {users.filter(u => userRoles(u).includes('hotel_manager')).map(u => (
                        <option key={`mgr-${u.uid}`} value={u.uid}>
                          {u.displayName || 'Unnamed'} ({u.email})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other accounts">
                      {users.filter(u => !userRoles(u).includes('hotel_manager')).map(u => (
                        <option key={`usr-${u.uid}`} value={u.uid}>
                          {u.displayName || 'User'} ({u.email}) [{userRoles(u).join(', ')}]
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="tm-label">
                      Manager name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kondwani Phiri"
                      value={assignManagerCustomName}
                      onChange={(e) => setAssignManagerCustomName(e.target.value)}
                      className="tm-input"
                    />
                  </div>
                  <div>
                    <label className="tm-label">
                      Manager email
                    </label>
                    <input
                      type="email"
                      placeholder="manager@lodge.mw"
                      value={assignManagerCustomEmail}
                      onChange={(e) => setAssignManagerCustomEmail(e.target.value)}
                      className="tm-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="tm-label">
                    Owner email (optional)
                  </label>
                  <input
                    type="email"
                    placeholder="owner@company.mw"
                    value={assignManagerOwnerEmail}
                    onChange={(e) => setAssignManagerOwnerEmail(e.target.value)}
                    className="tm-input"
                  />
                  <p className="tm-muted mt-1 text-xs">
                    A separate owner also gets management access.
                  </p>
                </div>
              </div>

              <div className="tm-actions justify-end pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setHotelToAssignManager(null)}
                  className="tm-btn tm-btn-quiet"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isAssigningManager}
                  onClick={handleSaveManagerAssignment}
                  className="tm-btn tm-btn-primary"
                >
                  {isAssigningManager ? 'Saving...' : 'Save assignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Marketing & Admin Property Review Modal */}
        <ReviewListingModal
          hotel={inspectingHotel}
          rooms={rooms}
          isOpen={!!inspectingHotel}
          onClose={() => setInspectingHotel(null)}
          onApprove={async (id) => {
            await handleUpdateStatus(id, 'approved');
          }}
          onReject={async (id, reason) => {
            await handleUpdateStatus(id, 'rejected', reason);
          }}
          onDelete={async (id) => {
            const target = hotels.find(h => h.id === id);
            if (target) {
              setInspectingHotel(null);
              setHotelToDelete(target);
            }
          }}
          onOpenReviewScraper={(id) => {
            setReviewScraperHotelId(id);
            setActiveTab('reviews');
          }}
          onHotelUpdated={(updatedHotel) => {
            setHotels(prev => prev.map(h => h.id === updatedHotel.id ? updatedHotel : h));
            setInspectingHotel(updatedHotel);
          }}
          isUpdating={updatingId === inspectingHotel?.id}
        />

      </div>
    </div>
  );
}

