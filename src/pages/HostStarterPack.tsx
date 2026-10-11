import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Copy, Check, Printer, Send, Download, Mail,
  ExternalLink, Sparkles, Bed, Compass, Bath, Utensils, CheckCircle2, ChevronRight,
  X, Share2, Smartphone, FileText, Home, Camera, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

export default function HostStarterPack() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'host-onboarding-pack',
    'Host Starter Pack & Field Guide',
    'A short, human guide for independent lodges, whole lakeside cottages, private villas, B&Bs, and safari camps across Malawi. Built for 0% commission, direct WhatsApp bookings, and authentic Malawian hospitality.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    propName: '',
    propLoc: '',
    stayType: 'whole_house', // 'whole_house' | 'rooms'
    contactName: '',
    contactPhone: '',
    capacity: 'Whole 3-bed house, up to 6 guests',
    startingRate: '',
    currency: 'MWK',
    notes: ''
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Host Starter Pack & Field Guide for independent stays, whole cottages & lodges: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const emailSubject = 'Travel Malawi — Host Starter Pack & Field Guide';
  const emailBodyPlain =
    `Muli bwanji,\n\n` +
    `Here is the Travel Malawi Host Starter Pack & Field Guide for whole cottages, villas, safari camps, and independent lodges across Malawi.\n\n` +
    `Read the full field guide online: ${window.location.href}\n\n` +
    `KEY HIGHLIGHTS FOR PROPERTY OWNERS & HOSTS:\n` +
    `• Stays Can Be Whole Houses or Rooms: List entire self-catering cottages, private beach houses, family villas, or individual chalets.\n` +
    `• 0% Commission: Keep 100% of your nightly rates.\n` +
    `• Direct WhatsApp Bookings: Guests chat directly with you on your phone.\n` +
    `• Instant Payouts: Guest deposits land straight in your Airtel Money, TNM Mpamba, or National Bank of Malawi account.\n` +
    `• The 4 Essential Photos: Bed (Sleep Shot), Horizon View (Aspiration), Bathroom (Hygiene), Sunset Patio / Fire Pit (Connection).\n` +
    `• Clean Dual Pricing: MWK rounded to nearest MK 1,000 / USD rounded to whole dollars or nearest $5.\n` +
    `• 8-Minute Setup: Send 4 photos, your nightly rates, and gate GPS pin to get listed.\n\n` +
    `DIRECT ACTION LINKS:\n` +
    `• List Your Property Online: ${window.location.origin}/list-your-property\n` +
    `• Host Visual Playbook: ${window.location.origin}/how-hosting-works\n` +
    `• Host Dashboard & Rates: ${window.location.origin}/dashboard\n` +
    `• Direct Concierge WhatsApp: https://api.whatsapp.com/send?phone=265999000000\n\n` +
    `Zikomo kwambiri,\nTravel Malawi Team — The Warm Heart of Africa`;

  const handleOpenEmailClient = (targetEmail?: string) => {
    const to = targetEmail?.trim() || recipientEmail.trim();
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBodyPlain)}`;
    window.location.href = mailto;
  };

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(emailBodyPlain);
    setCopiedEmailText(true);
    toast.success('Formatted email text copied to clipboard');
    setTimeout(() => setCopiedEmailText(false), 2500);
  };

  const handlePrint = () => {
    toast('Opening print dialog — select "Save as PDF" to export your offline field guide.', {
      icon: '📄',
      duration: 3500
    });
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/docs/host-onboarding-starter-pack?format=html&download=1';
    link.download = 'travel_malawi_host_starter_pack.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded standalone starter pack (.html)');
  };

  const copyTemplate = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(id);
    toast.success('Template copied to clipboard');
    setTimeout(() => setCopiedTemplate(null), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() || !formData.contactPhone.trim()) {
      toast.error('Please enter your property name and WhatsApp number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: 'host_onboarding',
        sourceDoc: 'Host Starter Pack',
        propName: formData.propName,
        propLoc: formData.propLoc,
        stayType: formData.stayType,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        roomTypes: `${formData.stayType === 'whole_house' ? 'Whole House/Cottage' : 'Room by Room'}: ${formData.capacity}`,
        notes: `Starting rate: ${formData.currency} ${formData.startingRate}. Notes: ${formData.notes}`,
        pilotInterest: 'yes'
      };

      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const refId = data.id || `host-${Date.now()}`;

      try {
        await addDoc(collection(db, 'surveys'), {
          ...payload,
          id: refId,
          submittedAt: serverTimestamp(),
          clientTimestamp: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Firestore sync failed, local submission retained:', err);
      }

      setSubmissionId(refId);
      setSubmitted(true);
      toast.success('Takulandirani! Your property details have been received.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const TEMPLATE_CONFIRMATION =
    "Muli bwanji [Guest Name]! Thank you for choosing [Property Name]. We have provisionally held your [Whole Cottage / Room Type] for [Check-in Date] to [Check-out Date]. Total: MK [Amount]. To confirm your dates, please send your 50% deposit via Airtel Money/Mpamba to [Phone Number] or National Bank of Malawi [Account Details]. Once sent, we'll send your confirmation voucher immediately!";
  const TEMPLATE_DIRECTIONS =
    "Muli bwanji [Guest Name]! We look forward to welcoming you today at [Property Name]. Coming down the Lakeshore Road, take the turn-off at [Landmark]. Follow our wooden signs for 3 km. Gate GPS pin: [Google Maps Link]. Our resident manager [Name] is ready on WhatsApp at [Phone Number] if you need any directions along the road!";

  const inputClass =
    'w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-900 transition shadow-2xs';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5';

  return (
    <div className="min-h-screen bg-stone-50/50 text-stone-700 font-sans print:bg-white">
      {/* Container widened to max-w-5xl/6xl matching ListProperty page layout */}
      <main className="max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 print:p-0 print:max-w-none">

        {/* Top Control Bar (Screen only) */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-200/90 print:hidden flex-wrap">
          <Link
            to="/list-your-property"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-700 hover:text-stone-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Host Hub</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <DocQuickEditButton docId="host-onboarding-pack" onSaved={() => refreshDoc()} />

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs"
              title="Email this guide"
            >
              <Mail className="w-3.5 h-3.5 text-stone-500" />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs"
              title="Share via WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs"
              title="Copy guide link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              <span>{copiedLink ? 'Copied' : 'Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs"
              title="Download offline HTML document"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>HTML</span>
            </button>
          </div>
        </div>

        {/* Print-Only Header Banner */}
        <div className="hidden print:block mb-6 pb-4 border-b border-stone-300">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>TRAVEL MALAWI · HOST FIELD GUIDE</span>
            <span>0% COMMISSION · DIRECT BOOKINGS</span>
            <span>travelmalawi.mw/host-guide</span>
          </div>
        </div>

        {/* Paper Container - Spacious and airy layout */}
        <article className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-10 lg:p-12 shadow-xs print:border-none print:p-0 print:shadow-none">

          {/* Header */}
          <header className="border-b border-stone-200 pb-8 mb-8">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-stone-500 mb-2.5">
              <span>Travel Malawi</span>
              <span>·</span>
              <span>Host Starter Pack &amp; Field Guide</span>
              <span>·</span>
              <span className="text-stone-900 font-semibold">3-Minute Read</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-stone-900 leading-[1.15] tracking-tight">
              {customTitle}
            </h1>
            <p className="mt-3 text-stone-600 text-sm sm:text-base md:text-lg leading-relaxed max-w-3xl">
              {customSubtitle}
            </p>

            {(isCustomized || lastEditedBy) && (
              <p className="mt-2 text-xs text-stone-400">
                {isCustomized && 'Customized edition'}
                {isCustomized && lastEditedBy && ' · '}
                {lastEditedBy && `Maintained by ${lastEditedBy}`}
              </p>
            )}

            {/* Quick Principles Bar */}
            <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                <span className="text-stone-400 block font-mono text-[10px] uppercase">Commission</span>
                <span className="font-semibold text-stone-900 text-sm sm:text-base">0% Direct</span>
              </div>
              <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                <span className="text-stone-400 block font-mono text-[10px] uppercase">Payout Speed</span>
                <span className="font-semibold text-stone-900 text-sm sm:text-base">Instant to You</span>
              </div>
              <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                <span className="text-stone-400 block font-mono text-[10px] uppercase">Accepted Rails</span>
                <span className="font-semibold text-stone-900 text-sm sm:text-base">Airtel / Mpamba / Bank</span>
              </div>
              <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                <span className="text-stone-400 block font-mono text-[10px] uppercase">Setup Time</span>
                <span className="font-semibold text-stone-900 text-sm sm:text-base">Under 8 Minutes</span>
              </div>
            </div>

            {/* In-Guide Jump Links (Screen only) */}
            <nav className="mt-6 pt-4 border-t border-stone-100 flex items-center gap-4 text-xs overflow-x-auto scrollbar-none print:hidden">
              <a href="#section-photos" className="text-stone-600 hover:text-stone-950 hover:underline whitespace-nowrap">
                1. Four Photo Angles
              </a>
              <span className="text-stone-300">·</span>
              <a href="#section-pricing" className="text-stone-600 hover:text-stone-950 hover:underline whitespace-nowrap">
                2. Dual Pricing &amp; Whole Houses
              </a>
              <span className="text-stone-300">·</span>
              <a href="#section-whatsapp" className="text-stone-600 hover:text-stone-950 hover:underline whitespace-nowrap">
                3. WhatsApp Templates
              </a>
              <span className="text-stone-300">·</span>
              <a href="#section-get-listed" className="text-stone-600 hover:text-stone-950 hover:underline whitespace-nowrap">
                4. Get Listed in 8 Mins
              </a>
              <span className="text-stone-300">·</span>
              <a href="#onboarding-form" className="text-stone-900 font-semibold hover:underline whitespace-nowrap">
                5. Fast Submission
              </a>
            </nav>
          </header>

          {/* Guide Body */}
          <div className="space-y-12 text-sm sm:text-[15px] leading-relaxed text-stone-700">

            {/* Introduction with Warm Malawian Touch & Whole House Emphasis */}
            <section>
              <div className="p-5 sm:p-6 bg-amber-50/60 rounded-2xl border border-amber-200/80 mb-6">
                <p className="text-stone-900 text-base sm:text-lg font-serif leading-relaxed">
                  <strong>Takulandirani!</strong> Whether you host an <strong>entire lakeside cottage</strong> in Cape Maclear, a <strong>private family holiday villa</strong> in Mangochi, a <strong>mountain cabin</strong> in Mulanje, a <strong>safari camp</strong> in Liwonde, or a <strong>boutique guest room</strong> in Lilongwe Area 10 — travelers come to you for peace of mind, comfort, and an honest Malawian welcome.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <Home className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Stays can be whole private properties or individual rooms — both enjoy 100% direct payouts with 0% commission.</span>
                </div>
              </div>

              {/* Handcrafted Architectural Sketch 01: The Lakeside Cottage Blueprint */}
              <div className="break-inside-avoid my-6 p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                    Drafting Sketch 01 // Architectural Property Layout &amp; Rate Anchor
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">Scale: 1:50 · Whole Space &amp; Cottages</span>
                </div>

                <div className="flex items-center justify-center py-2 overflow-x-auto">
                  <svg
                    viewBox="0 0 540 280"
                    className="w-full max-w-xl h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
                  >
                    {/* Waterline & Lakeshore contour */}
                    <path d="M 30 240 Q 150 230 280 240 T 510 235" strokeDasharray="3 3" className="stroke-stone-400" />
                    <text x="360" y="260" className="text-[9px] font-mono fill-stone-400 stroke-none tracking-wider">
                      LAKE MALAWI WATERLINE ±0.00
                    </text>

                    {/* Acacia Tree Silhouette */}
                    <path d="M 450 235 Q 455 190 465 160 Q 450 135 430 120 M 465 160 Q 480 135 500 120" className="stroke-stone-600 stroke-[2]" />
                    <path d="M 410 120 Q 450 105 480 115 Q 510 120 490 135 Q 450 145 410 120 Z" className="fill-stone-200/50 stroke-stone-500 stroke-[1]" />

                    {/* Stilts */}
                    <line x1="120" y1="180" x2="120" y2="235" className="stroke-stone-700 stroke-[2]" />
                    <line x1="180" y1="180" x2="180" y2="235" className="stroke-stone-700 stroke-[2]" />
                    <line x1="260" y1="180" x2="260" y2="235" className="stroke-stone-700 stroke-[2]" />
                    <line x1="340" y1="180" x2="340" y2="235" className="stroke-stone-700 stroke-[2]" />

                    {/* Deck floor */}
                    <line x1="90" y1="180" x2="370" y2="180" className="stroke-stone-900 stroke-[2.5]" />

                    {/* Cottage Walls */}
                    <rect x="130" y="105" width="190" height="75" className="stroke-stone-900 fill-white stroke-[2]" />

                    {/* Door & Window */}
                    <rect x="200" y="125" width="35" height="55" className="stroke-stone-800 fill-stone-100/60 stroke-[1.5]" />
                    <rect x="145" y="125" width="38" height="30" className="stroke-stone-800 fill-stone-50 stroke-[1.5]" />
                    <line x1="145" y1="135" x2="183" y2="135" className="stroke-stone-400 stroke-[1]" />
                    <rect x="255" y="125" width="45" height="30" className="stroke-stone-800 fill-stone-50 stroke-[1.5]" />
                    <line x1="255" y1="135" x2="300" y2="135" className="stroke-stone-400 stroke-[1]" />

                    {/* Thatched Roof Pitch */}
                    <path d="M 75 120 L 225 40 L 385 120 Z" className="stroke-stone-900 fill-stone-100 stroke-[2]" />
                    <path d="M 120 100 L 140 115 M 160 80 L 180 105 M 215 55 L 230 90 M 265 75 L 285 105" className="stroke-stone-400 stroke-[1]" />

                    {/* Frontage Dimension */}
                    <line x1="90" y1="200" x2="370" y2="200" className="stroke-amber-800 stroke-[1]" strokeDasharray="4 2" />
                    <circle cx="90" cy="200" r="2" className="fill-amber-800 stroke-none" />
                    <circle cx="370" cy="200" r="2" className="fill-amber-800 stroke-none" />
                    <text x="175" y="215" className="text-[10px] font-mono fill-amber-900 stroke-none font-bold">
                      VERANDA FRONTAGE: 9.5 METERS
                    </text>

                    {/* Floating Rate Tag Blueprint */}
                    <g transform="translate(15, 20)">
                      <rect x="0" y="0" width="165" height="48" rx="8" className="fill-white stroke-stone-800 stroke-[1.5] filter drop-shadow-xs" />
                      <text x="10" y="16" className="text-[9px] font-mono fill-stone-400 stroke-none uppercase">RATE BLUEPRINT</text>
                      <text x="10" y="34" className="text-[12px] font-serif font-bold fill-stone-900 stroke-none">
                        MK 120,000 / $80
                      </text>
                      <text x="105" y="34" className="text-[9px] font-sans fill-emerald-700 stroke-none font-bold">
                        (Whole Stay)
                      </text>
                      <path d="M 165 24 L 195 48" className="stroke-amber-700 stroke-[1.2]" strokeDasharray="3 2" />
                      <circle cx="195" cy="48" r="2" className="fill-amber-700 stroke-none" />
                    </g>
                  </svg>
                </div>

                <p className="text-center text-xs text-stone-500 mt-2 font-mono">
                  Figure 1: Authentic Malawian property presentation with natural light, veranda presence &amp; clear rate anchoring.
                </p>
              </div>
            </section>

            {/* SECTION 1: The 4 Photos That Win Bookings — WITH INSTRUCTOR CAMERA ANGLE ILLUSTRATIONS */}
            <section id="section-photos" className="pt-2">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Rule 01</span>
                <span>·</span>
                <span>Visual Trust &amp; Photography Angles</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                1. Four Photos That Win the Stay (With Picture Angles)
              </h2>
              <p className="mt-2 text-stone-600 max-w-3xl">
                You do not need an expensive photography crew. Any smartphone taken in morning natural light with a wiped clean lens works best. Follow these <strong>four precise camera framing angles</strong> to capture genuine quality and build instant guest trust:
              </p>

              {/* 4 Instructor Camera Angle Sketches Grid (2x2 on desktop) */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Angle 1: Bed Shot */}
                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200/90 bg-stone-50/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-900 shadow-2xs">
                          <Bed className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">1. The Clean Bed (Sleep Shot)</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Angle: 45° Eye-Level</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-full">
                        Sleep Anchor
                      </span>
                    </div>

                    {/* Camera Angle Instructor SVG 01 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 320 160" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.3] stroke-linecap-round select-none">
                        {/* Bed Frame & Mattress in 45-degree isometric perspective */}
                        <path d="M 40 100 L 140 135 L 280 80 L 180 45 Z" className="fill-stone-100 stroke-stone-800 stroke-[1.8]" />
                        {/* Headboard */}
                        <path d="M 180 45 L 280 80 L 280 40 L 180 10 Z" className="fill-stone-200 stroke-stone-800" />
                        {/* Duvet & Pillows */}
                        <rect x="200" y="42" width="28" height="16" rx="4" className="fill-white stroke-stone-700" />
                        <rect x="235" y="55" width="28" height="16" rx="4" className="fill-white stroke-stone-700" />
                        {/* Window morning light rays */}
                        <path d="M 20 20 L 70 70 M 35 15 L 95 65 M 50 10 L 120 60" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 2" />
                        <text x="25" y="15" className="text-[8px] font-mono fill-amber-700 stroke-none font-bold">☀ MORNING SIDE LIGHT</text>
                        {/* Viewfinder frame overlay */}
                        <path d="M 60 40 L 50 40 L 50 50 M 270 40 L 280 40 L 280 50 M 50 120 L 50 130 L 60 130 M 280 120 L 280 130 L 270 130" stroke="#059669" strokeWidth="1.5" />
                        <circle cx="165" cy="85" r="3" fill="#059669" stroke="none" />
                        <text x="125" y="150" className="text-[9px] font-mono fill-emerald-800 stroke-none font-bold">CAMERA: 45° ANGLE CROP</text>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      Smooth crisp linens, fluffed pillows, with morning light from a side window. Dissolves guest worry: <em>&ldquo;Will I sleep comfortably and wake up rested?&rdquo;</em> Works equally for whole house master suites and guest rooms.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Tip: Stand at the corner of the room, chest height, lens wiped spotless.
                  </div>
                </div>

                {/* Angle 2: View Shot */}
                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200/90 bg-stone-50/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-900 shadow-2xs">
                          <Compass className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">2. The Horizon View (Aspiration)</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Angle: Eye-Level Veranda 16:9</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100/70 px-2.5 py-1 rounded-full">
                        Aspiration
                      </span>
                    </div>

                    {/* Camera Angle Instructor SVG 02 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 320 160" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.3] stroke-linecap-round select-none">
                        {/* Lake Waterline & Horizon Rule of Thirds */}
                        <line x1="20" y1="65" x2="300" y2="65" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="4 2" />
                        <text x="220" y="60" className="text-[8px] font-mono fill-blue-700 stroke-none font-bold">HORIZON (UPPER 1/3)</text>
                        {/* Mulanje Mountain / Cape Maclear Hills Silhouette */}
                        <path d="M 40 65 Q 90 35 140 65 Q 190 40 240 65 T 300 65" className="fill-blue-50 stroke-stone-600" />
                        {/* Foreground Veranda Rail & Coffee Mug */}
                        <rect x="20" y="110" width="280" height="12" className="fill-stone-200 stroke-stone-800" />
                        <rect x="70" y="122" width="10" height="35" className="fill-stone-300 stroke-stone-800" />
                        <rect x="240" y="122" width="10" height="35" className="fill-stone-300 stroke-stone-800" />
                        {/* Coffee Mug Anchor */}
                        <rect x="150" y="96" width="14" height="14" rx="2" className="fill-white stroke-stone-800" />
                        <path d="M 164 100 Q 168 103 164 106" className="stroke-stone-800" />
                        {/* Viewfinder frame overlay */}
                        <path d="M 30 25 L 20 25 L 20 35 M 290 25 L 300 25 L 300 35 M 20 140 L 20 150 L 30 150 M 300 140 L 300 150 L 290 150" stroke="#059669" strokeWidth="1.5" />
                        <text x="105" y="145" className="text-[9px] font-mono fill-emerald-800 stroke-none font-bold">1/3 DECK + 2/3 HORIZON</text>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      The horizon from your patio, Lake Malawi waters, Mulanje granite peaks, or garden lawn. This is the photo guests screenshot and share on WhatsApp: <em>&ldquo;Look where we are going this weekend!&rdquo;</em>
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Tip: Keep the horizon straight. Include 1/3 veranda deck in foreground for depth.
                  </div>
                </div>

                {/* Angle 3: Bathroom Shot */}
                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200/90 bg-stone-50/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-900 shadow-2xs">
                          <Bath className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">3. The Bathroom (Hygiene)</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Angle: Straight 90° Elevation</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100/70 px-2.5 py-1 rounded-full">
                        Hygiene Proof
                      </span>
                    </div>

                    {/* Camera Angle Instructor SVG 03 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 320 160" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.3] stroke-linecap-round select-none">
                        {/* Shower Enclosure & Glass Screen */}
                        <rect x="40" y="30" width="80" height="110" className="fill-stone-50 stroke-stone-800 stroke-[1.5]" />
                        <line x1="80" y1="35" x2="80" y2="45" className="stroke-stone-700 stroke-[2]" />
                        <circle cx="80" cy="48" r="6" className="stroke-stone-700 fill-stone-200" />
                        {/* Mirror with 15° off-axis guide */}
                        <rect x="150" y="35" width="60" height="50" rx="4" className="fill-blue-50/40 stroke-stone-700 stroke-[1.5]" />
                        <line x1="160" y1="45" x2="185" y2="70" stroke="#93c5fd" strokeWidth="1" />
                        {/* Vanity Sink & Folded Towel Anchor */}
                        <rect x="140" y="90" width="80" height="25" rx="3" className="fill-white stroke-stone-800" />
                        <rect x="235" y="70" width="40" height="60" rx="3" className="fill-stone-100 stroke-stone-700" />
                        <line x1="235" y1="90" x2="275" y2="90" stroke="#d6d3d1" />
                        <text x="238" y="85" className="text-[7px] font-mono fill-stone-500 stroke-none">WHITE TOWEL</text>
                        {/* Camera Angle note */}
                        <path d="M 130 145 L 140 125" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="2 2" />
                        <circle cx="130" cy="145" r="2" fill="#ef4444" stroke="none" />
                        <text x="145" y="148" className="text-[8px] font-mono fill-rose-700 stroke-none font-bold">STAND 15° OFF-MIRROR AXIS</text>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      Spotless shower, clean mirror, bone-dry floor, and neatly folded white towel. Removes unspoken traveler hesitation and seals high-value bookings.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Tip: Stand slightly off-center so your reflection and phone don&apos;t appear in the mirror.
                  </div>
                </div>

                {/* Angle 4: Sunset Dining / Fire Pit */}
                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200/90 bg-stone-50/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-900 shadow-2xs">
                          <Utensils className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">4. Sunset Dining / Fire Pit</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Angle: 30° Seated Dusk</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-full">
                        Connection
                      </span>
                    </div>

                    {/* Camera Angle Instructor SVG 04 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 320 160" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.3] stroke-linecap-round select-none">
                        {/* Sunset Glow Vector */}
                        <circle cx="250" cy="50" r="24" className="fill-amber-100 stroke-amber-400 stroke-[1]" />
                        <line x1="250" y1="20" x2="250" y2="10" stroke="#f59e0b" strokeWidth="1.2" />
                        <line x1="275" y1="35" x2="285" y2="30" stroke="#f59e0b" strokeWidth="1.2" />
                        {/* Boma Fire Pit / Dining Table in Foreground */}
                        <ellipse cx="120" cy="115" rx="55" ry="22" className="fill-stone-100 stroke-stone-800 stroke-[1.8]" />
                        {/* Campfire Flame or Lantern */}
                        <path d="M 120 90 Q 128 100 120 110 Q 112 100 120 90 Z" className="fill-amber-400 stroke-amber-600" />
                        <path d="M 120 95 Q 124 102 120 108 Q 116 102 120 95 Z" className="fill-rose-500 stroke-none" />
                        {/* Seating outline */}
                        <rect x="40" y="100" width="20" height="25" rx="3" className="fill-stone-200 stroke-stone-700" />
                        <rect x="180" y="100" width="20" height="25" rx="3" className="fill-stone-200 stroke-stone-700" />
                        {/* Viewfinder frame overlay */}
                        <path d="M 30 25 L 20 25 L 20 35 M 290 25 L 300 25 L 300 35 M 20 140 L 20 150 L 30 150 M 300 140 L 300 150 L 290 150" stroke="#059669" strokeWidth="1.5" />
                        <text x="100" y="148" className="text-[9px] font-mono fill-emerald-800 stroke-none font-bold">30° SEATED AMBIENCE ANGLE</text>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      Outdoor dining table set with fresh chambo fish, cold drinks on the deck, or an evening boma fire pit glowing at dusk. Shows travelers where they will unwind after their drive down the M5.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Tip: Shoot during golden hour (5:00 PM – 5:45 PM) when the sky turns warm amber.
                  </div>
                </div>

              </div>

              <p className="mt-4 text-xs text-stone-500">
                Want more visual layout examples? <Link to="/how-hosting-works" className="text-stone-900 font-semibold underline">Read our visual hosting playbook</Link> to see full property framing guides.
              </p>
            </section>

            {/* SECTION 2: Dual Pricing & Whole House Rates */}
            <section id="section-pricing" className="pt-4 border-t border-stone-200/80">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Rule 02</span>
                <span>·</span>
                <span>Pricing Psychology &amp; Whole Space Capacity</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                2. Dual Pricing, Whole-House Rates &amp; Clean Rounding
              </h2>
              <p className="mt-2 text-stone-600 max-w-3xl">
                Travelers in Malawi include Lilongwe &amp; Blantyre residents booking weekend lakeside cottages, as well as international NGO specialists and overseas tourists. Provide clean numbers in both currencies without odd decimals.
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs">
                  <h3 className="font-semibold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                    <span>Malawian Kwacha (MWK)</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
                    Always round cleanly to the nearest <strong>MK 1,000</strong>:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-stone-700">
                    <li>• <strong>Whole 3-Bed Cottage:</strong> MK 280,000 / night</li>
                    <li>• <strong>Master Lake Chalet:</strong> MK 120,000 / night</li>
                    <li>• <strong>Standard Garden Room:</strong> MK 65,000 / night</li>
                  </ul>
                  <p className="text-[11px] text-stone-400 mt-2">
                    Never use odd decimal conversions like MK 84,350 that look like artificial algorithm fees.
                  </p>
                </div>

                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs">
                  <h3 className="font-semibold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                    <span>US Dollars (USD)</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
                    Round to whole dollars or the nearest <strong>$5</strong>:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-stone-700">
                    <li>• <strong>Whole 3-Bed Cottage:</strong> $180 / night</li>
                    <li>• <strong>Master Lake Chalet:</strong> $80 / night</li>
                    <li>• <strong>Standard Garden Room:</strong> $45 / night</li>
                  </ul>
                  <p className="text-[11px] text-stone-400 mt-2">
                    Clean round dollar figures build instant trust with international guests and regional expats.
                  </p>
                </div>
              </div>

              {/* The Premium Anchor Rule */}
              <div className="break-inside-avoid mt-5 p-5 rounded-2xl bg-stone-50 border border-stone-200 text-xs sm:text-sm text-stone-700 space-y-1">
                <strong className="font-semibold text-stone-900 block text-sm">The Premium Anchor Rule:</strong>
                <p>
                  Always list your premier offering first — for example, <em>Whole 4-Bedroom Beachfront Cottage at MK 320,000 / $210</em>. When guests see that benchmark first, your <em>2-Bedroom Garden Annex at MK 140,000 / $90</em> reads as an irresistible value.
                </p>
              </div>

              <p className="mt-3 text-xs text-stone-500">
                Need to adjust seasonal rates? Use our <Link to="/dashboard" className="text-stone-900 font-semibold underline">Host Dashboard &amp; Room Rate Editor</Link> at any time.
              </p>
            </section>

            {/* SECTION 3: WhatsApp Communication & Templates */}
            <section id="section-whatsapp" className="pt-4 border-t border-stone-200/80">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Rule 03</span>
                <span>·</span>
                <span>Fast Direct WhatsApp Communication</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                3. Direct WhatsApp Guest Templates
              </h2>
              <p className="mt-2 text-stone-600 max-w-3xl">
                Guests love fast, personal replies directly from the host. Keep these two templates saved on your phone and simply fill in the brackets before sending:
              </p>

              {/* Handcrafted Architectural Sketch 02: The Direct WhatsApp Flow */}
              <div className="break-inside-avoid my-6 p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                    Drafting Sketch 02 // Direct Guest-to-Host WhatsApp Pathway
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">Zero Middlemen</span>
                </div>

                <div className="flex items-center justify-center py-2 overflow-x-auto">
                  <svg
                    viewBox="0 0 540 220"
                    className="w-full max-w-xl h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
                  >
                    {/* Guest Phone Silhouette */}
                    <rect x="40" y="20" width="110" height="180" rx="14" className="stroke-stone-800 fill-white stroke-[2]" />
                    <line x1="75" y1="30" x2="115" y2="30" className="stroke-stone-300 stroke-[2]" />
                    <circle cx="95" cy="185" r="3" className="stroke-stone-300 stroke-[1]" />
                    <text x="55" y="60" className="text-[9px] font-mono fill-stone-400 stroke-none">GUEST PHONE</text>
                    <text x="55" y="80" className="text-[11px] font-bold fill-stone-900 stroke-none">Traveler</text>

                    {/* Host Phone Silhouette */}
                    <rect x="390" y="20" width="110" height="180" rx="14" className="stroke-stone-800 fill-white stroke-[2]" />
                    <line x1="425" y1="30" x2="465" y2="30" className="stroke-stone-300 stroke-[2]" />
                    <circle cx="445" cy="185" r="3" className="stroke-stone-300 stroke-[1]" />
                    <text x="405" y="60" className="text-[9px] font-mono fill-stone-400 stroke-none">HOST PHONE</text>
                    <text x="405" y="80" className="text-[11px] font-bold fill-stone-900 stroke-none">Your Stay</text>

                    {/* Connecting Arc with Checkmark */}
                    <path d="M 150 90 C 230 40 310 40 390 90" className="stroke-emerald-700 stroke-[2]" strokeDasharray="5 3" />
                    <circle cx="270" cy="62" r="13" className="fill-emerald-800 stroke-white stroke-[2]" />
                    <path d="M 264 62 L 268 66 L 277 57" className="stroke-white stroke-[2]" />

                    {/* Direct Chat Bubble */}
                    <g transform="translate(175, 95)">
                      <rect x="0" y="0" width="190" height="98" rx="10" className="fill-emerald-50 stroke-emerald-700 stroke-[1.5]" />
                      <text x="14" y="20" className="text-[9px] font-mono fill-emerald-900 stroke-none font-bold">DIRECT INQUIRY</text>
                      <text x="14" y="38" className="text-[11px] font-sans fill-stone-900 stroke-none">
                        &ldquo;Muli bwanji! We are 6
                      </text>
                      <text x="14" y="54" className="text-[11px] font-sans fill-stone-900 stroke-none">
                        guests booking Whole Cottage.
                      </text>
                      <text x="14" y="70" className="text-[11px] font-sans font-bold fill-stone-900 stroke-none">
                        Total: MK 280,000.&rdquo;
                      </text>
                      <text x="14" y="88" className="text-[9px] font-mono fill-emerald-700 stroke-none">
                        0% Commission · Instant Payout
                      </text>
                    </g>
                  </svg>
                </div>
              </div>

              {/* Templates Cards */}
              <div className="space-y-4">
                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-stone-900 text-sm sm:text-base">Template 1: Instant Reservation &amp; Deposit</h3>
                    <button
                      type="button"
                      onClick={() => copyTemplate(TEMPLATE_CONFIRMATION, 't1')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition cursor-pointer print:hidden"
                    >
                      {copiedTemplate === 't1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTemplate === 't1' ? 'Copied' : 'Copy Template'}</span>
                    </button>
                  </div>
                  <p className="text-xs sm:text-[13px] text-stone-700 font-mono bg-stone-50 p-4 rounded-xl leading-relaxed border border-stone-100">
                    {TEMPLATE_CONFIRMATION}
                  </p>
                </div>

                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-stone-900 text-sm sm:text-base">Template 2: Road Directions &amp; Gate Pin</h3>
                    <button
                      type="button"
                      onClick={() => copyTemplate(TEMPLATE_DIRECTIONS, 't2')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition cursor-pointer print:hidden"
                    >
                      {copiedTemplate === 't2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTemplate === 't2' ? 'Copied' : 'Copy Template'}</span>
                    </button>
                  </div>
                  <p className="text-xs sm:text-[13px] text-stone-700 font-mono bg-stone-50 p-4 rounded-xl leading-relaxed border border-stone-100">
                    {TEMPLATE_DIRECTIONS}
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 4: Three Steps to Get Listed in 8 Minutes — WITH WIDE, PROPERLY PADDED LEDGER */}
            <section id="section-get-listed" className="pt-4 border-t border-stone-200/80">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Rule 04</span>
                <span>·</span>
                <span>Fast Onboarding &amp; 100% Payout Retention</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                4. Get Listed in 8 Minutes
              </h2>
              <p className="mt-2 text-stone-600 max-w-3xl">
                Listing your whole cottage, villa, or lodge on Travel Malawi is simple. You can use our <Link to="/list-your-property" className="text-stone-900 font-semibold underline">online 4-step wizard</Link> or send details directly to our operations team:
              </p>

              <ol className="mt-5 space-y-3">
                <li className="break-inside-avoid flex items-start gap-3.5 p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs">
                  <span className="w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <strong className="font-semibold text-stone-900 text-sm sm:text-base">Send your 4 photos:</strong>
                    <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                      Bed, view, bathroom, and sunset dining/fire pit. Send directly from your phone on WhatsApp.
                    </p>
                  </div>
                </li>

                <li className="break-inside-avoid flex items-start gap-3.5 p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs">
                  <span className="w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <strong className="font-semibold text-stone-900 text-sm sm:text-base">Send property name &amp; rates:</strong>
                    <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                      Whole house rate or room rates in MWK or USD, plus any breakfast or private chef inclusions.
                    </p>
                  </div>
                </li>

                <li className="break-inside-avoid flex items-start gap-3.5 p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs">
                  <span className="w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <strong className="font-semibold text-stone-900 text-sm sm:text-base">Share your location pin:</strong>
                    <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                      Drop a WhatsApp pin at your property&apos;s main entrance or vehicle gate.
                    </p>
                  </div>
                </li>
              </ol>

              {/* Handcrafted Architectural Sketch 03: Widened Commission Reconciliation Ledger (Never clipped) */}
              <div className="break-inside-avoid my-6 p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                    Drafting Sketch 03 // Commission Reconciliation Ledger
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">100% Host Revenue Retention</span>
                </div>

                <div className="flex items-center justify-center py-2 overflow-x-auto">
                  <svg
                    viewBox="0 0 600 230"
                    className="w-full max-w-2xl h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
                  >
                    {/* Outer Ledger Card (width 540 from x=30 to x=570) */}
                    <rect x="30" y="20" width="540" height="190" rx="14" className="stroke-stone-800 fill-white stroke-[2]" />
                    <line x1="30" y1="60" x2="570" y2="60" className="stroke-stone-200 stroke-[1.5]" />
                    <line x1="300" y1="60" x2="300" y2="210" className="stroke-stone-200 stroke-[1.5]" />

                    {/* Column Headers */}
                    <rect x="50" y="32" width="160" height="20" rx="5" className="fill-stone-100 stroke-none" />
                    <text x="58" y="46" className="text-[10px] font-mono font-bold fill-stone-700 stroke-none uppercase">
                      FOREIGN OTA PLATFORM
                    </text>

                    <rect x="320" y="32" width="180" height="20" rx="5" className="fill-emerald-100 stroke-none" />
                    <text x="328" y="46" className="text-[10px] font-mono font-bold fill-emerald-800 stroke-none uppercase">
                      TRAVEL MALAWI DIRECT
                    </text>

                    {/* Left Column: Foreign OTA breakdown */}
                    <text x="50" y="90" className="text-[11px] font-sans fill-stone-600 stroke-none">
                      Nightly Rate:
                    </text>
                    <text x="180" y="90" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none">
                      MK 100,000
                    </text>

                    <text x="50" y="114" className="text-[11px] font-sans fill-rose-700 stroke-none font-semibold">
                      &minus; 18% OTA Commission:
                    </text>
                    <text x="210" y="114" className="text-[11px] font-mono font-bold fill-rose-700 stroke-none">
                      &minus; MK 18,000
                    </text>

                    <text x="50" y="136" className="text-[11px] font-sans fill-rose-700 stroke-none">
                      &minus; Wire &amp; Forex Fee:
                    </text>
                    <text x="210" y="136" className="text-[11px] font-mono fill-rose-700 stroke-none">
                      &minus; MK 4,500
                    </text>

                    <line x1="50" y1="150" x2="275" y2="150" className="stroke-stone-200" />
                    <text x="50" y="172" className="text-[10px] font-sans uppercase fill-stone-400 stroke-none">
                      Net Host Payout:
                    </text>
                    <text x="50" y="196" className="text-[16px] font-serif font-bold fill-rose-800 stroke-none">
                      MK 77,500
                    </text>
                    <text x="160" y="194" className="text-[9px] font-mono fill-stone-400 stroke-none">
                      (Delayed 30 days)
                    </text>

                    {/* Right Column: Travel Malawi breakdown (Spacious, never overflowing) */}
                    <text x="320" y="90" className="text-[11px] font-sans fill-stone-600 stroke-none">
                      Nightly Rate:
                    </text>
                    <text x="450" y="90" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none">
                      MK 100,000
                    </text>

                    <text x="320" y="114" className="text-[11px] font-sans fill-emerald-800 stroke-none font-semibold">
                      0% Commission Fee:
                    </text>
                    <text x="475" y="114" className="text-[11px] font-mono font-bold fill-emerald-800 stroke-none">
                      MK 0 (0%)
                    </text>

                    <text x="320" y="136" className="text-[11px] font-sans fill-stone-500 stroke-none">
                      Settlement Rails:
                    </text>
                    <text x="430" y="136" className="text-[9px] font-mono fill-stone-700 stroke-none">
                      Airtel / Mpamba / Bank
                    </text>

                    <line x1="320" y1="150" x2="550" y2="150" className="stroke-stone-200" />
                    <text x="320" y="172" className="text-[10px] font-sans uppercase fill-emerald-800 stroke-none font-bold">
                      Direct Net Payout:
                    </text>
                    <text x="320" y="196" className="text-[16px] font-serif font-bold fill-emerald-800 stroke-none">
                      MK 100,000 (100%)
                    </text>
                    <text x="480" y="194" className="text-[9px] font-mono fill-emerald-700 stroke-none font-bold">
                      Instant Direct
                    </text>
                  </svg>
                </div>
              </div>

              {/* Action Links Strip */}
              <div className="mt-5 flex flex-wrap gap-2.5 text-xs print:hidden">
                <Link
                  to="/list-your-property"
                  className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-2xs"
                >
                  <span>List Your Property Online</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 font-semibold px-4 py-2.5 rounded-xl transition shadow-2xs"
                >
                  <span>Host Dashboard &amp; Rates</span>
                </Link>
                <a
                  href="https://api.whatsapp.com/send?phone=265999000000&text=Muli%20bwanji!%20I%20have%20a%20property%20I%20want%20to%20list%20on%20Travel%20Malawi"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-emerald-700 border border-emerald-200 font-semibold px-4 py-2.5 rounded-xl transition shadow-2xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Concierge Line</span>
                </a>
              </div>
            </section>

            {/* SECTION 5: Quick Property Submission Form — Supports Whole Houses & Rooms */}
            <section id="onboarding-form" className="pt-6 border-t border-stone-200/90 print:hidden">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Fast Submission</span>
                <span>·</span>
                <span>Free Onboarding</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                5. Submit Your Property Directly
              </h2>
              <p className="mt-1.5 text-stone-600 text-xs sm:text-sm max-w-3xl">
                Prefer our concierge team to configure your listing for you? Fill out the brief details below. We set up your listing page, verify your photos, and message you on WhatsApp within 24 hours.
              </p>

              {submitted ? (
                <div className="mt-6 p-6 sm:p-8 rounded-3xl bg-stone-50 border border-stone-200 text-center animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif font-bold text-xl text-stone-900 mb-1">
                    Takulandirani! We have received your property details.
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mb-4">
                    Reference ID: <span className="font-mono font-bold text-stone-800">{submissionId}</span>. Our concierge team will message you on WhatsApp at <strong className="text-stone-900">{formData.contactPhone}</strong> to verify your photos and make your stay live.
                  </p>
                  <a
                    href={`https://api.whatsapp.com/send?text=Muli%20bwanji!%20I%20just%20submitted%20my%20property%20${encodeURIComponent(formData.propName)}%20(Ref:%20${submissionId})`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Confirm Submission on WhatsApp</span>
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {/* Stay Type Selection (Whole House vs Rooms) */}
                  <div>
                    <label className={labelClass}>How is your stay booked?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, stayType: 'whole_house' })}
                        className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                          formData.stayType === 'whole_house'
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Home className="w-4 h-4" />
                          <div>
                            <p className="font-semibold text-xs sm:text-sm">Whole House / Entire Cottage</p>
                            <p className="text-[11px] opacity-75">Booked exclusively as a single unit</p>
                          </div>
                        </div>
                        {formData.stayType === 'whole_house' && <Check className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, stayType: 'rooms' })}
                        className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                          formData.stayType === 'rooms'
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Bed className="w-4 h-4" />
                          <div>
                            <p className="font-semibold text-xs sm:text-sm">Room-by-Room Stay</p>
                            <p className="text-[11px] opacity-75">Individual chalets, suites, or B&amp;B rooms</p>
                          </div>
                        </div>
                        {formData.stayType === 'rooms' && <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>Property Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chembe Lake Cottage, Mulanje View Villa, Kaya Camp"
                        value={formData.propName}
                        onChange={e => setFormData({ ...formData, propName: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Location / District *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cape Maclear, Mangochi, Lilongwe Area 10, Mulanje"
                        value={formData.propLoc}
                        onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Manager or Host Name</label>
                      <input
                        type="text"
                        placeholder="Your full name"
                        value={formData.contactName}
                        onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>WhatsApp / Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. +265 999 123 456"
                        value={formData.contactPhone}
                        onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Capacity &amp; Bed Setup</label>
                      <input
                        type="text"
                        placeholder="e.g. 3 Bedrooms, sleeps 6 guests, private pool"
                        value={formData.capacity}
                        onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Starting Nightly Rate</label>
                      <div className="flex gap-2">
                        <select
                          value={formData.currency}
                          onChange={e => setFormData({ ...formData, currency: e.target.value })}
                          className="border border-stone-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-900 bg-white focus:outline-none focus:border-stone-900 shadow-2xs"
                        >
                          <option value="MWK">MWK</option>
                          <option value="USD">USD</option>
                        </select>
                        <input
                          type="text"
                          placeholder="e.g. 120,000 or 80"
                          value={formData.startingRate}
                          onChange={e => setFormData({ ...formData, startingRate: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Property Features / Notes (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Solar power backup, private beach frontage, borehole water, boat transfers, private cook"
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-xs text-stone-500">
                      0% Commission · Direct guest contact on WhatsApp · Free verification
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm px-6 py-3 rounded-xl transition cursor-pointer shadow-2xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Submitting...' : 'Submit Property for Listing'}</span>
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>

          {/* Document Footer (Screen) */}
          <footer className="mt-12 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 print:hidden">
            <div>
              <span className="font-semibold text-stone-900">Travel Malawi</span>
              <span className="mx-2">·</span>
              <span>The Warm Heart of Africa</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/how-hosting-works" className="hover:text-stone-900 underline">
                How Hosting Works
              </Link>
              <Link to="/list-your-property" className="hover:text-stone-900 underline">
                List Property
              </Link>
              <Link to="/dashboard" className="hover:text-stone-900 underline">
                Host Dashboard
              </Link>
              <Link to="/" className="hover:text-stone-900 underline">
                Browse Stays
              </Link>
            </div>
          </footer>

          {/* Dedicated Print & PDF Footer */}
          <footer className="hidden print:block mt-8 pt-4 border-t border-stone-300 text-[11px] text-stone-600">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-bold text-stone-900">Travel Malawi Direct Hospitality</p>
                <p className="mt-0.5">Connecting whole cottages, villas, safari camps &amp; lodges directly with domestic and international travelers.</p>
              </div>
              <div className="space-y-0.5 font-mono text-[10px]">
                <p>• List Property: travelmalawi.mw/list-your-property</p>
                <p>• Host Playbook: travelmalawi.mw/how-hosting-works</p>
                <p>• WhatsApp Concierge: +265 999 000 000</p>
              </div>
            </div>
          </footer>
        </article>

        {/* Email & PDF Modal Dialog */}
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full p-6 sm:p-7 relative">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-900 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-lg">Email &amp; Share Field Guide</h3>
                  <p className="text-xs text-stone-500">Send summary &amp; links directly to yourself or a partner lodge manager.</p>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-stone-700">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                    Recipient Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. host@lakesidecottage.mw or your email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-900 transition shadow-2xs"
                  />
                  <p className="mt-1 text-[11px] text-stone-400">
                    Leave blank to choose recipient in your email app.
                  </p>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1 text-stone-600">
                  <p className="font-semibold text-stone-900">Email contents include:</p>
                  <p>• Whole houses &amp; cottages vs. room-by-room listings</p>
                  <p>• 0% Commission &amp; Instant Mobile Money/Bank payout summary</p>
                  <p>• 4 instructor photography angles &amp; dual pricing guidelines</p>
                  <p>• 2 ready-to-use WhatsApp templates with one-click copy</p>
                  <p>• Direct links to the online listing wizard &amp; visual playbook</p>
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEmailClient();
                      setShowEmailModal(false);
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Open in Email App</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyEmailText}
                    className="inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    {copiedEmailText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedEmailText ? 'Copied to Clipboard' : 'Copy Email Body'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailModal(false);
                      handleShareWhatsApp();
                    }}
                    className="hover:text-emerald-700 underline flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Share on WhatsApp instead</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailModal(false);
                      handlePrint();
                    }}
                    className="hover:text-stone-900 underline flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print / Save PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
