import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, CheckCircle2, ArrowLeft, Smartphone, MessageSquare, 
  DollarSign, MapPin, Printer, ShieldCheck, 
  Send, Share2, Download, Copy, Check, TrendingUp, Target, Users, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

export default function MarketingDeck() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'marketing-presentation',
    'The Sovereign Direct Booking Rail for Malawi',
    'Eliminating middleman extraction, unlocking domestic liquidity, and returning pricing sovereignty to independent Malawian lodges and safari camps.'
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

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/docs/marketing-presentation?format=html&download=1';
    link.download = 'travel_malawi_commercial_strategy.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded strategy deck (.html)');
  };

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
            <span className="hidden sm:inline">Partner Hub</span>
          </Link>
          <div className="h-4 w-px bg-stone-200 hidden sm:block" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-800 bg-stone-100 px-2 py-0.5 rounded">
              Commercial Strategy
            </span>
            <div className="text-xs font-bold text-stone-900 truncate">
              Executive Strategy &amp; Market Positioning Deck
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
          <DocQuickEditButton 
            docId="marketing-presentation" 
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
              Travel Malawi &bull; Commercial Deck
            </span>
            <span className="text-xs font-mono text-stone-600">
              Partner Edition 2026
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

        {/* Section 1: The Leaking Bucket */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">1</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The Market Absurdity: The Leaking Bucket
            </h2>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            Every year, Malawian lodges surrender <strong>15% to 25% of their gross revenue</strong> to European online travel agencies (OTAs) simply to host guests who are:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Case A</span>
              <h3 className="text-xs font-bold text-stone-900">The Lilongwe Resident</h3>
              <p className="text-xs text-stone-600">
                A diplomat or NGO professional driving 3 hours from Area 10 for a weekend on the lake.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Case B</span>
              <h3 className="text-xs font-bold text-stone-900">The Blantyre Corporate</h3>
              <p className="text-xs text-stone-600">
                A business executive traveling to Salima or Mangochi for a quarterly offsite.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Case C</span>
              <h3 className="text-xs font-bold text-stone-900">The International Eco-Traveler</h3>
              <p className="text-xs text-stone-600">
                A safari traveler who discovered the lodge online and wanted a direct way to book without getting lost.
              </p>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-xs text-amber-950 leading-relaxed space-y-1.5">
            <strong className="block text-sm font-bold text-amber-900">The Cold Math:</strong>
            <p>
              A 10-room lodge charging MK 90,000/night with 50% occupancy surrenders <strong>MK 8,100,000 to MK 13,500,000 every single year</strong> in commission fees to overseas corporations that provide zero customer service in Malawi. Travel Malawi keeps 100% of that revenue in the lodge owner&apos;s hands.
            </p>
          </div>
        </section>

        {/* Section 2: Competitive Comparison */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">2</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              Competitive Leverage Matrix
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-mono uppercase tracking-wider">
                  <th className="py-3 px-3">Friction Point</th>
                  <th className="py-3 px-3">Legacy European OTAs</th>
                  <th className="py-3 px-3">Direct WhatsApp Only</th>
                  <th className="py-3 px-3 bg-stone-100/70 font-bold text-stone-900 rounded-t-lg">Travel Malawi Rail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">Commission Cut</td>
                  <td className="py-3 px-3 text-red-600">15% to 25% deducted</td>
                  <td className="py-3 px-3">0%</td>
                  <td className="py-3 px-3 bg-stone-50 font-bold text-emerald-800">0% Guaranteed</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">Payout Settlement</td>
                  <td className="py-3 px-3 text-stone-500">30–60 days via overseas bank</td>
                  <td className="py-3 px-3 text-stone-500">Cash on arrival (High no-shows)</td>
                  <td className="py-3 px-3 bg-stone-50 font-bold text-emerald-800">Instant MWK (Airtel/Mpamba/Banks)</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">Guest Communication</td>
                  <td className="py-3 px-3 text-stone-500">Masked emails; numbers blocked</td>
                  <td className="py-3 px-3 text-stone-500">Unstructured, manual messaging</td>
                  <td className="py-3 px-3 bg-stone-50 font-bold text-stone-900">Direct WhatsApp with booking voucher</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">Navigation &amp; Arrival</td>
                  <td className="py-3 px-3 text-stone-500">Fails when cell reception drops</td>
                  <td className="py-3 px-3 text-stone-500">Vague text directions</td>
                  <td className="py-3 px-3 bg-stone-50 font-bold text-stone-900">Cached Offline Satellite GPS &amp; Gate Pin</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: The Trojan Horse Strategy */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">3</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The Trojan Horse Strategy: Zero Friction Adoption
            </h2>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-stone-900">
              &ldquo;We never ask a lodge to leave Booking.com.&rdquo;
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Asking a lodge manager to drop their existing channels triggers loss aversion. Instead, we say:
            </p>
            <blockquote className="border-l-2 border-stone-900 pl-4 py-1 text-xs sm:text-sm font-serif italic text-stone-800">
              &ldquo;Keep your international OTA listing active for whatever foreign travelers it catches. But list your rooms on Travel Malawi to capture your domestic and regional weekend guests at 0% commission. Why give away 20% to Amsterdam when a guest is driving from Area 43?&rdquo;
            </blockquote>
          </div>
        </section>

        {/* Section 4: SUBMIT BACK TO US (Partnership Form) */}
        <section id="partner-form" className="pt-6 border-t border-stone-200 space-y-6">
          <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-stone-800 text-stone-200 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Commercial &amp; Partnership Inquiry</span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Register as a Strategic Partner
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
                Whether you manage a lodge portfolio, corporate travel account, or safari transport fleet, let our team tailor a direct integration.
              </p>
            </div>

            {submitted ? (
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Zikomo! We Have Received Your Partnership Request
                </h3>
                <p className="text-xs text-stone-300 max-w-md mx-auto">
                  Reference: <span className="font-mono text-amber-300 font-bold">{submissionId}</span>. Our executive partnerships lead will contact you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Organisation / Property Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nyika Lodges Group, Chembe Cottages"
                      value={formData.partnerName}
                      onChange={e => setFormData({ ...formData, partnerName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Partnership Category
                    </label>
                    <select
                      value={formData.partnerType}
                      onChange={e => setFormData({ ...formData, partnerType: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-stone-500"
                    >
                      <option value="lodge">Independent Lodge / Cottage</option>
                      <option value="hotel_group">Hotel Group / Resort Chain</option>
                      <option value="safari_tour">Safari / Tour Operator</option>
                      <option value="corporate">Corporate / NGO Travel Desk</option>
                      <option value="investor">Ecosystem / Strategic Investor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Lead Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Grace Banda"
                      value={formData.contactName}
                      onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      WhatsApp / Phone *
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
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Partnership Goals / Strategic Inquiries
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Listing 5 properties in Lake Malawi region, bulk corporate bookings for Lilongwe staff"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-[11px] text-stone-400">
                    &bull; Strict confidentiality &bull; Fast executive turnaround &bull; National Malawi coverage
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-900 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting…' : 'Submit Partnership Inquiry'}</span>
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
