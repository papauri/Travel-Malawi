import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Printer, Download, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';
import { downloadDocHtml } from '../lib/downloadDoc';
import { usePlatformMode } from '../contexts/PlatformModeContext';

export default function MarketingDeck() {
  const { bookingsEnabled } = usePlatformMode();
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'marketing-presentation',
    bookingsEnabled ? 'Direct booking for Malawi' : "A directory of Malawi's independent stays",
    bookingsEnabled
      ? 'Take bookings directly, keep your revenue and talk to your guests.'
      : 'Get found by travellers planning a trip in Malawi. They contact you directly.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    partnerName: '',
    partnerType: 'lodge',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: ''
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Commercial Strategy & Partner Deck: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => downloadDocHtml('marketing-presentation', 'travel_malawi_commercial_strategy.html', 'Downloaded strategy deck (.html)');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partnerName.trim() || (!formData.contactPhone.trim() && !formData.contactEmail.trim())) {
      toast.error('Please enter your organisation name and contact info.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: 'partner_inquiry',
        sourceDoc: 'Commercial Strategy Deck',
        propName: formData.partnerName,
        propLoc: formData.partnerType,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
        notes: `Partnership type: ${formData.partnerType}. Inquiries: ${formData.notes}`,
        pilotInterest: 'yes'
      };

      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const refId = data.id || `partner-${Date.now()}`;

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
      toast.success('Zikomo! Your partnership inquiry has been received.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const secondaryBtn = 'tm-btn tm-btn-secondary tm-btn-sm';
  const primaryBtn = 'tm-btn tm-btn-primary';
  const inputCls = 'tm-input';
  const labelCls = 'tm-label';
  const th = 'bg-stone-50 text-left font-medium text-stone-900 px-3 py-2';
  const td = 'px-3 py-2 border-t border-stone-200 text-stone-700 align-top';

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <div className="tm-page max-w-3xl py-10 print:py-0">

        {/* Toolbar (hidden when printing) */}
        <div className="tm-actions justify-between mb-8 print:hidden">
          <Link to="/list-your-property" className={secondaryBtn} title="Return to Partner Hub">
            <ArrowLeft size={16} />
            <span>Partner Hub</span>
          </Link>
          <div className="tm-actions">
            <DocQuickEditButton docId="marketing-presentation" onSaved={() => refreshDoc()} />
            <button onClick={handleShareWhatsApp} className={secondaryBtn}>
              <MessageSquare size={16} />
              <span>Share on WhatsApp</span>
            </button>
            <button onClick={handlePrint} className={secondaryBtn}>
              <Printer size={16} />
              <span>Print / PDF</span>
            </button>
            <button onClick={handleDownload} className={secondaryBtn}>
              <Download size={16} />
              <span>HTML</span>
            </button>
            <button onClick={handleCopyLink} className={secondaryBtn} title="Copy link">
              {copiedLink ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        {/* Header */}
        <header className="border-b border-stone-200 pb-6 mb-8">
          <p className="tm-muted">Travel Malawi &middot; Partner overview</p>
          <h1 className="tm-h1 mt-2">{customTitle}</h1>
          <p className="tm-lead mt-2">{customSubtitle}</p>
          {(isCustomized || lastEditedBy) && (
            <p className="mt-3 text-sm text-stone-500">
              {isCustomized && 'Customised edition'}
              {isCustomized && lastEditedBy && ' · '}
              {lastEditedBy && `Maintained by ${lastEditedBy}`}
            </p>
          )}
        </header>

        {bookingsEnabled ? (
          <>
        {/* Section 1 */}
        <section>
          <h2 className="tm-h2 mt-10">1. What lodges lose to booking-site fees</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-700">
            Every year, Malawian lodges surrender <strong className="font-semibold text-stone-900">15% to 25% of their gross revenue</strong> to European online travel agencies (OTAs) simply to host guests who are:
          </p>
          <ul className="mt-5 space-y-4">
            <li>
              <h3 className="text-base font-semibold text-stone-900">Case A: The Lilongwe Resident</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
                A diplomat or NGO professional driving 3 hours from Area 10 for a weekend on the lake.
              </p>
            </li>
            <li>
              <h3 className="text-base font-semibold text-stone-900">Case B: The Blantyre Corporate</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
                A business executive traveling to Salima or Mangochi for a quarterly offsite.
              </p>
            </li>
            <li>
              <h3 className="text-base font-semibold text-stone-900">Case C: The International Eco-Traveler</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
                A safari traveler who discovered the lodge online and wanted a direct way to book without getting lost.
              </p>
            </li>
          </ul>
          <div className="mt-6 tm-panel text-[15px] leading-relaxed text-stone-700">
            <strong className="font-semibold text-stone-900">The Cold Math: </strong>
            A 10-room lodge charging MK 90,000/night with 50% occupancy surrenders <strong className="font-semibold text-stone-900">MK 24,600,000 to MK 41,000,000 every single year</strong> in commission fees to overseas corporations that provide zero customer service in Malawi. Travel Malawi keeps 100% of that revenue in the lodge owner&apos;s hands.
          </div>
        </section>

        {/* Section 2 */}
        <section className="tm-divider mt-10">
          <h2 className="tm-h2 mt-10">2. How the options compare</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border border-stone-200">
              <thead>
                <tr>
                  <th className={th}>What matters</th>
                  <th className={th}>Overseas booking sites</th>
                  <th className={th}>Direct WhatsApp Only</th>
                  <th className={th}>Travel Malawi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Commission Cut</td>
                  <td className={td}>15% to 25% deducted</td>
                  <td className={td}>0%</td>
                  <td className={`${td} font-medium text-stone-900`}>0%</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Payout Settlement</td>
                  <td className={td}>30–60 days via overseas bank</td>
                  <td className={td}>Cash on arrival (High no-shows)</td>
                  <td className={`${td} font-medium text-stone-900`}>Instant MWK (Airtel/Mpamba/Banks)</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Guest Communication</td>
                  <td className={td}>Masked emails; numbers blocked</td>
                  <td className={td}>Unstructured, manual messaging</td>
                  <td className={`${td} font-medium text-stone-900`}>Direct WhatsApp with booking voucher</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Navigation &amp; Arrival</td>
                  <td className={td}>Fails when cell reception drops</td>
                  <td className={td}>Vague text directions</td>
                  <td className={`${td} font-medium text-stone-900`}>Cached Offline Satellite GPS &amp; Gate Pin</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Calendar Synchronization</td>
                  <td className={td}>Stays on their platform</td>
                  <td className={td}>Manual diary (Double-booking risk)</td>
                  <td className={`${td} font-medium text-stone-900`}>2-Way iCal Sync (RoomRaccoon, Airbnb) + Live Latency Diagnostics</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Host Onboarding &amp; Support</td>
                  <td className={td}>Overseas ticketing queue</td>
                  <td className={td}>Zero assistance</td>
                  <td className={`${td} font-medium text-stone-900`}>Concierge Shadow Mode &amp; Local Phone Support</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 */}
        <section className="tm-divider mt-10">
          <h2 className="tm-h2 mt-10">3. Keep your other channels</h2>
          <h3 className="mt-4 text-base font-semibold text-stone-900">
            &ldquo;We never ask a lodge to leave Booking.com.&rdquo;
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-700">
            Asking a lodge manager to drop their existing channels triggers loss aversion. Instead, we say:
          </p>
          <blockquote className="mt-4 tm-panel text-[15px] leading-relaxed text-stone-700">
            &ldquo;Keep your international OTA listing active for whatever foreign travelers it catches. But list your rooms on Travel Malawi to capture your domestic and regional weekend guests at 0% commission. Why give away 20% to Amsterdam when a guest is driving from Area 43?&rdquo;
          </blockquote>
        </section>

          </>
        ) : (
          <>
        {/* Section 1 */}
        <section>
          <h2 className="tm-h2 mt-10">1. Who is looking for your stay</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-700">
            Travel Malawi is an information directory of independent places to stay. It helps travellers who are:
          </p>
          <ul className="mt-5 space-y-4">
            <li>
              <h3 className="text-base font-semibold text-stone-900">Case A: The Lilongwe Resident</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
                A diplomat or NGO professional driving 3 hours from Area 10 for a weekend on the lake.
              </p>
            </li>
            <li>
              <h3 className="text-base font-semibold text-stone-900">Case B: The Blantyre Corporate</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
                A business executive planning a quarterly offsite in Salima or Mangochi.
              </p>
            </li>
            <li>
              <h3 className="text-base font-semibold text-stone-900">Case C: The International Eco-Traveller</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
                A safari traveller who wants clear photos, rates, directions and a way to reach the lodge directly.
              </p>
            </li>
          </ul>
          <div className="mt-6 tm-panel text-[15px] leading-relaxed text-stone-700">
            <strong className="font-semibold text-stone-900">How it works: </strong>
            Your listing shows your rooms, indicative rates, menu, map pin and your own phone, WhatsApp and email. Travellers contact you directly and you agree dates, prices and payment with them. Travel Malawi does not take bookings or payments and charges no commission or listing fee.
          </div>
        </section>

        {/* Section 2 */}
        <section className="tm-divider mt-10">
          <h2 className="tm-h2 mt-10">2. How the options compare</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border border-stone-200">
              <thead>
                <tr>
                  <th className={th}>What matters</th>
                  <th className={th}>Overseas travel sites</th>
                  <th className={th}>Word of mouth only</th>
                  <th className={th}>Travel Malawi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Cost to the property</td>
                  <td className={td}>15% to 25% deducted</td>
                  <td className={td}>Free</td>
                  <td className={`${td} font-medium text-stone-900`}>Free: no commission, no listing fee</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>How travellers reach you</td>
                  <td className={td}>Masked emails; numbers hidden</td>
                  <td className={td}>Only people who already know you</td>
                  <td className={`${td} font-medium text-stone-900`}>Your own phone, WhatsApp and email on your listing</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Navigation &amp; Arrival</td>
                  <td className={td}>Fails when cell reception drops</td>
                  <td className={td}>Vague text directions</td>
                  <td className={`${td} font-medium text-stone-900`}>Cached Offline Satellite GPS &amp; Gate Pin</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-stone-900`}>Host Onboarding &amp; Support</td>
                  <td className={td}>Overseas ticketing queue</td>
                  <td className={td}>Zero assistance</td>
                  <td className={`${td} font-medium text-stone-900`}>Help setting up your listing &amp; Local Phone Support</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 */}
        <section className="tm-divider mt-10">
          <h2 className="tm-h2 mt-10">3. Keep your other channels</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-700">
            A Travel Malawi listing sits alongside whatever you already use. Keep your other listings and your own regulars; a directory listing simply helps domestic and regional travellers find you and contact you directly.
          </p>
        </section>

          </>
        )}

        {/* Section 4: Partnership form */}
        <section id="partner-form" className="tm-divider mt-10">
          <h2 className="tm-h2 mt-10">4. Become a partner</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-700">
            Tell us who you are and we will get back to you.
          </p>

          {submitted ? (
            <div className="mt-6 tm-panel">
              <h3 className="text-base font-semibold text-stone-900">
                Zikomo, we have your request
              </h3>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">
                Reference: <span className="font-mono text-stone-900">{submissionId}</span>. Our partnerships lead will contact you within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Organisation or property name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nyika Lodges Group, Chembe Cottages"
                    value={formData.partnerName}
                    onChange={e => setFormData({ ...formData, partnerName: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Type of partner</label>
                  <select
                    value={formData.partnerType}
                    onChange={e => setFormData({ ...formData, partnerType: e.target.value })}
                    className={inputCls}
                  >
                    <option value="lodge">Independent Lodge / Cottage</option>
                    <option value="hotel_group">Hotel Group / Resort Chain</option>
                    <option value="safari_tour">Safari / Tour Operator</option>
                    <option value="corporate">Corporate / NGO Travel Desk</option>
                    <option value="investor">Ecosystem / Strategic Investor</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Contact name</label>
                  <input
                    type="text"
                    placeholder="e.g. Grace Banda"
                    value={formData.contactName}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>WhatsApp or phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Your WhatsApp number"
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>What would you like to do?</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Listing 5 properties in Lake Malawi region, group stays for Lilongwe staff"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm text-stone-500">
                  Kept confidential
                </span>
                <button type="submit" disabled={submitting} className={primaryBtn}>
                  {submitting ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
