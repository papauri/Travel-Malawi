import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isMarketing, isAdmin, isGlobalAdmin } from '../lib/roles';
import DocEditorModal from './DocEditorModal';
import { AdminDocMeta } from '../lib/docUtils';

interface DocQuickEditButtonProps {
  docId: string;
  onSaved?: (updatedDoc: AdminDocMeta, newContent: string) => void;
  className?: string;
  variant?: 'button' | 'banner';
}

export default function DocQuickEditButton({
  docId,
  onSaved,
  className = '',
  variant = 'button'
}: DocQuickEditButtonProps) {
  const { user } = useAuth();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const canEdit = isMarketing(user) || isAdmin(user) || isGlobalAdmin(user);

  if (!canEdit) return null;

  return (
    <>
      {variant === 'banner' ? (
        <div className={`bg-stone-50 border-l-2 border-stone-300 px-4 py-3 flex items-center justify-between gap-3 text-sm text-stone-700 ${className} print:hidden`}>
          <span>You can edit this document's text as a marketing or admin user.</span>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-md text-sm inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Edit3 size={16} />
            <span>Edit document</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditorOpen(true)}
          className={`px-3 py-1.5 rounded-md border border-stone-300 text-stone-800 text-sm inline-flex items-center gap-1.5 hover:bg-stone-50 transition cursor-pointer ${className} print:hidden`}
          title="Edit this document content (Marketing & Super Admin)"
        >
          <Edit3 size={16} className="text-stone-500" />
          <span>Edit</span>
        </button>
      )}

      {isEditorOpen && (
        <DocEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          docId={docId}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
