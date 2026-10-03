import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, CheckCircle2, ArrowLeft, Smartphone, MessageSquare, 
  MapPin, Printer, ShieldCheck, 
  Send, Share2, Download, Copy, Check, Sparkles, CheckSquare, Square, RefreshCw, AlertCircle
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

  return (
    <div className="min-h-screen bg-stone-100/60 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white text-stone-900 font-sans">
      
      {/* Standardized Top Utility Bar (Hidden during print) */}
      <div className="max-w-4xl mx-auto mb-6 bg-white border border-stone-200 rounded-2xl p-4 sm:px-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link 
            to="/" 
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition text-xs font-semibold inline-flex items-center gap-1.5"
            title="Return to Home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <div className="h-4 w-px bg-stone-200 hidden sm:block" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-800 bg-stone-100 px-2 py-0.5 rounded">
              Platform &amp; QA
            </span>
            <div className="text-xs font-bold text-stone-900 truncate">
              Platform Architecture &amp; Verification Manual
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
          <DocQuickEditButton 
            docId="platform-guide-uat" 
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
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 transition cursor-pointer"
            title="Copy link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-600" />}
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <main className="max-w-4xl mx-auto bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-8 print:border-none print:shadow-none print:p-0">
        
        {/* Document Header */}
        <header className="border-b border-stone-200 pb-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-widest text-stone-600 font-semibold">
              Travel Malawi &bull; Quality Assurance Standard
            </span>
            <span className="text-xs font-mono text-stone-600">
              Release v2.5.0
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

          <div className="flex items-center gap-2 pt-2 print:hidden">
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              Standard Guide
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'checklist'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <span>Interactive Checklist</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                {completedCount}/{UAT_TESTS.length}
              </span>
            </button>
          </div>
        </header>

        {activeTab === 'checklist' ? (
          /* Interactive Verification Checklist */
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs text-stone-500 font-medium">Verification Progress</span>
                <div className="text-base font-bold text-stone-900">
                  {completedCount} of {UAT_TESTS.length} verified ({progressPercent}%)
                </div>
              </div>
              <button
                onClick={resetChecklist}
                className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="space-y-3">
              {UAT_TESTS.map(t => {
                const isChecked = !!completedTests[t.id];
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTest(t.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                      isChecked
                        ? 'bg-emerald-50/40 border-emerald-200/80 text-stone-900'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="mt-0.5 text-stone-400">
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-500">[{t.id}]</span>
                        <h4 className={`text-sm font-bold ${isChecked ? 'text-emerald-950 line-through' : 'text-stone-900'}`}>
                          {t.title}
                        </h4>
                        <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                          {t.suite}
                        </span>
                      </div>
                      <div className="text-xs text-stone-600 space-y-0.5">
                        {t.steps.map((st, sIdx) => (
                          <div key={sIdx}>&bull; {st}</div>
                        ))}
                      </div>
                      <div className="text-xs text-stone-500 pt-1">
                        <strong>Expected:</strong> {t.expected}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Standard Guide Content */
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="font-serif text-xl font-bold text-stone-900">
                1. Core Architectural Pillars
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-1">
                  <strong className="text-stone-900 block">0% Commission Direct Bookings</strong>
                  <p className="text-stone-600">
                    Eliminates the 15%–25% commission tax imposed by foreign OTAs. Direct guest communication and reservation requests via WhatsApp and in-app vouchers.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-1">
                  <strong className="text-stone-900 block">Native Dual Currency (MWK / USD)</strong>
                  <p className="text-stone-600">
                    Dual currency engine allowing travelers to browse and book natively in clean Kwacha (rounded to nearest 1,000) or USD with zero forex spread penalty.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-1">
                  <strong className="text-stone-900 block">Offline Satellite GPS Navigation</strong>
                  <p className="text-stone-600">
                    Multi-tier map tile caching enabling vehicle drivers to locate remote bush chalets and lake gates even with zero cellular reception.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-1">
                  <strong className="text-stone-900 block">Local Payment Rail Support</strong>
                  <p className="text-stone-600">
                    Full compatibility with Airtel Money, TNM Mpamba, National Bank of Malawi, Standard Bank, and FDH Bank transfers.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-xl font-bold text-stone-900">
                2. Verification Protocols &amp; Standard Test Suites
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Prior to approving any release or production update, the 6 core suites above must be validated across both desktop and mobile viewports (iOS Safari and Android Chrome).
              </p>
            </section>
          </div>
        )}

        {/* Section: SUBMIT BACK TO US (QA / Defect Report Form) */}
        <section id="qa-report-form" className="pt-6 border-t border-stone-200 space-y-6">
          <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-stone-800 text-stone-200 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>QA &amp; Verification Reporting</span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Submit a Verification Finding or Defect Report
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
                Encountered an issue during testing or have operational feedback? Submit the details directly to our engineering and operations team.
              </p>
            </div>

            {submitted ? (
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Verification Report Logged
                </h3>
                <p className="text-xs text-stone-300 max-w-md mx-auto">
                  Reference: <span className="font-mono text-amber-300 font-bold">{submissionId}</span>. The finding is now tracked in the Admin Hub for review.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Tester / Reporter Name
                    </label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={formData.testerName}
                      onChange={e => setFormData({ ...formData, testerName: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      WhatsApp / Phone / Email
                    </label>
                    <input
                      type="text"
                      placeholder="+265 99 123 4567 or email"
                      value={formData.testerContact}
                      onChange={e => setFormData({ ...formData, testerContact: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Target Area / Test Suite
                    </label>
                    <select
                      value={formData.testSuite}
                      onChange={e => setFormData({ ...formData, testSuite: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-stone-500"
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
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Severity Level
                    </label>
                    <select
                      value={formData.severity}
                      onChange={e => setFormData({ ...formData, severity: e.target.value })}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-stone-500"
                    >
                      <option value="Low">Low (Cosmetic / Text)</option>
                      <option value="Medium">Medium (Functional Quirk)</option>
                      <option value="High">High (Blocking Flow)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Defect Description &amp; Reproduction Steps *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. Switched to MWK on mobile Safari; prices displayed properly but booking modal showed USD symbol initially."
                    value={formData.defectSummary}
                    onChange={e => setFormData({ ...formData, defectSummary: e.target.value })}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-stone-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-[11px] text-stone-400">
                    &bull; Synced immediately to Admin Hub &bull; Helps maintain 99.9% booking reliability
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-full bg-white hover:bg-stone-100 text-stone-900 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting…' : 'Submit Finding'}</span>
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
