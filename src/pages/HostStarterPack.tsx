import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Copy, Check, Printer, Send, Download, Mail, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ListingRequestForm from '../components/ListingRequestForm';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';
import { downloadDocHtml } from '../lib/downloadDoc';
import SEOHead from '../components/SEOHead';
import { usePlatformMode } from '../contexts/PlatformModeContext';

const GUEST_REPLY_TEMPLATE =
  'Muli bwanji! Thank you for your interest. Your dates are free. The rate is MK 180,000 per night ($115) for the whole cottage. Reply YES and I will hold it for you.';

function Details({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-2 group">
      <summary className="tm-link cursor-pointer text-sm select-none print:hidden">Details</summary>
      <div className="tm-muted mt-2 space-y-1 print:block">{children}</div>
    </details>
  );
}

export default function HostStarterPack() {
  const { bookingsEnabled } = usePlatformMode();
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'host-onboarding-pack',
    'Host Starter Pack',
    bookingsEnabled
      ? 'Get listed and take direct bookings in six steps.'
      : 'Get listed so travellers can find you and contact you directly, in five steps.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const handlePrint = () => window.print();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/host-guide');
    setCopiedLink(true);
    toast.success('Guide link copied');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Takulandirani! Here is the Travel Malawi Host Starter Pack:\n${window.location.origin}/host-guide`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleDownload = () =>
    downloadDocHtml('host-onboarding-pack', 'travel_malawi_host_starter_pack.html', 'Downloaded host starter pack (.html)');

  const copyTemplate = () => {
    navigator.clipboard.writeText(GUEST_REPLY_TEMPLATE);
    setCopiedTemplate(true);
    toast.success('Reply copied');
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  const emailSummaryText = bookingsEnabled ? `Travel Malawi: Host Starter Pack

Six steps to take direct bookings:
1. Take four photos: bed, view, bathroom, dining.
2. Set your prices in MWK and/or USD.
3. Answer guests directly in the app or on your contact line.
4. Sync your calendar (optional).
5. Get paid straight to Airtel Money, TNM Mpamba or your bank.
6. List it yourself at ${window.location.origin}/list-your-property, or send a listing request and our team reviews it and replies by email.

Full guide: ${window.location.origin}/host-guide
How hosting works: ${window.location.origin}/how-hosting-works` : `Travel Malawi: Host Starter Pack

Five steps to get listed:
1. Take four photos: bed, view, bathroom, dining.
2. Set your "from" rates in MWK and/or USD.
3. Add your phone, WhatsApp or email so travellers can contact you directly.
4. No commission and no listing fee: you agree prices and payment with your guests.
5. List it yourself at ${window.location.origin}/list-your-property, or send a listing request and our team reviews it and replies by email.

