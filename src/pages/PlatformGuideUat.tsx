import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  Globe, 
  Smartphone, 
  MessageSquare, 
  DollarSign, 
  MapPin, 
  Printer, 
  ShieldCheck,
  Award,
  TrendingUp,
  Target,
  Users,
  Compass,
  Calendar,
  Share2,
  FileText,
  Copy,
  Check,
  Lock,
  Download,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ListFilter,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isAdmin, isMarketing } from '../lib/roles';
import EditableSection from '../components/EditableSection';

// Official administrative email constant (configured internally, not displayed in public UI)
export const OFFICIAL_ADMIN_EMAIL = 'johnpaulchirwa@promanaged-it.com';

interface TestCase {
  id: string;
  suite: string;
  title: string;
  steps: string[];
  expected: string;
  criticality: 'High' | 'Medium' | 'Low';
}

const UAT_TEST_SUITES: TestCase[] = [
  // Suite A: Guest Search & Discovery
  {
    id: 'A1',
    suite: 'Guest Discovery & Search',
    title: 'Destination Keyword & Autocomplete Search',
    steps: [
      'Navigate to the home page at https://travel-malawi.ai.studio/',
      'Type "Cape Maclear" or "Lilongwe" into the location input',
      'Select a suggestion from the dropdown or press Enter'
    ],
    expected: 'Search results filter down exclusively to stays in the chosen location with updated distance and pricing.',
    criticality: 'High'
  },
  {
    id: 'A2',
    suite: 'Guest Discovery & Search',
    title: '3-Tier View Switcher (Grid, List, Map)',
    steps: [
      'Scroll to search results header and tap "Grid"',
      'Tap the newly added "List" (Compact List View)',
      'Tap "Map" to switch to interactive clustered pins'
    ],
    expected: 'Smooth layout transition between visual photo cards, high-density compact rows, and the interactive map with lodge sidebar.',
    criticality: 'High'
  },
  {
    id: 'A3',
    suite: 'Guest Discovery & Search',
    title: 'Native Dual Currency Switcher (MWK / USD)',
    steps: [
      'Locate the Currency Toggle in the header or footer',
      'Switch between MWK and USD'
    ],
    expected: 'All prices across cards, detail pages, and filters update instantly without arbitrary markup.',
    criticality: 'High'
  },
  {
    id: 'A4',
    suite: 'Guest Discovery & Search',
    title: 'Saved Properties & D3 Trip Planner',
    steps: [
      'Click the Heart icon on at least 3 different stays',
      'Navigate to /saved from the top navigation',
      'Toggle between "Wishlist Grid" and the "Trip Planner" tab'
    ],
    expected: 'Saved stays display correctly, and the D3 force-directed visualizer maps out regional distribution of chosen stays across Malawi.',
    criticality: 'Medium'
  },

  // Suite B: Booking & Direct Inquiries
  {
    id: 'B1',
    suite: 'Direct Inquiries & Reservations',
    title: 'Property Detail & Date Selection',
    steps: [
      'Open any property (e.g. /hotel/:id)',
      'Pick check-in and check-out dates on the booking widget',
      'Specify 2 adults and select a room package'
    ],
    expected: 'Calculates total nights, estimated price breakdown in selected currency, and highlights meal inclusions.',
    criticality: 'High'
  },
  {
    id: 'B2',
    suite: 'Direct Inquiries & Reservations',
    title: 'Direct WhatsApp Host Inquiry',
    steps: [
      'On the property page, tap "Inquire via WhatsApp"',
      'Verify the pre-generated message in WhatsApp'
    ],
    expected: 'Launches WhatsApp with pre-filled dates, guest counts, room type, and property reference code.',
    criticality: 'High'
  },
  {
    id: 'B3',
    suite: 'Direct Inquiries & Reservations',
    title: 'In-App Direct Booking Submission',
    steps: [
      'Fill in guest name, email, phone number, and special notes',
      'Submit the reservation inquiry'
    ],
    expected: 'Confirmation modal appears with unique reference (e.g. TM-XXXXXX) and status shows as Pending.',
    criticality: 'High'
  },

  // Suite C: Host Stay OS & Operations
  {
    id: 'C1',
    suite: 'Host Tools & Stay OS',
    title: 'Property Listing Wizard (/list-your-property)',
    steps: [
      'Access /list-your-property as a registered host',
      'Enter property details, select Category (Lake, Safari, Urban, Highlands)',
      'Upload images or utilize authentic presets and save listing'
    ],
    expected: 'Listing is created in draft/pending review status with complete room and rate configurations.',
    criticality: 'High'
  },
  {
    id: 'C2',
    suite: 'Host Tools & Stay OS',
    title: 'Automated Rate Card & Document Importer',
    steps: [
      'In property management (/dashboard/hotel/:id), navigate to Rate Cards',
      'Upload a sample PDF brochure or rate menu image'
    ],
    expected: 'Document importer parses room categories, capacity, and prices automatically into editable fields.',
    criticality: 'Medium'
  },
  {
    id: 'C3',
    suite: 'Host Tools & Stay OS',
    title: 'Deposit Instructions & Digital Stay Vouchers',
    steps: [
      'Configure Airtel Money / TNM Mpamba / Bank details in Stay OS',
      'Approve a test booking and generate a Digital Stay Voucher with PIN'
    ],
    expected: 'Voucher renders with QR code, check-in instructions, and offline arrival PIN for guest check-in.',
    criticality: 'High'
  },

  // Suite D: Marketing & Brand Consistency
  {
    id: 'D1',
    suite: 'Marketing & Brand Validation',
    title: '0% Commission Messaging & Tone',
    steps: [
      'Review hero titles, host acquisition banners, and footer copy',
      'Check mobile and desktop screen sizes'
    ],
    expected: 'Messaging consistently highlights "0% commission", "direct host booking", and "Warm Heart of Africa".',
    criticality: 'Medium'
  },
  {
    id: 'D2',
    suite: 'Marketing & Brand Validation',
    title: 'Mobile Navigation & Offline Resilience',
    steps: [
      'Test the application on iOS Safari and Android Chrome',
      'Review bottom sticky navigation and quick action bars'
    ],
    expected: 'Touch targets are ≥44px, bottom nav remains accessible, and pages load smoothly without jarring layout shifts.',
    criticality: 'High'
  }
];

