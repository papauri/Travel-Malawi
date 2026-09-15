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
  Lock,
  KeyRound,
  LayoutDashboard,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isHotelManager } from '../lib/roles';
import EditableSection from '../components/EditableSection';

export default function HostStarterPack() {
  const { user, becomeHost, loading: authLoading } = useAuth();
  const { openAuth } = useAuthDialog();
  const [activating, setActivating] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const isManager = isHotelManager(user);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(id);
    toast.success('Template copied to clipboard!');
    setTimeout(() => setCopiedTemplate(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleActivateHost = async () => {
    setActivating(true);
    try {
      await becomeHost();
      toast.success('Property Owner tools activated! Welcome to the Host Starter Pack.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate property owner status.');
    } finally {
      setActivating(false);
    }
  };

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-800" />
      </div>
    );
  }

  // 2. Gated State: User is not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-800 pb-20">
        <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-stone-400" />
              <span className="text-stone-300 font-medium">Host Onboarding Resource for Hotels, Resorts, Lodges, B&amp;Bs &amp; Stays</span>
            </div>
            <span className="text-stone-400 text-xs">Property Owner Access Only</span>
          </div>
        </div>

        <header className="relative bg-stone-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <Lock className="w-3.5 h-3.5 text-stone-400" />
              <span>Host Only Resource</span>
            </div>
            
            <h1 className="font-serif text-3xl sm:text-5xl text-white tracking-tight leading-tight">
              Host Starter Pack &amp; Toolkit
            </h1>
            
            <p className="mt-4 text-stone-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed font-light">
              This comprehensive onboarding guide, WhatsApp template kit, and rate worksheets are available exclusively to registered Property Owners.
            </p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                  Property Owner Account Required
                </h2>
                <p className="text-xs text-stone-500">
                  Distinguishing Guest booking access vs Property Owner management tools
                </p>
              </div>
            </div>

            <p className="text-sm text-stone-600 leading-relaxed">
              Travel Malawi distinguishes between Guest accounts (for travelers looking to explore, save, and book stays) and Property Owner accounts (for hosts of hotels, resorts, lodges, B&amp;Bs, cottages, guest houses, and safari camps).
            </p>

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                <div className="font-bold text-stone-900 flex items-center justify-between">
                  <span>Guest Account</span>
                  <span className="text-[10px] font-normal text-stone-500 uppercase">Traveler</span>
                </div>
                <ul className="text-stone-600 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Browse stays, B&amp;Bs &amp; direct host chats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Save favorites &amp; booking vouchers</span>
                  </li>
                  <li className="text-stone-400 italic">
                    (Starter pack &amp; dashboard not included)
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-stone-900 text-white border border-stone-800 text-xs space-y-2">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Property Owner Account</span>
                  <span className="text-[10px] font-semibold text-stone-300 uppercase">Host</span>
                </div>
                <ul className="text-stone-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Full Host Starter Pack &amp; WhatsApp templates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Host Dashboard: inventory &amp; rates manager</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>0% commission direct Malawian bookings</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => openAuth('host')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition shadow-sm cursor-pointer"
              >
                <span>Sign Up as Property Owner</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-6 py-3.5 rounded-full text-sm transition border border-stone-200 cursor-pointer"
              >
                <span>Sign In to Existing Account</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Gated State: User is logged in as a Guest (not a Hotel Manager)
  if (!isManager) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-800 pb-20">
        <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-stone-400" />
              <span className="text-stone-300 font-medium">Host Onboarding Resource for Malawian Stays</span>
            </div>
            <span className="text-stone-400 text-xs">Property Owner Access Only</span>
          </div>
        </div>

        <header className="relative bg-stone-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <UserCheck className="w-3.5 h-3.5 text-stone-400" />
              <span>Signed In as Guest</span>
            </div>
            
            <h1 className="font-serif text-3xl sm:text-5xl text-white tracking-tight leading-tight">
              Enable Property Owner Account
            </h1>
            
            <p className="mt-4 text-stone-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed font-light">
              You are currently signed in with a Guest account ({user.email}). Activate your host permissions to access the Host Starter Pack and Dashboard.
            </p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
              Ready to host with Travel Malawi?
            </h2>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Switching your profile to a Property Owner is instant and free. You will keep all your existing traveler bookings and favorites while gaining access to the complete host suite.
            </p>

            <div className="mt-6 p-5 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2.5">
              <div className="font-bold text-stone-900 text-sm">Host Tools Unlocked Upon Activation:</div>
              <ul className="text-stone-700 space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-900 shrink-0" />
                  <span><strong>Host Starter Pack</strong>: Instant access to copyable templates, onboarding checklist &amp; rate guide</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-900 shrink-0" />
                  <span><strong>Host Dashboard</strong>: Room inventory management, online status toggles &amp; direct bookings</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-stone-900 shrink-0" />
                  <span><strong>0% Commission Listing</strong>: Keep 100% of your earnings with direct WhatsApp inquiries</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleActivateHost}
                disabled={activating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4 text-stone-300" />
                <span>{activating ? 'Activating Host Tools…' : 'Activate Property Owner Account (Free)'}</span>
              </button>
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-6 py-3.5 rounded-full text-sm transition border border-stone-200"
              >
                <span>Back to Stays</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 4. Authenticated Host View: User is signed in and is a Hotel Manager
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-20">
      {/* Top Utility Bar */}
      <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-stone-400" />
            <span className="text-stone-300 font-medium">Host Onboarding Resource · Travel Malawi</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="inline-flex items-center gap-1.5 text-stone-300 hover:text-white transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-stone-400" />
              <span>Go to Dashboard</span>
            </Link>
            <button 
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-stone-300 hover:text-white transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Guide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <header className="relative bg-stone-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 text-xs font-semibold uppercase tracking-wider mb-6">
            <Building2 className="w-4 h-4 text-stone-400" />
            <span>Official Malawian Host &amp; Property Starter Package</span>
          </div>
          
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight max-w-4xl mx-auto">
            Put your property on the map. <br className="hidden sm:inline" />
            <span>Keep 100% of your earnings.</span>
          </h1>
          
          <p className="mt-6 text-stone-300 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed font-light">
            <EditableSection
              docId="docs_host"
              fieldId="hero_subtitle"
              defaultText="A practical guide for Malawian lodge, B&B, cottage, guest house, and safari camp hosts. Learn why an online presence transforms your bookings, and how to launch in under 8 minutes."
              multiline
            />
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/list-your-property"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-stone-900 font-semibold px-8 py-4 rounded-full text-base transition-all shadow-sm active:scale-95"
            >
              <span>List Your Property (0% Fee)</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-750 text-stone-200 font-medium px-6 py-4 rounded-full text-base transition border border-stone-700"
            >
              <LayoutDashboard className="w-4 h-4 text-stone-400" />
              <span>Open Host Dashboard</span>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-stone-400" />
              <span>0% Commission Guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-stone-400" />
              <span>Direct Mobile Money (Airtel &amp; Mpamba)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-stone-400" />
              <span>Direct WhatsApp Connections</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-16">
        
        {/* Section 1: Why Having an Online Presence Is Crucial */}
        <section id="why-online" className="scroll-mt-12 bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">The Big Picture</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Why Your Stay or B&amp;B Needs an Online Presence Today
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              Over 85% of domestic travelers, NGO staff, and international visitors searching for accommodation in Malawi begin their search on a mobile phone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-10">
            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center text-stone-800 mb-4">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  1. Discovery by New Travelers 24/7
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Without a web presence, your property relies solely on repeat visitors and word-of-mouth. Listing on Travel Malawi puts you in front of corporate travelers, weekend road-trippers from Lilongwe and Blantyre, and foreign tourists planning excursions across Lake Malawi and beyond.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200 text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-stone-600" /> Expand reach beyond your current contact list.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center text-stone-800 mb-4">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  2. Direct WhatsApp Inquiries (No Commissions)
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Unlike traditional foreign booking platforms that take 15% to 25% of your payout, Travel Malawi connects travelers directly to your WhatsApp. You speak directly with the guest, answer questions, and arrange local payment.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200 text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-stone-600" /> You keep 100% of the room price.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center text-stone-800 mb-4">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  3. Flexible Dual-Currency Pricing (MWK &amp; USD)
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Malawi&apos;s hospitality sector serves both local residents paying in Malawi Kwacha and international guests paying in US Dollars. You can set simultaneous prices in both currencies so every traveler sees clear, transparent rates.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200 text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-stone-600" /> Protect margins against currency fluctuation.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center text-stone-800 mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  4. Instant Guest Trust &amp; Offline Maps
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Travelers hesitate when accommodation details are unclear. With your dedicated page showing exact Google Maps GPS pins, downloadable offline maps (allowing guests to navigate remote unpaved bush roads with satellite GPS even when cellular network drops out), room photos, and amenities, guests book with confidence.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200 text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-stone-600" /> Builds immediate traveler trust &amp; ensures guests reach your gate.
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-stone-900 text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-stone-800">
            <div>
              <h4 className="font-serif text-xl sm:text-2xl font-bold">You Don&apos;t Need a Custom Website or Tech Skills</h4>
              <p className="text-stone-300 text-sm mt-1.5 max-w-xl leading-relaxed">
                Building and maintaining a website costs hundreds of thousands of Kwacha. Travel Malawi gives you a high-converting web profile with Google Maps location and direct WhatsApp chat for free.
              </p>
            </div>
            <Link
              to="/list-your-property"
              className="shrink-0 bg-white text-stone-900 hover:bg-stone-100 font-semibold px-6 py-3 rounded-full text-sm transition shadow"
            >
              Get Your Free Profile
            </Link>
          </div>
        </section>

        {/* Section 2: Easy Listing in 3 Simple Steps */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Fast &amp; Simple</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              List Your Stay in 3 Simple Steps (Under 8 Minutes)
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              You do not need a computer. You can complete your entire listing right from your smartphone.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-10">
            <div className="border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-400 transition">
              <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-base shrink-0 mb-5">
                1
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-900">
                Property Basics &amp; Location
              </h3>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Enter your property name, choose its category (B&amp;B, Lake Resort, Safari Camp, Cottage, Guest House), and pick your district. Pin your exact entrance gate so guests can download your property's <strong>Offline Map</strong> to navigate without cell service. Add your contact phone and WhatsApp number.
              </p>
              <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-500 space-y-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-stone-500" />
                  <span>District &amp; Offline GPS Coordinates</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-stone-500" />
                  <span>Property category &amp; description</span>
                </div>
              </div>
            </div>

            <div className="border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-400 transition">
              <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-base shrink-0 mb-5">
                2
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-900">
                Rooms &amp; Dual Rates
              </h3>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Add your room types (e.g., Beach Chalet, Family Room, Luxury Tent) with their bed configurations and nightly rates in both MWK and USD.
              </p>
              <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-500 space-y-1">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-stone-500" />
                  <span>Dual pricing (MWK &amp; USD)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-stone-500" />
                  <span>Photos of bedrooms &amp; views</span>
                </div>
              </div>
            </div>

            <div className="border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-400 transition">
              <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-base shrink-0 mb-5">
                3
              </div>
              <h3 className="font-serif text-lg font-bold text-stone-900">
                Amenities &amp; Launch
              </h3>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Check off key features like Wi-Fi, Solar Inverter, Lake Access, Swimming Pool, or On-site Dining. Tap Publish to go live instantly.
              </p>
              <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-500 space-y-1">
                <div className="flex items-center gap-2 bg-stone-100 text-stone-800 p-2.5 rounded-lg border border-stone-200">
                  <MessageSquare className="w-4 h-4 text-stone-700" />
                  <span>Instant WhatsApp inquiries live</span>
                </div>
                <div className="flex items-center gap-2 bg-stone-100 text-stone-800 p-2.5 rounded-lg border border-stone-200">
                  <Award className="w-4 h-4 text-stone-700" />
                  <span>0% commission active forever</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Photography Advice */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Visual Appeal</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Taking Great Photos with Just Your Phone
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              Properties with bright, clean photos receive 4x more inquiry messages. You don&apos;t need an expensive camera — modern smartphone cameras take exceptional photos if you follow these rules:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-stone-700 font-bold text-sm mb-1">Rule 1</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Shoot in Daylight</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Open all curtains, blinds, and doors. The morning (7:00 – 9:00 AM) and golden hour (4:30 – 5:45 PM) offer warm, soft natural light without harsh shadows.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-stone-700 font-bold text-sm mb-1">Rule 2</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Tidy Up &amp; Make Beds</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Smooth bedspreads, fluff pillows, remove water bottles and phone chargers from bedside tables, and ensure trash bins and towels are out of view.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-stone-700 font-bold text-sm mb-1">Rule 3</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Shoot from Corners</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Stand in the doorway or corner of the bedroom. This wide perspective makes rooms appear more spacious and allows guests to understand the room layout.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-stone-700 font-bold text-sm mb-1">Rule 4</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Capture the Bathroom</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Guests care deeply about bathroom cleanliness. Take a bright photo of your en-suite shower, clean sink, and hot water amenities.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-stone-700 font-bold text-sm mb-1">Rule 5</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Show the Surrounding View</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Do you have a lake view, garden patio, pool, or bonfire pit? Photos of the surrounding landscape and outdoor relaxation areas often make the booking decision.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-100 border border-stone-200 flex flex-col justify-between">
              <div>
                <div className="text-stone-800 font-bold text-sm mb-1">Bonus Tip</div>
                <h4 className="font-serif font-bold text-stone-900 text-base">Highlight Your Food</h4>
                <p className="text-stone-700 text-xs mt-2 leading-relaxed">
                  If you serve breakfast, fresh Chambo fish, or evening barbecue, include a photo of your dining setup.
                </p>
              </div>
              <div className="text-xs text-stone-600 font-medium mt-3">Guests love seeing dining options!</div>
            </div>
          </div>
        </section>

        {/* Section 4: Copy-Paste WhatsApp Response Templates */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Fast Conversions</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Ready-to-Use WhatsApp Response Templates
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              When travelers click &ldquo;Chat on WhatsApp&rdquo; from your listing, speed of reply is everything. Save these templates in your phone notes or WhatsApp Quick Replies to confirm reservations in seconds.
            </p>
          </div>

          <div className="space-y-6 mt-8">
            {/* Template A */}
            <div className="border border-stone-200 rounded-2xl p-6 bg-stone-50">
              <div className="flex items-center justify-between gap-4 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Template A</span>
                <button
                  onClick={() => copyToClipboard(`Hello! Thank you for inquiring with us on Travel Malawi. We would be delighted to host you!\n\nYes, we currently have availability for your selected dates.\n\nRoom Type: [Insert Room Name]\nNightly Rate: MWK [Amount] / $[Amount] per night\nInclusions: [e.g. Free full breakfast, Wi-Fi, secure parking]\n\nTo confirm your booking, we require a 50% deposit via Airtel Money / TNM Mpamba / Bank Transfer. Would you like our payment details?`, 'tempA')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-200 px-3 py-1.5 rounded-full transition cursor-pointer"
                >
                  {copiedTemplate === 'tempA' ? <Check className="w-3.5 h-3.5 text-stone-800" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTemplate === 'tempA' ? 'Copied!' : 'Copy Template'}</span>
                </button>
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-sm mb-2">Confirming Availability &amp; Sending Payment Details</h4>
              <p className="text-xs text-stone-700 font-mono bg-white p-4 rounded-xl border border-stone-200 leading-relaxed whitespace-pre-line">
                {`Hello! Thank you for inquiring with us on Travel Malawi. We would be delighted to host you!

Yes, we currently have availability for your selected dates.

Room Type: [Insert Room Name]
Nightly Rate: MWK [Amount] / $[Amount] per night
Inclusions: [e.g. Free full breakfast, Wi-Fi, secure parking]

To confirm your booking, we require a 50% deposit via Airtel Money / TNM Mpamba / Bank Transfer. Would you like our payment details?`}
              </p>
            </div>

            {/* Template B */}
            <div className="border border-stone-200 rounded-2xl p-6 bg-stone-50">
              <div className="flex items-center justify-between gap-4 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Template B</span>
                <button
                  onClick={() => copyToClipboard(`Thank you for confirming your reservation with us!\n\nYour stay is officially booked:\nCheck-in: [Date] from 2:00 PM\nCheck-out: [Date] by 10:30 AM\nDeposit Received: MWK [Amount]\nBalance due on arrival: MWK [Amount]\n\nDirections: We are located at [Place Name]. Here is our Google Maps pin: [Insert Link]\n\nLet us know if you need airport transfer or early breakfast. Safe travels!`, 'tempB')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-200 px-3 py-1.5 rounded-full transition cursor-pointer"
                >
                  {copiedTemplate === 'tempB' ? <Check className="w-3.5 h-3.5 text-stone-800" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTemplate === 'tempB' ? 'Copied!' : 'Copy Template'}</span>
                </button>
              </div>
              <h4 className="font-serif font-bold text-stone-900 text-sm mb-2">Booking Confirmation &amp; Arrival Directions</h4>
              <p className="text-xs text-stone-700 font-mono bg-white p-4 rounded-xl border border-stone-200 leading-relaxed whitespace-pre-line">
                {`Thank you for confirming your reservation with us!

Your stay is officially booked:
Check-in: [Date] from 2:00 PM
Check-out: [Date] by 10:30 AM
Deposit Received: MWK [Amount]
Balance due on arrival: MWK [Amount]

Directions: We are located at [Place Name]. Here is our Google Maps pin: [Insert Link]

Let us know if you need airport transfer or early breakfast. Safe travels!`}
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Common Host Questions */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Clear Answers</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Frequently Asked Host Questions
            </h2>
          </div>

          <div className="mt-8 space-y-4">
            <div className="border border-stone-200 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-stone-900 text-base">
                Is Travel Malawi really free with 0% commission?
              </h4>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Yes. Our mission is to promote domestic Malawian tourism and connect travelers directly with registered stays. We never deduct transaction fees from your guest bookings.
              </p>
            </div>

            <div className="border border-stone-200 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-stone-900 text-base">
                Can I still take bookings on Airbnb or Booking.com?
              </h4>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Many of our hosts are on other platforms as well. Travel Malawi gives you an additional channel to capture domestic Malawian travelers and regional tourists without losing 15% to 20% in commissions.
              </p>
            </div>

            <div className="border border-stone-200 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-stone-900 text-base">
                How do guests pay for their reservations?
              </h4>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Guests pay directly to you according to your property policy. Most hosts accept a 50% deposit via Airtel Money, TNM Mpamba, or National/Standard Bank transfer, with the balance settled upon arrival.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: Launch Checklist & CTA Banner */}
        <section className="rounded-3xl bg-stone-900 text-white p-8 sm:p-12 border border-stone-800 relative overflow-hidden text-center">
          <div className="max-w-2xl mx-auto relative z-10">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Ready in 8 Minutes</span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mt-3 tracking-tight">
              Ready to Welcome More Guests to Your Property?
            </h2>
            <p className="text-stone-300 text-sm sm:text-base mt-3 leading-relaxed">
              Grab 5 photos from your phone and join Malawi&apos;s premier hospitality network for hotels, resorts, lodges, B&amp;Bs, cottages, and camps today.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/list-your-property"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-stone-900 font-semibold px-8 py-4 rounded-full text-base transition-all shadow-sm active:scale-95"
              >
                <span>List Your Property Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white font-medium px-6 py-4 rounded-full text-base transition border border-stone-700"
              >
                <LayoutDashboard className="w-4 h-4 text-stone-400" />
                <span>Host Dashboard</span>
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
