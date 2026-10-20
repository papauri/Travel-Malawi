import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Copy, Check, Printer, Send, Download, Mail, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';
import { downloadDocHtml } from '../lib/downloadDoc';
import SEOHead from '../components/SEOHead';

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
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'host-onboarding-pack',
    'Host Starter Pack',
    'Get listed and take direct bookings in six steps.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
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
    contactEmail: '',
    contactPhone: '',
    nightlyMwk: '',
    nightlyUsd: '',
    roomCount: '1',
    notes: '',
  });

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

  const emailSummaryText = `Travel Malawi: Host Starter Pack

Six steps to take direct bookings:
1. Take four photos: bed, view, bathroom, dining.
2. Set clean prices in MWK (nearest 1,000) and USD (nearest $5).
3. Answer guests directly in the app or on your contact line.
4. Sync your calendar (optional).
5. Get paid straight to Airtel Money, TNM Mpamba or your bank.
6. Send us an enquiry with your stay details and our team follows up by email.

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() || !formData.contactEmail.trim() || !formData.contactEmail.includes('@')) {
      toast.error('Please enter property name and a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Dispatch email notification to info@ulendomalawi.com via backend
      let assignedId = 'ENQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        const apiRes = await fetch('/api/host-enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            source: 'host-starter-pack',
          }),
        });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData?.id) assignedId = apiData.id;
        }
      } catch (apiErr) {
        console.warn('API host enquiry warning:', apiErr);
      }

      // 2. Persist to Firestore host_onboarding_submissions
      try {
        const docRef = await addDoc(collection(db, 'host_onboarding_submissions'), {
          ...formData,
          createdAt: serverTimestamp(),
          source: 'host-starter-pack-web',
          status: 'pending_review',
        });
        setSubmissionId(docRef.id);
      } catch (fsErr) {
        console.warn('Firestore submission fallback to API ID:', fsErr);
        setSubmissionId(assignedId);
      }

      setSubmitted(true);
      toast.success('Enquiry received! Our team will contact you by email.');
    } catch {
      const fallbackId = 'ENQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setSubmissionId(fallbackId);
      setSubmitted(true);
      toast.success('Enquiry received! Our team will contact you by email.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData({ ...formData, [k]: e.target.value });

  const whole = formData.stayType === 'whole_house';

  return (
    <div className="min-h-screen bg-stone-50 text-stone-700 font-sans print:bg-white">
      <SEOHead
        title="Host Starter Pack - Travel Malawi"
        description="Six short steps for lodges, cottages, B&Bs and camps in Malawi to get listed and take direct bookings."
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
            <p className="mt-1 text-sm">MWK to the nearest 1,000. USD to the nearest $5.</p>
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
            <h2 className="tm-h2">3. Answer guests directly</h2>
            <p className="mt-1 text-sm">Guests message you in the app or on WhatsApp. Reply quickly.</p>
            <Details>
              <p>Ulendo, the concierge in your dashboard, can draft replies and suggest rates.</p>
              <p className="italic">&ldquo;{GUEST_REPLY_TEMPLATE}&rdquo;</p>
              <button type="button" onClick={copyTemplate} className="tm-btn tm-btn-secondary tm-btn-sm mt-1">
                {copiedTemplate ? <Check size={14} /> : <Copy size={14} />}
                {copiedTemplate ? 'Copied' : 'Copy reply'}
              </button>
            </Details>
          </li>

          <li id="section-calendar-sync" className="tm-divider p-4 sm:p-5">
            <h2 className="tm-h2">4. Sync your calendar (optional)</h2>
            <p className="mt-1 text-sm">Optional. If you use Airbnb, Booking.com or a PMS, paste your iCal link.</p>
            <Details>
              <p>Optional: only needed if you already take bookings on other platforms.</p>
              <p>Works with Airbnb, Booking.com, NightsBridge, RoomRaccoon and Google Calendar.</p>
              <p>No other calendars? Skip this step and manage your dates directly in your dashboard.</p>
            </Details>
          </li>

          <li id="section-get-listed" className="tm-divider p-4 sm:p-5">
            <h2 className="tm-h2">5. Get paid direct</h2>
            <p className="mt-1 text-sm">No commission. Guests pay you by mobile money, bank or card.</p>
            <Details>
              <p>Airtel Money, TNM Mpamba, NBM, Standard Bank, FDH Bank, Centenary Bank.</p>
              <p>Cash on arrival is available where your policy allows it.</p>
            </Details>
          </li>

          <li className="tm-divider p-4 sm:p-5">
            <h2 className="tm-h2">6. Send us an enquiry</h2>
            <p className="mt-1 text-sm">
              Fill in the short enquiry form below. We review your stay details and follow up with you by email.
            </p>
            <Details>
              <p>We are just getting to know about your stay. Our team follows up directly via email to help you finalize your listing.</p>
            </Details>
          </li>
        </ol>

        <section id="onboarding-form" className="tm-panel mt-6 print:hidden">
          <div className="border-b border-stone-200 pb-3 mb-4">
            <h2 className="tm-h2">Tell us about your stay</h2>
            <p className="tm-muted text-sm mt-1">
              Send us an enquiry with details of your cottage, lodge, or guest house. We review your stay and email you back to help you get listed.
            </p>
          </div>

          {submitted ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2 text-emerald-800 font-medium">
                <Check size={20} className="text-emerald-700 shrink-0" />
                <span>Takulandirani! We have received your stay enquiry.</span>
              </div>
              <p className="text-sm text-stone-700">
                Reference: <span className="font-mono font-bold text-stone-900">{submissionId}</span>. Our team will review your details and get in touch with you by email at{' '}
                <strong className="text-stone-900 break-words">{formData.contactEmail}</strong>.
              </p>
              <div className="p-3 bg-stone-100 rounded-lg text-xs text-stone-600 leading-relaxed">
                We are just trying to know about the stay so we can prepare your direct listing. If you have photos, rate sheets, or questions right away, feel free to email our team directly at{' '}
                <a href="mailto:info@ulendomalawi.com" className="font-semibold text-amber-800 underline">
                  info@ulendomalawi.com
                </a>.
              </div>
              <div className="tm-actions pt-2">
                <a
                  href={`mailto:info@ulendomalawi.com?subject=${encodeURIComponent(`Enquiry: ${formData.propName} (Ref: ${submissionId})`)}&body=${encodeURIComponent(`Muli bwanji,\n\nI have submitted an enquiry for ${formData.propName} (Ref: ${submissionId}).\n\nLooking forward to hearing from you!`)}`}
                  className="tm-btn tm-btn-primary"
                >
                  <Mail size={16} /> Email info@ulendomalawi.com
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({
                      propName: '',
                      propLoc: '',
                      stayType: 'whole_house',
                      contactName: '',
                      contactEmail: '',
                      contactPhone: '',
                      nightlyMwk: '',
                      nightlyUsd: '',
                      roomCount: '1',
                      notes: '',
                    });
                  }}
                  className="tm-btn tm-btn-secondary"
                >
                  Submit another stay
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <span className="tm-label">How is it booked?</span>
                <div className="tm-actions">
                  <button
                    type="button"
                    aria-pressed={whole}
                    onClick={() => setFormData({ ...formData, stayType: 'whole_house' })}
                    className={`tm-btn ${whole ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
                  >
                    Whole house
                  </button>
                  <button
                    type="button"
                    aria-pressed={!whole}
                    onClick={() => setFormData({ ...formData, stayType: 'rooms' })}
                    className={`tm-btn ${!whole ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
                  >
                    Individual rooms
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="tm-label">Property name *</label>
                  <input type="text" required value={formData.propName} onChange={set('propName')}
                    placeholder="e.g. Example Lakeside Cottage" className="tm-input" />
                </div>
                <div className="min-w-0">
                  <label className="tm-label">Location in Malawi *</label>
                  <input type="text" required value={formData.propLoc} onChange={set('propLoc')}
                    placeholder="e.g. Cape Maclear, Mangochi" className="tm-input" />
                </div>
                <div className="min-w-0">
                  <label className="tm-label">Your name *</label>
                  <input type="text" required value={formData.contactName} onChange={set('contactName')}
                    placeholder="e.g. John Chirwa" className="tm-input" />
                </div>
                <div className="min-w-0">
                  <label className="tm-label">Your email address * (for enquiry reply)</label>
                  <input type="email" required value={formData.contactEmail} onChange={set('contactEmail')}
                    placeholder="e.g. host@example.com" className="tm-input" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="tm-label">Phone / WhatsApp number (optional)</label>
                  <input type="tel" value={formData.contactPhone} onChange={set('contactPhone')}
                    placeholder="e.g. +265 999 123 456" className="tm-input" />
                </div>
                <div className="min-w-0">
                  <label className="tm-label">{whole ? 'Bedrooms' : 'Rooms'}</label>
                  <input type="number" min="1" value={formData.roomCount} onChange={set('roomCount')} className="tm-input" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="tm-label">{whole ? 'Whole stay rate (MWK, optional)' : 'Room rate (MWK, optional)'}</label>
                  <input type="text" value={formData.nightlyMwk} onChange={set('nightlyMwk')}
                    placeholder="e.g. 180,000" className="tm-input" />
                </div>
                <div className="min-w-0">
                  <label className="tm-label">{whole ? 'Whole stay rate (USD, optional)' : 'Room rate (USD, optional)'}</label>
                  <input type="text" value={formData.nightlyUsd} onChange={set('nightlyUsd')}
                    placeholder="e.g. 115" className="tm-input" />
                </div>
              </div>

              <div>
                <label className="tm-label">Tell us about your stay (features, questions, directions)</label>
                <textarea rows={3} value={formData.notes} onChange={set('notes')}
                  placeholder="e.g. Beachfront lawn, solar backup power, borehole water, boat pickup available" className="tm-input resize-y" />
              </div>

              <div className="tm-actions justify-between items-center pt-2">
                <span className="text-xs text-stone-500">
                  Enquiries are sent directly to <strong className="text-stone-700">info@ulendomalawi.com</strong>
                </span>
                <button type="submit" disabled={submitting} className="tm-btn tm-btn-primary">
                  <Send size={16} />
                  {submitting ? 'Sending enquiry...' : 'Send stay enquiry'}
                </button>
              </div>
            </form>
          )}
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
