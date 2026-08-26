import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Booking } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Plus, ChevronLeft, ChevronDown, CheckCircle2, XCircle, Clock, Save, Edit2, Key, Bed, Settings, Info, CreditCard, Trash2, Users, Calendar, Check, X, Building, BedDouble, Loader2 } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import GalleryUpload from '../components/GalleryUpload';
import ConfirmDialog from '../components/ConfirmDialog';
import SmartImage from '../components/SmartImage';
import toast from 'react-hot-toast';

type Tab = 'details' | 'rooms' | 'bookings';

export default function ManageHotel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModalBooking, setConfirmModalBooking] = useState<string | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);

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
    if (authLoading) return;
    
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
  }, [id, user, authLoading, navigate]);

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
      toast.success('Property details updated successfully!');
    } catch (error) {
      console.error("Error updating hotel:", error);
      toast.error('Failed to update property details.');
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

      let blockedDates = editRoomData.blockedDates;
      if (typeof blockedDates === 'string') {
        blockedDates = (blockedDates as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      const roomPayload = {
        ...editRoomData,
        hotelId: id,
        amenities: amenities || [],
        blockedDates: blockedDates || []
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
      toast.error('Failed to save room.');
    } finally {
      setSaving(false);
    }
  };

  const startEditRoom = (room: RoomType) => {
    setEditRoomData({ 
      ...room, 
      amenities: room.amenities?.join(', ') as any,
      blockedDates: room.blockedDates?.join(', ') as any
    });
    setEditingRoomId(room.id!);
  };

  const startNewRoom = () => {
    setEditRoomData({ 
      name: '', 
      description: '', 
      price: 0, 
      priceMWK: 0, 
      showDualCurrency: false, 
      maxGuests: 2, 
      baseGuests: 2, 
      extraGuestFee: 0, 
      quantity: 5, 
      currency: 'USD', 
      imageUrl: '', 
      amenities: '' as any, 
      blockedDates: '' as any,
      packages: [] 
    });
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
      if (status === 'confirmed') setConfirmModalBooking(null);
    } catch (error) {
      console.error("Error updating booking:", error);
    }
  };

  const deleteBooking = async (bookingId: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      setBookings(bookings.filter(b => b.id !== bookingId));
      toast.success('Booking deleted.');
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error('Failed to delete booking.');
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
        <div className="space-y-6">
          {/* LIVE PREVIEW: How your images look to guests */}
          {(editHotelData.imageUrl || (editHotelData.galleryUrls && editHotelData.galleryUrls.length > 0) || rooms.some(r => r.imageUrl)) && (
            <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
              <h3 className="text-lg font-serif font-bold text-stone-900 mb-6">📸 Live Image Preview</h3>
              
              {/* Hotel Gallery */}
              {(editHotelData.imageUrl || (editHotelData.galleryUrls && editHotelData.galleryUrls.length > 0)) && (
                <div className="mb-8">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Hotel Gallery</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {editHotelData.imageUrl && (
                      <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-emerald-400">
                        <SmartImage src={editHotelData.imageUrl} alt="Main" className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Main</span>
                      </div>
                    )}
                    {(editHotelData.galleryUrls || []).map((url, idx) => (
                      <div key={`gal-${idx}`} className="relative aspect-video rounded-xl overflow-hidden border border-stone-200">
                        <SmartImage src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 bg-stone-900/70 text-white text-[10px] px-2 py-0.5 rounded-full">Gallery</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Room Images */}
              {rooms.some(r => r.imageUrl) && (
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Room Images</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {rooms.filter(r => r.imageUrl).map(room => (
                      <div key={`room-${room.id}`} className="relative aspect-video rounded-xl overflow-hidden border border-blue-200">
                        <SmartImage src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{room.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
          <form onSubmit={handleSaveHotel} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Property Name</label>
                <input type="text" required value={editHotelData.name || ''} readOnly disabled className="w-full bg-stone-200 border border-stone-300 p-3 rounded-xl outline-none text-stone-500 cursor-not-allowed" />
                <p className="text-xs text-stone-400 mt-1">Property name cannot be changed after registration. Contact admin for assistance.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Description</label>
                <textarea required rows={4} value={editHotelData.description || ''} onChange={e => setEditHotelData({...editHotelData, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Location</label>
                <div className="flex gap-2">
                  <input type="text" required value={editHotelData.location || ''} onChange={e => setEditHotelData({...editHotelData, location: e.target.value})} className="flex-1 bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  <button 
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((position) => {
                          setEditHotelData({...editHotelData, coordinates: { lat: position.coords.latitude, lng: position.coords.longitude }});
                          toast.success('Coordinates updated!');
                        }, () => toast.error('Failed to get location'));
                      }
                    }}
                    className="bg-stone-200 text-stone-700 px-4 rounded-xl hover:bg-stone-300 transition font-medium whitespace-nowrap"
                  >
                    📍 Get Coords
                  </button>
                </div>
                {editHotelData.coordinates && (
                  <p className="text-xs text-stone-500 mt-2">Saved coordinates: {editHotelData.coordinates.lat.toFixed(4)}, {editHotelData.coordinates.lng.toFixed(4)}</p>
                )}
              </div>
              <ImageUpload
                label="Main Property Image"
                value={editHotelData.imageUrl || ''}
                onChange={(url) => setEditHotelData({ ...editHotelData, imageUrl: url })}
                folder="hotels"
              />
              <div className="md:col-span-2">
                <GalleryUpload 
                  value={editHotelData.galleryUrls || []} 
                  onChange={(urls) => setEditHotelData({ ...editHotelData, galleryUrls: urls })} 
                  label="Hotel Gallery"
                  folder="gallery"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Amenities (comma separated)</label>
                <input type="text" value={Array.isArray(editHotelData.amenities) ? editHotelData.amenities.join(', ') : editHotelData.amenities || ''} onChange={e => setEditHotelData({...editHotelData, amenities: e.target.value as any})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="WiFi, Pool, Spa..." />
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-800 transition disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </form>
        </div>
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
                      <ImageUpload
                        label="Room Image"
                        value={editRoomData.imageUrl || ''}
                        onChange={(url) => setEditRoomData({...editRoomData, imageUrl: url})}
                        folder="rooms"
                      />
                    </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Price in USD ($)</label>
                    <input type="number" min="0" step="0.01" required value={editRoomData.price || 0} onChange={e => setEditRoomData({...editRoomData, price: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="e.g. 150" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Price in MWK (Kwacha)</label>
                    <input type="number" min="0" step="1" value={editRoomData.priceMWK || 0} onChange={e => setEditRoomData({...editRoomData, priceMWK: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="e.g. 250000" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={editRoomData.showDualCurrency || false} onChange={e => setEditRoomData({...editRoomData, showDualCurrency: e.target.checked})} className="w-5 h-5 rounded text-stone-900 border-stone-300" />
                      <span className="text-sm font-medium text-stone-700">Show both USD and MWK prices to guests</span>
                    </label>
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

                {/* PACKAGES & INCLUSIONS */}
                <div className="border-t border-stone-200 pt-6">
                  <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-4">Room Packages & Inclusions</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { name: "Breakfast Included", price: 15, type: "per_person" as const },
                      { name: "All-Inclusive", price: 50, type: "per_person" as const },
                      { name: "Airport Shuttle", price: 30, type: "per_room" as const },
                      { name: "Gym Access", price: 10, type: "per_person" as const },
                      { name: "Kids Free (Under 12)", price: 0, type: "per_stay" as const },
                      { name: "Spa Access", price: 25, type: "per_person" as const },
                      { name: "WiFi Premium", price: 5, type: "per_room" as const },
                    ].filter(p => !(editRoomData.packages || []).some(ep => ep.name === p.name)).map(p => (
                      <button key={p.name} type="button" onClick={() => {
                        const pkgs = editRoomData.packages || [];
                        setEditRoomData({...editRoomData, packages: [...pkgs, { id: Date.now().toString(), ...p }]});
                      }} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-xs font-medium hover:bg-stone-200 transition border border-stone-200">
                        + {p.name}
                      </button>
                    ))}
                  </div>
                  {editRoomData.packages && editRoomData.packages.length > 0 && (
                    <div className="space-y-3">
                      {editRoomData.packages.map(pkg => (
                        <div key={pkg.id} className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                          <span className="flex-1 font-medium text-sm">{pkg.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-500">$</span>
                            <input type="number" value={pkg.price} onChange={e => {
                              const updated = editRoomData.packages!.map(p => p.id === pkg.id ? {...p, price: Number(e.target.value)} : p);
                              setEditRoomData({...editRoomData, packages: updated});
                            }} className="w-16 bg-white border border-stone-200 p-1.5 rounded-lg text-sm text-center outline-none focus:border-stone-900" />
                          </div>
                          <select value={pkg.type} onChange={e => {
                            const updated = editRoomData.packages!.map(p => p.id === pkg.id ? {...p, type: e.target.value as any} : p);
                            setEditRoomData({...editRoomData, packages: updated});
                          }} className="bg-white border border-stone-200 p-1.5 rounded-lg text-xs outline-none focus:border-stone-900">
                            <option value="per_person">Per Person</option>
                            <option value="per_room">Per Room</option>
                            <option value="per_stay">Per Stay</option>
                          </select>
                          <button type="button" onClick={() => {
                            setEditRoomData({...editRoomData, packages: editRoomData.packages?.filter(p => p.id !== pkg.id)});
                          }} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BLOCKED DATES */}
                <div className="border-t border-stone-200 pt-6">
                  <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-2">Block Dates</h4>
                  <p className="text-xs text-stone-500 mb-3">Block specific dates (YYYY-MM-DD), comma separated.</p>
                  <textarea rows={2} value={editRoomData.blockedDates as any || ""} onChange={e => setEditRoomData({...editRoomData, blockedDates: e.target.value as any})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="2026-09-01, 2026-09-02" />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={cancelEditRoom} className="px-6 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-100 transition">Cancel</button>
                  <button type="submit" disabled={saving} className="flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-800 transition disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving...' : 'Save Room'}
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
                <SmartImage src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-xl font-serif font-bold text-stone-900 truncate pr-4">{room.name}</h4>
                  <div className="text-right">
                    <div className="text-xl font-serif font-bold text-stone-900 whitespace-nowrap">${room.price}</div>
                    {room.showDualCurrency && room.priceMWK ? <div className="text-sm text-stone-500 font-medium">MWK {room.priceMWK?.toLocaleString()}</div> : null}
                  </div>
                </div>
                <p className="text-stone-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  <span className="flex items-center gap-1.5 text-stone-600"><Users className="h-4 w-4" /> {room.maxGuests} Guests</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider ${room.quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {room.quantity > 0 ? `${room.quantity} Available` : 'Blocked'}
                  </span>
                
                  {room.packages && room.packages.length > 0 && room.packages.map(pkg => (
                    <span key={pkg.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{pkg.name}</span>
                  ))}
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
                      {(booking.guestEmail || booking.guestPhone || booking.guestWhatsapp) && (
                        <div className="text-sm text-stone-500 mb-2 flex gap-4 flex-wrap">
                          {booking.guestEmail && <span>✉️ {booking.guestEmail}</span>}
                          {booking.guestPhone && <span>📞 {booking.guestPhone}</span>}
                          {booking.guestWhatsapp && (
                            <a href={`https://wa.me/${booking.guestWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                              WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                      <p className="text-stone-500 font-medium mb-1">{rooms.find(r => r.id === booking.roomTypeId)?.name || 'Unknown Room'}</p>
                      <div className="text-sm text-stone-500 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {booking.checkIn} — {booking.checkOut} ({booking.guests} Guests)
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end">
                      <span className="font-serif font-bold text-2xl text-stone-900 mb-2">{booking.currency === 'MWK' ? 'MWK ' : '$'}{booking.total}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setBookingToDelete(booking.id!)} className="text-stone-400 hover:text-red-500 transition p-2">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
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
                        onClick={() => setConfirmModalBooking(booking.id!)}
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

      {/* Confirmation Modal */}
      {confirmModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl p-8">
            <h2 className="text-2xl font-serif text-stone-900 font-bold mb-4">Confirm Booking</h2>
            <div className="space-y-4 mb-8">
              <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm border border-amber-200">
                <span className="font-bold block mb-1">⚠️ Guideline</span>
                Please call the guest or message them on WhatsApp to confirm their arrival time before approving this booking.
              </div>
              <div className="bg-stone-50 text-stone-600 p-4 rounded-xl text-sm border border-stone-200">
                <span className="font-bold block mb-1">💳 Payment</span>
                Remind the guest that payment is to be settled directly at the property upon arrival.
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setConfirmModalBooking(null)} className="flex-1 bg-stone-100 text-stone-900 px-6 py-3 rounded-full font-medium hover:bg-stone-200 transition">
                Cancel
              </button>
              <button onClick={() => updateBookingStatus(confirmModalBooking, 'confirmed')} className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-full font-medium hover:bg-emerald-700 transition">
                Approve Booking
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!bookingToDelete}
        title="Delete Booking"
        message="Are you sure you want to permanently delete this booking? This action cannot be undone."
        confirmText="Delete"
        isDestructive={true}
        onConfirm={() => {
          if (bookingToDelete) deleteBooking(bookingToDelete);
        }}
        onCancel={() => setBookingToDelete(null)}
      />
    </div>
  );
}


