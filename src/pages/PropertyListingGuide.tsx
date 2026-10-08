import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Printer, Send, Download, Copy, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

export default function PropertyListingGuide() {
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

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/docs/property-listing-guide?format=html&download=1';
    link.download = 'travel_malawi_property_listing_guide.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded listing guide (.html)');
  };

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

  const inputClass =
    'w-full border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-500';
  const labelClass = 'block text-sm font-medium text-stone-700 mb-1';
  const secondaryBtn =
    'inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer';
  const primaryBtn =
    'inline-flex items-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer disabled:opacity-50';

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <main className="max-w-3xl mx-auto px-5 py-12 print:py-0">

        {/* Header */}
        <header className="border-b border-stone-200 pb-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <p className="text-sm text-stone-500">Listing standards &middot; 2026</p>
            <div className="flex items-center gap-2 flex-wrap print:hidden">
              <Link to="/list-your-property" className={secondaryBtn}>
                <ArrowLeft size={16} className="text-stone-500" />
                Host Hub
              </Link>
              <DocQuickEditButton
                docId="property-listing-guide"
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
        </header>

        <div className="text-[15px] leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900">1. The architecture of desire: dissolving anxiety</h2>
            <p className="mt-3 text-stone-700">
              A mediocre listing gives specifications. A high-converting listing <strong className="font-semibold text-stone-900">dissolves traveler hesitation before it arises</strong>.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-stone-900">&ldquo;Will the power go off?&rdquo;</h3>
                <p className="text-stone-700">
                  Specify backup: &ldquo;24/7 Solar battery inverter backup with silent generator standby.&rdquo;
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">&ldquo;Will my car get stuck?&rdquo;</h3>
                <p className="text-stone-700">
                  Give clear ground reality: &ldquo;Suitable for 2WD saloon cars in dry season; 4WD recommended during Jan–March rains.&rdquo;
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">&ldquo;Will there be hot water?&rdquo;</h3>
                <p className="text-stone-700">
                  Reassure immediately: &ldquo;Pressurized solar hot showers with dedicated borehole water supply.&rdquo;
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 mt-10">2. Room naming: from commodity to coveted</h2>
            <p className="mt-3 text-stone-700">
              Never label rooms by numbers or generic terms. Generic names invite price haggling and degrade perceived luxury:
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border border-stone-200 border-collapse">
                <thead>
                  <tr>
                    <th className="bg-stone-50 text-left font-medium text-stone-900 px-3 py-2">Commodity label (avoid)</th>
                    <th className="bg-stone-50 text-left font-medium text-stone-900 px-3 py-2">Psychological name (use)</th>
                    <th className="bg-stone-50 text-left font-medium text-stone-900 px-3 py-2">Why it commands 30% higher rates</th>
                  </tr>
                </thead>
                <tbody className="text-stone-700">
                  <tr>
                    <td className="px-3 py-2 border-t border-stone-200 text-stone-500">Room 1 (Standard)</td>
                    <td className="px-3 py-2 border-t border-stone-200 font-medium text-stone-900">Sunrise Shore Chalet</td>
                    <td className="px-3 py-2 border-t border-stone-200">Vividly paints the picture of dawn over Lake Malawi.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-t border-stone-200 text-stone-500">Double Room</td>
                    <td className="px-3 py-2 border-t border-stone-200 font-medium text-stone-900">Acacia Canopy Suite</td>
                    <td className="px-3 py-2 border-t border-stone-200">Evokes privacy, nature, and serene bush luxury.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border-t border-stone-200 text-stone-500">Family Unit</td>
                    <td className="px-3 py-2 border-t border-stone-200 font-medium text-stone-900">Baobab Family Cottage (Self-Catering)</td>
                    <td className="px-3 py-2 border-t border-stone-200">Reassures parents of independence, kitchen facilities, and space.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 mt-10">3. The 3-part road direction formula</h2>
            <ol className="mt-3 list-decimal pl-5 space-y-2 text-stone-700">
              <li><strong className="font-semibold text-stone-900">The highway junction:</strong> &ldquo;Turn off the M5 Lakeshore Road at km marker 42 (opposite Monkey Bay Post Office).&rdquo;</li>
              <li><strong className="font-semibold text-stone-900">Track condition:</strong> &ldquo;Follow the graded gravel track for 3.8 km. Suitable for all standard 2WD vehicles.&rdquo;</li>
              <li><strong className="font-semibold text-stone-900">Gate landmark &amp; GPS pin:</strong> &ldquo;Look for our carved wooden boat sign on your right. Drop gate GPS coordinates so guests can navigate offline with Travel Malawi&apos;s cached satellite maps.&rdquo;</li>
            </ol>
          </section>

          {/* Section 4: listing request form */}
          <section id="listing-form" className="mt-12 pt-8 border-t border-stone-200">
            <h2 className="text-xl font-semibold text-stone-900">Submit your property for listing curation</h2>
            <p className="mt-2 text-stone-500">
              Prefer our hospitality team to write your room names and format your listing? Submit your property details below for free curation.
            </p>

            {submitted ? (
              <div className="mt-6 bg-stone-50 border-l-2 border-stone-300 px-4 py-3">
                <p className="font-medium text-stone-900">Listing request logged</p>
                <p className="text-stone-700">
                  Reference: <span className="font-mono">{submissionId}</span>. Our merchandising team will reach out on WhatsApp at <strong className="font-semibold">{formData.contactPhone}</strong> with your listing preview draft.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Property name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chembe Beach Chalets"
                      value={formData.propName}
                      onChange={e => setFormData({ ...formData, propName: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Location / beach / town *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cape Maclear, Lake Malawi"
                      value={formData.propLoc}
                      onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Manager / host name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={formData.contactName}
                      onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>WhatsApp number *</label>
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
                    <label className={labelClass}>Current room types</label>
                    <input
                      type="text"
                      placeholder="e.g. 2 Double lakeview rooms, 1 cottage"
                      value={formData.roomTypes}
                      onChange={e => setFormData({ ...formData, roomTypes: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Key amenities</label>
                    <input
                      type="text"
                      placeholder="e.g. Solar power, hot showers, Starlink Wi-Fi"
                      value={formData.amenities}
                      onChange={e => setFormData({ ...formData, amenities: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm text-stone-500">Free curation &middot; 0% commission &middot; Direct WhatsApp inquiries</span>
                  <button type="submit" disabled={submitting} className={primaryBtn}>
                    <Send size={16} />
                    {submitting ? 'Submitting…' : 'Submit for free listing'}
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
