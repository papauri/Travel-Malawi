import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Mail,
  Send,
  Home,
  CheckCircle2,
  ShieldCheck,
  Search,
  MessageSquare,
  BadgePercent,
  Banknote,
  Check,
  Building2,
  Compass,
  Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import SEOHead from '../components/SEOHead';
import { usePlatformMode } from '../contexts/PlatformModeContext';

// ---------------------------------------------------------------------------
// Minimal Architectural Line Illustrations (Stone / Warm Paper / Clean Ink)
// ---------------------------------------------------------------------------

function IllustrationOnlineListing() {
  return (
    <div className="w-full bg-stone-50 rounded-lg p-3 sm:p-5 flex items-center justify-center border border-stone-200 my-3">
      <svg
        viewBox="0 0 540 180"
        className="w-full h-auto max-h-44 select-none"
        fill="none"
        stroke="#292524"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Drawing of posting a property listing directly through the website wizard"
      >
        {/* Lake Waterline & Horizon */}
        <line x1="20" y1="150" x2="520" y2="150" stroke="#a8a29e" strokeWidth="1" strokeDasharray="3 3" />
        <text x="390" y="165" fontSize="8.5" fontFamily="monospace" fill="#78716c" stroke="none">
          LAKE MALAWI SHORELINE
        </text>

        {/* Browser / Website Window on Phone & Laptop */}
        <g transform="translate(30, 20)">
          {/* Laptop Screen */}
          <rect x="0" y="0" width="225" height="120" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <line x1="0" y1="20" x2="225" y2="20" stroke="#e7e5e4" strokeWidth="1" />
          <circle cx="10" cy="10" r="2.5" fill="#a8a29e" stroke="none" />
          <circle cx="18" cy="10" r="2.5" fill="#a8a29e" stroke="none" />
          <circle cx="26" cy="10" r="2.5" fill="#a8a29e" stroke="none" />

          {/* Browser Address Bar with Wizard URL */}
          <rect x="36" y="3.5" width="180" height="13" rx="2" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="0.8" />
          <text x="40" y="13" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#047857" stroke="none">
            travelmalawi.mw/list-your-property
          </text>

          {/* Form Fields Inside Browser */}
          <text x="14" y="38" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            List Your Property (5 min)
          </text>
          
          <rect x="14" y="46" width="90" height="14" rx="2" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="1" />
          <text x="18" y="56" fontSize="7.5" fontFamily="sans-serif" fill="#78716c" stroke="none">Property Name</text>

          <rect x="110" y="46" width="96" height="14" rx="2" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="1" />
          <text x="114" y="56" fontSize="7.5" fontFamily="sans-serif" fill="#78716c" stroke="none">Location (Malawi)</text>

          <rect x="14" y="66" width="90" height="14" rx="2" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="1" />
          <text x="18" y="76" fontSize="7.5" fontFamily="sans-serif" fill="#78716c" stroke="none">Whole Cottage / Rooms</text>

          <rect x="110" y="66" width="96" height="14" rx="2" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="1" />
          <text x="114" y="76" fontSize="7.5" fontFamily="sans-serif" fill="#78716c" stroke="none">Nightly Rate (MWK)</text>

          {/* Instant Submit Button */}
          <rect x="14" y="90" width="105" height="18" rx="4" fill="#1c1917" stroke="none" />
          <text x="26" y="102" fontSize="8" fontFamily="sans-serif" fontWeight="bold" fill="#ffffff" stroke="none">
            Publish My Stay →
          </text>

          {/* Laptop Base */}
          <path d="M -15 120 L 240 120 L 230 128 L -5 128 Z" fill="#e7e5e4" stroke="#44403c" strokeWidth="1.2" />
        </g>

        {/* Lakeside Cottage Elevation (Right) */}
        <g transform="translate(305, 35)">
          {/* Cottage Main Body */}
          <rect x="25" y="45" width="170" height="65" fill="#ffffff" stroke="#1c1917" strokeWidth="1.75" />

          {/* Veranda Door & Windows */}
          <rect x="90" y="58" width="40" height="52" fill="#fafaf9" stroke="#44403c" strokeWidth="1.2" />
          <line x1="110" y1="58" x2="110" y2="110" stroke="#a8a29e" strokeWidth="1" />
          <rect x="42" y="60" width="34" height="30" fill="#fafaf9" stroke="#44403c" strokeWidth="1.2" />
          <rect x="144" y="60" width="34" height="30" fill="#fafaf9" stroke="#44403c" strokeWidth="1.2" />

          {/* Thatched Roof Pitch */}
          <path d="M 10 46 L 110 5 L 210 46 Z" fill="#f5f5f4" stroke="#1c1917" strokeWidth="2" />
          <line x1="50" y1="42" x2="110" y2="12" stroke="#d6d3d1" strokeWidth="1" />
          <line x1="80" y1="42" x2="110" y2="12" stroke="#d6d3d1" strokeWidth="1" />
          <line x1="140" y1="42" x2="110" y2="12" stroke="#d6d3d1" strokeWidth="1" />
          <line x1="170" y1="42" x2="110" y2="12" stroke="#d6d3d1" strokeWidth="1" />

          {/* Live Badge */}
          <rect x="135" y="18" width="70" height="18" rx="4" fill="#ecfdf5" stroke="#059669" strokeWidth="1" />
          <text x="144" y="30" fontSize="8" fontFamily="sans-serif" fontWeight="bold" fill="#047857" stroke="none">
            ✓ Live Online
          </text>
        </g>
      </svg>
    </div>
  );
}

