import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Phone,
  MessageSquare,
  Sparkles,
  Compass,
  Calendar,
  Wallet,
  ShieldCheck,
  Building2,
  ExternalLink,
  Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isHotelManager } from '../lib/roles';

interface Step {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  summary: string;
  keyPoints: string[];
  sketchType: 'cottage' | 'discovery' | 'whatsapp' | 'ledger' | 'calendar';
}

const STEPS: Step[] = [
  {
    id: 'listing',
    number: '01',
    title: 'The Listing Canvas',
    subtitle: 'Craft your direct storefront in under 8 minutes',
    summary:
      'You tell us what you have: a lakeside cottage, safari tent, guest house, or boutique room. Upload 4 crisp daytime photos (bed, view, bathroom, dining area) and set rates in Malawian Kwacha and US Dollars.',
    keyPoints: [
      'Zero listing fees or recurring software subscriptions',
      'Dual pricing support (clean MWK rounding + whole USD)',
      'List whole properties or individual room inventories',
      'Exact GPS gate pin and landmark arrival directions',
    ],
    sketchType: 'cottage',
  },
  {
    id: 'discovery',
    number: '02',
    title: 'Direct Traveler Discovery',
    subtitle: 'Malawian and international travelers find you on a fast, live map',
    summary:
      'Travelers explore stays across Lake Malawi, Liwonde, Nyika, Mulanje, Lilongwe, and Blantyre. No sponsored pay-to-win placements or black-box algorithms pushing your lodge down the page.',
    keyPoints: [
      'Interactive Malawi regional map with real driving times',
      'Search by stay style: Entire cottage, safari camp, or guest house',
      'No algorithm manipulation or forced paid promotions',
      'Instant access to your verified amenity list and food menu',
    ],
    sketchType: 'discovery',
  },
  {
    id: 'whatsapp',
    number: '03',
    title: 'Direct WhatsApp & Phone Line',
    subtitle: 'Inquiries reach your phone with zero intermediaries',
    summary:
      'When a guest wants to book, their request routes directly to your WhatsApp or direct phone. You get the guest’s real name, party size, requested dates, and calculated totals right away.',
    keyPoints: [
      'Direct contact from day one—no hidden guest phone numbers',
      'Automated itinerary summary with nights and guest count',
      'Pre-written Chichewa & English confirmation templates',
      'You answer on your schedule and agree on arrival details',
    ],
    sketchType: 'whatsapp',
  },
  {
    id: 'ledger',
    number: '04',
    title: '0% Commission Payouts',
    subtitle: 'Keep 100% of what you earn with instant local rails',
    summary:
      'Unlike foreign booking sites that take 15% to 25% and hold payouts in overseas accounts for a month, Travel Malawi takes 0% host commission. Guests pay you directly on Airtel Money, TNM Mpamba, or bank transfer.',
    keyPoints: [
      'You set MK 85,000 &rarr; you keep MK 85,000 in your pocket',
      'Airtel Money and TNM Mpamba mobile payment friendly',
      'National Bank, Standard Bank, FDH, and Centenary direct transfer',
      'No wire transfer deductions or foreign currency conversion cuts',
    ],
    sketchType: 'ledger',
  },
  {
    id: 'calendar',
    number: '05',
    title: 'Availability Lock & Warm Arrival',
    subtitle: 'Never double-book; welcome guests with true Malawian warmth',
    summary:
      'Block dates in two taps when your family visits or when performing maintenance. When check-in day arrives, your guest has turn-by-turn directions and your manager’s phone number ready.',
    keyPoints: [
      'One-tap calendar date blocking prevents awkward overlaps',
      'Bulk seasonal rate editor for Easter, Christmas, and lake festivals',
      'GPS gate coordinate links right into Google Maps and Apple Maps',
      'Genuine Malawian hospitality: Takulandirani ku Malawi',
    ],
    sketchType: 'calendar',
  },
];

