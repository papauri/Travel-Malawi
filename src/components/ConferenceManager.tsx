import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ConferenceRoom } from '../types';
import { Plus, X, Upload, Save, Trash2, Edit2, Users, Layout, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import RoomGallery from './RoomGallery';
import ImageUpload from './ImageUpload';
import GalleryUpload from './GalleryUpload';
import AIAssistantButton from './AIAssistantButton';
import Pagination from './Pagination';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  hotelId: string;
}

export default function ConferenceManager({ hotelId }: Props) {
  const [rooms, setRooms] = useState<ConferenceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<ConferenceRoom | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<ConferenceRoom | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const roomsPerPage = 4;

  // Deleting the last space on a page falls back to the page before it.
  const totalPages = Math.max(1, Math.ceil(rooms.length / roomsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const snap = await getDocs(query(collection(db, 'conference_rooms'), where('hotelId', '==', hotelId)));
        setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConferenceRoom)));
      } catch (error) {
        console.error('Error fetching conference rooms:', error);
        toast.error('Could not load your conference spaces. Refresh to try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, [hotelId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || saving) return;

    setSaving(true);
    try {
      const roomRef = editingRoom.id ? doc(db, 'conference_rooms', editingRoom.id) : doc(collection(db, 'conference_rooms'));
      // Lists are kept loose while typing (so commas and new lines are not
      // eaten); blanks are dropped here.
      const roomData = {
        ...editingRoom,
        hotelId,
        id: roomRef.id,
        amenities: (editingRoom.amenities || []).map(a => a.trim()).filter(Boolean),
        policies: (editingRoom.policies || []).map(p => p.trim()).filter(Boolean),
      };
      // Firestore rejects undefined (a cleared rate is undefined), so those
      // fields are dropped instead of failing the whole save.
      const stored = Object.fromEntries(Object.entries(roomData).filter(([, v]) => v !== undefined));
      await setDoc(roomRef, stored);
      
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (room: ConferenceRoom) => {
    setRoomToDelete(room);
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete?.id) return;
    try {
      await deleteDoc(doc(db, 'conference_rooms', roomToDelete.id));
      setRooms(prev => prev.filter(r => r.id !== roomToDelete.id));
      toast.success('Conference room deleted');
    } catch (error) {
      console.error('Error deleting conference room:', error);
      toast.error('Failed to delete conference room');
    } finally {
      setRoomToDelete(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mx-auto"></div></div>;
  }

  if (editingRoom) {
    return (
      <div className="tm-panel min-w-0">
        <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-stone-100">
          <h3 className="tm-h2 min-w-0 truncate">{editingRoom.id ? 'Edit conference room' : 'New conference room'}</h3>
          <button type="button" onClick={() => setEditingRoom(null)} aria-label="Close" className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 md:col-span-2">
              <label className="block">
                <span className="tm-label">Room name</span>
                <input required type="text" value={editingRoom.name} onChange={e => setEditingRoom({ ...editingRoom, name: e.target.value })} className="tm-input" placeholder="e.g. Grand Ballroom" />
              </label>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="tm-label mb-0">Description</span>
                  <AIAssistantButton
                    value={editingRoom.description || ''}
                    onChange={text => setEditingRoom({ ...editingRoom, description: text })}
                    entityType="conference"
                    context={{
                      name: editingRoom.name,
                      capacity: editingRoom.capacity,
                      amenities: editingRoom.amenities,
                    }}
                    fieldLabel="conference space description"
                  />
                </div>
                <textarea required rows={3} value={editingRoom.description} onChange={e => setEditingRoom({ ...editingRoom, description: e.target.value })} className="tm-input resize-none" placeholder="Describe the space…" />
              </div>
            </div>
            
            <label className="block">
              <span className="tm-label">Seats</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-4 w-4 text-stone-400" />
                </div>
                <input required type="number" min="1" value={editingRoom.capacity || ''} onChange={e => setEditingRoom({ ...editingRoom, capacity: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-stone-300 rounded-lg pl-10 pr-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500" placeholder="100" />
              </div>
            </label>

            <div className="md:col-span-2">
              <ImageUpload
                label="Cover photo"
                value={editingRoom.imageUrl || ''}
                onChange={url => setEditingRoom({ ...editingRoom, imageUrl: url })}
                folder={`hotels/${hotelId}/conferences`}
              />
            </div>

            <div className="md:col-span-2 mt-4">
              <GalleryUpload
                label="More photos"
                value={editingRoom.galleryUrls || []}
                onChange={urls => setEditingRoom({ ...editingRoom, galleryUrls: urls })}
                folder={`hotels/${hotelId}/conferences`}
              />
            </div>
            
            <div className="md:col-span-2 border-t border-stone-100 pt-6 mt-2">
              <label className="block">
                <span className="tm-label">Amenities (comma separated)</span>
                <input type="text" value={(editingRoom.amenities || []).join(', ')} onChange={e => setEditingRoom({ ...editingRoom, amenities: e.target.value.split(',').map(a => a.trimStart()) })} className="tm-input" placeholder="Projector, Whiteboard, AC, High-speed Wi-Fi, Microphones…" />
              </label>
            </div>
            
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-stone-50 p-4">
              <div>
                <label className="block">
                  <span className="tm-label">Base rate</span>
                  <input 
                    type="number" 
                    min="0"
                    step="1000"
                    value={editingRoom.price ?? ''} 
                    onChange={e => setEditingRoom({ ...editingRoom, price: e.target.value ? parseFloat(e.target.value) : undefined })} 
                    className="tm-input" 
                    placeholder="e.g. 250000" 
                  />
                </label>
                <span className="text-xs text-stone-500 mt-1 block">Optional. Shows a from-price on your listing.</span>
              </div>

              <div>
                <label className="block">
                  <span className="tm-label">Currency</span>
                  <select
                    value={editingRoom.priceCurrency || 'MWK'}
                    onChange={e => setEditingRoom({ ...editingRoom, priceCurrency: e.target.value as any })}
                    className="tm-input"
                  >
                    <option value="MWK">MWK (Malawian Kwacha)</option>
                    <option value="USD">USD (US Dollars)</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block">
                  <span className="tm-label">Charged</span>
                  <select
                    value={editingRoom.rateType || 'per_day'}
                    onChange={e => setEditingRoom({ ...editingRoom, rateType: e.target.value as any })}
                    className="tm-input"
                  >
                    <option value="per_day">Per day</option>
                    <option value="per_half_day">Per half day</option>
                    <option value="per_hour">Per hour</option>
                    <option value="per_delegate">Per delegate</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
               <label className="block">
                <span className="tm-label">Pricing note</span>
                <input type="text" value={editingRoom.pricing || ''} onChange={e => setEditingRoom({ ...editingRoom, pricing: e.target.value })} className="tm-input" placeholder="e.g. MWK 250,000 per day including full AV setup and water" />
              </label>
            </div>
            
            <div className="md:col-span-2">
              <label className="block">
                <span className="tm-label">Guidelines and offers (one per line)</span>
                <textarea rows={4} value={(editingRoom.policies || []).join('\n')} onChange={e => setEditingRoom({ ...editingRoom, policies: e.target.value.split('\n') })} className="tm-input" placeholder="Breakfast and Coffee/Tea packages available on request\n50% deposit required to secure booking" />
              </label>
            </div>
          </div>
          
          <div className="tm-actions justify-end pt-5 border-t border-stone-100">
            <button type="button" onClick={() => setEditingRoom(null)} className="tm-btn tm-btn-quiet">Cancel</button>
            <button type="submit" disabled={saving} className="tm-btn tm-btn-primary"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save space'}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="tm-h2">Conference spaces</h2>
          <p className="tm-muted mt-1">Meeting rooms, halls and event spaces.</p>
        </div>
        <button onClick={() => setEditingRoom({ hotelId, name: '', description: '', capacity: 0, amenities: [], imageUrl: '', policies: [], pricing: '' })} className="tm-btn tm-btn-secondary">
          <Plus className="w-4 h-4" /> Add space
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-xl p-8 text-center">
          <Layout className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="tm-muted mb-4">No conference spaces yet. Add one so guests can see your event rooms.</p>
          <button onClick={() => setEditingRoom({ hotelId, name: '', description: '', capacity: 0, amenities: [], imageUrl: '', policies: [], pricing: '' })} className="tm-btn tm-btn-secondary">
            <Plus className="w-4 h-4" /> Add space
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {rooms
              .slice((currentPage - 1) * roomsPerPage, currentPage * roomsPerPage)
              .map((room, rIdx) => {
                const isMenuOpen = openMenuId === (room.id || `conf-${rIdx}`);
                return (
                  <div key={`${room.id || 'room'}-${rIdx}`} className="tm-panel flex flex-col md:flex-row md:items-start gap-5 group min-w-0">
                    <div className="w-full h-48 md:w-64 md:h-48 object-cover rounded-lg overflow-hidden bg-stone-100 shrink-0 relative">
                      <RoomGallery images={Array.from(new Set([room.imageUrl, ...(room.galleryUrls || [])].filter(Boolean) as string[]))} altPrefix={room.name} />
                    </div>
                    <div className="flex-1 flex flex-col justify-between min-w-0 py-1 w-full">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
                          <h3 className="tm-h2 truncate min-w-0">{room.name}</h3>
                          <div className="tm-tag shrink-0">
                            <Users className="w-3.5 h-3.5 text-stone-500" /> {room.capacity} seats
                          </div>
                        </div>
                        <p className="text-stone-500 text-sm line-clamp-2 leading-relaxed mb-4">{room.description}</p>
                        
                        {room.amenities && room.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {room.amenities.slice(0, 5).map((a, aIdx) => (
                              <span key={`${a}-${aIdx}`} className="tm-tag">{a}</span>
                            ))}
                            {room.amenities.length > 5 && (
                              <span className="text-xs text-stone-500 px-1 py-0.5">+{room.amenities.length - 5} more</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="tm-actions justify-end pt-3 border-t border-stone-100 mt-2">
                        <button 
                          type="button"
                          onClick={() => setEditingRoom(room)} 
                          className="tm-btn tm-btn-secondary tm-btn-sm"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> 
                          <span>Edit</span>
                        </button>

                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(isMenuOpen ? null : (room.id || `conf-${rIdx}`))}
                            className="tm-btn tm-btn-quiet tm-btn-sm"
                            aria-label="Space actions"
                          >
                            <span>More</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isMenuOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setOpenMenuId(null)} 
                              />
                              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-lg shadow-sm border border-stone-200 py-1.5 z-40 text-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setEditingRoom(room);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2 text-stone-700 transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-stone-400" />
                                  <span>Edit details</span>
                                </button>
                                <div className="my-1 border-t border-stone-100" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleDelete(room);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Delete space</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {rooms.length > roomsPerPage && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(rooms.length / roomsPerPage)}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!roomToDelete}
        title="Delete conference room?"
        message={`"${roomToDelete?.name}" will be deleted for good.`}
        confirmText="Delete room"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDeleteRoom}
        onCancel={() => setRoomToDelete(null)}
      />
    </div>
  );
}
