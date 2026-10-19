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
            className={`tm-input resize-y min-h-[100px] ${className}`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`tm-input ${className}`}
          />
        )}
        <div className="tm-actions mt-2">
          <button
            onClick={handleSave}
            className="tm-btn tm-btn-primary tm-btn-sm"
          >
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="tm-btn tm-btn-secondary tm-btn-sm"
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
        className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-stone-200 rounded-lg shadow-sm text-stone-400 hover:text-amber-800 opacity-0 group-hover/editable:opacity-100 focus:opacity-100 transition-opacity z-10"
        title="Edit section"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
