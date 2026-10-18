import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Copy, Check, Printer, Send, Download, Mail,
  ExternalLink, Bed, Compass, Bath, Utensils, CheckCircle2, ChevronRight,
  X, Share2, Smartphone, FileText, Home, Camera, ShieldCheck, Tag,
  Calendar, Activity, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';
import SEOHead from '../components/SEOHead';

export default function HostStarterPack() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'host-onboarding-pack',
    'Host Starter Pack & Field Guide',
    'A practical, human-crafted guide for independent lodges, whole lakeside cottages, private villas, B&Bs, and safari camps across Malawi. Built for 0% commission, direct WhatsApp bookings, and authentic Malawian hospitality.'
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
    nightlyMwk: '',
    nightlyUsd: '',
    roomCount: '1',
    notes: '',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/host-guide');
    setCopiedLink(true);
    toast.success('Guide link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Takulandirani! Here is the Travel Malawi Host Starter Pack & Field Guide (0% Commission & Direct Bookings):\n${window.location.origin}/host-guide`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleDownload = () => {
    window.location.href = '/api/admin/docs/host-onboarding-pack?format=html&download=1';
  };

  const copyTemplateText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(key);
    toast.success('WhatsApp template copied!');
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  const emailSummaryText = `TRAVEL MALAWI · HOST STARTER PACK & FIELD GUIDE
0% Commission · Direct WhatsApp Bookings · 3-Minute Read

Takulandirani! Welcome to direct hosting in Malawi.

Key Summary for Property Owners & Caretakers:
1. Stays Can Be Whole Houses or Rooms:
   Whether you run an entire 4-bedroom lakeside cottage, a private family villa, a boutique B&B, or a safari camp, you retain 100% of guest revenue.

2. The 4 Winning Photo Angles (No Camera Crew Needed):
   - 01. The Master Bed & Linens: 45° eye-level perspective in morning light.
   - 02. The Veranda & Horizon View: Rule-of-thirds with 1/3 deck & 2/3 lake/mountain horizon.
   - 03. The En-Suite Bathroom: 15° off-mirror axis showing dry tiles & clean hot shower.
   - 04. Evening Veranda Dining / Boma: 30° seated angle at golden hour (17:15).

3. Two-Way Direct Guest Chat & 24/7 Ulendo Concierge AI Copilot:
   - Guests chat directly with you via in-app real-time messaging and WhatsApp (no masked numbers or call centers).
   - Managers chat with Ulendo Concierge AI inside the dashboard for 24/7 seasonal rate guidance, daily restaurant board updates, and drafted guest notes.

4. 2-Way Calendar Sync & Live Diagnostics:
   - Connect RoomRaccoon, Airbnb, NightsBridge, Booking.com, and Google Calendar.
   - On-demand "Test Connection" button checks feed response latency, validates RFC 5545 compliance, and previews upcoming blocked reservations. Zero double bookings guaranteed.

5. Concierge Onboarding & Support Shadow Mode:
   - Verified Travel Malawi support staff can securely shadow your manager view in real-time to troubleshoot PMS links or adjust rates with you live, without requiring your password.

6. Fair Dual Pricing Guidelines:
   - Malawian Kwacha (MWK): Clean round thousands (e.g. MK 85,000 / night or MK 280,000 for whole cottages).
   - US Dollars (USD): Whole figures rounded to nearest $5 (e.g. $55 or $180).

7. Zero Commission Ledger:
   - Foreign OTAs take ~18% commission + forex remittance fees (e.g. MK 77,500 payout delayed 30 days).
   - Travel Malawi Direct: 100% retained (MK 100,000 net) paid instantly to your Airtel Money, TNM Mpamba, or National Bank of Malawi account.

Read the full interactive guide with architectural sketches:
${window.location.origin}/host-guide

List your property online:
${window.location.origin}/list-your-property`;

  const handleSendEmailViaApp = () => {
    const subject = encodeURIComponent('Host Starter Pack & Field Guide — Travel Malawi');
    const body = encodeURIComponent(emailSummaryText);
    const mailto = recipientEmail.trim()
      ? `mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailto;
    setShowEmailModal(false);
  };

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(emailSummaryText);
    setCopiedEmailText(true);
    toast.success('Summary text copied for email!');
    setTimeout(() => setCopiedEmailText(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() || !formData.contactPhone.trim()) {
      toast.error('Please enter property name and WhatsApp phone number');
      return;
    }
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'host_onboarding_submissions'), {
        ...formData,
        createdAt: serverTimestamp(),
        source: 'host-starter-pack-web',
        status: 'pending_review',
      });
      setSubmissionId(docRef.id);
      setSubmitted(true);
      toast.success('Property submitted! Our team will message you on WhatsApp.');
    } catch {
      const fallbackId = 'SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setSubmissionId(fallbackId);
      setSubmitted(true);
      toast.success('Property details received! Our team will connect on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-stone-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition shadow-2xs leading-relaxed';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5';

  return (
    <div className="min-h-screen bg-stone-50/50 text-stone-700 font-sans print:bg-white">
      <SEOHead
        title="Host Starter Pack & Field Guide — Travel Malawi"
        description="A practical operational guide for independent lodges, lakeside cottages, private villas, B&Bs, and safari camps across Malawi. 0% commission direct booking and WhatsApp host tools."
        keywords="Malawi host guide, lodge onboarding Malawi, cottage rental Malawi, safari camp operations, Travel Malawi starter pack"
        url="https://ulendomalawi.com/host-starter-pack"
      />
      {/* Container widened to max-w-6xl matching ListProperty page layout */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 print:p-0 print:max-w-none">

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
            <p className="mt-3 text-stone-600 text-sm sm:text-base md:text-lg leading-relaxed max-w-4xl">
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
                <span className="font-semibold text-stone-900 text-sm sm:text-base">Under 3 Minutes</span>
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
                4. 0% Commission Ledger
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
                    viewBox="0 0 560 280"
                    className="w-full max-w-2xl h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
                  >
                    {/* Waterline & Lakeshore contour */}
                    <path d="M 30 240 Q 150 230 280 240 T 530 235" strokeDasharray="3 3" className="stroke-stone-400" />
                    <text x="360" y="260" className="text-[9px] font-mono fill-stone-400 stroke-none tracking-wider">
                      LAKE MALAWI WATERLINE ±0.00
                    </text>

                    {/* Acacia Tree Silhouette */}
                    <path d="M 470 235 Q 475 190 485 160 Q 470 135 450 120 M 485 160 Q 500 135 520 120" className="stroke-stone-600 stroke-[2]" />
                    <path d="M 430 120 Q 470 105 500 115 Q 530 120 510 135 Q 470 145 430 120 Z" className="fill-stone-200/50 stroke-stone-500 stroke-[1]" />

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
                      <rect x="0" y="0" width="175" height="48" rx="8" className="fill-white stroke-stone-800 stroke-[1.5] filter drop-shadow-xs" />
                      <text x="10" y="16" className="text-[9px] font-mono fill-stone-400 stroke-none uppercase">RATE BLUEPRINT</text>
                      <text x="10" y="34" className="text-[12px] font-serif font-bold fill-stone-900 stroke-none">
                        MK 120,000 / $80
                      </text>
                      <text x="115" y="34" className="text-[9px] font-sans fill-emerald-700 stroke-none font-bold">
                        (Whole Stay)
                      </text>
                      <path d="M 175 24 L 205 48" className="stroke-amber-700 stroke-[1.2]" strokeDasharray="3 2" />
                      <circle cx="205" cy="48" r="2" className="fill-amber-700 stroke-none" />
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
                1. Four Photos That Win the Stay (Instructor Angle Illustrations)
              </h2>
              <p className="mt-2 text-stone-600 max-w-4xl">
                You do not need a professional photographer or expensive studio lights. Any smartphone taken in morning natural light with a wiped clean lens works best. Follow these <strong>four precise camera framing angles</strong> to capture genuine quality and build instant guest trust:
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
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">1. The Master Bed &amp; Linens (Sleep Anchor)</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Angle: 45° Isometric Diagonal · Chest Height (1.4m)</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-full">
                        Sleep Quality
                      </span>
                    </div>

                    {/* Camera Angle Instructor Drafting SVG 01 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 460 210" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.4] stroke-linecap-round stroke-linejoin-round select-none">
                        {/* Room Corner Framing Lines */}
                        <line x1="20" y1="20" x2="20" y2="185" className="stroke-stone-300 stroke-[1]" />
                        <line x1="20" y1="185" x2="440" y2="185" className="stroke-stone-300 stroke-[1]" />
                        <line x1="20" y1="185" x2="160" y2="80" className="stroke-stone-300 stroke-[1]" strokeDasharray="3 3" />

                        {/* Bed in 45-degree isometric perspective */}
                        <path d="M 120 145 L 250 180 L 400 115 L 270 80 Z" className="fill-stone-100 stroke-stone-900 stroke-[2]" />
                        {/* Headboard */}
                        <path d="M 270 80 L 400 115 L 400 65 L 270 30 Z" className="fill-stone-200 stroke-stone-900 stroke-[1.8]" />
                        {/* Crisp White Duvet Fold */}
                        <path d="M 170 135 L 260 160 L 370 110 L 280 85 Z" className="fill-white stroke-stone-600 stroke-[1.2]" />
                        {/* Pillows */}
                        <rect x="290" y="68" width="38" height="22" rx="5" className="fill-white stroke-stone-800 stroke-[1.5]" />
                        <rect x="340" y="85" width="38" height="22" rx="5" className="fill-white stroke-stone-800 stroke-[1.5]" />

                        {/* Side Window with Sunlight Rays */}
                        <rect x="30" y="35" width="55" height="75" rx="3" className="fill-amber-50/60 stroke-stone-700 stroke-[1.5]" />
                        <line x1="57" y1="35" x2="57" y2="110" className="stroke-stone-400 stroke-[1]" />
                        <line x1="30" y1="72" x2="85" y2="72" className="stroke-stone-400 stroke-[1]" />
                        {/* Sunlight Ray Vectors */}
                        <path d="M 85 50 L 175 110 M 85 80 L 195 140 M 85 100 L 210 165" stroke="#d97706" strokeWidth="1.2" strokeDasharray="3 2" />
                        <text x="95" y="42" className="text-[8px] font-mono fill-amber-700 stroke-none font-bold">☀ 08:00 AM MORNING LIGHT</text>

                        {/* Smartphone/Tripod Position at 45° Corner */}
                        <g transform="translate(45, 135)">
                          {/* Tripod Legs */}
                          <line x1="0" y1="25" x2="15" y2="0" stroke="#059669" strokeWidth="1.5" />
                          <line x1="30" y1="25" x2="15" y2="0" stroke="#059669" strokeWidth="1.5" />
                          <line x1="15" y1="30" x2="15" y2="0" stroke="#059669" strokeWidth="1.5" />
                          {/* Phone silhouette */}
                          <rect x="8" y="-18" width="14" height="20" rx="3" fill="#059669" stroke="#065f46" strokeWidth="1" />
                          <circle cx="15" cy="-8" r="2" fill="white" />
                          <text x="-25" y="42" className="text-[8px] font-mono fill-emerald-800 stroke-none font-bold">TRIPOD (1.4m)</text>
                        </g>

                        {/* Sightline FOV Cone from Camera to Pillow Focus */}
                        <path d="M 60 125 L 310 80 M 60 125 L 260 170" stroke="#059669" strokeWidth="1" strokeDasharray="3 3" />
                        {/* Crosshair Target on Crisp Pillows */}
                        <circle cx="330" cy="88" r="10" stroke="#059669" strokeWidth="1.2" fill="none" />
                        <line x1="315" y1="88" x2="345" y2="88" stroke="#059669" strokeWidth="1" />
                        <line x1="330" y1="73" x2="330" y2="103" stroke="#059669" strokeWidth="1" />
                        <text x="345" y="65" className="text-[8px] font-mono fill-emerald-800 stroke-none font-bold">FOCAL TARGET</text>

                        {/* Angle Arc Dimension */}
                        <path d="M 90 145 A 25 25 0 0 0 85 120" stroke="#b45309" strokeWidth="1.2" fill="none" />
                        <text x="96" y="132" className="text-[9px] font-mono fill-amber-900 stroke-none font-bold">45° CORNER ARC</text>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      Smooth crisp linens, fluffed pillows, with morning light from a side window. For <strong>whole houses &amp; cottages</strong>, photograph the master suite first — guests book the entire home based on the perceived sleep comfort.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Instructor Tip: Stand at the diagonal room doorway, chest height (1.4m), lens wiped spotless.
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
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">2. The Veranda &amp; Horizon (Aspiration)</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Framing: 16:9 Landscape · Rule of Thirds Horizon</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100/70 px-2.5 py-1 rounded-full">
                        Lake / Mountain
                      </span>
                    </div>

                    {/* Camera Angle Instructor Drafting SVG 02 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 460 210" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.4] stroke-linecap-round stroke-linejoin-round select-none">
                        {/* Rule of Thirds Grid Line (Upper 1/3 Horizon) */}
                        <line x1="20" y1="75" x2="440" y2="75" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="4 2" />
                        <text x="300" y="68" className="text-[8px] font-mono fill-blue-700 stroke-none font-bold">HORIZON LINE (UPPER 1/3)</text>
                        <text x="30" y="68" className="text-[8px] font-mono fill-blue-700 stroke-none font-bold">LEVEL BUBBLE ±0.0°</text>

                        {/* Cape Maclear / Mulanje Mountain Silhouettes in Background */}
                        <path d="M 30 75 Q 90 40 160 75 Q 230 45 300 75 Q 370 50 440 75" className="fill-blue-50 stroke-stone-600 stroke-[1.5]" />
                        {/* Lake Waterline gentle ripples */}
                        <path d="M 40 95 Q 140 90 240 95 T 430 95" stroke="#93c5fd" strokeWidth="1" strokeDasharray="3 3" />
                        <path d="M 60 115 Q 160 110 260 115 T 420 115" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 4" />

                        {/* Covered Veranda Overhang Beam in Top 1/4 */}
                        <rect x="20" y="20" width="420" height="14" className="fill-stone-200 stroke-stone-800 stroke-[1.8]" />
                        <line x1="90" y1="34" x2="90" y2="135" className="stroke-stone-800 stroke-[2.5]" />
                        <line x1="370" y1="34" x2="370" y2="135" className="stroke-stone-800 stroke-[2.5]" />

                        {/* Foreground Timber Deck Railing in Lower 1/3 */}
                        <rect x="20" y="135" width="420" height="15" className="fill-stone-200 stroke-stone-900 stroke-[2]" />
                        <line x1="150" y1="150" x2="150" y2="195" className="stroke-stone-700 stroke-[2]" />
                        <line x1="290" y1="150" x2="290" y2="195" className="stroke-stone-700 stroke-[2]" />

                        {/* Foreground Coffee Press & Malawian Mug Anchor */}
                        <g transform="translate(195, 108)">
                          <rect x="0" y="0" width="16" height="26" rx="3" className="fill-white stroke-stone-900 stroke-[1.5]" />
                          <line x1="8" y1="-5" x2="8" y2="0" stroke-stone-900 strokeWidth="1.5" />
                          <circle cx="8" cy="-5" r="3" fill="#1c1917" />
                          <rect x="22" y="8" width="16" height="18" rx="2" className="fill-amber-100 stroke-stone-900 stroke-[1.5]" />
                          <path d="M 38 12 Q 44 16 38 20" stroke-stone-900 strokeWidth="1.5" />
                        </g>

                        {/* Viewfinder Crop Corners */}
                        <path d="M 40 35 L 30 35 L 30 45 M 420 35 L 430 35 L 430 45 M 30 175 L 30 185 L 40 185 M 430 175 L 430 185 L 420 185" stroke="#059669" strokeWidth="2" />
                        <text x="145" y="180" className="text-[9px] font-mono fill-emerald-800 stroke-none font-bold">1/3 VERANDA DECK + 2/3 HORIZON</text>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      The horizon vista from your veranda, Lake Malawi ripples, or Mulanje peaks. For <strong>whole cottages &amp; private villas</strong>, this proves the private outdoor space where families gather to watch the sunrise.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Instructor Tip: Keep the horizon completely level (0.0°). Frame with 1/3 timber deck in the foreground for depth.
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
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">3. The En-Suite Bathroom (Hygiene Proof)</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Angle: 15° Off-Mirror Axis · Chest Height</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100/70 px-2.5 py-1 rounded-full">
                        Hygiene &amp; Water
                      </span>
                    </div>

                    {/* Camera Angle Instructor Drafting SVG 03 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 460 210" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.4] stroke-linecap-round stroke-linejoin-round select-none">
                        {/* Bathroom Floor Tiles Grid */}
                        <line x1="20" y1="165" x2="440" y2="165" className="stroke-stone-300 stroke-[1]" />
                        <line x1="80" y1="165" x2="100" y2="195" className="stroke-stone-300 stroke-[1]" />
                        <line x1="180" y1="165" x2="200" y2="195" className="stroke-stone-300 stroke-[1]" />
                        <line x1="280" y1="165" x2="300" y2="195" className="stroke-stone-300 stroke-[1]" />
                        <line x1="380" y1="165" x2="400" y2="195" className="stroke-stone-300 stroke-[1]" />

                        {/* Walk-in Glass Shower Screen (Left Side) */}
                        <rect x="50" y="30" width="110" height="135" className="fill-blue-50/20 stroke-stone-800 stroke-[2]" />
                        {/* Chrome Overhead Rain Showerhead */}
                        <path d="M 90 35 L 90 55 L 115 55" className="stroke-stone-800 stroke-[2.5]" />
                        <circle cx="115" cy="55" r="10" className="fill-stone-200 stroke-stone-800 stroke-[1.5]" />
                        {/* Hot Water Droplets Hatching */}
                        <line x1="108" y1="70" x2="108" y2="120" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="115" y1="70" x2="115" y2="120" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="122" y1="70" x2="122" y2="120" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 3" />
                        <text x="65" y="145" className="text-[8px] font-mono fill-sky-700 stroke-none font-bold">DRY TILES / HOT WATER</text>

                        {/* Wall Mirror (Center-Right) with Zero Reflection Off-Axis */}
                        <rect x="210" y="35" width="95" height="75" rx="5" className="fill-sky-50/40 stroke-stone-700 stroke-[1.8]" />
                        <line x1="225" y1="50" x2="260" y2="85" stroke="#bae6fd" strokeWidth="1" />
                        <text x="220" y="28" className="text-[8px] font-mono fill-stone-500 stroke-none">CLEAN MIRROR</text>

                        {/* Vanity Basin & Rolled White Towel Rack */}
                        <rect x="195" y="115" width="125" height="35" rx="4" className="fill-white stroke-stone-800 stroke-[1.8]" />
                        <circle cx="258" cy="128" r="8" className="fill-stone-100 stroke-stone-600 stroke-[1]" />
                        {/* Towel Rack (Right) with Fluffy Rolled Cotton Towels */}
                        <rect x="345" y="70" width="65" height="85" rx="4" className="fill-stone-50 stroke-stone-700 stroke-[1.5]" />
                        <rect x="355" y="85" width="45" height="16" rx="4" className="fill-white stroke-stone-800 stroke-[1.2]" />
                        <rect x="355" y="108" width="45" height="16" rx="4" className="fill-white stroke-stone-800 stroke-[1.2]" />
                        <text x="355" y="80" className="text-[7px] font-mono fill-stone-500 stroke-none">WHITE TOWELS</text>

                        {/* Camera Position: 15° Off-Axis Indicator (Red dashed line avoids mirror reflection) */}
                        <g transform="translate(145, 175)">
                          <circle cx="0" cy="0" r="4" fill="#ef4444" stroke="none" />
                          <line x1="0" y1="0" x2="70" y2="-60" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3 2" />
                          <text x="8" y="12" className="text-[8px] font-mono fill-rose-700 stroke-none font-bold">15° OFF-MIRROR AXIS (NO PHONE REFLECTION)</text>
                        </g>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      Spotless shower, clean mirror, bone-dry floor, and neatly folded white towels. In <strong>whole houses &amp; cottages</strong>, this guarantees visiting groups that every en-suite has strong hot water pressure and impeccable hygiene.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Instructor Tip: Stand 15° to the side so your phone camera and reflection never appear in the mirror.
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
                          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">4. Veranda Dining &amp; Sunset (Connection)</h3>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">Camera Angle: 30° Seated Dusk · Golden Hour (17:15)</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-full">
                        Evening Warmth
                      </span>
                    </div>

                    {/* Camera Angle Instructor Drafting SVG 04 */}
                    <div className="my-3 p-3 bg-white rounded-xl border border-stone-200/80">
                      <svg viewBox="0 0 460 210" className="w-full h-auto text-stone-800 stroke-current fill-none stroke-[1.4] stroke-linecap-round stroke-linejoin-round select-none">
                        {/* Golden Sunset Sun in Background */}
                        <circle cx="340" cy="55" r="28" className="fill-amber-100/70 stroke-amber-400 stroke-[1.5]" />
                        <line x1="340" y1="20" x2="340" y2="10" stroke="#f59e0b" strokeWidth="1.2" />
                        <line x1="370" y1="35" x2="380" y2="28" stroke="#f59e0b" strokeWidth="1.2" />
                        <line x1="375" y1="60" x2="388" y2="60" stroke="#f59e0b" strokeWidth="1.2" />
                        <text x="315" y="96" className="text-[8px] font-mono fill-amber-700 stroke-none font-bold">GOLDEN HOUR (17:15)</text>

                        {/* Acacia Tree & Lake Shore Horizon */}
                        <path d="M 280 120 Q 290 85 310 70 M 310 70 Q 295 55 285 45 M 310 70 Q 330 55 350 45" className="stroke-stone-700 stroke-[1.8]" />
                        <line x1="20" y1="120" x2="440" y2="120" stroke="#78716c" strokeWidth="1" strokeDasharray="4 2" />

                        {/* Large Dining Table for Whole House Group (Perspective Ellipse) */}
                        <ellipse cx="170" cy="145" rx="85" ry="30" className="fill-stone-100 stroke-stone-900 stroke-[2]" />
                        {/* Woven Chairs around Table */}
                        <rect x="55" y="125" width="22" height="30" rx="3" className="fill-stone-200 stroke-stone-700 stroke-[1.5]" />
                        <rect x="260" y="125" width="22" height="30" rx="3" className="fill-stone-200 stroke-stone-700 stroke-[1.5]" />
                        <rect x="160" y="175" width="25" height="20" rx="3" className="fill-stone-200 stroke-stone-700 stroke-[1.5]" />

                        {/* Hurricane Paraffin Lantern / Warm Candle Light on Table */}
                        <g transform="translate(162, 118)">
                          <rect x="4" y="6" width="10" height="15" rx="2" className="fill-amber-300/80 stroke-amber-600 stroke-[1.2]" />
                          <path d="M 9 2 Q 13 8 9 12 Q 5 8 9 2 Z" className="fill-rose-500 stroke-none" />
                          <circle cx="9" cy="8" r="8" className="fill-amber-200/40 stroke-none" />
                        </g>

                        {/* Platter of Fresh Lake Fish / Dinner Place Settings */}
                        <ellipse cx="130" cy="140" rx="14" ry="7" className="fill-white stroke-stone-700 stroke-[1]" />
                        <ellipse cx="210" cy="140" rx="14" ry="7" className="fill-white stroke-stone-700 stroke-[1]" />

                        {/* Camera Angle Arc: 30° Seated Elevation */}
                        <g transform="translate(45, 160)">
                          <line x1="0" y1="0" x2="35" y2="-15" stroke="#059669" strokeWidth="1.5" />
                          <rect x="35" y="-22" width="14" height="14" rx="2" fill="#059669" />
                          <text x="-25" y="22" className="text-[8px] font-mono fill-emerald-800 stroke-none font-bold">30° SEATED (1.1m)</text>
                        </g>
                      </svg>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      Outdoor dining table set with fresh chambo fish, cold drinks on the deck, or an evening boma fire pit glowing at dusk. For <strong>whole houses</strong>, this proves where 6 to 10 guests will gather, dine, and unwind after their drive down the M5.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-stone-200/60 text-[11px] text-stone-500 font-mono">
                    ✓ Instructor Tip: Shoot during golden hour (5:00 PM – 5:45 PM) when the sky turns warm amber.
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
              <p className="mt-2 text-stone-600 max-w-4xl">
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
                  <ul className="mt-2 space-y-1.5 text-xs text-stone-700">
                    <li>• <strong>Whole 3-Bed Lakeside House:</strong> MK 280,000 / night (sleeps 6–8)</li>
                    <li>• <strong>Private Beachfront Cottage:</strong> MK 180,000 / night</li>
                    <li>• <strong>Master En-Suite Chalet:</strong> MK 120,000 / night</li>
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
                  <ul className="mt-2 space-y-1.5 text-xs text-stone-700">
                    <li>• <strong>Whole 3-Bed Lakeside House:</strong> $180 / night (sleeps 6–8)</li>
                    <li>• <strong>Private Beachfront Cottage:</strong> $115 / night</li>
                    <li>• <strong>Master En-Suite Chalet:</strong> $80 / night</li>
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

            {/* SECTION 3: Two-Way Direct Guest Chat & Ulendo Concierge AI Copilot */}
            <section id="section-whatsapp" className="pt-4 border-t border-stone-200/80">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Rule 03</span>
                <span>·</span>
                <span>Direct Inquiries &amp; 24/7 Hospitality Copilot</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                3. Direct Guest Chat &amp; Ulendo Concierge AI Copilot
              </h2>
              <p className="mt-2 text-stone-600 max-w-4xl">
                Travel Malawi eliminates opaque call centers and robotic intermediaries. Guests can chat directly with your property manager in real time, while managers have 24/7 conversational access to <strong>Ulendo Concierge AI</strong>—our resident hospitality copilot—to draft replies, recommend seasonal rates, and update daily boards in seconds.
              </p>

              {/* Handcrafted Architectural Sketch 02: Dual-Channel Communication Architecture */}
              <div className="break-inside-avoid my-6 p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                    Drafting Sketch 02 // Direct Guest Chat + Ulendo Concierge AI Architecture
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">Two-Way Conversations · Zero Friction</span>
                </div>

                <div className="flex items-center justify-center py-2 overflow-x-auto">
                  <svg
                    viewBox="0 0 720 250"
                    className="w-full max-w-3xl h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
                  >
                    {/* Station 1: Guest Phone (Left, x=30 to x=150) */}
                    <rect x="30" y="25" width="120" height="195" rx="16" className="stroke-stone-800 fill-white stroke-[2]" />
                    <line x1="70" y1="36" x2="110" y2="36" className="stroke-stone-300 stroke-[2]" />
                    <circle cx="90" cy="205" r="3" className="stroke-stone-300 stroke-[1]" />
                    <text x="45" y="58" className="text-[9px] font-mono fill-stone-400 stroke-none uppercase">GUEST DEVICE</text>
                    <text x="45" y="75" className="text-[12px] font-bold fill-stone-900 stroke-none">Direct Traveler</text>
                    {/* Guest Chat Bubble */}
                    <rect x="40" y="90" width="100" height="52" rx="8" className="fill-stone-100 stroke-stone-300 stroke-[1]" />
                    <text x="48" y="106" className="text-[8px] font-sans fill-stone-800 stroke-none font-semibold">&ldquo;Available this Sat?&rdquo;</text>
                    <text x="48" y="118" className="text-[7.5px] font-sans fill-stone-600 stroke-none">Boat pickup from</text>
                    <text x="48" y="129" className="text-[7.5px] font-sans fill-stone-600 stroke-none">Monkey Bay at 2pm?</text>

                    {/* Station 2: Host Phone & Dashboard (Center, x=290 to x=430) */}
                    <rect x="290" y="25" width="140" height="195" rx="16" className="stroke-stone-800 fill-white stroke-[2]" />
                    <line x1="335" y1="36" x2="385" y2="36" className="stroke-stone-300 stroke-[2]" />
                    <circle cx="360" cy="205" r="3" className="stroke-stone-300 stroke-[1]" />
                    <text x="305" y="58" className="text-[9px] font-mono fill-emerald-800 stroke-none uppercase font-bold">PROPERTY MANAGER</text>
                    <text x="305" y="75" className="text-[12px] font-bold fill-stone-900 stroke-none">Your Lodge Hub</text>
                    {/* Manager Reply to Guest */}
                    <rect x="300" y="90" width="120" height="42" rx="8" className="fill-emerald-50 stroke-emerald-600 stroke-[1]" />
                    <text x="308" y="105" className="text-[8px] font-sans fill-emerald-950 stroke-none font-bold">&ldquo;Takulandirani!&rdquo;</text>
                    <text x="308" y="117" className="text-[7.5px] font-sans fill-emerald-800 stroke-none">Boat ready at 2 PM.</text>
                    <text x="308" y="127" className="text-[7.5px] font-sans fill-emerald-800 stroke-none">Lakeview Chalet held!</text>
                    {/* Manager Query to Ulendo */}
                    <rect x="300" y="140" width="120" height="40" rx="8" className="fill-amber-50 stroke-amber-400 stroke-[1]" />
                    <text x="308" y="154" className="text-[7.5px] font-sans fill-amber-950 stroke-none font-semibold">&ldquo;Ulendo, suggest Easter</text>
                    <text x="308" y="165" className="text-[7.5px] font-sans fill-amber-950 stroke-none">rate &amp; draft deposit note&rdquo;</text>

                    {/* Station 3: Ulendo Concierge AI (Right, x=570 to x=690) */}
                    <rect x="570" y="25" width="120" height="195" rx="16" className="stroke-stone-900 fill-stone-900 stroke-[2]" />
                    <line x1="610" y1="36" x2="650" y2="36" className="stroke-stone-700 stroke-[2]" />
                    <circle cx="630" cy="205" r="3" className="stroke-amber-500 stroke-[1]" />
                    <text x="585" y="58" className="text-[9px] font-mono fill-amber-400 stroke-none uppercase font-bold">ULENDO CONCIERGE</text>
                    <text x="585" y="75" className="text-[12px] font-bold fill-white stroke-none">24/7 Operations AI</text>
                    {/* Ulendo Output Bubble */}
                    <rect x="580" y="90" width="100" height="72" rx="8" className="fill-stone-800 stroke-amber-600/60 stroke-[1]" />
                    <text x="588" y="106" className="text-[8px] font-sans fill-amber-300 stroke-none font-bold">&ldquo;Easter Benchmark:&rdquo;</text>
                    <text x="588" y="118" className="text-[7.5px] font-sans fill-stone-200 stroke-none">MK 140,000 / $80</text>
                    <text x="588" y="130" className="text-[7.5px] font-sans fill-stone-200 stroke-none">Deposit text ready</text>
                    <text x="588" y="143" className="text-[7.5px] font-sans fill-emerald-400 stroke-none font-medium">&#10003; 1-click apply</text>

                    {/* Left Connecting Arc (Guest <-> Manager) */}
                    <path d="M 150 110 C 210 80 230 80 290 110" className="stroke-emerald-700 stroke-[2]" strokeDasharray="5 3" />
                    <circle cx="220" cy="94" r="11" className="fill-emerald-800 stroke-white stroke-[1.5]" />
                    <path d="M 216 94 L 219 97 L 225 91" className="stroke-white stroke-[1.5] fill-none" />
                    <text x="160" y="132" className="text-[8px] font-mono fill-emerald-800 stroke-none font-bold">DIRECT GUEST CHAT</text>

                    {/* Right Connecting Arc (Manager <-> Ulendo) */}
                    <path d="M 430 160 C 490 135 510 135 570 160" className="stroke-amber-600 stroke-[2]" strokeDasharray="5 3" />
                    <circle cx="500" cy="146" r="11" className="fill-amber-600 stroke-white stroke-[1.5]" />
                    <circle cx="500" cy="146" r="3" className="fill-white stroke-none" />
                    <text x="445" y="182" className="text-[8px] font-mono fill-amber-800 stroke-none font-bold">CONCIERGE COPILOT</text>
                  </svg>
                </div>
              </div>

              {/* Two Core Conversation Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Pillar 1: Direct Guest Inquiries */}
                <div className="p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-sm sm:text-base">
                    <MessageSquare className="w-4 h-4 text-emerald-700" />
                    <span>Channel 1: Direct Guest-to-Host Chat</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    Travelers can chat directly with you via <strong>real-time in-app messaging</strong> on your listing and via <strong>instant WhatsApp</strong>. No masked phone numbers, no delayed email queues.
                  </p>
                  <ul className="text-xs text-stone-600 space-y-1.5 list-disc pl-4">
                    <li><strong>Boat &amp; Lake Transfers:</strong> Coordinate boat pickups from Monkey Bay, Cape Maclear, Senga Bay, or Likoma Island.</li>
                    <li><strong>Meal &amp; Dining Preferences:</strong> Prepare fresh Lake Chambo or special dietary requests prior to arrival.</li>
                    <li><strong>Live Presence Indicator:</strong> Guests see when the lodge manager is online and active.</li>
                    <li><strong>Turn-by-Turn Arrival Coordination:</strong> Share gate pins and road condition updates directly.</li>
                  </ul>
                </div>

                {/* Pillar 2: Ulendo Concierge AI Copilot */}
                <div className="p-5 rounded-2xl border border-stone-200 bg-stone-900 text-stone-100 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <span>Channel 2: Chat Fully with Ulendo Concierge AI</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    Inside your Host Dashboard, <strong>Ulendo</strong> is your resident Malawian hospitality AI concierge—always on duty to help you manage operations without friction.
                  </p>
                  <ul className="text-xs text-stone-300 space-y-1.5 list-disc pl-4">
                    <li><strong>Seasonal Pricing Guidance:</strong> Ask Ulendo to benchmark rates for Easter, Lake of Stars, or Christmas in MWK and USD.</li>
                    <li><strong>Drafting Guest Replies:</strong> Generate welcoming, authentic Chichewa &amp; English responses with one click.</li>
                    <li><strong>Daily Blackboard Specials:</strong> Update today's lake fish catch (Chambo, Kampango, Usipa) and dinner menus effortlessly.</li>
                    <li><strong>Amenity &amp; Policy Suggestions:</strong> Get recommendations for solar backup, Wi-Fi packages, and cancellation terms.</li>
                  </ul>
                </div>
              </div>

              {/* Template Cards */}
              <div className="space-y-4">
                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                      Template A · Fast Booking Inquiry Reply
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyTemplateText(
                          'inquiry',
                          `Takulandirani! Thank you for inquiring about [Property Name]. Yes, we have availability for [Dates] at [MK XXX,XXX / $XX per night]. The rate includes breakfast and lake access. Would you like me to reserve this for you? Looking forward to welcoming you!`
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-950 px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 transition cursor-pointer print:hidden"
                    >
                      {copiedTemplate === 'inquiry' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
                      <span>{copiedTemplate === 'inquiry' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 bg-stone-50 rounded-xl font-mono text-xs text-stone-800 leading-relaxed border border-stone-100">
                    &ldquo;Takulandirani! Thank you for inquiring about <strong>[Property Name]</strong>. Yes, we have availability for <strong>[Dates]</strong> at <strong>[MK XXX,XXX / $XX per night]</strong>. The rate includes breakfast and lake access. Would you like me to reserve this for you? Looking forward to welcoming you!&rdquo;
                  </div>
                </div>

                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                      Template B · Arrival &amp; Gate PIN Instructions
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyTemplateText(
                          'arrival',
                          `Muli bwanji! We are getting your stay ready at [Property Name]. Check-in is from 2:00 PM. Here is our exact location pin: [Google Maps / WhatsApp Pin]. Turn off the M5 at [Landmark]. Our caretaker [Name] will be waiting at the gate to welcome you. Safe travels!`
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-950 px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 transition cursor-pointer print:hidden"
                    >
                      {copiedTemplate === 'arrival' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
                      <span>{copiedTemplate === 'arrival' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 bg-stone-50 rounded-xl font-mono text-xs text-stone-800 leading-relaxed border border-stone-100">
                    &ldquo;Muli bwanji! We are getting your stay ready at <strong>[Property Name]</strong>. Check-in is from 2:00 PM. Here is our exact location pin: <strong>[Google Maps / WhatsApp Pin]</strong>. Turn off the M5 at <strong>[Landmark]</strong>. Our caretaker <strong>[Name]</strong> will be waiting at the gate to welcome you. Safe travels!&rdquo;
                  </div>
                </div>

                <div className="break-inside-avoid p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800">
                      Template C · Ulendo AI-Assisted Deposit &amp; Transfer Confirmation
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyTemplateText(
                          'deposit',
                          `Takulandirani [Guest Name]! We have provisionally blocked your dates for [Property Name]. To confirm your booking, please send your 50% deposit (MK [Amount]) via Airtel Money or TNM Mpamba to [Phone Number], or National Bank of Malawi [Account Details]. If you need lake boat transfer from [Harbor], reply here and we will have the boat ready!`
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-950 px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 transition cursor-pointer print:hidden"
                    >
                      {copiedTemplate === 'deposit' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
                      <span>{copiedTemplate === 'deposit' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3.5 bg-stone-50 rounded-xl font-mono text-xs text-stone-800 leading-relaxed border border-stone-100">
                    &ldquo;Takulandirani <strong>[Guest Name]</strong>! We have provisionally blocked your dates for <strong>[Property Name]</strong>. To confirm your booking, please send your 50% deposit (MK <strong>[Amount]</strong>) via Airtel Money or TNM Mpamba to <strong>[Phone Number]</strong>, or National Bank of Malawi <strong>[Account Details]</strong>. If you need lake boat transfer from <strong>[Harbor]</strong>, reply here and we will have the boat ready!&rdquo;
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 4: 2-Way Calendar Synchronization & Live Diagnostics */}
            <section id="section-calendar-sync" className="pt-6 border-t border-stone-200/80">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Rule 04</span>
                <span>·</span>
                <span>PMS Integration &amp; Zero Double Bookings</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                4. 2-Way Calendar Synchronization &amp; Live Connection Diagnostics
              </h2>
              <p className="mt-2 text-stone-600 max-w-4xl text-sm leading-relaxed">
                Already manage reservations with <strong>RoomRaccoon, NightsBridge, Airbnb, Booking.com</strong>, or Google Calendar? You never have to juggle multiple systems or risk painful double bookings. Travel Malawi supports native 2-way RFC 5545 iCal synchronization with instant live diagnostic testing.
              </p>

              {/* Two Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-3">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-sm sm:text-base">
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    <span>On-Demand Feed Testing &amp; Latency Ping</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    Click <strong>Test Connection</strong> next to any room in your Host Dashboard. The system pings your external PMS calendar feed in real time, verifies RFC 5545 compliance, measures round-trip response time (e.g. 142ms), and displays a live preview of upcoming blocked dates.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-mono font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Connected &amp; Syncing
                    </span>
                    <span className="text-[11px] font-mono text-stone-500">Latency: ~140ms</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-3">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-sm sm:text-base">
                    <UserCheck className="w-4 h-4 text-amber-700" />
                    <span>Hands-On Concierge &amp; Shadow Mode</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    Need help setting up? Verified Travel Malawi operations staff can securely <strong>shadow your manager view</strong> in real-time to troubleshoot PMS links or adjust rates with you live. You never share your password, and every shadow session is audit-logged with an on-screen session banner.
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80">
                    <span>100% Confidential · Zero Password Sharing</span>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 5: Widened 0% Commission Reconciliation Ledger (Never Colliding) */}
            <section id="section-get-listed" className="pt-4 border-t border-stone-200/80">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Rule 05</span>
                <span>·</span>
                <span>Revenue Retention &amp; Local Payouts</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                5. Zero Commission Ledger: 100% Host Revenue Retention
              </h2>
              <p className="mt-2 text-stone-600 max-w-4xl">
                Foreign booking platforms charge 15% to 18% commission and impose cross-border forex fees that take weeks to arrive. With Travel Malawi, you keep every Kwacha and dollar you earn, paid directly to your local account:
              </p>

              {/* Handcrafted Architectural Sketch 03: Widened Commission Reconciliation Ledger (Spacious, Right-Aligned Numbers) */}
              <div className="break-inside-avoid my-6 p-5 sm:p-6 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                    Drafting Sketch 03 // Commission Reconciliation Ledger
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">100% Host Revenue Retention</span>
                </div>

                <div className="flex items-center justify-center py-2 overflow-x-auto">
                  <svg
                    viewBox="0 0 680 250"
                    className="w-full max-w-3xl h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
                  >
                    {/* Outer Ledger Card (width 620 from x=30 to x=650) */}
                    <rect x="30" y="20" width="620" height="210" rx="16" className="stroke-stone-800 fill-white stroke-[2]" />
                    <line x1="30" y1="62" x2="650" y2="62" className="stroke-stone-200 stroke-[1.5]" />
                    <line x1="340" y1="62" x2="340" y2="230" className="stroke-stone-200 stroke-[1.5]" />

                    {/* Column Headers */}
                    <rect x="50" y="32" width="170" height="22" rx="6" className="fill-stone-100 stroke-none" />
                    <text x="60" y="47" className="text-[10px] font-mono font-bold fill-stone-700 stroke-none uppercase">
                      FOREIGN OTA PLATFORM
                    </text>

                    <rect x="360" y="32" width="190" height="22" rx="6" className="fill-emerald-100 stroke-none" />
                    <text x="370" y="47" className="text-[10px] font-mono font-bold fill-emerald-800 stroke-none uppercase">
                      TRAVEL MALAWI DIRECT
                    </text>

                    {/* Left Column: Foreign OTA breakdown (Numbers right-aligned at x=315, never colliding) */}
                    <text x="50" y="92" className="text-[11px] font-sans fill-stone-600 stroke-none">
                      Gross Nightly Rate:
                    </text>
                    <text x="315" y="92" textAnchor="end" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none">
                      MK 100,000
                    </text>

                    <text x="50" y="118" className="text-[11px] font-sans fill-rose-700 stroke-none font-semibold">
                      − 18% OTA Commission:
                    </text>
                    <text x="315" y="118" textAnchor="end" className="text-[11px] font-mono font-bold fill-rose-700 stroke-none">
                      − MK 18,000
                    </text>

                    <text x="50" y="142" className="text-[11px] font-sans fill-rose-700 stroke-none">
                      − Wire and Forex Fee:
                    </text>
                    <text x="315" y="142" textAnchor="end" className="text-[11px] font-mono font-bold fill-rose-700 stroke-none">
                      − MK 4,500
                    </text>

                    <line x1="50" y1="158" x2="315" y2="158" className="stroke-stone-200" />
                    <text x="50" y="180" className="text-[10px] font-sans uppercase fill-stone-400 stroke-none">
                      Net Host Payout:
                    </text>
                    <text x="50" y="206" className="text-[17px] font-serif font-bold fill-rose-800 stroke-none">
                      MK 77,500
                    </text>
                    <text x="315" y="204" textAnchor="end" className="text-[9px] font-mono fill-stone-400 stroke-none">
                      (Delayed 30 days)
                    </text>

                    {/* Right Column: Travel Malawi breakdown (Numbers right-aligned at x=625, never colliding) */}
                    <text x="360" y="92" className="text-[11px] font-sans fill-stone-600 stroke-none">
                      Gross Nightly Rate:
                    </text>
                    <text x="625" y="92" textAnchor="end" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none">
                      MK 100,000
                    </text>

                    <text x="360" y="118" className="text-[11px] font-sans fill-emerald-800 stroke-none font-semibold">
                      0% Commission Fee:
                    </text>
                    <text x="625" y="118" textAnchor="end" className="text-[11px] font-mono font-bold fill-emerald-800 stroke-none">
                      MK 0 (0%)
                    </text>

                    <text x="360" y="142" className="text-[11px] font-sans fill-stone-500 stroke-none">
                      Direct Settlement Rails:
                    </text>
                    <text x="625" y="142" textAnchor="end" className="text-[10px] font-mono fill-stone-700 stroke-none">
                      Airtel / Mpamba / Bank
                    </text>

                    <line x1="360" y1="158" x2="625" y2="158" className="stroke-stone-200" />
                    <text x="360" y="180" className="text-[10px] font-sans uppercase fill-emerald-800 stroke-none font-bold">
                      Direct Net Payout:
                    </text>
                    <text x="360" y="206" className="text-[17px] font-serif font-bold fill-emerald-800 stroke-none">
                      MK 100,000
                    </text>
                    <text x="625" y="204" textAnchor="end" className="text-[10px] font-mono fill-emerald-700 stroke-none font-bold">
                      100% Retained · Instant
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

            {/* SECTION 6: Quick Property Submission Form — Supports Whole Houses & Rooms */}
            <section id="onboarding-form" className="pt-6 border-t border-stone-200/90 print:hidden">
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-stone-400 uppercase tracking-wider">
                <span>Fast Submission</span>
                <span>·</span>
                <span>Free Onboarding</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900">
                6. Submit Your Property Directly
              </h2>
              <p className="mt-1.5 text-stone-600 text-xs sm:text-sm max-w-4xl">
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
                            <p className="font-semibold text-xs sm:text-sm">Individual Rooms / Chalets</p>
                            <p className="text-[11px] opacity-75">B&amp;B, lodge, or safari camp with multiple rooms</p>
                          </div>
                        </div>
                        {formData.stayType === 'rooms' && <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Property Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.propName}
                        onChange={(e) => setFormData({ ...formData, propName: e.target.value })}
                        placeholder="e.g. Example Lakeside Cottage"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Location / District *</label>
                      <input
                        type="text"
                        required
                        value={formData.propLoc}
                        onChange={(e) => setFormData({ ...formData, propLoc: e.target.value })}
                        placeholder="e.g. Cape Maclear, Mangochi"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Contact Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        placeholder="e.g. John Chirwa"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>WhatsApp Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        placeholder="e.g. +265 999 123 456"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>
                        {formData.stayType === 'whole_house' ? 'Whole Stay Rate (MWK)' : 'Room Rate (MWK)'}
                      </label>
                      <input
                        type="text"
                        value={formData.nightlyMwk}
                        onChange={(e) => setFormData({ ...formData, nightlyMwk: e.target.value })}
                        placeholder="e.g. 180,000"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {formData.stayType === 'whole_house' ? 'Whole Stay Rate (USD)' : 'Room Rate (USD)'}
                      </label>
                      <input
                        type="text"
                        value={formData.nightlyUsd}
                        onChange={(e) => setFormData({ ...formData, nightlyUsd: e.target.value })}
                        placeholder="e.g. 115"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {formData.stayType === 'whole_house' ? 'Number of Bedrooms' : 'Total Room Count'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.roomCount}
                        onChange={(e) => setFormData({ ...formData, roomCount: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Key Features &amp; Directions (Optional)</label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="e.g. Beachfront frontage, solar backup power, borehole water, chef available on request."
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 transition shadow-2xs leading-relaxed min-h-[90px] resize-y"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl text-xs sm:text-sm transition shadow-2xs cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Submitting Details...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Property for Concierge Onboarding</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </section>

          </div>

          {/* Footer note in document */}
          <footer className="mt-12 pt-6 border-t border-stone-200 text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              Travel Malawi Platform Operations · The Warm Heart of Africa
            </div>
            <div className="font-mono text-[11px] text-stone-500">
              Direct Bookings · 0% Commission
            </div>
          </footer>
        </article>
      </main>

      {/* Share / Email Guide Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif font-bold text-lg sm:text-xl text-stone-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-stone-700" />
                  <span>Share Host Starter Pack via Email</span>
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 mt-1">
                  Send this field guide summary and links to your own inbox or share it with a property partner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Recipient Email (Optional)
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. host@stayexample.mw"
                  className={inputClass}
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSendEmailViaApp}
                  className="w-full inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-2xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Launch in Mail Client (Pre-filled)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyEmailText}
                  className="w-full inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                >
                  {copiedEmailText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedEmailText ? 'Copied Summary Text!' : 'Copy Formatted Text for Manual Paste'}</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
              <span>0% Commission · Direct Bookings</span>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-stone-600 hover:text-stone-950 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