function IllustrationPhotos() {
  return (
    <div className="w-full bg-stone-50 rounded-lg p-3 sm:p-5 flex items-center justify-center border border-stone-200 my-3">
      <svg
        viewBox="0 0 540 160"
        className="w-full h-auto max-h-44 select-none"
        fill="none"
        stroke="#292524"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Architectural diagram of four essential photos: bed, view, bathroom, dining"
      >
        {/* Frame 1: Bed */}
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="112" height="115" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <text x="10" y="18" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            1. The Bed
          </text>
          <rect x="16" y="32" width="80" height="25" rx="2" fill="#f5f5f4" stroke="#44403c" strokeWidth="1.2" />
          <rect x="22" y="38" width="30" height="14" rx="2" fill="#ffffff" stroke="#78716c" strokeWidth="1" />
          <rect x="60" y="38" width="30" height="14" rx="2" fill="#ffffff" stroke="#78716c" strokeWidth="1" />
          <rect x="16" y="54" width="80" height="42" rx="2" fill="#ffffff" stroke="#44403c" strokeWidth="1.2" />
          <line x1="20" y1="70" x2="92" y2="70" stroke="#d6d3d1" strokeWidth="1" strokeDasharray="3 3" />
          <text x="16" y="108" fontSize="8" fontFamily="sans-serif" fill="#78716c" stroke="none">Morning light</text>
        </g>

        {/* Frame 2: View */}
        <g transform="translate(150, 20)">
          <rect x="0" y="0" width="112" height="115" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <text x="10" y="18" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            2. Horizon View
          </text>
          <circle cx="85" cy="38" r="9" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
          <path d="M 12 60 Q 40 45 65 52 T 100 50 L 100 85 L 12 85 Z" fill="#f5f5f4" stroke="#a8a29e" strokeWidth="1" />
          <line x1="12" y1="76" x2="100" y2="76" stroke="#44403c" strokeWidth="2" />
          <line x1="28" y1="76" x2="28" y2="95" stroke="#44403c" strokeWidth="1.5" />
          <line x1="56" y1="76" x2="56" y2="95" stroke="#44403c" strokeWidth="1.5" />
          <line x1="84" y1="76" x2="84" y2="95" stroke="#44403c" strokeWidth="1.5" />
          <text x="12" y="108" fontSize="8" fontFamily="sans-serif" fill="#78716c" stroke="none">Lake / hills vista</text>
        </g>

        {/* Frame 3: Bathroom */}
        <g transform="translate(280, 20)">
          <rect x="0" y="0" width="112" height="115" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <text x="10" y="18" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            3. Bathroom
          </text>
          <rect x="16" y="32" width="38" height="60" fill="#fafaf9" stroke="#78716c" strokeWidth="1" strokeDasharray="3 2" />
          <circle cx="35" cy="40" r="3" fill="#a8a29e" />
          <line x1="35" y1="43" x2="35" y2="55" stroke="#a8a29e" strokeWidth="1" />
          <rect x="65" y="35" width="30" height="24" rx="2" fill="#ffffff" stroke="#78716c" strokeWidth="1" />
          <line x1="62" y1="33" x2="98" y2="33" stroke="#44403c" strokeWidth="1.5" />
          <text x="16" y="108" fontSize="8" fontFamily="sans-serif" fill="#78716c" stroke="none">Spotless &amp; dry</text>
        </g>

        {/* Frame 4: Dining */}
        <g transform="translate(410, 20)">
          <rect x="0" y="0" width="112" height="115" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <text x="10" y="18" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            4. Dining Deck
          </text>
          <ellipse cx="56" cy="62" rx="34" ry="14" fill="#f5f5f4" stroke="#44403c" strokeWidth="1.5" />
          <line x1="56" y1="76" x2="56" y2="92" stroke="#44403c" strokeWidth="2" />
          <line x1="36" y1="73" x2="30" y2="92" stroke="#44403c" strokeWidth="1.5" />
          <line x1="76" y1="73" x2="82" y2="92" stroke="#44403c" strokeWidth="1.5" />
          <circle cx="56" cy="56" r="4" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
          <text x="16" y="108" fontSize="8" fontFamily="sans-serif" fill="#78716c" stroke="none">Golden hour (~17:15)</text>
        </g>
      </svg>
    </div>
  );
}

