import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export interface AIStatus {
  enabled: boolean;
  activeProvider: string;
  model: string;
  available: boolean;
}

export interface AIGenerateOptions {
  action: 'draft' | 'polish' | 'shorten' | 'highlights' | 'suggest_amenities' | 'suggest_rooms' | 'review_listing' | 'suggest_rate';
  entityType: 'property' | 'room' | 'conference' | 'dining';
  currentText?: string;
  details?: {
    name?: string;
    location?: string;
    locationNotes?: string;
    category?: string;
    amenities?: string[];
    capacity?: number;
    extraNotes?: string;
    roomsCount?: number;
  };
}

export interface OperationsChatPayload {
  userRole: 'admin' | 'hotel_manager';
  userName?: string;
  userEmail?: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: {
    currentDateStr: string;
    currentTimeStr?: string;
    properties: Array<{
      id: string;
      name: string;
      location?: string;
      category?: string;
      status?: string;
      featured?: boolean;
      isOnline?: boolean;
      outOfOfficeMessage?: string;
      managerId?: string;
      managerName?: string;
      managerEmail?: string;
      managerPhone?: string;
      ownerName?: string;
      ownerEmail?: string;
      ownerPhone?: string;
      contactName?: string;
      contactWhatsapp?: string;
      contactEmail?: string;
      contactPhone?: string;
      crew?: Array<{ name: string; role: string; phone?: string; whatsapp?: string }>;
      checkInTime?: string;
      checkOutTime?: string;
      cancellationPolicy?: string;
      paymentPolicy?: string;
      amenities?: string[];
      restaurant?: {
        enabled: boolean;
        name?: string;
        sectionsCount?: number;
        sampleItems?: string[];
      };
      conferences?: Array<{
        id: string;
        name: string;
        capacity: number;
        dayRateUSD?: number;
        dayRateMWK?: number;
      }>;
      dailyBoard?: {
        activities?: string;
        dishOfTheDay?: string;
        notes?: string;
      };
      rooms?: Array<{
        id: string;
        name: string;
        priceUSD?: number;
        priceMWK?: number;
        maxGuests?: number;
        quantity?: number;
        extraGuestFeeUSD?: number;
        extraGuestFeeMWK?: number;
        blockedDates?: string[];
      }>;
    }>;
    bookings: Array<{
      id: string;
      reference?: string;
      hotelId: string;
      hotelName: string;
      roomName?: string;
      guestName: string;
      guestEmail?: string;
      guestPhone?: string;
      checkIn: string;
      checkOut: string;
      nights?: number;
      guests?: number;
      quantity?: number;
      status: string;
      currency?: string;
      total?: number;
    }>;
    learnedRules?: string[];
    autonomousPatches?: Array<{
      id?: string;
      patch: string;
      trigger?: string;
      resolution?: string;
    }>;
  };
}

export interface ActionProposal {
  type: 
    | 'add_amenity'
    | 'remove_amenity'
    | 'update_amenities'
    | 'update_room_price' 
    | 'update_property_status' 
    | 'update_property_online'
    | 'update_property_policy'
    | 'update_daily_board'
    | 'update_restaurant'
    | 'add_restaurant_dish'
    | 'update_booking_status'
    | 'toggle_featured'
    | 'bulk_update'
    | 'batch_action'
    | string;
  hotelId?: string;
  hotelName?: string;
  hotelIds?: string[];
  hotelNames?: string[];
  targetScope?: 'single' | 'all' | 'custom' | string;

  // Amenities
  amenity?: string;
  amenities?: string[];

  // Room pricing
  roomId?: string;
  roomName?: string;
  oldPrice?: number;
  newPrice?: number;
  currency?: string;

  // Listing / status
  oldStatus?: string;
  newStatus?: string;
  isOnline?: boolean;
  outOfOfficeMessage?: string;

  // Policies
  policyField?: 'checkInTime' | 'checkOutTime' | 'cancellationPolicy' | 'paymentPolicy' | 'contactWhatsapp' | 'mealPolicy' | string;
  policyValue?: string;

  // Restaurant & Dining
  restaurantEnabled?: boolean;
  restaurantName?: string;
  dishName?: string;
  dishSection?: string;
  dishDescription?: string;
  dishPriceUSD?: number;
  dishPriceMWK?: number;

  // Daily Board (StayOS)
  dishOfTheDay?: string;
  activities?: string;

  // Bookings
  bookingId?: string;
  bookingRef?: string;
  featured?: boolean;
  reason?: string;

  // Nested actions
  actions?: ActionProposal[];
}

export interface OperationsChatResult {
  reply: string;
  provider: string;
  model: string;
  actionProposal?: ActionProposal | null;
  newLearnedRule?: string | null;
  suggestedFollowUps?: string[];
  autonomousPatch?: {
    trigger?: string;
    patch: string;
    resolution?: string;
  } | null;
}

let cachedStatus: AIStatus | null = null;
let statusListeners: Array<(s: AIStatus) => void> = [];

function notifyStatus(s: AIStatus) {
  cachedStatus = s;
  statusListeners.forEach(listener => listener(s));
}

export function useAIAssistant() {
  const [status, setStatus] = useState<AIStatus>(cachedStatus || {
    enabled: false,
    activeProvider: '',
    model: '',
    available: false,
  });
  const [loading, setLoading] = useState<boolean>(!cachedStatus);
  const [generating, setGenerating] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        notifyStatus(data);
        setStatus(data);
      }
    } catch {
      // Quietly ignore network failures in offline/preview
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const listener = (s: AIStatus) => setStatus(s);
    statusListeners.push(listener);

    if (!cachedStatus) {
      fetchStatus();
    } else {
      setStatus(cachedStatus);
      setLoading(false);
    }

    return () => {
      statusListeners = statusListeners.filter(l => l !== listener);
    };
  }, [fetchStatus]);

  const generate = useCallback(async (options: AIGenerateOptions): Promise<string | null> => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `Generation failed (${res.status})`;
        toast.error(errMsg);
        return null;
      }

      const data = await res.json();
      return data.text || null;
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast.error(err?.message || 'Failed to connect to AI assistant');
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const generateDetailed = useCallback(async <T = any>(options: AIGenerateOptions): Promise<{ text: string; data?: T } | null> => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `Generation failed (${res.status})`;
        toast.error(errMsg);
        return null;
      }

      const data = await res.json();
      return { text: data.text || '', data: data.data };
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast.error(err?.message || 'Failed to connect to AI assistant');
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const operationsChat = useCallback(async (payload: OperationsChatPayload): Promise<OperationsChatResult | null> => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/operations-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `Operations assistant failed (${res.status})`;
        toast.error(errMsg);
        return null;
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('Operations chat error:', err);
      toast.error(err?.message || 'Failed to connect to Operations Copilot');
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  return {
    status,
    loading,
    generating,
    generate,
    generateDetailed,
    operationsChat,
    refreshStatus: fetchStatus,
  };
}
