export type Role = 'traveller' | 'hotel_manager';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role;
  createdAt: number;
}

export interface Hotel {
  id?: string;
  managerId: string;
  name: string;
  description: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  amenities: string[];
  categories?: string[];
  galleryUrls?: string[];
  reviews?: { author: string; rating: number; text: string; source: string; date: string }[];
  imageUrl: string;
  createdAt: number;
}

export interface RoomType {
  id?: string;
  hotelId: string;
  name: string;
  description: string;
  price: number;
  maxGuests: number;
  quantity: number;
  amenities: string[];
  imageUrl: string;
}

export interface Booking {
  id?: string;
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
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected';
  specialRequests?: string;
  createdAt: number;
}
