import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, CheckCircle2, ArrowLeft, Smartphone, MessageSquare, 
  MapPin, Printer, ShieldCheck, 
  Send, Share2, Download, Copy, Check, Sparkles, BedDouble, Camera, Compass
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
    'A concise operational framework for naming rooms, showcasing local amenities, providing foolproof road directions, and setting prices that turn casual browsers into confirmed stays.'
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

  return (
    <div className="min-h-screen bg-stone-100/60 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white text-stone-900 font-sans">
      
      {/* Standardized Top Utility Bar (Hidden during print) */}
      <div className="max-w-4xl mx-auto mb-6 bg-white border border-stone-200 rounded-2xl p-4 sm:px-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link 
            to="/list-your-property" 
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition text-xs font-semibold inline-flex items-center gap-1.5"
            title="Return to Host Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Host Hub</span>
          </Link>
          <div className="h-4 w-px bg-stone-200 hidden sm:block" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
              Listing Standards
            </span>
            <div className="text-xs font-bold text-stone-900 truncate">
              Property Listing Master Guide
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
          <DocQuickEditButton 
            docId="property-listing-guide" 
            onSaved={() => refreshDoc()} 
          />

          <button
            onClick={handleShareWhatsApp}
            className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Share on WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs border border-stone-200 transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">HTML</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 transition cursor-pointer"
            title="Copy link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-600" />}
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <main className="max-w-4xl mx-auto bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-10 print:border-none print:shadow-none print:p-0">
        
        {/* Document Header */}
        <header className="border-b border-stone-200 pb-8 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-widest text-stone-600 font-semibold">
              Travel Malawi &bull; Merchandising Standards
            </span>
            <span className="text-xs font-mono text-stone-600">
              Listing Guide 2026
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight leading-tight">
                {customTitle}
              </h1>
              {isCustomized && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                  Live Customized Edition
                </span>
              )}
            </div>
            {lastEditedBy && (
              <p className="text-[11px] text-stone-500 font-mono">
                Maintained by {lastEditedBy}
              </p>
            )}
          </div>

          <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-3xl">
            {customSubtitle}
          </p>
        </header>

        {/* Section 1: The Architecture of Desire */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">1</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The Architecture of Desire: Dissolving Anxiety
            </h2>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            A mediocre listing gives specifications. A high-converting listing <strong>dissolves traveler hesitation before it arises</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Anxiety 1</span>
              <h3 className="text-xs font-bold text-stone-900">&ldquo;Will the power go off?&rdquo;</h3>
              <p className="text-xs text-stone-600">
                Specify backup: <em>&ldquo;24/7 Solar battery inverter backup with silent generator standby.&rdquo;</em>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Anxiety 2</span>
              <h3 className="text-xs font-bold text-stone-900">&ldquo;Will my car get stuck?&rdquo;</h3>
              <p className="text-xs text-stone-600">
                Give clear ground reality: <em>&ldquo;Suitable for 2WD saloon cars in dry season; 4WD recommended during Jan–March rains.&rdquo;</em>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Anxiety 3</span>
              <h3 className="text-xs font-bold text-stone-900">&ldquo;Will there be hot water?&rdquo;</h3>
              <p className="text-xs text-stone-600">
                Reassure immediately: <em>&ldquo;Pressurized solar hot showers with dedicated borehole water supply.&rdquo;</em>
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Room Naming Psychology */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">2</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              Room Naming: From Commodity to Coveted
            </h2>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            Never label rooms by numbers or generic terms. Generic names invite price haggling and degrade perceived luxury:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3">Commodity Label (Avoid)</th>
                  <th className="py-2.5 px-3 bg-stone-50 font-bold text-stone-900">Psychological Name (Use)</th>
                  <th className="py-2.5 px-3">Why It Commands 30% Higher Rates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                <tr>
                  <td className="py-3 px-3 text-stone-500 italic">Room 1 (Standard)</td>
                  <td className="py-3 px-3 bg-stone-50 font-bold text-emerald-800">Sunrise Shore Chalet</td>
                  <td className="py-3 px-3">Vividly paints the picture of dawn over Lake Malawi.</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-stone-500 italic">Double Room</td>
                  <td className="py-3 px-3 bg-stone-50 font-bold text-emerald-800">Acacia Canopy Suite</td>
                  <td className="py-3 px-3">Evokes privacy, nature, and serene bush luxury.</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-stone-500 italic">Family Unit</td>
                  <td className="py-3 px-3 bg-stone-50 font-bold text-emerald-800">Baobab Family Cottage (Self-Catering)</td>
                  <td className="py-3 px-3">Reassures parents of independence, kitchen facilities, and space.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Road & GPS Guidance */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">3</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The 3-Part Road Direction Formula
            </h2>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
            <div className="space-y-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
              <p><strong>1. The Highway Junction:</strong> <em>&ldquo;Turn off the M5 Lakeshore Road at km marker 42 (opposite Monkey Bay Post Office).&rdquo;</em></p>
              <p><strong>2. Track Condition:</strong> <em>&ldquo;Follow the graded gravel track for 3.8 km. Suitable for all standard 2WD vehicles.&rdquo;</em></p>
              <p><strong>3. Gate Landmark &amp; GPS Pin:</strong> <em>&ldquo;Look for our carved wooden boat sign on your right. Drop gate GPS coordinates so guests can navigate offline with Travel Malawi&apos;s cached satellite maps.&rdquo;</em></p>
            </div>
          </div>
        </section>

        {/* Section 4: SUBMIT BACK TO US (Listing Request) */}
        <section id="listing-form" className="pt-6 border-t border-stone-200 space-y-6">
          <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-stone-800 text-stone-200 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Express Listing Submission</span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Submit Your Property for Listing Curation
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
                Prefer our hospitality team to write your room names and format your listing? Submit your property details below for free curation.
              </p>
            </div>

            {submitted ? (
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Listing Request Logged
                </h3>
                <p className="text-xs text-stone-300 max-w-md mx-auto">
                  Reference: <span className="font-mono text-amber-300 font-bold">{submissionId}</span>. Our merchandising team will reach out on WhatsApp at <strong>{formData.contactPhone}</strong> with your listing preview draft.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Property Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chembe Beach Chalets"
                      value={formData.propName}
                      onChange={e => setFormData({ ...formData, propName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Location / Beach / Town *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cape Maclear, Lake Malawi"
                      value={formData.propLoc}
                      onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Manager / Host Name
                    </label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={formData.contactName}
                      onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      WhatsApp Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+265 99 123 4567"
                      value={formData.contactPhone}
                      onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Current Room Types
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2 Double lakeview rooms, 1 cottage"
                      value={formData.roomTypes}
                      onChange={e => setFormData({ ...formData, roomTypes: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Key Amenities
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Solar power, hot showers, Starlink Wi-Fi"
                      value={formData.amenities}
                      onChange={e => setFormData({ ...formData, amenities: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-[11px] text-stone-400">
                    &bull; 100% Free curation &bull; 0% Commission &bull; Instant WhatsApp inquiries
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-900 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting…' : 'Submit for Free Listing'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
