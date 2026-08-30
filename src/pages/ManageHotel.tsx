import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, RoomType, Booking, CurrencyCode, PriceMap, Restaurant, WeeklyHours } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CheckCircle2, XCircle, Clock, Save, Edit2, Trash2, Users, Calendar, Check, X, Building, BedDouble, Loader2, Download, TrendingUp, Percent, Wallet, UtensilsCrossed, Eye, ChevronLeft, ExternalLink, AlertTriangle } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import GalleryUpload from '../components/GalleryUpload';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import BookingChat from '../components/BookingChat';
import PropertyChat from '../components/PropertyChat';
import { MessageSquare } from 'lucide-react';
import SmartImage from '../components/SmartImage';
import { useBreadcrumbLabel } from '../components/Breadcrumbs';
import LocationPicker from '../components/LocationPicker';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import OpeningHoursEditor from '../components/OpeningHoursEditor';
import MenuEditor, { emptyRestaurant } from '../components/MenuEditor';
import MenuTemplateView from '../components/MenuTemplates';
import toast from 'react-hot-toast';
import { addDays, formatDateStr, isValidDateStr, nightsBetween, nightsInRange, todayStr } from '../lib/dates';
import { isRoomAvailable } from '../lib/availability';
import { formatMoney } from '../lib/booking';
import { CURRENCIES, CURRENCY_CODES, currenciesForRooms, roomCurrencies, roomPrice } from '../lib/currency';
import { defaultWeek } from '../lib/hours';
import { SPAM_REASON_LABELS } from '../lib/spam';
import { isHotelManager, isAdmin } from '../lib/roles';
import { PROPERTY_CATEGORIES } from '../lib/listing';
import { emailProblem, phoneProblem } from '../lib/contact';
import { validateProperty } from '../lib/listing';
import { RoomErrors, firstError, hasErrors, validateRoom } from '../lib/validateRoom';
import FieldError from '../components/FieldError';

type Tab = 'details' | 'rooms' | 'restaurant' | 'bookings' | 'inquiries';

const TABS: Tab[] = ['details', 'rooms', 'restaurant', 'bookings', 'inquiries'];

const isTab = (value: string | null): value is Tab => !!value && (TABS as string[]).includes(value);

