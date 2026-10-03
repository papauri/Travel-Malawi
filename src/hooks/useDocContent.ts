import { useState, useEffect, useCallback } from 'react';
import { AdminDocMeta } from '../lib/docUtils';

export function useDocContent(docId: string, defaultTitle: string, defaultSubtitle: string) {
  const [docMeta, setDocMeta] = useState<AdminDocMeta | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchDoc = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/docs/${docId}?format=md`);
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
  }, [docId]);

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
