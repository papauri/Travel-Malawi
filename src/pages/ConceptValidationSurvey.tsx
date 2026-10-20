import React, { useState } from 'react';
import { Download, Printer, Check, Copy, MessageSquare, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';
import { downloadDocHtml } from '../lib/downloadDoc';
import { usePlatformMode } from '../contexts/PlatformModeContext';

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp and phone calls' },
  { id: 'otas', label: 'Booking.com or Airbnb' },
  { id: 'corporate', label: 'Corporate and NGO orders' },
  { id: 'walkins', label: 'Walk-ins and word of mouth' },
];

const PAIN_POINTS = [
  { key: 'otaCommissions' as const, label: 'Paying 15% to 25% commission to booking sites' },
  { key: 'delayedPayouts' as const, label: 'Slow foreign transfers and forex costs' },
  { key: 'manualMessaging' as const, label: 'Repeating the same WhatsApp answers' },
  { key: 'doubleBookings' as const, label: 'Tracking calendars by hand' },
];

const FEATURES = [
  { id: 'payouts', label: 'Kwacha payouts (Airtel Money, TNM Mpamba, bank)' },
  { id: 'zero_comm', label: '0% launch commission' },
  { id: 'ical_sync', label: 'Calendar sync with Airbnb and RoomRaccoon' },
  { id: 'ai_concierge', label: '24/7 guest chat with Ulendo' },
  { id: 'shadow_support', label: 'Live setup help from our team' },
  { id: 'calendar', label: 'Date blocker for offline bookings' },
];

// Directory mode (default): no payouts, booking calendar or guest chat on offer.
const DIRECTORY_FEATURES = [
  { id: 'listing_page', label: 'A free listing with photos, rooms, rates and a map pin' },
  { id: 'direct_contact', label: 'Our own phone, WhatsApp and email shown to travellers' },
  { id: 'zero_comm', label: 'No commission and no listing fee' },
  { id: 'ai_concierge', label: 'Ulendo answering traveller questions at any hour' },
  { id: 'shadow_support', label: 'Live setup help from our team' },
];

const PILOT = [
  { id: 'yes', label: 'Yes, we want to join the Founding Host Pilot' },
  { id: 'briefing', label: 'Maybe, we would like a quick call first' },
  { id: 'later', label: 'Not now, keep us updated' },
];

