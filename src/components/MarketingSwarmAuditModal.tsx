import React, { useState } from 'react';
import {
  X, Sparkles, CheckCircle2, AlertTriangle, Send, Phone, MessageSquare, Copy,
  Check, ExternalLink, MapPin, Building, ShieldCheck, Sun, Coins, Loader2,
  RefreshCw, Zap, User, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Hotel, RoomType } from '../types';
import { isValidLatLng, pinProblem } from '../lib/geo';
import { getHotelImage } from '../lib/images';
import SmartImage from '../components/SmartImage';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

interface MarketingSwarmAuditModalProps {
  open: boolean;
  onClose: () => void;
  hotel: Hotel | null;
  rooms: RoomType[];
  onApproveHotel?: (hotelId: string) => void;
  mode?: 'audit' | 'fast_onboard';
  onHotelCreated?: (newHotel: Hotel) => void;
}

export default function MarketingSwarmAuditModal({
  open,
  onClose,
  hotel,
  rooms,
  onApproveHotel,
  mode = 'audit',
  onHotelCreated,
}: MarketingSwarmAuditModalProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'fast_onboard'>(mode);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Fast Field Onboarder State
  const [fieldLodgeName, setFieldLodgeName] = useState('');
  const [fieldLocation, setFieldLocation] = useState('');
  const [fieldHostName, setFieldHostName] = useState('');
  const [fieldHostPhone, setFieldHostPhone] = useState('');
  const [fastOnboardingLoading, setFastOnboardingLoading] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{ hotel: Hotel; whatsappText: string } | null>(null);

  if (!open) return null;

  // Audit Calculations for selected hotel
  const hotelRooms = hotel ? rooms.filter(r => r.hotelId === hotel.id) : [];
  const coordsValid = hotel ? Boolean(hotel.coordinates && isValidLatLng(hotel.coordinates) && !pinProblem(hotel.coordinates)) : false;
  
  const hasSolar = hotel ? Boolean(hotel.amenities?.some(a => /solar|backup|inverter|generator/i.test(a))) : false;
  const hasWater = hotel ? Boolean(hotel.amenities?.some(a => /water|borehole|hot water|shower/i.test(a))) : false;
  const hasNetting = hotel ? Boolean(hotel.amenities?.some(a => /net|mosquito/i.test(a))) : false;

  const minUsd = hotelRooms.length > 0 
    ? Math.min(...hotelRooms.map(r => r.prices?.USD ?? r.price ?? 0).filter(p => p > 0))
    : (hotel?.entirePlaceDetails?.ratePerNightUsd || 0);

  const minMwk = hotelRooms.length > 0 
    ? Math.min(...hotelRooms.map(r => r.prices?.MWK ?? r.priceMWK ?? 0).filter(p => p > 0))
    : (hotel?.entirePlaceDetails?.ratePerNightMwk || 0);

  const hasDualCurrency = minUsd > 0 && minMwk > 0;
  const hasPhotos = Boolean(hotel?.imageUrl || (hotel?.gallery && hotel.gallery.length > 0));
  const hasDescription = Boolean(hotel?.description && hotel.description.length > 60);

  const auditChecks = [
    { label: 'GPS Gate Pin located in Malawi', passed: coordsValid, detail: coordsValid ? `${hotel?.coordinates?.lat.toFixed(4)}, ${hotel?.coordinates?.lng.toFixed(4)}` : 'Missing or outside Malawi' },
    { label: 'Dual-Currency Pricing Active', passed: hasDualCurrency, detail: hasDualCurrency ? `From MK ${minMwk.toLocaleString()} / $${minUsd}` : 'Missing MWK or USD pricing' },
    { label: 'Essential Infrastructure (Solar/Water)', passed: hasSolar && hasWater, detail: hasSolar ? (hasWater ? 'Solar Backup & Borehole present' : 'Solar Backup noted, missing water details') : 'Solar Backup missing' },
    { label: 'Room Units Configured', passed: hotelRooms.length > 0 || hotel?.stayType === 'entire_place', detail: `${hotelRooms.length} room type(s) set up` },
    { label: 'High-Res Cover Photography', passed: hasPhotos, detail: hasPhotos ? 'Photography uploaded' : 'Placeholder image' },
    { label: 'Detailed Description', passed: hasDescription, detail: hasDescription ? `${hotel?.description?.length || 0} characters` : 'Too short' },
  ];

  const passedCount = auditChecks.filter(c => c.passed).length;
  const auditScore = Math.round((passedCount / auditChecks.length) * 100);

  // Personalized WhatsApp Welcome Template
  const hostPhoneClean = (hotel?.contactWhatsapp || hotel?.contactPhone || '').replace(/[^0-9]/g, '');
  const hostFirstName = hotel?.managerName?.split(' ')[0] || 'Host';
  const propertyName = hotel?.name || 'your lodge';
  const propertyUrl = hotel ? `https://ulendomalawi.com/hotel/${hotel.id}` : 'https://ulendomalawi.com';

  const whatsappMessage = `Takulandirani ${hostFirstName}! 🇲🇼 Warm greetings from the Travel Malawi team.

We are delighted to confirm that *${propertyName}* has been verified and approved on the Travel Malawi direct booking platform!

✨ *Your Listing Highlights:*
• 0% Host Commission — 100% of guest revenue goes directly to your account.
• Direct Guest WhatsApp Messaging.
• Payouts supported in MWK (Airtel Money, TNM Mpamba, Bank) and USD.

📍 *Your Live Direct Booking Link:*
${propertyUrl}

📖 *Your Free Host Starter Pack & Field Guide:*
https://ulendomalawi.com/host-guide

If you need any adjustments to your rates, photos, or seasonal specials, Ulendo AI Concierge is active on your host dashboard. Welcome to the Warm Heart of Africa direct hospitality family!`;

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedWhatsApp(true);
    toast.success('Personalized WhatsApp welcome message copied!');
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappMessage);
    const target = hostPhoneClean ? `https://wa.me/${hostPhoneClean}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(target, '_blank');
  };

  // Run Swarm Fast-Onboard for Field Marketing
  const handleFastOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLodgeName.trim() || !fieldLocation.trim()) {
      toast.error('Please enter the lodge name and location');
      return;
    }

    setFastOnboardingLoading(true);
    try {
      // 1. Call AI to synthesize realistic lodge details & room inventory
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup_property',
          entityType: 'property',
          details: {
            name: fieldLodgeName.trim(),
            location: fieldLocation.trim(),
            extraNotes: `Host Name: ${fieldHostName || 'Manager'}, Phone: ${fieldHostPhone || ''}`,
          },
        }),
      });

      let aiData: any = {};
      if (res.ok) {
        const json = await res.json();
        aiData = json.data || {};
      }

      const hotelId = uuidv4();
      const defaultRooms = aiData.suggestedRooms && aiData.suggestedRooms.length > 0 
        ? aiData.suggestedRooms 
        : [
            {
              name: 'Standard Chalet',
              priceMwk: 85000,
              priceUsd: 50,
              maxGuests: 2,
              description: 'Comfortable ensuite room with solar hot water and mosquito netting.',
            },
          ];

      const newHotelData: any = {
        name: aiData.officialName || fieldLodgeName.trim(),
        location: aiData.location || fieldLocation.trim(),
        description: aiData.description || `Welcome to ${fieldLodgeName.trim()} in ${fieldLocation.trim()}. Experience authentic Warm Heart of Africa hospitality with direct booking.`,
        category: aiData.category || 'Cottage & Chalet',
        categories: [aiData.category || 'Cottage & Chalet'],
        stayType: 'rooms',
        amenities: aiData.amenities && aiData.amenities.length > 0 
          ? aiData.amenities 
          : ['Backup power', 'Hot water', 'Mosquito net', 'Free WiFi', 'Secure parking'],
        coordinates: aiData.coordinates || { lat: -13.9833, lng: 33.7833 },
        contactPhone: fieldHostPhone.trim() || aiData.contactPhone || '+265 991 234 567',
        contactWhatsapp: fieldHostPhone.trim() || aiData.contactWhatsapp || '+265 991 234 567',
        contactEmail: aiData.contactEmail || 'reservations@travelmalawi.mw',
        managerName: fieldHostName.trim() || 'Property Manager',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 2. Save property to Firestore
      const docRef = await addDoc(collection(db, 'hotels'), newHotelData);
      const savedHotel: Hotel = { id: docRef.id, ...newHotelData };

      // 3. Save rooms
      for (const r of defaultRooms) {
        await addDoc(collection(db, 'rooms'), {
          hotelId: docRef.id,
          name: r.name,
          description: r.description || 'Comfortable stay with ensuite bathroom and mosquito net.',
          prices: {
            USD: Number(r.priceUsd) || 50,
            MWK: Number(r.priceMwk) || 85000,
          },
          price: Number(r.priceUsd) || 50,
          priceMWK: Number(r.priceMwk) || 85000,
          maxGuests: Number(r.maxGuests) || 2,
          quantity: 2,
          currencies: ['MWK', 'USD'],
          createdAt: Date.now(),
        });
      }

      const welcomeMsg = `Takulandirani ${fieldHostName || 'Partner'}! 🇲🇼 

