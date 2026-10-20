import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Printer, Send, Download, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';
import { downloadDocHtml } from '../lib/downloadDoc';
import { usePlatformMode } from '../contexts/PlatformModeContext';

export default function OperationsStarterPack() {
  const { bookingsEnabled } = usePlatformMode();
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'operations-starter-pack',
    'Field guide: signing up and checking hosts',
    'How to bring a host on, answer their questions and check the listing before it goes live.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    scoutName: '',
    scoutPhone: '',
    targetStay: '',
    targetLocation: '',
    notes: ''
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Operations & Field Playbook: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => downloadDocHtml('operations-starter-pack', 'travel_malawi_operations_playbook.html', 'Downloaded operations playbook (.html)');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.targetStay.trim() && !formData.notes.trim()) {
      toast.error('Please enter the lodge name or field observations.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: 'operations_feedback',
        sourceDoc: 'Operations Playbook',
        propName: formData.targetStay || 'Field Lead',
        propLoc: formData.targetLocation || '',
        contactName: formData.scoutName || 'Operations Scout',
        contactPhone: formData.scoutPhone || '',
        notes: formData.notes,
        pilotInterest: 'yes'
      };

      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const refId = data.id || `ops-${Date.now()}`;

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
      toast.success('Field report submitted successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit field report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Directory mode (default): no booking, deposit, chat or calendar-sync pitch.
  const directorySteps = [
    {
      title: 'Ask for photos and rates, not a sign-up',
      detail: 'Say: "Send 3 photos and your rate card on WhatsApp. We set up your listing for free." Never ask a host to fill in forms or learn a system.',
    },
    {
      title: 'Message on WhatsApp, three times over three days',
      detail: 'Day 1: a sincere compliment and a question about how travellers find them today. Day 2: show a private preview of their listing. Day 3: offer a founding-host place for their region.',
    },
    {
      title: 'Answer objections plainly',
      detail: '"We use Booking.com": keep it, a directory listing sits alongside it. "No time": travellers contact you directly on the phone, WhatsApp or email you choose. "What is the catch?": none, there is no commission and no listing fee. "How do guests pay?": that is agreed between you and the guest; Travel Malawi takes no part in it.',
    },
    {
      title: 'Show the listing and Ulendo',
      detail: 'Travellers see rooms, indicative rates, the menu, the map pin and the "Contact the property" details. Ulendo in the Host Dashboard helps with rates in MWK and USD, descriptions and menu updates.',
    },
    {
      title: 'Check the listing before approving',
      detail: 'Gate GPS pin. Four daytime photos (bed, view, bathroom, dining). MWK in clean thousands, USD in whole dollars or nearest $5. At least one direct contact (phone, WhatsApp or email); the WhatsApp number answers a test message within 15 minutes. Then approve in the Admin Dashboard. Never describe a listing as licensed or verified by the Ministry.',
    },
    {
      title: 'Help a host live with Shadow mode',
      detail: 'Choose Shadow a Manager in the menu, search the property, click Shadow Host. Check the amber banner shows. Do the fix, then click Exit Shadow Mode. Every action is logged and no password is shared.',
    },
    {
      title: 'Log the lead below',
      detail: 'Enter the lodge, area and contact so the Admin Hub can start onboarding.',
    },
  ];

  const bookingSteps = [
    {
      title: 'Ask for photos and rates, not a sign-up',
      detail: 'Say: "Send 3 photos and your rate card on WhatsApp. We set up your page for free." Never ask a host to fill in forms or learn a system.',
    },
    {
      title: 'Message on WhatsApp, three times over three days',
      detail: 'Day 1: a sincere compliment and a question about booking-site commission. Day 2: show a private preview of their page. Day 3: offer a founding-host place for their region.',
    },
    {
      title: 'Answer objections plainly',
      detail: '"We use Booking.com": keep it, we add direct domestic guests at 0% commission. "No time": enquiries arrive on WhatsApp and you confirm in one tap. "What is the catch?": none, baseline bookings stay free. "Cash only": fine, deposits by Airtel Money or Mpamba are optional.',
    },
    {
      title: 'Show the host chat and Ulendo',
      detail: 'Guests message the manager directly in the app and on WhatsApp. Ulendo in the Host Dashboard helps with rates in MWK and USD, menu updates and guest replies.',
    },
    {
      title: 'Check the listing before approving',
      detail: 'Gate GPS pin. Four daytime photos (bed, view, bathroom, dining). MWK in clean thousands, USD in whole dollars or nearest $5. WhatsApp number answers a test message within 15 minutes. Host knows how chat and Ulendo work. iCal Test Connection passes. Then approve in the Admin Dashboard.',
    },
    {
      title: 'Help a host live with Shadow mode',
      detail: 'Choose Shadow a Manager in the menu, search the property, click Shadow Host. Check the amber banner shows. Do the fix, then click Exit Shadow Mode. Every action is logged and no password is shared.',
    },
    {
      title: 'Log the lead below',
      detail: 'Enter the lodge, area and contact so the Admin Hub can start onboarding.',
    },
  ];

  const steps = bookingsEnabled ? bookingSteps : directorySteps;

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <main className="tm-page max-w-3xl py-10 print:py-0">
        <div className="tm-actions print:hidden">
          <Link to="/list-your-property" className="tm-btn tm-btn-secondary tm-btn-sm">
            <ArrowLeft size={16} /> Partner Hub
          </Link>
          <DocQuickEditButton docId="operations-starter-pack" onSaved={() => refreshDoc()} />
          <button onClick={handleShareWhatsApp} className="tm-btn tm-btn-secondary tm-btn-sm">
            <MessageSquare size={16} /> Share
          </button>
          <button onClick={handleCopyLink} className="tm-btn tm-btn-secondary tm-btn-sm" title="Copy link">
            {copiedLink ? <Check size={16} /> : <Copy size={16} />}
            {copiedLink ? 'Copied' : 'Copy link'}
          </button>
          <button onClick={handleDownload} className="tm-btn tm-btn-secondary tm-btn-sm">
            <Download size={16} /> HTML
          </button>
          <button onClick={handlePrint} className="tm-btn tm-btn-primary tm-btn-sm">
            <Printer size={16} /> Print / PDF
          </button>
        </div>

        <header className="mt-6">
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

        <ol className="mt-8 space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-medium text-stone-50">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium text-stone-900">{step.title}</h2>
                <details className="mt-1 text-sm text-stone-600">
                  <summary className="tm-link cursor-pointer">Details</summary>
                  <p className="mt-2 break-words">{step.detail}</p>
                </details>
              </div>
            </li>
          ))}
        </ol>

        <section id="scout-form" className="tm-divider mt-10 pt-8">
          <h2 className="tm-h2">Log a lodge lead</h2>
          <p className="tm-muted mt-1">Met a manager or found a promising property? Add it here.</p>

          {submitted ? (
            <div className="tm-panel mt-5">
              <p className="font-medium text-stone-900">Lead logged</p>
              <p className="mt-1 text-sm text-stone-700">
                Reference <span className="font-mono">{submissionId}</span>. It now shows in the Admin Hub.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="tm-label">Lodge or cottage name *</label>
                  <input type="text" required placeholder="e.g. Example Lakeside Cottage" value={formData.targetStay}
                    onChange={e => setFormData({ ...formData, targetStay: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">Area</label>
                  <input type="text" placeholder="e.g. Nkhata Bay, Senga Bay, Liwonde" value={formData.targetLocation}
                    onChange={e => setFormData({ ...formData, targetLocation: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">Your name</label>
                  <input type="text" placeholder="Field officer" value={formData.scoutName}
                    onChange={e => setFormData({ ...formData, scoutName: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">Host WhatsApp or phone</label>
                  <input type="tel" placeholder="Include country code" value={formData.scoutPhone}
                    onChange={e => setFormData({ ...formData, scoutPhone: e.target.value })} className="tm-input" />
                </div>
              </div>
              <div>
                <label className="tm-label">Notes</label>
                <textarea rows={3} placeholder="e.g. Interested, has 6 chalets, wants more domestic guests" value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })} className="tm-input" />
              </div>
              <div className="tm-actions justify-between">
                <span className="tm-muted">Goes to the Admin Hub.</span>
                <button type="submit" disabled={submitting} className="tm-btn tm-btn-primary">
                  <Send size={16} />
                  {submitting ? 'Sending…' : 'Log lead'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
