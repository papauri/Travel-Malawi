import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, CheckCircle2, ArrowLeft, Smartphone, MessageSquare, 
  DollarSign, MapPin, Camera, Copy, Check, Printer, ShieldCheck, 
  Send, Share2, Download, ExternalLink, Sparkles
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
              Host Toolkit
            </span>
            <div className="text-xs font-bold text-stone-900 truncate">
              Host Onboarding Starter Pack
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
          <DocQuickEditButton 
            docId="host-onboarding-pack" 
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
              Travel Malawi &bull; Partner Operations Series
            </span>
            <span className="text-xs font-mono text-stone-600">
              Revised Edition 2026
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-100 text-xs">
            <div>
              <span className="text-stone-600 block">Commission</span>
              <strong className="text-stone-900 text-sm">0% Direct</strong>
            </div>
            <div>
              <span className="text-stone-600 block">Payout Speed</span>
              <strong className="text-stone-900 text-sm">Instant to You</strong>
            </div>
            <div>
              <span className="text-stone-600 block">Payout Rails</span>
              <strong className="text-stone-900 text-sm">Airtel / Mpamba / Bank</strong>
            </div>
            <div>
              <span className="text-stone-600 block">Setup Time</span>
              <strong className="text-stone-900 text-sm">Under 8 Minutes</strong>
            </div>
          </div>
        </header>

        {/* Section 1: The Psychological Anchor */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">1</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The Psychological Anchor: The Velvet Storefront
            </h2>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            Travelers in 2026 do not buy "rooms." They buy <strong>sanctuary, status, and clean arrival</strong>.
          </p>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-stone-900">The 4-Second First Impression</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              When a traveler lands on your listing, they make an emotional decision within 4 seconds. If the photos are dark, rates unclear, or WhatsApp replies delayed, they drop off and book a commercial chain hotel in town. With clean photos, honest pricing, and direct WhatsApp contact, you immediately outperform 90% of regional competitors.
            </p>
          </div>
        </section>

        {/* Section 2: The 4 Golden Photos */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">2</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The 4 Photos That Win the Booking
            </h2>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            You do not need an expensive camera crew. Any smartphone taken in morning natural light with a wiped clean lens works best.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                1. The Bed (The Sleep Shot)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Clean, crisp linens in daylight</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Smooth sheets, pillows fluffed, natural side window light. Dissolves the guest&apos;s #1 hidden worry: <em>&ldquo;Will I sleep comfortably without noise or dust?&rdquo;</em>
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                2. The View (The Aspiration Shot)
              </span>
              <h3 className="text-sm font-bold text-stone-900">The horizon from your patio or balcony</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Lake Malawi&apos;s blue waters, Mulanje&apos;s granite peaks, or a lush garden. This is the photo guests screenshot to send to their friends: <em>&ldquo;Look where we are going!&rdquo;</em>
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                3. The Bathroom (The Hygiene Shot)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Spotless shower, mirror, and dry floor</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Clean white tiles, folded towel, bright shower. Removes unspoken traveler hesitation and seals high-value bookings.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                4. The Gathering Spot (The Connection Shot)
              </span>
              <h3 className="text-sm font-bold text-stone-900">Boma firepit, patio dining, or fresh lake fish</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Shows where the guest will unwind with a cold drink after a long drive. Reassures them that food and relaxation are ready.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Dual Pricing & Anchoring */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">3</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The Psychology of Dual Pricing &amp; Anchoring
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-stone-200 bg-white space-y-2">
              <h3 className="text-sm font-bold text-stone-900">1. Clean Malawian Kwacha (MWK)</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Always round cleanly to the nearest 1,000 MWK (e.g. <strong>MK 85,000</strong> or <strong>MK 120,000</strong>). Never use awkward figures like MK 84,350 that look like automated algorithm taxes.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-stone-200 bg-white space-y-2">
              <h3 className="text-sm font-bold text-stone-900">2. Clean US Dollars (USD)</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Round to whole dollars or the nearest $5 ($60, $75, $90, $120). International travelers and NGO consultants appreciate clear, predictable pricing.
              </p>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs text-stone-700 leading-relaxed">
            <strong className="text-stone-900">The Premium Anchor Rule:</strong> Always list your best room or executive suite first (e.g. <em>Executive Lake Chalet</em> at MK 165,000). When travelers see that first, their brain adopts it as the benchmark. Your <em>Garden Cottage</em> at MK 75,000 immediately feels like an irresistible bargain.
          </div>
        </section>

        {/* Section 4: Ready-to-Use WhatsApp Templates */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">4</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              Copy-and-Paste WhatsApp Guest Templates
            </h2>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            Keep your communications sharp and professional. Tap any template below to copy it instantly:
          </p>

          <div className="space-y-4">
            {/* Template A: Booking Confirmation */}
            <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900">Template 1: Instant Booking Confirmation</span>
                <button
                  onClick={() => copyTemplate(
                    "Muli bwanji [Guest Name]! Thank you for choosing [Property Name]. Your stay is provisionally reserved for [Check-in Date] to [Check-out Date] in our [Room Type]. Total: MK [Amount]. To confirm your dates, please transfer the 50% deposit via Airtel Money/Mpamba to [Phone Number] or Bank [Account]. Let us know once sent so we hold your room!",
                    't1'
                  )}
                  className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedTemplate === 't1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTemplate === 't1' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs font-mono bg-white p-3.5 rounded-xl border border-stone-200 text-stone-700 leading-relaxed">
                &ldquo;Muli bwanji [Guest Name]! Thank you for choosing [Property Name]. Your stay is provisionally reserved for [Check-in Date] to [Check-out Date] in our [Room Type]. Total: MK [Amount]. To confirm your dates, please transfer the 50% deposit via Airtel Money/Mpamba to [Phone Number] or Bank [Account]. Let us know once sent so we hold your room!&rdquo;
              </p>
            </div>

            {/* Template B: Directions & Arrival */}
            <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900">Template 2: Road Directions &amp; Gate Pin</span>
                <button
                  onClick={() => copyTemplate(
                    "Muli bwanji [Guest Name]! Looking forward to welcoming you today at [Property Name]. When traveling down the M5 / Lakeshore Road, turn off at [Landmark]. Follow our marked signs for 3.5 km. Gate GPS pin: [Google Maps / GPS link]. Our manager [Manager Name] is on standby at [Phone Number] if you need guidance!",
                    't2'
                  )}
                  className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedTemplate === 't2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTemplate === 't2' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs font-mono bg-white p-3.5 rounded-xl border border-stone-200 text-stone-700 leading-relaxed">
                &ldquo;Muli bwanji [Guest Name]! Looking forward to welcoming you today at [Property Name]. When traveling down the M5 / Lakeshore Road, turn off at [Landmark]. Follow our marked signs for 3.5 km. Gate GPS pin: [Google Maps / GPS link]. Our manager [Manager Name] is on standby at [Phone Number] if you need guidance!&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: SUBMIT BACK TO US (Interactive Form) */}
        <section id="onboarding-form" className="pt-6 border-t border-stone-200 space-y-6">
          <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-stone-800 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fast-Track Listing &bull; Zero Commission</span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Submit Your Property for Instant Listing
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
                Fill out the 4 details below. Our hospitality operations team will review your stay, configure your direct booking storefront, and reach out on WhatsApp in under 24 hours.
              </p>
            </div>

            {submitted ? (
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Takulandirani! We Have Received Your Property Details
                </h3>
                <p className="text-xs text-stone-300 max-w-md mx-auto">
                  Reference: <span className="font-mono text-amber-300 font-bold">{submissionId}</span>. Our concierge team will reach out to you on WhatsApp at <strong>{formData.contactPhone}</strong> to confirm your photos and activate your 0% commission listing.
                </p>
                <div className="pt-2">
                  <a
                    href={`https://api.whatsapp.com/send?phone=265999000000&text=Muli%20bwanji!%20I%20just%20submitted%20my%20property%20${encodeURIComponent(formData.propName)}%20(Ref:%20${submissionId})`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ping Concierge on WhatsApp</span>
                  </a>
                </div>
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
                      placeholder="e.g. Sunbird Livingstonia, Chembe Lake Chalets"
                      value={formData.propName}
                      onChange={e => setFormData({ ...formData, propName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Location / Region *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cape Maclear, Mangochi, Lilongwe Area 10"
                      value={formData.propLoc}
                      onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Host / Manager Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Patrick Chirwa"
                      value={formData.contactName}
                      onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Host WhatsApp / Phone *
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
                      Room Types / Units Available
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4 Lakeview Chalets, 2 Family Cottages"
                      value={formData.roomTypes}
                      onChange={e => setFormData({ ...formData, roomTypes: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Starting Nightly Rate
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                        className="bg-stone-800 border border-stone-700 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="MWK">MWK</option>
                        <option value="USD">USD</option>
                      </select>
                      <input
                        type="text"
                        placeholder="e.g. 75,000 or 60"
                        value={formData.startingRate}
                        onChange={e => setFormData({ ...formData, startingRate: e.target.value })}
                        className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Special Features or Host Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Solar power backup, private beach, borehole water, boat tours available"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-[11px] text-stone-400">
                    &bull; Zero commission forever &bull; Direct WhatsApp inquiries &bull; Free profile creation
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-900 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting…' : 'Submit Property for Listing'}</span>
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
