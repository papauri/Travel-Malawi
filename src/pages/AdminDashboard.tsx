import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, User, Booking, Role } from '../types';
import { 
  Shield, Building2, CheckCircle, XCircle, Clock, MapPin, 
  MapPinOff, Users, Edit2, Key, Trash2, Star, ExternalLink, 
  MessageSquare, MessageSquareOff, LayoutDashboard, CalendarRange, 
  Search, Activity
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import { PIN_PROBLEM_LABELS, mapLinkUrl, pinProblem } from '../lib/geo';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import { getHotelImage } from '../lib/images';
import { isAdmin, isHotelManager, userRoles, toRoleFields } from '../lib/roles';
import { formatMoney } from '../lib/booking';

type Tab = 'overview' | 'properties' | 'users' | 'bookings';

export default function AdminDashboard() {
  const { user, loading: authLoading, resetPassword } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
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
        setPremiumEnabled(!!settingsSnapshot.data().premiumListingsEnabled);
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
      if (!user || !isAdmin(user)) {
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
    if (!window.confirm("Are you sure you want to completely delete this hotel listing? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'hotels', hotelId));
      toast.success('Listing deleted');
      setHotels(hotels.filter(h => h.id !== hotelId));
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete listing');
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
  const badPinCount = useMemo(() => hotels.filter(h => pinProblem(h.coordinates)).length, [hotels]);

  const visibleHotels = useMemo(() => {
    let filtered = hotels;
    if (onlyBadPins) {
      filtered = filtered.filter(h => pinProblem(h.coordinates));
    }
    if (hotelSearch) {
      const q = hotelSearch.toLowerCase();
      filtered = filtered.filter(h => h.name.toLowerCase().includes(q) || h.managerId.toLowerCase().includes(q));
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 w-full flex flex-col md:flex-row gap-8 min-h-screen">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 shrink-0 space-y-2">
        <div className="mb-8 px-4">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-stone-900" />
            <h1 className="text-2xl font-serif font-bold text-stone-900">Admin</h1>
          </div>
          <p className="text-stone-500 text-sm">Platform Management</p>
        </div>
        
        <nav className="space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'overview' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('properties')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'properties' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Building2 className="w-5 h-5" />
            Properties
            {stats.pendingProperties > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                {stats.pendingProperties}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'users' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Users className="w-5 h-5" />
            Users
          </button>
          <button 
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
              activeTab === 'bookings' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <CalendarRange className="w-5 h-5" />
            All Bookings
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        
        {/* ===================== OVERVIEW TAB ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <h2 className="text-3xl font-serif font-bold text-stone-900">Platform Overview</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6" />
                </div>
                <p className="text-stone-500 text-sm font-medium mb-1">Total Properties</p>
                <p className="text-3xl font-bold text-stone-900">{stats.totalProperties}</p>
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-stone-500 text-sm font-medium mb-1">Total Users</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-stone-900">{stats.totalUsers}</p>
                  <span className="text-xs text-stone-400 font-medium">{stats.managersCount} managers</span>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <CalendarRange className="w-6 h-6" />
                </div>
                <p className="text-stone-500 text-sm font-medium mb-1">Total Bookings</p>
                <p className="text-3xl font-bold text-stone-900">{stats.totalBookings}</p>
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                  <Activity className="w-6 h-6" />
                </div>
                <p className="text-stone-500 text-sm font-medium mb-1">Pending Approvals</p>
                <p className="text-3xl font-bold text-stone-900">{stats.pendingProperties}</p>
              </div>
            </div>
            
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

            <div className="space-y-6">
              {visibleHotels.slice((currentHotelPage - 1) * itemsPerPage, currentHotelPage * itemsPerPage).map(hotel => (
                <div key={hotel.id} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 flex flex-col md:flex-row gap-6 hover:border-stone-300 transition">
                  <div className="h-48 w-full md:w-64 bg-stone-100 rounded-2xl overflow-hidden shrink-0">
                    <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <h3 className="text-xl font-bold text-stone-900">{hotel.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {hotel.featured && (
                          <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured
                          </span>
                        )}
                        
                        {(!hotel.status || hotel.status === 'approved') && (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            <CheckCircle className="h-3 w-3" /> Approved
                          </span>
                        )}
                        {hotel.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                        {hotel.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                            <XCircle className="h-3 w-3" /> Rejected
                          </span>
                        )}
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        <p className="text-stone-500 text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4" /> {hotel.location}
                        </p>
                        {(() => {
                          const problem = pinProblem(hotel.coordinates);
                          return problem ? (
                            <p className="text-amber-700 text-sm flex items-center gap-2 font-medium">
                              <MapPinOff className="h-4 w-4" /> {PIN_PROBLEM_LABELS[problem]}
                            </p>
                          ) : (
                            <a
                              href={mapLinkUrl(hotel)}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-stone-500 text-sm flex items-center gap-2 hover:text-stone-900 transition w-fit"
                            >
                              <MapPin className="h-4 w-4 text-emerald-600" />
                              {hotel.coordinates!.lat.toFixed(4)}, {hotel.coordinates!.lng.toFixed(4)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          );
                        })()}
                        <p className="text-stone-500 text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" /> Manager: {users.find(u => u.uid === hotel.managerId)?.email || hotel.managerId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-stone-100">
                      {hotel.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(hotel.id!, 'rejected')}
                            className="bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-300 transition"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      
                      {(!hotel.status || hotel.status === 'approved') && (
                        <button 
                          onClick={() => handleUpdateStatus(hotel.id!, 'pending')}
                          className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-200 transition"
                        >
                          Suspend
                        </button>
                      )}

                      {hotel.status === 'rejected' && (
                        <button 
                          onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                        >
                          Approve
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleFeatured(hotel)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                          hotel.featured ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        <Star className={`h-4 w-4 ${hotel.featured ? 'fill-white' : ''}`} />
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
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                          hotel.adminChatEnabled === false ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                        title={hotel.adminChatEnabled === false ? "Enable Chat for this property" : "Disable Chat for this property"}
                      >
                        {hotel.adminChatEnabled === false ? <MessageSquareOff className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                        {hotel.adminChatEnabled === false ? 'Chat Off' : 'Chat On'}
                      </button>

                      <Link 
                        to={`/dashboard/hotel/${hotel.id}`}
                        className="bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition flex items-center gap-2 ml-auto"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </Link>
                      <button
                        onClick={() => handleDeleteHotel(hotel.id!)}
                        className="bg-red-100 text-red-700 p-2 rounded-xl hover:bg-red-200 transition"
                        title="Delete Listing"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
              <h2 className="text-3xl font-serif font-bold text-stone-900">User Management</h2>
              
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
            </div>

            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Roles</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {visibleUsers.slice((currentUserPage - 1) * itemsPerPage, currentUserPage * itemsPerPage).map(u => {
                      const rolesList = userRoles(u);
                      return (
                        <tr key={u.uid} className="hover:bg-stone-50 transition">
                          <td className="px-6 py-4">
                            <p className="font-bold text-stone-900">{u.displayName || 'No Name'}</p>
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
                            <div className="flex items-center justify-end gap-2">
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

                              {u.email && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await resetPassword(u.email!);
                                      toast.success(`Reset link sent to ${u.email}`);
                                    } catch (err) {
                                      toast.error('Failed to send reset link');
                                    }
                                  }}
                                  className="text-stone-500 hover:text-stone-900 transition p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200"
                                  title="Send Password Reset"
                                >
                                  <Key className="h-4 w-4" />
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
          </div>
        )}
        {/* ===================== BOOKINGS TAB ===================== */}
        {activeTab === 'bookings' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-3xl font-serif font-bold text-stone-900">Platform Bookings</h2>

            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Ref</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Property</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Guest</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Dates</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {bookings.slice((currentBookingPage - 1) * itemsPerPage, currentBookingPage * itemsPerPage).map(b => {
                      const hotelName = hotels.find(h => h.id === b.hotelId)?.name || 'Unknown Property';
                      return (
                        <tr key={b.id} className="hover:bg-stone-50 transition">
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
                          <td className="px-6 py-4 text-sm font-medium text-stone-900">
                            {formatMoney(b.total || 0, b.currency)}
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
                        </tr>
                      );
                    })}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
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

      </div>
    </div>
  );
}
