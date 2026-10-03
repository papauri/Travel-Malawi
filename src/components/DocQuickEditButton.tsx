import React, { useState } from 'react';
import { Edit3, Sparkles, ExternalLink } from 'lucide-react';
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
        <div className={`p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 text-amber-900 ${className} print:hidden`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold">
              <strong>Marketing &amp; Admin Mode:</strong> You can customize this document's text and messaging anytime.
            </span>
          </div>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Document</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditorOpen(true)}
          className={`px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs inline-flex items-center gap-1.5 border border-amber-300/80 transition cursor-pointer shadow-xs ${className} print:hidden`}
          title="Edit this document content (Marketing & Super Admin)"
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-800" />
          <span>Edit Content</span>
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
