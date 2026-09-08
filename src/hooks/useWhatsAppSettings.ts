import { useState, useEffect, useCallback } from 'react';

export interface WhatsAppStatus {
  enabled: boolean;
  provider: 'cloud_api' | 'direct';
  isConfigured: boolean;
  senderPhoneNumber: string;
  defaultCountryCode: string;
  lastTestStatus?: 'success' | 'failed';
}

let cachedStatus: WhatsAppStatus | null = null;
const listeners = new Set<(status: WhatsAppStatus) => void>();

export function useWhatsAppSettings() {
  const [status, setStatus] = useState<WhatsAppStatus>(() => {
    return cachedStatus || {
      enabled: false,
      provider: 'cloud_api',
      isConfigured: false,
      senderPhoneNumber: '',
      defaultCountryCode: '+265',
    };
  });
  const [loading, setLoading] = useState<boolean>(!cachedStatus);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data: WhatsAppStatus = await res.json();
        cachedStatus = data;
        setStatus(data);
        listeners.forEach(fn => fn(data));
      }
    } catch (err) {
      console.error('[useWhatsAppSettings] Failed to fetch WhatsApp status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const listener = (newStatus: WhatsAppStatus) => {
      setStatus(newStatus);
    };
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, [fetchStatus]);

  return {
    ...status,
    whatsappEnabled: status.enabled,
    loading,
    refreshWhatsApp: fetchStatus,
  };
}