Full guide: ${window.location.origin}/host-guide
How hosting works: ${window.location.origin}/how-hosting-works`;

  const handleSendEmailViaApp = () => {
    const subject = encodeURIComponent('Host Starter Pack - Travel Malawi');
    const body = encodeURIComponent(emailSummaryText);
    window.location.href = recipientEmail.trim()
      ? `mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    setShowEmailModal(false);
  };

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(emailSummaryText);
    setCopiedEmailText(true);
    toast.success('Summary copied');
    setTimeout(() => setCopiedEmailText(false), 2000);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-700 font-sans print:bg-white">
      <SEOHead
        title="Host Starter Pack - Travel Malawi"
        description="Six short steps for lodges, cottages, B&Bs and camps in Malawi so travellers can find them and contact them directly."
        keywords="Malawi host guide, lodge onboarding Malawi, cottage rental Malawi, Travel Malawi starter pack"
        url="https://ulendomalawi.com/host-starter-pack"
      />
      <main className="tm-page py-8 sm:py-10 max-w-3xl print:p-0 print:max-w-none">
        <div className="tm-actions justify-between mb-6 print:hidden">
          <Link to="/list-your-property" className="tm-btn tm-btn-quiet tm-btn-sm">
            <ArrowLeft size={16} />
            Host Hub
          </Link>
          <div className="tm-actions">
            <DocQuickEditButton docId="host-onboarding-pack" onSaved={() => refreshDoc()} />
            <button type="button" onClick={() => setShowEmailModal(true)} className="tm-btn tm-btn-secondary tm-btn-sm">
              <Mail size={16} /> Email
            </button>
            <button type="button" onClick={handleShareWhatsApp} className="tm-btn tm-btn-secondary tm-btn-sm">
              <MessageSquare size={16} /> WhatsApp
            </button>
            <button type="button" onClick={handleCopyLink} className="tm-btn tm-btn-secondary tm-btn-sm">
              {copiedLink ? <Check size={16} /> : <Copy size={16} />}
              {copiedLink ? 'Copied' : 'Link'}
            </button>
            <button type="button" onClick={handleDownload} className="tm-btn tm-btn-secondary tm-btn-sm">
              <Download size={16} /> HTML
            </button>
            <button type="button" onClick={handlePrint} className="tm-btn tm-btn-primary tm-btn-sm">
              <Printer size={16} /> Print / PDF
            </button>
          </div>
        </div>

        <header className="mb-6">
          <h1 className="tm-h1 break-words">{customTitle}</h1>
          <p className="tm-lead mt-2">{customSubtitle}</p>
          {(isCustomized || lastEditedBy) && (
            <p className="tm-muted mt-2">
              {isCustomized && 'Customised edition'}
              {isCustomized && lastEditedBy && ' · '}
              {lastEditedBy && `Maintained by ${lastEditedBy}`}
            </p>
          )}
        </header>

        <ol className="tm-panel list-none space-y-0 p-0 sm:p-0">
          <li id="section-photos" className="p-4 sm:p-5">
            <h2 className="tm-h2">1. Take four photos</h2>
            <p className="mt-1 text-sm">Bed, view, bathroom and dining. Natural light, phone is fine.</p>
            <Details>
              <p>Bed: eye level, morning light, linens straight.</p>
              <p>View: one third veranda, two thirds lake or hills.</p>
              <p>Bathroom: dry tiles, clean shower.</p>
              <p>Dining: seated angle around 17:15, golden hour.</p>
            </Details>
          </li>

          <li id="section-pricing" className="tm-divider p-4 sm:p-5">
            <h2 className="tm-h2">2. Set clean prices</h2>
            <p className="mt-1 text-sm">Enter MWK and/or USD exactly as you charge them. Round numbers are easiest for travellers to read.</p>
            <Details>
              <p>Example: MK 120,000 and $80 a night for a lakeview chalet.</p>
              <p>Whole house? Enter one rate for the whole stay.</p>
              <p>
                Change seasonal rates any time in the{' '}
                <Link to="/dashboard" className="tm-link">Host Dashboard</Link>.
              </p>
            </Details>
          </li>

          <li id="section-whatsapp" className="tm-divider p-4 sm:p-5">
            <h2 className="tm-h2">{bookingsEnabled ? '3. Answer guests directly' : '3. Add your contact details'}</h2>
            <p className="mt-1 text-sm">
              {bookingsEnabled
                ? 'Guests message you in the app or on WhatsApp. Reply quickly.'
                : 'Travellers contact you on the phone, WhatsApp or email shown on your listing. Reply quickly.'}
            </p>
            <Details>
              <p>Ulendo, the concierge in your dashboard, can draft replies and suggest rates.</p>
              <p className="italic">&ldquo;{GUEST_REPLY_TEMPLATE}&rdquo;</p>
              <button type="button" onClick={copyTemplate} className="tm-btn tm-btn-secondary tm-btn-sm mt-1">
                {copiedTemplate ? <Check size={14} /> : <Copy size={14} />}
                {copiedTemplate ? 'Copied' : 'Copy reply'}
              </button>
            </Details>
          </li>

          {bookingsEnabled && (
          <li id="section-calendar-sync" className="tm-divider p-4 sm:p-5">
            <h2 className="tm-h2">4. Sync your calendar (optional)</h2>
            <p className="mt-1 text-sm">Optional. If you use Airbnb, Booking.com or a PMS, paste your iCal link.</p>
            <Details>
              <p>Optional: only needed if you already take bookings on other platforms.</p>
              <p>Works with Airbnb, Booking.com, NightsBridge, RoomRaccoon and Google Calendar.</p>
              <p>No other calendars? Skip this step and manage your dates directly in your dashboard.</p>
            </Details>
          </li>
          )}

          {bookingsEnabled ? (
            <li id="section-get-listed" className="tm-divider p-4 sm:p-5">
              <h2 className="tm-h2">5. Get paid direct</h2>
              <p className="mt-1 text-sm">No commission. Guests pay you by mobile money, bank or card.</p>
              <Details>
                <p>Airtel Money, TNM Mpamba, NBM, Standard Bank, FDH Bank, Centenary Bank.</p>
                <p>Cash on arrival is available where your policy allows it.</p>
              </Details>
            </li>
          ) : (
            <li id="section-get-listed" className="tm-divider p-4 sm:p-5">
              <h2 className="tm-h2">4. No commission, no fees</h2>
              <p className="mt-1 text-sm">Travel Malawi charges no commission and no listing fee.</p>
              <Details>
                <p>Travel Malawi does not take bookings or payments. You agree dates, prices and payment with your guests directly.</p>
              </Details>
            </li>
          )}

          <li className="tm-divider p-4 sm:p-5">
            <h2 className="tm-h2">{bookingsEnabled ? '6' : '5'}. List it, or request a listing</h2>
            <p className="mt-1 text-sm">
              The quickest way is to list the property yourself. If you would rather our team looked first, send a listing request below; we review it and reply by email.
            </p>
            <Details>
              <p>Nothing is published until our team has reviewed the request and the listing is complete. Licences and permits remain the owner's responsibility.</p>
            </Details>
          </li>
        </ol>

        <section id="onboarding-form" className="tm-panel mt-6 print:hidden">
          <div className="border-b border-stone-200 pb-3 mb-4">
            <h2 className="tm-h2">Request a listing</h2>
            <p className="tm-muted text-sm mt-1">
              Tell us about your lodge, guest house, cottage or camp. We review every request and reply by email.
            </p>
          </div>

          <ListingRequestForm source="host-starter-pack" />
        </section>
      </main>

      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4 print:hidden">
          <div role="dialog" aria-modal="true" aria-label="Email this guide"
            className="tm-panel w-full max-w-md shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="tm-h2">Email this guide</h3>
                <p className="tm-muted mt-1">Send the summary and links to yourself or a partner.</p>
              </div>
              <button type="button" onClick={() => setShowEmailModal(false)} aria-label="Close"
                className="tm-btn tm-btn-quiet tm-btn-sm">
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="tm-label">Recipient email (optional)</label>
              <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="name@example.com" className="tm-input" />
            </div>
            <div className="tm-actions">
              <button type="button" onClick={handleSendEmailViaApp} className="tm-btn tm-btn-primary">
                <Send size={16} /> Open in mail app
              </button>
              <button type="button" onClick={handleCopyEmailText} className="tm-btn tm-btn-secondary">
                {copiedEmailText ? <Check size={16} /> : <Copy size={16} />}
                {copiedEmailText ? 'Copied' : 'Copy text'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
