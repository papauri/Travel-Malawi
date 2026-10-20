import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, ShieldCheck, AlertCircle, Lock, HelpCircle } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import MarkdownContent from '../components/MarkdownContent';
import SEOHead from '../components/SEOHead';
import { usePlatformMode } from '../contexts/PlatformModeContext';

export default function Terms() {
  const { settings } = useSystemSettings();
  const { bookingsEnabled } = usePlatformMode();

  return (
    <div className="min-h-screen bg-stone-50/50 text-stone-700 font-sans">
      <SEOHead
        title="Terms of Service — Travel Malawi"
        description={bookingsEnabled
          ? 'Terms of Service, host responsibilities, guest guidelines, and payment policies for the Travel Malawi hospitality platform.'
          : 'Terms of Service for the Travel Malawi directory: how listings work, host responsibilities and traveller guidelines.'}
        keywords={bookingsEnabled ? 'Travel Malawi terms, lodge booking terms, host agreement Malawi' : 'Travel Malawi terms, directory terms, host agreement Malawi'}
        url="https://ulendomalawi.com/terms"
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
            <Link
              to="/privacy"
              className="bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs"
            >
              Privacy Policy
            </Link>
            <span className="font-semibold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
              Terms of Service
            </span>
            {bookingsEnabled && (
              <Link
                to="/refunds"
                className="bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-950 border border-stone-200 font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs"
              >
                Refunds &amp; Cancellations
              </Link>
            )}
          </nav>
        </div>

        {/* Paper Article */}
        <article className="bg-white rounded-xl border border-stone-200/90 p-6 sm:p-10 lg:p-12 shadow-xs space-y-8">
          <header className="border-b border-stone-200 pb-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-2.5">
              <span>Travel Malawi</span>
              <span>·</span>
              <span>Platform Terms &amp; Conditions</span>
              <span>·</span>
              <span className="text-stone-900 font-semibold">Zero Fund Handling &amp; Zero Platform Liability</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-900 shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-stone-800" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-stone-900 leading-tight">
                  Terms of Service &amp; User Agreement
                </h1>
                <p className="mt-2 text-stone-600 text-xs sm:text-sm md:text-base leading-relaxed">
                  These terms govern your use of the Travel Malawi platform as a traveler or independent host. Please read them carefully. Because Travel Malawi does not handle funds, payments, cancellations, or refunds, all financial arrangements and grievances are strictly between the user and the stay at the stay&apos;s sole discretion.
                </p>
              </div>
            </div>

            {/* Platform Commitments Strip */}
            <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block font-semibold text-xs">Marketplace Role</span>
                <span className="font-semibold text-stone-900 text-sm">Discovery &amp; Conduit Only</span>
                <p className="text-[11px] text-stone-500 mt-1">We do not own, operate, or staff listed stays.</p>
              </div>
              <div className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block font-semibold text-xs">Financial Settlement</span>
                <span className="font-semibold text-stone-900 text-sm">Direct Guest-to-Host</span>
                <p className="text-[11px] text-stone-500 mt-1">Zero payments or deposits handled by platform.</p>
              </div>
              <div className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <span className="text-stone-400 block font-semibold text-xs">Platform Liability</span>
                <span className="font-semibold text-stone-900 text-sm">Zero Liability Disclaimed</span>
                <p className="text-[11px] text-stone-500 mt-1">Disputes are strictly between user and stay.</p>
              </div>
            </div>
          </header>

          <div className="space-y-8 text-stone-700 text-xs sm:text-sm leading-relaxed">
            {settings.termsOfService ? (
              <MarkdownContent content={settings.termsOfService} />
            ) : (
              <>
                <section className="space-y-3">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">1</span>
                    <span>Platform Role: Information &amp; Direct Connection</span>
                  </h2>
                  <p>
                    Travel Malawi operates strictly as an independent informational directory and discovery engine{bookingsEnabled ? ', and direct messaging channel' : ''} connecting travelers directly with independent Malawian lodges, whole cottages, private villas, B&amp;Bs, and safari camps. We are not a travel agency, tour operator, or booking broker, and we do not provide tourism services or operate tourism enterprises.
                  </p>
                  <p>
                    <strong>We do not own, operate, manage, furnish, inspect, or staff any of the properties listed on this site.</strong> All lodging accommodations, physical premises, hygiene, hospitality services, meals, and safety measures are under the exclusive control of the independent property owners or their designated managers.
                  </p>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">2</span>
                    <span>Zero Fund Handling: All Payments Are Direct</span>
                  </h2>
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                    <p className="font-semibold text-stone-900">
                      We process zero online payments, collect no deposits, and hold no guest funds.
                    </p>
                    <p className="text-stone-600 leading-relaxed">
                      All financial transactions, booking deposits, payment methods (including Airtel Money, TNM Mpamba, local bank transfer, or cash on arrival), and final check-in balances are agreed upon and executed strictly and directly between you (the guest) and the property management.
                    </p>
                  </div>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">3</span>
                    <span>Cancellations, Refunds &amp; Grievances are at the Stay&apos;s Sole Discretion</span>
                  </h2>
                  <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2 text-amber-950">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-800 shrink-0" />
                      <span>Strictly Between User and Stay</span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-amber-900/90">
                      Because Travel Malawi does not collect funds or issue payments, <strong>all cancellations, deposit returns, rescheduling requests, refunds, or financial disputes are governed exclusively by the independent property&apos;s own policies and are decided at the stay&apos;s sole and absolute discretion</strong>.
                    </p>
                    <p className="text-xs sm:text-sm leading-relaxed text-amber-900/90">
                      Travel Malawi does not decide, mediate, adjudicate, or guarantee refunds or cancellation terms. Any grievances regarding booking cancellations, withheld deposits, room conditions, amenities, or services must be resolved directly with the property host.
                    </p>
                  </div>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">4</span>
                    <span>Complete Limitation of Liability &amp; Hold Harmless</span>
                  </h2>
                  <p>
                    By using this platform, you expressly agree that:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-stone-600">
                    <li>
                      <strong>No Liability for Stays:</strong> Travel Malawi, its operators, directors, and affiliates shall have zero liability for any injury, illness, property loss, property damage, personal harm, financial loss, delay, inconvenience, or expense sustained by any guest or traveler at or in connection with any listed property.
                    </li>
                    <li>
                      <strong>No Liability for Financial Disputes or Grievances:</strong> Travel Malawi shall not be liable for any dispute regarding deposits, pricing, cancellations, refunds, or non-performance by any property host.
                    </li>
                    <li>
                      <strong>Hold Harmless:</strong> You agree to defend, indemnify, and hold harmless Travel Malawi from and against any claims, liabilities, damages, losses, and expenses arising out of or in any way connected with your stay or interactions with any property listed on this platform.
                    </li>
                  </ul>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">5</span>
                    <span>Host Obligations, Licensing &amp; Statutory Compliance</span>
                  </h2>
                  <p>
                    Independent property hosts and accommodation managers who list their properties on Travel Malawi represent, warrant, and certify that:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-stone-600">
                    <li>
                      <strong>Statutory Licences &amp; Regulatory Compliance:</strong> The property holds all necessary business registrations, municipal permits, and valid Tourism Operating Licences required under Malawian law, including compliance with Section 27 of the Tourism Act, 2025. The statutory and legal obligation to obtain and maintain an operating licence rests solely and exclusively upon the accommodation owner or operator.
                    </li>
                    <li>
                      <strong>No Regulatory Substitution:</strong> Travel Malawi operates strictly as a digital media directory, discovery index, and technology communication conduit. Travel Malawi is not a tourism operator, accommodation provider, travel agency, or regulatory authority, and does not issue, verify, endorse, or guarantee the statutory licensing, safety standards, or physical premises of listed third-party stays.
                    </li>
                    <li>
                      <strong>Legal Authority:</strong> The person listing the property possesses full legal authority, ownership, or management authorization to offer the accommodation for guest reservations.
                    </li>
                    <li>
                      <strong>Accurate Pricing &amp; Direct Settlements:</strong> All rates entered (in MWK or USD) are genuine, transparent, and settled directly between guest and host without hidden platform markups.
                    </li>
                    <li>
                      <strong>Property Accuracy:</strong> Listings accurately disclose whether the property is an entire private home/cottage or individual guest rooms, along with accurate bed counts and guest capacities.
                    </li>
                    <li>
                      <strong>Guest Deposits &amp; Policies:</strong> Hosts handle all deposits, check-in balances, cancellations, and disputes directly and responsibly according to their own published terms.
                    </li>
                  </ul>
                </section>

                <section className="space-y-3 pt-4 border-t border-stone-100">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-900 text-xs font-semibold flex items-center justify-center shrink-0">6</span>
                    <span>Questions &amp; Contact Desk</span>
                  </h2>
                  <p>
                    For questions regarding these platform terms, please contact our administrative desk at <a href="mailto:info@ulendomalawi.com" className="text-stone-900 font-semibold underline">info@ulendomalawi.com</a>.
                  </p>
                </section>
              </>
            )}
          </div>

          <footer className="pt-6 border-t border-stone-200 text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              Travel Malawi Platform Operations · The Warm Heart of Africa
            </div>
            <div className="text-xs text-stone-500">
              Direct Marketplace · Zero Platform Liability
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
