import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel } from '../types';
import { Building2, Plus, ChevronRight, TestTube } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHotel, setNewHotel] = useState({
    name: '',
    description: '',
    location: '',
    imageUrl: ''
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
    } catch (error) {
      console.error("Error fetching hotels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'hotel_manager') {
      navigate('/');
      return;
    }
    fetchMyHotels();
  }, [user, navigate]);

  const handleAddHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const docRef = await addDoc(collection(db, 'hotels'), {
        managerId: user.uid,
        name: newHotel.name,
        description: newHotel.description,
        location: newHotel.location,
        imageUrl: newHotel.imageUrl,
        amenities: [],
        categories: [],
        createdAt: Date.now()
      });
      
      setHotels([...hotels, {
        id: docRef.id,
        managerId: user.uid,
        name: newHotel.name,
        description: newHotel.description,
        location: newHotel.location,
        imageUrl: newHotel.imageUrl,
        amenities: [],
        categories: [],
        createdAt: Date.now()
      }]);
      
      setShowAddForm(false);
      setNewHotel({ name: '', description: '', location: '', imageUrl: '' });
    } catch (error) {
      console.error("Error adding hotel:", error);
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
          <p className="text-stone-500 mt-2 text-lg">Manage your properties, rooms, and bookings.</p>
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
              <input 
                required
                type="text" 
                value={newHotel.location}
                onChange={e => setNewHotel({...newHotel, location: e.target.value})}
                className="w-full rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
                placeholder="e.g. Lake Malawi"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Image URL</label>
              <input 
                type="url" 
                value={newHotel.imageUrl}
                onChange={e => setNewHotel({...newHotel, imageUrl: e.target.value})}
                className="w-full rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
                placeholder="https://images.unsplash.com/..."
              />
            </div>
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
              className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition"
            >
              Save Property
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
              Get started by adding your first property or loading test accommodations from the homepage to see how it works.
            </p>
          </div>
        ) : (
          hotels.map(hotel => (
            <Link key={hotel.id} to={`/dashboard/hotel/${hotel.id}`} className="group bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden flex flex-col hover:border-stone-400 transition duration-300">
              <div className="h-56 bg-stone-100 relative">
                {hotel.imageUrl ? (
                  <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-stone-300" />
                  </div>
                )}
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">{hotel.name}</h3>
                    <p className="text-stone-500">{hotel.location}</p>
                  </div>
                </div>
                <div className="mt-auto pt-6 border-t border-stone-100 flex items-center justify-between text-stone-900 font-medium">
                  <span>Manage Property</span>
                  <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-stone-900 transition" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
