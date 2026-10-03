import React, { useState } from 'react';
import { 
  FileText, Download, Printer, Check, Copy, Share2, 
  MessageSquare, CheckCircle2, ArrowLeft, Send, Sparkles, Building2, MapPin, Phone
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

export default function ConceptValidationSurvey() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'concept-validation-survey',
    'Pre-Launch Partner Survey: Direct Bookings & Local Payments',
    'We are building a direct booking platform for independent lodges, cottages, and safari camps across Lake Malawi, Lilongwe, Blantyre, and the National Parks. Before opening to travelers, we want to hear directly from property managers to ensure we solve your daily operational hurdles.'
  );

  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    propName: '',
    propLoc: '',
    contactName: '',
    contactPhone: '',
    notes: '',
    channels: ['whatsapp', 'otas'],
    painPoints: {
      otaCommissions: 5,
      delayedPayouts: 5,
      manualMessaging: 4,
      doubleBookings: 3,
    },
    features: ['payouts', 'zero_comm', 'ai_concierge'],
    pilotInterest: 'yes'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/docs/concept-validation-survey?format=html&download=1';
    link.download = 'travel_malawi_partner_survey.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded survey document (.html)');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const shareText = `Muli bwanji! Here is the Travel Malawi Partner Discovery Survey for local lodges and cottages: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const toggleCheckbox = (listKey: 'channels' | 'features', value: string) => {
    setFormData(prev => {
      const current = prev[listKey];
      const exists = current.includes(value);
      return {
        ...prev,
        [listKey]: exists ? current.filter(item => item !== value) : [...current, value]
      };
    });
  };

  const setPainPoint = (key: keyof typeof formData.painPoints, value: number) => {
    setFormData(prev => ({
      ...prev,
      painPoints: {
        ...prev.painPoints,
        [key]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propName.trim() && !formData.contactPhone.trim()) {
      toast.error('Please provide at least your property name or WhatsApp number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Submit to local server endpoint
      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      const refId = data.id || `survey-${Date.now()}`;

      // 2. Also record in Firestore if available
      try {
        await addDoc(collection(db, 'surveys'), {
          ...formData,
          createdAt: serverTimestamp(),
          clientSubmittedAt: new Date().toISOString()
        });
      } catch {
        // non-fatal if offline
      }

      setSubmissionId(refId);
      setIsSubmitted(true);
      toast.success('Zikomo! Survey submitted successfully.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Survey submit error:', err);
      toast.error('Failed to submit survey. Please try again or reach out on WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/60 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white text-stone-900 font-sans">
      
      {/* Top Standardized Utility Header (Hidden when printing) */}
      <div className="max-w-3xl mx-auto mb-6 bg-white border border-stone-200 rounded-2xl p-4 sm:px-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link 
            to="/admin" 
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition text-xs font-semibold inline-flex items-center gap-1.5"
            title="Return to Admin Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Admin Hub</span>
          </Link>
          <div className="h-4 w-px bg-stone-200 hidden sm:block" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Partner Survey
            </span>
            <div className="text-xs font-bold text-stone-900 truncate">
              Pre-Launch Concept Evaluation
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
          <DocQuickEditButton 
            docId="concept-validation-survey" 
            onSaved={() => refreshDoc()} 
          />

          <button
            onClick={handleShareWhatsApp}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Share via WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Share on WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Print or export as clean PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleDownloadHtml}
            className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs border border-stone-200 transition inline-flex items-center gap-1.5 cursor-pointer"
            title="Download clean HTML copy"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">HTML</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 transition cursor-pointer"
            title="Copy survey URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Clean Document Sheet */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        
        {/* Simple Editorial Header */}
        <div className="p-6 sm:p-10 border-b border-stone-200 bg-stone-50/50">
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Travel Malawi &bull; Host Discovery &bull; 2026
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
                  {customTitle}
                </h1>
                {isCustomized && (
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                    Live Customized
                  </span>
                )}
              </div>
              {lastEditedBy && (
                <p className="text-[11px] text-stone-500 font-mono">
                  Maintained by {lastEditedBy}
                </p>
              )}
            </div>
            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed max-w-2xl">
              {customSubtitle}
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs text-stone-500 font-mono">
              <span>Time to complete: ~3 minutes</span>
              <span>&bull;</span>
              <span>Direct WhatsApp Payouts</span>
              <span>&bull;</span>
              <span>0% Launch Commission</span>
            </div>
          </div>
        </div>

        {/* If Submitted: Show Confirmation Screen */}
        {isSubmitted ? (
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                Zikomo Kwambiri!
              </h2>
              <p className="text-stone-600 text-sm leading-relaxed">
                Thank you, <strong>{formData.contactName || 'Partner'}</strong>. Your survey responses for <strong>{formData.propName || 'your property'}</strong> have been received by our operations team.
              </p>
              {submissionId && (
                <div className="text-xs font-mono text-stone-400 pt-1">
                  Submission ID: {submissionId}
                </div>
              )}
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">What Happens Next:</div>
              <ul className="space-y-1.5 text-stone-600">
                <li>&bull; Our team will review your pain points and room requirements.</li>
                <li>&bull; We will connect with you via WhatsApp ({formData.contactPhone || 'provided contact'}).</li>
                <li>&bull; If eligible, your stay will be prioritized for the 0% launch cohort.</li>
              </ul>
            </div>

            <div className="pt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={handlePrint}
                className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Copy for Records</span>
              </button>
              <button
                onClick={() => setIsSubmitted(false)}
                className="px-5 py-2.5 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 font-semibold text-xs transition"
              >
                Edit or Submit Another Response
              </button>
            </div>
          </div>
        ) : (
          /* Survey Form */
          <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">
            
            {/* Section 1: Current Booking Habits */}
            <div className="space-y-4">
              <div className="border-b border-stone-200 pb-2">
                <h2 className="text-base font-serif font-bold text-stone-900">
                  1. How Your Property Currently Receives Bookings
                </h2>
                <p className="text-xs text-stone-500">
                  Select the channels where your guests typically find and confirm reservations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'whatsapp', label: 'Direct WhatsApp & Phone Calls', sub: 'Manual messaging and sharing bank details directly' },
                  { id: 'otas', label: 'Foreign OTAs (Booking.com / Airbnb)', sub: 'Paying 15% to 25% commission on each stay' },
                  { id: 'corporate', label: 'Corporate & NGO Purchase Orders', sub: 'Lilongwe/Blantyre business retreats and consultants' },
                  { id: 'walkins', label: 'Walk-ins & Word of Mouth', sub: 'Returning guests and drive-by holidaymakers' }
                ].map(item => {
                  const isChecked = formData.channels.includes(item.id);
                  return (
                    <label 
                      key={item.id}
                      onClick={() => toggleCheckbox('channels', item.id)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                        isChecked ? 'bg-stone-50 border-stone-900 ring-1 ring-stone-900' : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 accent-stone-900"
                      />
                      <div>
                        <div className="text-xs font-bold text-stone-900">{item.label}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5 leading-tight">{item.sub}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Pain Points Matrix */}
            <div className="space-y-4">
              <div className="border-b border-stone-200 pb-2">
                <h2 className="text-base font-serif font-bold text-stone-900">
                  2. Rate Your Daily Operational Frustrations
                </h2>
                <p className="text-xs text-stone-500">
                  Scale from 1 (Not a problem) to 5 (Major headache).
                </p>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'otaCommissions' as const, label: 'Losing 15% to 25% commission to foreign travel engines' },
                  { key: 'delayedPayouts' as const, label: 'Delayed foreign bank transfers or expensive forex conversions' },
                  { key: 'manualMessaging' as const, label: 'Answering repetitive WhatsApp questions late at night' },
                  { key: 'doubleBookings' as const, label: 'Tracking calendars manually across phone, WhatsApp, and paper' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-medium text-stone-800">{item.label}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {[1, 2, 3, 4, 5].map(val => (
                        <label key={val} className="flex flex-col items-center gap-0.5 cursor-pointer">
                          <input 
                            type="radio" 
                            name={item.key} 
                            value={val}
                            checked={formData.painPoints[item.key] === val}
                            onChange={() => setPainPoint(item.key, val)}
                            className="accent-stone-900"
                          />
                          <span className="text-[10px] text-stone-500 font-mono">{val}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Solutions You Value */}
            <div className="space-y-4">
              <div className="border-b border-stone-200 pb-2">
                <h2 className="text-base font-serif font-bold text-stone-900">
                  3. What Features Would Help Your Property Most?
                </h2>
                <p className="text-xs text-stone-500">
                  Select the features that would provide immediate value to your lodge.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'payouts', label: 'Local Kwacha Payouts', sub: 'Instant Airtel Money, TNM Mpamba, NBM, or Standard Bank' },
                  { id: 'zero_comm', label: '0% Launch Commission', sub: 'Keep 100% of your listed room rate during launch' },
                  { id: 'ai_concierge', label: '24/7 Guest Chat Assistant', sub: 'Answers common questions about power, boat trips, and menus' },
                  { id: 'calendar', label: 'Room Calendar & Date Blocker', sub: 'Easily block dates for offline bookings or maintenance' }
                ].map(item => {
                  const isChecked = formData.features.includes(item.id);
                  return (
                    <label 
                      key={item.id}
                      onClick={() => toggleCheckbox('features', item.id)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                        isChecked ? 'bg-stone-50 border-stone-900 ring-1 ring-stone-900' : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 accent-stone-900"
                      />
                      <div>
                        <div className="text-xs font-bold text-stone-900">{item.label}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5 leading-tight">{item.sub}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Founding Partner Cohort */}
            <div className="space-y-4">
              <div className="border-b border-stone-200 pb-2">
                <h2 className="text-base font-serif font-bold text-stone-900">
                  4. Founding Partner Program (Zero Cost)
                </h2>
                <p className="text-xs text-stone-500">
                  We are accepting 10 founding properties per district with 0% commission for 90 days.
                </p>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'yes', label: 'Yes, we want to join the Founding Host Pilot', sub: 'Reach out to help us set up our profile (under 8 minutes).' },
                  { id: 'briefing', label: 'Interested, but we would like a quick call or briefing first', sub: 'We have specific questions about payouts or our room inventory.' },
                  { id: 'later', label: 'Not right now, keep us updated as you launch', sub: 'Send occasional updates via WhatsApp or email.' }
                ].map(item => (
                  <label 
                    key={item.id}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                      formData.pilotInterest === item.id ? 'bg-stone-50 border-stone-900 ring-1 ring-stone-900' : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="pilotInterest" 
                      value={item.id}
                      checked={formData.pilotInterest === item.id}
                      onChange={() => setFormData({ ...formData, pilotInterest: item.id })}
                      className="mt-0.5 accent-stone-900"
                    />
                    <div>
                      <div className="text-xs font-bold text-stone-900">{item.label}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{item.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Section 5: Contact Details */}
            <div className="space-y-4 bg-stone-50 p-5 rounded-xl border border-stone-200">
              <div>
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Your Property &amp; Contact Details
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Used strictly by our operations team to confirm your responses.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Lodge / Cottage Name</label>
                  <input 
                    type="text" 
                    value={formData.propName}
                    onChange={e => setFormData({ ...formData, propName: e.target.value })}
                    placeholder="e.g. Cape Maclear Sunset Lodge"
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Location (District / Area)</label>
                  <input 
                    type="text" 
                    value={formData.propLoc}
                    onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                    placeholder="e.g. Chembe Village, Mangochi"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Manager / Owner Name</label>
                  <input 
                    type="text" 
                    value={formData.contactName}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="e.g. Kondwani Phiri"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">WhatsApp / Phone Number</label>
                  <input 
                    type="text" 
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+265 999 00 00 00"
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Additional Notes or Questions (Optional)
                </label>
                <textarea 
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tell us about your power backup, boat trips, or any specific question..."
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>

            {/* Submission Button Row */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
              <div className="text-xs text-stone-500">
                Your responses submit directly to our local hospitality team.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting Answers...' : 'Submit Survey Response'}</span>
              </button>
            </div>

          </form>
        )}

        {/* Footer */}
        <div className="p-5 border-t border-stone-200 bg-stone-50 text-center text-xs text-stone-500">
          Travel Malawi &bull; Direct Booking &bull; Lilongwe &bull; Blantyre &bull; Mangochi &bull; WhatsApp: +265 999 00 00 00
        </div>

      </div>

    </div>
  );
}
