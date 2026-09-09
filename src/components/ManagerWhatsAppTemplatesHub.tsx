import React, { useState } from 'react';
import { MessageSquare, Plus, Edit3, Trash2, Check, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, WhatsAppTemplate } from '../types';

interface Props {
  hotel: Hotel;
  onHotelUpdate?: (updatedHotel: Hotel) => void;
}

export default function ManagerWhatsAppTemplatesHub({ hotel, onHotelUpdate }: Props) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(hotel.whatsappTemplates || []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const saveTemplate = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required');
      return;
    }

    try {
      let newTemplates = [...templates];
      if (editingId) {
        newTemplates = newTemplates.map(t => t.id === editingId ? { ...t, title, body } : t);
      } else {
        newTemplates.push({
          id: Math.random().toString(36).substr(2, 9),
          title,
          body,
          createdAt: Date.now()
        });
      }

      await updateDoc(doc(db, 'hotels', hotel.id!), {
        whatsappTemplates: newTemplates
      });

      setTemplates(newTemplates);
      if (onHotelUpdate) {
        onHotelUpdate({ ...hotel, whatsappTemplates: newTemplates });
      }

      toast.success(editingId ? 'Template updated' : 'Template created');
      setEditingId(null);
      setTitle('');
      setBody('');
    } catch (error) {
      console.error('Error saving WhatsApp template:', error);
      toast.error('Failed to save template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const newTemplates = templates.filter(t => t.id !== id);
      await updateDoc(doc(db, 'hotels', hotel.id!), {
        whatsappTemplates: newTemplates
      });
      setTemplates(newTemplates);
      if (onHotelUpdate) {
        onHotelUpdate({ ...hotel, whatsappTemplates: newTemplates });
      }
      toast.success('Template deleted');
    } catch (error) {
      console.error('Error deleting WhatsApp template:', error);
      toast.error('Failed to delete template');
    }
  };

  const startEdit = (t: WhatsAppTemplate) => {
    setEditingId(t.id);
    setTitle(t.title);
    setBody(t.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden mb-8">
      <div className="p-6 md:p-8 bg-emerald-50 border-b border-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-stone-900">Custom WhatsApp Templates</h2>
          </div>
          <p className="text-sm text-emerald-800">
            Create reusable templates for quick WhatsApp messaging with guests.
          </p>
        </div>
        {!editingId && (
          <button
            onClick={() => { setEditingId('new'); setTitle(''); setBody(''); }}
            className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      <div className="p-6 md:p-8">
        {editingId && (
          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="font-bold text-stone-900 mb-4">{editingId === 'new' ? 'Create Template' : 'Edit Template'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Template Name</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Late Check-in Instructions"
                  className="w-full bg-white border border-stone-300 px-4 py-2.5 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">Message Body</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Hello! Just a quick reminder that our front desk closes at..."
                  rows={4}
                  className="w-full bg-white border border-stone-300 px-4 py-3 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition resize-y"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={saveTemplate}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition text-sm shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Save Template
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-5 py-2.5 rounded-xl font-bold transition text-sm"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!editingId && templates.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-12 h-12 text-stone-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-stone-900 mb-2">No WhatsApp Templates Yet</h3>
            <p className="text-stone-500 max-w-sm mx-auto mb-6">
              Create standardized messages for common guest questions, check-in instructions, and more.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <div key={t.id} className="bg-white border border-stone-200 p-5 rounded-2xl hover:border-emerald-300 transition group flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-stone-900 pr-4">{t.title}</h4>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-stone-500 whitespace-pre-wrap line-clamp-3 mb-2 flex-1">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
