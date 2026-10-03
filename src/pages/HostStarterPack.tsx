import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Copy, Check, Printer, Send, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

export default function HostStarterPack() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'host-onboarding-pack',
    'Host Acquisition & Onboarding Starter Pack',
    'A practical, minimal operational guide for independent lodges, boutique hotels, lakeside cottages, and safari camps across Malawi. Built to eliminate 15%–25% commission leakage and turn casual browsers into direct bookings.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    propName: '',
    propLoc: '',
    contactName: '',
    contactPhone: '',
    roomTypes: '',
    startingRate: '',
    currency: 'MWK',
    notes: ''
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Host Onboarding Starter Pack & Toolkit: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/docs/host-onboarding-starter-pack?format=html&download=1';
    link.download = 'travel_malawi_host_starter_pack.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded starter pack (.html)');
  };

  const copyTemplate = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(id);
    toast.success('Template copied to clipboard');
    setTimeout(() => setCopiedTemplate(null), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() || !formData.contactPhone.trim()) {
      toast.error('Please enter your property name and WhatsApp number.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Submit to local server endpoint
      const payload = {
        type: 'host_onboarding',
        sourceDoc: 'Host Starter Pack',
        propName: formData.propName,
        propLoc: formData.propLoc,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        roomTypes: formData.roomTypes,
        notes: `Starting rate: ${formData.currency} ${formData.startingRate}. Notes: ${formData.notes}`,
        pilotInterest: 'yes'
      };

      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const refId = data.id || `host-${Date.now()}`;

      // 2. Also record in Firestore
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
      toast.success('Zikomo! Your onboarding request has been submitted.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-500';
  const labelClass = 'block text-sm font-medium text-stone-700 mb-1';
  const secondaryBtn =
    'inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer';
  const primaryBtn =
    'inline-flex items-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer disabled:opacity-50';

  const TEMPLATE_CONFIRMATION =
    "Muli bwanji [Guest Name]! Thank you for choosing [Property Name]. Your stay is provisionally reserved for [Check-in Date] to [Check-out Date] in our [Room Type]. Total: MK [Amount]. To confirm your dates, please transfer the 50% deposit via Airtel Money/Mpamba to [Phone Number] or Bank [Account]. Let us know once sent so we hold your room!";
  const TEMPLATE_DIRECTIONS =
    "Muli bwanji [Guest Name]! Looking forward to welcoming you today at [Property Name]. When traveling down the M5 / Lakeshore Road, turn off at [Landmark]. Follow our marked signs for 3.5 km. Gate GPS pin: [Google Maps / GPS link]. Our manager [Manager Name] is on standby at [Phone Number] if you need guidance!";

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <main className="max-w-3xl mx-auto px-5 py-12 print:py-0">

        {/* Header */}
        <header className="border-b border-stone-200 pb-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <p className="text-sm text-stone-500">Host toolkit &middot; Revised edition 2026</p>
            <div className="flex items-center gap-2 flex-wrap print:hidden">
              <Link to="/list-your-property" className={secondaryBtn}>
                <ArrowLeft size={16} className="text-stone-500" />
                Host Hub
              </Link>
              <DocQuickEditButton
                docId="host-onboarding-pack"
                onSaved={() => refreshDoc()}
              />
              <button onClick={handleShareWhatsApp} className={secondaryBtn}>
                <MessageSquare size={16} className="text-stone-500" />
                Share
              </button>
              <button onClick={handleCopyLink} className={secondaryBtn} title="Copy link">
                {copiedLink ? <Check size={16} className="text-stone-500" /> : <Copy size={16} className="text-stone-500" />}
                {copiedLink ? 'Copied' : 'Copy link'}
              </button>
              <button onClick={handleDownload} className={secondaryBtn}>
                <Download size={16} className="text-stone-500" />
                HTML
              </button>
              <button onClick={handlePrint} className={primaryBtn}>
                <Printer size={16} />
                Print / PDF
              </button>
            </div>
          </div>

          <h1 className="mt-4 text-3xl font-semibold text-stone-900">{customTitle}</h1>
          <p className="mt-2 text-stone-500">{customSubtitle}</p>
          {(isCustomized || lastEditedBy) && (
            <p className="mt-2 text-sm text-stone-500">
              {isCustomized && 'Customised edition'}
              {isCustomized && lastEditedBy && ' · '}
              {lastEditedBy && `Maintained by ${lastEditedBy}`}
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-stone-500">Commission</dt>
              <dd className="font-medium text-stone-900">0% direct</dd>
            </div>
            <div>
              <dt className="text-stone-500">Payout speed</dt>
              <dd className="font-medium text-stone-900">Instant to you</dd>
            </div>
            <div>
              <dt className="text-stone-500">Payout rails</dt>
              <dd className="font-medium text-stone-900">Airtel / Mpamba / Bank</dd>
            </div>
            <div>
              <dt className="text-stone-500">Setup time</dt>
              <dd className="font-medium text-stone-900">Under 8 minutes</dd>
            </div>
          </dl>
        </header>

        <div className="text-[15px] leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900">1. The psychological anchor: the velvet storefront</h2>
            <p className="mt-3 text-stone-700">
              Travelers in 2026 do not buy "rooms." They buy <strong className="font-semibold text-stone-900">sanctuary, status, and clean arrival</strong>.
            </p>
            <h3 className="mt-4 text-base font-semibold text-stone-900">The 4-second first impression</h3>
            <p className="text-stone-700">
              When a traveler lands on your listing, they make an emotional decision within 4 seconds. If the photos are dark, rates unclear, or WhatsApp replies delayed, they drop off and book a commercial chain hotel in town. With clean photos, honest pricing, and direct WhatsApp contact, you immediately outperform 90% of regional competitors.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 mt-10">2. The 4 photos that win the booking</h2>
            <p className="mt-3 text-stone-700">
              You do not need an expensive camera crew. Any smartphone taken in morning natural light with a wiped clean lens works best.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-stone-900">1. The bed (the sleep shot): clean, crisp linens in daylight</h3>
                <p className="text-stone-700">
                  Smooth sheets, pillows fluffed, natural side window light. Dissolves the guest&apos;s #1 hidden worry: &ldquo;Will I sleep comfortably without noise or dust?&rdquo;
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">2. The view (the aspiration shot): the horizon from your patio or balcony</h3>
                <p className="text-stone-700">
                  Lake Malawi&apos;s blue waters, Mulanje&apos;s granite peaks, or a lush garden. This is the photo guests screenshot to send to their friends: &ldquo;Look where we are going!&rdquo;
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">3. The bathroom (the hygiene shot): spotless shower, mirror, and dry floor</h3>
                <p className="text-stone-700">
                  Clean white tiles, folded towel, bright shower. Removes unspoken traveler hesitation and seals high-value bookings.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">4. The gathering spot (the connection shot): boma firepit, patio dining, or fresh lake fish</h3>
                <p className="text-stone-700">
                  Shows where the guest will unwind with a cold drink after a long drive. Reassures them that food and relaxation are ready.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 mt-10">3. The psychology of dual pricing &amp; anchoring</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-stone-900">Clean Malawian Kwacha (MWK)</h3>
                <p className="text-stone-700">
                  Always round cleanly to the nearest 1,000 MWK (e.g. MK 85,000 or MK 120,000). Never use awkward figures like MK 84,350 that look like automated algorithm taxes.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">Clean US Dollars (USD)</h3>
                <p className="text-stone-700">
                  Round to whole dollars or the nearest $5 ($60, $75, $90, $120). International travelers and NGO consultants appreciate clear, predictable pricing.
                </p>
              </div>
            </div>
            <div className="mt-4 bg-stone-50 border-l-2 border-stone-300 px-4 py-3 text-stone-700">
              <strong className="font-semibold text-stone-900">The premium anchor rule:</strong> Always list your best room or executive suite first (e.g. Executive Lake Chalet at MK 165,000). When travelers see that first, their brain adopts it as the benchmark. Your Garden Cottage at MK 75,000 immediately feels like an irresistible bargain.
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 mt-10">4. Copy-and-paste WhatsApp guest templates</h2>
            <p className="mt-3 text-stone-700">
              Keep your communications sharp and professional. Copy any template below and fill in the bracketed details.
            </p>

            <div className="mt-4 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-stone-900">Template 1: Instant booking confirmation</h3>
                  <button onClick={() => copyTemplate(TEMPLATE_CONFIRMATION, 't1')} className={`${secondaryBtn} print:hidden`}>
                    {copiedTemplate === 't1' ? <Check size={16} className="text-stone-500" /> : <Copy size={16} className="text-stone-500" />}
                    {copiedTemplate === 't1' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 bg-stone-50 border-l-2 border-stone-300 px-4 py-3 text-stone-700">
                  {TEMPLATE_CONFIRMATION}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-stone-900">Template 2: Road directions &amp; gate pin</h3>
                  <button onClick={() => copyTemplate(TEMPLATE_DIRECTIONS, 't2')} className={`${secondaryBtn} print:hidden`}>
                    {copiedTemplate === 't2' ? <Check size={16} className="text-stone-500" /> : <Copy size={16} className="text-stone-500" />}
                    {copiedTemplate === 't2' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 bg-stone-50 border-l-2 border-stone-300 px-4 py-3 text-stone-700">
                  {TEMPLATE_DIRECTIONS}
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: onboarding form */}
          <section id="onboarding-form" className="mt-12 pt-8 border-t border-stone-200">
            <h2 className="text-xl font-semibold text-stone-900">Submit your property for listing</h2>
            <p className="mt-2 text-stone-500">
              Fill out the details below. Our hospitality operations team will review your stay, configure your direct booking storefront, and reach out on WhatsApp in under 24 hours.
            </p>

            {submitted ? (
              <div className="mt-6 bg-stone-50 border-l-2 border-stone-300 px-4 py-3">
                <p className="font-medium text-stone-900">Takulandirani! We have received your property details</p>
                <p className="text-stone-700">
                  Reference: <span className="font-mono">{submissionId}</span>. Our concierge team will reach out to you on WhatsApp at <strong className="font-semibold">{formData.contactPhone}</strong> to confirm your photos and activate your 0% commission listing.
                </p>
                <a
                  href={`https://api.whatsapp.com/send?text=Muli%20bwanji!%20I%20just%20submitted%20my%20property%20${encodeURIComponent(formData.propName)}%20(Ref:%20${submissionId})`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${secondaryBtn} mt-3 bg-white`}
                >
                  <MessageSquare size={16} className="text-stone-500" />
                  Message us on WhatsApp
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Property name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sunbird Livingstonia, Chembe Lake Chalets"
                      value={formData.propName}
                      onChange={e => setFormData({ ...formData, propName: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Location / region *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cape Maclear, Mangochi, Lilongwe Area 10"
                      value={formData.propLoc}
                      onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Host / manager name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={formData.contactName}
                      onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Host WhatsApp / phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="Include country code"
                      value={formData.contactPhone}
                      onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Room types / units available</label>
                    <input
                      type="text"
                      placeholder="e.g. 4 Lakeview Chalets, 2 Family Cottages"
                      value={formData.roomTypes}
                      onChange={e => setFormData({ ...formData, roomTypes: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Starting nightly rate</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                        className="border border-stone-300 rounded-md px-2 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500"
                      >
                        <option value="MWK">MWK</option>
                        <option value="USD">USD</option>
                      </select>
                      <input
                        type="text"
                        placeholder="e.g. 75,000 or 60"
                        value={formData.startingRate}
                        onChange={e => setFormData({ ...formData, startingRate: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Special features or host notes (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Solar power backup, private beach, borehole water, boat tours available"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm text-stone-500">Zero commission &middot; Direct WhatsApp inquiries &middot; Free profile creation</span>
                  <button type="submit" disabled={submitting} className={primaryBtn}>
                    <Send size={16} />
                    {submitting ? 'Submitting…' : 'Submit property for listing'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
