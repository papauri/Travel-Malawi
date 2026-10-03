import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, CheckCircle2, ArrowLeft, Smartphone, MessageSquare, 
  MapPin, Printer, ShieldCheck, 
  Send, Share2, Download, Copy, Check, Target, Users, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

export default function OperationsStarterPack() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'operations-starter-pack',
    'Host Acquisition, Objection Disarming & Quality Control',
    'A battle-tested field playbook for ground operations, onboarding scouts, and concierge agents. Removes host hesitation, disarms legacy OTA dependency, and guarantees high quality standards across every listing.'
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

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/docs/operations-starter-pack?format=html&download=1';
    link.download = 'travel_malawi_operations_playbook.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded operations playbook (.html)');
  };

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
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded">
              Field Operations
            </span>
            <div className="text-xs font-bold text-stone-900 truncate">
              Operations &amp; Field Conversion Playbook
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
          <DocQuickEditButton 
            docId="operations-starter-pack" 
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
              Travel Malawi &bull; Field Operations Series
            </span>
            <span className="text-xs font-mono text-stone-600">
              Operational Standard 2026
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

        {/* Section 1: The Principle of Zero Inertia */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">1</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The Golden Rule: The Principle of Zero Inertia
            </h2>
          </div>

          <p className="text-sm text-stone-700 leading-relaxed">
            Lodge owners and general managers in Malawi are chronically busy with generator fuel, seasonal lake road repairs, and kitchen supplies. <strong>Any request that feels like administrative work will be postponed indefinitely.</strong>
          </p>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">The Field Mandate</h3>
            <p className="text-sm font-semibold text-stone-900">
              Never ask a host to &ldquo;sign up,&rdquo; &ldquo;fill out a form,&rdquo; or &ldquo;learn a system.&rdquo;
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              Instead, make the entry barrier zero: <em>&ldquo;Send us 3 photos and your rate card on WhatsApp. Our concierge team formats your verified digital storefront in 8 minutes for free.&rdquo;</em>
            </p>
          </div>
        </section>

        {/* Section 2: 3-Touch WhatsApp Sequence */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">2</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              The 3-Touch WhatsApp Conversion Cadence
            </h2>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                Touch 1 (Day 1): The Sincere Compliment + Provocative Question
              </span>
              <p className="text-xs font-mono bg-stone-50 p-3 rounded-lg text-stone-800 leading-relaxed">
                &ldquo;Muli bwanji [Manager Name]! We&apos;ve been admiring the stunning lakefront cottages at [Property Name]. Quick question: on your weekend bookings from Lilongwe and Blantyre, are you still paying foreign booking websites 18% to 22% in commission?&rdquo;
              </p>
              <p className="text-[11px] text-stone-600 italic">
                Psychology: Opens a conversational loop without being aggressive. Reminds them of the commission deduction.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                Touch 2 (Day 2): The Zero-Inertia Value Demo
              </span>
              <p className="text-xs font-mono bg-stone-50 p-3 rounded-lg text-stone-800 leading-relaxed">
                &ldquo;We put together a private preview of what [Property Name] looks like on Travel Malawi with direct Airtel Money/Mpamba settlement and 0% commission. Guests chat directly to your WhatsApp line. Would you like us to activate this for your lodge?&rdquo;
              </p>
              <p className="text-[11px] text-stone-600 italic">
                Psychology: Endowment effect. The work is already done; they feel natural pride in the result.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                Touch 3 (Day 3): The Founding Host Scarcity Close
              </span>
              <p className="text-xs font-mono bg-stone-50 p-3 rounded-lg text-stone-800 leading-relaxed">
                &ldquo;Takulandirani [Manager Name] — we are locking our inaugural Founding Host Cohort for [Region] at 10 flagship properties this Friday (0% commission forever + free verified profiling). We have 2 slots remaining in your zone and wanted to offer you first right of refusal before opening to others.&rdquo;
              </p>
              <p className="text-[11px] text-stone-600 italic">
                Psychology: Loss aversion and prestige. No reputable lodge wants to be left out of the national directory.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Disarming the 4 Objections */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs flex items-center justify-center font-bold">3</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
              Disarming the 4 Host Objections
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-mono uppercase tracking-wider">
                  <th className="py-2.5 px-3">Host Objection</th>
                  <th className="py-2.5 px-3">Underlying Fear</th>
                  <th className="py-2.5 px-3">Cunning Turnaround Script</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">&ldquo;We already use Booking.com.&rdquo;</td>
                  <td className="py-3 px-3 text-stone-500 italic">Fear of losing foreign traffic.</td>
                  <td className="py-3 px-3">&ldquo;Keep it! We don&apos;t want you to leave it. We simply capture your domestic and regional travelers at 0% commission. Why pay 20% on a guest driving from Lilongwe?&rdquo;</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">&ldquo;I don&apos;t have time for another app.&rdquo;</td>
                  <td className="py-3 px-3 text-stone-500 italic">Fear of operational complexity.</td>
                  <td className="py-3 px-3">&ldquo;You will never log into an app. Guest inquiries land straight in your WhatsApp with room, dates, and total calculated. You confirm with one tap.&rdquo;</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">&ldquo;Why is it free? What is the catch?&rdquo;</td>
                  <td className="py-3 px-3 text-stone-500 italic">Suspicion of hidden future fees.</td>
                  <td className="py-3 px-3">&ldquo;No catch. We are partnering with 10 flagship stays per region to build the national network. We monetize optional corporate marketing packages later, never your baseline bookings.&rdquo;</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-stone-900">&ldquo;We only take cash on arrival.&rdquo;</td>
                  <td className="py-3 px-3 text-stone-500 italic">Fear of banking issues.</td>
                  <td className="py-3 px-3">&ldquo;You can keep doing that! We also enable guests to send deposits to your Airtel Money or Mpamba so you eliminate last-minute weekend no-shows.&rdquo;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: SUBMIT BACK TO US (Field Scout Form) */}
        <section id="scout-form" className="pt-6 border-t border-stone-200 space-y-6">
          <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-stone-800 text-stone-200 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Field Scout &amp; Property Lead Submission</span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Log a New Lodge Lead or Field Observation
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
                Met a lodge manager or identified a promising cottage along the lake? Enter their contact info below to dispatch the concierge onboarding sequence.
              </p>
            </div>

            {submitted ? (
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Field Lead Logged Successfully
                </h3>
                <p className="text-xs text-stone-300 max-w-md mx-auto">
                  Reference: <span className="font-mono text-amber-300 font-bold">{submissionId}</span>. The record is now visible in the Admin Hub for immediate onboarding dispatch.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Target Lodge / Cottage Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mufasa Eco Lodge, Cape Maclear"
                      value={formData.targetStay}
                      onChange={e => setFormData({ ...formData, targetStay: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Region / Area
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nkhata Bay, Senga Bay, Liwonde"
                      value={formData.targetLocation}
                      onChange={e => setFormData({ ...formData, targetLocation: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Scout / Field Officer Name
                    </label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={formData.scoutName}
                      onChange={e => setFormData({ ...formData, scoutName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Host WhatsApp / Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+265 99 123 4567"
                      value={formData.scoutPhone}
                      onChange={e => setFormData({ ...formData, scoutPhone: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Field Notes &amp; Current Status
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Owner expressed interest; currently frustrated with Booking.com 20% fee; has 6 chalets on beach"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-[11px] text-stone-400">
                    &bull; Real-time sync with Admin Hub &bull; Automatic WhatsApp dispatch ready
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-900 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting…' : 'Submit Field Observation'}</span>
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
