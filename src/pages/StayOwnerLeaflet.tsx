import React, { useState } from 'react';
import { 
  Building2, Smartphone, Calendar, Star, DollarSign, 
  Printer, Download, Copy, Check, ArrowLeft, 
  MessageSquare, ShieldCheck, CheckCircle2, PhoneCall, Mail, Share2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

export default function StayOwnerLeaflet() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'stay-owner-leaflet',
    'Keep 100% of What You Earn. Welcome More Guests Directly.',
    'Stop giving away 15% to 25% of your lodge revenue to foreign booking platforms that delay overseas payments. Travel Malawi connects you straight to domestic and international travelers with instant Kwacha payouts to Airtel Money, TNM Mpamba, or your local bank account.'
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
    const text = `Muli bwanji! Here is the Travel Malawi Host Partner Overview for lodges and cottages: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-stone-100/60 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white text-stone-900 font-sans">
      
      {/* Top Standardized Utility Bar (Hidden during print) */}
      <div className="max-w-3xl mx-auto mb-6 bg-white border border-stone-200 rounded-2xl p-4 sm:px-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link 
            to="/admin" 
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition text-xs font-semibold inline-flex items-center gap-1.5"
            title="Return to Admin Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Admin Hub</span>
          </Link>
          <div className="h-4 w-px bg-stone-200 hidden sm:block" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              Partner Overview
            </span>
            <div className="text-xs font-bold text-stone-900 truncate">
              Stay Owner One-Pager
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
          <DocQuickEditButton 
            docId="stay-owner-leaflet" 
            onSaved={() => refreshDoc()} 
          />

          <button
            onClick={handleShareWhatsApp}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Share via WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Share on WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Print or export as clean PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleDownloadHtml}
            className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs border border-stone-200 transition inline-flex items-center gap-1.5 cursor-pointer"
            title="Download clean HTML file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">HTML</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 transition cursor-pointer"
            title="Copy link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Clean Document Sheet */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        
        {/* Simple Editorial Header */}
        <div className="p-6 sm:p-10 border-b border-stone-200 bg-stone-50/50 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Travel Malawi &bull; Partner Acquisition Brief
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight leading-tight">
                {customTitle}
              </h1>
              {isCustomized && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                  Live Customized
                </span>
              )}
            </div>
            {lastEditedBy && (
              <p className="text-[11px] text-stone-500 font-mono">
                Maintained by {lastEditedBy}
              </p>
            )}
          </div>
          <p className="text-stone-600 text-xs sm:text-sm leading-relaxed max-w-2xl">
            {customSubtitle}
          </p>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-stone-200 text-center">
            <div className="bg-white p-3 rounded-xl border border-stone-200/80">
              <div className="text-lg sm:text-xl font-bold text-stone-900">0%</div>
              <div className="text-[10px] text-stone-500 uppercase font-semibold">Launch Commission</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-stone-200/80">
              <div className="text-lg sm:text-xl font-bold text-emerald-700">Instant</div>
              <div className="text-[10px] text-stone-500 uppercase font-semibold">Local Payouts</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-stone-200/80">
              <div className="text-lg sm:text-xl font-bold text-stone-900">Direct</div>
              <div className="text-[10px] text-stone-500 uppercase font-semibold">WhatsApp Chat</div>
            </div>
          </div>
        </div>

        {/* 5 Core Benefits (Minimalist & Simple) */}
        <div className="p-6 sm:p-10 space-y-6">
          <div>
            <h2 className="text-base font-serif font-bold text-stone-900">
              What Stays Get on Travel Malawi
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Everything your property needs to receive direct, confirmed bookings.
            </p>
          </div>

          <div className="space-y-3">
            {[
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
            ].map(item => (
              <div key={item.num} className="p-4 rounded-xl border border-stone-200 bg-white flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.num}
                </span>
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900">{item.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 3 Simple Steps To Get Listed */}
          <div className="bg-stone-50 p-5 sm:p-6 rounded-xl border border-stone-200 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                How To Get Listed (Under 8 Minutes)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Our hospitality onboarding specialists format everything for free.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-lg border border-stone-200 space-y-1">
                <div className="text-xs font-bold text-stone-900">Step 1: Send 4 Photos</div>
                <p className="text-[11px] text-stone-500">Send photos of your bed, view, bathroom, and dining table on WhatsApp.</p>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-stone-200 space-y-1">
                <div className="text-xs font-bold text-stone-900">Step 2: Share Rate Card</div>
                <p className="text-[11px] text-stone-500">Share your room names and nightly rates in MWK or USD.</p>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-stone-200 space-y-1">
                <div className="text-xs font-bold text-stone-900">Step 3: Start Welcoming Guests</div>
                <p className="text-[11px] text-stone-500">Your verified profile goes live with direct WhatsApp inquiry routing.</p>
              </div>
            </div>
          </div>

          {/* Founding Offer Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full inline-block">
              Founding Host Cohort
            </span>
            <h3 className="text-base font-serif font-bold text-amber-950">
              0% Commission For Your First 90 Days
            </h3>
            <p className="text-xs text-amber-900 max-w-lg mx-auto leading-relaxed">
              We are accepting 10 founding stays per district (Cape Maclear, Mangochi, Lilongwe, Blantyre, Liwonde, Nyika). Keep 100% of room earnings with free setup.
            </p>
            <div className="pt-2">
              <a
                href="https://wa.me/265999000000?text=Hello%20Travel%20Malawi%20team,%20we%20would%20like%20to%20register%20our%20stay%20in%20the%20Founding%20Host%20Pilot."
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Message Host Team on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-200 bg-stone-50 text-center text-xs text-stone-500">
          Travel Malawi &bull; Direct Hospitality Platform &bull; Lilongwe, Malawi &bull; partners@travelmalawi.mw
        </div>

      </div>

    </div>
  );
}
