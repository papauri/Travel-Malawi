import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ConferenceRoom } from '../types';
import { Plus, X, Upload, Save, Trash2, Edit2, Users, Layout } from 'lucide-react';
import toast from 'react-hot-toast';
import RoomGallery from './RoomGallery';
import ImageUpload from './ImageUpload';
import GalleryUpload from './GalleryUpload';

interface Props {
  hotelId: string;
}

export default function ConferenceManager({ hotelId }: Props) {
  const [rooms, setRooms] = useState<ConferenceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<ConferenceRoom | null>(null);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const snap = await getDocs(query(collection(db, 'conference_rooms'), where('hotelId', '==', hotelId)));
        setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConferenceRoom)));
      } catch (error) {
        console.error('Error fetching conference rooms:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, [hotelId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    try {
      const roomRef = editingRoom.id ? doc(db, 'conference_rooms', editingRoom.id) : doc(collection(db, 'conference_rooms'));
      const roomData = { ...editingRoom, hotelId, id: roomRef.id };
      await setDoc(roomRef, roomData);
      
      setRooms(prev => {
        const exists = prev.find(r => r.id === roomRef.id);
        if (exists) return prev.map(r => r.id === roomRef.id ? roomData : r);
        return [...prev, roomData];
      });
      
      setEditingRoom(null);
      toast.success('Conference room saved');
    } catch (error) {
      console.error('Error saving conference room:', error);
      toast.error('Failed to save conference room');
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!window.confirm('Are you sure you want to delete this conference room?')) return;
    try {
      await deleteDoc(doc(db, 'conference_rooms', roomId));
      setRooms(prev => prev.filter(r => r.id !== roomId));
      toast.success('Conference room deleted');
    } catch (error) {
      console.error('Error deleting conference room:', error);
      toast.error('Failed to delete conference room');
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mx-auto"></div></div>;
  }

  if (editingRoom) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
          <h3 className="text-xl font-serif text-stone-900">{editingRoom.id ? 'Edit Conference Room' : 'New Conference Room'}</h3>
          <button type="button" onClick={() => setEditingRoom(null)} className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 md:col-span-2">
              <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Room Name</span>
                <input required type="text" value={editingRoom.name} onChange={e => setEditingRoom({ ...editingRoom, name: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="e.g. Grand Ballroom" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Description</span>
                <textarea required rows={3} value={editingRoom.description} onChange={e => setEditingRoom({ ...editingRoom, description: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none" placeholder="Describe the space..." />
              </label>
            </div>
            
            <label className="block">
              <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Sitting Capacity</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-4 w-4 text-stone-400" />
                </div>
                <input required type="number" min="1" value={editingRoom.capacity || ''} onChange={e => setEditingRoom({ ...editingRoom, capacity: parseInt(e.target.value) || 0 })} className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="100" />
              </div>
            </label>

            <div className="md:col-span-2">
              <ImageUpload
                label="Primary Cover Image"
                value={editingRoom.imageUrl || ''}
                onChange={url => setEditingRoom({ ...editingRoom, imageUrl: url })}
                folder="conferences"
              />
            </div>

            <div className="md:col-span-2 mt-4">
              <GalleryUpload
                label="Gallery Images"
                value={editingRoom.galleryUrls || []}
                onChange={urls => setEditingRoom({ ...editingRoom, galleryUrls: urls })}
                folder="conferences"
              />
            </div>
            
            <div className="md:col-span-2 border-t border-stone-100 pt-6 mt-2">
              <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Amenities (Comma separated)</span>
                <input type="text" value={(editingRoom.amenities || []).join(', ')} onChange={e => setEditingRoom({ ...editingRoom, amenities: e.target.value.split(',').map(a => a.trim()).filter(Boolean) })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="Projector, Whiteboard, AC..." />
              </label>
            </div>
            
            <div className="md:col-span-2">
               <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Pricing & Packages Summary</span>
                <input type="text" value={editingRoom.pricing || ''} onChange={e => setEditingRoom({ ...editingRoom, pricing: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="e.g. From $500 to $1,200 per day" />
              </label>
            </div>
            
            <div className="md:col-span-2">
              <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Guidelines & Offers (One per line)</span>
                <textarea rows={4} value={(editingRoom.policies || []).join('\n')} onChange={e => setEditingRoom({ ...editingRoom, policies: e.target.value.split('\n').filter(p => p.trim() !== '') })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" placeholder="Breakfast and Coffee/Tea packages available on request\n50% deposit required to secure booking" />
              </label>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-6 border-t border-stone-100">
            <button type="button" onClick={() => setEditingRoom(null)} className="px-6 py-2.5 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-100 transition">Cancel</button>
            <button type="submit" className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-emerald-700 transition"><Save className="w-4 h-4" /> Save Conference Room</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-stone-900">Conference Spaces</h2>
          <p className="text-stone-500 text-sm mt-1">Manage meeting rooms, ballrooms, and event spaces.</p>
        </div>
        <button onClick={() => setEditingRoom({ hotelId, name: '', description: '', capacity: 0, amenities: [], imageUrl: '', policies: [], pricing: '' })} className="inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-stone-800 transition shadow-sm">
          <Plus className="w-4 h-4" /> Add Space
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-12 text-center">
          <Layout className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-stone-900 font-semibold mb-2">No conference spaces</h3>
          <p className="text-stone-500 text-sm mb-6 max-w-sm mx-auto">Add event spaces to let guests view your property's capacity for meetings, weddings, and conferences.</p>
          <button onClick={() => setEditingRoom({ hotelId, name: '', description: '', capacity: 0, amenities: [], imageUrl: '', policies: [], pricing: '' })} className="inline-flex items-center gap-2 bg-white border border-stone-200 text-stone-700 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-stone-50 transition shadow-sm">
            <Plus className="w-4 h-4" /> Create First Space
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-start gap-5 p-5 group transition hover:shadow-md">
              <div className="w-full h-48 md:w-64 md:h-48 object-cover rounded-xl overflow-hidden bg-stone-100 shrink-0 relative">
                <RoomGallery images={Array.from(new Set([room.imageUrl, ...(room.galleryUrls || [])]))} altPrefix={room.name} />
              </div>
              <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-xl font-serif text-stone-900 truncate">{room.name}</h3>
                    <div className="flex items-center gap-2 text-stone-600 bg-stone-50 px-3 py-1.5 rounded-full text-xs font-semibold border border-stone-200 shrink-0">
                      <Users className="w-3.5 h-3.5" /> {room.capacity} seats
                    </div>
                  </div>
                  <p className="text-stone-500 text-sm line-clamp-2 leading-relaxed mb-4">{room.description}</p>
                  
                  {room.amenities && room.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {room.amenities.slice(0, 5).map(a => (
                        <span key={a} className="bg-stone-100 text-stone-600 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider">{a}</span>
                      ))}
                      {room.amenities.length > 5 && (
                        <span className="text-[10px] text-stone-400 font-bold px-1 py-1">+{room.amenities.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100 mt-2">
                  <button onClick={() => setEditingRoom(room)} className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(room.id!)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
