import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { RefreshCcw, ArrowLeft, ShieldCheck, AlertCircle, Building2, HelpCircle } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import MarkdownContent from '../components/MarkdownContent';

export default function Refunds() {
  const { settings } = useSystemSettings();

  return (
    <div className="min-h-screen bg-stone-50/50 text-stone-700 font-sans">
      <Helmet>
        <title>Refunds &amp; Cancellation Policy · Travel Malawi</title>
        <meta name="description" content="Important policy regarding cancellations, refunds, direct guest-host settlement, and platform liability limitation." />
      </Helmet>

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
            <Link
              to="/privacy"
              className="bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs"
            >
              Terms of Service
            </Link>
            <span className="font-semibold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
              Refunds &amp; Cancellations
            </span>
          </nav>
        </div>

        {/* Paper Article */}
        <article className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-10 lg:p-12 shadow-xs space-y-8">
          <header className="border-b border-stone-200 pb-8">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-stone-500 mb-2.5">
              <span>Travel Malawi</span>
              <span>·</span>
              <span>Direct Settlement Policy</span>
              <span>·</span>
              <span className="text-stone-900 font-semibold">Zero Fund Handling &amp; Zero Platform Liability</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-900 shrink-0">
                <RefreshCcw className="w-5 h-5 sm:w-6 sm:h-6 text-stone-800" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-stone-900 leading-tight">
                  Refunds &amp; Cancellation Policy
                </h1>
                <p className="mt-2 text-stone-600 text-xs sm:text-sm md:text-base leading-relaxed">
                  Travel Malawi connects travelers directly with independent property operators. Because we do not handle funds or process payments, all cancellations, deposits, refunds, and grievances are strictly between the user and the stay, and remain subject solely to the stay&apos;s discretion.
                </p>
              </div>
            </div>

            {/* Direct Model Core Principles */}
            <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block font-mono text-[10px] uppercase">Fund Handling</span>
                <span className="font-semibold text-stone-900 text-sm">We Do Not Collect Funds</span>
                <p className="text-[11px] text-stone-500 mt-1">Zero payments or deposits pass through our servers.</p>
              </div>
              <div className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block font-mono text-[10px] uppercase">Cancellations &amp; Refunds</span>
                <span className="font-semibold text-stone-900 text-sm">At Stay&apos;s Sole Discretion</span>
                <p className="text-[11px] text-stone-500 mt-1">Independent properties set and enforce their own terms.</p>
              </div>
              <div className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block font-mono text-[10px] uppercase">Grievances &amp; Disputes</span>
                <span className="font-semibold text-stone-900 text-sm">Between User &amp; Stay Only</span>
                <p className="text-[11px] text-stone-500 mt-1">Travel Malawi bears zero financial liability.</p>
              </div>
            </div>
          </header>

          <div className="space-y-8 text-stone-700 text-xs sm:text-sm leading-relaxed">
            {settings.refundPolicy ? (
              <MarkdownContent content={settings.refundPolicy} />
            ) : (
              <>
                {/* Section 1: Explicit Zero Fund Handling */}
                <section className="space-y-3">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-mono font-bold flex items-center justify-center shrink-0">1</span>
                    <span>No Platform Handling of Funds</span>
                  </h2>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                    <p className="font-semibold text-stone-900">
                      Travel Malawi does not collect, receive, hold, or disburse any monies.
                    </p>
                    <p className="text-stone-600 leading-relaxed">
                      We operate exclusively as a discovery and direct booking coordination platform. We do not act as an escrow agent, payment processor, or financial intermediary. Any deposit, partial payment, or full settlement made for a stay (whether via Airtel Money, TNM Mpamba, local bank transfer, or cash on arrival) is paid <strong>directly by you (the guest) to the property owner or management</strong>.
                    </p>
                  </div>
                </section>

                {/* Section 2: Property's Sole Discretion */}
                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-mono font-bold flex items-center justify-center shrink-0">2</span>
                    <span>Cancellations and Refunds Are at the Stay&apos;s Sole Discretion</span>
                  </h2>
                  <p>
                    Each independent hotel, lodge, lakeside cottage, private villa, B&amp;B, or safari camp listed on Travel Malawi establishes, maintains, and enforces its own cancellation, rescheduling, and refund terms:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-stone-600">
                    <li>
                      <strong>Individual Stay Rules:</strong> Whether a cancellation is permitted, whether a deposit is refundable, and the percentage of any refund returned is determined <strong>strictly at the sole and absolute discretion of the specific property</strong>.
                    </li>
                    <li>
                      <strong>No Platform Guarantee:</strong> Travel Malawi does not set, mandate, guarantee, underwrite, or enforce cancellation policies or refund payouts. We make no representations that any deposit will be refunded in whole or in part upon cancellation.
                    </li>
                    <li>
                      <strong>Direct Agreement:</strong> Your booking agreement and any financial conditions are formed directly between you and the property host. You are strongly advised to review the specific stay&apos;s policies and confirm deposit terms with the property manager before transferring funds.
                    </li>
                  </ul>
                </section>

                {/* Section 3: Grievances, Disputes & Total Limitation of Liability */}
                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-mono font-bold flex items-center justify-center shrink-0">3</span>
                    <span>Grievances, Disputes &amp; Zero Platform Liability</span>
                  </h2>
                  <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-2 text-amber-950">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-800 shrink-0" />
                      <span>All Disputes and Grievances Are Strictly Between the User and the Stay</span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-amber-900/90">
                      Travel Malawi does not resolve, arbitrate, adjudicate, or process financial disputes, refunds, chargebacks, or guest-host grievances. If you cancel a stay, experience a disagreement regarding room conditions or services, or seek a return of funds paid directly to a property, you must contact and resolve the matter directly with the property host.
                    </p>
                    <p className="text-xs sm:text-sm leading-relaxed text-amber-900/90 font-medium">
                      Under no circumstances shall Travel Malawi, its operators, or affiliates be liable for any unrefunded deposits, cancellation fees, damages, losses, or expenses arising from your dealings with any property listed on this platform.
                    </p>
                  </div>
                </section>

                {/* Section 4: Force Majeure, Weather & Road Conditions */}
                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-mono font-bold flex items-center justify-center shrink-0">4</span>
                    <span>Weather, Road Conditions &amp; Travel Contingencies</span>
                  </h2>
                  <p>
                    Travel in Malawi may occasionally be affected by weather conditions (such as Lake Malawi Mwera winds, seasonal rains, or mountain plateau road washouts).
                  </p>
                  <p>
                    Any decision to reschedule, issue a credit voucher, or refund deposits due to road accessibility or weather disruptions is made <strong>exclusively by the property host at their sole discretion</strong>. Travel Malawi is not liable for weather-related cancellations, travel disruptions, or road conditions.
                  </p>
                </section>

                {/* Section 5: How to Contact the Property Directly */}
                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-mono font-bold flex items-center justify-center shrink-0">5</span>
                    <span>Contacting Your Property Host</span>
                  </h2>
                  <p>
                    To modify, reschedule, or cancel a booking, or to discuss deposit and refund arrangements, please communicate directly with the property manager using the WhatsApp number, phone number, or email provided on your booking voucher and confirmation message.
                  </p>
                </section>
              </>
            )}
          </div>

          <footer className="pt-6 border-t border-stone-200 text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              Travel Malawi Platform Operations · Lilongwe, Malawi
            </div>
            <div className="font-mono text-[11px] text-stone-500">
              Direct Settlement · Zero Platform Liability
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
