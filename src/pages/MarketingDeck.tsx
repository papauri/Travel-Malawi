import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  Globe, 
  Smartphone, 
  MessageSquare, 
  DollarSign, 
  MapPin, 
  Camera, 
  Copy, 
  Check, 
  Printer, 
  ShieldCheck,
  Award,
  TrendingUp,
  Target,
  Users,
  Compass,
  Calendar,
  Share2,
  PhoneCall,
  Laptop,
  Download,
  FileDown,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../lib/roles';

export default function MarketingDeck() {
  const { user } = useAuth();
  const isGlobalAdmin = isAdmin(user);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    toast.success('Script copied to clipboard!');
    setTimeout(() => setCopiedScript(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-24">
      {/* Top Utility Bar */}
      <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-stone-300 font-medium">Internal Marketing &amp; Operations Executive Brief</span>
          </div>
          <div className="flex items-center gap-4">
            {isGlobalAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-stone-300 hover:text-emerald-300 transition text-xs font-semibold"
                title="Open Admin Executive Strategy Docs Hub (.txt & .md)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Admin Strategy Hub (.txt)</span>
              </Link>
            )}
            <Link to="/host-guide" className="text-stone-400 hover:text-emerald-300 transition text-xs">
              View Host Starter Pack &rarr;
            </Link>
            <button 
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-stone-300 hover:text-white transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-stone-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-xs font-semibold uppercase tracking-wider mb-6">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>Executive Platform &amp; Operations Playbook</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight max-w-4xl">
            The Big Picture: Leading Marketing &amp; Operations for Travel Malawi
          </h1>

          <p className="mt-6 text-stone-300 text-base sm:text-xl max-w-3xl leading-relaxed font-light">
            You were brought on to lead everything outside of coding—host and property acquisition, brand growth, guest concierge, and community partnerships. This playbook gives you the complete picture of our product, value proposition, and operational roadmap.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-stone-400">
            <span className="bg-stone-800/80 px-3 py-1.5 rounded-full border border-stone-700 flex items-center gap-1.5 text-stone-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Code &amp; Technology Ready
            </span>
            <span className="bg-stone-800/80 px-3 py-1.5 rounded-full border border-stone-700 flex items-center gap-1.5 text-stone-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 0% Commission Direct Booking Engine
            </span>
            <span className="bg-stone-800/80 px-3 py-1.5 rounded-full border border-stone-700 flex items-center gap-1.5 text-stone-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Live Google Maps Malawi Autocomplete
            </span>
            <span className="bg-stone-800/80 px-3 py-1.5 rounded-full border border-stone-700 flex items-center gap-1.5 text-stone-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Dual MWK / USD Real-Time Parity
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-16">

        {/* Section 1: The Market Opportunity & Why Online Presence Wins */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">1. The Market Dynamics</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              The Reality of Malawian Tourism Today
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              Malawi has world-class freshwater beaches on Lake Malawi, uncrowded Big 5 wildlife reserves in Liwonde and Majete, and mountain retreats in Mulanje and Zomba. Yet, the hospitality landscape suffers from severe fragmentation:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-4">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-serif font-bold text-stone-900 text-lg">
                  Audience A: International Tourists &amp; Expats (85%+ Advance Bookings)
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Travelers from the UK, US, South Africa, and Europe plan trips 2 to 6 months in advance. If a Malawian lodge is not online with high-res photos and transparent rates, <strong>it simply does not exist to them</strong>. They end up booking big international hotel chains instead of authentic local lodges.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200 text-xs font-semibold text-emerald-800">
                Our Advantage: Editorial showcases with verified USD pricing and direct WhatsApp contact.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold mb-4">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-serif font-bold text-stone-900 text-lg">
                  Audience B: Domestic Weekend Getaways (Lilongwe &amp; Blantyre)
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Local professionals, families, government officials, and NGOs search for weekend breaks on their smartphones. They pay in <strong>Malawian Kwacha (MWK)</strong> using <strong>Airtel Money or TNM Mpamba</strong>. Foreign sites fail them because they charge in foreign currency and hide phone numbers.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200 text-xs font-semibold text-emerald-800">
                Our Advantage: Dual-currency rates and 1-click WhatsApp messaging to the manager.
              </div>
            </div>
          </div>

          {/* Competitive Table */}
          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase font-bold text-stone-500">
                  <th className="py-3 px-4">Feature</th>
                  <th className="py-3 px-4">Booking.com / Agoda</th>
                  <th className="py-3 px-4">Airbnb</th>
                  <th className="py-3 px-4 text-emerald-800 bg-emerald-50 font-bold rounded-t-lg">Travel Malawi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-stone-900">Commission Rate</td>
                  <td className="py-3.5 px-4 text-red-600">15% – 25% per booking</td>
                  <td className="py-3.5 px-4 text-red-600">3% host + ~14% guest</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-emerald-50/60">0% Commission</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-stone-900">Host Payouts</td>
                  <td className="py-3.5 px-4">Held overseas 30–60 days</td>
                  <td className="py-3.5 px-4">Foreign bank / Payoneer</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-emerald-50/60">Direct to Host (Airtel, Mpamba, Bank)</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-stone-900">Guest Communication</td>
                  <td className="py-3.5 px-4">Masked / Prohibited</td>
                  <td className="py-3.5 px-4">Blocked until booked</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-emerald-50/60">Direct WhatsApp &amp; Phone Call</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-stone-900">Currency Support</td>
                  <td className="py-3.5 px-4">Foreign forex conversion fees</td>
                  <td className="py-3.5 px-4">USD converted rates</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-emerald-50/60">Simultaneous MWK &amp; USD Rates</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Real App Capabilities & Visual Proof */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">2. Product Tour &amp; Proof</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Showcasing the Actual Platform
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              When pitching to lodge managers or marketing to travelers, you can show real, verified screens of our live application. All test property names are masked to protect unverified lodges:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            {/* Screen 1: Listings */}
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
                <img 
                  src="/host_app_listing_cards.png" 
                  alt="Guest Discovery Feed" 
                  className="w-full h-auto object-cover"
                />
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">A. Guest Discovery &amp; Rate Parity</h4>
              <p className="text-stone-600 text-xs leading-relaxed">
                Featured lodge cards display real-time dual pricing (e.g. <strong>MK 220,000 / night ($250)</strong>), guest compare badges, and filtered categories (Lake &amp; Beach, Safari &amp; Wildlife, Mountain).
              </p>
            </div>

            {/* Screen 2: Acquisition Banner */}
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
                <img 
                  src="/host_app_acquisition_banner.png" 
                  alt="Host Acquisition Banner" 
                  className="w-full h-auto object-cover"
                />
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">B. The 0% Commission Host Guarantee</h4>
              <p className="text-stone-600 text-xs leading-relaxed">
                Our acquisition banner greets visiting lodge owners with our 0% fee guarantee, instant WhatsApp alerts, and a 1-click link to the Host Starter Pack.
              </p>
            </div>

            {/* Screen 3: Google Maps Autocomplete */}
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
                <img 
                  src="/host_app_google_maps_autocomplete.png" 
                  alt="Google Maps Malawi Autocomplete" 
                  className="w-full h-auto object-cover"
                />
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">C. Live Google Maps Malawi Autocomplete</h4>
              <p className="text-stone-600 text-xs leading-relaxed">
                As lodge owners type their name, our system connects directly to Google Maps across Malawi to auto-populate town, district, and exact GPS coordinates in under 2 seconds.
              </p>
            </div>

            {/* Screen 4: Availability Calendar */}
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
                <img 
                  src="/host_app_availability_calendar.png" 
                  alt="Availability Calendar" 
                  className="w-full h-auto object-cover"
                />
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base">D. Real-Time Availability Calendar</h4>
              <p className="text-stone-600 text-xs leading-relaxed">
                Room cards include a full monthly availability calendar with 1-click date blocking, verified water/power badges, and transparent cancellation terms.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: The Operational Mandate (Your Day-to-Day Responsibilities) */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">3. Operational Mandate</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              The 4 Pillars of Your Role
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              Here is how your weekly workflow breaks down to drive revenue and platform scale:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Pillar 1 */}
            <div className="border border-stone-200 rounded-2xl p-6 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="font-serif font-bold text-stone-900 text-lg">Property &amp; Host Acquisition</h3>
              </div>
              <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                Identify and contact top-tier and mid-tier accommodations across Mangochi, Cape Maclear, Likoma, Zomba, Liwonde, and Lilongwe. Reach out via WhatsApp or phone, pitch the 0% commission advantage, and guide them to list on <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800 text-xs">/list-your-property</code>.
              </p>
              <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500 font-medium">
                Goal: 50 Verified Live Properties in First 60 Days.
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="border border-stone-200 rounded-2xl p-6 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="font-serif font-bold text-stone-900 text-lg">Listing Curation &amp; Quality Control</h3>
              </div>
              <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                Review submitted properties in the <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800 text-xs">/admin</code> dashboard. Audit photography quality using our 5 smartphone photography rules, verify that WhatsApp contact numbers are active, and verify Google Maps location pins before approving.
              </p>
              <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500 font-medium">
                Goal: 100% of approved properties meet high editorial standards.
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="border border-stone-200 rounded-2xl p-6 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="font-serif font-bold text-stone-900 text-lg">Social Media &amp; Audience Growth</h3>
              </div>
              <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                Run our Instagram, TikTok, and Facebook channels. Post short video reels of Lake Malawi sunsets, luxury safari tents, and mountain hikes. Share weekly &quot;Where to Stay This Weekend&quot; roundups for Lilongwe and Blantyre professionals.
              </p>
              <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500 font-medium">
                Goal: 10,000+ targeted Malawian and diaspora followers.
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="border border-stone-200 rounded-2xl p-6 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  4
                </div>
                <h3 className="font-serif font-bold text-stone-900 text-lg">High-Touch Guest Concierge</h3>
              </div>
              <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                Support domestic and international travelers planning trips. Help them arrange 4x4 transfers, boat pickups to Likoma or Domwe Island, and guide them on seasonal weather and road conditions. This builds unmatched brand loyalty.
              </p>
              <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500 font-medium">
                Goal: Fast, friendly support that turns inquiries into confirmed stays.
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Ready-to-Use Outreach Scripts */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">4. Outreach Scripts</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Host &amp; Property Acquisition Pitch Scripts
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              When contacting lodge, B&amp;B, cottage, or guest house owners or general managers, use these battle-tested scripts. Click to copy directly to your clipboard:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Script 1 */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Script 1: WhatsApp</span>
                  <button
                    onClick={() => copyToClipboard(`Hello [Manager Name]! My name is [Your Name], Head of Operations at Travel Malawi (travelmalawi.com). We've launched Malawi's dedicated direct-booking platform connecting domestic and international travelers directly to premier accommodations. Unlike international booking sites that charge 15-20% commission, Travel Malawi is 100% 0% commission. Guests pay you directly via your own Airtel Money, Mpamba, or bank transfer, and inquiries go straight to your WhatsApp. We would love to feature [Lodge Name] at no cost. Would you like me to send the 5-minute listing link, or can I set up your profile for you if you share your rates and photos?`, 'scriptWA')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-emerald-700 bg-white border border-stone-200 px-3 py-1.5 rounded-full transition cursor-pointer"
                  >
                    {copiedScript === 'scriptWA' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript === 'scriptWA' ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>
                <h4 className="font-serif font-bold text-stone-900 text-base mb-2">WhatsApp to Property Host / Reservations</h4>
                <p className="text-stone-600 text-xs sm:text-sm italic leading-relaxed bg-white p-4 rounded-xl border border-stone-200/60 font-mono">
                  &ldquo;Hello [Manager Name]! My name is [Your Name], Head of Operations at Travel Malawi (travelmalawi.com). We&apos;ve launched Malawi&apos;s dedicated direct-booking platform connecting domestic and international travelers directly to premier accommodations. Unlike international booking sites that charge 15-20% commission, Travel Malawi is 100% 0% commission. Guests pay you directly via your own Airtel Money, Mpamba, or bank transfer, and inquiries go straight to your WhatsApp. We would love to feature [Lodge Name] at no cost. Would you like me to send the 5-minute listing link, or can I set up your profile for you if you share your rates and photos?&rdquo;
                </p>
              </div>
            </div>

            {/* Script 2 */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Script 2: Phone Call</span>
                  <button
                    onClick={() => copyToClipboard(`"Good morning! May I speak with the lodge manager or reservations team regarding new guest bookings? ... Hi [Name], my name is [Your Name] with Travel Malawi. We are building the central online home for hospitality in Malawi, helping travelers from Lilongwe, Blantyre, and overseas book stays. We charge 0% commission—you keep 100% of your nightly rates, guests pay you directly into your local mobile money or bank, and guest messages come straight to your reservations WhatsApp. Can I send a quick overview and onboarding link to your WhatsApp number?"`, 'scriptPhone')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-emerald-700 bg-white border border-stone-200 px-3 py-1.5 rounded-full transition cursor-pointer"
                  >
                    {copiedScript === 'scriptPhone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript === 'scriptPhone' ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>
                <h4 className="font-serif font-bold text-stone-900 text-base mb-2">3-Minute Phone Call Pitch</h4>
                <p className="text-stone-600 text-xs sm:text-sm italic leading-relaxed bg-white p-4 rounded-xl border border-stone-200/60 font-mono">
                  &ldquo;Good morning! May I speak with the lodge manager or reservations team regarding new guest bookings? ... Hi [Name], my name is [Your Name] with Travel Malawi. We are building the central online home for hospitality in Malawi, helping travelers from Lilongwe, Blantyre, and overseas book stays. We charge 0% commission—you keep 100% of your nightly rates, guests pay you directly into your local mobile money or bank, and guest messages come straight to your reservations WhatsApp. Can I send a quick overview and onboarding link to your WhatsApp number?&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: First 90 Days Execution Roadmap */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">5. Execution Milestones</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Your First 90-Day Growth Roadmap
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Days 1 – 30</span>
              <h4 className="font-serif font-bold text-stone-900 text-lg mt-1">Anchor Acquisition</h4>
              <ul className="mt-3 space-y-2 text-xs text-stone-600 leading-relaxed">
                <li>&bull; Onboard 25 anchor lodges across Cape Maclear, Mangochi, and Lilongwe.</li>
                <li>&bull; Audit photography and verify Google Maps pins for each stay.</li>
                <li>&bull; Launch official Instagram and Facebook channels with high-res lodge photography.</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Days 31 – 60</span>
              <h4 className="font-serif font-bold text-stone-900 text-lg mt-1">Audience Expansion</h4>
              <ul className="mt-3 space-y-2 text-xs text-stone-600 leading-relaxed">
                <li>&bull; Expand to 60 properties including Liwonde, Majete, and Zomba.</li>
                <li>&bull; Run targeted Facebook/Instagram ad campaigns aimed at weekend travelers in Lilongwe &amp; Blantyre.</li>
                <li>&bull; Partner with local 4x4 car rental companies in Lilongwe and Blantyre.</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Days 61 – 90</span>
              <h4 className="font-serif font-bold text-stone-900 text-lg mt-1">Ecosystem Dominance</h4>
              <ul className="mt-3 space-y-2 text-xs text-stone-600 leading-relaxed">
                <li>&bull; Reach 100+ active properties across all regions of Malawi.</li>
                <li>&bull; Partner with Ulendo Airlink and domestic tour operators.</li>
                <li>&bull; Publish seasonal guides (e.g. &quot;Top 10 Lake Malawi Beach Cottages for Easter&quot;).</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 8: Downloadable Strategic Resources (RESTRICTED TO GLOBAL ADMIN) */}
        <section className="p-8 sm:p-10 rounded-3xl bg-white border border-stone-200/90 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Restricted Access &bull; Global Admin Only</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1 tracking-tight">
                Executive Strategy &amp; Operations Documentation
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                Internal strategic documents available in clean readable text format (.txt) or markdown, protected from public exposure.
              </p>
            </div>

            {isGlobalAdmin && (
              <Link
                to="/admin"
                className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <span>Open Admin Strategy Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {isGlobalAdmin ? (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Card 1: Marketing Presentation Deck */}
              <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between hover:border-stone-300 transition">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-4">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif font-bold text-stone-900 text-lg">Marketing Strategy Deck</h4>
                  <p className="text-xs font-mono text-emerald-700 mt-0.5">marketing_presentation.txt</p>
                  <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                    Executive market sizing, audience personas, competitive benchmarks, and the 30-60-90 day growth engine formatted for instant reading.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-stone-200 flex items-center gap-2">
                  <a
                    href="/api/admin/docs/marketing-presentation?format=text&download=1"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    title="Download clean plain text (.txt)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .TXT</span>
                  </a>
                  <a
                    href="/api/admin/docs/marketing-presentation?format=md&download=1"
                    className="py-2 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 rounded-xl text-xs font-semibold transition"
                    title="Download raw markdown (.md)"
                  >
                    .MD
                  </a>
                </div>
              </div>

              {/* Card 2: Operations Starter Pack */}
              <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between hover:border-stone-300 transition">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold mb-4">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif font-bold text-stone-900 text-lg">Operations Starter Pack</h4>
                  <p className="text-xs font-mono text-blue-700 mt-0.5">operations_starter_pack.txt</p>
                  <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                    Complete operational playbook for onboarding lodges, field acquisition protocols, pricing rules, and WhatsApp templates.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-stone-200 flex items-center gap-2">
                  <a
                    href="/api/admin/docs/operations-starter-pack?format=text&download=1"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    title="Download clean plain text (.txt)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .TXT</span>
                  </a>
                  <a
                    href="/api/admin/docs/operations-starter-pack?format=md&download=1"
                    className="py-2 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 rounded-xl text-xs font-semibold transition"
                    title="Download raw markdown (.md)"
                  >
                    .MD
                  </a>
                </div>
              </div>

              {/* Card 3: Host Onboarding Starter Pack */}
              <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between hover:border-stone-300 transition">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-4">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif font-bold text-stone-900 text-lg">Host Onboarding Starter Pack</h4>
                  <p className="text-xs font-mono text-amber-700 mt-0.5">host_onboarding_starter_pack.txt</p>
                  <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                    Host guide explaining online presence benefits, 8-minute listing walkthroughs, smartphone photography tips, and FAQs.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-stone-200 flex items-center gap-2">
                  <a
                    href="/api/admin/docs/host-onboarding-pack?format=text&download=1"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    title="Download clean plain text (.txt)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .TXT</span>
                  </a>
                  <a
                    href="/api/admin/docs/host-onboarding-pack?format=md&download=1"
                    className="py-2 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 rounded-xl text-xs font-semibold transition"
                    title="Download raw markdown (.md)"
                  >
                    .MD
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-stone-50 border border-stone-200 text-center max-w-xl mx-auto my-4">
              <div className="w-12 h-12 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 text-stone-500" />
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-base sm:text-lg">
                Confidential Strategic Documentation
              </h4>
              <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
                The full executive strategy decks, operations starter packs, and raw documentation are restricted exclusively to Global Administrators.
              </p>
              <div className="mt-5">
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <span>Sign In as Global Admin</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Bottom CTA Banner */}
        <section className="rounded-3xl bg-stone-900 text-white p-8 sm:p-12 border border-stone-800 text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto relative z-10">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Let&apos;s Build Together</span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mt-3 tracking-tight">
              Ready to Take Malawi&apos;s Tourism to the Next Level?
            </h2>
            <p className="text-stone-300 text-sm sm:text-base mt-3 leading-relaxed">
              Explore the host onboarding guide, check out the live properties on the homepage, or open the admin portal to manage listings.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/host-guide"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-8 py-4 rounded-full text-base transition shadow-lg active:scale-95"
              >
                <span>Explore Host Starter Pack</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/admin"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white font-medium px-6 py-4 rounded-full text-base transition border border-stone-700"
              >
                <span>Open Admin Portal</span>
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
