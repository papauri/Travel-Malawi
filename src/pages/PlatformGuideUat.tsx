import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Printer, Send, Copy, Check, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import { useDocContent } from '../hooks/useDocContent';

interface TestCase {
  id: string;
  suite: string;
  title: string;
  steps: string[];
  expected: string;
}

const UAT_TESTS: TestCase[] = [
  {
    id: 'A1',
    suite: 'Discovery & Search',
    title: 'Destination Autocomplete & Keyword Filter',
    steps: [
      'Enter destination (e.g. "Cape Maclear" or "Lilongwe") in the search input',
      'Select a destination suggestion or press Enter'
    ],
    expected: 'Properties filter down to the selected destination with instant price and location updates.'
  },
  {
    id: 'A2',
    suite: 'Discovery & Search',
    title: '3-Tier View Modes (Grid, Compact List, Map)',
    steps: [
      'Toggle between visual photo Grid View',
      'Switch to Compact List View for high-density browsing',
      'Open the Interactive Clustered Map'
    ],
    expected: 'Smooth layout transition across all view modes without jarring layout shifts.'
  },
  {
    id: 'A3',
    suite: 'Pricing & Currency',
    title: 'Native Dual Currency (MWK / USD) Pacing',
    steps: [
      'Toggle currency in the header between MWK and USD',
      'Inspect prices across search cards, detail pages, and modals'
    ],
    expected: 'All prices convert immediately using verified rates (rounded MWK to nearest 1,000; USD to whole dollar).'
  },
  {
    id: 'B1',
    suite: 'Direct Inquiries & Stay OS',
    title: 'Pre-filled WhatsApp Direct Inquiry',
    steps: [
      'Open any verified stay detail page',
      'Select dates and tap "Inquire via WhatsApp"'
    ],
    expected: 'Launches WhatsApp with pre-filled check-in, check-out, room category, and booking reference.'
  },
  {
    id: 'B2',
    suite: 'Offline Navigation',
    title: 'Zero-Signal Satellite GPS Caching',
    steps: [
      'Access property detail page and locate the Map & Directions card',
      'Verify Decimal / DMS coordinates and offline map link'
    ],
    expected: 'Coordinates launch native device GPS navigation (OsmAnd, Organic Maps, Google Maps) without cellular data.'
  },
  {
    id: 'C1',
    suite: 'Host Operations',
    title: '0% Commission Direct Booking & Vouchers',
    steps: [
      'Review booking confirmation voucher',
      'Verify mobile money rails (Airtel Money, TNM Mpamba, and Bank transfer)'
    ],
    expected: 'Direct settlement instructions to host account with 0% platform deductions.'
  }
];

