export type Role = 'traveller' | 'hotel_manager' | 'admin';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
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

export interface Hotel {
  id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  managerId: string;
  name: string;
  description: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  amenities: string[];
  categories?: string[];
  galleryUrls?: string[];
  /** Legacy embedded reviews, scraped at import time. Guest-written reviews
   *  live in the `reviews` collection instead — see `Review`. */
  reviews?: { author: string; rating: number; text: string; source: string; date: string }[];
  imageUrl: string;
  createdAt: number;
}

export interface RoomType {
  id?: string;
  hotelId: string;
  name: string;
  description: string;
  price: number; // Base price
  priceMWK?: number;
  showDualCurrency?: boolean;
  currency?: string;
  baseGuests?: number; // Guests included in base price (e.g., 2)
  extraGuestFee?: number; // Fee per additional guest per night
  maxGuests: number;
  quantity: number;
  /** Inventory before the manager took the room off sale, so unblocking
   *  restores the real count instead of a hard-coded guess. */
  previousQuantity?: number;
  amenities: string[];
  imageUrl: string;
  packages?: { id: string; name: string; price: number; type: 'per_person' | 'per_room' | 'per_stay' }[];
  blockedDates?: string[]; // Array of 'YYYY-MM-DD'
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
  currency: string;
  status: BookingStatus;
  specialRequests?: string;
  packageIds?: string[];
  extraGuestTotal?: number;
  packagesTotal?: number;
  createdAt: number;
  updatedAt?: number;
  cancelledAt?: number;
  cancelledBy?: 'guest' | 'manager';
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
