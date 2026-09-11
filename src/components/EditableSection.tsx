import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, isMarketing } from '../lib/roles';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditableSectionProps {
  docId: string;
  fieldId: string;
  defaultText: string;
  multiline?: boolean;
  className?: string;
}

export default function EditableSection({ docId, fieldId, defaultText, multiline = false, className = '' }: EditableSectionProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const [dbValue, setDbValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canEdit = user?.email && (isAdmin(user) || isMarketing(user));

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[fieldId] !== undefined) {
          setDbValue(data[fieldId]);
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [docId, fieldId]);

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      await setDoc(doc(db, 'system', docId), { [fieldId]: value }, { merge: true });
      toast.success('Section updated');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update section');
    }
  };

  const displayText = dbValue !== null ? dbValue : defaultText;

  if (!canEdit) {
    if (loading && dbValue === null) return <span className="opacity-50">{defaultText}</span>;
    return <span className={className}>{displayText}</span>;
  }

  if (isEditing) {
    return (
      <div className="relative group/edit block w-full">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`w-full bg-stone-100 border border-emerald-500 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-y min-h-[100px] ${className}`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`w-full bg-stone-100 border border-emerald-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${className}`}
          />
        )}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
          >
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1 bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <span className={`relative group/editable block rounded -mx-1 px-1 transition hover:bg-stone-100/50 ${className}`}>
      {displayText}
      <button
        onClick={() => {
          setValue(displayText);
          setIsEditing(true);
        }}
        className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-stone-200 rounded-lg shadow-sm text-stone-400 hover:text-emerald-600 hover:border-emerald-200 opacity-0 group-hover/editable:opacity-100 transition-all z-10"
        title="Edit section"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