We just pre-registered *${savedHotel.name}* on Travel Malawi!
Your direct listing is ready for you to preview and customize with 0% commission.

🔗 *View your listing:*
https://ulendomalawi.com/hotel/${savedHotel.id}

📖 *Host Field Guide:*
https://ulendomalawi.com/host-guide`;

      setCreatedSummary({ hotel: savedHotel, whatsappText: welcomeMsg });
      if (onHotelCreated) onHotelCreated(savedHotel);
      toast.success(`Property "${savedHotel.name}" onboarded in 60s!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fast-onboard property');
    } finally {
      setFastOnboardingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-stone-900 text-stone-100 p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                {activeTab === 'fast_onboard' ? 'Field Fast-Onboard (60s)' : 'Swarm Quality Audit & Dispatch'}
              </h2>
              <p className="text-xs text-stone-300">
                Ulendo Marketing &amp; Acquisition Agent Swarm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-stone-800 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  activeTab === 'audit' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                Audit &amp; Welcome
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fast_onboard')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  activeTab === 'fast_onboard' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                Fast-Onboard Lodge
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Quality Audit & WhatsApp Dispatch */}
        {activeTab === 'audit' && hotel && (
          <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Property Snapshot */}
            <div className="flex items-start gap-4 p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
              <div className="w-20 h-20 rounded-xl bg-stone-200 overflow-hidden shrink-0">
                <SmartImage src={getHotelImage(hotel)} alt={hotel.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-stone-900 text-base truncate">{hotel.name}</h3>
                  <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Audit: {auditScore}%
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>{hotel.location}</span>
                </p>
                <p className="text-xs text-stone-600 mt-1">
                  <strong>Host:</strong> {hotel.managerName || hotel.contactPhone || 'Not assigned'}
                  {hotel.contactWhatsapp && ` · WhatsApp: ${hotel.contactWhatsapp}`}
                </p>
              </div>
            </div>

            {/* Audit Checklist */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-mono">
                Swarm Quality Audit Checklist
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {auditChecks.map((item, idx) => (
                  <div
                    key={`audit-check-${idx}`}
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      item.passed
                        ? 'bg-emerald-50/60 border-emerald-200 text-stone-800'
                        : 'bg-amber-50/70 border-amber-200 text-amber-950'
                    }`}
                  >
                    {item.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personalized WhatsApp Welcome Dispatch */}
            <div className="space-y-2.5 pt-2 border-t border-stone-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-mono flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Personalized Host Welcome &amp; Starter Pack (WhatsApp)</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="text-xs font-semibold text-stone-700 hover:text-stone-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWhatsApp ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-700 font-sans whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {whatsappMessage}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp ({hostPhoneClean || 'App'})</span>
                </button>

                {onApproveHotel && hotel.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => {
                      onApproveHotel(hotel.id);
                      toast.success(`"${hotel.name}" approved & published!`);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Approve &amp; Publish Listing</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Field Fast-Onboard (60s) */}
        {activeTab === 'fast_onboard' && (
          <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {createdSummary ? (
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Lodge Pre-Registered Successfully!</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  <strong>{createdSummary.hotel.name}</strong> has been created with verified category, description, and dual-currency rooms. 
                  Send the invite link to the host on WhatsApp right now so they can claim it:
                </p>

                <div className="bg-white border border-emerald-200 rounded-xl p-3 text-xs text-stone-700 font-sans whitespace-pre-wrap">
                  {createdSummary.whatsappText}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const encoded = encodeURIComponent(createdSummary.whatsappText);
                      const phone = fieldHostPhone.replace(/[^0-9]/g, '');
                      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
                    }}
                    className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Open in WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedSummary(null);
                      setFieldLodgeName('');
                      setFieldLocation('');
                      setFieldHostName('');
                      setFieldHostPhone('');
                    }}
                    className="text-xs text-stone-600 hover:text-stone-900 underline font-medium cursor-pointer"
                  >
                    Onboard Another Lodge
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFastOnboard} className="space-y-4">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-950 text-xs flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>Marketing Fast-Track:</strong> Enter basic lodge information from the field. 
                    The Helping Agent Swarm will autonomously lookup or synthesize the optimal category, rooms in MWK &amp; USD, amenities, and generate the host's WhatsApp onboarding packet.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 font-mono">
                    Lodge / Property Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fieldLodgeName}
                    onChange={(e) => setFieldLodgeName(e.target.value)}
                    placeholder="e.g. Chembe Bay Chalets, Nkhata Bay Eco Lodge"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 font-mono">
                    Location / District *
                  </label>
                  <input
                    type="text"
                    required
                    value={fieldLocation}
                    onChange={(e) => setFieldLocation(e.target.value)}
                    placeholder="e.g. Cape Maclear, Mangochi, Senga Bay, Lilongwe Area 10"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 font-mono">
                      Host / Manager Name
                    </label>
                    <input
                      type="text"
                      value={fieldHostName}
                      onChange={(e) => setFieldHostName(e.target.value)}
                      placeholder="e.g. Kondwani Banda"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 font-mono">
                      Host WhatsApp Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={fieldHostPhone}
                      onChange={(e) => setFieldHostPhone(e.target.value)}
                      placeholder="+265 991 234 567"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={fastOnboardingLoading}
                    className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {fastOnboardingLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    ) : (
                      <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                    )}
                    <span>{fastOnboardingLoading ? 'Swarm Synthesizing Listing…' : 'Launch Swarm Fast-Onboard (60s)'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
