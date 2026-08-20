import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Booking } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Users, Calendar, Check, X, Building, BedDouble, Save, Edit2 } from 'lucide-react';

type Tab = 'details' | 'rooms' | 'bookings';

export default function ManageHotel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data states
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Edit states
  const [editHotelData, setEditHotelData] = useState<Partial<Hotel>>({});
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomData, setEditRoomData] = useState<Partial<RoomType>>({});

  useEffect(() => {
    if (!user || user.role !== 'hotel_manager') {
      navigate('/');
      return;
    }

    async function fetchData() {
      if (!id) return;
      try {
        const docRef = doc(db, 'hotels', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().managerId === user?.uid) {
          const hData = { id: docSnap.id, ...docSnap.data() } as Hotel;
          setHotel(hData);
          setEditHotelData(hData);
        } else {
          navigate('/dashboard');
          return;
        }

        const roomsQ = query(collection(db, 'room_types'), where('hotelId', '==', id));
        const roomsDocs = await getDocs(roomsQ);
        setRooms(roomsDocs.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));

        const bookingsQ = query(collection(db, 'bookings'), where('hotelId', '==', id));
        const bookingsDocs = await getDocs(bookingsQ);
        setBookings(bookingsDocs.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, user, navigate]);

  // --- HOTEL HANDLERS ---
  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !hotel) return;
    setSaving(true);
    try {
      // Convert amenities/gallery from string if needed, or assume they are managed as arrays
      // For simplicity in UI, we'll let them type comma separated strings and convert on save
      let amenities = editHotelData.amenities;
      if (typeof amenities === 'string') {
        amenities = (amenities as string).split(',').map(s => s.trim()).filter(Boolean);
      }
      
      let galleryUrls = editHotelData.galleryUrls;
      if (typeof galleryUrls === 'string') {
        galleryUrls = (galleryUrls as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      const updateData = {
        ...editHotelData,
        amenities: amenities || [],
        galleryUrls: galleryUrls || []
      };

      await updateDoc(doc(db, 'hotels', id), updateData);
      setHotel({ ...hotel, ...updateData } as Hotel);
      alert('Property details updated successfully!');
    } catch (error) {
      console.error("Error updating hotel:", error);
      alert('Failed to update property details.');
    } finally {
      setSaving(false);
    }
  };

  // --- ROOM HANDLERS ---
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    
    try {
      let amenities = editRoomData.amenities;
      if (typeof amenities === 'string') {
        amenities = (amenities as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      const roomPayload = {
        ...editRoomData,
        hotelId: id,
        amenities: amenities || []
      } as any;

      if (editingRoomId === 'new') {
        const docRef = await addDoc(collection(db, 'room_types'), roomPayload);
        setRooms([...rooms, { id: docRef.id, ...roomPayload }]);
        setShowAddRoom(false);
      } else if (editingRoomId) {
        await updateDoc(doc(db, 'room_types', editingRoomId), roomPayload);
        setRooms(rooms.map(r => r.id === editingRoomId ? { ...r, ...roomPayload } : r));
      }
      setEditingRoomId(null);
    } catch (error) {
      console.error("Error saving room:", error);
      alert('Failed to save room.');
    } finally {
      setSaving(false);
    }
  };

  const startEditRoom = (room: RoomType) => {
    setEditRoomData({ ...room, amenities: room.amenities?.join(', ') as any });
    setEditingRoomId(room.id!);
  };

  const startNewRoom = () => {
    setEditRoomData({ name: '', description: '', price: 0, maxGuests: 2, quantity: 5, currency: 'USD', imageUrl: '', amenities: '' as any });
    setEditingRoomId('new');
    setShowAddRoom(true);
  };

  const cancelEditRoom = () => {
    setEditingRoomId(null);
    setShowAddRoom(false);
  };

  const toggleRoomAvailability = async (room: RoomType) => {
    try {
      const newQuantity = room.quantity > 0 ? 0 : 5; // simplified toggle
      await updateDoc(doc(db, 'room_types', room.id!), { quantity: newQuantity });
      setRooms(rooms.map(r => r.id === room.id ? { ...r, quantity: newQuantity } : r));
    } catch (error) {
      console.error("Error blocking room:", error);
    }
  };

  // --- BOOKING HANDLERS ---
  const updateBookingStatus = async (bookingId: string, status: 'confirmed' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status });
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status } : b));
    } catch (error) {
      console.error("Error updating booking:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-stone-500">Loading...</div>;
  if (!hotel) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-stone-900">{hotel.name}</h1>
        <p className="text-stone-500 mt-2 text-lg">Manage your property details, rooms, and bookings.</p>
      </div>

      {/* TABS */}
      <div className="flex space-x-2 border-b border-stone-200 mb-8">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition ${activeTab === 'details' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          <Building className="h-4 w-4" /> Property Details
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition ${activeTab === 'rooms' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          <BedDouble className="h-4 w-4" /> Rooms & Pricing
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition ${activeTab === 'bookings' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          <Calendar className="h-4 w-4" /> Bookings
          {bookings.filter(b => b.status === 'pending').length > 0 && (
            <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
              {bookings.filter(b => b.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT: DETAILS */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
          <form onSubmit={handleSaveHotel} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Property Name</label>
                <input type="text" required value={editHotelData.name || ''} onChange={e => setEditHotelData({...editHotelData, name: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Description</label>
                <textarea required rows={4} value={editHotelData.description || ''} onChange={e => setEditHotelData({...editHotelData, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Location</label>
                <input type="text" required value={editHotelData.location || ''} onChange={e => setEditHotelData({...editHotelData, location: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Main Image URL</label>
                <input type="url" required value={editHotelData.imageUrl || ''} onChange={e => setEditHotelData({...editHotelData, imageUrl: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Gallery Image URLs (comma separated)</label>
                <input type="text" value={Array.isArray(editHotelData.galleryUrls) ? editHotelData.galleryUrls.join(', ') : editHotelData.galleryUrls || ''} onChange={e => setEditHotelData({...editHotelData, galleryUrls: e.target.value as any})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="https://..., https://..." />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Amenities (comma separated)</label>
                <input type="text" value={Array.isArray(editHotelData.amenities) ? editHotelData.amenities.join(', ') : editHotelData.amenities || ''} onChange={e => setEditHotelData({...editHotelData, amenities: e.target.value as any})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="WiFi, Pool, Spa..." />
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-800 transition disabled:opacity-50">
                <Save className="h-4 w-4" /> Save Details
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT: ROOMS */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-stone-500">Manage your room inventory, pricing, and availability.</p>
            {!editingRoomId && (
              <button onClick={startNewRoom} className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition">
                <Plus className="h-4 w-4" /> Add Room
              </button>
            )}
          </div>

          {editingRoomId && (
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-xl text-stone-900">{editingRoomId === 'new' ? 'New Room Type' : 'Edit Room'}</h3>
                <button onClick={cancelEditRoom} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition"><X className="h-5 w-5" /></button>
              </div>
              
              <form onSubmit={handleSaveRoom} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Room Name</label>
                    <input type="text" required value={editRoomData.name || ''} onChange={e => setEditRoomData({...editRoomData, name: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea required rows={3} value={editRoomData.description || ''} onChange={e => setEditRoomData({...editRoomData, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Image URL</label>
                    <input type="url" value={editRoomData.imageUrl || ''} onChange={e => setEditRoomData({...editRoomData, imageUrl: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Currency</label>
                    <select value={editRoomData.currency || 'USD'} onChange={e => setEditRoomData({...editRoomData, currency: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition">
                      <option value="USD">USD ($)</option>
                      <option value="MWK">Malawian Kwacha (MWK)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Price per night</label>
                    <input type="number" required value={editRoomData.price || 0} onChange={e => setEditRoomData({...editRoomData, price: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Max Guests</label>
                    <input type="number" required value={editRoomData.maxGuests || 2} onChange={e => setEditRoomData({...editRoomData, maxGuests: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Total Rooms Available</label>
                    <input type="number" required value={editRoomData.quantity || 1} onChange={e => setEditRoomData({...editRoomData, quantity: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={cancelEditRoom} className="px-6 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-100 transition">Cancel</button>
                  <button type="submit" disabled={saving} className="flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-800 transition disabled:opacity-50">
                    <Save className="h-4 w-4" /> Save Room
                  </button>
                </div>
              </form>
            </div>
          )}

          {!editingRoomId && rooms.length === 0 && (
            <div className="bg-stone-50 border border-stone-200 border-dashed rounded-3xl p-12 text-center text-stone-500">
              No rooms added yet. Click 'Add Room' to get started.
            </div>
          )}

          {!editingRoomId && rooms.map(room => (
            <div key={room.id} className={`bg-white border p-6 rounded-3xl flex flex-col md:flex-row gap-6 items-center shadow-sm transition ${room.quantity === 0 ? 'border-red-200 bg-red-50/30' : 'border-stone-200'}`}>
              <div className="w-full md:w-48 h-32 bg-stone-100 rounded-2xl overflow-hidden shrink-0">
                {room.imageUrl ? (
                  <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">No Image</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-xl font-serif font-bold text-stone-900 truncate pr-4">{room.name}</h4>
                  <div className="text-xl font-serif font-bold text-stone-900 whitespace-nowrap">{room.currency === 'MWK' ? 'MWK ' : '$'}{room.price}</div>
                </div>
                <p className="text-stone-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  <span className="flex items-center gap-1.5 text-stone-600"><Users className="h-4 w-4" /> {room.maxGuests} Guests</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider ${room.quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {room.quantity > 0 ? `${room.quantity} Available` : 'Blocked'}
                  </span>
                </div>
              </div>
              <div className="flex md:flex-col w-full md:w-auto gap-2 border-t md:border-t-0 md:border-l border-stone-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                <button 
                  onClick={() => startEditRoom(room)}
                  className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition text-sm font-semibold"
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </button>
                <button 
                  onClick={() => toggleRoomAvailability(room)}
                  className={`flex-1 md:w-full flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition ${room.quantity === 0 ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
                >
                  {room.quantity === 0 ? 'Unblock' : 'Block'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
          {bookings.length === 0 ? (
            <div className="p-16 text-center text-stone-400">
              <Calendar className="h-10 w-10 mx-auto mb-4 opacity-50 text-stone-300" />
              <p className="font-medium text-stone-500 text-lg">No bookings yet.</p>
              <p className="text-sm mt-1">When guests book your rooms, they will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {bookings.sort((a, b) => b.createdAt - a.createdAt).map(booking => (
                <li key={booking.id} className="p-6 md:p-8 hover:bg-stone-50 transition">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-stone-900 text-lg">{booking.guestName}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 
                          booking.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="text-sm text-stone-500 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {booking.checkIn} — {booking.checkOut} ({booking.guests} Guests)
                      </div>
                    </div>
                    <div className="text-2xl font-serif font-bold text-stone-900">
                      {booking.currency === 'MWK' ? 'MWK ' : '$'}{booking.total}
                    </div>
                  </div>
                  
                  {booking.specialRequests && (
                    <div className="mb-4 bg-stone-100 rounded-xl p-4 text-sm text-stone-600">
                      <span className="font-semibold block mb-1">Special Requests:</span>
                      {booking.specialRequests}
                    </div>
                  )}

                  {booking.status === 'pending' && (
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => updateBookingStatus(booking.id!, 'confirmed')}
                        className="bg-stone-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-800 transition flex items-center gap-2"
                      >
                        <Check className="h-4 w-4" /> Confirm Booking
                      </button>
                      <button 
                        onClick={() => updateBookingStatus(booking.id!, 'rejected')}
                        className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-100 transition flex items-center gap-2"
                      >
                        <X className="h-4 w-4" /> Decline
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
