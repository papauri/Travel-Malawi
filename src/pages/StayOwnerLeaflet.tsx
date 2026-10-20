import React, { useState } from 'react';
import { Printer, Download, Copy, Check, ArrowLeft, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';
import SEOHead from '../components/SEOHead';
import { downloadDocHtml } from '../lib/downloadDoc';

const STEPS = [
  { title: 'Send four photos on WhatsApp', details: 'Your bed, the view, the bathroom and the dining table.' },
  { title: 'Share your room names and nightly rates', details: 'Rates can be in MWK or USD. A calendar export link is optional.' },
  { title: 'Go live and welcome guests', details: 'We check your profile, test calendar sync and route guest messages to you.' },
];

const BENEFITS = [
  'Your own booking page with rooms, rates in MWK and USD, menu and gate directions.',
  'Deposits paid straight to your Airtel Money, TNM Mpamba or bank account.',
  'Guest enquiries arrive on your WhatsApp with names, dates and totals.',
  'Calendar sync with Airbnb, RoomRaccoon and NightsBridge blocks double bookings.',
];

export default function StayOwnerLeaflet() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'stay-owner-leaflet',
    'Keep what you earn. Welcome guests directly.',
    'List your stay on Travel Malawi: 0% commission at launch, local payouts, and direct chat with guests.'
  );

  const [copied, setCopied] = useState(false);

  const handlePrint = () => window.print();

  const handleDownloadHtml = () =>
    downloadDocHtml('stay-owner-leaflet', 'travel_malawi_stay_owner_leaflet.html', 'Downloaded leaflet (.html)');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Host Partner Overview: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white text-stone-700">
      <SEOHead
        title="Stay Owner Leaflet & Partnership Overview — Travel Malawi"
        description="Why Malawian lodge, cottage, and camp owners choose Travel Malawi: 0% commissions, direct WhatsApp bookings, and mobile money payouts (Airtel Money, TNM Mpamba)."
        keywords="Malawi lodge owners, cottage hosting Malawi, stay owner leaflet, Travel Malawi partner overview"
        url="https://ulendomalawi.com/stay-owner-leaflet"
      />
      <div className="tm-page max-w-3xl py-8 sm:py-12 print:py-0">
        <div className="tm-actions mb-6 print:hidden">
          <Link to="/admin" className="tm-btn tm-btn-secondary tm-btn-sm">
            <ArrowLeft size={14} /> Admin
          </Link>
          <DocQuickEditButton docId="stay-owner-leaflet" onSaved={() => refreshDoc()} />
          <button onClick={handleShareWhatsApp} className="tm-btn tm-btn-secondary tm-btn-sm">
            <MessageSquare size={14} /> Share
          </button>
          <button onClick={handleCopyLink} className="tm-btn tm-btn-secondary tm-btn-sm">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
          </button>
          <button onClick={handleDownloadHtml} className="tm-btn tm-btn-secondary tm-btn-sm">
            <Download size={14} /> HTML
          </button>
          <button onClick={handlePrint} className="tm-btn tm-btn-primary tm-btn-sm">
            <Printer size={14} /> Print / PDF
          </button>
        </div>

        <header className="mb-8">
          <h1 className="tm-h1">{customTitle}</h1>
          <p className="tm-lead mt-2">{customSubtitle}</p>
          {(isCustomized || lastEditedBy) && (
            <p className="tm-muted mt-2">
              {isCustomized && 'Customised edition'}
              {isCustomized && lastEditedBy && ' · '}
              {lastEditedBy && `Maintained by ${lastEditedBy}`}
            </p>
          )}
        </header>

        <section>
          <h2 className="tm-h2">How to get listed</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="tm-tag shrink-0 self-start">{i + 1}</span>
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer font-medium text-stone-900">{step.title}</summary>
                  <p className="tm-muted mt-1">{step.details}</p>
                </details>
              </li>
            ))}
          </ol>
        </section>

        <section className="tm-divider mt-8 pt-8">
          <h2 className="tm-h2">What you get</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm sm:text-base">
            {BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <section className="tm-divider mt-8 pt-8">
          <h2 className="tm-h2">Founding hosts: 0% commission for 90 days</h2>
          <p className="tm-lead mt-2">We accept 10 stays per district, with free setup.</p>
          <div className="tm-actions mt-4 print:hidden">
            <a
              href="mailto:info@ulendomalawi.com?subject=Founding%20Host%20Pilot&body=Hello%20Ulendo%20Malawi%20team,%20we%20would%20like%20to%20register%20our%20stay%20in%20the%20Founding%20Host%20Pilot."
              className="tm-btn tm-btn-primary"
            >
              Contact the host team
            </a>
          </div>
        </section>

        <footer className="tm-divider tm-muted mt-10 pt-4">
          Travel Malawi · Digital Directory · info@ulendomalawi.com
        </footer>
      </div>
    </div>
  );
}
