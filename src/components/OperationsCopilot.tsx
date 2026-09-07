import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, RotateCcw, Check, 
  ChevronDown, ExternalLink, Calendar, Building, DollarSign, 
  TrendingUp, Clock, AlertCircle, Loader2, CheckCircle2, ShieldAlert,
  ArrowRight, Settings2, Sliders, Info, SlidersHorizontal, ConciergeBell,
  Utensils, Coffee, CheckCheck, Layers, ShieldCheck, Minus, Maximize2, Minimize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { isAdmin, isHotelManager } from '../lib/roles';
import { useAIAssistant, OperationsChatPayload, OperationsChatResult, ActionProposal, QueryIntent } from '../hooks/useAIAssistant';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { Hotel, RoomType, Booking, Review, Broadcast } from '../types';
import { 
  getLearnedDirectives, 
  syncDirectivesWithCloud,
  addLearnedDirective, 
  addAutonomousPatch,
  removeLearnedDirective, 
  LearnedDirective 
} from '../lib/assistantMemory';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionProposal?: ActionProposal | null;
  actionApplied?: boolean;
  actionRejected?: boolean;
  suggestedFollowUps?: string[];
  timestamp: number;
}

export function ConciergeAvatar({ 
  size = 'md', 
  isOnline = true 
}: { 
  size?: 'sm' | 'md' | 'lg'; 
  isOnline?: boolean 
}) {
  const containerSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
  const capWidth = size === 'sm' ? 'w-3 h-1.5' : 'w-4 h-2';
  const faceSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className={`relative ${containerSize} rounded-full shrink-0 select-none`}>
      {/* Outer subtle brass/gold ring */}
      <div className="w-full h-full rounded-full bg-stone-900 p-[1.5px] shadow-md ring-1 ring-amber-400/40 group-hover:ring-amber-400/80 transition-all">
        {/* Inner vignette background */}
        <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-b from-stone-800 via-stone-850 to-stone-950 flex flex-col items-center justify-end relative">
          
          {/* Concierge Pillbox / Bellhop Hat with golden trim */}
          <div className="absolute top-0.5 z-20 flex flex-col items-center -rotate-3 group-hover:rotate-0 transition-transform duration-300">
            <div className={`${capWidth} rounded-t-sm bg-rose-950 border-t border-x border-rose-800 flex items-end justify-center shadow-xs`}>
              <div className="w-full h-[2px] bg-amber-400" />
            </div>
          </div>

          {/* Friendly Concierge Face */}
          <div className={`${faceSize} rounded-full bg-amber-100 border border-amber-200/90 flex flex-col items-center justify-center relative shadow-xs mb-1 z-10`}>
            {/* Eyes */}
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-0.5 h-0.5 bg-stone-900 rounded-full" />
              <span className="w-0.5 h-0.5 bg-stone-900 rounded-full" />
            </div>
            {/* Warm Concierge Smile */}
            <div className="w-1.5 h-0.5 border-b-[1.5px] border-stone-900 rounded-b-full mt-0.5" />
            {/* Subtle Rosy Cheeks */}
            <span className="absolute top-1.5 left-0.5 w-0.5 h-0.5 bg-rose-300 rounded-full opacity-80" />
            <span className="absolute top-1.5 right-0.5 w-0.5 h-0.5 bg-rose-300 rounded-full opacity-80" />
          </div>

          {/* Dapper Hospitality Blazer & Golden Bowtie / Keys */}
          <div className="w-6 h-2.5 bg-stone-900 rounded-t-sm border-t border-stone-700/80 flex items-start justify-center relative z-10 -mt-2">
            {/* White Collar Peak */}
            <div className="w-2 h-1 bg-white rounded-b-xs shadow-xs" />
            {/* Golden Bowtie */}
            <div className="absolute top-0.5 w-1.5 h-0.5 bg-amber-400 rounded-xs shadow-xs" />
          </div>
        </div>
      </div>

      {/* Online / Active Ready Indicator */}
      {isOnline && (
        <span 
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-stone-900 shadow-xs" 
          title="Concierge On Duty"
        />
      )}
    </div>
  );
}

