import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Printer, Send, Copy, Check, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DocQuickEditButton from '../components/DocQuickEditButton';
import ConfirmDialog from '../components/ConfirmDialog';
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
    suite: 'Direct Inquiries & Host Tools',
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
    id: 'B3',
    suite: 'Direct Inquiries & Host Tools',
    title: 'Two-Way Direct Guest-to-Manager In-App Chat',
    steps: [
      'Click "Chat with Host" on property detail page or active booking',
      'Send inquiry regarding boat transfers, meals, or arrival time',
      'Verify typing indicators and manager presence status'
    ],
    expected: 'Real-time two-way messaging between traveler and host with zero call-center intermediaries.'
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
  },
  {
    id: 'C2',
    suite: 'Host Operations',
    title: '24/7 Ulendo Concierge AI Copilot Operations Chat',
    steps: [
      'Open Host Dashboard and launch Ulendo Concierge chat',
      'Request seasonal rate recommendation (e.g. Easter / Lake of Stars)',
      'Ask Ulendo to update daily restaurant blackboard special or draft guest confirmation'
    ],
    expected: 'Ulendo provides instant Malawian hospitality copilot assistance with 1-click action proposals.'
  },
  {
    id: 'C3',
    suite: 'Calendar & Channel Integration',
    title: '2-Way iCal (.ics) Calendar Synchronization',
    steps: [
      'In Host Dashboard under Rooms & Rates, click "Sync iCal"',
      'Paste external calendar feed (RoomRaccoon, Airbnb, NightsBridge, Booking.com, Google Calendar)',
      'Verify Travel Malawi export feed URL generates RFC 5545 valid calendar'
    ],
    expected: 'External bookings block dates automatically on Travel Malawi; Travel Malawi bookings export cleanly to external PMS with zero double bookings.'
  },
  {
    id: 'C4',
    suite: 'Calendar & Channel Integration',
    title: 'iCal Connection Diagnostics & Latency Ping',
    steps: [
      'Click "Test Connection" button on any room card with an active iCal link',
      'Verify real-time diagnostic latency display (e.g. ~142ms)',
      'Inspect upcoming blocked events preview list and status badges'
    ],
    expected: 'Returns HTTP status, confirms feed validity, measures response time, and shows preview of next 3 booked dates.'
  },
  {
    id: 'C5',
    suite: 'Staff Support & Operations',
    title: 'Staff & Support Shadow Mode ("Shadow a Manager")',
    steps: [
      'Sign in as Admin or Marketing user and click "Shadow a Manager" in top navigation',
      'Search and select a property or host by name',
      'Confirm active session banner: "Shadowing [Property Name] as Host"',
      'Click "Exit Shadow Mode" to return to administrative session'
    ],
    expected: 'Staff can securely view and troubleshoot host dashboard without passwords; session banner displays and exit restores admin profile.'
  },
  {
    id: 'C6',
    suite: 'Stay Moderation',
    title: 'Direct Listing Moderation & Host Approvals',
    steps: [
      'Locate a stay in "Pending Review" status',
      'Click "Approve Listing" directly on the preview card or host dashboard banner'
    ],
    expected: 'Stay updates immediately to Published/Approved with real-time UI reflect and audit record.'
  }
];

const GUIDE_STEPS = [
  'Open the Checklist tab.',
  'Run each test on a phone and on a laptop.',
  'Tick the test when it behaves as expected.',
  'Report anything wrong using the form below.',
];

