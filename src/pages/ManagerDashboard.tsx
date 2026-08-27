import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Booking, RoomType } from '../types';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { Building2, Plus, ChevronRight, Loader2, Clock, CheckCircle2, XCircle, BedDouble, CalendarCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import ImageUpload from '../components/ImageUpload';
import SmartImage from '../components/SmartImage';
import { getHotelImage } from '../lib/images';
import { isHotelManager } from '../lib/roles';

import Pagination from '../components/Pagination';

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHotel, setNewHotel] = useState<{
    name: string;
    description: string;
    location: string;
    locationNotes?: string;
    imageUrl: string;
    coordinates: { lat: number; lng: number } | null;
  }>({
    name: '',
    description: '',
    location: '',
    locationNotes: '',
    imageUrl: '',
    coordinates: null
  });

  const fetchMyHotels = async () => {
    try {
      const q = query(collection(db, 'hotels'), where("managerId", "==", user?.uid));
      const querySnapshot = await getDocs(q);
      const hotelsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotel[];
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
    if (!authLoading) {
      if (!user || !isHotelManager(user)) {
        navigate('/');
        return;
      }
      fetchMyHotels();
    }
  }, [user, authLoading, navigate]);

  const [saving, setSaving] = useState(false);

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

  const handleAddHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!newHotel.name.trim() || !newHotel.location.trim()) {
      toast.error('Please provide a property name and location.');
      return;
    }

    setSaving(true);
    
    try {
      const docRef = await addDoc(collection(db, 'hotels'), {
        managerId: user.uid,
        status: 'pending',
        name: newHotel.name.trim(),
        description: newHotel.description.trim(),
        location: newHotel.location.trim(),
        locationNotes: newHotel.locationNotes?.trim() || '',
        coordinates: newHotel.coordinates,
        imageUrl: newHotel.imageUrl,
        amenities: [],
        categories: [],
        createdAt: Date.now()
      });
      
      setHotels([...hotels, {
        id: docRef.id,
        managerId: user.uid,
        status: 'pending',
        name: newHotel.name,
        description: newHotel.description,
        location: newHotel.location,
        locationNotes: newHotel.locationNotes,
        coordinates: newHotel.coordinates ?? undefined,
        imageUrl: newHotel.imageUrl,
        amenities: [],
        categories: [],
        createdAt: Date.now()
      }]);
      
      setShowAddForm(false);
      setNewHotel({ name: '', description: '', location: '', locationNotes: '', imageUrl: '', coordinates: null });
      toast.success('Property submitted. It goes live once our team approves it.');
    } catch (error) {
      console.error("Error adding hotel:", error);
      toast.error('Failed to add property.');
    } finally {
      setSaving(false);
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-stone-900">Dashboard</h1>
          <p className="text-stone-500 mt-2 text-lg">
            {totalPending > 0
              ? `${totalPending} booking request${totalPending === 1 ? '' : 's'} waiting for your reply.`
              : 'Manage your properties, rooms, and bookings.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full font-medium hover:bg-stone-800 transition"
          >
            {showAddForm ? 'Cancel' : <><Plus className="h-4 w-4" /> Add Property</>}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 mb-12">
          <h2 className="text-2xl font-serif mb-8 text-stone-900">Add New Property</h2>
          <form onSubmit={handleAddHotel} className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Property Name</label>
              <input 
                required
                type="text" 
                value={newHotel.name}
                onChange={e => setNewHotel({...newHotel, name: e.target.value})}
                className="w-full rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
                placeholder="e.g. Sunset Resort"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Location</label>
              <div className="flex gap-2">
                <input 
                  required
                  type="text" 
                  value={newHotel.location}
                  onChange={e => setNewHotel({...newHotel, location: e.target.value})}
                  className="flex-1 rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
                  placeholder="e.g. Lake Malawi"
                />
                <button 
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((position) => {
                        setNewHotel({...newHotel, coordinates: { lat: position.coords.latitude, lng: position.coords.longitude }});
                        toast.success('Coordinates updated!');
                      }, () => toast.error('Failed to get location'));
                    }
                  }}
                  className="bg-stone-100 text-stone-600 px-4 rounded-xl hover:bg-stone-200 transition font-medium whitespace-nowrap"
                >
                  📍 Get Coords
                </button>
              </div>
              {newHotel.coordinates && (
                <p className="text-xs text-stone-500 mt-2">Saved coordinates: {newHotel.coordinates.lat.toFixed(4)}, {newHotel.coordinates.lng.toFixed(4)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Location Notes / Directions</label>
              <textarea 
                rows={2}
                value={newHotel.locationNotes || ''}
                onChange={e => setNewHotel({...newHotel, locationNotes: e.target.value})}
                className="w-full rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
                placeholder="Any extra directions or notes to help guests find the property (optional)."
              />
            </div>
            <ImageUpload 
              label="Property Main Image"
              value={newHotel.imageUrl}
              onChange={(url) => setNewHotel({...newHotel, imageUrl: url})}
              folder="hotels"
            />
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Description</label>
              <textarea 
                required
                rows={4}
                value={newHotel.description}
                onChange={e => setNewHotel({...newHotel, description: e.target.value})}
                className="w-full rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
                placeholder="Describe your property..."
              />
            </div>
            <button 
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving Property...' : 'Save Property'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {hotels.length === 0 && !showAddForm ? (
          <div className="col-span-full bg-white p-16 text-center rounded-3xl border border-stone-200 shadow-sm">
            <Building2 className="h-16 w-16 text-stone-300 mx-auto mb-6" />
            <h3 className="text-2xl font-serif text-stone-900 mb-3">No properties yet</h3>
            <p className="text-stone-500 text-lg max-w-md mx-auto mb-8">
              Add your first property to start taking bookings. You can add rooms,
              photos and a menu once it exists.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition"
            >
              Add your first property
            </button>
          </div>
        ) : (
          hotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(hotel => (
            <Link
              key={hotel.id}
              to={
                (summaryByHotel.get(hotel.id!)?.pending ?? 0) > 0
                  ? `/dashboard/hotel/${hotel.id}?tab=bookings`
                  : (summaryByHotel.get(hotel.id!)?.rooms ?? 0) === 0
                    ? `/dashboard/hotel/${hotel.id}?tab=rooms`
                    : `/dashboard/hotel/${hotel.id}`
              }
              className="group bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden flex flex-col hover:border-stone-400 transition duration-300"
            >
              <div className="h-56 bg-stone-100 relative">
                <SmartImage
                  src={getHotelImage(hotel)}
                  alt={hotel.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out"
                />
                {/* Moderation status was previously only visible to admins, so a
                    manager had no way to tell whether their listing was live. */}
                <span className={`absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider shadow-sm ${
                  hotel.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  hotel.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {hotel.status === 'pending' ? <><Clock className="h-3 w-3" /> Awaiting approval</>
                    : hotel.status === 'rejected' ? <><XCircle className="h-3 w-3" /> Not published</>
                    : <><CheckCircle2 className="h-3 w-3" /> Live</>}
                </span>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">{hotel.name}</h3>
                <p className="text-stone-500 mb-5">{hotel.location}</p>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <BedDouble className="h-4 w-4 text-stone-400" />
                    {summaryByHotel.get(hotel.id!)?.rooms ?? 0} room type{(summaryByHotel.get(hotel.id!)?.rooms ?? 0) === 1 ? '' : 's'}
                  </span>
                  {(summaryByHotel.get(hotel.id!)?.pending ?? 0) > 0 ? (
                    <span className="flex items-center gap-1.5 font-semibold text-amber-700">
                      <CalendarCheck className="h-4 w-4" />
                      {summaryByHotel.get(hotel.id!)!.pending} awaiting reply
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-stone-400">
                      <CalendarCheck className="h-4 w-4" /> No pending requests
                    </span>
                  )}
                </div>

                {(summaryByHotel.get(hotel.id!)?.rooms ?? 0) === 0 && (
                  // Without a room a listing cannot take a single booking, so
                  // this is the one thing worth saying loudly.
                  <p className="mt-4 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
                    Add a room before this property can take bookings.
                  </p>
                )}

                <div className="mt-auto pt-6 border-t border-stone-100 flex items-center justify-between text-stone-900 font-medium">
                  <span>Manage property</span>
                  <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-stone-900 transition" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      {hotels.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(hotels.length / itemsPerPage)}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