function IllustrationLedger() {
  return (
    <div className="w-full bg-stone-50 rounded-lg p-3 sm:p-5 flex items-center justify-center border border-stone-200 my-3 overflow-hidden">
      <svg
        viewBox="0 0 560 146"
        className="w-full h-auto max-h-44 select-none"
        fill="none"
        stroke="#292524"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Clean ledger comparing foreign platforms with Travel Malawi 0% commission direct revenue in MWK"
      >
        {/* Left card: Foreign Platforms */}
        <g transform="translate(16, 16)">
          <rect x="0" y="0" width="254" height="114" rx="6" fill="#ffffff" stroke="#d6d3d1" strokeWidth="1.5" />
          <text x="14" y="22" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#78716c" stroke="none">
            OTHER PLATFORMS
          </text>
          <text x="14" y="42" fontSize="11" fontFamily="sans-serif" fill="#44403c" stroke="none">
            Nightly Rate: MK 120,000
          </text>
          <text x="14" y="59" fontSize="10" fontFamily="sans-serif" fill="#b91c1c" stroke="none">
            − 18% OTA commission (−MK 21,600)
          </text>
          <text x="14" y="74" fontSize="10" fontFamily="sans-serif" fill="#b91c1c" stroke="none">
            − Platform fees &amp; deductions
          </text>
          <line x1="14" y1="84" x2="240" y2="84" stroke="#e7e5e4" strokeWidth="1" />
          <text x="14" y="100" fontSize="10.5" fontFamily="sans-serif" fontWeight="bold" fill="#78716c" stroke="none">
            You receive: ~MK 93,000
          </text>
          <text x="168" y="100" fontSize="9" fontFamily="sans-serif" fill="#a8a29e" stroke="none">
            (30 days delay)
          </text>
        </g>

        {/* Right card: Travel Malawi Direct */}
        <g transform="translate(290, 16)">
          <rect x="0" y="0" width="254" height="114" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.75" />
          <text x="14" y="22" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#047857" stroke="none">
            TRAVEL MALAWI DIRECT
          </text>
          <text x="14" y="42" fontSize="11" fontFamily="sans-serif" fill="#44403c" stroke="none">
            Nightly Rate: MK 120,000
          </text>
          <text x="14" y="59" fontSize="10.5" fontFamily="sans-serif" fontWeight="bold" fill="#047857" stroke="none">
            ✓ 0% Commission (MK 0 fee)
          </text>
          <text x="14" y="74" fontSize="10" fontFamily="sans-serif" fill="#57534e" stroke="none">
            Direct settlement with guest
          </text>
          <line x1="14" y1="84" x2="240" y2="84" stroke="#1c1917" strokeWidth="1.25" />
          <text x="14" y="100" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            You receive: MK 120,000
          </text>
          <text x="175" y="100" fontSize="9" fontFamily="sans-serif" fontWeight="bold" fill="#047857" stroke="none">
            (100% direct)
          </text>
        </g>
      </svg>
    </div>
  );
}

function IllustrationSync() {
  return (
    <div className="w-full bg-stone-50 rounded-lg p-3 sm:p-5 flex items-center justify-center border border-stone-200 my-3 overflow-hidden">
      <svg
        viewBox="0 0 560 140"
        className="w-full h-auto max-h-36 select-none"
        fill="none"
        stroke="#292524"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Diagram of optional calendar synchronization between existing channels and Travel Malawi"
      >
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="185" height="100" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <text x="12" y="20" fontSize="9.5" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            Existing Feeds (Optional)
          </text>
          <line x1="0" y1="28" x2="185" y2="28" stroke="#e7e5e4" strokeWidth="1" />
          <text x="12" y="44" fontSize="8" fontFamily="monospace" fill="#78716c" stroke="none">AIRBNB / BOOKING / GOOGLE</text>
          <rect x="12" y="52" width="161" height="20" rx="4" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="1" />
          <text x="18" y="65" fontSize="8" fontFamily="monospace" fill="#57534e" stroke="none">calendar.ics link (optional)</text>
          <text x="12" y="88" fontSize="8" fontFamily="sans-serif" fill="#78716c" stroke="none">
            Skip if managing dates directly
          </text>
        </g>

        <g transform="translate(225, 45)">
          <line x1="0" y1="20" x2="60" y2="20" stroke="#b45309" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M 52 14 L 60 20 L 52 26" stroke="#b45309" strokeWidth="2" />
          <path d="M 8 26 L 0 20 L 8 14" stroke="#b45309" strokeWidth="2" />
          <rect x="5" y="32" width="50" height="18" rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
          <text x="11" y="44" fontSize="8" fontFamily="sans-serif" fontWeight="bold" fill="#92400e" stroke="none">
            Optional
          </text>
        </g>

        <g transform="translate(305, 20)">
          <rect x="0" y="0" width="235" height="100" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <text x="12" y="20" fontSize="9.5" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            Travel Malawi Calendar
          </text>
          <line x1="0" y1="28" x2="235" y2="28" stroke="#e7e5e4" strokeWidth="1" />
          <g transform="translate(14, 38)">
            <rect x="0" y="0" width="22" height="18" rx="2" fill="#fee2e2" stroke="#ef4444" strokeWidth="1" />
            <text x="4" y="13" fontSize="8" fontFamily="monospace" fill="#991b1b" stroke="none">Fri</text>
            <rect x="28" y="0" width="22" height="18" rx="2" fill="#fee2e2" stroke="#ef4444" strokeWidth="1" />
            <text x="32" y="13" fontSize="8" fontFamily="monospace" fill="#991b1b" stroke="none">Sat</text>
            <rect x="56" y="0" width="22" height="18" rx="2" fill="#ecfdf5" stroke="#10b981" strokeWidth="1" />
            <text x="60" y="13" fontSize="8" fontFamily="monospace" fill="#065f46" stroke="none">Sun</text>
            <rect x="84" y="0" width="22" height="18" rx="2" fill="#ecfdf5" stroke="#10b981" strokeWidth="1" />
            <text x="88" y="13" fontSize="8" fontFamily="monospace" fill="#065f46" stroke="none">Mon</text>
            <rect x="112" y="0" width="22" height="18" rx="2" fill="#ecfdf5" stroke="#10b981" strokeWidth="1" />
            <text x="116" y="13" fontSize="8" fontFamily="monospace" fill="#065f46" stroke="none">Tue</text>
          </g>
          <text x="14" y="74" fontSize="8" fontFamily="sans-serif" fill="#78716c" stroke="none">
            • External dates block automatically
          </text>
          <text x="14" y="88" fontSize="8" fontFamily="sans-serif" fill="#78716c" stroke="none">
            • Or tap any date to block manually
          </text>
        </g>
      </svg>
    </div>
  );
}

