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
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'broadcasts'), where('hotelId', '==', hotelId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast));
      docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBroadcasts(docs);
      setLoading(false);
    }, (err) => {
      console.error('Error loading broadcasts:', err);
      setLoading(false);
      toast.error('Could not load broadcasts.');
    });
    return () => unsubscribe();
  }, [hotelId]);

  const handleAddBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    // A double click must not broadcast the same message twice to every guest.
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);

    try {
      await addDoc(collection(db, 'broadcasts'), {
        hotelId,
        managerId,
        message: newMessage.trim(),
        type: newType,
        isActive: true,
        createdAt: Date.now(),
      });
      toast.success('Announcement sent');
      setNewMessage('');
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'broadcasts', id), { isActive: !currentStatus });
      toast.success(`Announcement ${!currentStatus ? 'shown' : 'hidden'}`);
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
      <SectionCard title="Guest announcements" description="Shown on your guests' bookings page.">
      <div className="flex justify-end">
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="tm-btn tm-btn-primary"
          >
            <Plus className="w-4 h-4" /> New announcement
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAddBroadcast} className="tm-divider pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 min-w-0">
              <label className="tm-label">Message</label>
              <input
                type="text"
                autoFocus
                placeholder="E.g. Dinner is served at 7 pm tonight"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="tm-input"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="tm-label">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="tm-input"
              >
                <option value="info">Info</option>
                <option value="event">Event</option>
                <option value="alert">Alert</option>
              </select>
            </div>
          </div>
          <div className="tm-actions justify-end">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="tm-btn tm-btn-quiet"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="tm-btn tm-btn-primary"
            >
              <Megaphone className="w-4 h-4" /> Send to guests
            </button>
          </div>
        </form>
      )}

      {broadcasts.length === 0 ? (
        <div className="text-center py-10">
          <Megaphone className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="tm-muted">No announcements yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {broadcasts.map((broadcast, bIdx) => (
            <div key={`${broadcast.id || 'bc'}-${bIdx}`} className={`py-4 ${broadcast.isActive ? '' : 'opacity-60'}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className={`mt-0.5 p-2 rounded-full shrink-0 ${
                    broadcast.type === 'alert' ? 'bg-red-50 text-red-700' :
                    broadcast.type === 'event' ? 'bg-amber-50 text-amber-800' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="tm-tag capitalize">{broadcast.type}</span>
                      <span className="text-stone-300">•</span>
                      <span className="text-xs text-stone-500">{new Date(broadcast.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-stone-900 font-medium text-sm sm:text-base break-words">{broadcast.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start pt-1 sm:pt-0">
                  <button
                    onClick={() => handleToggleActive(broadcast.id!, broadcast.isActive)}
                    className="tm-btn tm-btn-secondary tm-btn-sm"
                  >
                    {broadcast.isActive ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {broadcast.isActive ? 'Hide' : 'Show again'}
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(broadcast.id!)}
                    className="p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center"
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
        title="Delete announcement?"
        message="Guests will no longer see it."
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