/** Compares only what the details form can actually change. */
function hotelFormSnapshot(data: Partial<Hotel>): string {
  const amenities = Array.isArray(data.amenities)
    ? data.amenities
    : String(data.amenities ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return JSON.stringify({
    description: data.description ?? '',
    categories: data.categories ?? [],
    location: data.location ?? '',
    locationNotes: data.locationNotes ?? '',
    coordinates: data.coordinates ?? null,
    imageUrl: data.imageUrl ?? '',
    galleryUrls: data.galleryUrls ?? [],
    amenities,
    checkInTime: data.checkInTime ?? '',
    checkOutTime: data.checkOutTime ?? '',
    contactEmail: data.contactEmail ?? '',
    contactPhone: data.contactPhone ?? '',
    contactWhatsapp: data.contactWhatsapp ?? '',
    hours: data.hours ?? null,
    chatEnabled: data.chatEnabled !== false,
    callsEnabled: data.callsEnabled !== false,
    adminChatEnabled: data.adminChatEnabled !== false,
    isOnline: data.isOnline ?? true,
    outOfOfficeMessage: data.outOfOfficeMessage ?? '',
  });
}

/** Fields that describe the listing itself and are never edited from this form. */
const HOTEL_READONLY_FIELDS = [
  'id', 'managerId', 'status', 'featured', 'featuredAt', 'createdAt', 'name', 'reviews',
] as const;

export default function ManageHotel() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin/');
  const backUrl = isAdminRoute ? '/admin' : '/dashboard';
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // The tab lives in the query string, so a reload, a shared link and the
  // browser's back button all land where the manager expects.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: Tab = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as Tab) : 'details';
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModalBooking, setConfirmModalBooking] = useState<string | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);

  // Data states
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [inquiryToDelete, setInquiryToDelete] = useState<string | null>(null);
  const [deletingInquiry, setDeletingInquiry] = useState(false);

  // Edit states
  const [editHotelData, setEditHotelData] = useState<Partial<Hotel>>({});
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomData, setEditRoomData] = useState<Partial<RoomType>>({});
  const [roomErrors, setRoomErrors] = useState<RoomErrors>({});
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [currentBookingPage, setCurrentBookingPage] = useState(1);
  const bookingsPerPage = 5;
  const [chatTarget, setChatTarget] = useState<Booking | null>(null);
  const [inquiryChatTarget, setInquiryChatTarget] = useState<any | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const deleteInquiryChat = async (chatId: string) => {
    if (!chatId || deletingInquiry) return;
    setDeletingInquiry(true);
    try {
      // Delete messages subcollection
      const messagesRef = collection(db, 'hotel_chats', chatId, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      const deletePromises = messagesSnap.docs.map(mDoc => deleteDoc(mDoc.ref));
      await Promise.all(deletePromises);

      // Delete the chat document
      await deleteDoc(doc(db, 'hotel_chats', chatId));

      setInquiryToDelete(null);
      toast.success('Chat history deleted successfully.');
    } catch (error) {
      console.error('Error deleting inquiry chat history:', error);
      toast.error('Failed to delete chat history.');
    } finally {
      setDeletingInquiry(false);
    }
  };

  const handleToggleOnlineStatus = async () => {
    if (!id || !hotel || togglingStatus) return;
    const newStatus = hotel.isOnline === false ? true : false;
    setTogglingStatus(true);
    try {
      await updateDoc(doc(db, 'hotels', id), { isOnline: newStatus });
      setHotel(prev => prev ? { ...prev, isOnline: newStatus } : null);
      setEditHotelData(prev => ({ ...prev, isOnline: newStatus }));
      if (newStatus) {
        toast.success(`${hotel.name} is now ONLINE! Guests will see you as available for live chat.`);
      } else {
        toast(`${hotel.name} is now OFFLINE. Out-of-office message is active.`, { icon: '🌙' });
      }
    } catch (err) {
      console.error('Error toggling online status:', err);
      toast.error('Failed to change online status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  // Fills the last crumb with the property's name once it has loaded.
  useBreadcrumbLabel(hotel?.name);

  useEffect(() => {
    if (authLoading) return;

    if (!user || (!isHotelManager(user) && !isAdmin(user))) {
      navigate('/');
      return;
    }

    let unsubInquiries: (() => void) | undefined;

    async function fetchData() {
      if (!id) return;
      try {
        const docRef = doc(db, 'hotels', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && (docSnap.data().managerId === user?.uid || isAdmin(user))) {
          const hData = { id: docSnap.id, ...docSnap.data() } as Hotel;
          setHotel(hData);
          setEditHotelData(hData);
          setRestaurant(hData.restaurant ?? null);
        } else {
          navigate(backUrl);
          return;
        }

        const roomsDocs = await getDocs(query(collection(db, 'room_types'), where('hotelId', '==', id)));
        setRooms(roomsDocs.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));

        // Kept out of the same Promise.all as the rooms: if the bookings read
        // is refused, the manager should still be able to edit their rooms and
        // rates rather than land on a blank page.
        try {
          const bookingsDocs = await getDocs(query(collection(db, 'bookings'), where('hotelId', '==', id)));
          setBookings(bookingsDocs.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
        } catch (bookingsError) {
          console.error('Could not load bookings for this property:', bookingsError);
          toast.error('Bookings could not be loaded. Property and room editing still work.');
        }

        try {
          const inquiriesQuery = query(
            collection(db, 'hotel_chats'),
            where('hotelId', '==', id)
          );
          unsubInquiries = onSnapshot(inquiriesQuery, (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setInquiries(docs);
          }, (err) => {
            console.error('Error listening to inquiries:', err);
          });
        } catch (inquiriesError) {
          console.error('Could not setup inquiries listener:', inquiriesError);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    return () => {
      if (unsubInquiries) unsubInquiries();
    };
  }, [id, user, authLoading, navigate]);

  // --- PERFORMANCE ---
  /**
   * Occupancy and revenue for the next 30 nights. Confirmed bookings only:
   * a pending request is not money, and counting it would overstate both.
   */
  const stats = useMemo(() => {
    const today = todayStr();
    const horizonEnd = addDays(today, 30);
    const totalUnits = rooms.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
    const confirmed = bookings.filter(b => b.status === 'confirmed');

    let occupiedNights = 0;
    for (const booking of confirmed) {
      if (!booking.checkIn || !booking.checkOut) continue;
      const nights = nightsInRange(booking.checkIn, booking.checkOut)
        .filter(night => night >= today && night < horizonEnd);
      occupiedNights += nights.length * (booking.quantity ?? 1);
    }

    const availableNights = totalUnits * 30;

    // Totals are kept per currency. Adding a kwacha booking to a dollar one
    // produces a number that means nothing, which is what a single running
    // total did once a property could sell in more than one currency.
    const sumByCurrency = (rows: Booking[]) => {
      const totals = new Map<string, number>();
      for (const b of rows) {
        const code = b.currency || 'USD';
        totals.set(code, (totals.get(code) ?? 0) + (b.total ?? 0));
      }
      return [...totals.entries()].sort((a, b) => b[1] - a[1]);
    };

    const upcomingRevenue = sumByCurrency(confirmed.filter(b => b.checkOut >= today));
    const allTimeRevenue = sumByCurrency(confirmed);
    const averageStay = confirmed.length
      ? confirmed.reduce((sum, b) => sum + nightsBetween(b.checkIn, b.checkOut), 0) / confirmed.length
      : 0;

    return {
      occupancy: availableNights > 0 ? (occupiedNights / availableNights) * 100 : 0,
      occupiedNights,
      availableNights,
      upcomingRevenue,
      allTimeRevenue,
      averageStay,
      pending: bookings.filter(b => b.status === 'pending').length,
      confirmedCount: confirmed.length,
    };
  }, [rooms, bookings]);

  const visibleBookings = useMemo(() => {
    const filtered = bookingFilter === 'all'
      ? bookings
      : bookingFilter === 'cancelled'
        ? bookings.filter(b => b.status === 'cancelled' || b.status === 'rejected')
        : bookings.filter(b => b.status === bookingFilter);
    // Copied before sorting: sorting `bookings` in place mutates React state.
    return [...filtered].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [bookings, bookingFilter]);

  const canSeeFinancials = hotel?.managerId === user?.uid;

  /** Downloads the property's bookings as CSV for accounting or a spreadsheet. */
  const exportBookingsCsv = () => {
    if (!bookings.length) {
      toast.error('There are no bookings to export.');
      return;
    }
    const columns = [
      'Reference', 'Status', 'Guest', 'Email', 'Phone', 'Room',
      'Check-in', 'Check-out', 'Nights', 'Guests', 'Rooms', 'Currency',
      ...(canSeeFinancials ? ['Total'] : []),
      'Booked on',
    ];
    // Quoted and doubled per RFC 4180 so a comma or quote in a name or a
    // special request cannot shift every later column.
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const rows = visibleBookings.map(b => [
      b.reference ?? b.id ?? '',
      b.status,
      b.guestName,
      b.guestEmail ?? '',
      b.guestPhone ?? '',
      rooms.find(r => r.id === b.roomTypeId)?.name ?? 'Unknown room',
      b.checkIn,
      b.checkOut,
      nightsBetween(b.checkIn, b.checkOut),
      b.guests,
      b.quantity ?? 1,
      b.currency ?? 'USD',
      ...(canSeeFinancials ? [b.total ?? 0] : []),
      b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : '',
    ].map(escape).join(','));

    const csv = [columns.map(escape).join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(hotel?.name ?? 'bookings').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-bookings.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} booking${rows.length === 1 ? '' : 's'}.`);
  };

  // --- HOTEL HANDLERS ---
  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !hotel) return;
    if (hasDetailProblem) {
      toast.error(Object.values(detailProblems).find(Boolean) ?? 'Check the highlighted fields.');
        setTimeout(() => document.querySelector('p[role="alert"].text-red-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
    }
    setSaving(true);
    try {
      // Amenities and the gallery are typed as comma-separated text in the UI
      // and stored as arrays.
      let amenities = editHotelData.amenities;
      if (typeof amenities === 'string') {
        amenities = (amenities as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      let galleryUrls = editHotelData.galleryUrls;
      if (typeof galleryUrls === 'string') {
        galleryUrls = (galleryUrls as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      const updateData: Record<string, unknown> = {
        ...editHotelData,
        amenities: amenities || [],
        galleryUrls: galleryUrls || [],
      };
      // The restaurant has its own save button, so it is never written from here.
      delete updateData.restaurant;
      // The document id, the owner and the moderation status are not editable
      // here. Previously the whole edit object was written back, which stored a
      // redundant `id` field inside the document and would have let a stale
      // `status` from page load overwrite an admin's decision.
      for (const field of HOTEL_READONLY_FIELDS) delete updateData[field];

      await updateDoc(doc(db, 'hotels', id), updateData);
      setHotel({ ...hotel, ...updateData } as Hotel);
      toast.success('Property details updated successfully!');
    } catch (error) {
      console.error("Error updating hotel:", error);
      toast.error('Failed to update property details.');
    } finally {
      setSaving(false);
    }
  };

  // Once a save has been refused, the messages follow the fields as they are
  // corrected, rather than waiting for another rejected submit to catch up.
  useEffect(() => {
    setRoomErrors(current => (hasErrors(current) ? validateRoom(editRoomData as any) : current));
  }, [editRoomData]);

  /**
   * The same rules the listing wizard applies, in `edit` mode — which drops
   * the minimums a listing might legitimately predate (an imported two-line
   * description, or no contact details at all) while still refusing anything
   * actually malformed. Refusing to save on a minimum would trap the owner of
   * an older listing out of changing anything at all.
   */
  const detailProblems = useMemo(
    () => validateProperty(editHotelData as any, 'edit'),
    [editHotelData]
  );

  const hasDetailProblem = Object.values(detailProblems).some(Boolean);
  /** Kept as a name for the contact block below, which reads better for it. */
  const contactProblems = detailProblems;

  /** Unsaved work, per tab. Each editor holds local state until it is saved. */
  const hotelDirty = !!hotel && hotelFormSnapshot(editHotelData) !== hotelFormSnapshot(hotel);
  const restaurantDirty =
    JSON.stringify(restaurant ?? null) !== JSON.stringify(hotel?.restaurant ?? null);
  const roomDirty = editingRoomId !== null;

  const dirtyOn = (tab: Tab) =>
    tab === 'details' ? hotelDirty : tab === 'rooms' ? roomDirty : tab === 'restaurant' ? restaurantDirty : false;

  const goToTab = (tab: Tab) => {
    setSearchParams(tab === 'details' ? {} : { tab }, { replace: false });
  };

  /** Switching away from unsaved work asks first rather than discarding it. */
  const requestTab = (tab: Tab) => {
    if (tab === activeTab) return;
    if (dirtyOn(activeTab)) {
      setPendingTab(tab);
      return;
    }
    goToTab(tab);
  };

  const discardAndSwitch = () => {
    if (!pendingTab || !hotel) return;
    if (activeTab === 'details') setEditHotelData(hotel);
    if (activeTab === 'restaurant') setRestaurant(hotel.restaurant ?? null);
    if (activeTab === 'rooms') { setEditingRoomId(null); setShowAddRoom(false); }
    goToTab(pendingTab);
    setPendingTab(null);
  };

  // Closing or reloading the tab with unsaved work gets the browser's own
  // warning; nothing here can be recovered once the page is gone.
  useEffect(() => {
    if (!hotelDirty && !restaurantDirty && !roomDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hotelDirty, restaurantDirty, roomDirty]);

  /** Currencies the property's rooms are sold in, reused for menu prices. */
  const propertyCurrencies = useMemo(() => {
    const offered = currenciesForRooms(rooms);
    return offered.length > 0 ? offered : (['USD'] as CurrencyCode[]);
  }, [rooms]);

  const handleSaveRestaurant = async () => {
    if (!id || !hotel || !restaurant) return;
    setSavingRestaurant(true);
    try {
      // Blank dishes are dropped rather than published as empty rows.
      const cleaned: Restaurant = {
        ...restaurant,
        sections: restaurant.sections
          .map(section => ({
            ...section,
            name: section.name.trim() || 'Untitled section',
            items: section.items
              .filter(item => item.name.trim().length > 0)
              .map(item => ({
                ...item,
                name: item.name.trim(),
                description: item.description?.trim() || '',
                prices: Object.fromEntries(
                  Object.entries(item.prices ?? {}).filter(([, amount]) => Number(amount) > 0)
                ),
              })),
          }))
          .filter(section => section.items.length > 0 || section.name.trim().length > 0),
      };

      await updateDoc(doc(db, 'hotels', id), { restaurant: cleaned });
      setHotel({ ...hotel, restaurant: cleaned });
      setRestaurant(cleaned);
      toast.success(cleaned.enabled ? 'Menu saved and published.' : 'Menu saved. The tab is hidden from guests.');
    } catch (error) {
      console.error('Error saving restaurant:', error);
      toast.error('Could not save the menu.');
    } finally {
      setSavingRestaurant(false);
    }
  };

  // --- ROOM HANDLERS ---
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    // Every problem at once, keyed by field, rather than a run of early
    // returns that each fired a toast and stopped at the first one.
    const problems = validateRoom(editRoomData as any);
    if (hasErrors(problems)) {
      setRoomErrors(problems);
      toast.error(firstError(problems) ?? 'Check the highlighted fields.');
        setTimeout(() => document.querySelector('p[role="alert"].text-red-600')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
    }
    setRoomErrors({});

    const currencies = (editRoomData.currencies ?? []).filter(c => CURRENCY_CODES.includes(c));
    const maxGuests = Number(editRoomData.maxGuests ?? 0);
    const quantity = Number(editRoomData.quantity ?? 0);
    const baseGuests = Number(editRoomData.baseGuests ?? maxGuests);
    const prices = editRoomData.prices ?? {};

    let blockedDates = editRoomData.blockedDates;
    if (typeof blockedDates === 'string') {
      blockedDates = (blockedDates as string).split(',').map(s => s.trim()).filter(Boolean);
    }
    setSaving(true);
    try {
      let amenities = editRoomData.amenities;
      if (typeof amenities === 'string') {
        amenities = (amenities as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      let galleryUrls = editRoomData.galleryUrls;
      if (typeof galleryUrls === 'string') {
        galleryUrls = (galleryUrls as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      // Only the chosen currencies are stored, so removing one actually
      // withdraws the price rather than leaving a stale amount behind.
      const keep = (map: PriceMap | undefined): PriceMap =>
        Object.fromEntries(
          currencies
            .map(code => [code, Number(map?.[code] ?? 0)])
            .filter(([, value]) => Number(value) > 0)
        );

      const priceMap = keep(prices);
      const primary = currencies[0];

      const roomPayload = {
        ...editRoomData,
        hotelId: id,
        currencies,
        prices: priceMap,
        extraGuestFees: keep(editRoomData.extraGuestFees),
        packages: (editRoomData.packages ?? []).map(pkg => ({
          ...pkg,
          prices: keep(pkg.prices),
          // Legacy mirror, in the primary currency.
          price: Number(pkg.prices?.[primary] ?? pkg.price ?? 0),
        })),
        maxGuests,
        quantity,
        baseGuests,
        currency: primary,
        // Legacy mirrors so anything still reading the old fields is correct.
        price: Number(priceMap[primary] ?? 0),
        priceMWK: Number(priceMap.MWK ?? 0),
        showDualCurrency: currencies.length > 1,
        extraGuestFee: Number(editRoomData.extraGuestFees?.[primary] ?? 0),
        amenities: amenities || [],
        galleryUrls: galleryUrls || [],
        blockedDates: [...new Set(blockedDates ?? [])].sort(),
      } as Record<string, unknown>;
      delete roomPayload.id;

      if (editingRoomId === 'new') {
        const docRef = await addDoc(collection(db, 'room_types'), roomPayload);
        setRooms([...rooms, { id: docRef.id, ...roomPayload } as RoomType]);
        setShowAddRoom(false);
      } else if (editingRoomId) {
        await updateDoc(doc(db, 'room_types', editingRoomId), roomPayload);
        setRooms(rooms.map(r => r.id === editingRoomId ? { ...r, ...roomPayload } as RoomType : r));
      }
      toast.success('Room saved.');
      setEditingRoomId(null);
    } catch (error) {
      console.error("Error saving room:", error);
      toast.error('Failed to save room.');
    } finally {
      setSaving(false);
    }
  };

  const startEditRoom = (room: RoomType) => {
    setRoomErrors({});
    // Legacy rooms have no `prices` map, so it is derived from whatever they do
    // have; the editor then only ever deals in the map.
    const currencies = roomCurrencies(room);
    setEditRoomData({
      ...room,
      currencies,
      prices: Object.fromEntries(
        currencies.map(code => [code, roomPrice(room, code) ?? 0])
      ),
      extraGuestFees: room.extraGuestFees ?? (
        room.extraGuestFee ? { [currencies[0]]: room.extraGuestFee } : {}
      ),
      packages: (room.packages ?? []).map(pkg => ({
        ...pkg,
        prices: pkg.prices ?? { [currencies[0]]: pkg.price ?? 0 },
      })),
      amenities: room.amenities?.join(', ') as any,
      // Kept as an array so the calendar can toggle entries directly.
      blockedDates: [...(room.blockedDates ?? [])],
    });
    setEditingRoomId(room.id!);
  };

  const startNewRoom = () => {
    setRoomErrors({});
    setEditRoomData({
      name: '',
      description: '',
      currencies: ['USD'],
      prices: { USD: 0 },
      extraGuestFees: {},
      price: 0,
      maxGuests: 2,
      baseGuests: 2,
      quantity: 5,
      currency: 'USD',
      imageUrl: '',
      galleryUrls: [],
      amenities: '' as any,
      blockedDates: [],
      packages: []
    });
    setEditingRoomId('new');
    setShowAddRoom(true);
  };

  const cancelEditRoom = () => {
    setRoomErrors({});
    setEditingRoomId(null);
    setShowAddRoom(false);
  };

  /** Sets one currency's amount on one of the room's price maps. */
  const setPriceField = (field: 'prices' | 'extraGuestFees', code: CurrencyCode, value: number) => {
    setEditRoomData(prev => ({ ...prev, [field]: { ...(prev[field] ?? {}), [code]: value } }));
  };

  /**
   * Adding a currency seeds an empty amount so the field appears; removing one
   * drops its amounts, since a currency you no longer sell in should not keep
   * a price sitting behind it.
   */
  const toggleCurrency = (code: CurrencyCode) => {
    setEditRoomData(prev => {
      const current = prev.currencies ?? [];
      if (current.includes(code)) {
        if (current.length === 1) return prev; // one currency must remain
        const drop = (map: PriceMap | undefined) => {
          const next = { ...(map ?? {}) };
          delete next[code];
          return next;
        };
        return {
          ...prev,
          currencies: current.filter(c => c !== code),
          prices: drop(prev.prices),
          extraGuestFees: drop(prev.extraGuestFees),
          packages: (prev.packages ?? []).map(pkg => ({ ...pkg, prices: drop(pkg.prices) })),
        };
      }
      return {
        ...prev,
        currencies: CURRENCY_CODES.filter(c => current.includes(c) || c === code),
        prices: { ...(prev.prices ?? {}), [code]: 0 },
      };
    });
  };

  /** Currencies currently selected for the room being edited, in a fixed order. */
  const editingCurrencies = CURRENCY_CODES.filter(c => (editRoomData.currencies ?? []).includes(c));

  /** Adds or removes one date from the room being edited. */
  const toggleBlockedDate = (date: string) => {
    const qty = editRoomData.quantity ?? 1;
    if (qty <= 1) {
      // For single-unit rooms, just toggle as before
      setEditRoomData(prev => {
        const current = Array.isArray(prev.blockedDates) ? prev.blockedDates : [];
        const next = current.includes(date)
          ? current.filter(d => d !== date)
          : [...current, date].sort();
        return { ...prev, blockedDates: next };
      });
      return;
    }

    // For multi-unit rooms, prompt for the number of units to block
    const currentFullyBlocked = (editRoomData.blockedDates ?? []).includes(date);
    const currentBlockedUnits = editRoomData.blockedUnits?.[date] ?? 0;
    
    const displayValue = currentFullyBlocked ? 'all' : (currentBlockedUnits > 0 ? currentBlockedUnits.toString() : '0');
    const result = window.prompt(
      `How many rooms do you want to block on ${formatDateStr(date, { month: 'short', day: 'numeric', year: 'numeric' })}?\n(Enter 0 to unblock, or 'all' to block all ${qty} rooms)`,
      displayValue
    );

    if (result === null) return; // cancelled

    const input = result.trim().toLowerCase();
    
    setEditRoomData(prev => {
      const nextDates = [...(prev.blockedDates ?? [])];
      const nextUnits = { ...(prev.blockedUnits ?? {}) };
      
      if (input === '0' || input === '') {
        // Unblock
        const datesFiltered = nextDates.filter(d => d !== date);
        delete nextUnits[date];
        return { ...prev, blockedDates: datesFiltered, blockedUnits: nextUnits };
      }
      
      if (input === 'all' || parseInt(input, 10) >= qty) {
        // Fully block
        if (!nextDates.includes(date)) nextDates.push(date);
        delete nextUnits[date];
        return { ...prev, blockedDates: nextDates.sort(), blockedUnits: nextUnits };
      }
      
      const parsed = parseInt(input, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < qty) {
        // Partially block
        const datesFiltered = nextDates.filter(d => d !== date);
        nextUnits[date] = parsed;
        return { ...prev, blockedDates: datesFiltered, blockedUnits: nextUnits };
      }
      
      // Invalid input, do nothing
      return prev;
    });
  };

  const toggleRoomAvailability = async (room: RoomType) => {
    try {
      // Taking a room off sale remembers its real inventory so putting it back
      // restores that number. It used to reset to a hard-coded 5, silently
      // rewriting the property's stock.
      const takingOffSale = (room.quantity ?? 0) > 0;
      const restored = room.previousQuantity && room.previousQuantity > 0 ? room.previousQuantity : 1;
      const update = takingOffSale
        ? { quantity: 0, previousQuantity: room.quantity }
        : { quantity: restored };

      await updateDoc(doc(db, 'room_types', room.id!), update);
      setRooms(rooms.map(r => r.id === room.id ? { ...r, ...update } : r));
      toast.success(takingOffSale ? `${room.name} is no longer bookable.` : `${room.name} is bookable again.`);
    } catch (error) {
      console.error("Error blocking room:", error);
      toast.error('Could not change availability.');
    }
  };

  // --- BOOKING HANDLERS ---
  const updateBookingStatus = async (bookingId: string, status: 'confirmed' | 'rejected' | 'cancelled') => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Confirming commits inventory, so availability is re-checked against every
    // other live booking first. Nothing stopped a manager confirming two
    // overlapping requests for the same single room.
    if (status === 'confirmed') {
      const room = rooms.find(r => r.id === booking.roomTypeId);
      if (room) {
        const others = bookings.filter(b => b.id !== bookingId);
        if (!isRoomAvailable(room, others, booking.checkIn, booking.checkOut, booking.quantity ?? 1)) {
          toast.error(`${room.name} is already fully committed for ${formatDateStr(booking.checkIn)} – ${formatDateStr(booking.checkOut)}.`);
          setConfirmModalBooking(null);
          return;
        }
      }
    }

    try {
      const patch: Record<string, unknown> = { status, updatedAt: Date.now() };
      if (status === 'cancelled') {
        patch.cancelledAt = Date.now();
        patch.cancelledBy = 'manager';
      }
      await updateDoc(doc(db, 'bookings', bookingId), patch);
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, ...patch } as Booking : b));
      setConfirmModalBooking(null);
      toast.success(
        status === 'confirmed' ? 'Booking confirmed.' :
        status === 'rejected' ? 'Booking declined.' : 'Booking cancelled.'
      );
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error('Could not update this booking.');
    }
  };

  const deleteBooking = async (bookingId: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      setBookings(bookings.filter(b => b.id !== bookingId));
      toast.success('Booking deleted.');
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error('Failed to delete booking.');
    }
  };

  if (loading) return <div className="p-8 text-center text-stone-500">Loading...</div>;
  if (!hotel) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
      {/* There was no route back: a manager with several properties had to use
          the browser's back button to reach their dashboard again. */}
      <Link
        to={backUrl}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> All properties
      </Link>

      <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-stone-900">{hotel.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
            <p className="text-stone-500 text-lg">{hotel.location}</p>
            <a
              href={`/hotel/${hotel.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-emerald-700 transition"
            >
              View live listing <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* 1-Click Live Status Switch */}
          <button
            type="button"
            onClick={handleToggleOnlineStatus}
            disabled={togglingStatus}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition shadow-xs ${
              hotel.isOnline !== false
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
            }`}
            title="Toggle whether guests see you as Online or Away"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${hotel.isOnline !== false ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
            <span>{hotel.isOnline !== false ? 'Host Online' : 'Host Offline (Away)'}</span>
            <span className="text-[10px] font-semibold text-stone-500 bg-white/80 px-1.5 py-0.5 rounded-full ml-1">Toggle</span>
          </button>

          {hotel.status === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5" /> Awaiting approval
            </span>
          ) : hotel.status === 'rejected' ? (
            <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
              <XCircle className="h-3.5 w-3.5" /> Not published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="h-3.5 w-3.5" /> Live on Travel-Malawi
            </span>
          )}
        </div>
      </div>

      {hotel.status && hotel.status !== 'approved' && (
        <div className="mb-8 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-6 py-4 text-sm">
          {hotel.status === 'pending'
            ? 'This listing is not yet visible to travellers. Our team reviews new properties before they go live — adding rooms and photos now means it can start taking bookings the moment it is approved.'
            : 'This listing is not currently published. Contact the Travel-Malawi team if you believe this is a mistake.'}
        </div>
      )}

      {/* Performance snapshot */}
      {user?.uid === hotel.managerId && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <Percent className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Occupancy · 30d</span>
            </div>
            <p className="text-3xl font-serif font-bold text-stone-900">{stats.occupancy.toFixed(0)}%</p>
            <p className="text-xs text-stone-400 mt-1">{stats.occupiedNights} of {stats.availableNights} room-nights</p>
          </div>
          {canSeeFinancials && (
            <>
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-stone-400 mb-2">
                  <Wallet className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Upcoming revenue</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {stats.upcomingRevenue.length === 0
                    ? <p className="text-3xl font-serif font-bold text-stone-900">&mdash;</p>
                    : stats.upcomingRevenue.map(([code, total]) => (
                        <p key={code} className="text-3xl font-serif font-bold text-stone-900">{formatMoney(total, code)}</p>
                      ))}
                </div>
                <p className="text-xs text-stone-400 mt-1">Confirmed stays not yet completed</p>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-stone-400 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">All-time revenue</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {stats.allTimeRevenue.length === 0
                    ? <p className="text-3xl font-serif font-bold text-stone-900">&mdash;</p>
                    : stats.allTimeRevenue.map(([code, total]) => (
                        <p key={code} className="text-3xl font-serif font-bold text-stone-900">{formatMoney(total, code)}</p>
                      ))}
                </div>
                <p className="text-xs text-stone-400 mt-1">{stats.confirmedCount} confirmed booking{stats.confirmedCount === 1 ? '' : 's'}</p>
              </div>
            </>
          )}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Awaiting reply</span>
            </div>
            <p className="text-3xl font-serif font-bold text-stone-900">{stats.pending}</p>
            <p className="text-xs text-stone-400 mt-1">Avg stay {stats.averageStay.toFixed(1)} nights</p>
          </div>
        </div>
      )}
      <div className="flex gap-1 border-b border-stone-200 mb-8 overflow-x-auto scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">
        {([
          { id: 'details' as Tab, label: 'Property details', icon: Building },
          { id: 'rooms' as Tab, label: 'Rooms & pricing', icon: BedDouble },
          { id: 'restaurant' as Tab, label: 'Restaurant', icon: UtensilsCrossed },
          { id: 'bookings' as Tab, label: 'Bookings', icon: Calendar },
          { id: 'inquiries' as Tab, label: 'Inquiries', icon: MessageSquare },
        ]).map(tab => {
          const Icon = tab.icon;
          const pendingCount = tab.id === 'bookings' ? bookings.filter(b => b.status === 'pending').length : 0;
          const unreadInquiryCount = tab.id === 'inquiries' ? inquiries.filter(i => 
            i.lastSenderId !== user?.uid && 
            i.updatedAt && 
            (!i.managerLastOpenedAt || i.updatedAt > i.managerLastOpenedAt)
          ).length : 0;
          
          return (
            <button
              key={tab.id}
              onClick={() => requestTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" /> {tab.label}
              {dirtyOn(tab.id) && (
                <span title="Unsaved changes" className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              )}
              {tab.id === 'restaurant' && hotel.restaurant?.enabled && (
                <span className="bg-emerald-100 text-emerald-700 text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full uppercase">Live</span>
              )}
              {pendingCount > 0 && (
                <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingCount}</span>
              )}
              {unreadInquiryCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">
                  {unreadInquiryCount} new
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: DETAILS */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* LIVE PREVIEW: How your images look to guests */}
          {(editHotelData.imageUrl || (editHotelData.galleryUrls && editHotelData.galleryUrls.length > 0) || rooms.some(r => r.imageUrl)) && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 p-5 sm:p-6 md:p-8 shadow-sm">
              <h3 className="text-lg font-serif font-bold text-stone-900 mb-6">How your photos look to guests</h3>
              
              {/* Property Gallery */}
              {(editHotelData.imageUrl || (editHotelData.galleryUrls && editHotelData.galleryUrls.length > 0)) && (
                <div className="mb-8">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Property Gallery</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {editHotelData.imageUrl && (
                      <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-emerald-400">
                        <SmartImage src={editHotelData.imageUrl} alt="Main" className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Main</span>
                      </div>
                    )}
                    {(editHotelData.galleryUrls || []).map((url, idx) => (
                      <div key={`gal-${idx}`} className="relative aspect-video rounded-xl overflow-hidden border border-stone-200">
                        <SmartImage src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 bg-stone-900/70 text-white text-[10px] px-2 py-0.5 rounded-full">Gallery</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Room Images */}
              {rooms.some(r => r.imageUrl || (r.galleryUrls && r.galleryUrls.length > 0)) && (
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Room Images</p>
                  <div className="space-y-6">
                    {rooms.filter(r => r.imageUrl || (r.galleryUrls && r.galleryUrls.length > 0)).map(room => (
                      <div key={`room-preview-${room.id}`} className="space-y-3">
                        <p className="text-sm font-bold text-stone-700">{room.name}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {room.imageUrl && (
                            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-blue-400">
                              <SmartImage src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                              <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm">Room Main</span>
                            </div>
                          )}
                          {(room.galleryUrls || []).map((url, idx) => (
                            <div key={`room-${room.id}-gal-${idx}`} className="relative aspect-video rounded-xl overflow-hidden border border-stone-200">
                              <SmartImage src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                              <span className="absolute top-2 left-2 bg-stone-900/70 text-white text-[10px] px-2 py-0.5 rounded-md">Gallery</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 p-5 sm:p-6 md:p-8 shadow-sm">
          <form onSubmit={handleSaveHotel} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Property Name</label>
                <input type="text" required value={editHotelData.name || ''} readOnly disabled className="w-full bg-stone-200 border border-stone-300 p-3 rounded-xl outline-none text-stone-500 cursor-not-allowed" />
                <p className="text-xs text-stone-400 mt-1">Property name cannot be changed after registration. Contact admin for assistance.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Description</label>
                <textarea required rows={4} value={editHotelData.description || ''} onChange={e => setEditHotelData({...editHotelData, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                <FieldError message={detailProblems.description} />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Location</label>
                <div className="flex gap-2">
                  <input type="text" required value={editHotelData.location || ''} onChange={e => setEditHotelData({...editHotelData, location: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="e.g. Area 43, Lilongwe" />
                  <FieldError message={detailProblems.location} />
                </div>
              </div>
              {/* Nothing could edit a pin once a listing existed — it could
                  only be dropped at creation, by standing at the property. An
                  admin correcting someone else's listing had no way in at all. */}
              <div className="md:col-span-2">
                <LocationPicker
                  value={editHotelData.coordinates ?? null}
                  onChange={coordinates => setEditHotelData({ ...editHotelData, coordinates: coordinates ?? undefined })}
                  locationText={editHotelData.location}
                  onLocationSelect={info => {
                    if (info.location) {
                      setEditHotelData(prev => ({
                        ...prev,
                        location: prev.location || info.location || prev.location,
                      }));
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Location Notes / Directions</label>
                <textarea rows={2} value={editHotelData.locationNotes || ''} onChange={e => setEditHotelData({...editHotelData, locationNotes: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="Any extra directions or notes to help guests find the property (optional)." />
              </div>
              <div>
                <ImageUpload
                  label="Main Property Image"
                  value={editHotelData.imageUrl || ''}
                  onChange={(url) => setEditHotelData({ ...editHotelData, imageUrl: url })}
                  folder={`hotels/${id}`}
                />
                <FieldError message={detailProblems.imageUrl} />
              </div>
              <div className="md:col-span-2">
                <GalleryUpload 
                  value={editHotelData.galleryUrls || []} 
                  onChange={(urls) => setEditHotelData({ ...editHotelData, galleryUrls: urls })} 
                  label="Property Gallery"
                  folder={`hotels/${id}/gallery`}
                />
              </div>
              {/* The category decides which home-page filter the listing shows
                  under. It could be set nowhere at all, so every property
                  created through the app was unreachable from the filter row. */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_CATEGORIES.map(category => {
                    const selected = (editHotelData.categories ?? []).includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setEditHotelData({
                          ...editHotelData,
                          categories: selected
                            ? (editHotelData.categories ?? []).filter(c => c !== category)
                            : [...(editHotelData.categories ?? []), category],
                        })}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          selected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-stone-400 mt-2">Guests filter by this. Pick every one that genuinely fits.</p>
                <FieldError message={detailProblems.category} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Amenities (comma separated)</label>
                <input type="text" value={Array.isArray(editHotelData.amenities) ? editHotelData.amenities.join(', ') : editHotelData.amenities || ''} onChange={e => setEditHotelData({...editHotelData, amenities: e.target.value as any})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="WiFi, Pool, Spa..." />
              </div>

              {/* A listing held no way of reaching the property at all, so the
                  page promised a host who confirms "by phone or WhatsApp"
                  without carrying either. */}
              <div className="md:col-span-2 pt-6 border-t border-stone-100">
                <h4 className="font-serif font-bold text-stone-900 mb-1">How guests reach you</h4>
                <p className="text-sm text-stone-500 mb-5">
                  Shown on your listing and quoted back on every booking request.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Booking email</label>
                    <input
                      type="email"
                      value={editHotelData.contactEmail ?? ''}
                      onChange={e => setEditHotelData({ ...editHotelData, contactEmail: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition"
                      placeholder="reservations@yourlodge.mw"
                    />
                    <FieldError message={contactProblems.contactEmail} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Phone</label>
                    <input
                      type="tel"
                      value={editHotelData.contactPhone ?? ''}
                      onChange={e => setEditHotelData({ ...editHotelData, contactPhone: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition"
                      placeholder="+265 991 234 567"
                    />
                    <FieldError message={contactProblems.contactPhone} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">WhatsApp</label>
                    <input
                      type="tel"
                      value={editHotelData.contactWhatsapp ?? ''}
                      onChange={e => setEditHotelData({ ...editHotelData, contactWhatsapp: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition"
                      placeholder="Same as phone"
                    />
                    <FieldError message={contactProblems.contactWhatsapp} />
                  </div>
                </div>
              </div>

              {/* These were hard-coded as "From 14:00" and "Until 11:00" on
                  every listing, whatever the property actually did. */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Check-in from</label>
                <input
                  type="time"
                  value={editHotelData.checkInTime ?? '14:00'}
                  onChange={e => setEditHotelData({ ...editHotelData, checkInTime: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition"
                />
                <FieldError message={detailProblems.checkInTime} />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Check-out until</label>
                <input
                  type="time"
                  value={editHotelData.checkOutTime ?? '11:00'}
                  onChange={e => setEditHotelData({ ...editHotelData, checkOutTime: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition"
                />
                <FieldError message={detailProblems.checkOutTime} />
              </div>

              <div className="md:col-span-2 pt-6 border-t border-stone-100">
                <h4 className="font-serif font-bold text-stone-900 mb-4">Guest Messaging</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    {hotel?.adminChatEnabled === false && !isAdmin(user) && (
                      <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
                        <strong>Premium Feature:</strong> Chat capabilities have been disabled for this listing by an administrator. Please contact support to upgrade or re-enable.
                      </div>
                    )}
                    
                    {isAdmin(user) && (
                      <label className="flex items-center gap-3 cursor-pointer mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <input 
                          type="checkbox" 
                          checked={editHotelData.adminChatEnabled !== false} 
                          onChange={(e) => setEditHotelData({...editHotelData, adminChatEnabled: e.target.checked})}
                          className="w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-600"
                        />
                        <span className="font-bold text-red-900">Admin: Enable Chat Service Globally</span>
                      </label>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer mb-6">
                      <input 
                        type="checkbox" 
                        checked={editHotelData.chatEnabled !== false} 
                        onChange={(e) => setEditHotelData({...editHotelData, chatEnabled: e.target.checked})}
                        className="w-5 h-5 text-stone-900 border-stone-300 rounded focus:ring-stone-900 disabled:opacity-50"
                        disabled={editHotelData.adminChatEnabled === false}
                      />
                      <span className={`font-medium ${editHotelData.adminChatEnabled === false ? 'text-stone-400' : 'text-stone-700'}`}>Enable Pre-booking Chat</span>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer mb-6 ml-8">
                      <input 
                        type="checkbox" 
                        checked={editHotelData.callsEnabled !== false} 
                        onChange={(e) => setEditHotelData({...editHotelData, callsEnabled: e.target.checked})}
                        className="w-5 h-5 text-stone-900 border-stone-300 rounded focus:ring-stone-900 disabled:opacity-50"
                        disabled={editHotelData.chatEnabled === false || editHotelData.adminChatEnabled === false}
                      />
                      <span className={`font-medium ${editHotelData.chatEnabled === false || editHotelData.adminChatEnabled === false ? 'text-stone-400' : 'text-stone-700'}`}>Allow Voice/Video Calls</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editHotelData.isOnline ?? true} 
                        onChange={(e) => setEditHotelData({...editHotelData, isOnline: e.target.checked})}
                        className="w-5 h-5 text-emerald-600 border-stone-300 rounded focus:ring-emerald-600 disabled:opacity-50"
                        disabled={editHotelData.chatEnabled === false || editHotelData.adminChatEnabled === false}
                      />
                      <span className={`font-medium ${editHotelData.chatEnabled === false || editHotelData.adminChatEnabled === false ? 'text-stone-400' : 'text-stone-700'}`}>Show as "Online"</span>
                    </label>
                    <p className="text-xs text-stone-500 mt-2 ml-8">When offline, your out-of-office message is shown.</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Out of office message</label>
                    <textarea 
                      value={editHotelData.outOfOfficeMessage || ''} 
                      onChange={e => setEditHotelData({...editHotelData, outOfOfficeMessage: e.target.value})}
                      disabled={editHotelData.chatEnabled === false || editHotelData.adminChatEnabled === false || editHotelData.isOnline === true}
                      className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition h-24 resize-none disabled:opacity-50"
                      placeholder="We're currently away. Leave a message and we'll reply soon!" 
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 pt-6 border-t border-stone-100">
                <OpeningHoursEditor
                  value={editHotelData.hours}
                  onChange={hours => setEditHotelData({ ...editHotelData, hours })}
                  label="Reception / property hours"
                  hint="Shown to guests on your listing. Leave unset to publish no hours."
                />
              </div>
            </div>
            {/* Pinned: this form is long enough that the save button used to
                sit well below the fold with no sign it was there. */}
            <div className="sticky bottom-0 -mx-8 -mb-8 px-8 py-4 bg-white/95 backdrop-blur border-t border-stone-100 flex items-center justify-between gap-4 rounded-b-3xl">
              <p className="text-sm text-stone-500">
                {hotelDirty ? 'Unsaved changes' : 'Everything is saved'}
              </p>
              <div className="flex items-center gap-3">
                {hotelDirty && (
                  <button
                    type="button"
                    onClick={() => setEditHotelData(hotel)}
                    className="px-5 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-100 transition"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !hotelDirty}
                  className="flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save details'}
                </button>
              </div>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* TAB CONTENT: ROOMS */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-stone-500">Manage your room inventory, pricing, and availability.</p>
            {!editingRoomId && (
              <button onClick={startNewRoom} className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition">
                <Plus className="h-4 w-4" /> Add Room
              </button>
            )}
          </div>

          {editingRoomId && (
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-xl text-stone-900">{editingRoomId === 'new' ? 'New Room Type' : 'Edit Room'}</h3>
                <button onClick={cancelEditRoom} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition"><X className="h-5 w-5" /></button>
              </div>
              
              <form onSubmit={handleSaveRoom} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Room Name</label>
                    <input type="text" required value={editRoomData.name || ''} onChange={e => setEditRoomData({...editRoomData, name: e.target.value})} className={`w-full bg-stone-50 border p-3 rounded-xl outline-none transition ${roomErrors.name ? 'border-red-300 focus:border-red-500' : 'border-stone-200 focus:border-stone-900'}`} />
                    <FieldError message={roomErrors.name} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea required rows={3} value={editRoomData.description || ''} onChange={e => setEditRoomData({...editRoomData, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />
                    <FieldError message={roomErrors.description} />
                  </div>
                    <div className="md:col-span-2">
                      <ImageUpload
                        label="Room Main Image"
                        value={editRoomData.imageUrl || ''}
                        onChange={(url) => setEditRoomData({...editRoomData, imageUrl: url})}
                        folder={`hotels/${id}/rooms`}
                      />
                    </div>
                  {/* `room_gallery` was not one of the folders the storage rules
                      allow, so every room-gallery upload was refused outright.
                      Room photographs belong with the room's main image. */}
                  <div className="md:col-span-2">
                    <GalleryUpload
                      value={editRoomData.galleryUrls || []}
                      onChange={(urls) => setEditRoomData({ ...editRoomData, galleryUrls: urls })}
                      label="Room Gallery"
                      folder={`hotels/${id}/rooms`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Currencies you sell this room in</label>
                    <FieldError message={roomErrors.currencies} />
                    <FieldError message={roomErrors.prices} />
                    <FieldError message={roomErrors.extraGuestFees} />
                    <div className="flex flex-wrap gap-2 mb-1">
                      {CURRENCY_CODES.map(code => {
                        const selected = editingCurrencies.includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleCurrency(code)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                              selected
                                ? 'border-stone-900 bg-stone-900 text-white'
                                : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-400'
                            }`}
                          >
                            {CURRENCIES[code].symbol} {CURRENCIES[code].label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-stone-400">
                      Set your own price in each. Nothing is converted &mdash; guests pay the
                      amount you enter, in the currency they choose.
                      {editingCurrencies.length > 1 && ` ${CURRENCIES[editingCurrencies[0]].label} is shown by default.`}
                    </p>
                  </div>

                  {editingCurrencies.map(code => (
                    <React.Fragment key={code}>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                          Nightly rate &middot; {CURRENCIES[code].label}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium pointer-events-none">
                            {CURRENCIES[code].symbol}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step={CURRENCIES[code].step}
                            required
                            value={editRoomData.prices?.[code] ?? 0}
                            onChange={e => setPriceField('prices', code, Number(e.target.value))}
                            className="w-full bg-stone-50 border border-stone-200 p-3 pl-10 rounded-xl outline-none focus:border-stone-900 transition"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                          Extra guest / night &middot; {CURRENCIES[code].label}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium pointer-events-none">
                            {CURRENCIES[code].symbol}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step={CURRENCIES[code].step}
                            value={editRoomData.extraGuestFees?.[code] ?? 0}
                            onChange={e => setPriceField('extraGuestFees', code, Number(e.target.value))}
                            className="w-full bg-stone-50 border border-stone-200 p-3 pl-10 rounded-xl outline-none focus:border-stone-900 transition"
                          />
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Max Guests</label>
                    <input type="number" required min={1} value={editRoomData.maxGuests || 2} onChange={e => setEditRoomData({...editRoomData, maxGuests: Number(e.target.value)})} className={`w-full bg-stone-50 border p-3 rounded-xl outline-none transition ${roomErrors.maxGuests ? 'border-red-300 focus:border-red-500' : 'border-stone-200 focus:border-stone-900'}`} />
                    <FieldError message={roomErrors.maxGuests} />
                    <FieldError message={roomErrors.baseGuests} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Total Rooms Available</label>
                    <input type="number" required min={0} value={editRoomData.quantity || 1} onChange={e => setEditRoomData({...editRoomData, quantity: Number(e.target.value)})} className={`w-full bg-stone-50 border p-3 rounded-xl outline-none transition ${roomErrors.quantity ? 'border-red-300 focus:border-red-500' : 'border-stone-200 focus:border-stone-900'}`} />
                    <FieldError message={roomErrors.quantity} />
                  </div>
                </div>

                {/* PACKAGES & INCLUSIONS */}
                <div className="border-t border-stone-200 pt-6">
                  <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-4">Room Packages & Inclusions</h4>
                  <FieldError message={roomErrors.packages} />
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { name: "Breakfast Included", price: 15, type: "per_person" as const },
                      { name: "All-Inclusive", price: 50, type: "per_person" as const },
                      { name: "Airport Shuttle", price: 30, type: "per_room" as const },
                      { name: "Gym Access", price: 10, type: "per_person" as const },
                      { name: "Kids Free (Under 12)", price: 0, type: "per_stay" as const },
                      { name: "Spa Access", price: 25, type: "per_person" as const },
                      { name: "WiFi Premium", price: 5, type: "per_room" as const },
                    ].filter(p => !(editRoomData.packages || []).some(ep => ep.name === p.name)).map(p => (
                      <button key={p.name} type="button" onClick={() => {
                        const pkgs = editRoomData.packages || [];
                        // The preset amounts are dollars; other currencies start
                        // blank for the manager to fill in.
                        const prices = editingCurrencies.includes('USD') ? { USD: p.price } : {};
                        setEditRoomData({...editRoomData, packages: [...pkgs, { id: Date.now().toString(), ...p, prices }]});
                      }} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-xs font-medium hover:bg-stone-200 transition border border-stone-200">
                        + {p.name}
                      </button>
                    ))}
                  </div>
                  {editRoomData.packages && editRoomData.packages.length > 0 && (
                    <div className="space-y-3">
                      {editRoomData.packages.map(pkg => (
                        <div key={pkg.id} className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100 flex-wrap">
                          <span className="flex-1 min-w-[8rem] font-medium text-sm">{pkg.name}</span>
                          {/* One field per currency: a package left at zero in a
                              currency is simply not offered to guests paying in it. */}
                          {editingCurrencies.map(code => (
                            <div key={code} className="flex items-center gap-1.5">
                              <span className="text-xs text-stone-500 w-6 text-right">{CURRENCIES[code].symbol}</span>
                              <input
                                type="number"
                                min="0"
                                step={CURRENCIES[code].step}
                                value={pkg.prices?.[code] ?? 0}
                                onChange={e => {
                                  const value = Number(e.target.value);
                                  const updated = editRoomData.packages!.map(p =>
                                    p.id === pkg.id ? { ...p, prices: { ...(p.prices ?? {}), [code]: value } } : p
                                  );
                                  setEditRoomData({ ...editRoomData, packages: updated });
                                }}
                                className="w-24 bg-white border border-stone-200 p-1.5 rounded-lg text-sm text-center outline-none focus:border-stone-900"
                              />
                            </div>
                          ))}
                          <select value={pkg.type} onChange={e => {
                            const updated = editRoomData.packages!.map(p => p.id === pkg.id ? {...p, type: e.target.value as any} : p);
                            setEditRoomData({...editRoomData, packages: updated});
                          }} className="bg-white border border-stone-200 p-1.5 rounded-lg text-xs outline-none focus:border-stone-900">
                            <option value="per_person">Per Person</option>
                            <option value="per_room">Per Room</option>
                            <option value="per_stay">Per Stay</option>
                          </select>
                          <button type="button" onClick={() => {
                            setEditRoomData({...editRoomData, packages: editRoomData.packages?.filter(p => p.id !== pkg.id)});
                          }} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BLOCKED DATES */}
                <div className="border-t border-stone-200 pt-6">
                  <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-2">Block Dates</h4>
                  <p className="text-xs text-stone-500 mb-4">
                    Take individual nights off sale — maintenance, an owner stay, a private hire.
                    Blocked nights cannot be booked by guests.
                  </p>

                  {editingRoomId === 'new' ? (
                    <p className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-xl p-4">
                      Save the room first, then reopen it to pick blocked dates on the calendar.
                    </p>
                  ) : (
                    <>
                      {/* Replaces a free-text list of comma-separated dates,
                          which accepted anything and showed no context. */}
                      <AvailabilityCalendar
                        hotelId={id!}
                        rooms={rooms}
                        selectedRoom={rooms.find(r => r.id === editingRoomId) ?? null}
                        blockedDates={(editRoomData.blockedDates as string[]) ?? []}
                        blockedUnits={editRoomData.blockedUnits ?? {}}
                        onToggleBlocked={toggleBlockedDate}
                      />
                      {((Array.isArray(editRoomData.blockedDates) && editRoomData.blockedDates.length > 0) || (Object.keys(editRoomData.blockedUnits ?? {}).length > 0)) && (
                        <div className="mt-4">
                          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                            Manual Blockages
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(editRoomData.blockedDates ?? []).map(date => (
                              <button
                                key={date}
                                type="button"
                                onClick={() => toggleBlockedDate(date)}
                                className="flex items-center gap-1.5 bg-stone-800 text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-red-600 transition"
                                title="Edit this date"
                              >
                                {formatDateStr(date, { month: 'short', day: 'numeric', year: 'numeric' })} (All)
                                <X className="w-3 h-3" />
                              </button>
                            ))}
                            {Object.entries(editRoomData.blockedUnits ?? {}).map(([date, count]) => (
                              <button
                                key={date}
                                type="button"
                                onClick={() => toggleBlockedDate(date)}
                                className="flex items-center gap-1.5 bg-stone-100 text-stone-800 border border-stone-200 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                                title="Edit this date"
                              >
                                {formatDateStr(date, { month: 'short', day: 'numeric', year: 'numeric' })} ({count} room{count === 1 ? '' : 's'})
                                <X className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-stone-400 mt-2">Changes are saved with the room.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* The room form runs past a packages list and a month
                    calendar, so its actions are pinned to the viewport. */}
                <div className="sticky bottom-0 -mx-8 -mb-8 px-8 py-4 bg-white/95 backdrop-blur border-t border-stone-100 flex items-center justify-end gap-3 rounded-b-3xl">
                  <button type="button" onClick={cancelEditRoom} className="px-6 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-100 transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-800 transition disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : editingRoomId === 'new' ? 'Add room' : 'Save room'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {!editingRoomId && rooms.length === 0 && (
            <div className="bg-stone-50 border border-stone-200 border-dashed rounded-3xl p-12 text-center text-stone-500">
              No rooms added yet. Click 'Add Room' to get started.
            </div>
          )}

          {!editingRoomId && rooms.map(room => (
            <div key={room.id} className={`bg-white border p-4 sm:p-6 rounded-3xl flex flex-col md:flex-row gap-4 sm:gap-6 items-stretch md:items-center shadow-sm transition ${room.quantity === 0 ? 'border-red-200 bg-red-50/30' : 'border-stone-200'}`}>
              <div className="w-full md:w-48 h-48 sm:h-40 md:h-36 bg-stone-100 rounded-2xl overflow-hidden shrink-0">
                <SmartImage src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 w-full flex flex-col justify-center">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-2">
                  <h4 className="text-xl font-serif font-bold text-stone-900 line-clamp-2 sm:line-clamp-1 pr-0 sm:pr-4">{room.name}</h4>
                  <div className="flex sm:flex-col gap-3 sm:gap-0 text-left sm:text-right items-baseline sm:items-end">
                    {roomCurrencies(room).map((code, i) => (
                      <div
                        key={code}
                        className={i === 0
                          ? 'text-xl font-serif font-bold text-stone-900 whitespace-nowrap'
                          : 'text-sm text-stone-500 font-medium whitespace-nowrap'}
                      >
                        {formatMoney(roomPrice(room, code) ?? 0, code)}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-stone-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  <span className="flex items-center gap-1.5 text-stone-600"><Users className="h-4 w-4" /> {room.maxGuests} Guests</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider ${room.quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {room.quantity > 0 ? `${room.quantity} Available` : 'Blocked'}
                  </span>
                
                  {room.packages && room.packages.length > 0 && room.packages.map(pkg => (
                    <span key={pkg.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{pkg.name}</span>
                  ))}
                </div>
              </div>
              <div className="flex md:flex-col w-full md:w-32 lg:w-40 gap-2 border-t md:border-t-0 md:border-l border-stone-100 pt-4 md:pt-0 md:pl-6 shrink-0 mt-2 md:mt-0 justify-center">
                <button 
                  onClick={() => startEditRoom(room)}
                  className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition text-sm font-semibold"
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </button>
                <button 
                  onClick={() => toggleRoomAvailability(room)}
                  className={`flex-1 md:w-full flex items-center justify-center px-4 py-3 md:py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition ${room.quantity === 0 ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
                >
                  {room.quantity === 0 ? 'Unblock' : 'Block'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: RESTAURANT */}
      {activeTab === 'restaurant' && (
        <div className="space-y-8">
          {!restaurant ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center">
              <UtensilsCrossed className="h-10 w-10 mx-auto mb-4 text-stone-300" />
              <h3 className="text-2xl font-serif text-stone-900 mb-2">No restaurant yet</h3>
              <p className="text-stone-500 max-w-md mx-auto mb-8">
                Add one to publish a menu on your listing. Guests get a Menu tab with the
                design you choose, priced in the same currencies as your rooms.
              </p>
              <button
                onClick={() => setRestaurant(emptyRestaurant())}
                className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition"
              >
                Add a restaurant
              </button>
            </div>
          ) : (
            <>
              <MenuEditor
                value={restaurant}
                onChange={setRestaurant}
                currencies={propertyCurrencies}
              />

              <div className="sticky bottom-4 z-10 bg-white/95 backdrop-blur border border-stone-200 shadow-lg rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-stone-500">
                  {restaurantDirty ? 'Unsaved changes to your menu' : 'Menu is saved'}
                </p>
                <div className="flex items-center gap-3">
                  {restaurantDirty && (
                    <button
                      onClick={() => setRestaurant(hotel.restaurant ?? null)}
                      className="px-5 py-2.5 rounded-xl font-medium text-stone-600 hover:bg-stone-100 transition"
                    >
                      Discard
                    </button>
                  )}
                  <button
                    onClick={handleSaveRestaurant}
                    disabled={savingRestaurant || !restaurantDirty}
                    className="flex items-center gap-2 bg-stone-900 text-white px-7 py-2.5 rounded-xl font-medium hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingRestaurant ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingRestaurant ? 'Saving…' : 'Save menu'}
                  </button>
                </div>
              </div>

              {restaurant.enabled && (
                <div>
                  <div className="flex items-center gap-2 mb-4 text-stone-500">
                    <Eye className="h-4 w-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Preview — {propertyCurrencies[0]} prices, as guests see it
                    </h3>
                  </div>
                  <MenuTemplateView
                    restaurant={restaurant}
                    currency={propertyCurrencies[0]}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 md:px-8 py-5 border-b border-stone-100">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'cancelled', label: 'Cancelled' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                  setBookingFilter(tab.key);
                  setCurrentBookingPage(1);
                }}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition ${
                    bookingFilter === tab.key
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={exportBookingsCsv}
              className="flex items-center gap-2 text-sm font-semibold text-stone-600 border border-stone-200 px-4 py-2 rounded-xl hover:bg-stone-50 hover:border-stone-400 transition shrink-0"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>

          {visibleBookings.length === 0 ? (
            <div className="p-16 text-center text-stone-400">
              <Calendar className="h-10 w-10 mx-auto mb-4 opacity-50 text-stone-300" />
              <p className="font-medium text-stone-500 text-lg">
                {bookings.length === 0 ? 'No bookings yet.' : 'Nothing in this view.'}
              </p>
              <p className="text-sm mt-1">
                {bookings.length === 0
                  ? 'When guests book your rooms, they will appear here.'
                  : 'Try a different filter above.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {visibleBookings.slice((currentBookingPage - 1) * bookingsPerPage, currentBookingPage * bookingsPerPage).map(booking => (
                <li key={booking.id} className="p-6 md:p-8 hover:bg-stone-50 transition">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="font-bold text-stone-900 text-lg">{booking.guestName}</span>
                        {booking.status !== 'cancelled' && booking.status !== 'rejected' && hotel?.adminChatEnabled !== false && (
                          <button
                            type="button"
                            onClick={() => setChatTarget(booking)}
                            className="ml-2 text-xs font-semibold text-stone-900 border-2 border-stone-900 bg-white px-3 py-1.5 rounded-lg hover:bg-stone-900 hover:text-white transition inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Message
                          </button>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                          booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          booking.status === 'cancelled' ? 'bg-stone-200 text-stone-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {booking.status}
                        </span>
                        {booking.reference && (
                          <span className="text-xs font-mono font-semibold text-stone-400">{booking.reference}</span>
                        )}
                        {/* Accepted, but the spam checks found something. The
                            property decides; this only says why to look. */}
                        {booking.flagged && (
                          <span
                            title={(booking.flagReasons ?? []).join(', ')}
                            className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          >
                            <AlertTriangle className="h-3 w-3" /> Check this one
                          </span>
                        )}
                      </div>
                      {(booking.guestEmail || booking.guestPhone || booking.guestWhatsapp) && (
                        <div className="text-sm text-stone-500 mb-2 flex gap-4 flex-wrap">
                          {booking.guestEmail && <span>✉️ {booking.guestEmail}</span>}
                          {booking.guestPhone && <span>📞 {booking.guestPhone}</span>}
                          {booking.guestWhatsapp && (
                            <a href={`https://wa.me/${booking.guestWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                              WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                      <p className="text-stone-500 font-medium mb-1">{rooms.find(r => r.id === booking.roomTypeId)?.name || 'Unknown Room'}</p>
                      <div className="text-sm text-stone-500 flex items-center gap-2 flex-wrap">
                        <Calendar className="h-4 w-4" />
                        {formatDateStr(booking.checkIn)} — {formatDateStr(booking.checkOut)}
                        <span className="text-stone-400">
                          &middot; {nightsBetween(booking.checkIn, booking.checkOut)} night{nightsBetween(booking.checkIn, booking.checkOut) === 1 ? '' : 's'} &middot; {booking.guests} guest{booking.guests === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end">
                      {canSeeFinancials && (
                        <span className="font-serif font-bold text-2xl text-stone-900 mb-2">{formatMoney(booking.total ?? 0, booking.currency)}</span>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => setBookingToDelete(booking.id!)} className="text-stone-400 hover:text-red-500 transition p-2">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {booking.flagged && (booking.flagReasons ?? []).length > 0 && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                      <span className="font-semibold block mb-1">Why this was flagged</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {(booking.flagReasons ?? []).map(reason => (
                          <li key={reason}>{SPAM_REASON_LABELS[reason] ?? reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {booking.specialRequests && (
                    <div className="mb-4 bg-stone-100 rounded-xl p-4 text-sm text-stone-600">
                      <span className="font-semibold block mb-1">Special Requests:</span>
                      {booking.specialRequests}
                    </div>
                  )}

                  {booking.status === 'pending' && (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setConfirmModalBooking(booking.id!)}
                        className="bg-stone-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-800 transition flex items-center gap-2"
                      >
                        <Check className="h-4 w-4" /> Confirm Booking
                      </button>
                      <button
                        onClick={() => updateBookingStatus(booking.id!, 'rejected')}
                        className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-100 transition flex items-center gap-2"
                      >
                        <X className="h-4 w-4" /> Decline
                      </button>
                    </div>
                  )}

                  {/* A confirmed booking previously had no route back short of
                      deleting the record outright. */}
                  {booking.status === 'confirmed' && (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => updateBookingStatus(booking.id!, 'cancelled')}
                        className="bg-stone-100 text-stone-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600 transition flex items-center gap-2"
                      >
                        <X className="h-4 w-4" /> Cancel this booking
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {visibleBookings.length > bookingsPerPage && (
            <Pagination
              currentPage={currentBookingPage}
              totalPages={Math.ceil(visibleBookings.length / bookingsPerPage)}
              onPageChange={setCurrentBookingPage}
            />
          )}
        </div>
      )}

      {/* TAB CONTENT: INQUIRIES */}
      {activeTab === 'inquiries' && (
        <div className="space-y-6">
          {/* Host Status & Overview Card */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${hotel.isOnline !== false ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  {hotel.isOnline !== false ? 'You are Online' : 'You are Offline (Away)'}
                </h3>
              </div>
              <p className="text-sm text-stone-500 mt-1">
                {hotel.isOnline !== false
                  ? 'Guests can see you are ready for instant inquiries.'
                  : `Out-of-office message active: "${hotel.outOfOfficeMessage || "We're currently away. Leave a message and we'll reply soon!"}"`}
              </p>
            </div>
            <button
              onClick={handleToggleOnlineStatus}
              disabled={togglingStatus}
              className={`px-5 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider transition ${
                hotel.isOnline !== false
                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {hotel.isOnline !== false ? 'Go Offline / Set Away' : 'Turn Online Now'}
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif font-bold text-stone-900">Guest Messages & Inquiries</h3>
              <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
                {inquiries.length} conversation{inquiries.length === 1 ? '' : 's'}
              </span>
            </div>
            
            {inquiries.length === 0 ? (
              <div className="text-center py-16 text-stone-500">
                <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-stone-400">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h4 className="font-serif font-bold text-stone-800 text-lg">No inquiries yet</h4>
                <p className="text-sm text-stone-500 max-w-sm mx-auto mt-1">
                  When potential guests send a message from your property page, their inquiries will appear here with real-time updates and notification chimes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {inquiries.map((inquiry) => {
                  const guestInitial = (inquiry.guestName || 'Guest').charAt(0).toUpperCase();
                  const updatedDate = inquiry.updatedAt ? new Date(inquiry.updatedAt) : new Date();
                  const isEnded = inquiry.status === 'ended';
                  const isGuestTyping = Boolean(inquiry.guestTyping && (Date.now() - (inquiry.guestTypingAt || 0) < 5000));
                  const isGuestInChat = Boolean(inquiry.guestInChat);
                  const isUnread = inquiry.lastSenderId !== user?.uid && 
                                   inquiry.updatedAt && 
                                   (!inquiry.managerLastOpenedAt || inquiry.updatedAt > inquiry.managerLastOpenedAt);

                  return (
                    <div key={inquiry.id} className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-stone-50/60 -mx-6 px-6 transition rounded-2xl">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-2xl bg-stone-900 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                            {guestInitial}
                          </div>
                          {/* Live Presence indicator dot on guest avatar */}
                          <span 
                            className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${
                              isGuestInChat ? 'bg-emerald-400 animate-pulse' : 'bg-stone-300'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-stone-900 flex items-center gap-2">
                              {inquiry.guestName || 'Guest'}
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-blue-600" title="New message"></span>
                              )}
                            </h4>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Inquiry
                            </span>

                            {isGuestTyping ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Typing...
                              </span>
                            ) : isGuestInChat ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Eye className="w-3 h-3 text-emerald-600 animate-pulse" />
                                In Chat Now
                              </span>
                            ) : isEnded ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">
                                Ended
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50/80 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            )}
                          </div>
                          {inquiry.lastMessage && (
                            <p className="text-sm text-stone-600 mt-1 line-clamp-1 italic">
                              "{inquiry.lastMessage}"
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                            <span>
                              Last activity: {updatedDate.toLocaleDateString()} at {updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {inquiry.guestLastOpenedAt && (
                              <span className="text-stone-400">
                                • Opened by guest: {new Date(inquiry.guestLastOpenedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {hotel?.adminChatEnabled !== false && (
                          <button
                            type="button"
                            onClick={() => setInquiryChatTarget(inquiry)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white hover:bg-stone-800 rounded-xl transition font-semibold text-xs shadow-xs"
                          >
                            <MessageSquare className="w-4 h-4" /> Open Chat
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setInquiryToDelete(inquiry.id)}
                          className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition border border-stone-200 hover:border-red-200 shadow-2xs"
                          title="Delete Chat History"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm a pending request */}
      {confirmModalBooking && (() => {
        const booking = bookings.find(b => b.id === confirmModalBooking);
        const room = rooms.find(r => r.id === booking?.roomTypeId);
        return (
          <Modal
            open
            onClose={() => setConfirmModalBooking(null)}
            size="md"
            title="Confirm this booking"
            description={
              booking
                ? `${booking.guestName} · ${room?.name ?? 'Room'} · ${formatDateStr(booking.checkIn)} – ${formatDateStr(booking.checkOut)}`
                : undefined
            }
            footer={
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModalBooking(null)}
                  className="flex-1 bg-stone-100 text-stone-900 px-6 py-3 rounded-full font-semibold text-sm hover:bg-stone-200 transition"
                >
                  Not yet
                </button>
                <button
                  onClick={() => updateBookingStatus(confirmModalBooking, 'confirmed')}
                  className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-emerald-700 transition"
                >
                  Approve booking
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              {booking && (
                <div className="rounded-2xl border border-stone-200 divide-y divide-stone-100 text-sm">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-stone-500">Guest</span>
                    <span className="font-semibold text-stone-900">{booking.guestName}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-stone-500">Stay</span>
                    <span className="font-semibold text-stone-900 tabular-nums">
                      {nightsBetween(booking.checkIn, booking.checkOut)} night{nightsBetween(booking.checkIn, booking.checkOut) === 1 ? '' : 's'} · {booking.guests} guest{booking.guests === 1 ? '' : 's'}
                    </span>
                  </div>
                  {canSeeFinancials && (
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-stone-500">Total</span>
                      <span className="font-semibold text-stone-900 tabular-nums">{formatMoney(booking.total ?? 0, booking.currency)}</span>
                    </div>
                  )}
                  {booking.guestPhone && (
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-stone-500">Phone</span>
                      <a href={`tel:${booking.guestPhone}`} className="font-semibold text-stone-900 hover:text-emerald-700">{booking.guestPhone}</a>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-amber-50 text-amber-900 px-4 py-3.5 rounded-xl text-sm border border-amber-200">
                <span className="font-semibold block mb-1">Before you approve</span>
                Call the guest, or message them on WhatsApp, to agree an arrival time.
              </div>
              <div className="bg-stone-50 text-stone-600 px-4 py-3.5 rounded-xl text-sm border border-stone-200">
                <span className="font-semibold block mb-1 text-stone-900">Payment</span>
                Remind them that payment is settled directly at the property on arrival.
              </div>
            </div>
          </Modal>
        );
      })()}

      <ConfirmDialog
        isOpen={!!pendingTab}
        title="Leave without saving?"
        message="You have changes on this tab that have not been saved. Leaving now discards them."
        confirmText="Discard changes"
        cancelText="Stay here"
        isDestructive
        onConfirm={discardAndSwitch}
        onCancel={() => setPendingTab(null)}
      />

            {chatTarget && user && (
        <Modal
          open={true}
          onClose={() => setChatTarget(null)}
          title={"Message " + (chatTarget.guestName || 'Guest')}
          description={"Reference: " + (chatTarget.reference || 'N/A')}
        >
          <div className="mt-2 h-[500px]">
             <BookingChat booking={chatTarget} currentUser={user} />
          </div>
        </Modal>
      )}

      {inquiryChatTarget && user && hotel && (
        <div className="fixed inset-0 bg-stone-900/50 z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-transparent">
            <PropertyChat 
              hotel={hotel}
              currentUser={user}
              guestId={inquiryChatTarget.guestId}
              guestName={inquiryChatTarget.guestName}
              onClose={() => setInquiryChatTarget(null)}
            />
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!bookingToDelete}
        title="Delete Booking"
        message="Are you sure you want to permanently delete this booking? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (bookingToDelete) deleteBooking(bookingToDelete);
        }}
        onCancel={() => setBookingToDelete(null)}
      />
      <ConfirmDialog
        isOpen={!!inquiryToDelete}
        title="Delete Inquiry & Chat History"
        message="Are you sure you want to permanently delete this inquiry and all conversation messages? This action cannot be undone."
        confirmText="Delete History"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (inquiryToDelete) deleteInquiryChat(inquiryToDelete);
        }}
        onCancel={() => setInquiryToDelete(null)}
      />
    </div>
  );
}



