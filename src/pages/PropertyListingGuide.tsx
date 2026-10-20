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

export default function PropertyListingGuide() {
  const { bookingsEnabled } = usePlatformMode();
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'property-listing-guide',
    'The Science of High-Converting Hospitality Listings',
    'A practical framework for naming units, showcasing amenities, providing directions, and setting rates that convert browsers into direct stays.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    propName: '',
    propLoc: '',
    contactName: '',
    contactPhone: '',
    roomTypes: '',
    amenities: '',
    notes: ''
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Property Listing & Merchandising Guide: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => downloadDocHtml('property-listing-guide', 'travel_malawi_property_listing_guide.html', 'Downloaded listing guide (.html)');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() || !formData.contactPhone.trim()) {
      toast.error('Please enter property name and WhatsApp contact number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: 'listing_request',
        sourceDoc: 'Property Listing Guide',
        propName: formData.propName,
        propLoc: formData.propLoc,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        roomTypes: formData.roomTypes,
        notes: `Amenities: ${formData.amenities}. Notes: ${formData.notes}`,
        pilotInterest: 'yes'
      };

      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const refId = data.id || `list-${Date.now()}`;

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
      toast.success('Zikomo! Listing submission received.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit listing.');
    } finally {
      setSubmitting(false);
    }
  };

  const allSteps = [
    {
      title: 'Name each room by what guests get',
      detail: 'Use "Sunrise Shore Chalet" or "Baobab Family Cottage (Self-Catering)" instead of "Room 1" or "Double Room". Say if it is self-catering.',
    },
    {
      title: 'Answer the three worries up front',
      detail: 'Power: "Solar inverter backup." Roads: "2WD fine in dry season, 4WD in Jan-Mar rains." Hot water: "Solar hot showers, borehole supply."',
    },
    {
      title: 'Give directions in three parts',
      detail: 'Highway turn-off (road, km marker, landmark). Track condition and length. Gate landmark plus a GPS pin so guests can navigate offline.',
    },
    {
      title: 'Add rooms and rates in your Host Dashboard',
      detail: 'Open Rooms & Rates. Enter MWK in clean thousands and USD in whole dollars. Ulendo can draft room descriptions if you ask.',
    },
    {
      title: 'Sync your calendar (optional)',
      bookingOnly: true,
      detail: 'Optional: If you use Airbnb, Booking.com, NightsBridge or RoomRaccoon, paste the iCal export feed to stop double bookings. If not, manage dates manually. Use Test Connection to check it.',
    },
    {
      title: 'Answer guests in the chat',
      bookingOnly: true,
      detail: 'Guests message you in the app before and after booking. Reply about transfers, arrival times and meals.',
    },
    {
      title: 'Add your contact details',
      directoryOnly: true,
      detail: 'Add at least one of phone, WhatsApp or email. Travellers contact you directly from your listing; Travel Malawi does not take bookings or payments. Reply about transfers, arrival times and meals.',
    },
    {
      title: 'Need a hand? Ask us',
      detail: 'Our team can help set up your listing. Staff only join your dashboard session with your approval, never with your password, and a banner shows when they are there. Or use the form below.',
    },
  ];

  const steps = allSteps.filter((step) => (bookingsEnabled ? !step.directoryOnly : !step.bookingOnly));

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <main className="tm-page max-w-3xl py-10 print:py-0">
        <div className="tm-actions print:hidden">
          <Link to="/list-your-property" className="tm-btn tm-btn-secondary tm-btn-sm">
            <ArrowLeft size={16} /> Host Hub
          </Link>
          <DocQuickEditButton docId="property-listing-guide" onSaved={() => refreshDoc()} />
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

        <section id="listing-form" className="tm-divider mt-10 pt-8">
          <h2 className="tm-h2">Want us to write your listing?</h2>
          <p className="tm-muted mt-1">Send your details and we will prepare a draft for free.</p>

          {submitted ? (
            <div className="tm-panel mt-5">
              <p className="font-medium text-stone-900">Listing request received</p>
              <p className="mt-1 text-sm text-stone-700">
                Reference <span className="font-mono">{submissionId}</span>. We will WhatsApp you on <strong className="font-semibold">{formData.contactPhone}</strong> with a draft.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="tm-label">Property name *</label>
                  <input type="text" required placeholder="e.g. Chembe Beach Chalets" value={formData.propName}
                    onChange={e => setFormData({ ...formData, propName: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">Location / beach / town *</label>
                  <input type="text" required placeholder="e.g. Cape Maclear, Lake Malawi" value={formData.propLoc}
                    onChange={e => setFormData({ ...formData, propLoc: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">Your name</label>
                  <input type="text" placeholder="Manager or host" value={formData.contactName}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">WhatsApp number *</label>
                  <input type="tel" required placeholder="Include country code" value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">Room types</label>
                  <input type="text" placeholder="e.g. 2 double lakeview rooms, 1 cottage" value={formData.roomTypes}
                    onChange={e => setFormData({ ...formData, roomTypes: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="tm-label">Key amenities</label>
                  <input type="text" placeholder="e.g. Solar power, hot showers, Wi-Fi" value={formData.amenities}
                    onChange={e => setFormData({ ...formData, amenities: e.target.value })} className="tm-input" />
                </div>
              </div>
              <div className="tm-actions justify-between">
                <span className="tm-muted">Free · 0% commission</span>
                <button type="submit" disabled={submitting} className="tm-btn tm-btn-primary">
                  <Send size={16} />
                  {submitting ? 'Sending…' : 'Send details'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
