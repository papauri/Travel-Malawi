import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Printer, Send, Download, Copy, Check,
  ShieldCheck, Calendar, UserCheck, CheckCircle2
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

  const inputClass =
    'w-full border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-500';
  const labelClass = 'block text-sm font-medium text-stone-700 mb-1';
  const secondaryBtn =
    'inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer';
  const primaryBtn =
    'inline-flex items-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer disabled:opacity-50';
  const th = 'bg-stone-50 text-left font-medium text-stone-900 px-3 py-2';
  const td = 'px-3 py-2 border-t border-stone-200 align-top';

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <main className="max-w-3xl mx-auto px-5 py-12 print:py-0">

        {/* Header */}
        <header className="border-b border-stone-200 pb-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <p className="text-sm text-stone-500">Field operations &middot; Operational standard 2026</p>
            <div className="flex items-center gap-2 flex-wrap print:hidden">
              <Link to="/list-your-property" className={secondaryBtn}>
                <ArrowLeft size={16} className="text-stone-500" />
                Partner Hub
              </Link>
              <DocQuickEditButton
                docId="operations-starter-pack"
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
            <h2 className="text-xl font-semibold text-stone-900">1. The golden rule: the principle of zero inertia</h2>
            <p className="mt-3 text-stone-700">
              Lodge owners and general managers in Malawi are chronically busy with generator fuel, seasonal lake road repairs, and kitchen supplies. <strong className="font-semibold text-stone-900">Any request that feels like administrative work will be postponed indefinitely.</strong>
            </p>
            <div className="mt-4 bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 text-stone-700">
              <p className="font-semibold text-stone-900">
                The field mandate: never ask a host to &ldquo;sign up,&rdquo; &ldquo;fill out a form,&rdquo; or &ldquo;learn a system.&rdquo;
              </p>
              <p className="mt-1">
                Instead, make the entry barrier zero: &ldquo;Send us 3 photos and your rate card on WhatsApp. Our concierge team formats your verified digital storefront in 8 minutes for free.&rdquo;
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 mt-10">2. The 3-touch WhatsApp conversion cadence</h2>
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-stone-900">Touch 1 (day 1): the sincere compliment + provocative question</h3>
                <p className="mt-2 bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 text-stone-700">
                  &ldquo;Muli bwanji [Manager Name]! We&apos;ve been admiring the stunning lakefront cottages at [Property Name]. Quick question: on your weekend bookings from Lilongwe and Blantyre, are you still paying foreign booking websites 18% to 22% in commission?&rdquo;
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  Psychology: Opens a conversational loop without being aggressive. Reminds them of the commission deduction.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-stone-900">Touch 2 (day 2): the zero-inertia value demo</h3>
                <p className="mt-2 bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 text-stone-700">
                  &ldquo;We put together a private preview of what [Property Name] looks like on Travel Malawi with direct Airtel Money/Mpamba settlement and 0% commission. Guests chat directly to your WhatsApp line. Would you like us to activate this for your lodge?&rdquo;
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  Psychology: Endowment effect. The work is already done; they feel natural pride in the result.
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-stone-900">Touch 3 (day 3): the founding host scarcity close</h3>
                <p className="mt-2 bg-stone-50/80 border border-stone-200/90 rounded-xl p-4 text-stone-700">
                  &ldquo;Takulandirani [Manager Name] — we are locking our inaugural Founding Host Cohort for [Region] at 10 flagship properties this Friday (0% commission forever + free verified profiling). We have 2 slots remaining in your zone and wanted to offer you first right of refusal before opening to others.&rdquo;
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  Psychology: Loss aversion and prestige. No reputable lodge wants to be left out of the national directory.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 mt-10">3. Disarming the 4 host objections</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border border-stone-200 border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Host objection</th>
                    <th className={th}>Underlying fear</th>
                    <th className={th}>Turnaround script</th>
                  </tr>
                </thead>
                <tbody className="text-stone-700">
                  <tr>
                    <td className={`${td} font-medium text-stone-900`}>&ldquo;We already use Booking.com.&rdquo;</td>
                    <td className={`${td} text-stone-500`}>Fear of losing foreign traffic.</td>
                    <td className={td}>&ldquo;Keep it! We don&apos;t want you to leave it. We simply capture your domestic and regional travelers at 0% commission. Why pay 20% on a guest driving from Lilongwe?&rdquo;</td>
                  </tr>
                  <tr>
                    <td className={`${td} font-medium text-stone-900`}>&ldquo;I don&apos;t have time for another app.&rdquo;</td>
                    <td className={`${td} text-stone-500`}>Fear of operational complexity.</td>
                    <td className={td}>&ldquo;You will never log into an app. Guest inquiries land straight in your WhatsApp with room, dates, and total calculated. You confirm with one tap.&rdquo;</td>
                  </tr>
                  <tr>
                    <td className={`${td} font-medium text-stone-900`}>&ldquo;Can guests contact us directly before booking?&rdquo;</td>
                    <td className={`${td} text-stone-500`}>Opaque communication or masked numbers.</td>
                    <td className={td}>&ldquo;Yes! Travelers chat directly with your manager via in-app real-time messaging and direct WhatsApp. Coordinate boat transfers, Lake Chambo dinners, and road directions with zero friction.&rdquo;</td>
                  </tr>
                  <tr>
                    <td className={`${td} font-medium text-stone-900`}>&ldquo;What if I need help pricing rooms or drafting replies?&rdquo;</td>
                    <td className={`${td} text-stone-500`}>Operational hesitation or copywriting worry.</td>
                    <td className={td}>&ldquo;You have Ulendo Concierge AI built right into your Host Dashboard. Chat with Ulendo 24/7 for seasonal rate recommendations, daily restaurant blackboard updates, and drafted guest notes.&rdquo;</td>
                  </tr>
                  <tr>
                    <td className={`${td} font-medium text-stone-900`}>&ldquo;Why is it free? What is the catch?&rdquo;</td>
                    <td className={`${td} text-stone-500`}>Suspicion of hidden future fees.</td>
                    <td className={td}>&ldquo;No catch. We are partnering with 10 flagship stays per region to build the national network. We monetize optional corporate marketing packages later, never your baseline bookings.&rdquo;</td>
                  </tr>
                  <tr>
                    <td className={`${td} font-medium text-stone-900`}>&ldquo;We only take cash on arrival.&rdquo;</td>
                    <td className={`${td} text-stone-500`}>Fear of banking issues.</td>
                    <td className={td}>&ldquo;You can keep doing that! We also enable guests to send deposits to your Airtel Money or Mpamba so you eliminate last-minute weekend no-shows.&rdquo;</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Dual-Channel Communication */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-stone-900">4. Two-way direct guest chat &amp; 24/7 Ulendo Concierge Copilot</h2>
            <p className="mt-3 text-stone-700">
              When briefing lodge general managers and cottage owners, emphasize our two flagship communication advantages:
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <p className="font-semibold text-stone-900 text-sm">Direct Guest-to-Manager Inquiries</p>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Travelers can chat directly with property managers in real time via in-app messaging and direct WhatsApp. No opaque call centers, no masked phone numbers. Ideal for coordinating Lake Malawi boat pickups, 4x4 road conditions, and custom Lake Chambo meal preparation.
                </p>
              </div>
              <div className="p-4 bg-stone-900 text-stone-100 border border-stone-800 rounded-xl space-y-2">
                <p className="font-semibold text-white text-sm">24/7 Ulendo Concierge AI Copilot</p>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Inside the Host Dashboard, managers can chat with Ulendo—our resident Malawian hospitality AI concierge—to recommend seasonal pricing in MWK and USD, draft polite deposit reminders, update daily blackboard fish specials, and optimize listing amenities with 1 tap.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Listing Quality Checks */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <span>5. Seven-point listing quality checklist</span>
            </h2>
            <p className="mt-3 text-stone-700 text-sm">
              Before marking any property as <strong>Approved</strong> in the Admin Dashboard, field officers and concierge staff must verify all 7 points:
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>1. Exact Gate GPS Pin</span>
                </div>
                <p className="text-stone-600">The coordinate must be at the vehicle entry gate, not the district post office. Offline navigation relies on this.</p>
              </div>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>2. Four Crisp Daytime Photos</span>
                </div>
                <p className="text-stone-600">Master bed (sleep), veranda/horizon (aspiration), clean en-suite shower (hygiene), and evening sunset/dining.</p>
              </div>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>3. Clean Dual Pricing</span>
                </div>
                <p className="text-stone-600">MWK cleanly rounded to nearest MK 1,000 (e.g. MK 85,000); USD in whole figures or nearest $5 (e.g. $60).</p>
              </div>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>4. Verified WhatsApp Number</span>
                </div>
                <p className="text-stone-600">The host or resident manager responds to a test ping within 15 minutes.</p>
              </div>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>5. Ulendo AI &amp; Direct Chat Briefed</span>
                </div>
                <p className="text-stone-600">Host understands how direct guest inquiries arrive and how to ask Ulendo for rate guidance and menu updates.</p>
              </div>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>6. 2-Way Calendar Connection Test Verified</span>
                </div>
                <p className="text-stone-600">Click &ldquo;Test Connection&rdquo; in room settings. Confirm valid RFC 5545 events, latency &lt; 2,000ms, and zero double-booking risk.</p>
              </div>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1 sm:col-span-2">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>7. Direct Listing Moderation &amp; Publishing</span>
                </div>
                <p className="text-stone-600">Admins and Marketing team members can approve or reject pending stays directly from the preview card or host dashboard banner.</p>
              </div>
            </div>
          </section>

          {/* Section 6: Staff & Support Shadow Mode SOP */}
          <section className="mt-10 p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
            <h2 className="text-xl font-semibold text-stone-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-800" />
              <span>6. Staff &amp; Concierge &ldquo;Shadow a Host&rdquo; Mode SOP</span>
            </h2>
            <p className="mt-2 text-stone-700 text-sm leading-relaxed">
              Admins and Marketing staff have direct access to securely shadow any property manager's dashboard in real-time. This allows support staff to inspect room calendars, verify iCal feeds, and adjust pricing alongside the host without requiring host passwords.
            </p>
            <div className="mt-4 space-y-2.5 text-xs text-stone-700">
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded">Step 1</span>
                <span>Click <strong>&ldquo;Shadow a Manager&rdquo;</strong> in the top navigation menu.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded">Step 2</span>
                <span>Search by property name or host name and click <strong>&ldquo;Shadow Host&rdquo;</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded">Step 3</span>
                <span>Verify the amber session banner: <em>&ldquo;Shadowing [Property Name] as Host&rdquo;</em> is visible across the top of the screen.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded">Step 4</span>
                <span>Perform needed troubleshooting (e.g. click &ldquo;Test Connection&rdquo; on iCal links, verify Airtel Money / Mpamba payment text, review room inventory).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded">Step 5</span>
                <span>Click <strong>&ldquo;Exit Shadow Mode&rdquo;</strong> in the banner to return cleanly to your administrative account. Every shadow action is logged for security.</span>
              </div>
            </div>
          </section>

          {/* Section 7: field scout form */}
          <section id="scout-form" className="mt-12 pt-8 border-t border-stone-200">
            <h2 className="text-xl font-semibold text-stone-900">7. Log a new lodge lead or field observation</h2>
            <p className="mt-2 text-stone-500">
              Met a lodge manager or identified a promising cottage along the lake? Enter their contact info below to dispatch the concierge onboarding sequence.
            </p>

            {submitted ? (
              <div className="mt-6 bg-stone-50/80 border border-stone-200/90 rounded-xl p-4">
                <p className="font-medium text-stone-900">Field lead logged</p>
                <p className="text-stone-700">
                  Reference: <span className="font-mono">{submissionId}</span>. The record is now visible in the Admin Hub for immediate onboarding dispatch.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Target lodge / cottage name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mufasa Eco Lodge, Cape Maclear"
                      value={formData.targetStay}
                      onChange={e => setFormData({ ...formData, targetStay: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Region / area</label>
                    <input
                      type="text"
                      placeholder="e.g. Nkhata Bay, Senga Bay, Liwonde"
                      value={formData.targetLocation}
                      onChange={e => setFormData({ ...formData, targetLocation: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Scout / field officer name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={formData.scoutName}
                      onChange={e => setFormData({ ...formData, scoutName: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Host WhatsApp / phone number</label>
                    <input
                      type="tel"
                      placeholder="Include country code"
                      value={formData.scoutPhone}
                      onChange={e => setFormData({ ...formData, scoutPhone: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Field notes &amp; current status</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Owner expressed interest; currently frustrated with Booking.com 20% fee; has 6 chalets on beach"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm text-stone-500">Sent directly to the Admin Hub.</span>
                  <button type="submit" disabled={submitting} className={primaryBtn}>
                    <Send size={16} />
                    {submitting ? 'Submitting…' : 'Submit field observation'}
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
