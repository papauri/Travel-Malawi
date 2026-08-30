export type Role = 'traveller' | 'hotel_manager' | 'admin';

/** Currencies the platform sells in. */
export type CurrencyCode = 'USD' | 'MWK';

/** An amount authored per currency. A missing entry means "not sold in this". */
export type PriceMap = Partial<Record<CurrencyCode, number>>;


export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  phone?: string;
  preferredCurrency?: CurrencyCode;
  /**
   * Primary role. Retained as the first entry of `roles` so documents written
   * before multi-role support are still readable, and so anything reading only
   * this field keeps working.
   */
  role: Role;
  /**
   * Every role the account holds. An account is commonly both a traveller and
   * a hotel manager. Read it through `userRoles()` in lib/roles, which falls
   * back to `role` for older records.
   */
  roles?: Role[];
  createdAt: number;
}

/** One day's trading hours. Times are 'HH:MM' in the property's local time. */
export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

/** Seven entries, index 0 = Sunday, matching Date.getDay(). */
export type WeeklyHours = DayHours[];

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  /** Priced per currency, exactly like rooms. */
  prices?: PriceMap;
  /** Marks such as "v" or "gf"; free text so a kitchen can use its own. */
  tags?: string[];
}

export interface MenuSection {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

/** The six layouts a manager can present their menu in. */
export type MenuTemplate = 'classic' | 'elegant' | 'minimal' | 'bistro' | 'modern' | 'heritage';

export interface Restaurant {
  /** Controls whether the Menu tab appears on the property page at all. */
  enabled: boolean;
  name?: string;
  tagline?: string;
  description?: string;
  hours?: WeeklyHours;
  template: MenuTemplate;
  /**
   * Show only the logo at the head of the menu, with no name or tagline —
   * for properties whose logo already carries the wordmark.
   */
  logoOnly?: boolean;
  /** Best as a transparent PNG; templates place it on their own background. */
  logoUrl?: string;
  sections: MenuSection[];
  /** Free text under the menu: allergens, service charge, sittings. */
  footnote?: string;
}

export interface Hotel {
  id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  managerId: string;
  name: string;
  description: string;
  location: string;
  locationNotes?: string;
  coordinates?: { lat: number; lng: number };
  /**
   * How a guest reaches the property directly. A listing carried none of
   * these, so the promise that the host confirms "by phone or WhatsApp" had
   * no number behind it and a guest with a question had nowhere to go.
   */
  contactEmail?: string;
  contactPhone?: string;
  /** Optional; falls back to `contactPhone` when the property uses one number. */
  contactWhatsapp?: string;
  /**
   * Promoted onto the home page's featured row by an admin. Set only through
   * the admin dashboard: the security rules hold it immutable for the owning
   * manager, or every listing would feature itself.
   */
  featured?: boolean;
  featuredAt?: number;
  amenities: string[];
  categories?: string[];
  galleryUrls?: string[];
  /** Legacy embedded reviews, scraped at import time. Guest-written reviews
   *  live in the `reviews` collection instead — see `Review`. */
  reviews?: { author: string; rating: number; text: string; source: string; date: string }[];
  imageUrl: string;
  /** Reception / property trading hours. Absent means not published. */
  hours?: WeeklyHours;
  /** Check-in and check-out times, shown in the Policies card. */
  checkInTime?: string;
  checkOutTime?: string;
  chatEnabled?: boolean;
  adminChatEnabled?: boolean;
  callsEnabled?: boolean;
  isOnline?: boolean;
  outOfOfficeMessage?: string;
  /** Absent, or `enabled: false`, means the property has no restaurant. */
  restaurant?: Restaurant;
  createdAt: number;
}

export interface RoomType {
  id?: string;
  hotelId: string;
  name: string;
  description: string;

  /**
   * Currencies this room is sold in, primary first. The manager chooses these;
   * every amount below is authored separately in each one, and nothing is ever
   * converted between them.
   */
  currencies?: CurrencyCode[];
  /** Nightly rate per currency. */
  prices?: PriceMap;
  /** Fee per additional guest per night, per currency. */
  extraGuestFees?: PriceMap;