export default function ConceptValidationSurvey() {
  const { bookingsEnabled } = usePlatformMode();
  const features = bookingsEnabled ? FEATURES : DIRECTORY_FEATURES;
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'concept-validation-survey',
    bookingsEnabled ? 'Host survey: direct bookings and local payments' : 'Host survey: how travellers find you',
    'Three minutes. Tell us what slows your property down so we build the right tools.'
  );

  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    propName: '',
    propLoc: '',
    contactName: '',
    contactPhone: '',
    notes: '',
    channels: ['whatsapp', 'otas'],
    painPoints: {
      otaCommissions: 5,
      delayedPayouts: 5,
      manualMessaging: 4,
      doubleBookings: 3,
    },
    features: ['zero_comm', 'ai_concierge'],
    pilotInterest: 'yes'
  });

  const handlePrint = () => window.print();

  const handleDownloadHtml = () =>
    downloadDocHtml('concept-validation-survey', 'travel_malawi_partner_survey.html', 'Downloaded survey (.html)');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const shareText = `Muli bwanji! Here is the Travel Malawi Partner Discovery Survey for local lodges and cottages: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const toggleCheckbox = (listKey: 'channels' | 'features', value: string) => {
    setFormData(prev => {
      const current = prev[listKey];
      const exists = current.includes(value);
      return {
        ...prev,
        [listKey]: exists ? current.filter(item => item !== value) : [...current, value]
      };
    });
  };

  const setPainPoint = (key: keyof typeof formData.painPoints, value: number) => {
    setFormData(prev => ({
      ...prev,
      painPoints: {
        ...prev.painPoints,
        [key]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() && !formData.contactPhone.trim()) {
      toast.error('Please provide at least your property name or WhatsApp number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Submit to local server endpoint
      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      const refId = data.id || `survey-${Date.now()}`;

      // 2. Also record in Firestore if available
      try {
        await addDoc(collection(db, 'surveys'), {
          ...formData,
          createdAt: serverTimestamp(),
          clientSubmittedAt: new Date().toISOString()
        });
      } catch {
        // non-fatal if offline
      }

      setSubmissionId(refId);
      setIsSubmitted(true);
      toast.success('Zikomo! Survey submitted.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Survey submit error:', err);
      toast.error('Could not submit the survey. Try again or message us on WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const optionCls = 'flex items-start gap-3 py-1.5 cursor-pointer select-none text-sm text-stone-800';

  return (
    <div className="min-h-screen bg-white text-stone-700">
      <div className="tm-page max-w-3xl py-8 sm:py-12 print:py-0">
        <div className="tm-actions mb-6 print:hidden">
          <Link to="/admin" className="tm-btn tm-btn-secondary tm-btn-sm">
            <ArrowLeft size={14} /> Admin
          </Link>
          <DocQuickEditButton docId="concept-validation-survey" onSaved={() => refreshDoc()} />
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

        {isSubmitted ? (
          <section className="tm-panel">
            <h2 className="tm-h2">Zikomo kwambiri</h2>
            <p className="tm-lead mt-2">
              Thank you, {formData.contactName || 'partner'}. We have your answers for {formData.propName || 'your property'} and will message you on WhatsApp ({formData.contactPhone || 'the number you gave'}).
            </p>
            {submissionId && (
              <p className="tm-muted mt-2">
                Reference: <span className="font-mono">{submissionId}</span>
              </p>
            )}
            <div className="tm-actions mt-4 print:hidden">
              <button onClick={handlePrint} className="tm-btn tm-btn-primary">Print a copy</button>
              <button onClick={() => setIsSubmitted(false)} className="tm-btn tm-btn-secondary">Edit or send another</button>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <section>
              <h2 className="tm-h2">Your property</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sv-prop" className="tm-label">Property name</label>
                  <input
                    id="sv-prop"
                    type="text"
                    value={formData.propName}
                    onChange={e => setFormData({ ...formData, propName: e.target.value })}
                    placeholder="e.g. Cape Maclear Sunset Lodge"
                    required
                    className="tm-input"
                  />
                </div>
                <div>
                  <label htmlFor="sv-loc" className="tm-label">Location</label>
                  <input
                    id="sv-loc"
                    type="text"
                    value={formData.propLoc}
                    onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                    placeholder="e.g. Chembe Village, Mangochi"
                    className="tm-input"
                  />
                </div>
                <div>
                  <label htmlFor="sv-name" className="tm-label">Your name</label>
                  <input
                    id="sv-name"
                    type="text"
                    value={formData.contactName}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="e.g. Kondwani Phiri"
                    className="tm-input"
                  />
                </div>
                <div>
                  <label htmlFor="sv-phone" className="tm-label">WhatsApp number</label>
                  <input
                    id="sv-phone"
                    type="text"
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="Include country code"
                    required
                    className="tm-input"
                  />
                </div>
              </div>
            </section>

            <section className="tm-divider pt-6">
              <h2 className="tm-h2">How do guests find and reach you today?</h2>
              <div className="mt-2">
                {CHANNELS.map(item => (
                  <label key={item.id} className={optionCls}>
                    <input
                      type="checkbox"
                      checked={formData.channels.includes(item.id)}
                      onChange={() => toggleCheckbox('channels', item.id)}
                      className="mt-0.5 accent-stone-900"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="tm-divider pt-6">
              <h2 className="tm-h2">How much does each one hurt?</h2>
              <p className="tm-muted mt-1">1 is no problem, 5 is a major headache.</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-stone-900">Problem</th>
                      {[1, 2, 3, 4, 5].map(val => (
                        <th key={val} className="w-9 px-1 py-2 text-center font-medium text-stone-900">{val}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PAIN_POINTS.map(item => (
                      <tr key={item.key} className="border-t border-stone-200">
                        <td className="min-w-[10rem] px-2 py-2 text-stone-700">{item.label}</td>
                        {[1, 2, 3, 4, 5].map(val => (
                          <td key={val} className="px-1 py-2 text-center">
                            <input
                              type="radio"
                              name={item.key}
                              value={val}
                              aria-label={`${item.label}: ${val}`}
                              checked={formData.painPoints[item.key] === val}
                              onChange={() => setPainPoint(item.key, val)}
                              className="cursor-pointer accent-stone-900"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tm-divider pt-6">
              <h2 className="tm-h2">What would help most?</h2>
              <div className="mt-2">
                {features.map(item => (
                  <label key={item.id} className={optionCls}>
                    <input
                      type="checkbox"
                      checked={formData.features.includes(item.id)}
                      onChange={() => toggleCheckbox('features', item.id)}
                      className="mt-0.5 accent-stone-900"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="tm-divider pt-6">
              <h2 className="tm-h2">Join the Founding Host Pilot?</h2>
              <p className="tm-muted mt-1">
                {bookingsEnabled ? '10 stays per district, 0% commission for 90 days.' : '10 stays per district, free listing and setup.'}
              </p>
              <div className="mt-2">
                {PILOT.map(item => (
                  <label key={item.id} className={optionCls}>
                    <input
                      type="radio"
                      name="pilotInterest"
                      value={item.id}
                      checked={formData.pilotInterest === item.id}
                      onChange={() => setFormData({ ...formData, pilotInterest: item.id })}
                      className="mt-0.5 accent-stone-900"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <label htmlFor="sv-notes" className="tm-label">Anything else? (optional)</label>
                <textarea
                  id="sv-notes"
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Power backup, boat trips, or a question for us"
                  className="tm-input"
                />
              </div>
            </section>

            <div className="tm-actions print:hidden">
              <button type="submit" disabled={isSubmitting} className="tm-btn tm-btn-primary">
                {isSubmitting ? 'Sending…' : 'Send survey'}
              </button>
            </div>
          </form>
        )}

        <footer className="tm-divider tm-muted mt-10 pt-4">
          Travel Malawi · Digital Directory · info@ulendomalawi.com
        </footer>
      </div>
    </div>
  );
}
