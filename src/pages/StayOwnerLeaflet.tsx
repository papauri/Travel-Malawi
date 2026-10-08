import React, { useState } from 'react';
import { Printer, Download, Copy, Check, ArrowLeft, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

const secondaryBtn =
  'inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer';
const primaryBtn =
  'inline-flex items-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer';

const BENEFITS = [
  {
    num: '1',
    title: 'Dedicated Direct Storefront',
    desc: 'A clean, mobile-optimized webpage showing your rooms, seasonal rates in Kwacha and USD, food menu, and exact GPS gate directions.'
  },
  {
    num: '2',
    title: 'Instant Local Payouts (MWK)',
    desc: 'Guests pay deposits directly to your Airtel Money, TNM Mpamba, or National Bank of Malawi / Standard Bank account. No foreign wire delays.'
  },
  {
    num: '3',
    title: 'Direct WhatsApp Line with Guests',
    desc: 'Guest inquiries arrive straight to your WhatsApp line with guest names, check-in dates, and total amounts calculated. You keep full control.'
  },
  {
    num: '4',
    title: 'Live Room Calendar & Overbooking Lock',
    desc: 'Easily block dates when your cottage is booked privately or undergoing maintenance. Never suffer from awkward double-bookings.'
  },
  {
    num: '5',
    title: 'Ulendo 24/7 AI Concierge',
    desc: 'Our local digital assistant answers traveler questions day and night in English and Chichewa regarding solar power, menus, and boat trips.'
  }
];

const STEPS = [
  { title: 'Step 1: Send 4 Photos', desc: 'Send photos of your bed, view, bathroom, and dining table on WhatsApp.' },
  { title: 'Step 2: Share Rate Card', desc: 'Share your room names and nightly rates in MWK or USD.' },
  { title: 'Step 3: Start Welcoming Guests', desc: 'Your verified profile goes live with direct WhatsApp inquiry routing.' }
];

export default function StayOwnerLeaflet() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'stay-owner-leaflet',
    'Keep 100% of What You Earn. Welcome More Guests Directly.',
    'Stop giving away 15% to 25% of your revenue to foreign booking platforms. Travel Malawi connects you straight to guests with instant local payouts via Airtel Money, TNM Mpamba, or local bank transfer.'
  );

  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/docs/stay-owner-leaflet?format=html&download=1';
    link.download = 'travel_malawi_stay_owner_leaflet.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded leaflet document (.html)');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Host Partner Overview: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <div className="max-w-3xl mx-auto px-5 py-12 print:py-0">

        {/* Toolbar (hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 print:hidden">
          <Link to="/admin" className={secondaryBtn} title="Return to Admin Hub">
            <ArrowLeft size={16} className="text-stone-500" />
            <span>Admin Hub</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <DocQuickEditButton docId="stay-owner-leaflet" onSaved={() => refreshDoc()} />
            <button onClick={handleShareWhatsApp} className={secondaryBtn} title="Share via WhatsApp">
              <MessageSquare size={16} className="text-stone-500" />
              <span>Share on WhatsApp</span>
            </button>
            <button onClick={handlePrint} className={secondaryBtn} title="Print or export as PDF">
              <Printer size={16} className="text-stone-500" />
              <span>Print / PDF</span>
            </button>
            <button onClick={handleDownloadHtml} className={secondaryBtn} title="Download HTML file">
              <Download size={16} className="text-stone-500" />
              <span>HTML</span>
            </button>
            <button onClick={handleCopyLink} className={secondaryBtn} title="Copy link">
              {copied ? <Check size={16} className="text-stone-500" /> : <Copy size={16} className="text-stone-500" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        {/* Header */}
        <header className="border-b border-stone-200 pb-6 mb-8">
          <p className="text-sm text-stone-500">Travel Malawi &middot; Partner overview</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900">{customTitle}</h1>
          <p className="mt-2 text-stone-500 text-[15px] leading-relaxed">{customSubtitle}</p>
          {(isCustomized || lastEditedBy) && (
            <p className="mt-3 text-sm text-stone-500">
              {isCustomized && 'Customised edition'}
              {isCustomized && lastEditedBy && ' · '}
              {lastEditedBy && `Maintained by ${lastEditedBy}`}
            </p>
          )}
        </header>

        {/* Key figures */}
        <table className="w-full text-sm border border-stone-200">
          <thead>
            <tr>
              <th className="bg-stone-50 text-left font-medium text-stone-900 px-3 py-2">Launch commission</th>
              <th className="bg-stone-50 text-left font-medium text-stone-900 px-3 py-2">Local payouts</th>
              <th className="bg-stone-50 text-left font-medium text-stone-900 px-3 py-2">Guest chat</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2 border-t border-stone-200 text-stone-700">0%</td>
              <td className="px-3 py-2 border-t border-stone-200 text-stone-700">Instant</td>
              <td className="px-3 py-2 border-t border-stone-200 text-stone-700">Direct on WhatsApp</td>
            </tr>
          </tbody>
        </table>

        {/* Benefits */}
        <section>
          <h2 className="text-xl font-semibold text-stone-900 mt-10">What Stays Get on Travel Malawi</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
            Everything your property needs to receive direct, confirmed bookings.
          </p>
          <ol className="mt-6 space-y-5">
            {BENEFITS.map(item => (
              <li key={item.num}>
                <h3 className="text-base font-semibold text-stone-900">
                  {item.num}. {item.title}
                </h3>
                <p className="mt-1 text-[15px] leading-relaxed text-stone-700">{item.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Steps */}
        <section className="border-t border-stone-200 mt-10">
          <h2 className="text-xl font-semibold text-stone-900 mt-10">How To Get Listed (Under 8 Minutes)</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
            Our hospitality onboarding specialists format everything for free.
          </p>
          <ul className="mt-6 space-y-4">
            {STEPS.map(step => (
              <li key={step.title}>
                <h3 className="text-base font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-stone-700">{step.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Founding offer */}
        <section className="border-t border-stone-200 mt-10">
          <h2 className="text-xl font-semibold text-stone-900 mt-10">Founding Host Cohort</h2>
          <div className="mt-4 bg-stone-50 border-l-2 border-stone-300 px-4 py-3">
            <h3 className="text-base font-semibold text-stone-900">0% Commission For Your First 90 Days</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
              We are accepting 10 founding stays per district (Cape Maclear, Mangochi, Lilongwe, Blantyre, Liwonde, Nyika). Keep 100% of room earnings with free setup.
            </p>
          </div>
          <div className="mt-5 print:hidden">
            <a
              href="mailto:partners@travelmalawi.mw?subject=Founding%20Host%20Pilot&body=Hello%20Travel%20Malawi%20team,%20we%20would%20like%20to%20register%20our%20stay%20in%20the%20Founding%20Host%20Pilot."
              className={primaryBtn}
            >
              Contact the host team
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-stone-200 mt-12 pt-6 text-sm text-stone-500">
          Travel Malawi &middot; Direct Hospitality Platform &middot; Lilongwe, Malawi &middot; partners@travelmalawi.mw
        </footer>
      </div>
    </div>
  );
}
