import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where, writeBatch } from 'firebase/firestore';
import { todayStr } from '../lib/dates';
import { db, auth } from '../lib/firebase';
import { Hotel, User, Booking, Role } from '../types';
import { SystemSettings } from '../hooks/useSystemSettings';
import { 
  Shield, ShieldCheck, Building2, CheckCircle, CheckCircle2, XCircle, Clock, MapPin, 
  MapPinOff, Users, Edit2, Edit3, Key, Trash2, Star, ExternalLink, 
  MessageSquare, MessageSquareOff, LayoutDashboard, CalendarRange, FileText, 
  Search, Activity, Cpu, Target, Download, ChevronDown, MoreHorizontal, Check
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import { PIN_PROBLEM_LABELS, mapLinkUrl, pinProblem } from '../lib/geo';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import AdminAISettings from '../components/AdminAISettings';
import AdminDocsHub from '../components/AdminDocsHub';
import AdminReviewScraper from '../components/AdminReviewScraper';
import AdminEmailSettings from '../components/AdminEmailSettings';
import AdminWhatsAppSettings from '../components/AdminWhatsAppSettings';
import AdminLogs from '../components/AdminLogs';
import { logSystemEvent } from '../lib/logger';
import { getHotelImage } from '../lib/images';
import { isAdmin, isGlobalAdmin, isMarketing, isHotelManager, userRoles, toRoleFields } from '../lib/roles';
import { formatMoney } from '../lib/booking';
import { updateBookingWithSlot, deleteBookingWithSlot, cancelBookingReminders } from '../lib/bookingWrites';
import { useConfirmBooking } from '../hooks/useConfirmBooking';
import PriceMismatchNotice from '../components/PriceMismatchNotice';
import { Navigation, TrendingUp, BookOpen, Mail, Settings } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import PriceDisplay from '../components/PriceDisplay';

type Tab = 'overview' | 'analytics' | 'properties' | 'reviews' | 'users' | 'bookings' | 'destinations' | 'content' | 'ai' | 'logs' | 'docs' | 'settings';

export default function AdminDashboard() {
  const { user, loading: authLoading, resetPassword } = useAuth();
  const confirmFlow = useConfirmBooking();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const urlTab = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['overview', 'analytics', 'properties', 'reviews', 'users', 'bookings', 'destinations', 'content', 'ai', 'logs', 'docs', 'settings'];
  const initialTab = urlTab && validTabs.includes(urlTab) ? urlTab : 'overview';
  
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [settingsSubTab, setSettingsSubTab] = useState<'email' | 'whatsapp'>('whatsapp');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // Smoothly scroll active tab into view on mobile/tablet navigation
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeTab]);
  
  const [hotels, setHotels] = useState<Hotel[]>([]);
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [resetEmailTarget, setResetEmailTarget] = useState<string | null>(null);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [openHotelMenuId, setOpenHotelMenuId] = useState<string | null>(null);
  const [savingDestinations, setSavingDestinations] = useState(false);
  const [newDestination, setNewDestination] = useState('');
  const [quickResetEmail, setQuickResetEmail] = useState('');
  const [sendingQuickReset, setSendingQuickReset] = useState(false);
  const [showQuickResetModal, setShowQuickResetModal] = useState(false);
  
  const itemsPerPage = 10;

  const fetchData = async () => {
    try {
      const [hotelsSnapshot, usersSnapshot, bookingsSnapshot, settingsSnapshot] = await Promise.all([
        getDocs(collection(db, 'hotels')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'bookings')),
        getDoc(doc(db, 'system', 'settings'))
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
      if (!user || (!isAdmin(user) && !isMarketing(user))) {
        navigate('/');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, navigate]);

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

  const handleDeleteHotel = async (hotelId: string) => {
    const targetHotel = hotels.find(h => h.id === hotelId);

    // A listing with guests still due to arrive cannot be deleted: those
    // bookings would point at nothing. Cancel or move them first.
    const today = todayStr();
    const upcoming = bookings.filter(b =>
      b.hotelId === hotelId &&
      (b.status === 'confirmed' || b.status === 'pending') &&
      (b.checkOut ?? '') >= today
    );
    if (upcoming.length > 0) {
      toast.error(`This listing has ${upcoming.length} upcoming booking${upcoming.length === 1 ? '' : 's'}. Cancel or move them before deleting.`);
      return;
    }

    try {
      // Rooms go with the hotel so they do not linger as orphans in search.
      const roomSnap = await getDocs(query(collection(db, 'room_types'), where('hotelId', '==', hotelId)));
      const roomRefs = roomSnap.docs.map(d => d.ref);
      for (let i = 0; i < roomRefs.length; i += 450) {
        const batch = writeBatch(db);
        roomRefs.slice(i, i + 450).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'hotels', hotelId));
      try {
        await fetch(`/api/hotels/${hotelId}/archive-images`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to archive images:', err);
      }
      toast.success('Listing deleted');
      setHotels(hotels.filter(h => h.id !== hotelId));

      await logSystemEvent('action', `Admin deleted property listing: ${targetHotel?.name || hotelId}`, {
        hotelId,
        hotelName: targetHotel?.name,
        location: targetHotel?.location,
      }, user, 'property');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete listing');
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

  const handleDeleteBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this booking?')) return;
    const targetBooking = bookings.find(b => b.id === bookingId);
    try {
      await deleteBookingWithSlot(bookingId);
      cancelBookingReminders(bookingId);
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      toast.success('Booking deleted.');

      await logSystemEvent('action', `Admin permanently deleted booking: Ref ${targetBooking?.reference || bookingId}`, {
        bookingId,
        reference: targetBooking?.reference,
      }, user, 'booking');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete booking.');
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

  const handleUpdateStatus = async (hotelId: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (updatingId) return;
    setUpdatingId(hotelId);
    const targetHotel = hotels.find(h => h.id === hotelId);
    try {
      const hotelRef = doc(db, 'hotels', hotelId);
      await updateDoc(hotelRef, { status: newStatus });
      setHotels(hotels.map(h => h.id === hotelId ? { ...h, status: newStatus } : h));
      toast.success(`Hotel status updated to ${newStatus}`);

      await logSystemEvent('action', `Admin set property status: "${targetHotel?.name || hotelId}" -> ${newStatus.toUpperCase()}`, {
        hotelId,
        hotelName: targetHotel?.name,
        status: newStatus,
      }, user, 'property');
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error('Failed to update hotel status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleUserRole = async (targetUser: User, role: Role) => {
    if (targetUser.uid === user?.uid && role === 'admin') {
      toast.error('Cannot remove your own admin access here.');
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

  const handleToggleUserSuspension = async (targetUser: User) => {
    if (targetUser.uid === user?.uid) {
      toast.error('Cannot suspend your own account.');
      return;
    }
    const isSuspended = targetUser.status === 'suspended' || targetUser.accessRevoked;
    const nextStatus = isSuspended ? 'active' : 'suspended';
    
    if (!window.confirm(`Are you sure you want to ${isSuspended ? 'restore' : 'suspend'} access for ${targetUser.email}?`)) return;
    
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
    if (onlyBadPins) {
      filtered = filtered.filter(h => pinProblem(h.coordinates));
    }
    if (hotelSearch) {
      const q = hotelSearch.toLowerCase();
      filtered = filtered.filter(h => 
        h.name.toLowerCase().includes(q) || 
        (h.managerName && h.managerName.toLowerCase().includes(q)) ||
        (h.ownerName && h.ownerName.toLowerCase().includes(q)) ||
        (h.managerEmail && h.managerEmail.toLowerCase().includes(q)) ||
        (h.managerId && h.managerId.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [hotels, onlyBadPins, hotelSearch]);

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
    return {
      totalProperties: hotels.length,
      pendingProperties: hotels.filter(h => h.status === 'pending').length,
      totalUsers: users.length,
      totalBookings: bookings.length,
      managersCount: users.filter(u => isHotelManager(u)).length,
      totalRevenue: bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + (b.total || 0), 0)
    };
  }, [hotels, users, bookings]);

  const adminTabs = useMemo(() => {
    return [
      { id: 'overview' as Tab, label: 'Overview', icon: LayoutDashboard },
      { id: 'analytics' as Tab, label: 'Analytics', icon: TrendingUp },
      { id: 'properties' as Tab, label: 'Properties', icon: Building2 },
      { id: 'reviews' as Tab, label: 'Review Scraper', icon: Star },
      { id: 'users' as Tab, label: 'Users', icon: Users, visible: isGlobalAdmin(user) || isMarketing(user) },
      { id: 'bookings' as Tab, label: 'All Bookings', icon: CalendarRange },
      { id: 'destinations' as Tab, label: 'Destinations', icon: Navigation },
      { id: 'content' as Tab, label: 'Content & Legal', icon: FileText },
      { id: 'logs' as Tab, label: 'Audit & Telemetry Logs', icon: ShieldCheck, visible: isGlobalAdmin(user) },
      { id: 'ai' as Tab, label: 'Assistant & Provider Keys', icon: Cpu, visible: isGlobalAdmin(user) },
      { id: 'settings' as Tab, label: 'Channels & Settings', icon: Settings, visible: isGlobalAdmin(user) },
      { id: 'docs' as Tab, label: 'Executive Docs & Leaflets', icon: BookOpen },
    ].filter(t => t.visible !== false);
  }, [user]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-screen">
      
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
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Shield className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 leading-tight">Admin</h1>
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
              className="mt-2 p-2.5 bg-white rounded-2xl border border-stone-200 shadow-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Select Section</span>
                <span className="text-[11px] text-stone-400 font-medium">{adminTabs.length} sections</span>
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
                          ? 'bg-stone-900 text-white shadow-2xs'
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 block">Pre-Launch &amp; Team Resources</span>
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

        {/* Desktop Vertical Navigation with ONE single scrollbar */}
        <nav 
          className="hidden lg:flex lg:flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-slim pr-1.5 space-y-4 pt-1 w-full min-w-0 overscroll-contain"
          role="tablist"
          aria-label="Admin Sections"
        >
          {/* Navigation Tabs */}
          <div className="flex flex-col gap-1 w-full min-w-0">
            {adminTabs.map(tab => {
              const TabIcon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={`desk-tab-${tab.id}`}
                  ref={isSelected ? activeTabRef : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-[13px] font-medium transition cursor-pointer min-h-[38px] text-left min-w-0 ${
                    isSelected
                      ? 'bg-stone-900 text-white font-semibold shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <TabIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Pre-Launch & Team Resources integrated into SAME navbar */}
          <div className="pt-3 border-t border-stone-200/70 space-y-1 w-full min-w-0 pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-3 block">
              Pre-Launch &amp; Team Resources
            </span>
            <Link
              to="/concept-validation"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="truncate">Concept Survey (PDF)</span>
              </div>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
            <Link
              to="/stay-owner-leaflet"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="truncate">Stay Owner Leaflet</span>
              </div>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
            <Link
              to="/marketing"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <div className="flex items-center gap-2 truncate">
                <Target className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="truncate">Marketing Playbook</span>
              </div>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
            <Link
              to="/host-guide"
              target="_blank"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition min-w-0"
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="truncate">Host Starter Pack</span>
              </div>
              <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
            </Link>
            <button
              type="button"
              onClick={() => setActiveTab('docs')}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 transition cursor-pointer text-left min-w-0"
              title="Read or download executive docs in HTML, plain text, or markdown"
            >
              <div className="flex items-center gap-2 truncate">
                <BookOpen className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="truncate">Executive Docs &amp; Leaflets</span>
              </div>
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full">
        
        {/* ===================== OVERVIEW TAB ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="pb-2 border-b border-stone-200">
              <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Platform Overview</h2>
              <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Key operational metrics and quick links to partner outreach materials.</p>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <button
                onClick={() => setActiveTab('properties')}
                className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Total Properties</span>
                  <Building2 className="w-4 h-4 text-stone-400" />
                </div>
                <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">{stats.totalProperties}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Across Malawi</p>
              </button>
              
              <button
                onClick={() => setActiveTab('users')}
                className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Total Users</span>
                  <Users className="w-4 h-4 text-stone-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">{stats.totalUsers}</p>
                  <span className="text-xs text-stone-400 font-normal">· {stats.managersCount} mgrs</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Guests &amp; managers</p>
              </button>
              
              <button
                onClick={() => setActiveTab('bookings')}
                className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Total Bookings</span>
                  <CalendarRange className="w-4 h-4 text-stone-400" />
                </div>
                <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">{stats.totalBookings}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Itineraries recorded</p>
              </button>
              
              <button
                onClick={() => setActiveTab('properties')}
                className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-500 text-xs font-medium">Pending Review</span>
                  <Activity className={`w-4 h-4 ${stats.pendingProperties > 0 ? 'text-amber-600' : 'text-stone-400'}`} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className={`text-2xl font-serif font-bold tabular-nums ${stats.pendingProperties > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
                    {stats.pendingProperties}
                  </p>
                  {stats.pendingProperties > 0 && (
                    <span className="text-xs text-amber-700 font-medium">awaiting</span>
                  )}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Listing applications</p>
              </button>
            </div>

            {/* Partner Outreach & Guides */}
            <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-900">
                    Partner Materials &amp; Guides
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Printable resources for partner onboarding and feedback collection
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className="text-xs text-stone-600 hover:text-stone-900 font-medium inline-flex items-center gap-1 cursor-pointer transition hover:underline"
                >
                  <span>All Documents (6)</span>
                  <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Concept Survey Card */}
                <div className="border border-stone-200 bg-stone-50/50 rounded-lg p-4 flex flex-col justify-between gap-3 hover:border-stone-300 transition">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-stone-900">
                        Concept Validation Survey
                      </h4>
                      <span className="text-[11px] text-stone-400">PDF · Web</span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Partner feedback questionnaire with preview dashboard visuals.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stone-200/70 flex-wrap">
                    <Link
                      to="/concept-validation"
                      target="_blank"
                      className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 font-medium text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                      <span>View &amp; Print</span>
                    </Link>
                    <a
                      href="/api/admin/docs/concept-validation-survey?format=html&download=1"
                      className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 font-medium text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-400" />
                      <span>Download HTML</span>
                    </a>
                  </div>
                </div>

                {/* Stay Owner Leaflet Card */}
                <div className="border border-stone-200 bg-stone-50/50 rounded-lg p-4 flex flex-col justify-between gap-3 hover:border-stone-300 transition">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-stone-900">
                        Stay Owner Acquisition Leaflet
                      </h4>
                      <span className="text-[11px] text-stone-400">Flyer · Brochure</span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      One-page host flyer covering 0% launch commission and direct payouts.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stone-200/70 flex-wrap">
                    <Link
                      to="/stay-owner-leaflet"
                      target="_blank"
                      className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 font-medium text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                      <span>View &amp; Print</span>
                    </Link>
                    <a
                      href="/api/admin/docs/stay-owner-leaflet?format=html&download=1"
                      className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 font-medium text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-400" />
                      <span>Download HTML</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {isGlobalAdmin(user) && (
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-stone-900 text-sm">Premium Listing Plans</h4>
                  <p className="text-stone-500 text-xs mt-0.5">Enable or disable premium plan selection during host onboarding.</p>
                </div>
                <button
                  onClick={handleTogglePremium}
                  disabled={togglingPremium}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${premiumEnabled ? 'bg-emerald-600' : 'bg-stone-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${premiumEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* ===================== ANALYTICS TAB ===================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="pb-2 border-b border-stone-200">
              <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Analytics &amp; Performance</h2>
              <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Platform growth velocity, monthly reservation metrics, and featured property management.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Bookings Trend Chart */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs flex flex-col h-full">
                <h3 className="font-serif font-bold text-stone-900 text-base mb-0.5">Booking Volume</h3>
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
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs flex flex-col h-full">
                <h3 className="font-serif font-bold text-stone-900 text-base mb-0.5">User Sign-Ups</h3>
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
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs flex flex-col h-full">
                <h3 className="font-serif font-bold text-stone-900 text-base mb-0.5">Property Listings</h3>
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
            <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-lg">Manage Featured Stays</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Controls "The ones guests go back to" shown on the explore page.
                  </p>
                </div>
                <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 shrink-0 text-xs">
                  <button
                    onClick={() => saveFeaturedMode('auto')}
                    disabled={savingFeaturedMode}
                    className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer ${featuredMode === 'auto' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    Auto-Fill
                  </button>
                  <button
                    onClick={() => saveFeaturedMode('manual')}
                    disabled={savingFeaturedMode}
                    className={`px-3 py-1.5 font-medium rounded-md transition cursor-pointer ${featuredMode === 'manual' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    Strict Manual
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

              {featuredMode === 'disabled' && (
                <div className="p-3 bg-stone-50 border border-stone-200 text-stone-600 text-xs rounded-lg">
                  <strong>Section Disabled:</strong> The featured stays carousel is currently hidden from the home page.
                </div>
              )}
              {featuredMode === 'manual' && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg">
                  <strong>Strict Manual Mode:</strong> Displays only properties explicitly marked as Featured below (up to 3).
                </div>
              )}
              {featuredMode === 'auto' && (
                <div className="p-3 bg-stone-50 border border-stone-200 text-stone-700 text-xs rounded-lg">
                  <strong>Auto-Fill Active:</strong> Featured properties are shown first, remaining slots auto-filled with highest-rated stays.
                </div>
              )}

              <div className="overflow-x-auto border border-stone-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] font-semibold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-4">Property</th>
                      <th className="py-2.5 px-4">Location</th>
                      <th className="py-2.5 px-4">Bookings</th>
                      <th className="py-2.5 px-4 text-right">Featured Status</th>
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
                            <span className="font-semibold text-stone-900">{hotel.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-stone-500">
                          {hotel.location}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-stone-800">
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
              
              <div className="px-4 py-3 border-t border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 rounded-b-lg">
                <div>
                  Showing <span className="font-semibold text-stone-900 font-mono">{featuredCandidateStats.length === 0 ? 0 : (currentFeaturedPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 font-mono">{Math.min(currentFeaturedPage * itemsPerPage, featuredCandidateStats.length)}</span> of <span className="font-semibold text-stone-900 font-mono">{featuredCandidateStats.length}</span> properties
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
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
              <div>
                <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Properties</h2>
                <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Review, approve, and verify partner listings across Malawi.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search properties..."
                    value={hotelSearch}
                    onChange={e => { setHotelSearch(e.target.value); setCurrentHotelPage(1); }}
                    className="pl-8 pr-3 py-1.5 border border-stone-200 bg-white rounded-lg text-xs focus:outline-none focus:border-stone-900 w-full sm:w-56"
                  />
                </div>
                {badPinCount > 0 && (
                  <button
                    onClick={() => { setOnlyBadPins(v => !v); setCurrentHotelPage(1); }}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      onlyBadPins ? 'bg-amber-800 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
                    }`}
                  >
                    <MapPinOff className="h-3.5 w-3.5" />
                    <span>{badPinCount} broken pins</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {visibleHotels.slice((currentHotelPage - 1) * itemsPerPage, currentHotelPage * itemsPerPage).map((hotel, index) => (
                <div key={`admin-hotel-${hotel.id || index}-${index}`} className="bg-white rounded-xl p-4 shadow-2xs border border-stone-200 flex flex-col sm:flex-row gap-4 hover:border-stone-300 transition">
                  <div className="w-full aspect-[16/10] sm:aspect-auto sm:h-32 sm:w-44 bg-stone-100 rounded-lg overflow-hidden shrink-0">
                    <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                        <h3 className="text-base font-bold text-stone-900 truncate">{hotel.name}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {hotel.featured && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured
                            </span>
                          )}
                          
                          {(!hotel.status || hotel.status === 'approved') && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Approved
                            </span>
                          )}
                          {hotel.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending Review
                            </span>
                          )}
                          {hotel.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" /> Rejected
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs text-stone-500">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-stone-400 shrink-0" /> <span className="truncate">{hotel.location}</span>
                        </p>
                        {(() => {
                          const problem = pinProblem(hotel.coordinates);
                          return problem ? (
                            <p className="text-amber-800 flex items-center gap-1.5 font-medium">
                              <MapPinOff className="h-3.5 w-3.5 shrink-0" /> {PIN_PROBLEM_LABELS[problem]}
                            </p>
                          ) : (
                            <a
                              href={mapLinkUrl(hotel)}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-stone-500 flex items-center gap-1.5 hover:text-stone-900 transition w-fit font-mono"
                            >
                              <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="tabular-nums">{hotel.coordinates!.lat.toFixed(4)}, {hotel.coordinates!.lng.toFixed(4)}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          );
                        })()}
                        <p className="flex items-center gap-1.5 truncate">
                          <Users className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">
                            <strong className="text-stone-700 font-medium">Manager:</strong>{' '}
                            {hotel.managerName ? (
                              <span>{hotel.managerName}</span>
                            ) : (
                              (hotel.managerId && users.find(u => u.uid === hotel.managerId)?.email) ||
                              hotel.managerEmail ||
                              <span className="text-stone-400 italic">Self-managed</span>
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-100">
                      <div className="flex items-center gap-2">
                        {hotel.status === 'pending' && (
                          <div className="flex items-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                              className="bg-stone-900 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-stone-800 transition flex items-center justify-center cursor-pointer shadow-2xs"
                            >
                              Approve
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleUpdateStatus(hotel.id!, 'rejected')}
                              className="bg-stone-100 text-stone-700 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        <Link 
                          to={`/admin/hotel/${hotel.id}`}
                          className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Manage</span>
                        </Link>
                      </div>

                      {/* Property Actions Dropdown */}
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => setOpenHotelMenuId(openHotelMenuId === hotel.id ? null : hotel.id!)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium shadow-2xs transition cursor-pointer"
                          aria-label="Property actions"
                        >
                          <span>Actions</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${openHotelMenuId === hotel.id ? 'rotate-180' : ''}`} />
                        </button>

                        {openHotelMenuId === hotel.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-30" 
                              onClick={() => setOpenHotelMenuId(null)} 
                            />
                            <div className="absolute right-0 bottom-full mb-1.5 sm:bottom-auto sm:top-full sm:mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-150">
                              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                                Listing Visibility
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleFeatured(hotel);
                                  setOpenHotelMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <Star className={`w-3.5 h-3.5 ${hotel.featured ? 'fill-amber-500 text-amber-500' : 'text-stone-400'}`} />
                                  <span>{hotel.featured ? 'Remove from Featured' : 'Feature on Home'}</span>
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
                                  <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                                  <span>{hotel.adminChatEnabled === false ? 'Enable Guest Chat' : 'Disable Guest Chat'}</span>
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
                                  <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                                  <span>View Live Listing</span>
                                </span>
                              </a>

                              <div className="my-1 border-t border-stone-100" />
                              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                                Moderation
                              </div>

                              {(!hotel.status || hotel.status === 'approved') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateStatus(hotel.id!, 'pending');
                                    setOpenHotelMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Suspend Listing</span>
                                </button>
                              )}

                              {hotel.status === 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateStatus(hotel.id!, 'approved');
                                    setOpenHotelMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Approve Listing</span>
                                </button>
                              )}

                              {!isMarketing(user) && (
                                <>
                                  <div className="my-1 border-t border-stone-100" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmDeleteId(hotel.id!);
                                      setOpenHotelMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Delete Listing</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {visibleHotels.length === 0 && (
                <div className="bg-stone-50 rounded-xl p-8 text-center text-stone-500 border border-stone-200 text-xs">
                  No hotel listings found matching criteria.
                </div>
              )}
              <div className="bg-white rounded-xl border border-stone-200 p-3 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 shadow-2xs">
                <div>
                  Showing <span className="font-semibold text-stone-900 font-mono">{visibleHotels.length === 0 ? 0 : (currentHotelPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 font-mono">{Math.min(currentHotelPage * itemsPerPage, visibleHotels.length)}</span> of <span className="font-semibold text-stone-900 font-mono">{visibleHotels.length}</span> properties
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
          </div>
        )}
        {/* ===================== USERS TAB ===================== */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">User Accounts &amp; Roles</h2>
                <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Manage platform accounts, administrative permissions, and password recovery.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setCurrentUserPage(1); }}
                    className="pl-8 pr-3 py-1.5 border border-stone-200 bg-white rounded-lg text-xs focus:outline-none focus:border-stone-900 w-full sm:w-56"
                  />
                </div>

                {isGlobalAdmin(user) && (
                  <button
                    type="button"
                    onClick={() => setShowQuickResetModal(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800 transition shrink-0 shadow-2xs cursor-pointer"
                  >
                    <Key className="h-3.5 w-3.5" />
                    <span>Reset Password</span>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="overflow-x-auto min-h-[340px]">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">User</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Joined</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Roles</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider text-right bg-stone-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {visibleUsers.slice((currentUserPage - 1) * itemsPerPage, currentUserPage * itemsPerPage).map((u, index) => {
                      const rolesList = userRoles(u);
                      const userMenuKey = u.uid || `user-${index}`;
                      return (
                        <tr key={`admin-user-${u.uid || index}-${index}`} className={`hover:bg-stone-50/70 transition ${u.status === 'suspended' || u.accessRevoked ? 'opacity-50 grayscale' : ''}`}>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-stone-900 flex items-center gap-2 text-xs sm:text-sm">
                              {u.displayName || 'No Name'}
                              {(u.status === 'suspended' || u.accessRevoked) && (
                                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                  Suspended
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-stone-500">{u.email}</p>
                            <p className="text-[11px] text-stone-400 mt-0.5 font-mono">{u.uid}</p>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-stone-600">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {rolesList.includes('global_admin') && (
                                <span className="bg-stone-900 text-white px-2 py-0.5 rounded text-[11px] font-medium tracking-wide">
                                  Global Admin
                                </span>
                              )}
                              {rolesList.includes('admin') && !rolesList.includes('global_admin') && (
                                <span className="bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded text-[11px] font-medium">
                                  Admin
                                </span>
                              )}
                              {rolesList.includes('marketing') && (
                                <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[11px] font-medium">
                                  Marketing
                                </span>
                              )}
                              {rolesList.includes('hotel_manager') && (
                                <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[11px] font-medium">
                                  Manager
                                </span>
                              )}
                              {rolesList.includes('traveller') && !rolesList.includes('hotel_manager') && !rolesList.includes('admin') && !rolesList.includes('global_admin') && !rolesList.includes('marketing') && (
                                <span className="text-xs text-stone-400">
                                  Traveller
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={() => setOpenUserMenuId(openUserMenuId === userMenuKey ? null : userMenuKey)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium shadow-2xs transition cursor-pointer"
                                aria-label="User actions"
                              >
                                <span>Actions</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${openUserMenuId === userMenuKey ? 'rotate-180' : ''}`} />
                              </button>

                              {openUserMenuId === userMenuKey && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-30" 
                                    onClick={() => setOpenUserMenuId(null)} 
                                  />
                                  <div className={`absolute right-0 w-52 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-150 ${
                                    index >= Math.max(0, Math.min(visibleUsers.length, itemsPerPage) - 2) && Math.min(visibleUsers.length, itemsPerPage) > 2
                                      ? 'bottom-full mb-1.5'
                                      : 'top-full mt-1.5'
                                  }`}>
                                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                                      Toggle Role
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleToggleUserRole(u, 'hotel_manager');
                                        setOpenUserMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between transition cursor-pointer"
                                    >
                                      <span>Hotel Manager</span>
                                      {rolesList.includes('hotel_manager') && (
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

                                    <div className="my-1 border-t border-stone-100" />
                                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                                      Account
                                    </div>

                                    {u.email && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setResetEmailTarget(u.email!);
                                          setOpenUserMenuId(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition cursor-pointer"
                                      >
                                        <Key className="w-3.5 h-3.5 text-stone-400" />
                                        <span>Reset Password</span>
                                      </button>
                                    )}

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
                                      <Shield className="w-3.5 h-3.5 text-stone-400" />
                                      <span>{(u.status === 'suspended' || u.accessRevoked) ? 'Restore Access' : 'Revoke Access'}</span>
                                    </button>

                                    <div className="my-1 border-t border-stone-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteUser(u);
                                        setOpenUserMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Delete Profile</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
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
              
              <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 shrink-0">
                <div>
                  Showing <span className="font-semibold text-stone-900 font-mono">{visibleUsers.length === 0 ? 0 : (currentUserPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 font-mono">{Math.min(currentUserPage * itemsPerPage, visibleUsers.length)}</span> of <span className="font-semibold text-stone-900 font-mono">{visibleUsers.length}</span> users
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
                title="Send Password Reset"
                description="Send a secure password recovery email to any registered user or manager."
                footer={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowQuickResetModal(false); setQuickResetEmail(''); }}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="admin-quick-reset-form"
                      disabled={sendingQuickReset || !quickResetEmail.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 disabled:opacity-50 transition shadow-sm"
                    >
                      {sendingQuickReset ? 'Sending…' : 'Send Link'}
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
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">Platform Bookings</h2>
              <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Live traveller reservations, check-in dates, and itinerary statuses.</p>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Ref</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Property</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Guest</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Dates</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Amount</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider bg-stone-50">Status</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider text-right bg-stone-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {bookings.slice((currentBookingPage - 1) * itemsPerPage, currentBookingPage * itemsPerPage).map((b, index) => {
                      const hotelName = hotels.find(h => h.id === b.hotelId)?.name || 'Unknown Property';
                      return (
                        <tr key={`admin-booking-${b.id || index}-${index}`} className="hover:bg-stone-50/70 transition">
                          <td className="px-5 py-3.5 text-xs font-mono text-stone-500">{b.reference || 'N/A'}</td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-stone-900">{hotelName}</td>
                          <td className="px-5 py-3.5 text-xs text-stone-700">
                            {b.guestName}
                            <br/>
                            <span className="text-[11px] text-stone-400">{b.guestEmail || 'No Email'}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-stone-600 whitespace-nowrap">
                            {b.checkIn} <br/>to {b.checkOut}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-medium text-stone-400">
                            ***
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize border ${
                              b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70' :
                              b.status === 'rejected' ? 'bg-rose-50 text-rose-800 border-rose-200/70' :
                              b.status === 'cancelled' ? 'bg-stone-100 text-stone-700 border-stone-200' :
                              'bg-amber-50 text-amber-800 border-amber-200/70'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end">
                              <select
                                value={b.status}
                                onChange={(e) => handleUpdateBookingStatus(b.id!, e.target.value as any)}
                                className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-medium rounded-lg focus:outline-none focus:border-stone-900 block py-1.5 px-2.5 shadow-2xs transition cursor-pointer max-w-[125px]"
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                          No bookings recorded on the platform.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 shrink-0">
                <div>
                  Showing <span className="font-semibold text-stone-900 font-mono">{bookings.length === 0 ? 0 : (currentBookingPage - 1) * itemsPerPage + 1}</span>–<span className="font-semibold text-stone-900 font-mono">{Math.min(currentBookingPage * itemsPerPage, bookings.length)}</span> of <span className="font-semibold text-stone-900 font-mono">{bookings.length}</span> bookings
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-stone-200">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">Popular Destinations</h2>
                <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Manage curated destinations displayed on the explore portal and home page.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 bg-white px-3.5 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-700">Manual Override</span>
                  <button
                    onClick={() => setManualDestinationsEnabled(!manualDestinationsEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${manualDestinationsEnabled ? 'bg-emerald-600' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${manualDestinationsEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
                <button
                  onClick={saveDestinations}
                  disabled={savingDestinations}
                  className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50 shadow-2xs cursor-pointer"
                >
                  {savingDestinations ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {!manualDestinationsEnabled && (
              <div className="bg-stone-50 border border-stone-200 text-stone-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                <span className="font-semibold text-stone-900">Dynamic Mode:</span>
                <span>Home page surfaces popular destinations dynamically calculated from active listings and bookings.</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Custom Destinations Manager */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-2xs flex flex-col h-full">
                <h3 className="font-bold text-stone-900 text-lg mb-2">Active Popular List</h3>
                <p className="text-sm text-stone-500 mb-6">
                  These destinations will be shown exactly as listed when Manual Mode is enabled.
                </p>

                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={newDestination}
                    onChange={e => setNewDestination(e.target.value)}
                    placeholder="E.g. Cape Maclear"
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-900"
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
                    className="bg-stone-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-stone-800 transition"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  {customDestinations.map((dest, i) => (
                    <div key={`custom-dest-${dest}-${i}`} className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 group">
                      <span className="font-bold text-stone-900">{i + 1}. {dest}</span>
                      <button
                        onClick={() => setCustomDestinations(customDestinations.filter(d => d !== dest))}
                        className="text-stone-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {customDestinations.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-stone-200 rounded-2xl p-6 text-center text-stone-500">
                      List is empty.<br/>Add destinations above.
                    </div>
                  )}
                </div>
              </div>

              {/* Data-driven Recommendations */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-2xs flex flex-col h-full max-h-[600px]">
                <h3 className="font-bold text-stone-900 text-lg mb-2">Performance Data</h3>
                <p className="text-sm text-stone-500 mb-6">
                  Calculated from live platform data (Bookings carry more weight). Click to add to your custom list.
                </p>
                
                <div className="overflow-y-auto pr-2 space-y-2 flex-1 scrollbar-slim">
                  {destinationStats.map((stat, sIdx) => (
                    <div key={`dest-stat-${stat.location}-${sIdx}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 border border-transparent hover:border-stone-100 transition">
                      <div>
                        <p className="font-bold text-stone-900">{stat.location}</p>
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
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {customDestinations.includes(stat.location) ? 'Added' : 'Add'}
                      </button>
                    </div>
                  ))}
                  {destinationStats.length === 0 && (
                    <p className="text-stone-500 text-center py-6">No destination data yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CONTENT TAB ===================== */}
        {activeTab === 'content' && (
          <div className="space-y-6 animate-in fade-in duration-200 pb-20">
            <div className="pb-2 border-b border-stone-200">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">Content &amp; Legal</h2>
              <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Global platform domain, footer contact signatures, social links, and legal policies.</p>
            </div>
            
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-5 sm:p-6 md:p-8 space-y-8">
              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-4 border-b border-stone-100 pb-2">Global Domain Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Platform Domain</label>
                    <input
                      type="url"
                      value={contentSettings.platformDomain || ''}
                      onChange={e => setContentSettings({...contentSettings, platformDomain: e.target.value})}
                      placeholder="https://travel-malawi-10840607522.us-west1.run.app"
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                    <p className="text-xs text-stone-400 mt-1">This domain updates dynamically across all system documents, emails, and scripts.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-4 border-b border-stone-100 pb-2">Global Signature (Website Footer)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Contact Email</label>
                    <input
                      type="email"
                      value={contentSettings.contactEmail || ''}
                      onChange={e => setContentSettings({...contentSettings, contactEmail: e.target.value})}
                      placeholder="bookings@travelmalawi.com"
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                    <p className="text-xs text-stone-400 mt-1">Leave blank to hide from footer.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Contact Phone</label>
                    <input
                      type="text"
                      value={contentSettings.contactPhone || ''}
                      onChange={e => setContentSettings({...contentSettings, contactPhone: e.target.value})}
                      placeholder="+265 99 123 4567"
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                    <p className="text-xs text-stone-400 mt-1">Leave blank to hide from footer.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-4 border-b border-stone-100 pb-2">Social Media Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Facebook URL</label>
                    <input
                      type="url"
                      value={contentSettings.socialFacebook || ''}
                      onChange={e => setContentSettings({...contentSettings, socialFacebook: e.target.value})}
                      placeholder="https://facebook.com/..."
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Instagram URL</label>
                    <input
                      type="url"
                      value={contentSettings.socialInstagram || ''}
                      onChange={e => setContentSettings({...contentSettings, socialInstagram: e.target.value})}
                      placeholder="https://instagram.com/..."
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Twitter/X URL</label>
                    <input
                      type="url"
                      value={contentSettings.socialTwitter || ''}
                      onChange={e => setContentSettings({...contentSettings, socialTwitter: e.target.value})}
                      placeholder="https://twitter.com/..."
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-4 border-b border-stone-100 pb-2">Legal Documents</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Privacy Policy</label>
                    <textarea
                      value={contentSettings.privacyPolicy || ''}
                      onChange={e => setContentSettings({...contentSettings, privacyPolicy: e.target.value})}
                      rows={6}
                      placeholder="Markdown supported (**bold**, 1. list, ## Heading). Leave blank to use default..."
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Terms of Service</label>
                    <textarea
                      value={contentSettings.termsOfService || ''}
                      onChange={e => setContentSettings({...contentSettings, termsOfService: e.target.value})}
                      rows={6}
                      placeholder="Markdown supported (**bold**, 1. list, ## Heading). Leave blank to use default..."
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Refund Policy</label>
                    <textarea
                      value={contentSettings.refundPolicy || ''}
                      onChange={e => setContentSettings({...contentSettings, refundPolicy: e.target.value})}
                      rows={6}
                      placeholder="Markdown supported (**bold**, 1. list, ## Heading). Leave blank to use default..."
                      className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveContent}
                  disabled={savingContent}
                  className="bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50 shadow-2xs cursor-pointer"
                >
                  {savingContent ? 'Saving...' : 'Save Content'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== AI CONFIGURATION TAB ===================== */}
        {activeTab === 'ai' && (
          <AdminAISettings />
        )}

        {/* ===================== SYSTEM LOGS TAB ===================== */}
        {activeTab === 'logs' && (
          <AdminLogs />
        )}

        {/* ===================== EXECUTIVE DOCS TAB ===================== */}
        {activeTab === 'docs' && (
          <AdminDocsHub />
        )}

        {/* ===================== SETTINGS & CHANNELS CONFIGURATION TAB ===================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl w-fit flex-wrap">
              <button
                type="button"
                onClick={() => setSettingsSubTab('whatsapp')}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                  settingsSubTab === 'whatsapp'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp Messaging
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('email')}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                  settingsSubTab === 'email'
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email &amp; SMTP
              </button>
            </div>

            {settingsSubTab === 'whatsapp' ? <AdminWhatsAppSettings /> : <AdminEmailSettings />}
          </div>
        )}

        {/* ===================== REVIEW SCRAPER TAB ===================== */}
        {activeTab === 'reviews' && (
          <AdminReviewScraper 
            hotels={hotels} 
            onHotelUpdated={(updatedHotel) => setHotels(hotels.map(h => h.id === updatedHotel.id ? updatedHotel : h))} 
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
          isOpen={!!userToDelete}
          title="Delete User Profile"
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
          title="Reset Password"
          message={`Send a password reset email to ${resetEmailTarget}?`}
          confirmText="Send Reset Link"
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

      </div>
    </div>
  );
}

