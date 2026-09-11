import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, User, Booking, Role } from '../types';
import { SystemSettings } from '../hooks/useSystemSettings';
import { 
  Shield, Building2, CheckCircle, CheckCircle2, XCircle, Clock, MapPin, 
  MapPinOff, Users, Edit2, Edit3, Key, Trash2, Star, ExternalLink, 
  MessageSquare, MessageSquareOff, LayoutDashboard, CalendarRange, FileText, 
  Search, Activity, Cpu, Target, Download, ChevronDown
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import { PIN_PROBLEM_LABELS, mapLinkUrl, pinProblem } from '../lib/geo';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import AdminAISettings from '../components/AdminAISettings';
import AdminDocsHub from '../components/AdminDocsHub';
import AdminEmailSettings from '../components/AdminEmailSettings';
import AdminWhatsAppSettings from '../components/AdminWhatsAppSettings';
import { getHotelImage } from '../lib/images';
import { isAdmin, isGlobalAdmin, isMarketing, isHotelManager, userRoles, toRoleFields } from '../lib/roles';
import { formatMoney } from '../lib/booking';
import { Navigation, TrendingUp, BookOpen, Mail, Settings } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import PriceDisplay from '../components/PriceDisplay';

type Tab = 'overview' | 'analytics' | 'properties' | 'users' | 'bookings' | 'destinations' | 'content' | 'ai' | 'docs' | 'settings';

export default function AdminDashboard() {
  const { user, loading: authLoading, resetPassword } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<Tab>('overview');
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
    try {
      await deleteDoc(doc(db, 'hotels', hotelId));
      try {
        await fetch(`/api/hotels/${hotelId}/archive-images`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to archive images:', err);
      }
      toast.success('Listing deleted');
      setHotels(hotels.filter(h => h.id !== hotelId));
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete listing');
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status: newStatus });
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus as any } : b));
      toast.success(`Booking status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update booking status.');
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this booking?')) return;
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      setBookings(bookings.filter(b => b.id !== bookingId));
      toast.success('Booking deleted.');
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
    } catch (error) {
      console.error('Error updating featured flag:', error);
      toast.error('Could not change the featured status.');
    }
  };

  const handleUpdateStatus = async (hotelId: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (updatingId) return;
    setUpdatingId(hotelId);
    try {
      const hotelRef = doc(db, 'hotels', hotelId);
      await updateDoc(hotelRef, { status: newStatus });
      setHotels(hotels.map(h => h.id === hotelId ? { ...h, status: newStatus } : h));
      toast.success(`Hotel status updated to ${newStatus}`);
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

  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.uid === user?.uid) {
      toast.error('Cannot delete your own account.');
      return;
    }
    
    if (!window.confirm(`WARNING: This will delete the profile document for ${targetUser.email} from the database. They will lose all data associated with this profile. Are you absolutely sure?`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', targetUser.uid));
      setUsers(users.filter(u => u.uid !== targetUser.uid));
      toast.success(`User profile deleted successfully.`);
      
      // Notify via server API
      if (targetUser.email) {
        fetch('/api/admin/notify-account-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: targetUser.email, 
            status: 'revoked', // treat deletion as revocation for the email message
            name: targetUser.displayName
          })
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user profile.');
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
      { id: 'properties' as Tab, label: 'Properties', icon: Building2, badge: stats.pendingProperties > 0 ? stats.pendingProperties : null },
      { id: 'users' as Tab, label: 'Users', icon: Users, visible: isGlobalAdmin(user) || isMarketing(user) },
      { id: 'bookings' as Tab, label: 'All Bookings', icon: CalendarRange },
      { id: 'destinations' as Tab, label: 'Destinations', icon: Navigation },
      { id: 'content' as Tab, label: 'Content & Legal', icon: FileText },
      { id: 'ai' as Tab, label: 'Assistant & Provider Keys', icon: Cpu, visible: isGlobalAdmin(user) },
      { id: 'settings' as Tab, label: 'Channels & Settings', icon: Settings, visible: isGlobalAdmin(user), badge: 'Super Admin' },
      { id: 'docs' as Tab, label: 'Executive Docs (.txt)', icon: BookOpen, badge: 'Admin' },
    ].filter(t => t.visible !== false);
  }, [stats.pendingProperties, user]);

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
      
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 shrink-0 space-y-3 lg:space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center justify-between px-1 lg:px-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 leading-tight">Admin</h1>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isGlobalAdmin(user) 
                    ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                    : isMarketing(user)
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}>
                  {isGlobalAdmin(user) ? 'Global Admin' : isMarketing(user) ? 'Marketing' : 'Admin'}
                </span>
              </div>
              <p className="text-stone-500 text-xs sm:text-sm">Platform Management</p>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs Bar */}
        <div className="relative">
          <nav 
            className="flex flex-col gap-2"
            role="tablist"
            aria-label="Admin Sections"
          >
            {/* Mobile & Tablet Collapsible Menu Trigger */}
            <div className="lg:hidden space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                    <CurrentTabIcon className="w-4 h-4" />
                  </div>
                  <select
                    id="admin-dashboard-section-dropdown"
                    value={activeTab}
                    onChange={(e) => {
                      setActiveTab(e.target.value as Tab);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-white border border-stone-200 rounded-xl pl-8.5 pr-8 py-2 text-xs sm:text-sm font-semibold text-stone-900 appearance-none shadow-2xs focus:ring-2 focus:ring-stone-900 focus:outline-none cursor-pointer"
                  >
                    {adminTabs.map((tab) => {
                      let badge = '';
                      if (tab.badge) badge = ` · (${tab.badge})`;
                      return (
                        <option key={`admin-opt-${tab.id}`} value={tab.id}>
                          {tab.label}{badge}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {currentTabItem.badge && (
                  <span className={`text-[10px] px-2 py-1 rounded-lg font-bold shrink-0 ${typeof currentTabItem.badge === 'number' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700'}`}>
                    {currentTabItem.badge}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(prev => !prev)}
                  className="shrink-0 px-2.5 sm:px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs flex items-center gap-1 transition cursor-pointer"
                  title="Browse all admin sections"
                >
                  <span>{isMobileMenuOpen ? 'Close' : 'Grid'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

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
                          className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left min-h-[44px] ${
                            isSelected
                              ? 'bg-stone-900 text-white shadow-2xs'
                              : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <TabIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-stone-500'}`} />
                            <span className="truncate">{tab.label}</span>
                          </div>
                          {tab.badge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                              isSelected 
                                ? 'bg-white/20 text-white' 
                                : typeof tab.badge === 'number' 
                                  ? 'bg-amber-500 text-white' 
                                  : 'bg-stone-100 text-stone-600'
                            }`}>
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Team Resources inside mobile drawer */}
                  <div className="pt-2 border-t border-stone-100 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 block">Team Resources</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <Link
                        to="/marketing"
                        target="_blank"
                        className="inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium border border-stone-200/60"
                      >
                        <div className="flex items-center gap-2">
                          <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
            <div className="hidden lg:flex lg:flex-col gap-1.5">
              {adminTabs.map(tab => {
                const TabIcon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={`desk-tab-${tab.id}`}
                    ref={isSelected ? activeTabRef : undefined}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap shrink-0 w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold min-h-[44px] transition ${
                      isSelected
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <TabIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : typeof tab.badge === 'number'
                            ? 'bg-amber-500 text-white'
                            : 'bg-stone-200 text-stone-700'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Team Resources in Sidebar on Desktop */}
        <div className="hidden lg:block pt-4 border-t border-stone-200/80 mt-2 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-3 block">Team Resources</span>
          <Link
            to="/marketing"
            target="_blank"
            className="whitespace-nowrap shrink-0 w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Marketing Playbook</span>
            </div>
            <ExternalLink className="w-3 h-3 text-stone-400" />
          </Link>
          <Link
            to="/host-guide"
            target="_blank"
            className="whitespace-nowrap shrink-0 w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Host Starter Pack</span>
            </div>
            <ExternalLink className="w-3 h-3 text-stone-400" />
          </Link>
          <button
            onClick={() => setActiveTab('docs')}
            className="whitespace-nowrap shrink-0 w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer text-left"
            title="Read or download executive docs in plain text or markdown"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Strategy Docs (.txt)</span>
            </div>
            <span className="text-[10px] bg-stone-200 text-stone-700 font-bold px-1.5 py-0.5 rounded">4 Docs</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full">
        
        {/* ===================== OVERVIEW TAB ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <h2 className="text-3xl font-serif font-bold text-stone-900">Platform Overview</h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
              <button
                onClick={() => setActiveTab('properties')}
                className="bg-white p-3.5 sm:p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-stone-900"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-blue-50 text-blue-600 rounded-xl lg:rounded-2xl flex items-center justify-center mb-2.5 sm:mb-3 lg:mb-4">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                </div>
                <p className="text-stone-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 truncate">Total Properties</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-stone-900">{stats.totalProperties}</p>
              </button>
              
              <button
                onClick={() => setActiveTab('users')}
                className="bg-white p-3.5 sm:p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-stone-900"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-emerald-50 text-emerald-600 rounded-xl lg:rounded-2xl flex items-center justify-center mb-2.5 sm:mb-3 lg:mb-4">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                </div>
                <p className="text-stone-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 truncate">Total Users</p>
                <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-stone-900">{stats.totalUsers}</p>
                  <span className="text-[10px] sm:text-xs text-stone-400 font-medium">{stats.managersCount} mgrs</span>
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('bookings')}
                className="bg-white p-3.5 sm:p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-stone-900"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-purple-50 text-purple-600 rounded-xl lg:rounded-2xl flex items-center justify-center mb-2.5 sm:mb-3 lg:mb-4">
                  <CalendarRange className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                </div>
                <p className="text-stone-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 truncate">Total Bookings</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-stone-900">{stats.totalBookings}</p>
              </button>
              
              <button
                onClick={() => setActiveTab('properties')}
                className="bg-white p-3.5 sm:p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-stone-200 shadow-2xs text-left hover:border-stone-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-stone-900"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-amber-50 text-amber-600 rounded-xl lg:rounded-2xl flex items-center justify-center mb-2.5 sm:mb-3 lg:mb-4">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                </div>
                <p className="text-stone-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 truncate">Pending Approvals</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-stone-900">{stats.pendingProperties}</p>
              </button>
            </div>
            
            {isGlobalAdmin(user) && (
              <div className="mt-8">
                <h3 className="text-xl font-serif font-bold text-stone-900 mb-4">Global Settings</h3>
                <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-stone-900">Premium Listing Plans</h4>
                    <p className="text-stone-500 text-sm mt-1">Enable or disable premium plan selection during onboarding.</p>
                  </div>
                  <button
                    onClick={handleTogglePremium}
                    disabled={togglingPremium}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${premiumEnabled ? 'bg-emerald-600' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${premiumEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* ===================== ANALYTICS TAB ===================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-serif font-bold text-stone-900">Analytics & Insights</h2>
              <p className="text-stone-500 mt-1">Platform growth trends and data-driven property management.</p>
            </div>
            
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Bookings Trend Chart */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col h-full">
                <h3 className="font-bold text-stone-900 text-lg mb-2">Booking Volume</h3>
                <p className="text-sm text-stone-500 mb-6">Confirmed bookings over the last 6 months.</p>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#292524', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Users Growth Chart */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col h-full">
                <h3 className="font-bold text-stone-900 text-lg mb-2">User Growth</h3>
                <p className="text-sm text-stone-500 mb-6">New user sign-ups over the last 6 months.</p>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#292524', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="users" name="New Users" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Property Growth Chart */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col h-full">
                <h3 className="font-bold text-stone-900 text-lg mb-2">Property Listings</h3>
                <p className="text-sm text-stone-500 mb-6">New properties listed over the last 6 months.</p>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f5f5f4' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ color: '#292524', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Bar dataKey="properties" name="New Properties" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            
            {/* Featured Stays Manager */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                  <h3 className="font-bold text-stone-900 text-xl">Manage Featured Stays</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    These are "The ones guests go back to" shown on the explore page. Use booking performance to decide what to promote.
                  </p>
                </div>
                <div className="flex items-center bg-stone-100 rounded-xl p-1 shrink-0">
                  <button
                    onClick={() => saveFeaturedMode('auto')}
                    disabled={savingFeaturedMode}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition ${featuredMode === 'auto' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Auto-Fill
                  </button>
                  <button
                    onClick={() => saveFeaturedMode('manual')}
                    disabled={savingFeaturedMode}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition ${featuredMode === 'manual' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Strict Manual
                  </button>
                  <button
                    onClick={() => saveFeaturedMode('disabled')}
                    disabled={savingFeaturedMode}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition ${featuredMode === 'disabled' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    Disabled
                  </button>
                </div>
              </div>

              {featuredMode === 'disabled' && (
                <div className="bg-stone-50 border border-stone-200 text-stone-600 p-4 rounded-2xl mb-6">
                  <strong>Section Disabled:</strong> The featured stays section is currently hidden from the home page completely.
                </div>
              )}
              {featuredMode === 'manual' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl mb-6">
                  <strong>Strict Manual Mode Active:</strong> The home page will ONLY show the properties you explicitly mark as Featured below (up to 3). If none are featured, the section will be hidden.
                </div>
              )}
              {featuredMode === 'auto' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl mb-6">
                  <strong>Auto-Fill Active:</strong> Featured properties are shown first. Any remaining slots (up to 3 total) are automatically filled with the highest-rated properties on the platform.
                </div>
              )}


              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider rounded-tl-xl">Property</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Total Bookings</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right rounded-tr-xl">Featured Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {featuredCandidateStats.map(({ hotel, bookings }, idx) => (
                      <tr key={`feat-candidate-${hotel.id || 'hotel'}-${idx}`} className={`transition ${hotel.featured ? 'bg-amber-50/30' : 'hover:bg-stone-50'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-stone-100">
                              <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-bold text-stone-900">{hotel.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-stone-600">
                          {hotel.location}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <CalendarRange className="w-4 h-4 text-stone-400" />
                            <span className="font-medium text-stone-900">{bookings}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleToggleFeatured(hotel)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                              hotel.featured 
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            <Star className={`h-4 w-4 ${hotel.featured ? 'fill-amber-500 text-amber-500' : ''}`} />
                            {hotel.featured ? 'Featured' : 'Promote'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {featuredCandidateStats.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                          No properties available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== PROPERTIES TAB ===================== */}
        {activeTab === 'properties' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-3xl font-serif font-bold text-stone-900">Properties</h2>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search properties..."
                    value={hotelSearch}
                    onChange={e => { setHotelSearch(e.target.value); setCurrentHotelPage(1); }}
                    className="pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900 w-full sm:w-64"
                  />
                </div>
                {badPinCount > 0 && (
                  <button
                    onClick={() => { setOnlyBadPins(v => !v); setCurrentHotelPage(1); }}
                    className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      onlyBadPins ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    <MapPinOff className="h-4 w-4" />
                    {badPinCount} broken pins
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {visibleHotels.slice((currentHotelPage - 1) * itemsPerPage, currentHotelPage * itemsPerPage).map((hotel, index) => (
                <div key={`admin-hotel-${hotel.id || index}-${index}`} className="bg-white rounded-xl sm:rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 shadow-2xs border border-stone-200 flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-5 hover:border-stone-300 transition">
                  <div className="w-full aspect-[16/10] sm:aspect-auto sm:h-32 md:h-38 sm:w-36 md:w-48 lg:w-56 bg-stone-100 rounded-lg sm:rounded-xl overflow-hidden shrink-0">
                    <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1 sm:gap-2">
                        <h3 className="text-sm sm:text-base md:text-lg font-bold text-stone-900 truncate">{hotel.name}</h3>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
                        {hotel.featured && (
                          <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-800 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Featured
                          </span>
                        )}
                        
                        {(!hotel.status || hotel.status === 'approved') && (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="h-2.5 w-2.5" /> Approved
                          </span>
                        )}
                        {hotel.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <Clock className="h-2.5 w-2.5" /> Pending
                          </span>
                        )}
                        {hotel.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                            <XCircle className="h-2.5 w-2.5" /> Rejected
                          </span>
                        )}
                        </div>
                      </div>
                      
                      <div className="space-y-0.5 mb-2.5 text-xs">
                        <p className="text-stone-500 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-stone-400 shrink-0" /> <span className="truncate">{hotel.location}</span>
                        </p>
                        {(() => {
                          const problem = pinProblem(hotel.coordinates);
                          return problem ? (
                            <p className="text-amber-700 flex items-center gap-1.5 font-medium">
                              <MapPinOff className="h-3.5 w-3.5 shrink-0" /> {PIN_PROBLEM_LABELS[problem]}
                            </p>
                          ) : (
                            <a
                              href={mapLinkUrl(hotel)}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-stone-500 flex items-center gap-1.5 hover:text-stone-900 transition w-fit"
                            >
                              <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>{hotel.coordinates!.lat.toFixed(4)}, {hotel.coordinates!.lng.toFixed(4)}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          );
                        })()}
                        <div className="text-stone-500 space-y-0.5">
                          <p className="flex items-center gap-1.5 truncate">
                            <Users className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                            <span className="truncate">
                              <strong className="text-stone-700 font-medium">Mgr:</strong>{' '}
                              {hotel.managerName ? (
                                <>
                                  <span className="text-stone-900 font-semibold">{hotel.managerName}</span>
                                  <span className="text-stone-500 ml-1">
                                    ({hotel.managerEmail || (hotel.managerId ? users.find(u => u.uid === hotel.managerId)?.email || hotel.managerId : 'Platform Direct')})
                                  </span>
                                </>
                              ) : (
                                (hotel.managerId && users.find(u => u.uid === hotel.managerId)?.email) ||
                                hotel.managerEmail ||
                                hotel.managerId ||
                                <span className="text-stone-400 italic">Self-managed</span>
                              )}
                            </span>
                          </p>
                          {hotel.ownerName && (
                            <p className="flex items-center gap-1.5 pl-5 text-[11px] text-stone-500 truncate">
                              <span><strong>Entity:</strong> {hotel.ownerName} {hotel.ownerEmail ? `(${hotel.ownerEmail})` : ''}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-stone-100">
                      {hotel.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                            className="bg-emerald-600 text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition flex items-center justify-center cursor-pointer"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(hotel.id!, 'rejected')}
                            className="bg-stone-200 text-stone-700 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-stone-300 transition flex items-center justify-center cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      
                      {(!hotel.status || hotel.status === 'approved') && (
                        <button 
                          onClick={() => handleUpdateStatus(hotel.id!, 'pending')}
                          className="bg-amber-100 text-amber-800 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-200 transition flex items-center justify-center cursor-pointer"
                        >
                          Suspend
                        </button>
                      )}

                      {hotel.status === 'rejected' && (
                        <button 
                          onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                          className="bg-emerald-600 text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition flex items-center justify-center cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleFeatured(hotel)}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                          hotel.featured ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        <Star className={`h-3 w-3 ${hotel.featured ? 'fill-white' : ''}`} />
                        {hotel.featured ? 'Featured' : 'Feature'}
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const nextState = hotel.adminChatEnabled === false ? true : false;
                            await updateDoc(doc(db, 'hotels', hotel.id!), { adminChatEnabled: nextState });
                            setHotels(hotels.map(h => h.id === hotel.id ? { ...h, adminChatEnabled: nextState } : h));
                            toast.success(`Chat has been ${nextState ? 'enabled' : 'disabled'} for ${hotel.name}`);
                          } catch (error) {
                            console.error(error);
                            toast.error('Failed to update chat status');
                          }
                        }}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                          hotel.adminChatEnabled === false ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                        title={hotel.adminChatEnabled === false ? "Enable Chat for this property" : "Disable Chat for this property"}
                      >
                        {hotel.adminChatEnabled === false ? <MessageSquareOff className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                        {hotel.adminChatEnabled === false ? 'Chat Off' : 'Chat On'}
                      </button>

                      <Link 
                        to={`/admin/hotel/${hotel.id}`}
                        className="bg-stone-900 text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-stone-800 transition flex items-center justify-center gap-1 sm:ml-auto"
                      >
                        <Edit3 className="h-3 w-3" /> Manage Listing
                      </Link>
                      
                      {!isMarketing(user) && (
                        confirmDeleteId === hotel.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-red-600">Sure?</span>
                            <button
                              onClick={() => {
                                handleDeleteHotel(hotel.id!);
                                setConfirmDeleteId(null);
                              }}
                              className="bg-red-600 text-white p-2 rounded-xl hover:bg-red-700 transition"
                              title="Confirm Delete"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="bg-stone-200 text-stone-700 p-2 rounded-xl hover:bg-stone-300 transition"
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(hotel.id!)}
                            className="bg-red-100 text-red-700 p-2 rounded-xl hover:bg-red-200 transition"
                            title="Delete Listing"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {visibleHotels.length === 0 && (
                <div className="bg-stone-50 rounded-3xl p-12 text-center text-stone-500">
                  No hotel listings found matching criteria.
                </div>
              )}
              {visibleHotels.length > itemsPerPage && (
                <Pagination
                  currentPage={currentHotelPage}
                  totalPages={Math.ceil(visibleHotels.length / itemsPerPage)}
                  onPageChange={setCurrentHotelPage}
                />
              )}
            </div>
          </div>
        )}
        {/* ===================== USERS TAB ===================== */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-serif font-bold text-stone-900">User Management</h2>
                <p className="text-sm text-stone-500 mt-1">Manage platform accounts, roles, and password recovery.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setCurrentUserPage(1); }}
                    className="pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900 w-full sm:w-64"
                  />
                </div>

                {isGlobalAdmin(user) && (
                  <button
                    type="button"
                    onClick={() => setShowQuickResetModal(true)}
                    className="flex items-center justify-center gap-2 px-3.5 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition shrink-0 shadow-sm"
                  >
                    <Key className="h-3.5 w-3.5" />
                    <span>Reset Any Password</span>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Roles</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {visibleUsers.slice((currentUserPage - 1) * itemsPerPage, currentUserPage * itemsPerPage).map((u, index) => {
                      const rolesList = userRoles(u);
                      return (
                        <tr key={`admin-user-${u.uid || index}-${index}`} className={`hover:bg-stone-50 transition ${u.status === 'suspended' || u.accessRevoked ? 'opacity-50 grayscale' : ''}`}>
                          <td className="px-6 py-4">
                            <p className="font-bold text-stone-900 flex items-center gap-2">
                              {u.displayName || 'No Name'}
                              {(u.status === 'suspended' || u.accessRevoked) && (
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                                  Suspended
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-stone-500">{u.email}</p>
                            <p className="text-xs text-stone-400 mt-1 font-mono">{u.uid}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-600">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {rolesList.includes('admin') && (
                                <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                                  ADMIN
                                </span>
                              )}
                              {rolesList.includes('global_admin') && (
                                <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                                  GLOBAL ADMIN
                                </span>
                              )}
                              {rolesList.includes('marketing') && (
                                <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                                  MARKETING
                                </span>
                              )}
                              {rolesList.includes('hotel_manager') && (
                                <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                                  MANAGER
                                </span>
                              )}
                              {rolesList.includes('traveller') && (
                                <span className="bg-stone-100 text-stone-600 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                                  TRAVELLER
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <button
                                onClick={() => handleToggleUserSuspension(u)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                  (u.status === 'suspended' || u.accessRevoked) ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-stone-200 text-stone-700 hover:bg-red-100 hover:text-red-700'
                                }`}
                              >
                                {(u.status === 'suspended' || u.accessRevoked) ? 'Restore Access' : 'Revoke Access'}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                                title="Permanently delete user profile"
                              >
                                Delete
                              </button>

                              <button
                                onClick={() => handleToggleUserRole(u, 'hotel_manager')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                  rolesList.includes('hotel_manager') ? 'bg-stone-200 text-stone-700 hover:bg-stone-300' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                }`}
                              >
                                {rolesList.includes('hotel_manager') ? 'Revoke Manager' : 'Make Manager'}
                              </button>
                              
                              <button
                                onClick={() => handleToggleUserRole(u, 'admin')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                  rolesList.includes('admin') ? 'bg-stone-200 text-stone-700 hover:bg-stone-300' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                                }`}
                              >
                                {rolesList.includes('admin') ? 'Revoke Admin' : 'Make Admin'}
                              </button>

                              <button
                                onClick={() => handleToggleUserRole(u, 'marketing')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                  rolesList.includes('marketing') ? 'bg-stone-200 text-stone-700 hover:bg-stone-300' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                }`}
                              >
                                {rolesList.includes('marketing') ? 'Revoke Marketing' : 'Make Marketing'}
                              </button>

                              {u.email && (
                                <button
                                  onClick={async () => {
                                    const ok = window.confirm(`Send a password reset email to ${u.email}?`);
                                    if (!ok) return;
                                    try {
                                      await resetPassword(u.email!);
                                      toast.success(`Reset link sent to ${u.email}`);
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
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 transition border border-stone-200/80"
                                  title={`Send password reset email to ${u.email}`}
                                >
                                  <Key className="h-3.5 w-3.5 text-stone-500" />
                                  <span>Reset Password</span>
                                </button>
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
              
              {visibleUsers.length > itemsPerPage && (
                <div className="p-4 border-t border-stone-100">
                  <Pagination
                    currentPage={currentUserPage}
                    totalPages={Math.ceil(visibleUsers.length / itemsPerPage)}
                    onPageChange={setCurrentUserPage}
                  />
                </div>
              )}
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
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-3xl font-serif font-bold text-stone-900">Platform Bookings</h2>

            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Ref</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Property</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Guest</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Dates</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {bookings.slice((currentBookingPage - 1) * itemsPerPage, currentBookingPage * itemsPerPage).map((b, index) => {
                      const hotelName = hotels.find(h => h.id === b.hotelId)?.name || 'Unknown Property';
                      return (
                        <tr key={`admin-booking-${b.id || index}-${index}`} className="hover:bg-stone-50 transition">
                          <td className="px-6 py-4 text-sm font-mono text-stone-500">{b.reference || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm font-bold text-stone-900">{hotelName}</td>
                          <td className="px-6 py-4 text-sm text-stone-600">
                            {b.guestName}
                            <br/>
                            <span className="text-xs text-stone-400">{b.guestEmail || 'No Email'}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-600 whitespace-nowrap">
                            {b.checkIn} <br/>to {b.checkOut}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-stone-400">
                            ***
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                              b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                              b.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              b.status === 'cancelled' ? 'bg-stone-200 text-stone-600' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end">
                              <select
                                value={b.status}
                                onChange={(e) => handleUpdateBookingStatus(b.id!, e.target.value as any)}
                                className="bg-stone-50 border border-stone-200 text-stone-600 text-xs rounded-lg focus:ring-stone-500 focus:border-stone-500 block w-full p-1.5 cursor-pointer"
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
              
              {bookings.length > itemsPerPage && (
                <div className="p-4 border-t border-stone-100">
                  <Pagination
                    currentPage={currentBookingPage}
                    totalPages={Math.ceil(bookings.length / itemsPerPage)}
                    onPageChange={setCurrentBookingPage}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== DESTINATIONS TAB ===================== */}
        {activeTab === 'destinations' && (
          <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-serif font-bold text-stone-900">Destinations</h2>
                <p className="text-stone-500 mt-1">Manage the popular destinations shown on the explore page.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-stone-200">
                  <span className="text-sm font-bold text-stone-700">Manual Mode</span>
                  <button
                    onClick={() => setManualDestinationsEnabled(!manualDestinationsEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${manualDestinationsEnabled ? 'bg-emerald-600' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manualDestinationsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
                <button
                  onClick={saveDestinations}
                  disabled={savingDestinations}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-50"
                >
                  {savingDestinations ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>

            {!manualDestinationsEnabled && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl mb-6">
                <strong>Auto-Generation Active:</strong> The home page is currently showing destinations generated dynamically from live listings. Enable "Manual Mode" above to take full control and show exactly what is in your Active Popular List below.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Custom Destinations Manager */}
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm flex flex-col h-full">
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
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm flex flex-col h-full max-h-[600px]">
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
          <div className="space-y-6 animate-in fade-in duration-300 pb-20">
            <h2 className="text-3xl font-serif font-bold text-stone-900">Content & Legal</h2>
            
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 md:p-8 space-y-8">
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-50"
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

        {/* ===================== EXECUTIVE DOCS TAB ===================== */}
        {activeTab === 'docs' && (
          <AdminDocsHub />
        )}

        {/* ===================== SETTINGS & CHANNELS CONFIGURATION TAB ===================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-1.5 bg-stone-200/70 rounded-2xl w-fit flex-wrap">
              <button
                type="button"
                onClick={() => setSettingsSubTab('whatsapp')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  settingsSubTab === 'whatsapp'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp Business &amp; Messaging
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('email')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  settingsSubTab === 'email'
                    ? 'bg-white text-stone-900 shadow-xs'
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

      </div>
    </div>
  );
}

