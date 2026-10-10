import React, { useState } from 'react';
import { Download, Printer, Check, Copy, MessageSquare, ArrowLeft } from 'lucide-react';
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

  const secondaryBtn =
    'inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer';
  const primaryBtn =
    'inline-flex items-center justify-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer disabled:opacity-50';
  const inputCls =
    'w-full bg-white border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900';
  const labelCls = 'block text-sm font-medium text-stone-700 mb-1';
  const optionCls = 'flex items-start gap-3 py-2 cursor-pointer select-none';

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <div className="max-w-3xl mx-auto px-5 py-12 print:py-0">

        {/* Toolbar (hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 print:hidden">
          <Link to="/admin" className={secondaryBtn} title="Return to Admin Hub">
            <ArrowLeft size={16} className="text-stone-500" />
            <span>Admin Hub</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <DocQuickEditButton docId="concept-validation-survey" onSaved={() => refreshDoc()} />
            <button onClick={handleShareWhatsApp} className={secondaryBtn} title="Share via WhatsApp">
              <MessageSquare size={16} className="text-stone-500" />
              <span>Share on WhatsApp</span>
            </button>
            <button onClick={handlePrint} className={secondaryBtn} title="Print or export as PDF">
              <Printer size={16} className="text-stone-500" />
              <span>Print / PDF</span>
            </button>
            <button onClick={handleDownloadHtml} className={secondaryBtn} title="Download HTML copy">
              <Download size={16} className="text-stone-500" />
              <span>HTML</span>
            </button>
            <button onClick={handleCopyLink} className={secondaryBtn} title="Copy survey URL">
              {copied ? <Check size={16} className="text-stone-500" /> : <Copy size={16} className="text-stone-500" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        {/* Header */}
        <header className="border-b border-stone-200 pb-6 mb-8">
          <p className="text-sm text-stone-500">Travel Malawi &middot; Host discovery survey &middot; 2026</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900">{customTitle}</h1>
          <p className="mt-2 text-stone-500 text-[15px] leading-relaxed">{customSubtitle}</p>
          <p className="mt-3 text-sm text-stone-500">
            Time to complete: about 3 minutes &middot; Direct WhatsApp payouts &middot; 0% launch commission
          </p>
          {(isCustomized || lastEditedBy) && (
            <p className="mt-1 text-sm text-stone-500">
              {isCustomized && 'Customised edition'}
              {isCustomized && lastEditedBy && ' · '}
              {lastEditedBy && `Maintained by ${lastEditedBy}`}
            </p>
          )}
        </header>

        {isSubmitted ? (
          /* Confirmation */
          <section>
            <h2 className="text-xl font-semibold text-stone-900">Zikomo Kwambiri!</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-700">
              Thank you, <strong className="font-semibold text-stone-900">{formData.contactName || 'Partner'}</strong>. Your survey responses for <strong className="font-semibold text-stone-900">{formData.propName || 'your property'}</strong> have been received by our operations team.
            </p>
            {submissionId && (
              <p className="mt-2 text-sm text-stone-500">
                Submission ID: <span className="font-mono">{submissionId}</span>
              </p>
            )}

            <div className="mt-6 bg-stone-50 border-l-2 border-stone-300 px-4 py-3">
              <h3 className="text-base font-semibold text-stone-900">What happens next</h3>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-[15px] leading-relaxed text-stone-700">
                <li>Our team will review your pain points and room requirements.</li>
                <li>We will connect with you via WhatsApp ({formData.contactPhone || 'provided contact'}).</li>
                <li>If eligible, your stay will be prioritized for the 0% launch cohort.</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 print:hidden">
              <button onClick={handlePrint} className={primaryBtn}>
                Print copy for records
              </button>
              <button onClick={() => setIsSubmitted(false)} className={secondaryBtn}>
                Edit or submit another response
              </button>
            </div>
          </section>
        ) : (
          /* Survey form */
          <form onSubmit={handleSubmit}>

            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900">1. How Your Property Currently Receives Bookings</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
                Select the channels where your guests typically find and confirm reservations.
              </p>
              <div className="mt-4">
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
                      className={optionCls}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 accent-stone-900"
                      />
                      <span>
                        <span className="block text-[15px] font-medium text-stone-900">{item.label}</span>
                        <span className="block text-sm text-stone-500">{item.sub}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Section 2 */}
            <section className="border-t border-stone-200 mt-10">
              <h2 className="text-xl font-semibold text-stone-900 mt-10">2. Rate Your Daily Operational Frustrations</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
                Scale from 1 (Not a problem) to 5 (Major headache).
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm border border-stone-200">
                  <thead>
                    <tr>
                      <th className="bg-stone-50 text-left font-medium text-stone-900 px-3 py-2">Frustration</th>
                      {[1, 2, 3, 4, 5].map(val => (
                        <th key={val} className="bg-stone-50 text-center font-medium text-stone-900 px-2 py-2 w-10">{val}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'otaCommissions' as const, label: 'Losing 15% to 25% commission to foreign travel engines' },
                      { key: 'delayedPayouts' as const, label: 'Delayed foreign bank transfers or expensive forex conversions' },
                      { key: 'manualMessaging' as const, label: 'Answering repetitive WhatsApp questions late at night' },
                      { key: 'doubleBookings' as const, label: 'Tracking calendars manually across phone, WhatsApp, and paper' }
                    ].map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 border-t border-stone-200 text-stone-700">{item.label}</td>
                        {[1, 2, 3, 4, 5].map(val => (
                          <td key={val} className="px-2 py-2 border-t border-stone-200 text-center">
                            <input
                              type="radio"
                              name={item.key}
                              value={val}
                              aria-label={`${item.label}: ${val}`}
                              checked={formData.painPoints[item.key] === val}
                              onChange={() => setPainPoint(item.key, val)}
                              className="accent-stone-900 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3 */}
            <section className="border-t border-stone-200 mt-10">
              <h2 className="text-xl font-semibold text-stone-900 mt-10">3. What Features Would Help Your Property Most?</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
                Select the features that would provide immediate value to your lodge.
              </p>
              <div className="mt-4">
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
                      className={optionCls}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 accent-stone-900"
                      />
                      <span>
                        <span className="block text-[15px] font-medium text-stone-900">{item.label}</span>
                        <span className="block text-sm text-stone-500">{item.sub}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Section 4 */}
            <section className="border-t border-stone-200 mt-10">
              <h2 className="text-xl font-semibold text-stone-900 mt-10">4. Founding Partner Program (Zero Cost)</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
                We are accepting 10 founding properties per district with 0% commission for 90 days.
              </p>
              <div className="mt-4">
                {[
                  { id: 'yes', label: 'Yes, we want to join the Founding Host Pilot', sub: 'Reach out to help us set up our profile (under 8 minutes).' },
                  { id: 'briefing', label: 'Interested, but we would like a quick call or briefing first', sub: 'We have specific questions about payouts or our room inventory.' },
                  { id: 'later', label: 'Not right now, keep us updated as you launch', sub: 'Send occasional updates via WhatsApp or email.' }
                ].map(item => (
                  <label key={item.id} className={optionCls}>
                    <input
                      type="radio"
                      name="pilotInterest"
                      value={item.id}
                      checked={formData.pilotInterest === item.id}
                      onChange={() => setFormData({ ...formData, pilotInterest: item.id })}
                      className="mt-1 accent-stone-900"
                    />
                    <span>
                      <span className="block text-[15px] font-medium text-stone-900">{item.label}</span>
                      <span className="block text-sm text-stone-500">{item.sub}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* Section 5 */}
            <section className="border-t border-stone-200 mt-10">
              <h2 className="text-xl font-semibold text-stone-900 mt-10">5. Your Property &amp; Contact Details</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
                Used strictly by our operations team to confirm your responses.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Lodge / Cottage Name</label>
                  <input
                    type="text"
                    value={formData.propName}
                    onChange={e => setFormData({ ...formData, propName: e.target.value })}
                    placeholder="e.g. Cape Maclear Sunset Lodge"
                    required
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Location (District / Area)</label>
                  <input
                    type="text"
                    value={formData.propLoc}
                    onChange={e => setFormData({ ...formData, propLoc: e.target.value })}
                    placeholder="e.g. Chembe Village, Mangochi"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Manager / Owner Name</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="e.g. Kondwani Phiri"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>WhatsApp / Phone Number</label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="Your WhatsApp number"
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className={labelCls}>Additional Notes or Questions (Optional)</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tell us about your power backup, boat trips, or any specific question..."
                  className={inputCls}
                />
              </div>
            </section>

            {/* Submit */}
            <div className="border-t border-stone-200 mt-10 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <p className="text-sm text-stone-500">
                Your responses submit directly to our local hospitality team.
              </p>
              <button type="submit" disabled={isSubmitting} className={primaryBtn}>
                {isSubmitting ? 'Submitting answers…' : 'Submit survey response'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <footer className="border-t border-stone-200 mt-12 pt-6 text-sm text-stone-500">
          Ulendo Travel Malawi &middot; Direct Booking &middot; Lilongwe &middot; Blantyre &middot; Mangochi &middot; info@ulendomalawi.com
        </footer>
      </div>
    </div>
  );
}