  /**
   * Pre-multi-currency fields, still read as a fallback: `price` was
   * denominated in `currency` (defaulting to USD) and `priceMWK` held a kwacha
   * rate. `showDualCurrency` is superseded by `currencies`. Resolve through
   * lib/currency rather than reading these directly.
   */
  price: number;
  priceMWK?: number;
  showDualCurrency?: boolean;
  currency?: CurrencyCode;

  baseGuests?: number; // Guests included in base price (e.g., 2)
  extraGuestFee?: number; // Legacy: fee in the room's primary currency
  maxGuests: number;
  quantity: number;
  /** Inventory before the manager took the room off sale, so unblocking
   *  restores the real count instead of a hard-coded guess. */
  previousQuantity?: number;
  amenities: string[];
  imageUrl: string;
  galleryUrls?: string[];
  packages?: {
    id: string;
    name: string;
    type: 'per_person' | 'per_room' | 'per_stay';
    /** Legacy price, in the room's primary currency. */
    price: number;
    /** Price per currency. A package unpriced in a currency is not offered in it. */
    prices?: PriceMap;
  }[];
  blockedDates?: string[]; // Array of 'YYYY-MM-DD'
  blockedUnits?: Record<string, number>;
}

export interface Message {
  id?: string;
  bookingId?: string;
  chatId?: string;
  hotelId: string;
  managerId: string;
  guestId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

export interface CallCandidate {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
  createdAt?: number;
}

export interface Call {
  id?: string;
  chatId: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  type: 'audio' | 'video';
  offer?: any;
  answer?: any;
  createdAt: number;
  updatedAt: number;
  connectedAt?: number;
  endedAt?: number;
}

export interface HotelChat {
  id?: string;
  hotelId: string;
  hotelName: string;
  guestId: string;
  guestName: string;
  managerId: string;
  status?: 'active' | 'ended';
  endedAt?: number | null;
  endedBy?: 'guest' | 'manager' | null;
  endedByName?: string | null;
  lastMessage?: string;
  lastSenderId?: string;
  lastSenderName?: string;
  createdAt?: number;
  updatedAt?: number;
  
  // Real-time typing indicators
  guestTyping?: boolean;
  guestTypingAt?: number;
  managerTyping?: boolean;
  managerTypingAt?: number;
  
  // Real-time presence & read / opened receipts
  guestInChat?: boolean;
  guestLastOpenedAt?: number;
  guestLastSeenAt?: number;
  managerInChat?: boolean;
  managerLastOpenedAt?: number;
  managerLastSeenAt?: number;
}

export interface ChatPresenceState {
  guestTyping?: boolean;
  guestTypingAt?: number;
  managerTyping?: boolean;
  managerTypingAt?: number;
  guestInChat?: boolean;
  guestLastOpenedAt?: number;
  guestLastSeenAt?: number;
  managerInChat?: boolean;
  managerLastOpenedAt?: number;
  managerLastSeenAt?: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'rejected';

export interface Booking {
  id?: string;
  /** Short human-quotable code, e.g. "TM-4F2A9C". */
  reference?: string;
  hotelId: string;
  managerId: string;
  roomTypeId: string;
  guestId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestWhatsapp?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  quantity: number;
  total: number;
  /** The currency the guest was quoted and will pay in. */
  currency: CurrencyCode | string;
  status: BookingStatus;
  specialRequests?: string;
  packageIds?: string[];
  extraGuestTotal?: number;
  packagesTotal?: number;
  createdAt: number;
  updatedAt?: number;
  cancelledAt?: number;
  cancelledBy?: 'guest' | 'manager';
  /**
   * Set when the spam checks found something worth a second look. The booking
   * is still accepted — this only tells the property why to be careful.
   */
  flagged?: boolean;
  flagReasons?: string[];
  flagScore?: number;
}

/** A review written by a guest who actually completed a stay. */
export interface Review {
  id?: string;
  hotelId: string;
  bookingId: string;
  guestId: string;
  authorName: string;
  rating: number; // 1-5
  text: string;
  createdAt: number;
}
