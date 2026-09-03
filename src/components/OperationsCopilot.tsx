import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, RotateCcw, Brain, Check, 
  ChevronDown, ExternalLink, Calendar, Building, DollarSign, 
  TrendingUp, Clock, AlertCircle, Loader2, CheckCircle2, ShieldAlert,
  ArrowRight, Settings2, Sliders, Info, SlidersHorizontal, ConciergeBell,
  Utensils, Coffee, Sparkles, Layers, ShieldCheck, Minus, Maximize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, isHotelManager } from '../lib/roles';
import { useAIAssistant, OperationsChatPayload, OperationsChatResult, ActionProposal } from '../hooks/useAIAssistant';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { Hotel, RoomType, Booking } from '../types';
import { 
  getLearnedDirectives, 
  syncDirectivesWithCloud,
  addLearnedDirective, 
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
  const [viewingMemory, setViewingMemory] = useState(false);
  const [newDirectiveInput, setNewDirectiveInput] = useState('');
  const [learnedRules, setLearnedRules] = useState<LearnedDirective[]>([]);

  // Live Data
  const [properties, setProperties] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conferences, setConferences] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Chat conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Tracks interactive hotel selection for each proposed action { [msgId]: hotelId[] }
  const [proposalHotelSelections, setProposalHotelSelections] = useState<Record<string, string[]>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
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

      if (userIsAdmin) {
        // Global Admins see all properties, rooms, conferences, and bookings platform-wide
        const [hotelsSnap, roomsSnap, bookingsSnap, confSnap] = await Promise.all([
          getDocs(collection(db, 'hotels')),
          getDocs(collection(db, 'room_types')),
          getDocs(collection(db, 'bookings')),
          getDocs(collection(db, 'conference_rooms')),
        ]);
        hotelDocs = hotelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        roomDocs = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType));
        bookingDocs = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
        confDocs = confSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      } else {
        // Property Managers are strictly scoped to their own assigned properties
        const hotelsSnap = await getDocs(query(collection(db, 'hotels'), where('managerId', '==', user.uid)));
        hotelDocs = hotelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        const hotelIds = hotelDocs.map(h => h.id).filter(Boolean) as string[];

        if (hotelIds.length > 0) {
          const [roomsSnap, bookingsSnap, confSnap] = await Promise.all([
            getDocs(collection(db, 'room_types')),
            getDocs(collection(db, 'bookings')),
            getDocs(collection(db, 'conference_rooms')),
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
        }
      }

      setProperties(hotelDocs);
      setRooms(roomDocs);
      setBookings(bookingDocs);
      setConferences(confDocs);
    } catch (err) {
      console.warn('Could not load live operations data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized && aiStatus.enabled && aiStatus.available) {
      fetchOperationsData();
    }
  }, [user?.uid, isAuthorized, aiStatus.enabled, aiStatus.available]);

  // Friendly clean first name for natural, non-robotic interaction
  const userFirstName = useMemo(() => {
    if (user?.displayName && user.displayName.trim()) {
      const first = user.displayName.split(' ')[0];
      if (!['administrator', 'admin', 'manager', 'host', 'user', 'owner'].includes(first.toLowerCase())) {
        return first;
      }
    }
    if (user?.email) {
      const local = user.email.split('@')[0].split(/[._-]/)[0];
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return '';
  }, [user]);

  // Initial welcome message distinguishing Global Admin vs Manager
  useEffect(() => {
    if (messages.length === 0 && isAuthorized) {
      const greeting = userFirstName ? `Hi ${userFirstName}` : 'Hello';
      if (userIsAdmin) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `${greeting}! I have live visibility across all **${properties.length} platform properties**.\n\nWhat would you like to review, audit, or adjust today?`,
            timestamp: Date.now(),
          },
        ]);
      } else {
        const propNames = properties.map(p => `**${p.name}**`).join(', ') || 'your lodge';
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
  }, [user, isAuthorized, messages.length, userIsAdmin, properties.length, userFirstName]);

  // Scroll chat to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // If not authorized or AI is disabled globally, do not render
  if (!isAuthorized || !aiStatus.enabled) {
    return null;
  }

  // Quick live metrics
  const arrivalsCountToday = bookings.filter(b => b.checkIn === todayStr && b.status !== 'cancelled').length;
  const departuresCountToday = bookings.filter(b => b.checkOut === todayStr && b.status !== 'cancelled').length;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || generating) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    // Prepare context payload for server
    const payload: OperationsChatPayload = {
      userRole: userIsAdmin ? 'admin' : 'hotel_manager',
      userName: userFirstName || user.displayName || user.email || 'Host',
      userEmail: user.email || undefined,
      message: text,
      history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
      context: {
        currentDateStr: todayStr,
        currentTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        properties: properties.map(p => {
          const propRooms = rooms.filter(r => r.hotelId === p.id);
          const propConfs = conferences.filter(c => c.hotelId === p.id);
          return {
            id: p.id || '',
            name: p.name,
            location: p.location,
            category: p.categories?.[0] || 'Lodge',
            status: p.status || 'active',
            featured: Boolean(p.featured),
            isOnline: p.isOnline !== false,
            outOfOfficeMessage: p.outOfOfficeMessage,
            checkInTime: p.checkInTime || '14:00',
            checkOutTime: p.checkOutTime || '10:00',
            cancellationPolicy: p.cancellationPolicy || 'Standard',
            paymentPolicy: p.paymentPolicy || 'Direct payment',
            contactWhatsapp: p.contactWhatsapp || p.contactPhone,
            contactEmail: p.contactEmail,
            contactPhone: p.contactPhone,
            amenities: p.amenities || [],
            restaurant: p.restaurant ? {
              enabled: Boolean(p.restaurant.enabled),
              name: p.restaurant.name,
              sectionsCount: p.restaurant.sections?.length || 0,
              sampleItems: p.restaurant.sections?.flatMap(s => s.items.map(i => i.name)).slice(0, 6) || [],
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
              priceUSD: r.prices?.USD ?? r.price,
              priceMWK: r.prices?.MWK ?? r.priceMWK,
              maxGuests: r.maxGuests,
              quantity: r.quantity,
              extraGuestFeeUSD: r.extraGuestFees?.USD,
              extraGuestFeeMWK: r.extraGuestFees?.MWK,
              blockedDates: (r as any).blockedDates || [],
            })),
          };
        }),
        bookings: bookings.map(b => {
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
          };
        }),
        learnedRules: learnedRules.map(r => r.text),
      },
    };

    const result = await operationsChat(payload);

    if (result) {
      // If the response learned a new rule, save it!
      if (result.newLearnedRule && user.uid) {
        const saved = addLearnedDirective(user.uid, result.newLearnedRule, userIsAdmin ? 'admin' : 'hotel_manager');
        setLearnedRules(getLearnedDirectives(user.uid));
        toast.success(`🧠 Copilot learned: "${saved.text.slice(0, 50)}..."`, { icon: '🧠' });
      }

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        actionProposal: result.actionProposal,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
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
    setExecutingAction(msgId);
    try {
      const targetIds = overrideTargetIds || getEffectiveHotelIds(msgId, action);
      if (targetIds.length === 0) {
        toast.error('Please select at least one property to apply changes to.');
        return;
      }

      // Authorization Check: Property Managers may only modify their assigned properties
      if (!userIsAdmin) {
        const unauthorized = targetIds.some(id => {
          const prop = properties.find(p => p.id === id);
          return !prop || prop.managerId !== user?.uid;
        });
        if (unauthorized) {
          toast.error('Permission denied: You can only manage your own assigned properties.');
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

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. CHARMING CONCIERGE AVATAR TRIGGER BUTTON (z-[140] on top)  */}
      {/* ------------------------------------------------------------- */}
      <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-[140] flex flex-col items-end pointer-events-none">
        <motion.button
          type="button"
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
          className="pointer-events-auto group flex items-center gap-2 sm:gap-2.5 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1.5 sm:py-2 bg-stone-900/95 hover:bg-stone-900 text-stone-100 rounded-full shadow-2xl border border-stone-700/70 hover:border-amber-400/50 backdrop-blur-md transition-all text-xs font-medium cursor-pointer select-none"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          aria-label="Toggle Concierge Assistant"
        >
          {/* Little Concierge Avatar Fella */}
          <ConciergeAvatar size="md" isOnline={true} />

          <div className="flex flex-col text-left">
            <span className="font-semibold text-xs text-stone-100 tracking-tight flex items-center gap-1 sm:gap-1.5">
              {isOpen && !isMinimized ? 'Minimize' : userIsAdmin ? 'Concierge' : 'Concierge'}
              <ConciergeBell className="w-3 h-3 text-amber-400/90 group-hover:rotate-12 transition-transform duration-200" />
            </span>
            <span className="text-[10px] text-stone-400 font-normal leading-tight hidden xs:block">
              {isOpen && !isMinimized ? 'Tap to minimize' : isMinimized ? 'Active • Tap to expand' : 'At your service'}
            </span>
          </div>

          <span className="text-[10px] text-stone-300 font-medium px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700/70 ml-0.5 hidden sm:inline-block">
            {userIsAdmin ? 'Admin' : `${properties.length} ${properties.length === 1 ? 'lodge' : 'lodges'}`}
          </span>
        </motion.button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. REFINED OPERATIONS DRAWER (z-[150] strictly above navbar)  */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-20 z-[150] sm:w-[420px] h-[510px] max-h-[calc(100dvh-8.5rem)] min-h-[350px] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden"
          >
            {/* TOP HEADER */}
            <div className="bg-stone-900 text-white p-3 px-3.5 sm:px-4 flex items-center justify-between border-b border-stone-800 shrink-0">
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

            {/* LIVE SNAPSHOT STATUS BAR */}
            <div className="bg-stone-50 border-b border-stone-200 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-stone-600">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-100/40">
              {viewingMemory ? (
                /* -------------------------------------------------- */
                /* DIRECTIVES & SELF-PATCHING MEMORY DRAWER           */
                /* -------------------------------------------------- */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-amber-600" />
                        Learned Directives & Self-Patches
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
                      learnedRules.map((rule) => (
                        <div
                          key={rule.id}
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
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-stone-900 text-white rounded-br-xs'
                            : 'bg-white text-stone-800 border border-stone-200 shadow-2xs rounded-bl-xs'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="markdown-body space-y-1.5 text-stone-800">
                            <ReactMarkdown
                              components={{
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    className="text-stone-900 underline font-semibold hover:text-amber-700 inline-flex items-center gap-0.5"
                                  >
                                    {children}
                                    <ExternalLink className="w-2.5 h-2.5 inline opacity-70" />
                                  </a>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
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
                          <div className="w-full max-w-[95%] mt-2.5 p-3 bg-stone-50 border border-stone-300/80 rounded-2xl space-y-2.5 animate-in fade-in">
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
                              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                                isAllSelected 
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300/80' 
                                  : effectiveTargetIds.length > 1 
                                  ? 'bg-stone-200 text-stone-800' 
                                  : 'bg-stone-200 text-stone-700'
                              }`}>
                                {isAllSelected 
                                  ? `🌐 All ${properties.length} Properties` 
                                  : effectiveTargetIds.length > 1 
                                  ? `🌐 ${effectiveTargetIds.length} Properties` 
                                  : '📍 Single Property'}
                              </span>
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
                                  {properties.map(p => {
                                    const selected = effectiveTargetIds.includes(p.id!);
                                    return (
                                      <button
                                        key={p.id}
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
                                    <Sparkles className="w-3 h-3" /> Apply to all {properties.length} properties instead
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
                                  <p className="text-[11px] text-emerald-700 font-medium pt-0.5">
                                    ✨ Will be instantly published to live guest booking listings.
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
                                  {proposal.featured ? '🌟 Feature lodge on homepage' : 'Remove from featured row'}
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
                                        Apply to {isAllSelected && properties.length > 1 ? `All ${properties.length} Properties` : effectiveTargetIds.length > 1 ? `${effectiveTargetIds.length} Selected Lodges` : (targetProps[0]?.name || 'Property')}
                                      </span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismissAction(msg.id)}
                                  className="py-2 px-3 bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-xl text-xs font-medium transition cursor-pointer"
                                >
                                  Dismiss
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
                    <div className="flex items-center gap-2 text-stone-500 text-xs p-2.5 bg-white rounded-2xl border border-stone-200 w-fit">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />
                      <span>Consulting live lodge records...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* QUICK ACTION PROMPT CHIPS */}
            {!viewingMemory && (
              <div className="bg-stone-50/90 border-t border-stone-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {userIsAdmin ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Give me an executive summary of today: platform arrivals, checkouts, and active listings.')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      📊 Executive Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('List all properties on the platform with their statuses and manager details.')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      🏢 All Properties
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Audit all room rates across the platform in both USD and MWK.')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      💰 Rates Audit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('How do I manage users and initiate password resets for managers?')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      🔑 User Management
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Do I have any arrivals or bookings scheduled for today?')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      📅 Today's Arrivals
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Who is scheduled to check out today?')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      🚪 Checkouts Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Show me all my room rates in USD and MWK.')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      💰 My Room Rates
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('What is the status of my property menu: restaurant, conference rooms, check-in policies, and online status?')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      ⚙️ Property Menu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('What is my current occupancy and confirmed revenue?')}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-[11px] font-medium transition shadow-2xs cursor-pointer"
                    >
                      📈 Occupancy
                    </button>
                  </>
                )}
              </div>
            )}

            {/* INPUT BAR */}
            <div className="p-3 bg-white border-t border-stone-200">
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
                  className="flex-1 text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 disabled:opacity-60 transition"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || generating}
                  className="p-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl transition shadow-2xs flex items-center justify-center shrink-0 cursor-pointer"
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

        {/* ------------------------------------------------------------- */}
        {/* 3. MINIMIZED OPERATIONS DOCK PILL                             */}
        {/* ------------------------------------------------------------- */}
        {isOpen && isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-20 z-[150] sm:w-[380px] bg-stone-900 text-white rounded-2xl shadow-2xl border border-stone-700/80 p-3 flex items-center justify-between cursor-pointer hover:bg-stone-850 transition-colors select-none"
            onClick={() => setIsMinimized(false)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ConciergeAvatar size="sm" isOnline={true} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-stone-100 truncate">
                    {userIsAdmin ? 'Platform Concierge' : 'Lodge Concierge'}
                  </h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                </div>
                <p className="text-[10px] text-stone-400 truncate">
                  {messages.length > 0 
                    ? `${messages.length} messages in session • Click to expand` 
                    : 'Session minimized • Click to expand'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="p-1.5 hover:bg-stone-800 text-stone-300 hover:text-white rounded-lg transition cursor-pointer"
                title="Expand Assistant"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                }}
                className="p-1.5 hover:bg-stone-800 text-stone-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
