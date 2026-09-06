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
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function HostStarterPack() {
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(id);
    toast.success('Template copied to clipboard!');
    setTimeout(() => setCopiedTemplate(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-20">
      {/* Top Utility Bar */}
      <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-stone-300 font-medium">Free Host Onboarding Resource for Malawian Stays</span>
          </div>
          <button 
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 text-stone-300 hover:text-white transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save Guide</span>
          </button>
        </div>
      </div>

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-stone-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-xs font-semibold uppercase tracking-wider mb-6">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Official Malawian Lodge &amp; Host Starter Package</span>
          </div>
          
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight max-w-4xl mx-auto">
            Put your property on the map. <br className="hidden sm:inline" />
            <span className="text-emerald-400 underline decoration-emerald-500/30 underline-offset-8">Keep 100% of your earnings.</span>
          </h1>
          
          <p className="mt-6 text-stone-300 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed font-light">
            A simple, practical guide for Malawian lodge, cottage, and camp owners. Learn why having an online presence transforms your bookings, and how to launch in under 8 minutes.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/list-your-property"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-8 py-4 rounded-full text-base transition-all shadow-lg active:scale-95"
            >
              <span>List Your Property (0% Commission)</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#why-online"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium px-6 py-4 rounded-full text-base transition border border-stone-700"
            >
              <span>Why Online Presence Matters</span>
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>0% Commission Guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Direct Mobile Money (Airtel &amp; Mpamba)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">The Big Picture</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Why Your Lodge Needs an Online Presence Today
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              For years, Malawian lodges relied purely on word-of-mouth or road signs. Today, traveler habits have changed completely:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Card 1 */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-6 relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 mb-4">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  1. International Travelers Book Months Before Arrival
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Over <strong>85%</strong> of tourists, NGO teams, researchers, and diaspora travelers search online from the UK, US, South Africa, and Europe months in advance. If your lodge is not online, you are completely invisible to high-paying international bookings.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200/60 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Travel Malawi gives you global discoverability.
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-6 relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 mb-4">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  2. Domestic Weekend Getaways Happen on Smartphones
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Families, government officials, and professionals in Lilongwe, Blantyre, and Mzuzu search for weekend breaks on their phones. Having a digital presence means travelers can discover your rooms, check rates, and message you in seconds.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200/60 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Instant mobile discovery across all districts.
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-6 relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 mb-4">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  3. Foreign Booking Sites Take 15%–20% of Your Money
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Foreign platforms like Booking.com take heavy commissions and hold guest payments in foreign bank accounts for weeks. Travel Malawi charges <strong>0% commission</strong>—guests pay you directly via Airtel Money, Mpamba, or Bank Transfer.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200/60 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Zero commission. 100% direct payouts.
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-6 relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  4. Instant Guest Trust with Verified Details
                </h3>
                <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                  Travelers hesitate when accommodation details are unclear. With your dedicated page showing exact Google Maps GPS pins, room photos, amenities (solar power, Wi-Fi, backup water), guests book with confidence.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200/60 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Builds immediate traveler trust and credibility.
              </div>
            </div>
          </div>

          {/* Quick comparison box */}
          <div className="mt-8 rounded-2xl bg-emerald-900 text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="font-serif text-xl sm:text-2xl font-bold">You Don&apos;t Need a Custom Website or Tech Skills</h4>
              <p className="text-emerald-100 text-sm mt-1.5 max-w-xl leading-relaxed">
                Building and maintaining a website costs hundreds of thousands of Kwacha. Travel Malawi gives you a high-converting web profile with Google Maps location and direct WhatsApp chat for free.
              </p>
            </div>
            <Link
              to="/list-your-property"
              className="shrink-0 bg-white text-emerald-950 hover:bg-emerald-50 font-semibold px-6 py-3 rounded-full text-sm transition shadow"
            >
              Get Your Free Profile
            </Link>
          </div>
        </section>

        {/* Section 2: Easy Listing in 3 Simple Steps */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Fast &amp; Simple</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              List Your Stay in 3 Simple Steps (Under 8 Minutes)
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              You do not need a computer. You can complete your entire listing right from your smartphone.
            </p>
          </div>

          <div className="mt-8 space-y-6">
            {/* Step 1 */}
            <div className="border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-base shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    Tell Us About Your Property
                  </h3>
                  <p className="text-stone-600 text-sm mt-1.5 leading-relaxed">
                    Type your property name—our system connects directly with <strong>Google Maps Malawi</strong> to suggest your lodge and automatically pull in your district and map pin!
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs text-stone-600">
                    <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Google Maps Malawi auto-suggest</span>
                    </div>
                    <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>Category (Lakefront, Safari, Boutique, Camp)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-base shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    Set Your Rooms &amp; Dual Currency Rates
                  </h3>
                  <p className="text-stone-600 text-sm mt-1.5 leading-relaxed">
                    Add your chalets, rooms, or campsites. Set your price in <strong>Malawian Kwacha (MWK)</strong> for domestic guests and <strong>US Dollars (USD)</strong> for international tourists. Both show simultaneously to travelers.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs text-stone-600">
                    <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Set both MWK &amp; USD nightly rates</span>
                    </div>
                    <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>Upload 5–10 photos from camera roll</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-base shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    Go Live &amp; Receive Direct Inquiries
                  </h3>
                  <p className="text-stone-600 text-sm mt-1.5 leading-relaxed">
                    Our local verification team checks your listing within 2 to 4 hours. Once active, travelers browsing the site connect directly to your <strong>WhatsApp or phone line</strong>.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs text-stone-600">
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 p-2.5 rounded-lg border border-emerald-100">
                      <MessageSquare className="w-4 h-4 text-emerald-700" />
                      <span>Direct WhatsApp inquiries to your phone</span>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 p-2.5 rounded-lg border border-emerald-100">
                      <Award className="w-4 h-4 text-emerald-700" />
                      <span>100% of guest revenue goes to you</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Smartphone Photography Tips */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Visual Appeal</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              5 Simple Smartphone Photography Rules
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              You don&apos;t need an expensive DSLR camera. Today&apos;s smartphones take incredible photos if you follow these basic tips:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-emerald-700 font-bold text-sm mb-1">Rule 1</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Natural Morning Sunlight</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Photograph rooms between 8:00 AM – 10:00 AM or 4:00 PM – 5:30 PM. Never use harsh flashlight at night.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-emerald-700 font-bold text-sm mb-1">Rule 2</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Tidy Beds &amp; Mosquito Nets</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Smooth out bedsheets, fluff pillows, and ensure mosquito nets hang neatly. First impressions of comfort decide bookings.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-emerald-700 font-bold text-sm mb-1">Rule 3</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Open Curtains &amp; Doors</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Show off your views! Open curtains to display the lake, tropical garden, or mountains outside the room.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-emerald-700 font-bold text-sm mb-1">Rule 4</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Clean, Dry Bathrooms</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Wipe mirrors, put toilet lids down, remove clutter, and display clean folded towels.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="text-emerald-700 font-bold text-sm mb-1">Rule 5</div>
              <h4 className="font-serif font-bold text-stone-900 text-base">Shoot Horizontal (Landscape)</h4>
              <p className="text-stone-600 text-xs mt-2 leading-relaxed">
                Hold your phone sideways. Landscape photos look much wider, spacious, and dramatic on hotel cards.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col justify-between">
              <div>
                <div className="text-emerald-800 font-bold text-sm mb-1">Bonus Tip</div>
                <h4 className="font-serif font-bold text-emerald-950 text-base">Highlight Your Food</h4>
                <p className="text-emerald-900 text-xs mt-2 leading-relaxed">
                  Take a photo of your signature dishes—fresh Lake Chambo, coffee on the deck, or tropical fruit breakfast.
                </p>
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-3">Guests love seeing dining options!</div>
            </div>
          </div>
        </section>

        {/* Section 4: WhatsApp Booking Templates */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Fast Conversions</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Ready-to-Use WhatsApp Reply Templates
            </h2>
            <p className="text-stone-600 mt-3 text-base leading-relaxed">
              When travelers message you, responding quickly secures the booking. Copy and save these templates to your phone notes:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Template 1 */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Template A</span>
                  <button
                    onClick={() => copyToClipboard(`Moni! Thank you for reaching out to [Lodge Name]. Yes, our [Room Name] is available for your dates ([Check-in] to [Check-out]). The rate is MK [Amount] / $ [Amount] per night, including breakfast and lake access. Would you like me to reserve these dates for you? We can confirm with a 50% deposit via Airtel Money or Mpamba.`, 'tempA')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-emerald-700 bg-white border border-stone-200 px-3 py-1.5 rounded-full transition cursor-pointer"
                  >
                    {copiedTemplate === 'tempA' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTemplate === 'tempA' ? 'Copied' : 'Copy Template'}</span>
                  </button>
                </div>
                <h4 className="font-serif font-bold text-stone-900 text-base mb-2">When You Have Availability</h4>
                <p className="text-stone-600 text-xs sm:text-sm italic leading-relaxed bg-white p-4 rounded-xl border border-stone-200/60 font-mono">
                  &ldquo;Moni! Thank you for reaching out to [Lodge Name]. Yes, our [Room Name] is available for your dates ([Check-in] to [Check-out]). The rate is MK [Amount] / $ [Amount] per night, including breakfast and lake access. Would you like me to reserve these dates for you? We can confirm with a 50% deposit via Airtel Money or Mpamba.&rdquo;
                </p>
              </div>
            </div>

            {/* Template 2 */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Template B</span>
                  <button
                    onClick={() => copyToClipboard(`Looking forward to welcoming you to [Lodge Name]! To reach us from the main road: Turn off at [Landmark/Junction], follow the dirt road for 2 km. Look for our wooden sign on the right. If you need a boat transfer or 4x4 pickup, please let us know in advance!`, 'tempB')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-emerald-700 bg-white border border-stone-200 px-3 py-1.5 rounded-full transition cursor-pointer"
                  >
                    {copiedTemplate === 'tempB' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTemplate === 'tempB' ? 'Copied' : 'Copy Template'}</span>
                  </button>
                </div>
                <h4 className="font-serif font-bold text-stone-900 text-base mb-2">Arrival &amp; Directions Instructions</h4>
                <p className="text-stone-600 text-xs sm:text-sm italic leading-relaxed bg-white p-4 rounded-xl border border-stone-200/60 font-mono">
                  &ldquo;Looking forward to welcoming you to [Lodge Name]! To reach us from the main road: Turn off at [Landmark/Junction], follow the dirt road for 2 km. Look for our wooden sign on the right. If you need a boat transfer or 4x4 pickup, please let us know in advance!&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Frequently Asked Questions */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-200">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Clear Answers</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-2 font-bold tracking-tight">
              Host Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-8 space-y-4">
            <div className="border border-stone-200 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-stone-900 text-base">
                Is listing really 100% free? Are there any hidden commissions?
              </h4>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Yes! Listing is <strong>100% free with 0% commission</strong>. We do not take a cut from your room rate or booking total.
              </p>
            </div>

            <div className="border border-stone-200 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-stone-900 text-base">
                Can I manage my rooms and dates on a simple smartphone?
              </h4>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Absolutely. Our entire host portal is built for mobile. You can update prices, change descriptions, or block dates on the monthly availability calendar with a single tap.
              </p>
            </div>

            <div className="border border-stone-200 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-stone-900 text-base">
                What if I already use Airbnb or Booking.com?
              </h4>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                That is great! Many of our hosts are on other platforms as well. Travel Malawi gives you an additional, dedicated channel to capture domestic Malawian travelers and regional tourists without losing 15% to 20% in commissions.
              </p>
            </div>

            <div className="border border-stone-200 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-stone-900 text-base">
                How do guests pay for their reservations?
              </h4>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed">
                Guests pay directly to you according to your lodge policy. Most hosts accept a 50% deposit via Airtel Money, TNM Mpamba, or National/Standard Bank transfer, with the balance settled upon arrival.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: Launch Checklist & CTA Banner */}
        <section className="rounded-3xl bg-stone-900 text-white p-8 sm:p-12 border border-stone-800 relative overflow-hidden text-center">
          <div className="max-w-2xl mx-auto relative z-10">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Ready in 8 Minutes</span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mt-3 tracking-tight">
              Ready to Welcome More Guests to Your Lodge?
            </h2>
            <p className="text-stone-300 text-sm sm:text-base mt-3 leading-relaxed">
              Grab 5 photos from your phone and join Malawi&apos;s premier hospitality network today.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/list-your-property"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-8 py-4 rounded-full text-base transition-all shadow-lg active:scale-95"
              >
                <span>List Your Property Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white font-medium px-6 py-4 rounded-full text-base transition border border-stone-700"
              >
                <span>Explore Stays First</span>
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