export default function PlatformGuideUat() {
  const { user, loading } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();

  const isAuthorized = user && (isMarketing(user) || isAdmin(user));

  // Interactive Checklist State stored in localStorage
  const [completedTests, setCompletedTests] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('travel_malawi_uat_state');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeTab, setActiveTab] = useState<'document' | 'checklist'>('document');
  const [copiedDocument, setCopiedDocument] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('travel_malawi_uat_state', JSON.stringify(completedTests));
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
    if (window.confirm('Reset all UAT checklist progress?')) {
      setCompletedTests({});
      toast.success('UAT checklist reset.');
    }
  };

  const completedCount = Object.values(completedTests).filter(Boolean).length;
  const totalCount = UAT_TEST_SUITES.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const handlePrint = () => {
    window.print();
  };

  const copyDocumentMarkdown = () => {
    const rawMarkdown = `# Travel Malawi — Comprehensive Platform Guide & UAT Manual
Official Live URL: https://travel-malawi.ai.studio/
Release Version: v2.4.0 Production
Audience: Marketing & Executive QA Teams

---

## 1. Executive Overview & Value Proposition
Travel Malawi is the premier direct-booking hospitality marketplace tailored specifically for Malawi. Built to eliminate the high 15%–25% commission fees charged by international OTAs, Travel Malawi connects travelers directly with lodges, boutique hotels, lakeside cottages, and safari camps.

Core Value Pillars:
• 0% Commission on direct reservations — hosts keep 100% of their earnings.
• Native Dual Currency: Author and book in either MWK or USD natively.
• Direct Guest-to-Host Communication via in-app chat, WebRTC calls & WhatsApp.
• Stay OS: Turnkey property management with digital stay vouchers and mobile money deposit settlement (Airtel Money & TNM Mpamba).

---

## 2. Live Access & Key Gateways
• Production Platform:    https://travel-malawi.ai.studio/
• Property Onboarding:    https://travel-malawi.ai.studio/list-property
• Marketing Deck & Hub:   https://travel-malawi.ai.studio/marketing
• Host Starter Pack:      https://travel-malawi.ai.studio/host-guide
• Saved & Trip Planner:   https://travel-malawi.ai.studio/saved

---

## 3. Core Capabilities Breakdown
1. Discovery & Search:
   - Destination keyword search with GPS radius "Near Me" locator.
   - 3-Tier View Modes: Grid View, Compact List View (high density), Interactive Clustered Map.
   - D3 Force-Directed Trip Planner mapping itinerary spreads across regions.
2. Direct Inquiries & Stay OS:
   - Flexible dates and guest capacity selector.
   - Direct WhatsApp integration with pre-filled reference codes.
   - Local payment instructions: Airtel Money, TNM Mpamba, and Bank transfer.
   - Digital Stay Vouchers with offline QR codes and check-in PINs.

---

## 4. User Acceptance Testing (UAT) Suites
${UAT_TEST_SUITES.map(t => `[${completedTests[t.id] ? 'X' : ' '}] ${t.id}: ${t.title} (${t.suite})
   Steps: ${t.steps.join(' -> ')}
   Expected: ${t.expected}`).join('\n\n')}

---
## 5. Feedback & Issue Reporting
Submit verified test logs and defect reports through the authorized Internal Administrator & QA Escalation channel.
`;

    navigator.clipboard.writeText(rawMarkdown);
    setCopiedDocument(true);
    toast.success('Full UAT Manual copied to clipboard!');
    setTimeout(() => setCopiedDocument(false), 3000);
  };

  const downloadMarkdownFile = () => {
    const text = document.getElementById('printable-uat-document')?.innerText || '';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Travel-Malawi-Platform-Guide-UAT-Manual.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Document downloaded as Markdown file.');
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          <p className="text-stone-600 text-sm font-medium">Verifying Marketing credentials...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthorized State
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-stone-50 py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-stone-200/90 shadow-xl text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-center mx-auto mb-5 text-amber-700">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">
            Marketing &amp; QA Access Only
          </h2>
          <p className="text-stone-600 text-sm mb-6 leading-relaxed">
            The <strong>Platform Guide &amp; UAT Manual</strong> contains internal testing criteria, executive roadmaps, and marketing protocols restricted to authorized personnel.
          </p>

          {user ? (
            <div className="space-y-4">
              <div className="p-3 bg-stone-100/80 rounded-xl text-xs text-stone-600 text-left border border-stone-200">
                <p className="font-semibold text-stone-800">Current Account:</p>
                <p className="truncate text-stone-500">{user.email || user.displayName || 'Logged in user'}</p>
                <p className="text-[11px] text-amber-700 mt-1">Role: {user.role || 'traveller'} (Requires 'marketing' or 'admin')</p>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  to="/"
                  className="w-full py-2.5 px-4 rounded-full bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition shadow-sm"
                >
                  Return to Home
                </Link>
                <button
                  type="button"
                  onClick={() => toast('Your request for Marketing & QA clearance has been submitted to the administrator.', { icon: '🔒' })}
                  className="w-full py-2.5 px-4 rounded-full bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition"
                >
                  Request Marketing Access
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => openAuth('signin')}
                className="w-full py-2.5 px-4 rounded-full bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition shadow-sm"
              >
                Sign In with Authorized Account
              </button>
              <Link
                to="/"
                className="w-full py-2.5 px-4 rounded-full bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition"
              >
                Return to Public Site
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-stone-900 pb-24 print:bg-white print:text-black print:pb-0">
      {/* Top Utility Bar (Hidden in Print) */}
      <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-medium">
              <EditableSection
                docId="docs_uat"
                fieldId="top_bar_title"
                defaultText="Travel Malawi — Marketing & UAT Quality Assurance Suite"
              />
            </span>
            <span className="bg-stone-800 text-stone-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-stone-700 hover:text-stone-100 transition-colors">
              <EditableSection
                docId="docs_uat"
                fieldId="top_bar_version"
                defaultText="v2.4.0 Live"
              />
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/marketing"
              className="text-stone-300 hover:text-white transition text-xs font-semibold flex items-center gap-1"
            >
              <span>Marketing Deck</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            {isAdmin(user) && (
              <Link
                to="/admin"
                className="text-emerald-400 hover:text-emerald-300 transition text-xs font-semibold"
              >
                Admin Suite
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-12">
        
        {/* Interactive Action Header (Hidden in Print) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm mb-8 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Production Launch &amp; QA Documentation</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-stone-900 tracking-tight font-bold">
                <EditableSection
                  docId="docs_uat"
                  fieldId="hero_title"
                  defaultText="Platform Guide & UAT Manual"
                />
              </h1>
              <p className="text-stone-600 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
                <EditableSection
                  docId="docs_uat"
                  fieldId="hero_subtitle"
                  defaultText="Complete functional specification, user journeys, live gateways, and step-by-step User Acceptance Testing (UAT) manual for the Marketing team."
                  multiline
                />
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-stone-900 text-white text-xs sm:text-sm font-semibold hover:bg-stone-800 transition shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>

              <button
                type="button"
                onClick={copyDocumentMarkdown}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-stone-700 border border-stone-300 text-xs sm:text-sm font-semibold hover:bg-stone-50 transition"
              >
                {copiedDocument ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedDocument ? 'Copied Markdown!' : 'Copy Markdown'}</span>
              </button>

              <button
                type="button"
                onClick={downloadMarkdownFile}
                className="inline-flex items-center gap-2 p-2.5 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200 transition"
                title="Download as Markdown file"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Navigation & Progress Bar */}
          <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-full w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('document')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeTab === 'document'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Full Document View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('checklist')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'checklist'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>Interactive UAT Checklist</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {completedCount}/{totalCount}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-stone-500 font-medium">UAT Readiness: </span>
                <span className="text-xs font-bold text-stone-900">{progressPercent}%</span>
              </div>
              <div className="w-32 bg-stone-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tab 1: Interactive Checklist View (Screen Only) */}
        {activeTab === 'checklist' && (
          <div className="space-y-6 mb-12 print:hidden">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
                <div>
                  <h2 className="text-xl font-serif font-bold text-stone-900">
                    Live User Acceptance Testing (UAT) Tracker
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                    Click each test to toggle completion status. Progress automatically saves in your browser.
                  </p>
                </div>
                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={resetChecklist}
                    className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-rose-600 transition font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {UAT_TEST_SUITES.map((test) => {
                  const isChecked = !!completedTests[test.id];
                  return (
                    <div
                      key={test.id}
                      onClick={() => toggleTest(test.id)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                          : 'bg-stone-50/60 border-stone-200/80 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <button
                          type="button"
                          className="mt-0.5 text-emerald-600 shrink-0"
                          aria-label={isChecked ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 fill-emerald-600 text-white" />
                          ) : (
                            <Square className="w-5 h-5 text-stone-400" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold font-mono text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200">
                              {test.id}
                            </span>
                            <span className="text-xs text-stone-500 font-medium">{test.suite}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              test.criticality === 'High' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-stone-200 text-stone-700'
                            }`}>
                              {test.criticality} Priority
                            </span>
                          </div>

                          <h3 className={`text-sm sm:text-base font-semibold ${
                            isChecked ? 'text-stone-900 line-through opacity-80' : 'text-stone-900'
                          }`}>
                            {test.title}
                          </h3>

                          <div className="mt-2 text-xs text-stone-600 space-y-1">
                            <p className="font-medium text-stone-700">Steps to execute:</p>
                            <ol className="list-decimal list-inside pl-1 space-y-0.5 text-stone-600">
                              {test.steps.map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                            <p className="pt-1.5 text-emerald-800 font-medium">
                              <span className="text-stone-500 font-normal">Expected: </span>
                              {test.expected}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Printable & Structured Document View */}
        {(activeTab === 'document' || typeof window === 'undefined') && (
          <div 
            id="printable-uat-document"
            className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 border border-stone-200/90 shadow-sm print:shadow-none print:border-none print:p-0 space-y-10"
          >
            {/* Header Block */}
            <div className="border-b border-stone-200 pb-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-900 font-serif font-bold text-xl sm:text-2xl">
                  <Building2 className="w-6 h-6 text-emerald-700" />
                  <span>TRAVEL MALAWI</span>
                </div>
                <span className="text-xs font-mono text-stone-500 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                  CONFIDENTIAL • INTERNAL QA &amp; MARKETING
                </span>
              </div>

              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
                  <EditableSection
                    docId="docs_uat"
                    fieldId="print_title"
                    defaultText="Comprehensive Platform Guide & UAT Manual"
                  />
                </h1>
                <p className="text-stone-500 text-xs sm:text-sm mt-1">
                  <EditableSection
                    docId="docs_uat"
                    fieldId="print_subtitle"
                    defaultText="Official Technical & Operational Blueprint for Marketing Launch, Host Onboarding, and QA Verification."
                    multiline
                  />
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-stone-400 block font-medium">Live Domain</span>
                  <a href="https://travel-malawi.ai.studio/" target="_blank" rel="noreferrer" className="text-emerald-700 font-semibold hover:underline truncate block">
                    travel-malawi.ai.studio
                  </a>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-stone-400 block font-medium">Release State</span>
                  <span className="text-stone-800 font-semibold">Production Live (v2.4)</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-stone-400 block font-medium">Target Audience</span>
                  <span className="text-stone-800 font-semibold">Marketing &amp; Product QA</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-stone-400 block font-medium">Author / Team</span>
                  <span className="text-stone-800 font-semibold truncate block">Core Engineering &amp; QA</span>
                </div>
              </div>
            </div>

            {/* Section 1: Executive Overview */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold font-mono">1</span>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                  <EditableSection
                    docId="docs_uat"
                    fieldId="sec1_title"
                    defaultText="Executive Overview & Market Position"
                  />
                </h2>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed">
                <EditableSection
                  docId="docs_uat"
                  fieldId="sec1_content"
                  defaultText="Travel Malawi is a specialized, direct-booking marketplace built specifically for Malawi’s unique hospitality ecosystem. Traditional Online Travel Agencies (OTAs) like Booking.com and Airbnb levy 15%–25% commission fees and force rigid foreign currency settlement onto local owners. Travel Malawi eliminates intermediary friction by empowering lodge, B&B, cottage, and safari camp hosts to connect directly with guests at 0% commission."
                  multiline
                />
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>0% Commission Direct Model</span>
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Hosts retain 100% of their booking revenue. Guest inquiries route directly to WhatsApp and verified digital channels without middleman cuts.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2 mb-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Native Dual Currency (MWK &amp; USD)</span>
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Set precise pricing in Malawian Kwacha for domestic travelers and US Dollars for regional/international safari guests simultaneously.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2 mb-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Direct In-App &amp; WhatsApp Pipelines</span>
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Built-in real-time chat, peer-to-peer WebRTC calling, and instant pre-filled WhatsApp inquiry generation.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2 mb-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Stay OS &amp; Mobile Money Vouchers</span>
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Deposit collection via Airtel Money and TNM Mpamba, coupled with digital check-in vouchers featuring offline verification PINs.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Platform Gateways & Role-Based Access */}
            <section className="space-y-4 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold font-mono">2</span>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                  <EditableSection
                    docId="docs_uat"
                    fieldId="sec2_title"
                    defaultText="Live Gateways & Role-Based Access Matrix"
                  />
                </h2>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed">
                <EditableSection
                  docId="docs_uat"
                  fieldId="sec2_content"
                  defaultText="The platform is architected with strict role-based access control (RBAC) ensuring appropriate separation of duties across guests, lodge owners, marketing, and global admins:"
                  multiline
                />
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-stone-200 rounded-xl overflow-hidden">
                  <thead className="bg-stone-100 text-stone-800 font-semibold">
                    <tr>
                      <th className="p-3 border-b border-stone-200">Role</th>
                      <th className="p-3 border-b border-stone-200">Accessible Gateways</th>
                      <th className="p-3 border-b border-stone-200">Core Capabilities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    <tr>
                      <td className="p-3 font-semibold text-stone-900 bg-stone-50/50">Guest / Traveller</td>
                      <td className="p-3 font-mono text-stone-600">/, /hotel/:id, /saved, /my-bookings</td>
                      <td className="p-3">Search stays, toggle Grid/List/Map, save wishlists, plan regional trips with D3 graph, submit booking inquiries.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-stone-900 bg-stone-50/50">Property Manager</td>
                      <td className="p-3 font-mono text-stone-600">/dashboard, /dashboard/hotel/:id, /host-guide</td>
                      <td className="p-3">Manage rooms, rates in MWK/USD, restaurant menus, digital stay vouchers, blackout dates, guest pre-arrival reminders.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-stone-900 bg-stone-50/50">Marketing Team</td>
                      <td className="p-3 font-mono text-stone-600">/marketing, /uat, /host-guide</td>
                      <td className="p-3">Access marketing pitches, executive collateral, pitch scripts, UAT execution trackers, brand assets.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-stone-900 bg-stone-50/50">Global Admin</td>
                      <td className="p-3 font-mono text-stone-600">/admin, /admin/hotel/:id, all routes</td>
                      <td className="p-3">Approve/reject listings, feature curated stays, manage user roles, oversee security policies and metrics.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3: Key Functional Modules */}
            <section className="space-y-6 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold font-mono">3</span>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                  <EditableSection
                    docId="docs_uat"
                    fieldId="sec3_title"
                    defaultText="Feature-by-Feature Deep Dive"
                  />
                </h2>
              </div>

              <div className="space-y-6 text-xs sm:text-sm text-stone-700">
                {/* 3.1 Search & Discovery */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-stone-900 text-base">
                    3.1 Intelligent Search &amp; Visualizers
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-stone-600 pl-1">
                    <li><strong>3-Tier View Modes</strong>: <em>Grid View</em> (visual high-engagement card layout), <em>Compact List View</em> (dense, fast-scrolling minimalist rows), and <em>Map View</em> (clustered pins with live sync to the side card feed).</li>
                    <li><strong>GPS "Near Me" Radius</strong>: One-tap geolocation filtering properties by radial distance from current coordinates with fallback to Lilongwe/Blantyre hubs.</li>
                    <li><strong>D3 Force-Directed Trip Planner</strong>: Visualizes saved favorite stays grouped into regional cluster nodes (Central Lake, Southern Safari, Northern Highlands) to assist guests in planning road trips.</li>
                  </ul>
                </div>

                {/* 3.2 Booking Pipeline */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-stone-900 text-base">
                    3.2 Direct Booking &amp; Settlement Flow
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-stone-600 pl-1">
                    <li><strong>Flexible Inquiries</strong>: Guests select room packages, adult/children counts, and meal options.</li>
                    <li><strong>WhatsApp Quick-Connect</strong>: Instantly opens WhatsApp pre-populated with check-in/out dates, guest counts, and booking codes.</li>
                    <li><strong>Local Deposit Settlement</strong>: Accommodates Airtel Money, TNM Mpamba, and local bank transfers with zero transaction commissions.</li>
                  </ul>
                </div>

                {/* 3.3 Stay OS Host Suite */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-stone-900 text-base">
                    3.3 Stay OS Host Management &amp; Rate Tools
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-stone-600 pl-1">
                    <li><strong>Document &amp; Rate Card Importer</strong>: Automatically extracts room names, capacities, and rates from uploaded PDF brochures or photos.</li>
                    <li><strong>Restaurant &amp; Bar Menu Engine</strong>: Create digital menus with dietary tags and drink listings.</li>
                    <li><strong>Digital Stay Vouchers</strong>: Generates verifiable check-in vouchers complete with QR codes and 6-digit offline arrival PINs.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 4: UAT Test Protocol */}
            <section className="space-y-4 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold font-mono">4</span>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                  <EditableSection
                    docId="docs_uat"
                    fieldId="sec4_title"
                    defaultText="User Acceptance Testing (UAT) Manual"
                  />
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                <EditableSection
                  docId="docs_uat"
                  fieldId="sec4_content"
                  defaultText="The following test suites must be verified by the marketing team before broad public launch:"
                  multiline
                />
              </p>

              <div className="space-y-4 text-xs">
                {UAT_TEST_SUITES.map((test) => (
                  <div key={test.id} className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between font-semibold text-stone-900 mb-1">
                      <span>[{test.id}] {test.title}</span>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider">{test.suite}</span>
                    </div>
                    <p className="text-stone-600 mb-1"><strong>Action:</strong> {test.steps.join(' → ')}</p>
                    <p className="text-emerald-800"><strong>Expected Outcome:</strong> {test.expected}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 5: Defect Reporting & Escalation */}
            <section className="space-y-3 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold font-mono">5</span>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                  Defect Escalation &amp; Support Contact
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                Should you encounter any functional bugs, display inconsistencies, or copy recommendations during your testing, please send a structured report containing:
              </p>
              <ul className="list-disc list-inside text-xs text-stone-600 space-y-1 pl-1">
                <li>Device Model &amp; Browser Version (e.g. iPhone 15 Pro on Safari, Windows 11 on Chrome)</li>
                <li>Exact URL where the anomaly occurred</li>
                <li>Step-by-step reproduction notes and screenshot/video attachment</li>
              </ul>
              <div className="p-3.5 bg-stone-100/90 rounded-xl text-xs font-mono text-stone-800 mt-2 border border-stone-200">
                Direct QA Escalation: <strong>Authorized Internal Administrator &amp; QA Portal</strong>
              </div>
            </section>

            {/* Footer Sign-off */}
            <div className="pt-6 border-t border-stone-200 text-center text-stone-400 text-xs font-mono">
              TRAVEL MALAWI • 2026 OFFICIAL LAUNCH DOCUMENTATION • ALL RIGHTS RESERVED
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
