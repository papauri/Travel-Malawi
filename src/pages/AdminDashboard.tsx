import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, User } from '../types';
import { Shield, Building2, CheckCircle, XCircle, Clock, MapPin, Users, Edit2, Key, Trash2, Star } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import SmartImage from '../components/SmartImage';
import { getHotelImage } from '../lib/images';
import { isAdmin, isHotelManager, describeRoles } from '../lib/roles';

export default function AdminDashboard() {
  const { user, loading: authLoading, resetPassword } = useAuth();
  const navigate = useNavigate();
  
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentHotelPage, setCurrentHotelPage] = useState(1);
  const [currentManagerPage, setCurrentManagerPage] = useState(1);
  const itemsPerPage = 5;

  const fetchData = async () => {
    try {
      const [hotelsSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, 'hotels')),
        getDocs(collection(db, 'users'))
      ]);

      const hotelsData = hotelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];
      setHotels(hotelsData);

      const usersData = usersSnapshot.docs.map(doc => ({
        ...doc.data()
      })) as User[];
      
      const pendingManagers = usersData.filter(isHotelManager);
      setManagers(pendingManagers);
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

  const handleDeleteHotel = async (hotelId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this hotel listing? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'hotels', hotelId));
      toast.success('Listing deleted');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete listing');
    }
  };

  /**
   * Promotes a listing onto the home page's featured row. Admin-only: the
   * security rules hold `featured` immutable for the owning manager, or every
   * property would feature itself.
   */
  const handleToggleFeatured = async (hotel: Hotel) => {
    const next = !hotel.featured;
    if (next && !hotel.status) {
      // A listing with no status is a legacy import, treated as approved.
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 w-full">
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-2">
          <Shield className="h-10 w-10 text-stone-900" />
          <h1 className="text-4xl font-serif font-bold text-stone-900">Admin Dashboard</h1>
        </div>
        <p className="text-stone-500 text-lg">Manage hotel listings and platform registrations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left Column: Hotels */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-serif font-bold text-stone-900 mb-6 flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Hotel Listings ({hotels.length})
          </h2>
          
          <div className="space-y-6">
            {hotels.slice((currentHotelPage - 1) * itemsPerPage, currentHotelPage * itemsPerPage).map(hotel => (
              <div key={hotel.id} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 flex flex-col md:flex-row gap-6">
                <div className="h-48 w-full md:w-64 bg-stone-100 rounded-2xl overflow-hidden shrink-0">
                  <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <h3 className="text-xl font-bold text-stone-900">{hotel.name}</h3>
                      <div className="flex items-center gap-2 shrink-0">
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
                      <p className="text-stone-500 text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" /> Manager ID: {hotel.managerId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-stone-100">
                    {hotel.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                          className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                        >
                          Approve Listing
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(hotel.id!, 'rejected')}
                          className="bg-stone-200 text-stone-700 px-5 py-2 rounded-xl text-sm font-medium hover:bg-stone-300 transition"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    
                    {(!hotel.status || hotel.status === 'approved') && (
                      <button 
                        onClick={() => handleUpdateStatus(hotel.id!, 'pending')}
                        className="bg-amber-100 text-amber-700 px-5 py-2 rounded-xl text-sm font-medium hover:bg-amber-200 transition"
                      >
                        Suspend / Mark Pending
                      </button>
                    )}

                    {hotel.status === 'rejected' && (
                      <button 
                        onClick={() => handleUpdateStatus(hotel.id!, 'approved')}
                        className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                      >
                        Approve
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleFeatured(hotel)}
                      className={`px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                        hotel.featured
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      <Star className={`h-4 w-4 ${hotel.featured ? 'fill-white' : ''}`} />
                      {hotel.featured ? 'Featured' : 'Feature'}
                    </button>

                    <Link 
                      to={`/dashboard/hotel/${hotel.id}`}
                      className="bg-stone-900 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition flex items-center gap-2 ml-auto"
                    >
                      <Edit2 className="h-4 w-4" /> Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteHotel(hotel.id!)}
                      className="bg-red-100 text-red-700 p-2 rounded-xl hover:bg-red-200 transition ml-2"
                      title="Delete Listing"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {hotels.length === 0 && (
              <div className="bg-stone-50 rounded-3xl p-12 text-center text-stone-500">
                No hotel listings found in the database.
              </div>
            )}
            {hotels.length > itemsPerPage && (
              <Pagination
                currentPage={currentHotelPage}
                totalPages={Math.ceil(hotels.length / itemsPerPage)}
                onPageChange={setCurrentHotelPage}
              />
            )}
          </div>
        </div>
        
        {/* Right Column: Registrations */}
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 mb-6 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Hotel Managers ({managers.length})
          </h2>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200">
            <div className="space-y-4">
              {managers.slice((currentManagerPage - 1) * itemsPerPage, currentManagerPage * itemsPerPage).map((manager, idx) => (
                <div key={manager.uid} className={`pb-4 ${idx !== managers.length - 1 ? 'border-b border-stone-100' : ''}`}>
                  <p className="font-bold text-stone-900 mb-1">{manager.displayName || 'No Name'}</p>
                  <p className="text-sm text-stone-500 mb-2">{manager.email}</p>
                  <div className="flex justify-between items-center mt-3">
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-stone-400">
                        Joined: {new Date(manager.createdAt).toLocaleDateString()}
                      </span>
                      <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-medium">
                        {describeRoles(manager)}
                      </span>
                    </div>
                    {manager.email && (
                      <button
                        onClick={async () => {
                          try {
                            await resetPassword(manager.email!);
                            toast.success(`Reset link sent to ${manager.email}`);
                          } catch (err) {
                            toast.error('Failed to send reset link');
                          }
                        }}
                        className="text-stone-500 hover:text-stone-900 transition flex items-center gap-1 text-xs font-bold uppercase tracking-wider bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg"
                      >
                        <Key className="h-3 w-3" /> Reset Password
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {managers.length === 0 && (
                <p className="text-stone-500 text-sm text-center py-4">No hotel managers registered.</p>
              )}
              {managers.length > itemsPerPage && (
                <Pagination
                  currentPage={currentManagerPage}
                  totalPages={Math.ceil(managers.length / itemsPerPage)}
                  onPageChange={setCurrentManagerPage}
                />
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