export default function PlatformGuideUat() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'platform-guide-uat',
    'Platform Architecture & Quality Assurance Standards',
    'An operational manual for engineering, field onboarding scouts, and marketing leads. Details verification checklists, zero-failure payment rails, and platform telemetry benchmarks across Malawi.'
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'guide' | 'checklist'>('guide');
  const [completedTests, setCompletedTests] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('tm_uat_tests');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    testerName: '',
    testerContact: '',
    testSuite: 'All',
    defectSummary: '',
    severity: 'Medium'
  });

  useEffect(() => {
    try {
      localStorage.setItem('tm_uat_tests', JSON.stringify(completedTests));
    } catch (e) {
      console.error(e);
    }
  }, [completedTests]);

  const toggleTest = (id: string) => {
    setCompletedTests(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const resetChecklist = () => {
    if (window.confirm('Reset all verification checklist progress?')) {
      setCompletedTests({});
      toast.success('Checklist reset.');
    }
  };

  const completedCount = Object.values(completedTests).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / UAT_TESTS.length) * 100);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Muli bwanji! Here is the Travel Malawi Platform Verification Guide & UAT Manual: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.defectSummary.trim()) {
      toast.error('Please describe your observation or defect.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: 'operations_feedback',
        sourceDoc: 'UAT Verification Manual',
        propName: `QA Report [${formData.severity}] - ${formData.testSuite}`,
        propLoc: `Progress: ${completedCount}/${UAT_TESTS.length} verified`,
        contactName: formData.testerName || 'QA Tester',
        contactPhone: formData.testerContact || '',
        notes: `Severity: ${formData.severity}. Suite: ${formData.testSuite}. Notes: ${formData.defectSummary}`,
        pilotInterest: 'yes'
      };

      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const refId = data.id || `qa-${Date.now()}`;

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
      toast.success('Zikomo! QA defect report logged.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:border-stone-500';
  const labelClass = 'block text-sm font-medium text-stone-700 mb-1';

  return (
    <div className="min-h-screen bg-white text-stone-700 font-sans">
      <main className="max-w-3xl mx-auto px-5 py-12 print:py-0">

        {/* Header */}
        <header className="border-b border-stone-200 pb-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <p className="text-sm text-stone-500">Platform &amp; QA &middot; Release v2.5.0</p>
            <div className="flex items-center gap-2 flex-wrap print:hidden">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                <ArrowLeft size={16} className="text-stone-500" />
                Home
              </Link>
              <DocQuickEditButton
                docId="platform-guide-uat"
                onSaved={() => refreshDoc()}
              />
              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer"
              >
                <MessageSquare size={16} className="text-stone-500" />
                Share
              </button>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer"
                title="Copy link"
              >
                {copiedLink ? <Check size={16} className="text-stone-500" /> : <Copy size={16} className="text-stone-500" />}
                {copiedLink ? 'Copied' : 'Copy link'}
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer"
              >
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

          <div className="mt-6 flex items-center gap-2 print:hidden">
            <button
              onClick={() => setActiveTab('guide')}
              className={`rounded-md px-3 py-1.5 text-sm cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-stone-900 text-white hover:bg-stone-800'
                  : 'border border-stone-300 text-stone-800 hover:bg-stone-50'
              }`}
            >
              Guide
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`rounded-md px-3 py-1.5 text-sm cursor-pointer ${
                activeTab === 'checklist'
                  ? 'bg-stone-900 text-white hover:bg-stone-800'
                  : 'border border-stone-300 text-stone-800 hover:bg-stone-50'
              }`}
            >
              Checklist ({completedCount}/{UAT_TESTS.length})
            </button>
          </div>
        </header>

        {activeTab === 'checklist' ? (
          <div className="text-[15px] leading-relaxed">
            <div className="flex items-center justify-between gap-4 pb-4">
              <p className="text-stone-700">
                {completedCount} of {UAT_TESTS.length} verified ({progressPercent}%)
              </p>
              <button
                onClick={resetChecklist}
                className="inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer"
              >
                <RefreshCw size={16} className="text-stone-500" />
                Reset
              </button>
            </div>

            <ul className="border-t border-stone-200">
              {UAT_TESTS.map(t => {
                const isChecked = !!completedTests[t.id];
                return (
                  <li key={t.id} className="border-b border-stone-200 py-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTest(t.id)}
                        className="mt-1 h-4 w-4 accent-stone-900"
                      />
                      <div>
                        <h3 className={`text-base font-semibold ${isChecked ? 'text-stone-500 line-through' : 'text-stone-900'}`}>
                          {t.id}. {t.title}
                        </h3>
                        <p className="text-sm text-stone-500">{t.suite}</p>
                        <ul className="mt-2 list-disc pl-5 text-stone-700">
                          {t.steps.map((st, sIdx) => (
                            <li key={sIdx}>{st}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-stone-700">
                          <span className="font-medium text-stone-900">Expected:</span> {t.expected}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="text-[15px] leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-stone-900">1. Core architectural pillars</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-stone-900">0% commission direct bookings</h3>
                  <p className="text-stone-700">
                    Eliminates the 15%–25% commission tax imposed by foreign OTAs. Direct guest communication and reservation requests via WhatsApp and in-app vouchers.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">Native dual currency (MWK / USD)</h3>
                  <p className="text-stone-700">
                    Dual currency engine allowing travelers to browse and book natively in clean Kwacha (rounded to nearest 1,000) or USD with zero forex spread penalty.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">Offline satellite GPS navigation</h3>
                  <p className="text-stone-700">
                    Multi-tier map tile caching enabling vehicle drivers to locate remote bush chalets and lake gates even with zero cellular reception.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">Local payment rail support</h3>
                  <p className="text-stone-700">
                    Full compatibility with Airtel Money, TNM Mpamba, National Bank of Malawi, Standard Bank, and FDH Bank transfers.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-stone-900 mt-10">2. Verification protocols &amp; standard test suites</h2>
              <p className="mt-3 text-stone-700">
                Prior to approving any release or production update, the 6 core suites in the checklist must be validated across both desktop and mobile viewports (iOS Safari and Android Chrome).
              </p>
            </section>
          </div>
        )}

        {/* QA / defect report form */}
        <section id="qa-report-form" className="mt-12 pt-8 border-t border-stone-200 text-[15px] leading-relaxed">
          <h2 className="text-xl font-semibold text-stone-900">Submit a verification finding or defect report</h2>
          <p className="mt-2 text-stone-500">
            Encountered an issue during testing or have operational feedback? Submit the details directly to our engineering and operations team.
          </p>

          {submitted ? (
            <div className="mt-6 bg-stone-50 border-l-2 border-stone-300 px-4 py-3">
              <p className="font-medium text-stone-900">Verification report logged</p>
              <p className="text-stone-700">
                Reference: <span className="font-mono">{submissionId}</span>. The finding is now tracked in the Admin Hub for review.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tester / reporter name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={formData.testerName}
                    onChange={e => setFormData({ ...formData, testerName: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>WhatsApp / phone / email</label>
                  <input
                    type="text"
                    placeholder="Phone number or email"
                    value={formData.testerContact}
                    onChange={e => setFormData({ ...formData, testerContact: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Target area / test suite</label>
                  <select
                    value={formData.testSuite}
                    onChange={e => setFormData({ ...formData, testSuite: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Discovery & Search">Discovery &amp; Search</option>
                    <option value="Pricing & Currency">Pricing &amp; Currency (MWK / USD)</option>
                    <option value="WhatsApp Direct Inquiry">WhatsApp Direct Inquiry</option>
                    <option value="Offline Satellite GPS">Offline Satellite GPS</option>
                    <option value="Host Stay OS">Host Stay OS &amp; Rates</option>
                    <option value="Mobile UI & Performance">Mobile UI &amp; Performance</option>
                    <option value="General Observation">General Observation</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Severity level</label>
                  <select
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Low">Low (Cosmetic / Text)</option>
                    <option value="Medium">Medium (Functional Quirk)</option>
                    <option value="High">High (Blocking Flow)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Defect description &amp; reproduction steps *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Switched to MWK on mobile Safari; prices displayed properly but booking modal showed USD symbol initially."
                  value={formData.defectSummary}
                  onChange={e => setFormData({ ...formData, defectSummary: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm text-stone-500">Sent directly to the Admin Hub.</span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer disabled:opacity-50"
                >
                  <Send size={16} />
                  {submitting ? 'Submitting…' : 'Submit finding'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