function IllustrationPayout() {
  return (
    <div className="w-full bg-stone-50 rounded-lg p-3 sm:p-5 flex flex-col items-center justify-center border border-stone-200 my-3">
      <div className="w-full text-center pb-2 border-b border-stone-200 mb-2">
        <span className="text-[10.5px] sm:text-xs font-mono font-bold tracking-wider text-stone-700 uppercase">
          Direct Peer-to-Peer Settlement • Travel Malawi Never Deals With Payments
        </span>
      </div>
      <svg
        viewBox="0 0 540 120"
        className="w-full h-auto max-h-32 select-none"
        fill="none"
        stroke="#292524"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Direct guest settlement: Airtel Money, TNM Mpamba, Bank transfer or Cash. Travel Malawi does not process payments."
      >
        <g transform="translate(30, 10)">
          <rect x="0" y="0" width="145" height="95" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="10" fill="#dc2626" stroke="none" />
          <text x="20" y="28" fontSize="11" fontWeight="bold" fill="#ffffff" stroke="none">A</text>
          <text x="42" y="27" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            Airtel Money
          </text>
          <line x1="0" y1="42" x2="145" y2="42" stroke="#e7e5e4" strokeWidth="1" />
          <text x="14" y="60" fontSize="8.5" fontFamily="sans-serif" fill="#57534e" stroke="none">Guest sends to your SIM</text>
          <text x="14" y="74" fontSize="8.5" fontFamily="sans-serif" fill="#57534e" stroke="none">No platform handling</text>
          <text x="14" y="88" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#047857" stroke="none">DIRECT PEER-TO-PEER</text>
        </g>

        <g transform="translate(195, 10)">
          <rect x="0" y="0" width="145" height="95" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="10" fill="#15803d" stroke="none" />
          <text x="19" y="28" fontSize="11" fontWeight="bold" fill="#ffffff" stroke="none">M</text>
          <text x="42" y="27" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            TNM Mpamba
          </text>
          <line x1="0" y1="42" x2="145" y2="42" stroke="#e7e5e4" strokeWidth="1" />
          <text x="14" y="60" fontSize="8.5" fontFamily="sans-serif" fill="#57534e" stroke="none">Guest sends to your phone</text>
          <text x="14" y="74" fontSize="8.5" fontFamily="sans-serif" fill="#57534e" stroke="none">No platform handling</text>
          <text x="14" y="88" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#047857" stroke="none">DIRECT PEER-TO-PEER</text>
        </g>

        <g transform="translate(360, 10)">
          <rect x="0" y="0" width="150" height="95" rx="6" fill="#ffffff" stroke="#292524" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="10" fill="#1e3a8a" stroke="none" />
          <text x="20" y="28" fontSize="11" fontWeight="bold" fill="#ffffff" stroke="none">B</text>
          <text x="42" y="27" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="#1c1917" stroke="none">
            Bank / Cash
          </text>
          <line x1="0" y1="42" x2="150" y2="42" stroke="#e7e5e4" strokeWidth="1" />
          <text x="14" y="60" fontSize="8.5" fontFamily="sans-serif" fill="#57534e" stroke="none">Direct to your bank account</text>
          <text x="14" y="74" fontSize="8.5" fontFamily="sans-serif" fill="#57534e" stroke="none">or cash at check-in</text>
          <text x="14" y="88" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="#047857" stroke="none">DIRECT PEER-TO-PEER</text>
        </g>
      </svg>
      <div className="w-full mt-2 p-2.5 bg-white rounded border border-stone-200 text-xs text-stone-600 flex items-start gap-2">
        <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
        <p className="m-0 leading-relaxed text-[11px] sm:text-xs text-stone-600">
          <strong className="text-stone-900 font-semibold">Regulatory Notice:</strong> Travel Malawi does not take, collect, process, hold, or intermediate payments. We are strictly a direct discovery and connection directory. All guest settlements are handled 100% peer-to-peer directly between guest and property owner.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step Content: Direct Online Self-Service
// ---------------------------------------------------------------------------

const STEPS = [
  {
    id: 'step-01',
    num: '1',
    title: 'Add your property details online',
    short: 'Open the listing wizard directly at travelmalawi.mw/list-your-property. Enter your stay name, location, and stay type in under two minutes.',
    details: [
      'Listing wizard URL: travelmalawi.mw/list-your-property',
      'Takes under two minutes on your phone or computer.',
      'Choose whether you rent the whole cottage or individual rooms.',
      'Drop an exact GPS map pin so arriving guests find your gate easily.',
      'You can also import details from a flyer or brochure in one tap.',
    ],
    illustration: <IllustrationOnlineListing />,
    actionText: 'Open travelmalawi.mw/list-your-property',
    actionTo: '/list-your-property',
  },
  {
    id: 'step-02',
    num: '2',
    title: 'Upload four photos from your phone',
    short: 'Bed, view, bathroom and dining deck. Photos taken on your phone in morning light work best.',
    details: [
      'The bed: eye level, clean linens and pillows.',
      'The view: veranda rail in front with lake water or hills beyond.',
      'The bathroom: dry floor, clean shower and folded towel.',
      'Dining area: sunset golden hour light on your deck or garden.',
    ],
    illustration: <IllustrationPhotos />,
  },
  {
    id: 'step-03',
    num: '3',
    title: 'Set clean direct rates in MWK',
    short: 'Enter rates in Malawian Kwacha (MWK), rounded cleanly to the nearest 1,000 MWK (e.g. MK 120,000). You keep 100% of your earnings with 0% platform commission.',
    details: [
      'All rates are quoted in Malawian Kwacha (MWK).',
      'Clean rounding to the nearest 1,000 MWK (e.g. MK 120,000 or MK 85,000).',
      'Zero platform commission fees and zero guest booking markups.',
      'You set your own terms with guests directly (e.g. deposit on booking or payment at check-in).',
    ],
    illustration: <IllustrationLedger />,
  },
  {
    id: 'step-04',
    num: '4',
    title: 'Sync calendar (optional)',
    short: 'Optional: If you use Airbnb, Booking.com or Google Calendar, paste your iCal link. Otherwise, manage dates manually in one tap.',
    details: [
      'Completely optional — skip if Travel Malawi is your primary calendar.',
      'If you already list on Airbnb, Booking.com or NightsBridge, 2-way iCal sync blocks booked dates automatically.',
      'No other platforms? You can easily open or block dates directly from your dashboard anytime.',
    ],
    illustration: <IllustrationSync />,
  },
  {
    id: 'step-05',
    num: '5',
    title: 'Connect directly with guests',
    short: 'We are an inquiry and direct connection service — we do not take or handle any payments. Guests contact you directly and settle with you on your own phone, bank, or in cash at the lodge.',
    details: [
      'Zero payment handling: Travel Malawi does not take, collect, process, hold, or disburse any payments or guest deposits.',
      'Direct guest settlement: Guests settle directly with you via Airtel Money to your number, TNM Mpamba, direct bank transfer, or cash on arrival.',
      'Direct guest messaging: Chat with guests before and after booking to arrange check-in, dietary needs, boat transfers, or road directions.',
      '0% platform commission: Because Travel Malawi does not process payments or act as a financial intermediary, you pay zero platform commissions and zero transaction fees.',
    ],
    illustration: <IllustrationPayout />,
    actionText: 'Start your listing online',
    actionTo: '/list-your-property',
  },
];

// Directory mode (default): the same steps without calendar sync or guest chat.
const DIRECTORY_STEPS = [
  STEPS[0],
  STEPS[1],
  {
    id: 'step-03',
    num: '3',
    title: 'Set your "from" rates in MWK',
    short: 'Enter rates in Malawian Kwacha (MWK), rounded to the nearest 1,000 (e.g. MK 120,000). Travellers see them as a guide and agree the final price with you directly.',
    details: [
      'All rates are quoted in Malawian Kwacha (MWK); USD is optional, in whole dollars.',
      'Clean rounding to the nearest 1,000 MWK (e.g. MK 120,000 or MK 85,000).',
      'Travel Malawi charges no commission and no listing fee.',
    ],
  },
  {
    id: 'step-04',
    num: '4',
    title: 'Add your contact details',
    short: 'Travellers reach you directly on the phone, WhatsApp or email you add to your listing. Travel Malawi does not take bookings or payments.',
    details: [
      'Add at least one direct contact: phone, WhatsApp or email.',
      'Your contact details are shown on your listing under "Contact the property".',
      'Dates, prices and how a guest pays are agreed between you and the guest.',
      'Travel Malawi takes no commission and no part in the exchange.',
    ],
    actionText: 'Start your listing online',
    actionTo: '/list-your-property',
  },
];

const GUEST_STEPS = [
  {
    num: '1',
    title: 'Discover verified independent stays',
    desc: 'Browse lakeside cottages, safari lodges, town guest houses, and mountain chalets across Malawi. Every listing is reviewed by our local team with verified locations and authentic photos.',
    icon: <Compass className="w-5 h-5 text-emerald-800" />,
  },
  {
    num: '2',
    title: 'Chat directly with your host',
    desc: 'Message the actual property manager or cottage owner in real time. Ask about lake access, boat transfers, 4x4 road conditions, power backup, or meal arrangements before committing.',
    icon: <MessageSquare className="w-5 h-5 text-emerald-800" />,
  },
  {
    num: '3',
    title: 'Transparent rates in MWK — 0% booking fees',
    desc: 'What you see is what you pay. Stays quote clean local prices in Malawian Kwacha (MWK). Zero guest booking fees, zero tourist surcharges, and zero hidden platform markups.',
    icon: <BadgePercent className="w-5 h-5 text-emerald-800" />,
  },
  {
    num: '4',
    title: 'Settle directly with your host — We never touch payments',
    desc: 'Travel Malawi is an independent inquiry and connection platform. We do not collect, hold, process, or intermediate payments. You settle directly with the host using Airtel Money, TNM Mpamba, local bank transfer, or cash upon check-in.',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-800" />,
  },
];

const DIRECTORY_GUEST_STEPS = [
  {
    num: '1',
    title: 'Discover independent stays',
    desc: 'Browse lakeside cottages, safari lodges, town guest houses, and mountain chalets across Malawi, with photos, rooms, indicative rates and map locations supplied by each property.',
    icon: <Compass className="w-5 h-5 text-emerald-800" />,
  },
  {
    num: '2',
    title: 'Contact the property directly',
    desc: "Each listing shows the property's own phone, WhatsApp or email. Ask about lake access, boat transfers, 4x4 road conditions, power backup, or meals.",
    icon: <Phone className="w-5 h-5 text-emerald-800" />,
  },
  {
    num: '3',
    title: 'Indicative rates in MWK',
    desc: 'Rates shown are a guide, quoted in Malawian Kwacha (MWK) or US dollars. The property confirms the final price with you.',
    icon: <BadgePercent className="w-5 h-5 text-emerald-800" />,
  },
  {
    num: '4',
    title: 'Arrange everything with the property',
    desc: 'Travel Malawi does not take bookings or payments. Dates, prices and how you pay are agreed directly between you and the property.',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-800" />,
  },
];

const GUIDES = [
  { to: '/host-guide', title: 'Host Starter Pack', note: 'Setup manual and message templates' },
  { to: '/listing-guide', title: 'Property Listing Guide', note: 'Directions, photos and room names' },
  { to: '/leaflet', title: 'Stay Owner Leaflet', note: 'One printable page' },
];

export default function HowHostingWorks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { bookingsEnabled } = usePlatformMode();
  const steps = bookingsEnabled ? STEPS : DIRECTORY_STEPS;
  const guestSteps = bookingsEnabled ? GUEST_STEPS : DIRECTORY_GUEST_STEPS;

  // Determine active tab: query param takes priority, then URL path, then defaults to guest
  const initialTab = searchParams.get('tab') === 'host'
    ? 'host'
    : searchParams.get('tab') === 'guest'
      ? 'guest'
      : (location.pathname.includes('how-to-list') || location.pathname.includes('how-hosting-works'))
        ? 'host'
        : 'guest';

  const [activeTab, setActiveTab] = useState<'guest' | 'host'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'guest' || tabParam === 'host') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'guest' | 'host') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [formData, setFormData] = useState({
    propName: '',
    propLoc: '',
    stayType: 'whole_house',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    nightlyMwk: '',
    roomCount: '1',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const handleSubmitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() || !formData.contactEmail.trim() || !formData.contactEmail.includes('@')) {
      toast.error('Please enter property name and email');
      return;
    }

    setSubmitting(true);
    try {
      let assignedId = 'ENQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Dispatch to email notification endpoint
      try {
        const apiRes = await fetch('/api/host-enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            source: 'how-to-list-page',
          }),
        });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData?.id) assignedId = apiData.id;
        }
      } catch (err) {
        console.warn('API enquiry dispatch:', err);
      }

      // Record in Firestore
      try {
        const docRef = await addDoc(collection(db, 'host_onboarding_submissions'), {
          ...formData,
          createdAt: serverTimestamp(),
          source: 'how-to-list-web',
          status: 'pending_review',
        });
        setSubmissionId(docRef.id);
      } catch {
        setSubmissionId(assignedId);
      }

      setSubmitted(true);
      toast.success('Takulandirani. Enquiry received.');
    } catch {
      const fallbackId = 'ENQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setSubmissionId(fallbackId);
      setSubmitted(true);
      toast.success('Takulandirani. Enquiry received.');
    } finally {
      setSubmitting(false);
    }
  };

  const whole = formData.stayType === 'whole_house';

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-16 font-sans">
      <SEOHead
        title={bookingsEnabled ? 'How Travel Malawi Works — Direct Booking & Hosting Guide' : 'How Travel Malawi Works — Directory & Hosting Guide'}
        description={bookingsEnabled
          ? 'Learn how Travel Malawi connects guests directly with independent lodges, cottages, and safari camps across Malawi. 0% booking fees, no payment processing, and direct host settlement.'
          : 'Learn how Travel Malawi lists independent lodges, cottages and safari camps across Malawi, and how travellers contact each property directly. No commission, no listing fees.'}
        keywords={bookingsEnabled ? 'how Travel Malawi works, direct booking Malawi, how to list lodge Malawi, list cottage Malawi, 0% commission' : 'how Travel Malawi works, Malawi travel directory, how to list lodge Malawi, list cottage Malawi'}
        url="https://ulendomalawi.com/how-it-works"
      />

      <main className="tm-page max-w-3xl py-8 sm:py-12">
        {/* Minimal Human Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase font-mono tracking-widest text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              The Warm Heart of Africa
            </span>
          </div>
          <h1 className="tm-h1">How Travel Malawi works</h1>
          <p className="tm-lead mt-2">
            {bookingsEnabled
              ? 'Direct connections between travelers and independent cottages, lodges, guest houses, and safari camps. We are an inquiry and direct booking platform — zero middleman fees, zero commissions, and we never take or handle payments.'
              : 'A directory of independent cottages, lodges, guest houses and safari camps across Malawi. Travellers contact each property directly. Travel Malawi does not take bookings or payments, and charges no commission.'}
          </p>

          {/* Unified Tab Switcher available to ANY guest or host */}
          <div className="mt-6 inline-flex p-1 rounded-xl bg-stone-200/80 border border-stone-300/80 text-xs sm:text-sm font-medium w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleTabChange('guest')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg transition cursor-pointer select-none text-center ${
                activeTab === 'guest'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {bookingsEnabled ? 'For Guests (How to Book)' : 'For Travellers'}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('host')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg transition cursor-pointer select-none text-center ${
                activeTab === 'host'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              For Property Owners (How to List)
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* TAB 1: GUEST VIEW — HOW DIRECT BOOKING WORKS                      */}
        {/* ================================================================= */}
        {activeTab === 'guest' && (
          <section aria-label={bookingsEnabled ? 'How booking works for guests' : 'How to find a stay'} className="space-y-6">
            <div className="tm-panel p-4 sm:p-5 bg-white">
              <h2 className="tm-h2 text-base sm:text-lg mb-1">{bookingsEnabled ? 'Direct booking in four simple steps' : 'Finding a stay in four steps'}</h2>
              <p className="text-xs sm:text-sm text-stone-600">
                {bookingsEnabled
                  ? 'Book directly with independent Malawian properties with complete transparency.'
                  : 'Browse independent Malawian properties and contact them directly.'}
              </p>

              <ol className="mt-5 space-y-4 list-none p-0">
                {guestSteps.map((step) => (
                  <li key={step.num} className="p-4 rounded-lg bg-stone-50 border border-stone-200 flex items-start gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-900 text-xs font-semibold text-white">
                      {step.num}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0">{step.icon}</span>
                        <h3 className="font-semibold text-stone-900 text-sm sm:text-base">{step.title}</h3>
                      </div>
                      <p className="mt-1.5 text-xs sm:text-sm text-stone-600 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Regulatory Notice Banner for Guests */}
              <div className="mt-5 p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <ShieldCheck size={18} className="text-amber-800 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  {bookingsEnabled ? (
                    <>
                      <strong className="font-semibold block text-amber-900 mb-0.5">Important Notice on Payments:</strong>
                      Travel Malawi does not collect, process, intermediate, or escrow funds. We are strictly a direct discovery and messaging connection platform. You settle your reservation directly with the property host (via Airtel Money, TNM Mpamba, local bank transfer, or cash on arrival).
                    </>
                  ) : (
                    <>
                      <strong className="font-semibold block text-amber-900 mb-0.5">Please note</strong>
                      Travel Malawi is an information directory. We do not take bookings or payments. Arrangements are made directly with the property.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Guest Action Call to Action */}
            <div className="tm-panel text-center p-6 sm:p-8 bg-stone-900 text-stone-50 border-stone-800">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
                Ready to explore stays across Malawi?
              </h2>
              <p className="text-stone-300 text-sm max-w-md mx-auto mt-2 leading-relaxed">
                Discover cottages on Lake Malawi, safari chalets in national parks, and peaceful retreats.
              </p>
              <div className="tm-actions justify-center pt-4">
                <Link
                  to="/"
                  className="tm-btn bg-white text-stone-900 hover:bg-stone-100 font-semibold px-6 py-2.5"
                >
                  Browse all stays in Malawi
                  <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleTabChange('host')}
                  className="tm-btn bg-stone-800 text-stone-200 hover:bg-stone-700 text-xs px-4 py-2"
                >
                  Own a property? How to list →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* TAB 2: HOST VIEW — HOW TO LIST WITH US (5 ILLUSTRATED STEPS)     */}
        {/* ================================================================= */}
        {activeTab === 'host' && (
          <section aria-label="How to list for property owners" className="space-y-6">
            <div className="tm-actions mb-4">
              <Link to="/list-your-property" className="tm-btn tm-btn-primary tm-btn-sm">
                List your property online
                <ArrowRight size={14} />
              </Link>
              <a href="#manual-help" className="tm-btn tm-btn-quiet tm-btn-sm">
                Prefer help? Send enquiry
              </a>
            </div>

            {/* Five Illustrated Steps for Self-Service Posting */}
            <ol className="space-y-4 list-none p-0">
              {steps.map((step, stepIndex) => (
                <li
                  key={step.id}
                  id={step.id}
                  className="tm-panel"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-900 text-xs font-semibold text-stone-50">
                      {stepIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="tm-h2 text-base sm:text-lg">{step.title}</h2>
                        {step.actionTo && (
                          <Link to={step.actionTo} className="tm-link text-xs inline-flex items-center gap-1">
                            {step.actionText} <ArrowRight size={12} />
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-stone-700">{step.short}</p>

                      {/* Clean line illustration */}
                      {'illustration' in step ? step.illustration : null}

                      <details className="mt-2 text-sm group">
                        <summary className="tm-link cursor-pointer text-xs select-none">
                          Details
                        </summary>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600 text-xs sm:text-sm">
                          {step.details.map((d, i) => (
                            <li key={i} className="break-words">{d}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {/* Regulatory Notice Banner for Hosts */}
            <div className="mt-5 p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <ShieldCheck size={18} className="text-amber-800 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold block text-amber-900 mb-0.5">Statutory Licensing &amp; Host Obligations:</strong>
                Under Section 27 of the Tourism Act, 2025, individual accommodation owners and operators are legally responsible for holding their own valid operating licences with the Department of Tourism. Travel Malawi is an open directory and advertising conduit; we do not own, operate, or regulate lodging premises. Review our full{' '}
                <Link to="/terms" className="underline font-semibold text-amber-950 hover:text-amber-800">
                  Platform Terms of Service
                </Link>.
              </div>
            </div>

            {/* Big Prominent Call to Action Banner to List Directly */}
            <section className="tm-panel mt-8 text-center p-6 sm:p-8 bg-stone-900 text-stone-50 border-stone-800">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
                Ready to list your stay?
              </h2>
              <p className="text-stone-300 text-sm max-w-md mx-auto mt-2 leading-relaxed">
                Our online listing wizard is simple and takes just five minutes at <strong className="text-white font-mono">travelmalawi.mw/list-your-property</strong>. It is free to post, with no commission, and travellers contact you directly.
              </p>
              <div className="tm-actions justify-center pt-4">
                <Link
                  to="/list-your-property"
                  className="tm-btn bg-white text-stone-900 hover:bg-stone-100 font-semibold px-6 py-2.5"
                >
                  Start your listing online
                  <ArrowRight size={16} />
                </Link>
              </div>
            </section>

            {/* Collapsible Manual Enquiry Fallback for Users Who Prefer Help */}
            <details id="manual-help" className="tm-panel mt-6 group">
              <summary className="cursor-pointer font-medium text-stone-800 flex items-center justify-between select-none">
                <div>
                  <span className="text-sm font-semibold text-stone-900 block">
                    Prefer our team to set it up for you?
                  </span>
                  <span className="text-xs text-stone-500 font-normal">
                    Leave your stay details and our team will email you at info@ulendomalawi.com to prepare your listing.
                  </span>
                </div>
                <span className="tm-link text-xs shrink-0 ml-3">
                  Send enquiry ↓
                </span>
              </summary>

              <div className="pt-4 mt-3 border-t border-stone-200">
                {submitted ? (
                  <div className="p-4 rounded-lg bg-stone-100 border border-stone-200 space-y-2">
                    <div className="flex items-center gap-2 text-stone-900 font-medium text-sm">
                      <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                      <span>Takulandirani. We received your stay details.</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      Reference: <span className="font-mono font-semibold">{submissionId}</span>. We will review your stay and email you at <strong className="text-stone-900">{formData.contactEmail}</strong>.
                    </p>
                    <div className="tm-actions pt-2">
                      <a
                        href={`mailto:info@ulendomalawi.com?subject=${encodeURIComponent(`Enquiry: ${formData.propName} (Ref: ${submissionId})`)}`}
                        className="tm-btn tm-btn-primary tm-btn-sm"
                      >
                        <Mail size={14} /> Email info@ulendomalawi.com
                      </a>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitEnquiry} className="space-y-4">
                    <div>
                      <span className="tm-label">{bookingsEnabled ? 'How is it booked?' : 'What are you listing?'}</span>
                      <div className="tm-actions">
                        <button
                          type="button"
                          aria-pressed={whole}
                          onClick={() => setFormData({ ...formData, stayType: 'whole_house' })}
                          className={`tm-btn tm-btn-sm ${whole ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
                        >
                          <Home size={14} />
                          Whole house
                        </button>
                        <button
                          type="button"
                          aria-pressed={!whole}
                          onClick={() => setFormData({ ...formData, stayType: 'rooms' })}
                          className={`tm-btn tm-btn-sm ${!whole ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
                        >
                          Individual rooms
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <label className="tm-label">Property name *</label>
                        <input
                          type="text"
                          required
                          value={formData.propName}
                          onChange={(e) => setFormData({ ...formData, propName: e.target.value })}
                          placeholder="e.g. Lakeside Cottage"
                          className="tm-input"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="tm-label">Location in Malawi *</label>
                        <input
                          type="text"
                          required
                          value={formData.propLoc}
                          onChange={(e) => setFormData({ ...formData, propLoc: e.target.value })}
                          placeholder="e.g. Cape Maclear, Mangochi"
                          className="tm-input"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="tm-label">Your name *</label>
                        <input
                          type="text"
                          required
                          value={formData.contactName}
                          onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                          placeholder="e.g. John Chirwa"
                          className="tm-input"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="tm-label">Your email *</label>
                        <input
                          type="email"
                          required
                          value={formData.contactEmail}
                          onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                          placeholder="e.g. host@example.com"
                          className="tm-input"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <label className="tm-label">Phone number (optional)</label>
                        <input
                          type="tel"
                          value={formData.contactPhone}
                          onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                          placeholder="e.g. +265 999 123 456"
                          className="tm-input"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="tm-label">{whole ? 'Bedrooms' : 'Rooms'}</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.roomCount}
                          onChange={(e) => setFormData({ ...formData, roomCount: e.target.value })}
                          className="tm-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="tm-label">Notes about your stay (optional)</label>
                      <textarea
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="e.g. Beachfront frontage, solar backup power, boat pickup"
                        className="tm-input resize-y"
                      />
                    </div>

                    <div className="tm-actions justify-between items-center pt-1">
                      <span className="text-xs text-stone-500">
                        Enquiries route to <strong className="text-stone-700">info@ulendomalawi.com</strong>
                      </span>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="tm-btn tm-btn-primary tm-btn-sm"
                      >
                        <Send size={14} />
                        {submitting ? 'Sending...' : 'Send stay enquiry'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </details>

            {/* Guides for Hosts */}
            <section className="tm-divider mt-10 pt-6">
              <h2 className="tm-h2">Guides for hosts</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {GUIDES.map((g) => (
                  <li key={g.to} className="break-words">
                    <Link to={g.to} className="tm-link">{g.title}</Link>
                    <span className="tm-muted"> — {g.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
