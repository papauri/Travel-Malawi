import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, FileText, RefreshCcw, Mail, MapPin, CheckCircle2 } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import MarkdownContent from '../components/MarkdownContent';
import SEOHead from '../components/SEOHead';

export default function Privacy() {
  const { settings } = useSystemSettings();

  return (
    <div className="min-h-screen bg-stone-50/50 text-stone-700 font-sans">
      <SEOHead
        title="Privacy Policy — Travel Malawi"
        description="How Travel Malawi protects and handles guest and host data with zero third-party ad tracking, secure communication, and transparent direct booking."
        keywords="Travel Malawi privacy, data protection Malawi, guest privacy"
        url="https://ulendomalawi.com/privacy"
      />

      <main className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-200/90 flex-wrap">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Stays</span>
          </Link>

          <nav className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
              Privacy Policy
            </span>
            <Link
              to="/terms"
              className="bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs"
            >
              Terms of Service
            </Link>
            <Link
              to="/refunds"
              className="bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs"
            >
              Refunds &amp; Cancellations
            </Link>
          </nav>
        </div>

        {/* Paper Article */}
        <article className="bg-white rounded-xl border border-stone-200/90 p-6 sm:p-10 lg:p-12 shadow-xs space-y-8">
          <header className="border-b border-stone-200 pb-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-2.5">
              <span>Travel Malawi</span>
              <span>·</span>
              <span>Legal &amp; Data Integrity</span>
              <span>·</span>
              <span className="text-stone-900 font-semibold">Zero Ad Tracking</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-900 shrink-0">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-stone-800" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-stone-900 leading-tight">
                  Privacy Policy &amp; Data Protection
                </h1>
                <p className="mt-2 text-stone-600 text-xs sm:text-sm md:text-base leading-relaxed">
                  We built Travel Malawi to connect domestic and international travelers directly with independent Malawian lodges, whole cottages, and safari camps. We respect your privacy and never sell or monetize your data.
                </p>
              </div>
            </div>

            {/* Privacy Commitments Strip */}
            <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                <span className="text-stone-400 block font-semibold text-xs">Data Monetization</span>
                <span className="font-semibold text-stone-900 text-sm">0% Sold to Third Parties</span>
              </div>
              <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                <span className="text-stone-400 block font-semibold text-xs">Financial Cards</span>
                <span className="font-semibold text-stone-900 text-sm">Never Stored on Servers</span>
              </div>
              <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                <span className="text-stone-400 block font-semibold text-xs">Direct Dispatch</span>
                <span className="font-semibold text-stone-900 text-sm">Straight to Assigned Host</span>
              </div>
            </div>
          </header>

          <div className="space-y-8 text-stone-700 text-xs sm:text-sm leading-relaxed">
            {settings.privacyPolicy ? (
              <MarkdownContent content={settings.privacyPolicy} />
            ) : (
              <>
                <section className="space-y-3">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">1</span>
                    <span>What Information We Collect</span>
                  </h2>
                  <p>
                    When you browse stays, submit a booking inquiry, or register as a property host on Travel Malawi, we collect only the essential details needed to arrange your stay:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                    <li><strong>Guest Contact Details:</strong> Full Name, Email Address, WhatsApp / Phone Number, and any special dietary or check-in arrival notes.</li>
                    <li><strong>Booking Specifications:</strong> Selected check-in/check-out dates, guest party count (adults and children), and selected accommodation unit (e.g. Whole 3-Bedroom Cottage, Master Lake Chalet, or Deluxe Room).</li>
                    <li><strong>Host &amp; Property Information:</strong> Property name, physical district/gps entrance coordinates, official manager contacts, published rates (in MWK and USD), and room inventory.</li>
                  </ul>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">2</span>
                    <span>How We Use Your Information</span>
                  </h2>
                  <p>
                    Your information is used solely to facilitate your stay in Malawi:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                    <li><strong>Direct Connection:</strong> When you send an inquiry, your contact details are transmitted directly to the assigned property manager so they can confirm availability, issue gate arrival directions, and coordinate with you on WhatsApp.</li>
                    <li><strong>Voucher Delivery:</strong> We generate your printable booking confirmation voucher and keep your upcoming itinerary accessible in your private trip dashboard.</li>
                    <li><strong>Service Reliability:</strong> Our concierge team (*Ulendo*) uses your details to verify listing authenticity and assist with road directions or force majeure re-routings when requested.</li>
                  </ul>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">3</span>
                    <span>Payment &amp; Financial Data</span>
                  </h2>
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                    <p className="font-semibold text-stone-900">
                      We never store your credit cards, debit cards, or banking passwords.
                    </p>
                    <p className="text-stone-600 leading-relaxed">
                      All settlements in Malawi are handled directly between you and the host via local rails: <strong>Airtel Money</strong>, <strong>TNM Mpamba</strong>, <strong>National Bank of Malawi (NBM)</strong>, <strong>Standard Bank</strong>, or cash upon arrival. Because Travel Malawi operates on a 0% commission direct-booking model, no financial payment processing takes place on our servers.
                    </p>
                  </div>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">4</span>
                    <span>Device Permissions &amp; Location Caching</span>
                  </h2>
                  <p>
                    When using Travel Malawi, device access is strictly optional and user-controlled:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                    <li><strong>Geographic Location (GPS):</strong> Used client-side to calculate driving distances and estimated travel times along the M1, M5 Lakeshore road, and plateau climbs. If disabled, you can select any Malawian regional hub (Lilongwe, Blantyre, Mzuzu, Cape Maclear, Zomba) as your default starting point.</li>
                    <li><strong>Microphone &amp; Camera:</strong> Used only when you voluntarily record voice inquiries or when property hosts capture property walkthroughs. We never record or access devices in the background.</li>
                  </ul>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">5</span>
                    <span>Your Rights &amp; Account Deletion</span>
                  </h2>
                  <p>
                    You maintain full control of your personal information. You may request a complete export or permanent deletion of your account and booking history at any time by contacting our data desk at <a href="mailto:info@ulendomalawi.com" className="text-stone-900 font-semibold underline">info@ulendomalawi.com</a>.
                  </p>
                </section>
              </>
            )}
          </div>

          <footer className="pt-6 border-t border-stone-200 text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              Travel Malawi Platform Operations · Lilongwe, Malawi
            </div>
            <div className="text-xs text-stone-500">
              Last Updated: 2026 · 0% Commission
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
