import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SystemSettings {
  contactEmail?: string;
  contactPhone?: string;
  privacyPolicy?: string;
  termsOfService?: string;
  refundPolicy?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  platformDomain?: string;
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'content'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as SystemSettings);
      }
      setLoading(false);
    }, (err) => {
      // Permission or network failure: keep defaults rather than loading forever.
      console.warn('[useSystemSettings] Could not read system content:', err?.message || err);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { settings, loading };
}