export default function OperationsCopilot() {
  const { user } = useAuth();
  const { status: aiStatus, operationsChat, generating } = useAIAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  useBodyScrollLock(isOpen && !isMinimized);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewingMemory, setViewingMemory] = useState(false);
  const [newDirectiveInput, setNewDirectiveInput] = useState('');
  const [learnedRules, setLearnedRules] = useState<LearnedDirective[]>([]);

  // Live Data
  const [properties, setProperties] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conferences, setConferences] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Chat conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [activeQueryIntent, setActiveQueryIntent] = useState<QueryIntent>('greeting_or_chat');
  const [activeQueryText, setActiveQueryText] = useState<string>('');

  // Tracks interactive hotel selection for each proposed action { [msgId]: hotelId[] }
  const [proposalHotelSelections, setProposalHotelSelections] = useState<Record<string, string[]>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const userIsAdmin = isAdmin(user);
  const userIsManager = isHotelManager(user);
  const isAuthorized = user && (userIsAdmin || userIsManager);

  // Load and sync learned directives across sessions and cloud
  useEffect(() => {
    if (user?.uid) {
      setLearnedRules(getLearnedDirectives(user.uid));
      // Asynchronously sync with Firestore for durable persistence
      syncDirectivesWithCloud(user.uid)
        .then(synced => {
          if (synced && synced.length > 0) {
            setLearnedRules(synced);
          }
        })
        .catch(err => console.warn('Could not sync directives with cloud:', err));
    }
  }, [user?.uid]);

  // Today's formatted string in local time (e.g. "2026-09-02")
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  // Fetch contextual properties, rooms, conferences, and bookings
  const fetchOperationsData = async () => {
    if (!user || !isAuthorized) return;
    setDataLoading(true);
    try {
      let hotelDocs: Hotel[] = [];
      let roomDocs: RoomType[] = [];
      let bookingDocs: Booking[] = [];
      let confDocs: any[] = [];
      let reviewDocs: Review[] = [];
      let broadcastDocs: Broadcast[] = [];

      if (userIsAdmin) {
        // Global Admins see all properties, rooms, conferences, bookings, reviews, and broadcasts platform-wide
        const [hotelsSnap, roomsSnap, bookingsSnap, confSnap, reviewsSnap, broadcastsSnap] = await Promise.all([
          getDocs(collection(db, 'hotels')),
          getDocs(collection(db, 'room_types')),
          getDocs(collection(db, 'bookings')),
          getDocs(collection(db, 'conference_rooms')),
          getDocs(collection(db, 'reviews')),
          getDocs(collection(db, 'broadcasts')),
        ]);
        hotelDocs = hotelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        roomDocs = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType));
        bookingDocs = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
        confDocs = confSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        reviewDocs = reviewsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Review));
        broadcastDocs = broadcastsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Broadcast));
      } else {
        // Property Managers: fetch all platform hotels to accurately identify the user's properties
        // Just because a property has no manager assigned, it DOES belong to the signed-in user!
        const hotelsSnap = await getDocs(collection(db, 'hotels'));
        const allHotels = hotelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));

        const userEmailLower = user.email?.toLowerCase();
        hotelDocs = allHotels.filter(h => {
          const hasAssignedManager = Boolean(
            h.managerId &&
            h.managerId !== 'unassigned' &&
            h.managerId !== 'none' &&
            h.managerId.trim() !== ''
          );

          if (hasAssignedManager && h.managerId === user.uid) return true;
          if (userEmailLower) {
            if (h.managerEmail && h.managerEmail.toLowerCase() === userEmailLower) return true;
            if (h.ownerEmail && h.ownerEmail.toLowerCase() === userEmailLower) return true;
            if (h.contactEmail && h.contactEmail.toLowerCase() === userEmailLower) return true;
          }
          if ((h as any).ownerId === user.uid || (h as any).createdBy === user.uid) return true;
          
          // CRITICAL: Unassigned properties belong to the signed-in user!
          if (!hasAssignedManager) return true;

          return false;
        });

        const hotelIds = hotelDocs.map(h => h.id).filter(Boolean) as string[];

        if (hotelIds.length > 0) {
          const [roomsSnap, bookingsSnap, confSnap, reviewsSnap, broadcastsSnap] = await Promise.all([
            getDocs(collection(db, 'room_types')),
            getDocs(collection(db, 'bookings')),
            getDocs(collection(db, 'conference_rooms')),
            getDocs(collection(db, 'reviews')),
            getDocs(collection(db, 'broadcasts')),
          ]);
          roomDocs = roomsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as RoomType))
            .filter(r => hotelIds.includes(r.hotelId));
          bookingDocs = bookingsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Booking))
            .filter(b => hotelIds.includes(b.hotelId));
          confDocs = confSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) }))
            .filter((c: any) => hotelIds.includes(c.hotelId));
          reviewDocs = reviewsSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) } as Review))
            .filter((r: any) => hotelIds.includes(r.hotelId));
          broadcastDocs = broadcastsSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) } as Broadcast))
            .filter((b: any) => hotelIds.includes(b.hotelId));
        }
      }

      setProperties(hotelDocs);
      setRooms(roomDocs);
      setBookings(bookingDocs);
      setConferences(confDocs);
      setReviews(reviewDocs);
      setBroadcasts(broadcastDocs);
    } catch (err) {
      console.warn('Could not load live operations data:', err);
    } finally {
      setDataLoading(false);
      setHasFetched(true);
    }
  };

  useEffect(() => {
    if (isAuthorized && aiStatus.enabled && aiStatus.available) {
      fetchOperationsData();
    }
  }, [user?.uid, isAuthorized, aiStatus.enabled, aiStatus.available]);

  // User display name strictly honoring profile Display Name (never email username or generic titles)
  const userDisplayName = useMemo(() => {
    const raw = (user?.displayName || '').trim();
    if (raw && !raw.includes('@')) {
      const lower = raw.toLowerCase();
      const isGenericRole = ['administrator', 'admin', 'manager', 'host', 'user', 'owner', 'top boss', 'boss'].includes(lower);
      const isEmailPrefix = Boolean(user?.email && lower === user.email.split('@')[0].toLowerCase());
      if (!isGenericRole && !isEmailPrefix) {
        return raw;
      }
    }
    return '';
  }, [user?.displayName, user?.email]);

  // Initial welcome message distinguishing Global Admin vs Manager
  useEffect(() => {
    if (messages.length === 0 && isAuthorized && hasFetched) {
      const greeting = userDisplayName ? `Hi ${userDisplayName}` : 'Hello';
      if (userIsAdmin) {
        const propText = properties.length > 0 ? `all **${properties.length} platform properties**` : `the platform`;
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `${greeting}! I have live visibility across ${propText}.\n\nWhat would you like to review, audit, or adjust today?`,
            timestamp: Date.now(),
          },
        ]);
      } else {
        const propNames = properties.map(p => `**${p.name}**`).join(', ') || 'your properties';
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `${greeting}! Ready to assist with ${propNames}.\n\nWhat's on your agenda today?`,
            timestamp: Date.now(),
          },
        ]);
      }
    }
  }, [user, isAuthorized, messages.length, userIsAdmin, properties, userDisplayName, hasFetched]);

  // Scroll chat messages container smoothly to bottom on new messages without scrolling the background window
  useEffect(() => {
    if (isOpen && !isMinimized && chatScrollContainerRef.current) {
      const el = chatScrollContainerRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Prevent body & html scrolling and pause smooth scroller when chat is open and not minimized
  useEffect(() => {
    const lenisInstance = (window as any).__lenis;
    if (isOpen && !isMinimized) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (lenisInstance && typeof lenisInstance.stop === 'function') {
        lenisInstance.stop();
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (lenisInstance && typeof lenisInstance.start === 'function') {
        lenisInstance.start();
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (lenisInstance && typeof lenisInstance.start === 'function') {
        lenisInstance.start();
      }
    };
  }, [isOpen, isMinimized]);

  // Isolate wheel scrolling inside the chat window so it never bubbles or chains to the page behind
  useEffect(() => {
    const el = chatScrollContainerRef.current;
    if (!el || !isOpen || isMinimized) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // When scrolling up and already at the top, or scrolling down and already at the bottom,
      // prevent default to stop the browser from chaining the scroll to the background window/page
      if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, [isOpen, isMinimized]);

  // If not authorized or AI is disabled globally, do not render
  if (!isAuthorized || !aiStatus.enabled) {
    return null;
  }

  // Quick live metrics
  const arrivalsCountToday = bookings.filter(b => b.checkIn === todayStr && b.status !== 'cancelled').length;
  const departuresCountToday = bookings.filter(b => b.checkOut === todayStr && b.status !== 'cancelled').length;

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const dynamicSuggestions = lastAssistantMsg?.suggestedFollowUps;

  const detectQueryIntent = (text: string): QueryIntent => {
    const clean = (text || '').trim().toLowerCase();
    const stripped = clean.replace(/[!.,?]/g, '').trim();

    // 1. Action intents (modifications, updates, operations)
    const actionKeywords = [
      'update', 'change', 'set rate', 'set price', 'add room', 'add promo', 'add promotion',
      'cancel booking', 'confirm booking', 'remove room', 'delete', 'publish', 'broadcast',
      'out of office', 'block date', 'unblock date', 'modify', 'save rule', 'learn rule'
    ];
    if (actionKeywords.some(k => clean.includes(k))) {
      return 'database_action';
    }

    // 2. Explicit greetings and general conversational small-talk
    const standardGreetings = [
      'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
      'hi there', 'hello there', 'muli bwanji', 'moni', 'bo', 'sup', 'yo',
      'howdy', 'greetings', 'morning', 'afternoon', 'evening'
    ];
    const conversationalQueries = [
      'how are you', 'how r u', 'who are you', 'what are you', 'what can you do',
      'who made you', 'tell me a joke', 'thanks', 'thank you', 'cheers',
      'great', 'cool', 'ok', 'okay', 'nice', 'awesome', 'goodbye', 'bye', 'see you',
      'help', 'what is your name', 'whats your name'
    ];

    const isGreetingWord = standardGreetings.includes(stripped) || conversationalQueries.some(q => stripped === q || stripped.startsWith(q));

    // Check if there are explicit database / operational keywords
    const dbKeywords = [
      'rate', 'rates', 'price', 'prices', 'cost', 'pricing', 'mwk', 'usd',
      'booking', 'bookings', 'reservation', 'reservations', 'guest', 'guests',
      'arrival', 'arrivals', 'departure', 'departures', 'checkin', 'check-in', 'checkout', 'check-out',
      'occupancy', 'vacan', 'availability', 'available', 'blocked',
      'room', 'rooms', 'suite', 'chalet', 'cottage', 'villa', 'dorm',
      'menu', 'dishes', 'dish', 'food', 'restaurant', 'dining', 'drink', 'breakfast', 'dinner', 'lunch',
      'review', 'reviews', 'rating', 'feedback',
      'wifi', 'wi-fi', 'password', 'power', 'solar', 'generator', 'water', 'road',
      'manager', 'owner', 'host', 'contact', 'whatsapp', 'phone', 'email', 'crew',
      'revenue', 'financial', 'income', 'earning'
    ];

    const hasDbKeywords = dbKeywords.some(k => {
      const regex = new RegExp(`\\b${k}\\b`, 'i');
      return regex.test(clean);
    });

    if (isGreetingWord && !hasDbKeywords) {
      return 'greeting_or_chat';
    }

    // If very short and no DB keywords (e.g. "hi!", "yo", "hey copilot")
    if (stripped.length <= 4 && !hasDbKeywords) {
      return 'greeting_or_chat';
    }

    // 3. Database / live operational queries
    if (hasDbKeywords) {
      return 'database_query';
    }

    // 4. Malawi tourism & travel guidance
    const tourismKeywords = [
      'malawi', 'lake malawi', 'safari', 'wildlife', 'liwonde', 'nyika', 'cape maclear',
      'mulanje', 'hiking', 'national park', 'beach', 'diving', 'snorkeling', 'chambo',
      'attractions', 'visit', 'weather', 'rainy season', 'dry season', 'culture',
      'blantyre', 'lilongwe', 'mzuzu', 'salima', 'nkhata bay', 'mangochi', 'zomba'
    ];
    if (tourismKeywords.some(k => clean.includes(k))) {
      return 'tourism_inquiry';
    }

    // Fallback for general conversational statements with no DB keywords
    if (!hasDbKeywords && clean.split(/\s+/).length <= 4) {
      return 'greeting_or_chat';
    }

    return 'database_query';
  };

  const getGeneratingStatusText = (intent: QueryIntent, userText: string) => {
    if (intent === 'greeting_or_chat') {
      return 'Concierge is replying...';
    }
    if (intent === 'tourism_inquiry') {
      return 'Concierge is preparing travel insights...';
    }
    if (intent === 'database_action') {
      return 'Preparing operational proposal...';
    }
    return 'Consulting lodge records & bookings...';
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || generating) return;

    const detectedIntent = detectQueryIntent(text);
    setActiveQueryIntent(detectedIntent);
    setActiveQueryText(text);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    const isLeanSmallTalk = detectedIntent === 'greeting_or_chat';

    // Prepare context payload for server
    const payload: OperationsChatPayload = {
      userRole: userIsAdmin ? 'admin' : 'hotel_manager',
      displayName: userDisplayName || undefined,
      userName: userDisplayName || undefined,
      userEmail: user?.email || undefined,
      message: text,
      intent: detectedIntent,
      history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
      context: {
        currentDateStr: todayStr,
        currentTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        properties: isLeanSmallTalk
          ? properties.slice(0, 15).map(p => ({
              id: p.id || '',
              name: p.name,
              location: p.location,
              category: p.categories?.[0] || 'Lodge',
              status: p.status || 'active',
              verificationStatus: p.verificationStatus || 'unverified',
            }))
          : properties.map((p, pIdx) => {
          const propRooms = rooms.filter(r => r.hotelId === p.id);
          const propConfs = conferences.filter(c => c.hotelId === p.id);
          const propReviews = reviews.filter(r => r.hotelId === p.id);
          const propBroadcasts = broadcasts.filter(b => b.hotelId === p.id && b.isActive !== false);
          const totalReviews = propReviews.length;
          const avgRating = totalReviews > 0 ? Number((propReviews.reduce((sum, r) => sum + (r.rating || 5), 0) / totalReviews).toFixed(1)) : 0;
          const isUnassigned = !p.managerId || p.managerId === 'unassigned' || p.managerId === 'none' || p.managerId.trim() === '';
          return {
            id: p.id || '',
            name: p.name,
            description: p.description,
            location: p.location,
            locationNotes: p.locationNotes,
            category: p.categories?.[0] || 'Lodge',
            status: p.status || 'active',
            verificationStatus: p.verificationStatus || 'unverified',
            featured: Boolean(p.featured),
            isOnline: p.isOnline !== false,
            outOfOfficeMessage: p.outOfOfficeMessage,
            managerId: isUnassigned ? (userIsAdmin ? 'unassigned' : user.uid) : p.managerId,
            managerName: p.managerName || (!userIsAdmin ? (userFirstName || user.displayName || 'Host') : undefined),
            managerEmail: p.managerEmail || p.contactEmail || (!userIsAdmin ? user.email || undefined : undefined),
            managerPhone: p.managerPhone || p.contactPhone,
            ownerName: p.ownerName,
            ownerEmail: p.ownerEmail,
            ownerPhone: p.ownerPhone,
            contactWhatsapp: p.contactWhatsapp || p.contactPhone,
            contactEmail: p.contactEmail,
            contactPhone: p.contactPhone,
            coordinates: p.coordinates ? { lat: p.coordinates.lat, lng: p.coordinates.lng } : undefined,
            hours: p.hours,
            infrastructure: p.infrastructure ? {
              powerSource: p.infrastructure.powerSource,
              powerNotes: p.infrastructure.powerNotes,
              waterSource: p.infrastructure.waterSource,
              roadAccess: p.infrastructure.roadAccess,
              internetSource: p.infrastructure.internetSource,
              workspaceSetup: p.infrastructure.workspaceSetup,
              wifiSSID: p.infrastructure.wifiSSID,
              wifiPassword: p.infrastructure.wifiPassword,
              shareWifiVoucher: p.infrastructure.shareWifiVoucher,
              offlineTrustBadge: p.infrastructure.offlineTrustBadge,
            } : undefined,
            promotions: p.promotions?.filter(pr => pr.isActive).map(pr => ({
              name: pr.name,
              discountPercentage: pr.discountPercentage,
            })),
            crew: p.crew?.map(c => ({
              name: c.name,
              role: c.role,
              phone: c.phone,
              whatsapp: c.whatsapp,
            })),
            checkInTime: p.checkInTime || '14:00',
            checkOutTime: p.checkOutTime || '10:00',
            cancellationPolicy: p.cancellationPolicy || 'Standard',
            paymentPolicy: p.paymentPolicy || 'Direct payment',
            conferenceCancellationPolicy: p.conferenceCancellationPolicy,
            conferencePaymentPolicy: p.conferencePaymentPolicy,
            conferenceGuidelines: p.conferenceGuidelines,
            reviewsSummary: totalReviews > 0 ? {
              count: totalReviews,
              averageRating: avgRating,
              recentReviews: propReviews.slice(-5).map(r => ({
                author: r.authorName || 'Guest',
                rating: r.rating || 5,
                comment: r.text || '',
                date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : undefined,
              })),
            } : undefined,
            activeBroadcasts: propBroadcasts.map(b => ({
              id: b.id,
              type: b.type,
              message: b.message,
              date: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : undefined,
            })),
            amenities: p.amenities || [],
            restaurant: p.restaurant ? {
              enabled: Boolean(p.restaurant.enabled),
              name: p.restaurant.name,
              description: p.restaurant.description,
              sectionsCount: p.restaurant.sections?.length || 0,
              sampleItems: p.restaurant.sections?.flatMap(s => s.items.map(i => i.name)).slice(0, 8) || [],
              menuSections: p.restaurant.sections?.map(s => ({
                name: s.name,
                items: s.items?.map(item => ({
                  name: item.name,
                  description: item.description,
                  priceUSD: item.prices?.USD,
                  priceMWK: item.prices?.MWK,
                  tags: item.tags,
                })) || [],
              })),
            } : undefined,
            conferences: propConfs.map(c => ({
              id: c.id || '',
              name: c.name,
              capacity: c.capacity || 20,
              dayRateUSD: c.dayRateUSD,
              dayRateMWK: c.dayRateMWK,
            })),
            dailyBoard: p.dailyBoard ? {
              activities: p.dailyBoard.activities,
              dishOfTheDay: p.dailyBoard.dishOfTheDay,
              notes: p.dailyBoard.notes,
            } : undefined,
            rooms: propRooms.map(r => ({
              id: r.id || '',
              name: r.name,
              description: r.description,
              amenities: r.amenities || [],
              priceUSD: r.prices?.USD ?? r.price,
              priceMWK: r.prices?.MWK ?? r.priceMWK,
              maxGuests: r.maxGuests,
              quantity: r.quantity,
              extraGuestFeeUSD: r.extraGuestFees?.USD,
              extraGuestFeeMWK: r.extraGuestFees?.MWK,
              blockedDates: (r as any).blockedDates || [],
              packages: r.packages?.map(pkg => ({
                name: pkg.name,
                type: pkg.type,
                priceUSD: pkg.prices?.USD ?? pkg.price,
                priceMWK: pkg.prices?.MWK,
              })),
            })),
          };
        }),
        bookings: isLeanSmallTalk
          ? []
          : bookings.map(b => {
          const hotel = properties.find(p => p.id === b.hotelId);
          const room = rooms.find(r => r.id === b.roomTypeId);
          return {
            id: b.id || '',
            reference: b.reference,
            hotelId: b.hotelId,
            hotelName: hotel?.name || 'Property',
            roomName: room?.name || 'Room',
            guestName: b.guestName,
            guestEmail: b.guestEmail,
            guestPhone: b.guestPhone,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            nights: (b as any).nights,
            guests: b.guests,
            quantity: b.quantity,
            status: b.status,
            currency: b.currency,
            total: b.total,
            specialRequests: (b as any).specialRequests,
            createdAt: (b as any).createdAt,
          };
        }),
        learnedRules: learnedRules.map(r => r.text),
      },
    };

    try {
      const result = await operationsChat(payload);

      if (result) {
        // If the response learned a new rule, save it!
        if (result.newLearnedRule && user.uid) {
          const saved = addLearnedDirective(user.uid, result.newLearnedRule, userIsAdmin ? 'admin' : 'hotel_manager');
          setLearnedRules(getLearnedDirectives(user.uid));
          toast.success(`Directive saved: "${saved.text.slice(0, 50)}..."`);
        }

        // If the AI autonomously generated a patch from a mistake, persist it!
        if (result.autonomousPatch && user.uid) {
          const patch = result.autonomousPatch;
          const savedPatch = addAutonomousPatch(
            user.uid,
            patch.patch,
            patch.trigger,
            patch.resolution
          );
          setLearnedRules(getLearnedDirectives(user.uid));
          toast.success(`Operational rule updated: "${savedPatch.text.slice(0, 50)}..."`, {
            duration: 4000,
          });
        }

        const assistantMsg: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          actionProposal: result.actionProposal,
          suggestedFollowUps: result.suggestedFollowUps,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } finally {
      setActiveQueryText('');
    }
  };

  // Helper: determine target properties for an action proposal
  const getEffectiveHotelIds = (msgId: string, proposal?: ActionProposal | null): string[] => {
    if (!proposal) return [];
    if (proposalHotelSelections[msgId] && proposalHotelSelections[msgId].length > 0) {
      return proposalHotelSelections[msgId];
    }
    if (proposal.hotelIds && proposal.hotelIds.length > 0) {
      const valid = proposal.hotelIds.filter(id => properties.some(p => p.id === id));
      if (valid.length > 0) return valid;
    }
    if (proposal.hotelId) {
      return [proposal.hotelId];
    }
    return properties.map(p => p.id).filter(Boolean) as string[];
  };

  const handleSelectAllHotelsForProposal = (msgId: string) => {
    const allIds = properties.map(p => p.id).filter(Boolean) as string[];
    setProposalHotelSelections(prev => ({
      ...prev,
      [msgId]: allIds,
    }));
  };

  const handleSelectSingleHotelForProposal = (msgId: string, hotelId: string) => {
    setProposalHotelSelections(prev => ({
      ...prev,
      [msgId]: [hotelId],
    }));
  };

  const handleToggleHotelForProposal = (msgId: string, hotelId: string, currentEffectiveIds: string[]) => {
    setProposalHotelSelections(prev => {
      const isCurrentlySelected = currentEffectiveIds.includes(hotelId);
      let next: string[];
      if (isCurrentlySelected) {
        next = currentEffectiveIds.filter(id => id !== hotelId);
        if (next.length === 0) next = [hotelId];
      } else {
        next = [...currentEffectiveIds, hotelId];
      }
      return { ...prev, [msgId]: next };
    });
  };

  // Comprehensive Action Execution Engine (Multi-Property, Amenities, Rates, Policies, Dining, Board)
  const handleApplyAction = async (
    msgId: string, 
    action: ActionProposal, 
    overrideTargetIds?: string[]
  ) => {
    if (!window.confirm(`Are you sure you want to execute this action: ${action.type.replace(/_/g, ' ')}?`)) {
      return;
    }

    setExecutingAction(msgId);
    try {
      const targetIds = overrideTargetIds || getEffectiveHotelIds(msgId, action);
      if (targetIds.length === 0 && action.type !== 'update_booking_status') {
        toast.error('Please select at least one property to apply changes to.');
        setExecutingAction(null);
        return;
      }

      // Authorization Check: Property Managers may only modify their own properties
      if (!userIsAdmin) {
        const userEmailLower = user?.email?.toLowerCase();
        const unauthorized = targetIds.some(id => {
          const prop = properties.find(p => p.id === id);
          if (!prop) return true;
          const hasAssignedManager = Boolean(
            prop.managerId &&
            prop.managerId !== 'unassigned' &&
            prop.managerId !== 'none' &&
            prop.managerId.trim() !== ''
          );
          // If property has an assigned manager other than current user, check email
          if (hasAssignedManager && prop.managerId !== user?.uid) {
            if (userEmailLower && prop.managerEmail && prop.managerEmail.toLowerCase() === userEmailLower) {
              return false;
            }
            if (userEmailLower && prop.ownerEmail && prop.ownerEmail.toLowerCase() === userEmailLower) {
              return false;
            }
            return true;
          }
          // Unassigned properties belong to the signed-in user!
          return false;
        });
        if (unauthorized) {
          toast.error('Permission denied: You can only manage your own properties.');
          return;
        }
      }

      const targetProps = properties.filter(p => targetIds.includes(p.id!));
      const targetNames = targetProps.map(p => p.name);
      let actionSummaryText = '';

      // 1. AMENITY OPERATIONS (add_amenity, remove_amenity, update_amenities, or has amenity field)
      const isAmenityOp = 
        action.type === 'add_amenity' || 
        action.type === 'remove_amenity' || 
        action.type === 'update_amenities' || 
        Boolean(action.amenity) || 
        Boolean(action.amenities);

      if (isAmenityOp) {
        const amenityValue = (action.amenity || 'Breakfast Included').trim();

        for (const hid of targetIds) {
          const hotel = properties.find(p => p.id === hid);
          const currentAmenities = hotel?.amenities || [];
          let updatedAmenities: string[] = [];

          if (action.type === 'remove_amenity') {
            updatedAmenities = currentAmenities.filter(a => a.toLowerCase() !== amenityValue.toLowerCase());
          } else if (action.type === 'update_amenities' && action.amenities) {
            updatedAmenities = action.amenities;
          } else {
            // add_amenity
            const exists = currentAmenities.some(a => a.toLowerCase() === amenityValue.toLowerCase());
            updatedAmenities = exists ? currentAmenities : [...currentAmenities, amenityValue];
          }

          await updateDoc(doc(db, 'hotels', hid), { amenities: updatedAmenities });
        }

        // Update local React state so all screens & cards update instantly
        setProperties(prev => prev.map(p => {
          if (!targetIds.includes(p.id!)) return p;
          const currentAmenities = p.amenities || [];
          let updatedAmenities: string[] = [];
          if (action.type === 'remove_amenity') {
            updatedAmenities = currentAmenities.filter(a => a.toLowerCase() !== amenityValue.toLowerCase());
          } else if (action.type === 'update_amenities' && action.amenities) {
            updatedAmenities = action.amenities;
          } else {
            const exists = currentAmenities.some(a => a.toLowerCase() === amenityValue.toLowerCase());
            updatedAmenities = exists ? currentAmenities : [...currentAmenities, amenityValue];
          }
          return { ...p, amenities: updatedAmenities };
        }));

        // Continuous Learning: Teach assistant this preference permanently
        if (user?.uid) {
          const ruleText = `Host provides complimentary ${amenityValue} across managed properties (${targetNames.join(', ')}).`;
          addLearnedDirective(user.uid, ruleText, userIsAdmin ? 'admin' : 'hotel_manager');
          setLearnedRules(getLearnedDirectives(user.uid));
        }

        actionSummaryText = `Added **"${amenityValue}"** to ${targetIds.length === 1 ? `**${targetNames[0]}**` : `all **${targetIds.length} properties** (${targetNames.join(', ')})`}.`;
        toast.success(`Added "${amenityValue}" to ${targetIds.length} ${targetIds.length === 1 ? 'lodge' : 'lodges'}!`, { icon: '🥞' });

      // 2. PROPERTY POLICY OPERATIONS
      } else if (action.type === 'update_property_policy' || action.policyField) {
        const field = action.policyField || 'cancellationPolicy';
        const value = action.policyValue ?? 'Standard';

        for (const hid of targetIds) {
          await updateDoc(doc(db, 'hotels', hid), { [field]: value });
        }

        setProperties(prev => prev.map(p => targetIds.includes(p.id!) ? { ...p, [field]: value } : p));

        if (user?.uid) {
          const ruleText = `Standard ${field} policy for ${targetNames.join(', ')} is "${value}".`;
          addLearnedDirective(user.uid, ruleText, userIsAdmin ? 'admin' : 'hotel_manager');
          setLearnedRules(getLearnedDirectives(user.uid));
        }

        actionSummaryText = `Updated policy **${field}** to **"${value}"** across ${targetIds.length} properties.`;
        toast.success(`Updated ${field} across ${targetIds.length} properties!`, { icon: '✅' });

      // 3. ONLINE / OFFLINE TOGGLE
      } else if (action.type === 'update_property_online' || action.isOnline !== undefined) {
        const isOnline = Boolean(action.isOnline);
        for (const hid of targetIds) {
          const updateData: any = { isOnline };
          if (action.outOfOfficeMessage !== undefined) {
            updateData.outOfOfficeMessage = action.outOfOfficeMessage;
          }
          await updateDoc(doc(db, 'hotels', hid), updateData);
        }

        setProperties(prev => prev.map(p => targetIds.includes(p.id!) ? {
          ...p,
          isOnline,
          ...(action.outOfOfficeMessage !== undefined ? { outOfOfficeMessage: action.outOfOfficeMessage } : {}),
        } : p));

        actionSummaryText = `Set ${targetIds.length === 1 ? targetNames[0] : `${targetIds.length} properties`} to ${isOnline ? '🟢 **ONLINE** (Accepting Bookings)' : '🌙 **OFFLINE**'}.`;
        toast.success(`${targetIds.length} properties are now ${isOnline ? 'Online' : 'Offline'}!`, { icon: '✅' });

      // 4. DAILY BOARD (StayOS)
      } else if (action.type === 'update_daily_board' || action.dishOfTheDay || action.activities) {
        for (const hid of targetIds) {
          const hotel = properties.find(p => p.id === hid);
          const currentBoard = hotel?.dailyBoard || {};
          const newBoard = {
            ...currentBoard,
            ...(action.dishOfTheDay ? { dishOfTheDay: action.dishOfTheDay } : {}),
            ...(action.activities ? { activities: action.activities } : {}),
          };
          await updateDoc(doc(db, 'hotels', hid), { dailyBoard: newBoard });
        }

        setProperties(prev => prev.map(p => {
          if (!targetIds.includes(p.id!)) return p;
          return {
            ...p,
            dailyBoard: {
              ...(p.dailyBoard || {}),
              ...(action.dishOfTheDay ? { dishOfTheDay: action.dishOfTheDay } : {}),
              ...(action.activities ? { activities: action.activities } : {}),
            },
          };
        }));

        actionSummaryText = `Updated StayOS Daily Board (Dish of the Day: "${action.dishOfTheDay || 'Updated'}") for ${targetIds.length} properties.`;
        toast.success(`Updated Daily Board across ${targetIds.length} properties!`, { icon: '🍽️' });

      // 5. RESTAURANT / MENUS
      } else if (action.type === 'add_restaurant_dish' && action.dishName) {
        for (const hid of targetIds) {
          const hotel = properties.find(p => p.id === hid);
          const rest = hotel?.restaurant || { enabled: true, name: 'Lodge Dining', sections: [] };
          const sections = rest.sections || [];
          const sectionName = action.dishSection || 'Breakfast';
          
          let targetSec = sections.find(s => s.name.toLowerCase() === sectionName.toLowerCase());
          const newDish = {
            id: `dish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: action.dishName,
            description: action.dishDescription || 'Specialty item',
            priceUSD: action.dishPriceUSD || 0,
            priceMWK: action.dishPriceMWK || 0,
            available: true,
          };

          const updatedSections = targetSec
            ? sections.map(s => s.name.toLowerCase() === sectionName.toLowerCase() 
                ? { ...s, items: [...(s.items || []), newDish] } 
                : s)
            : [...sections, { name: sectionName, items: [newDish] }];

          await updateDoc(doc(db, 'hotels', hid), {
            restaurant: {
              ...rest,
              enabled: true,
              sections: updatedSections,
            },
          });
        }

        actionSummaryText = `Added **"${action.dishName}"** (${action.dishSection || 'Breakfast'}) to restaurant menus for ${targetIds.length} properties.`;
        toast.success(`Added dish to dining menu!`, { icon: '🍳' });

      // 6. ROOM PRICE
      } else if (action.type === 'update_room_price') {
        if (!action.roomId) {
          toast.error('Room ID missing from proposal.');
          return;
        }
        const roomRef = doc(db, 'room_types', action.roomId);
        const targetRoom = rooms.find(r => r.id === action.roomId);
        const existingPrices = targetRoom?.prices || {};
        const currency = (action.currency || 'USD').toUpperCase();
        const newPrice = Number(action.newPrice);

        const updateData: any = {
          prices: {
            ...existingPrices,
            [currency]: newPrice,
          },
        };
        if (currency === 'USD') updateData.price = newPrice;
        else if (currency === 'MWK') updateData.priceMWK = newPrice;

        await updateDoc(roomRef, updateData);

        setRooms(prev => prev.map(r => r.id === action.roomId ? {
          ...r,
          prices: { ...(r.prices || {}), [currency]: newPrice },
          ...(currency === 'USD' ? { price: newPrice } : {}),
          ...(currency === 'MWK' ? { priceMWK: newPrice } : {}),
        } : r));

        actionSummaryText = `Updated rate for **${action.roomName || 'room'}** at **${action.hotelName || 'Property'}** to **${currency} ${newPrice.toLocaleString()}**.`;
        toast.success(`Updated room rate!`, { icon: '💰' });

      // 7. BOOKING STATUS
      } else if (action.type === 'update_booking_status') {
        if (!action.bookingId || !action.newStatus) {
          toast.error('Booking ID or status missing.');
          return;
        }
        await updateDoc(doc(db, 'bookings', action.bookingId), { status: action.newStatus });
        setBookings(prev => prev.map(b => b.id === action.bookingId ? { ...b, status: action.newStatus as any } : b));
        actionSummaryText = `Updated booking **${action.bookingRef || action.bookingId}** status to **${action.newStatus}**.`;
        toast.success(`Booking status updated!`, { icon: '📅' });

      // 8. ADMIN LISTING APPROVAL / FEATURED
      } else if (action.type === 'update_property_status') {
        if (!userIsAdmin) {
          toast.error('Permission denied: Only Global Administrators can approve/reject listings.');
          return;
        }
        for (const hid of targetIds) {
          await updateDoc(doc(db, 'hotels', hid), { status: action.newStatus });
        }
        setProperties(prev => prev.map(p => targetIds.includes(p.id!) ? { ...p, status: action.newStatus as any } : p));
        actionSummaryText = `Updated listing status to **"${action.newStatus}"** for ${targetIds.length} properties.`;
        toast.success(`Listing status updated!`);

      } else if (action.type === 'toggle_featured') {
        if (!userIsAdmin) {
          toast.error('Permission denied: Admin only.');
          return;
        }
        const featured = Boolean(action.featured);
        for (const hid of targetIds) {
          await updateDoc(doc(db, 'hotels', hid), { featured, featuredAt: featured ? Date.now() : null });
        }
        setProperties(prev => prev.map(p => targetIds.includes(p.id!) ? { ...p, featured } : p));
        actionSummaryText = `${featured ? '🌟 Featured' : 'Removed from featured'} ${targetIds.length} properties on the homepage.`;
        toast.success(`Homepage featured status updated!`);

      // 9. INTELLIGENT UNIVERSAL FALLBACK (Prevents any proposal from failing silently)
      } else {
        // If there's an amenity field
        if (action.amenity) {
          for (const hid of targetIds) {
            const h = properties.find(p => p.id === hid);
            const current = h?.amenities || [];
            if (!current.includes(action.amenity)) {
              await updateDoc(doc(db, 'hotels', hid), { amenities: [...current, action.amenity] });
            }
          }
          actionSummaryText = `Added "${action.amenity}" to ${targetIds.length} properties.`;
        } else {
          actionSummaryText = `Executed operational update across ${targetIds.length} properties.`;
        }
        toast.success('Operational update applied successfully!');
      }

      // Mark action applied on this message
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionApplied: true } : m));

      // Append assistant confirmation message
      setMessages(prev => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          role: 'assistant',
          content: `✅ **Applied Successfully:** ${actionSummaryText}\n\n*Updated ${targetIds.length} properties (${targetNames.join(', ')}). All live listings, guest search views, and dashboards reflect this change immediately.*`,
          timestamp: Date.now(),
        },
      ]);

    } catch (err: any) {
      console.error('Failed to execute action:', err);
      toast.error(err?.message || 'Failed to execute proposed update');
    } finally {
      setExecutingAction(null);
    }
  };

  const handleDismissAction = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionRejected: true } : m));
    toast('Action dismissed', { icon: 'ℹ️' });
  };

  const handleAddCustomDirective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectiveInput.trim() || !user?.uid) return;
    addLearnedDirective(user.uid, newDirectiveInput.trim(), userIsAdmin ? 'admin' : 'hotel_manager');
    setLearnedRules(getLearnedDirectives(user.uid));
    setNewDirectiveInput('');
    toast.success('Added new directive to Copilot memory!');
  };

  const handleDeleteDirective = (id: string) => {
    if (!user?.uid) return;
    removeLearnedDirective(user.uid, id);
    setLearnedRules(getLearnedDirectives(user.uid));
    toast.success('Directive removed');
  };

  // Strict AI Availability Check:
  // If user is not authorized, or AI is disabled, or no valid API key is configured,
  // do not render the concierge avatar, modal, or any background operations.
  if (!isAuthorized || !aiStatus.enabled || !aiStatus.available) {
    return null;
  }

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. CHARMING CONCIERGE AVATAR TRIGGER BUTTON (z-[140] on top)  */}
      {/* ------------------------------------------------------------- */}
      <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-[140] pointer-events-none">
        <motion.button
          type="button"
          id="btn-concierge-copilot-trigger"
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              setIsMinimized(false);
              setTimeout(() => chatInputRef.current?.focus(), 250);
            } else if (isMinimized) {
              setIsMinimized(false);
              setTimeout(() => chatInputRef.current?.focus(), 150);
            } else {
              setIsMinimized(true);
            }
          }}
          className={`pointer-events-auto relative group flex items-center justify-center w-12 h-12 rounded-full bg-stone-900/95 hover:bg-stone-900 text-stone-100 shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-stone-700/80 hover:border-amber-400/70 backdrop-blur-md transition-all cursor-pointer select-none ${
            isOpen && isMinimized ? 'ring-2 ring-amber-400/70 shadow-[0_0_20px_rgba(251,191,36,0.3)]' : ''
          }`}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          title={isOpen && !isMinimized ? 'Minimize Concierge' : isOpen && isMinimized ? 'Expand Concierge Assistant (Active)' : 'Concierge Assistant'}
          aria-label="Concierge Assistant"
        >
          {/* Little Concierge Avatar Fella */}
          <ConciergeAvatar size="md" isOnline={true} />

          {/* Active session pulse dot when minimized */}
          {isOpen && isMinimized && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-stone-900 animate-pulse" />
          )}
        </motion.button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. REFINED OPERATIONS DRAWER (z-[150] strictly above navbar)  */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {/* Backdrop for full-sheet touch and desktop dismissal */}
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMinimized(true)}
            className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs z-[145]"
          />
        )}

        {isOpen && !isMinimized && (
          <motion.div
            data-lenis-prevent="true"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`fixed z-[150] bg-white shadow-2xl border border-stone-200/90 flex flex-col overflow-hidden transition-[width,height,inset] duration-200 ${
              isExpanded
                ? 'inset-x-0 bottom-0 top-4 sm:inset-x-auto sm:top-auto sm:bottom-16 sm:right-6 sm:w-[580px] sm:h-[calc(100dvh-5rem)] rounded-t-3xl sm:rounded-2xl'
                : 'inset-x-0 bottom-0 top-10 sm:inset-x-auto sm:top-auto sm:bottom-20 sm:right-6 sm:w-[460px] h-[calc(100dvh-2.5rem)] sm:h-[680px] sm:max-h-[calc(100dvh-6.5rem)] sm:min-h-[520px] rounded-t-3xl sm:rounded-2xl'
            }`}
          >
            {/* TOP HEADER */}
            <div className="bg-stone-900 text-white p-3 pt-[max(12px,env(safe-area-inset-top))] sm:pt-3 px-3.5 sm:px-4 flex flex-col border-b border-stone-800 shrink-0">
              {/* Mobile grab handle */}
              <div className="w-10 h-1 bg-stone-700/80 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                  <ConciergeAvatar size="sm" isOnline={true} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h3 className="text-xs font-bold text-stone-100 tracking-wide flex items-center gap-1 sm:gap-1.5 truncate">
                        {userIsAdmin ? 'Platform Concierge' : 'Lodge Concierge'}
                        <ConciergeBell className="w-3 h-3 text-amber-400 shrink-0" />
                      </h3>
                      <span className="text-[9px] font-semibold bg-stone-800 text-stone-300 border border-stone-700 px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                        {userIsAdmin ? 'Admin' : 'Manager'}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 truncate max-w-[170px] sm:max-w-[200px]">
                      {userIsAdmin
                        ? `Executive hospitality desk • ${properties.length} properties`
                        : properties.length === 1
                        ? `At your service at ${properties[0].name}`
                        : `At your service • ${properties.length} assigned lodges`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1 text-stone-400 shrink-0">
                  {/* Rules & Directives tab toggle */}
                  <button
                    type="button"
                    onClick={() => setViewingMemory(prev => !prev)}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${viewingMemory ? 'bg-stone-800 text-stone-200' : 'hover:bg-stone-800 hover:text-stone-200'}`}
                    title="Operating Rules & Preferences"
                  >
                    <div className="relative">
                      <Sliders className="w-3.5 h-3.5" />
                      {learnedRules.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-stone-700 text-stone-200 font-bold text-[8px] w-3 h-3 rounded-full flex items-center justify-center">
                          {learnedRules.length}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expand / Collapse toggle (Desktop) */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(prev => !prev)}
                    className="hidden sm:inline-flex p-1.5 hover:bg-stone-800 hover:text-stone-200 rounded-lg transition cursor-pointer"
                    title={isExpanded ? "Collapse to standard size" : "Expand window"}
                  >
                    {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>

                  {/* Reset / End Chat */}
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      toast.success('Session chat cleared.');
                    }}
                    className="p-1.5 hover:bg-stone-800 hover:text-stone-200 rounded-lg transition cursor-pointer"
                    title="Clear conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Minimize window */}
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="p-1.5 hover:bg-stone-800 hover:text-stone-200 rounded-lg transition cursor-pointer"
                    title="Minimize window"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  {/* Close window */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsMinimized(false);
                    }}
                    className="p-1.5 hover:bg-stone-800 hover:text-stone-200 rounded-lg transition cursor-pointer"
                    title="Close Assistant"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* LIVE SNAPSHOT STATUS BAR */}
            <div className="bg-stone-50 border-b border-stone-200 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-stone-600 shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-stone-400" />
                <span className="font-semibold text-stone-700">{todayStr}</span>
                <span>•</span>
                <span>{properties.length} {properties.length === 1 ? 'property' : 'properties'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 font-medium ${arrivalsCountToday > 0 ? 'text-amber-700 font-bold' : 'text-stone-500'}`}>
                  {arrivalsCountToday} arrival{arrivalsCountToday === 1 ? '' : 's'} today
                </span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 font-medium ${departuresCountToday > 0 ? 'text-stone-700' : 'text-stone-400'}`}>
                  {departuresCountToday} out
                </span>
              </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div
              ref={chatScrollContainerRef}
              data-lenis-prevent="true"
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden break-words p-4 sm:p-4.5 space-y-4 bg-stone-100/40 overscroll-contain"
            >
              {viewingMemory ? (
                /* -------------------------------------------------- */
                /* DIRECTIVES & SELF-PATCHING MEMORY DRAWER           */
                /* -------------------------------------------------- */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                        Learned Directives & Operational Rules
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        The AI remembers your rules, policies, and pricing preferences.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingMemory(false)}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      Back to chat
                    </button>
                  </div>

                  {/* Add New Directive Form */}
                  <form onSubmit={handleAddCustomDirective} className="flex gap-2">
                    <input
                      type="text"
                      value={newDirectiveInput}
                      onChange={e => setNewDirectiveInput(e.target.value)}
                      placeholder="e.g. Remember: lakefront chalet checkout is 10:30 AM"
                      className="flex-1 text-xs px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
                    />
                    <button
                      type="submit"
                      disabled={!newDirectiveInput.trim()}
                      className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Save Rule
                    </button>
                  </form>

                  {/* List of Directives */}
                  <div className="space-y-2">
                    {learnedRules.length === 0 ? (
                      <div className="p-4 bg-white rounded-2xl border border-stone-200 text-center text-xs text-stone-500">
                        No custom directives saved yet. Directives you teach the copilot will show up here.
                      </div>
                    ) : (
                      learnedRules.map((rule, rIdx) => (
                        <div
                          key={`${rule.id}-${rIdx}`}
                          className="p-3 bg-white rounded-xl border border-stone-200 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <p className="text-stone-800 leading-relaxed">{rule.text}</p>
                            <span className="text-[10px] text-stone-400">
                              {new Date(rule.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteDirective(rule.id)}
                            className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Remove directive"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* -------------------------------------------------- */
                /* CONVERSATION STREAM                                 */
                /* -------------------------------------------------- */
                <>
                  {messages.map((msg, mIdx) => (
                    <div
                      key={`${msg.id}-${mIdx}`}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full min-w-0`}
                    >
                      <div
                        className={`max-w-[92%] sm:max-w-[88%] min-w-0 rounded-2xl p-3.5 text-xs leading-relaxed break-words [word-break:break-word] overflow-hidden ${
                          msg.role === 'user'
                            ? 'bg-stone-900 text-white rounded-br-xs'
                            : 'bg-white text-stone-800 border border-stone-200 shadow-2xs rounded-bl-xs'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="markdown-body space-y-1.5 text-stone-800 break-words [word-break:break-word] overflow-hidden max-w-full min-w-0">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => (
                                  <p className="leading-relaxed break-words [word-break:break-word]">{children}</p>
                                ),
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    className="text-stone-900 underline font-semibold hover:text-amber-700 inline-flex items-center gap-0.5 break-all"
                                  >
                                    {children}
                                    <ExternalLink className="w-2.5 h-2.5 inline opacity-70 shrink-0" />
                                  </a>
                                ),
                                pre: ({ children }) => (
                                  <pre className="overflow-x-auto max-w-full p-2 bg-stone-900 text-stone-100 rounded-lg text-[11px] my-1 scrollbar-thin">
                                    {children}
                                  </pre>
                                ),
                                code: ({ children }) => (
                                  <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px] font-mono break-all">
                                    {children}
                                  </code>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto max-w-full my-2 border border-stone-200 rounded-lg">
                                    <table className="min-w-full text-[11px] divide-y divide-stone-200">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc pl-4 space-y-1 my-1 break-words">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal pl-4 space-y-1 my-1 break-words">
                                    {children}
                                  </ol>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words [word-break:break-word] min-w-0">{msg.content}</p>
                        )}
                      </div>

                      {/* ACTION PROPOSAL CARDS */}
                      {msg.actionProposal && (() => {
                        const proposal = msg.actionProposal;
                        const effectiveTargetIds = getEffectiveHotelIds(msg.id, proposal);
                        const isAllSelected = properties.length > 0 && effectiveTargetIds.length === properties.length;
                        const hasMultipleProperties = properties.length > 1;
                        const targetProps = properties.filter(p => effectiveTargetIds.includes(p.id!));
                        const isAmenityProposal = 
                          proposal.type === 'add_amenity' || 
                          proposal.type === 'remove_amenity' || 
                          proposal.type === 'update_amenities' || 
                          Boolean(proposal.amenity);

                        return (
                          <div className="w-full max-w-[95%] mt-2.5 p-3 bg-stone-50 border border-stone-300/80 rounded-2xl space-y-2.5 animate-in fade-in shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-stone-900 font-bold text-xs uppercase tracking-wider">
                                {isAmenityProposal ? (
                                  <Utensils className="w-3.5 h-3.5 text-amber-700" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-700" />
                                )}
                                <span>
                                  {isAmenityProposal && (proposal.type === 'remove_amenity' ? 'Proposed Amenity Removal' : 'Proposed Amenity Addition')}
                                  {proposal.type === 'update_room_price' && 'Proposed Rate Change'}
                                  {proposal.type === 'update_property_online' && 'Proposed Status Change'}
                                  {proposal.type === 'update_property_policy' && 'Proposed Policy Update'}
                                  {proposal.type === 'update_daily_board' && 'StayOS Daily Board Update'}
                                  {proposal.type === 'add_restaurant_dish' && 'Dining Menu Addition'}
                                  {proposal.type === 'update_booking_status' && 'Proposed Booking Change'}
                                  {proposal.type === 'update_property_status' && 'Listing Approval / Status'}
                                  {proposal.type === 'toggle_featured' && 'Homepage Featured Listing'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] bg-amber-100/90 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md font-semibold">
                                  Confirmation Required
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                                  isAllSelected 
                                    ? 'bg-stone-200 text-stone-800' 
                                    : effectiveTargetIds.length > 1 
                                    ? 'bg-stone-200 text-stone-800' 
                                    : 'bg-stone-200 text-stone-700'
                                }`}>
                                  {isAllSelected 
                                    ? `All ${properties.length} Properties` 
                                    : effectiveTargetIds.length > 1 
                                    ? `${effectiveTargetIds.length} Properties` 
                                    : 'Single Property'}
                                </span>
                              </div>
                            </div>

                            {/* TARGET SELECTION CONTROLS (Allows applying changes to all properties or specific ones) */}
                            {hasMultipleProperties && !msg.actionApplied && !msg.actionRejected && (
                              <div className="p-2.5 bg-stone-100/90 rounded-xl border border-stone-200/90 space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1">
                                    <Layers className="w-3 h-3 text-stone-500" /> Target Properties:
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAllHotelsForProposal(msg.id)}
                                      className={`text-[10px] px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                                        isAllSelected
                                          ? 'bg-amber-600 text-white shadow-2xs'
                                          : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
                                      }`}
                                    >
                                      All ({properties.length})
                                    </button>
                                  </div>
                                </div>

                                {/* Property Toggle Chips */}
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {properties.map((p, pIdx) => {
                                    const selected = effectiveTargetIds.includes(p.id!);
                                    return (
                                      <button
                                        key={`${p.id}-${pIdx}`}
                                        type="button"
                                        onClick={() => handleToggleHotelForProposal(msg.id, p.id!, effectiveTargetIds)}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                                          selected
                                            ? 'bg-white border-amber-500/80 text-stone-900 shadow-2xs'
                                            : 'bg-stone-200/60 border-stone-300 text-stone-500 hover:bg-stone-200'
                                        }`}
                                      >
                                        <div className={`w-3 h-3 rounded flex items-center justify-center border ${
                                          selected ? 'bg-amber-600 border-amber-600 text-white' : 'border-stone-400 bg-white'
                                        }`}>
                                          {selected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                        </div>
                                        <span className="truncate max-w-[130px]">{p.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {!isAllSelected && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllHotelsForProposal(msg.id)}
                                    className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold underline flex items-center gap-1 pt-0.5 cursor-pointer"
                                  >
                                    <CheckCheck className="w-3 h-3" /> Apply to all {properties.length} properties instead
                                  </button>
                                )}
                              </div>
                            )}

                            {/* DETAIL PREVIEW BOX */}
                            <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-xs space-y-1.5">
                              {/* Amenity Details */}
                              {isAmenityProposal && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-stone-500 font-medium">Amenity:</span>
                                    <span className="font-bold text-stone-900 text-xs bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Coffee className="w-3 h-3 text-amber-700" />
                                      {proposal.amenity || 'Breakfast Included'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-stone-500">
                                    Target lodges: <strong className="text-stone-800">{targetProps.map(p => p.name).join(', ') || 'Selected properties'}</strong>
                                  </div>
                                  <p className="text-[11px] text-emerald-700 font-medium pt-0.5 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Will be published to live guest booking listings once confirmed.</span>
                                  </p>
                                </div>
                              )}

                              {/* Price update details */}
                              {proposal.type === 'update_room_price' && (
                                <div className="space-y-1">
                                  <div className="font-semibold text-stone-900">
                                    {proposal.hotelName} → {proposal.roomName || 'Room'}
                                  </div>
                                  <div className="flex items-center gap-2 text-stone-600">
                                    {proposal.oldPrice !== undefined && (
                                      <span className="line-through text-stone-400">
                                        {proposal.currency || 'USD'} {proposal.oldPrice}
                                      </span>
                                    )}
                                    <ArrowRight className="w-3 h-3 text-stone-400" />
                                    <span className="font-bold text-stone-900 text-sm">
                                      {proposal.currency || 'USD'} {proposal.newPrice?.toLocaleString()}
                                    </span>
                                    <span className="text-[11px] text-stone-500">/ night</span>
                                  </div>
                                </div>
                              )}

                              {/* Online / Offline toggle details */}
                              {proposal.type === 'update_property_online' && (
                                <div className="text-stone-700 text-xs space-y-0.5">
                                  <p>Front Desk Status: <strong className={proposal.isOnline ? 'text-emerald-700' : 'text-amber-700'}>{proposal.isOnline ? '🟢 Online (Accepting Bookings)' : '🌙 Offline'}</strong></p>
                                  {proposal.outOfOfficeMessage && (
                                    <p className="text-[11px] text-stone-500 italic">"{proposal.outOfOfficeMessage}"</p>
                                  )}
                                  <div className="text-[11px] text-stone-500">
                                    Properties: <strong className="text-stone-800">{targetProps.map(p => p.name).join(', ')}</strong>
                                  </div>
                                </div>
                              )}

                              {/* Policy update details */}
                              {proposal.type === 'update_property_policy' && (
                                <div className="text-stone-700 text-xs space-y-0.5">
                                  <p>Update <strong className="text-stone-900">{proposal.policyField}</strong> to: <strong className="text-stone-900 font-semibold">{String(proposal.policyValue)}</strong></p>
                                  <div className="text-[11px] text-stone-500">
                                    Properties: <strong className="text-stone-800">{targetProps.map(p => p.name).join(', ')}</strong>
                                  </div>
                                </div>
                              )}

                              {/* Daily board update */}
                              {proposal.type === 'update_daily_board' && (
                                <div className="text-stone-700 text-xs space-y-0.5">
                                  {proposal.dishOfTheDay && <p>Dish of the Day: <strong className="text-stone-900">{proposal.dishOfTheDay}</strong></p>}
                                  {proposal.activities && (
                                    <p>Activities: <strong className="text-stone-900">{Array.isArray(proposal.activities) ? proposal.activities.join(', ') : String(proposal.activities)}</strong></p>
                                  )}
                                </div>
                              )}

                              {/* Restaurant dish */}
                              {proposal.type === 'add_restaurant_dish' && (
                                <div className="text-stone-700 text-xs space-y-0.5">
                                  <p>Menu Dish: <strong className="text-stone-900">{proposal.dishName}</strong> ({proposal.dishSection || 'Breakfast'})</p>
                                  {proposal.dishPriceUSD && <p className="text-[11px] text-stone-500">Price: USD ${proposal.dishPriceUSD}</p>}
                                </div>
                              )}

                              {/* Booking status details */}
                              {proposal.type === 'update_booking_status' && (
                                <div className="text-stone-700 text-xs">
                                  Set Booking <strong className="text-stone-900">{proposal.bookingRef || proposal.bookingId}</strong> status to:{' '}
                                  <strong className="capitalize text-stone-900">{proposal.newStatus}</strong>
                                </div>
                              )}

                              {/* Property status details */}
                              {proposal.type === 'update_property_status' && (
                                <div className="text-stone-700 text-xs">
                                  Set listing status to: <strong className="capitalize text-stone-900">{proposal.newStatus}</strong>
                                </div>
                              )}

                              {/* Featured status details */}
                              {proposal.type === 'toggle_featured' && (
                                <div className="text-stone-700 text-xs">
                                  {proposal.featured ? 'Feature lodge on homepage' : 'Remove from featured row'}
                                </div>
                              )}
                            </div>

                            {msg.actionApplied ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs pt-1">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Action applied to live system</span>
                              </div>
                            ) : msg.actionRejected ? (
                              <div className="text-stone-400 text-xs italic pt-1">
                                Action dismissed
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleApplyAction(msg.id, proposal, effectiveTargetIds)}
                                  disabled={executingAction === msg.id}
                                  className="flex-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-xs"
                                >
                                  {executingAction === msg.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Applying Changes...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>
                                        Confirm & Apply to {isAllSelected && properties.length > 1 ? `All ${properties.length} Properties` : effectiveTargetIds.length > 1 ? `${effectiveTargetIds.length} Selected Lodges` : (targetProps[0]?.name || 'Property')}
                                      </span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismissAction(msg.id)}
                                  className="py-2 px-3 bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-xl text-xs font-medium transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}

                  {/* Generating Spinner */}
                  {generating && (
                    <div className="flex items-center gap-2 text-stone-500 text-xs p-2.5 bg-white rounded-2xl border border-stone-200 w-fit animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />
                      <span>{getGeneratingStatusText(activeQueryIntent, activeQueryText || lastUserMsg?.content || '')}</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* QUICK ACTION PROMPT CHIPS (CLEAN, EASY PILL UI) */}
            {!viewingMemory && (
              <div className="bg-stone-50/95 border-t border-stone-200/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {dynamicSuggestions && dynamicSuggestions.length > 0 ? (
                  dynamicSuggestions.map((suggestion, idx) => (
                    <button
                      key={`suggestion-${idx}-${suggestion.slice(0, 15)}`}
                      type="button"
                      onClick={() => handleSendMessage(suggestion)}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      {suggestion}
                    </button>
                  ))
                ) : userIsAdmin ? (
                  <>
                    <button
                      key="admin-chip-exec-summary"
                      type="button"
                      onClick={() => handleSendMessage('Give me an executive summary of today: platform arrivals, checkouts, and active listings.')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Executive Summary
                    </button>
                    <button
                      key="admin-chip-all-props"
                      type="button"
                      onClick={() => handleSendMessage('List all properties on the platform with their statuses and manager details.')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      All Properties
                    </button>
                    <button
                      key="admin-chip-rates-audit"
                      type="button"
                      onClick={() => handleSendMessage('Audit all room rates across the platform.')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Rates Audit
                    </button>
                    <button
                      key="admin-chip-reviews"
                      type="button"
                      onClick={() => handleSendMessage('What is guest sentiment and recent reviews across our properties?')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Guest Reviews
                    </button>
                    <button
                      key="admin-chip-tourism"
                      type="button"
                      onClick={() => handleSendMessage('Highlight top tourism experiences in Malawi for upcoming guests.')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Malawi Tourism Guide
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      key="mgr-chip-today-arrivals"
                      type="button"
                      onClick={() => handleSendMessage('Do I have any arrivals or bookings scheduled for today?')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Today's Arrivals
                    </button>
                    <button
                      key="mgr-chip-today-checkouts"
                      type="button"
                      onClick={() => handleSendMessage('Who is scheduled to check out today?')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Checkouts Today
                    </button>
                    <button
                      key="mgr-chip-my-rates"
                      type="button"
                      onClick={() => handleSendMessage('Show me all my room rates.')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      My Room Rates
                    </button>
                    <button
                      key="mgr-chip-guest-reviews"
                      type="button"
                      onClick={() => handleSendMessage('What are our guest reviews and average rating?')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Guest Reviews
                    </button>
                    <button
                      key="mgr-chip-excursions"
                      type="button"
                      onClick={() => handleSendMessage('Recommend local excursions, safari trips, and dining activities for our guests.')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Guest Concierge Ideas
                    </button>
                    <button
                      key="mgr-chip-wifi-power"
                      type="button"
                      onClick={() => handleSendMessage('What is our power backup, Wi-Fi password, and utility setup?')}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-200/90 hover:border-stone-300 text-stone-700 hover:text-stone-900 rounded-full text-xs font-medium transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none"
                    >
                      Wi-Fi & Power Setup
                    </button>
                  </>
                )}
              </div>
            )}

            {/* INPUT BAR */}
            <div className="p-3 sm:p-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-3.5 bg-white border-t border-stone-200 shrink-0">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder={
                    userIsAdmin
                      ? 'Executive query or adjust platform rates/status...'
                      : 'Ask about bookings, checkouts, or adjust room rates...'
                  }
                  disabled={generating}
                  className="flex-1 text-sm sm:text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 disabled:opacity-60 transition"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || generating}
                  className="w-10 h-10 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl transition shadow-2xs flex items-center justify-center shrink-0 cursor-pointer"
                  title="Send query"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                  ) : (
                    <Send className="w-4 h-4 text-stone-300" />
                  )}
                </button>
              </form>
              <div className="flex items-center justify-between text-[10px] text-stone-400 px-1 pt-1.5">
                <span>{userIsAdmin ? 'Platform Administrator Scope' : 'Scoped to your managed property'}</span>
                <span className="flex items-center gap-1 text-stone-500">
                  <ShieldAlert className="w-3 h-3 text-stone-400" />
                  Modifications require confirmation
                </span>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </>
  );
}