export default function HowHostingWorks() {
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();
  const isHost = user && isHotelManager(user);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const activeStep = STEPS[activeStepIndex];

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-stone-800 font-sans selection:bg-amber-100 selection:text-stone-900 pb-20">
      {/* Hero Header: Human, Quiet, Dignified */}
      <header className="pt-6 sm:pt-10 md:pt-12 pb-10 sm:pb-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 border border-stone-200/90 text-stone-600 text-xs font-medium mb-5">
          <Building2 className="w-3.5 h-3.5 text-stone-700" />
          <span>Independent Lodges &middot; Cottages &middot; Camps &middot; Guest Houses</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-stone-900 tracking-tight leading-[1.15] text-balance">
          How property hosting works
          <br className="hidden sm:inline" />
          <span className="italic font-light text-stone-600"> on Travel Malawi.</span>
        </h1>

        <p className="mt-5 text-sm sm:text-base md:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed text-balance font-light">
          No foreign algorithms, zero commission deductions, and no delayed overseas payouts.
          Here is the step-by-step blueprint of how guests find your stay, book direct, and pay into your account.
        </p>

        {/* Quick KPI Strip: Clean, Unboxed */}
        <div className="mt-8 pt-6 border-t border-stone-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left max-w-3xl mx-auto">
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-stone-400 block mb-0.5">Commission</span>
            <span className="text-lg sm:text-xl font-serif font-bold text-stone-900">0% Always</span>
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-stone-400 block mb-0.5">Payout Method</span>
            <span className="text-lg sm:text-xl font-serif font-bold text-stone-900">Direct to You</span>
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-stone-400 block mb-0.5">Local Rails</span>
            <span className="text-lg sm:text-xl font-serif font-bold text-stone-900">Airtel / Mpamba / Bank</span>
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-stone-400 block mb-0.5">Listing Setup</span>
            <span className="text-lg sm:text-xl font-serif font-bold text-stone-900">Under 8 mins</span>
          </div>
        </div>
      </header>

      {/* Main Interactive Blueprint Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        {/* Step Selector Tabs (Horizontal Architectural Flow) */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-2 sm:p-2.5 shadow-xs mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {STEPS.map((step, idx) => {
              const isActive = activeStepIndex === idx;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`text-left p-2.5 sm:p-3 rounded-lg border transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-stone-100/90 text-stone-900 border-stone-300 font-medium'
                      : 'border-transparent hover:bg-stone-50 text-stone-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-mono ${
                        isActive ? 'text-stone-900 font-semibold' : 'text-stone-400'
                      }`}
                    >
                      Step {step.number}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-700" />
                    )}
                  </div>
                  <div className="font-serif text-xs sm:text-sm truncate">
                    {step.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Blueprint Showcase: 2-Column Split (Left: Architectural Sketch, Right: Human Explanation) */}
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Left 7 Columns: Architectural Sketch Canvas */}
            <div className="lg:col-span-7 bg-[#F7F5EE] border-b lg:border-b-0 lg:border-r border-stone-200/80 p-5 sm:p-8 flex flex-col justify-between relative overflow-hidden">
              {/* Draft Paper Background Grid Lines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Drafting Header Tag */}
              <div className="relative z-10 flex items-center justify-between text-xs text-stone-500 font-mono pb-4 border-b border-stone-300/60 mb-6">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs bg-stone-700" />
                  <span>DRAFTING SHEET // TM-0{activeStepIndex + 1}</span>
                </span>
                <span className="text-[11px] text-stone-400 font-sans">Hand-sketched flow diagram</span>
              </div>

              {/* Dynamic Hand-Sketched SVG Animation */}
              <div className="relative z-10 my-auto py-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full flex items-center justify-center"
                  >
                    <SketchIllustration type={activeStep.sketchType} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Drafting Sheet Footer Caption */}
              <div className="relative z-10 pt-4 border-t border-stone-300/60 mt-6 flex items-center justify-between text-[11px] text-stone-500">
                <span>Scale: Real hospitality operations</span>
                <span>Warm Heart of Africa &bull; Direct Platform</span>
              </div>
            </div>

            {/* Right 5 Columns: Clear Editorial Content */}
            <div className="lg:col-span-5 p-6 sm:p-8 md:p-10 flex flex-col justify-between bg-white">
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono font-medium uppercase tracking-wider text-stone-500">
                    Phase {activeStep.number} of 05
                  </div>
                  <h2 className="text-xl sm:text-2xl font-serif text-stone-900 font-normal leading-tight">
                    {activeStep.title}
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-stone-500">
                    {activeStep.subtitle}
                  </p>
                </div>

                <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                  {activeStep.summary}
                </p>

                <div className="space-y-2.5 pt-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    How it actually works:
                  </h3>
                  <ul className="space-y-2 text-xs text-stone-700">
                    {activeStep.keyPoints.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-stone-600 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Navigation controls for flow */}
              <div className="pt-6 mt-6 border-t border-stone-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={activeStepIndex === 0}
                  onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  &larr; Previous step
                </button>

                {activeStepIndex < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-stone-900 text-white hover:bg-stone-800 transition cursor-pointer shadow-2xs"
                  >
                    <span>Next step</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <Link
                    to="/list-your-property"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-stone-900 text-white hover:bg-stone-800 transition shadow-2xs"
                  >
                    <span>Get Listed Free</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Side-by-Side Honest Comparison: Travel Malawi vs Foreign OTAs */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24">
        <div className="text-center mb-10">
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-stone-400 block mb-2">
            The Economics
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-stone-900">
            Why Malawian hosts are moving away from foreign booking engines
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base max-w-2xl mx-auto">
            Traditional Online Travel Agencies (OTAs) were designed for European hotel chains with offshore banking.
            Travel Malawi is purpose-built for independent African hospitality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Legacy OTAs */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-7">
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 mb-5">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-500">Foreign Booking Engines</span>
              <span className="text-xs font-mono text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded">High Leakage</span>
            </div>
            <ul className="space-y-4 text-xs sm:text-sm text-stone-600">
              <li className="flex items-start gap-3">
                <span className="text-stone-400 font-bold shrink-0">&times;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">15% to 25% Host Commission</strong>
                  A guest pays MK 100,000 for a chalet; the platform takes MK 20,000 before you receive anything.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-stone-400 font-bold shrink-0">&times;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">Delayed Offshore Payouts</strong>
                  Earnings are tied up in international clearing banks for 14 to 30 days after check-out.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-stone-400 font-bold shrink-0">&times;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">Hidden Guest Communication</strong>
                  Guest telephone numbers and emails are masked. You cannot WhatsApp the guest about boat pickups or road access.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-stone-400 font-bold shrink-0">&times;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">Rigid Cancellation Policies</strong>
                  Generic dispute teams in overseas call centers cancel bookings and force refunds without understanding rainy season road realities.
                </div>
              </li>
            </ul>
          </div>

          {/* Travel Malawi */}
          <div className="rounded-2xl border border-stone-300 bg-stone-50/70 p-6 sm:p-7">
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-200/80 mb-5">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-800">Travel Malawi Direct</span>
              <span className="text-xs font-mono text-stone-800 bg-stone-200/80 border border-stone-300 px-2 py-0.5 rounded font-medium">0% Commission</span>
            </div>
            <ul className="space-y-4 text-xs sm:text-sm text-stone-700">
              <li className="flex items-start gap-3">
                <span className="text-stone-700 font-bold shrink-0">&check;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">0% Commission Ever</strong>
                  You keep 100% of the room rate you set. We charge zero cut on your hard-earned hospitality revenue.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-stone-700 font-bold shrink-0">&check;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">Direct Local Payouts (MWK &amp; USD)</strong>
                  Guests transfer deposits directly to your Airtel Money, TNM Mpamba, or National Bank of Malawi / Standard Bank account.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-stone-700 font-bold shrink-0">&check;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">Direct WhatsApp Line from Day One</strong>
                  Inquiries include the guest’s real telephone number. You build a lasting relationship with returning visitors.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-stone-700 font-bold shrink-0">&check;</span>
                <div>
                  <strong className="text-stone-900 block mb-0.5 font-medium">Respect for Malawian Property Owners</strong>
                  You set your own house rules, deposit terms (e.g. 50% advance for holiday weekends), and check-in times.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* The 4 Photographs Framework: Practical Simplicity */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24">
        <div className="bg-[#F8F6F0] rounded-3xl border border-stone-200/90 p-6 sm:p-10">
          <div className="max-w-3xl mb-8">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-400 block mb-2">
              Photography Guidelines
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900">
              You do not need a professional photographer.
            </h2>
            <p className="mt-2 text-stone-600 text-sm sm:text-base leading-relaxed">
              Any smartphone taken on a sunny morning with a wiped-clean camera lens produces photos that convert.
              Our data shows guests book stays after seeing exactly these four simple views:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-stone-200/80">
              <span className="text-xs font-mono text-amber-700 font-bold block mb-1">01 &middot; Sleep Shot</span>
              <h3 className="font-serif font-bold text-stone-900 text-sm mb-1.5">The Bed &amp; Linens</h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Crisp, smooth sheets with natural morning window light. Dissolves the traveler’s hidden fear of uncomfortable mattresses.
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-stone-200/80">
              <span className="text-xs font-mono text-amber-700 font-bold block mb-1">02 &middot; Aspiration Shot</span>
              <h3 className="font-serif font-bold text-stone-900 text-sm mb-1.5">The View from Veranda</h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Lake Malawi horizon, granite mountain peak, or lush garden trees. The image guests screenshot to share with friends.
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-stone-200/80">
              <span className="text-xs font-mono text-amber-700 font-bold block mb-1">03 &middot; Hygiene Shot</span>
              <h3 className="font-serif font-bold text-stone-900 text-sm mb-1.5">The Spotless Bathroom</h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Clean shower, dry tiles, and clean towels. Reassures high-paying NGO consultants and international tourists immediately.
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-stone-200/80">
              <span className="text-xs font-mono text-amber-700 font-bold block mb-1">04 &middot; Connection Shot</span>
              <h3 className="font-serif font-bold text-stone-900 text-sm mb-1.5">Boma Fire or Dining Area</h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Where the guest will unwind after a 4-hour drive from Lilongwe with a cold drink or freshly prepared lake chambo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Host Onboarding Toolkit & Reference Documentation */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24">
        <div className="border-t border-stone-200 pt-10 sm:pt-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-400 block mb-1">
                Field Toolkits &amp; Guides
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-stone-900">
                Official Property Operations Documentation
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 max-w-sm">
              Free operational blueprints written for cottage caretakers, lodge owners, and reservations staff.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/host-guide"
              className="group p-5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
            >
              <div>
                <BookOpen className="w-5 h-5 text-stone-700 mb-3 group-hover:text-emerald-700 transition-colors" />
                <h3 className="font-serif font-bold text-stone-900 text-base mb-1 group-hover:text-emerald-800 transition-colors">
                  Host Starter Pack
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Complete onboarding manual with WhatsApp confirmation message templates and dual-pricing guides.
                </p>
              </div>
              <span className="mt-4 text-xs font-semibold text-stone-900 group-hover:text-emerald-700 inline-flex items-center gap-1">
                Read Starter Pack &rarr;
              </span>
            </Link>

            <Link
              to="/leaflet"
              className="group p-5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
            >
              <div>
                <Compass className="w-5 h-5 text-stone-700 mb-3 group-hover:text-emerald-700 transition-colors" />
                <h3 className="font-serif font-bold text-stone-900 text-base mb-1 group-hover:text-emerald-800 transition-colors">
                  Stay Owner Leaflet
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  A concise 1-page printable overview comparing direct booking payouts with legacy agency platforms.
                </p>
              </div>
              <span className="mt-4 text-xs font-semibold text-stone-900 group-hover:text-emerald-700 inline-flex items-center gap-1">
                View Leaflet &rarr;
              </span>
            </Link>

            <Link
              to="/listing-guide"
              className="group p-5 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
            >
              <div>
                <Calendar className="w-5 h-5 text-stone-700 mb-3 group-hover:text-emerald-700 transition-colors" />
                <h3 className="font-serif font-bold text-stone-900 text-base mb-1 group-hover:text-emerald-800 transition-colors">
                  Property Listing Guide
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Practical guidelines for writing clear arrival directions, gate landmarks, and meal descriptions.
                </p>
              </div>
              <span className="mt-4 text-xs font-semibold text-stone-900 group-hover:text-emerald-700 inline-flex items-center gap-1">
                Read Guide &rarr;
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Human, Non-AI Direct Call to Action Bar */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 sm:mt-20">
        <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-6 sm:p-10 text-center">
          <div className="max-w-xl mx-auto space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500">
              Direct Property Hosting
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-stone-900 font-normal leading-tight">
              Publish your stay on Travel Malawi
            </h2>
            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed font-light">
              Zero listing fees, direct local mobile payments, and full control over your calendar.
              Reviewed by our local team within 24 hours.
            </p>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Link
                to="/list-your-property"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-medium px-5 py-2.5 rounded-lg text-xs transition cursor-pointer"
              >
                <span>Start Property Listing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <a
                href="https://api.whatsapp.com/send?phone=265999000000&text=Muli%20bwanji!%20I%20have%20questions%20about%20listing%20my%20property%20on%20Travel%20Malawi."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-4 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-stone-500" />
                <span>Ask via WhatsApp</span>
              </a>
            </div>

            <p className="text-[11px] text-stone-400 pt-1">
              Zikomo kwambiri &bull; The Warm Heart of Africa
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Handcrafted Architectural Sketch Component
 * Rendered using SVG hairline pencil strokes, drafting dimensions, and animated elements.
 * Free of generic AI graphics.
 */
function SketchIllustration({ type }: { type: 'cottage' | 'discovery' | 'whatsapp' | 'ledger' | 'calendar' }) {
  switch (type) {
    case 'cottage':
      return (
        <svg
          viewBox="0 0 520 320"
          className="w-full max-w-md h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
        >
          {/* Ground lake shore contour */}
          <path d="M 30 270 Q 150 260 280 270 T 490 265" strokeDasharray="3 3" className="stroke-stone-400" />
          <path d="M 40 285 Q 160 278 290 285 T 480 280" className="stroke-stone-300 stroke-[1]" />
          <text x="350" y="300" className="text-[9px] font-mono fill-stone-400 stroke-none tracking-wider">
            LAKE SHORE WATERLINE &plusmn;0.00
          </text>

          {/* Hand-drawn Acacia Tree Silhouette */}
          <path d="M 430 265 Q 435 220 445 190 Q 430 160 410 145 M 445 190 Q 460 165 480 150 M 445 190 L 450 140" className="stroke-stone-600 stroke-[2]" />
          <path d="M 390 145 Q 430 130 460 140 Q 490 145 470 160 Q 430 170 390 145 Z" className="fill-stone-200/40 stroke-stone-500 stroke-[1]" />

          {/* Cottage Stilts & Foundation */}
          <line x1="120" y1="210" x2="120" y2="265" className="stroke-stone-700 stroke-[2.5]" />
          <line x1="180" y1="210" x2="180" y2="265" className="stroke-stone-700 stroke-[2.5]" />
          <line x1="260" y1="210" x2="260" y2="265" className="stroke-stone-700 stroke-[2.5]" />
          <line x1="340" y1="210" x2="340" y2="265" className="stroke-stone-700 stroke-[2.5]" />

          {/* Deck floor */}
          <line x1="90" y1="210" x2="360" y2="210" className="stroke-stone-900 stroke-[3]" />
          <line x1="90" y1="214" x2="360" y2="214" className="stroke-stone-600 stroke-[1]" />

          {/* Walls */}
          <rect x="130" y="125" width="180" height="85" className="stroke-stone-900 fill-white stroke-[2]" />

          {/* Veranda posts */}
          <line x1="95" y1="140" x2="95" y2="210" className="stroke-stone-700 stroke-[2]" />
          <line x1="330" y1="140" x2="330" y2="210" className="stroke-stone-700 stroke-[2]" />

          {/* Veranda Handrail */}
          <line x1="95" y1="185" x2="130" y2="185" className="stroke-stone-600" />
          <line x1="310" y1="185" x2="330" y2="185" className="stroke-stone-600" />

          {/* Doorway and Window Louvers */}
          <rect x="195" y="145" width="35" height="65" className="stroke-stone-800 fill-stone-100/50 stroke-[1.5]" />
          <circle cx="222" cy="178" r="1.5" className="fill-stone-800 stroke-none" />

          <rect x="145" y="145" width="35" height="35" className="stroke-stone-800 fill-stone-50 stroke-[1.5]" />
          <line x1="145" y1="155" x2="180" y2="155" className="stroke-stone-500 stroke-[1]" />
          <line x1="145" y1="165" x2="180" y2="165" className="stroke-stone-500 stroke-[1]" />

          <rect x="250" y="145" width="40" height="35" className="stroke-stone-800 fill-stone-50 stroke-[1.5]" />
          <line x1="250" y1="155" x2="290" y2="155" className="stroke-stone-500 stroke-[1]" />
          <line x1="250" y1="165" x2="290" y2="165" className="stroke-stone-500 stroke-[1]" />

          {/* Thatched Roof Pitch */}
          <path d="M 75 140 L 220 50 L 375 140 Z" className="stroke-stone-900 fill-stone-100 stroke-[2.5]" />
          {/* Thatched Texture Hatch Lines */}
          <path d="M 120 120 L 140 135 M 160 100 L 180 125 M 210 70 L 225 110 M 260 95 L 280 125 M 310 115 L 330 135" className="stroke-stone-400 stroke-[1]" />

          {/* Architectural Dimension Annotations */}
          <line x1="90" y1="230" x2="360" y2="230" className="stroke-amber-800 stroke-[1]" strokeDasharray="4 2" />
          <circle cx="90" cy="230" r="2" className="fill-amber-800 stroke-none" />
          <circle cx="360" cy="230" r="2" className="fill-amber-800 stroke-none" />
          <text x="185" y="244" className="text-[10px] font-mono fill-amber-900 stroke-none font-bold">
            WIDTH: 8.5m FRONTAGE
          </text>

          {/* Rate Card Tag Floating Callout */}
          <g transform="translate(20, 45)">
            <rect x="0" y="0" width="145" height="48" rx="8" className="fill-white stroke-stone-800 stroke-[1.5] filter drop-shadow-xs" />
            <text x="10" y="18" className="text-[9px] font-mono fill-stone-500 stroke-none uppercase">RATE BLUEPRINT</text>
            <text x="10" y="36" className="text-[13px] font-serif font-bold fill-stone-900 stroke-none">
              MK 85,000 / $60
            </text>
            <path d="M 145 24 L 175 40" className="stroke-amber-700 stroke-[1.2]" strokeDasharray="3 2" />
            <circle cx="175" cy="40" r="2" className="fill-amber-700 stroke-none" />
          </g>
        </svg>
      );

    case 'discovery':
      return (
        <svg
          viewBox="0 0 520 320"
          className="w-full max-w-md h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
        >
          {/* Sketch Map of Malawi Lakeshore spine */}
          <path
            d="M 230 40 Q 245 70 240 100 Q 255 130 250 160 Q 265 190 260 220 Q 275 250 250 290 Q 235 250 220 200 Q 205 160 215 110 Z"
            className="stroke-blue-700 fill-blue-50/50 stroke-[1.5]"
          />
          <text x="255" y="110" className="text-[9px] font-serif italic fill-blue-800 stroke-none">
            Lake Malawi
          </text>

          {/* M5 Lakeshore highway path */}
          <path
            d="M 180 80 Q 200 130 215 170 Q 220 220 210 270"
            className="stroke-amber-700 stroke-[2]"
            strokeDasharray="6 3"
          />
          <text x="135" y="160" className="text-[9px] font-mono fill-amber-900 stroke-none font-bold">
            M5 LAKESHORE ROUTE
          </text>

          {/* Traveler Origin: Lilongwe */}
          <circle cx="170" cy="190" r="4" className="fill-stone-900 stroke-white stroke-[2]" />
          <text x="110" y="194" className="text-[10px] font-serif font-bold fill-stone-900 stroke-none">
            Lilongwe Hub
          </text>

          {/* Traveler Origin: Blantyre */}
          <circle cx="225" cy="280" r="4" className="fill-stone-900 stroke-white stroke-[2]" />
          <text x="165" y="284" className="text-[10px] font-serif font-bold fill-stone-900 stroke-none">
            Blantyre Hub
          </text>

          {/* Destination Pin: Cape Maclear / Mangochi */}
          <g transform="translate(260, 195)">
            <path d="M 0 0 C -8 -16 8 -16 0 0 Z" className="fill-emerald-700 stroke-emerald-900 stroke-[1]" />
            <circle cx="0" cy="-10" r="3" className="fill-white stroke-none" />
            <circle cx="0" cy="0" r="8" className="stroke-emerald-600 stroke-[1]" strokeDasharray="2 2" />
          </g>

          {/* Search Query Callout */}
          <g transform="translate(290, 50)">
            <rect x="0" y="0" width="190" height="70" rx="10" className="fill-white stroke-stone-800 stroke-[1.5] filter drop-shadow-xs" />
            <text x="12" y="20" className="text-[9px] font-mono fill-stone-400 stroke-none">TRAVELER SEARCH</text>
            <text x="12" y="38" className="text-[11px] font-sans font-bold fill-stone-900 stroke-none">
              &ldquo;Lakeside Cottage for 4 guests&rdquo;
            </text>
            <text x="12" y="54" className="text-[10px] font-sans fill-emerald-700 stroke-none">
              &check; Direct match &middot; No middlemen
            </text>
          </g>

          {/* Turn-by-Turn Travel Time badge */}
          <g transform="translate(290, 150)">
            <rect x="0" y="0" width="170" height="42" rx="8" className="fill-stone-100 stroke-stone-300 stroke-[1]" />
            <text x="10" y="16" className="text-[9px] font-mono fill-stone-500 stroke-none">DRIVE CALCULATION</text>
            <text x="10" y="32" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none">
              ~3 hrs 15 mins (210 km)
            </text>
          </g>
        </svg>
      );

    case 'whatsapp':
      return (
        <svg
          viewBox="0 0 520 320"
          className="w-full max-w-md h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
        >
          {/* Guest Phone Silhouette on Left */}
          <rect x="50" y="50" width="130" height="230" rx="16" className="stroke-stone-800 fill-white stroke-[2]" />
          <line x1="85" y1="62" x2="145" y2="62" className="stroke-stone-300 stroke-[2]" />
          <circle cx="115" cy="265" r="4" className="stroke-stone-300 stroke-[1]" />

          {/* Host Phone Silhouette on Right */}
          <rect x="340" y="50" width="130" height="230" rx="16" className="stroke-stone-800 fill-white stroke-[2]" />
          <line x1="375" y1="62" x2="435" y2="62" className="stroke-stone-300 stroke-[2]" />
          <circle cx="405" cy="265" r="4" className="stroke-stone-300 stroke-[1]" />

          {/* Connection Arc Between the Two Phones */}
          <path
            d="M 180 140 C 240 90 280 90 340 140"
            className="stroke-emerald-700 stroke-[2]"
            strokeDasharray="5 3"
          />
          <circle cx="260" cy="108" r="14" className="fill-emerald-800 stroke-white stroke-[2]" />
          <path d="M 255 108 L 259 112 L 267 104" className="stroke-white stroke-[2]" />

          {/* Direct WhatsApp Message Chat Box */}
          <g transform="translate(190, 140)">
            <rect x="0" y="0" width="145" height="110" rx="10" className="fill-[#DCF8C6] stroke-stone-800 stroke-[1.5] filter drop-shadow-xs" />
            <text x="10" y="18" className="text-[9px] font-mono fill-emerald-900 stroke-none font-bold">DIRECT INQUIRY</text>
            <text x="10" y="34" className="text-[10px] font-sans fill-stone-900 stroke-none">
              &ldquo;Muli bwanji! We are 4
            </text>
            <text x="10" y="48" className="text-[10px] font-sans fill-stone-900 stroke-none">
              guests looking for Lake
            </text>
            <text x="10" y="62" className="text-[10px] font-sans fill-stone-900 stroke-none">
              Chalet on 14-17 Nov.
            </text>
            <text x="10" y="78" className="text-[10px] font-sans font-bold fill-stone-900 stroke-none">
              Total: MK 255,000.&rdquo;
            </text>
            <text x="10" y="98" className="text-[8px] font-mono fill-stone-500 stroke-none">
              Guest WhatsApp: +265 999...
            </text>
          </g>

          <text x="75" y="100" className="text-[9px] font-mono fill-stone-400 stroke-none">GUEST DEVICE</text>
          <text x="365" y="100" className="text-[9px] font-mono fill-stone-400 stroke-none">HOST DEVICE</text>
        </svg>
      );

    case 'ledger':
      return (
        <svg
          viewBox="0 0 520 320"
          className="w-full max-w-md h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
        >
          {/* Handcrafted Balance Ledger Sheet */}
          <rect x="60" y="40" width="400" height="240" rx="12" className="stroke-stone-800 fill-white stroke-[2]" />
          <line x1="60" y1="85" x2="460" y2="85" className="stroke-stone-200 stroke-[1.5]" />
          <line x1="260" y1="85" x2="260" y2="280" className="stroke-stone-200 stroke-[1.5]" />

          {/* Header */}
          <text x="80" y="65" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none uppercase">
            COMMISSION RECONCILIATION // 100% RETENTION
          </text>

          {/* Left Column: Legacy OTA */}
          <text x="80" y="110" className="text-[10px] font-mono fill-red-600 stroke-none font-bold uppercase">
            FOREIGN BOOKING OTA
          </text>
          <text x="80" y="135" className="text-[11px] font-sans fill-stone-600 stroke-none">
            Gross Nightly Rate:
          </text>
          <text x="190" y="135" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none">
            MK 100,000
          </text>

          <text x="80" y="160" className="text-[11px] font-sans fill-red-700 stroke-none">
            &minus; 18% OTA Commission:
          </text>
          <text x="190" y="160" className="text-[11px] font-mono fill-red-700 stroke-none">
            &minus; MK 18,000
          </text>

          <text x="80" y="185" className="text-[11px] font-sans fill-red-700 stroke-none">
            &minus; Foreign Payout Fee:
          </text>
          <text x="190" y="185" className="text-[11px] font-mono fill-red-700 stroke-none">
            &minus; MK 4,500
          </text>

          <line x1="80" y1="205" x2="240" y2="205" className="stroke-stone-300 stroke-[1]" />
          <text x="80" y="228" className="text-[10px] font-sans uppercase fill-stone-400 stroke-none">
            Host Net Payout:
          </text>
          <text x="80" y="252" className="text-[16px] font-serif font-bold fill-red-700 stroke-none">
            MK 77,500
          </text>
          <text x="80" y="268" className="text-[9px] font-mono fill-stone-400 stroke-none">
            (Delayed 30 days)
          </text>

          {/* Right Column: Travel Malawi */}
          <text x="280" y="110" className="text-[10px] font-mono fill-emerald-800 stroke-none font-bold uppercase">
            TRAVEL MALAWI DIRECT
          </text>
          <text x="280" y="135" className="text-[11px] font-sans fill-stone-600 stroke-none">
            Gross Nightly Rate:
          </text>
          <text x="390" y="135" className="text-[11px] font-mono font-bold fill-stone-900 stroke-none">
            MK 100,000
          </text>

          <text x="280" y="160" className="text-[11px] font-sans fill-emerald-800 stroke-none">
            &minus; Host Commission:
          </text>
          <text x="390" y="160" className="text-[11px] font-mono font-bold fill-emerald-800 stroke-none">
            MK 0 (0%)
          </text>

          <text x="280" y="185" className="text-[11px] font-sans fill-stone-500 stroke-none">
            Settlement Rails:
          </text>
          <text x="390" y="185" className="text-[9px] font-mono fill-stone-700 stroke-none">
            Airtel / Mpamba / NBM
          </text>

          <line x1="280" y1="205" x2="440" y2="205" className="stroke-stone-300 stroke-[1]" />
          <text x="280" y="228" className="text-[10px] font-sans uppercase fill-emerald-800 stroke-none font-bold">
            Host Net Payout:
          </text>
          <text x="280" y="252" className="text-[18px] font-serif font-bold fill-emerald-800 stroke-none">
            MK 100,000
          </text>
          <text x="280" y="268" className="text-[9px] font-mono fill-emerald-700 stroke-none">
            (Instant straight to you)
          </text>
        </svg>
      );

    case 'calendar':
      return (
        <svg
          viewBox="0 0 520 320"
          className="w-full max-w-md h-auto text-stone-800 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round select-none"
        >
          {/* Calendar Grid Frame */}
          <rect x="70" y="40" width="380" height="240" rx="12" className="stroke-stone-800 fill-white stroke-[2]" />

          {/* Month Header */}
          <line x1="70" y1="85" x2="450" y2="85" className="stroke-stone-200" />
          <text x="90" y="66" className="text-[12px] font-serif font-bold fill-stone-900 stroke-none">
            LODGE CALENDAR &middot; NOVEMBER 2026
          </text>
          <text x="350" y="66" className="text-[9px] font-mono fill-stone-400 stroke-none">
            ROOM LOCK ACTIVE
          </text>

          {/* Day column headers */}
          <text x="100" y="105" className="text-[9px] font-mono fill-stone-400 stroke-none">MON</text>
          <text x="150" y="105" className="text-[9px] font-mono fill-stone-400 stroke-none">TUE</text>
          <text x="200" y="105" className="text-[9px] font-mono fill-stone-400 stroke-none">WED</text>
          <text x="250" y="105" className="text-[9px] font-mono fill-stone-400 stroke-none">THU</text>
          <text x="300" y="105" className="text-[9px] font-mono fill-stone-400 stroke-none">FRI</text>
          <text x="350" y="105" className="text-[9px] font-mono fill-stone-400 stroke-none">SAT</text>
          <text x="400" y="105" className="text-[9px] font-mono fill-stone-400 stroke-none">SUN</text>

          {/* Calendar Cells */}
          {/* Row 1 */}
          <text x="105" y="135" className="text-[11px] font-mono fill-stone-700 stroke-none">10</text>
          <text x="155" y="135" className="text-[11px] font-mono fill-stone-700 stroke-none">11</text>
          <text x="205" y="135" className="text-[11px] font-mono fill-stone-700 stroke-none">12</text>
          <text x="255" y="135" className="text-[11px] font-mono fill-stone-700 stroke-none">13</text>

          {/* Booked / Blocked Dates (14, 15, 16 November) with Hatch Marks */}
          <rect x="290" y="115" width="45" height="30" rx="4" className="fill-amber-100/70 stroke-amber-700 stroke-[1]" />
          <line x1="290" y1="145" x2="335" y2="115" className="stroke-amber-600 stroke-[1]" />
          <text x="305" y="135" className="text-[11px] font-mono font-bold fill-amber-900 stroke-none">14</text>

          <rect x="340" y="115" width="45" height="30" rx="4" className="fill-amber-100/70 stroke-amber-700 stroke-[1]" />
          <line x1="340" y1="145" x2="385" y2="115" className="stroke-amber-600 stroke-[1]" />
          <text x="355" y="135" className="text-[11px] font-mono font-bold fill-amber-900 stroke-none">15</text>

          <rect x="390" y="115" width="45" height="30" rx="4" className="fill-amber-100/70 stroke-amber-700 stroke-[1]" />
          <line x1="390" y1="145" x2="435" y2="115" className="stroke-amber-600 stroke-[1]" />
          <text x="405" y="135" className="text-[11px] font-mono font-bold fill-amber-900 stroke-none">16</text>

          {/* Row 2 */}
          <text x="105" y="180" className="text-[11px] font-mono fill-stone-700 stroke-none">17</text>
          <text x="155" y="180" className="text-[11px] font-mono fill-stone-700 stroke-none">18</text>
          <text x="205" y="180" className="text-[11px] font-mono fill-stone-700 stroke-none">19</text>
          <text x="255" y="180" className="text-[11px] font-mono fill-stone-700 stroke-none">20</text>
          <text x="305" y="180" className="text-[11px] font-mono fill-stone-700 stroke-none">21</text>
          <text x="355" y="180" className="text-[11px] font-mono fill-stone-700 stroke-none">22</text>
          <text x="405" y="180" className="text-[11px] font-mono fill-stone-700 stroke-none">23</text>

          {/* Turn-by-Turn Key Handover Badge */}
          <g transform="translate(90, 215)">
            <rect x="0" y="0" width="340" height="45" rx="8" className="fill-stone-50 stroke-stone-300 stroke-[1]" />
            <circle cx="20" cy="22" r="10" className="fill-emerald-800 stroke-none" />
            <path d="M 16 22 L 19 25 L 25 18" className="stroke-white stroke-[1.5]" />
            <text x="38" y="19" className="text-[10px] font-sans font-bold fill-stone-900 stroke-none">
              Zero Overbooking Guarantee &middot; Gate GPS Directions
            </text>
            <text x="38" y="34" className="text-[9px] font-mono fill-stone-500 stroke-none">
              Guest arrives with manager contact ready &bull; Takulandirani
            </text>
          </g>
        </svg>
      );
  }
}