export default function PlatformGuideUat() {
  const { title: customTitle, subtitle: customSubtitle, isCustomized, lastEditedBy, refreshDoc } = useDocContent(
    'platform-guide-uat',
    'Platform test guide',
    'Check the main flows before each release, tick them off, and report anything that breaks.'
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
    setShowResetConfirm(true);
  };

  const confirmResetChecklist = () => {
    setShowResetConfirm(false);
    setCompletedTests({});
    toast.success('Checklist reset.');
  };

  const completedCount = Object.values(completedTests).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / UAT_TESTS.length) * 100);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied');
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
      toast.success('Zikomo! Report sent.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not send the report. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-stone-700">
      <main className="tm-page max-w-3xl py-8 sm:py-12 print:py-0">
        <div className="tm-actions mb-6 print:hidden">
          <Link to="/" className="tm-btn tm-btn-secondary tm-btn-sm">
            <ArrowLeft size={14} /> Home
          </Link>
          <DocQuickEditButton docId="platform-guide-uat" onSaved={() => refreshDoc()} />
          <button onClick={handleShareWhatsApp} className="tm-btn tm-btn-secondary tm-btn-sm">
            <MessageSquare size={14} /> Share
          </button>
          <button onClick={handleCopyLink} className="tm-btn tm-btn-secondary tm-btn-sm">
            {copiedLink ? <Check size={14} /> : <Copy size={14} />} {copiedLink ? 'Copied' : 'Copy link'}
          </button>
          <button onClick={handlePrint} className="tm-btn tm-btn-primary tm-btn-sm">
            <Printer size={14} /> Print / PDF
          </button>
        </div>

        <header className="mb-6">
          <h1 className="tm-h1">{customTitle}</h1>
          <p className="tm-lead mt-2">{customSubtitle}</p>
          {(isCustomized || lastEditedBy) && (
            <p className="tm-muted mt-2">
              {isCustomized && 'Customised edition'}
              {isCustomized && lastEditedBy && ' · '}
              {lastEditedBy && `Maintained by ${lastEditedBy}`}
            </p>
          )}
          <div className="tm-actions mt-4 print:hidden">
            <button
              onClick={() => setActiveTab('guide')}
              className={`tm-btn tm-btn-sm ${activeTab === 'guide' ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
            >
              How to test
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`tm-btn tm-btn-sm ${activeTab === 'checklist' ? 'tm-btn-primary' : 'tm-btn-secondary'}`}
            >
              Checklist ({completedCount}/{UAT_TESTS.length})
            </button>
          </div>
        </header>

        {activeTab === 'checklist' ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="tm-muted">
                {completedCount} of {UAT_TESTS.length} done ({progressPercent}%)
              </p>
              <button onClick={resetChecklist} className="tm-btn tm-btn-secondary tm-btn-sm">
                <RefreshCw size={14} /> Reset
              </button>
            </div>

            <ul className="tm-divider">
              {UAT_TESTS.map(t => {
                const isChecked = !!completedTests[t.id];
                return (
                  <li key={t.id} className="flex items-start gap-3 border-b border-stone-200 py-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTest(t.id)}
                      aria-label={`${t.id}: ${t.title}`}
                      className="mt-1 h-4 w-4 shrink-0 accent-stone-900"
                    />
                    <details className="min-w-0 flex-1">
                      <summary className={`cursor-pointer break-words font-medium ${isChecked ? 'text-stone-500 line-through' : 'text-stone-900'}`}>
                        {t.id}. {t.title}
                      </summary>
                      <p className="tm-muted mt-1">{t.suite}</p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                        {t.steps.map((st, sIdx) => (
                          <li key={sIdx}>{st}</li>
                        ))}
                      </ol>
                      <p className="mt-2 text-sm">
                        <span className="font-medium text-stone-900">Expect:</span> {t.expected}
                      </p>
                    </details>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <section>
            <h2 className="tm-h2">How to test</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              {GUIDE_STEPS.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-stone-900">Details</summary>
              <p className="tm-muted mt-1">
                Use iOS Safari and Android Chrome. Prices show in MWK (rounded to 1,000) or USD. Payment rails are Airtel Money, TNM Mpamba and bank transfer.
              </p>
            </details>
          </section>
        )}

        <section id="qa-report-form" className="tm-divider mt-10 pt-8">
          <h2 className="tm-h2">Report a problem</h2>

          {submitted ? (
            <div className="tm-panel mt-4">
              <p className="font-medium text-stone-900">Report sent</p>
              <p className="tm-muted mt-1">
                Reference: <span className="font-mono">{submissionId}</span>. The Admin Hub will show it for review.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="qa-name" className="tm-label">Your name</label>
                  <input
                    id="qa-name"
                    type="text"
                    placeholder="Your name"
                    value={formData.testerName}
                    onChange={e => setFormData({ ...formData, testerName: e.target.value })}
                    className="tm-input"
                  />
                </div>
                <div>
                  <label htmlFor="qa-contact" className="tm-label">Phone or email</label>
                  <input
                    id="qa-contact"
                    type="text"
                    placeholder="WhatsApp number or email"
                    value={formData.testerContact}
                    onChange={e => setFormData({ ...formData, testerContact: e.target.value })}
                    className="tm-input"
                  />
                </div>
                <div>
                  <label htmlFor="qa-suite" className="tm-label">Area</label>
                  <select
                    id="qa-suite"
                    value={formData.testSuite}
                    onChange={e => setFormData({ ...formData, testSuite: e.target.value })}
                    className="tm-input"
                  >
                    <option value="Discovery & Search">Discovery &amp; Search</option>
                    <option value="Pricing & Currency">Pricing &amp; Currency (MWK / USD)</option>
                    <option value="WhatsApp Direct Inquiry">WhatsApp Direct Inquiry</option>
                    <option value="Offline Satellite GPS">Offline Satellite GPS</option>
                    <option value="Host tools">Host tools &amp; rates</option>
                    <option value="Mobile UI & Performance">Mobile UI &amp; Performance</option>
                    <option value="General Observation">General Observation</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="qa-sev" className="tm-label">How serious</label>
                  <select
                    id="qa-sev"
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                    className="tm-input"
                  >
                    <option value="Low">Low (cosmetic or text)</option>
                    <option value="Medium">Medium (works, but odd)</option>
                    <option value="High">High (blocks a flow)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="qa-desc" className="tm-label">What happened, and how can we repeat it?</label>
                <textarea
                  id="qa-desc"
                  rows={3}
                  required
                  placeholder="e.g. Switched to MWK on mobile Safari; the booking modal still showed a USD symbol."
                  value={formData.defectSummary}
                  onChange={e => setFormData({ ...formData, defectSummary: e.target.value })}
                  className="tm-input"
                />
              </div>

              <div className="tm-actions">
                <button type="submit" disabled={submitting} className="tm-btn tm-btn-primary">
                  <Send size={14} />
                  {submitting ? 'Sending…' : 'Send report'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset checklist"
        message="Untick every test? This cannot be undone."
        confirmText="Reset"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmResetChecklist}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
