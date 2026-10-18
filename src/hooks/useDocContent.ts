import { useState, useEffect, useCallback } from 'react';
import { AdminDocMeta } from '../lib/docUtils';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useDocContent(docId: string, defaultTitle: string, defaultSubtitle: string) {
  const [docMeta, setDocMeta] = useState<AdminDocMeta | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  // Re-fetch when the signed-in user changes: host and admin documents are only served to a verified token.
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const fetchDoc = useCallback(async () => {
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch(`/api/docs/${docId}?format=md`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      if (res.ok) {
        const data = await res.json();
        setDocMeta(data.doc);
        setContent(data.content || '');
      }
    } catch {
      // Non-fatal: fall back to component default values
    } finally {
      setLoading(false);
    }
  }, [docId, uid]);

  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  return {
    docMeta,
    title: docMeta?.title || defaultTitle,
    subtitle: docMeta?.subtitle || defaultSubtitle,
    category: docMeta?.category,
    content,
    loading,
    isCustomized: !!docMeta?.isCustomized,
    lastEditedBy: docMeta?.lastEditedBy,
    lastEditedAt: docMeta?.lastEditedAt,
    refreshDoc: fetchDoc,
  };
}
