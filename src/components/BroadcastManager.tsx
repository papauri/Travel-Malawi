import SectionCard from './SectionCard';
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Broadcast } from '../types';
import { Megaphone, Trash2, CheckCircle2, Clock, Plus, Loader2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import toast from 'react-hot-toast';

interface BroadcastManagerProps {
  hotelId: string;
  managerId: string;
}

export default function BroadcastManager({ hotelId, managerId }: BroadcastManagerProps) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newType, setNewType] = useState<'info' | 'alert' | 'event'>('info');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'broadcasts'), where('hotelId', '==', hotelId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast));
      docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBroadcasts(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [hotelId]);

  const handleAddBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'broadcasts'), {
        hotelId,
        managerId,
        message: newMessage.trim(),
        type: newType,
        isActive: true,
        createdAt: Date.now(),
      });
      toast.success('Broadcast sent!');
      setNewMessage('');
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send broadcast');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'broadcasts', id), { isActive: !currentStatus });
      toast.success(`Broadcast ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'broadcasts', id));
      toast.success('Broadcast deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete broadcast');
    } finally {
      setDeleteTargetId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-stone-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Broadcasts & Alerts" description="Send real-time updates directly to your guests' bookings page.">
      <div className="flex justify-end">
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-stone-800 transition"
          >
            <Plus className="w-4 h-4" /> New Broadcast
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAddBroadcast} className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-stone-700 mb-1">Message</label>
              <input
                type="text"
                autoFocus
                placeholder="E.g., Dinner is served at 7 PM tonight!"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-bold text-stone-700 mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 appearance-none"
              >
                <option value="info">Info</option>
                <option value="event">Event</option>
                <option value="alert">Alert</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-xl font-medium text-stone-600 hover:bg-stone-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <Megaphone className="w-4 h-4" /> Broadcast
            </button>
          </div>
        </form>
      )}

      {broadcasts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-stone-200 rounded-3xl">
          <Megaphone className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-stone-900 mb-2">No broadcasts</h3>
          <p className="text-stone-500 max-w-sm mx-auto">Keep your guests informed with live alerts and event notifications.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {broadcasts.map(broadcast => (
            <div key={broadcast.id} className={`p-5 rounded-2xl border transition-all ${broadcast.isActive ? 'bg-white border-stone-200 shadow-sm' : 'bg-stone-50 border-stone-200/60 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`mt-1 p-2 rounded-full shrink-0 ${
                    broadcast.type === 'alert' ? 'bg-red-100 text-red-600' :
                    broadcast.type === 'event' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{broadcast.type}</span>
                      <span className="text-stone-300">•</span>
                      <span className="text-xs text-stone-500">{new Date(broadcast.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-stone-900 font-medium">{broadcast.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(broadcast.id!, broadcast.isActive)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                      broadcast.isActive ? 'bg-stone-100 text-stone-600 hover:bg-stone-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {broadcast.isActive ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {broadcast.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(broadcast.id!)}
                    className="p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 rounded-full transition"
                    title="Delete broadcast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      </SectionCard>
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        title="Delete Broadcast"
        message="Are you sure you want to delete this broadcast? Guests will no longer see this update."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (deleteTargetId) {
            handleDelete(deleteTargetId);
          }
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
