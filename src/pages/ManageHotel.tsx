import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Booking } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Users, Calendar, Check, X, Settings2 } from 'lucide-react';

export default function ManageHotel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', description: '', price: 0, maxGuests: 2, quantity: 5 });

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
          setHotel({ id: docSnap.id, ...docSnap.data() } as Hotel);
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

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      const docRef = await addDoc(collection(db, 'room_types'), {
        hotelId: id,
        ...newRoom,
        amenities: [],
        imageUrl: ''
      });
      setRooms([...rooms, { id: docRef.id, hotelId: id, ...newRoom, amenities: [], imageUrl: '' }]);
      setShowAddRoom(false);
      setNewRoom({ name: '', description: '', price: 0, maxGuests: 2, quantity: 5 });
    } catch (error) {
      console.error("Error adding room:", error);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: 'confirmed' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status });
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status } : b));
    } catch (error) {
      console.error("Error updating booking:", error);
    }
  };

  const toggleRoomAvailability = async (room: RoomType) => {
    try {
      // In a real app we might have a specific isAvailable flag. Let's assume quantity 0 means blocked, or we add an isBlocked flag.
      // For simplicity here we just toggle the quantity between 0 and 5 to "block" it.
      const newQuantity = room.quantity > 0 ? 0 : 5;
      await updateDoc(doc(db, 'room_types', room.id), { quantity: newQuantity });
      setRooms(rooms.map(r => r.id === room.id ? { ...r, quantity: newQuantity } : r));
    } catch (error) {
      console.error("Error blocking room:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-stone-500">Loading...</div>;
  if (!hotel) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold text-stone-900">{hotel.name}</h1>
        <p className="text-stone-500 mt-2 text-lg">Manage your rooms and monitor incoming reservations.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Rooms Section */}
        <div className="xl:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-serif text-stone-900">Room Inventory</h2>
            <button 
              onClick={() => setShowAddRoom(!showAddRoom)}
              className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition"
            >
              <Plus className="h-4 w-4" /> Add Room
            </button>
          </div>

          {showAddRoom && (
            <div className="bg-white p-8 rounded-3xl border border-stone-200 mb-8 shadow-sm">
              <h3 className="font-serif text-xl mb-6 text-stone-900">New Room Type</h3>
              <form onSubmit={handleAddRoom} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Room Name</label>
                    <input type="text" required value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Description</label>
                    <textarea required value={newRoom.description} onChange={e => setNewRoom({...newRoom, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Currency</label>
                    <select 
                      value={newRoom.currency || 'USD'} 
                      onChange={e => setNewRoom({...newRoom, currency: e.target.value})} 
                      className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="MWK">Malawian Kwacha (MWK)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Price per night</label>
                    <input type="number" required value={newRoom.price} onChange={e => setNewRoom({...newRoom, price: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Total Rooms</label>
                    <input type="number" required value={newRoom.quantity} onChange={e => setNewRoom({...newRoom, quantity: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                  </div>
                </div>
                <button type="submit" className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition mt-4">Save Room</button>
              </form>
            </div>
          )}
          <div className="grid gap-6">
            {rooms.length === 0 && !showAddRoom && <p className="text-stone-500 italic">No rooms added yet. Create your first room type above.</p>}
            {rooms.map(room => (
              <div key={room.id} className={`bg-white border p-8 rounded-3xl flex justify-between items-center shadow-sm transition ${room.quantity === 0 ? 'border-red-200 bg-red-50/50' : 'border-stone-200'}`}>
                <div>
                  <h4 className="text-xl font-serif font-bold text-stone-900 mb-2">{room.name}</h4>
                  <div className="flex items-center gap-6 text-sm text-stone-500 font-medium">
                    <span className="flex items-center gap-2"><Users className="h-4 w-4" /> {room.maxGuests} Guests</span>
                    <span>{room.quantity > 0 ? `${room.quantity} Available` : 'Blocked'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-2xl font-serif font-bold text-stone-900">{room.currency === 'MWK' ? 'MWK ' : '$'}{room.price}</div>
                  <button 
                    onClick={() => toggleRoomAvailability(room)}
                    className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition ${room.quantity === 0 ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                  >
                    {room.quantity === 0 ? 'Unblock' : 'Block'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings Section */}
        <div>
          <h2 className="text-2xl font-serif text-stone-900 mb-8">Recent Bookings</h2>
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            {bookings.length === 0 ? (
              <div className="p-12 text-center text-stone-400">
                <Calendar className="h-8 w-8 mx-auto mb-4 opacity-50" />
                <p className="font-medium text-stone-500">No bookings yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {bookings.map(booking => (
                  <li key={booking.id} className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-stone-900">{booking.guestName}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-900'}`}>{booking.status}</span>
                    </div>
                    <div className="text-sm text-stone-500 flex justify-between font-medium mb-4">
                      <span>{booking.checkIn} — {booking.checkOut}</span>
                      <span className="font-bold text-stone-900">{booking.currency === 'MWK' ? 'MWK ' : '$'}{booking.total}</span>
                    </div>
                    {booking.status === 'pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                          className="flex-1 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-green-600 transition flex items-center justify-center gap-1"
                        >
                          <Check className="h-4 w-4" /> Approve
                        </button>
                        <button 
                          onClick={() => updateBookingStatus(booking.id, 'rejected')}
                          className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-xl text-sm font-medium hover:bg-red-100 transition flex items-center justify-center gap-1"
                        >
                          <X className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
