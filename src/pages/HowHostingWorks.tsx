import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import SEOHead from '../components/SEOHead';

interface Step {
  title: string;
  short: string;
  details: string[];
}

const STEPS: Step[] = [
  {
    title: 'Create your listing',
    short: 'Add your property, four photos and your rates in MWK and USD.',
    details: [
      'List a whole property or individual rooms.',
      'Take daytime photos of the bed, view, bathroom and dining area.',
      'Add a GPS pin and a landmark so guests can find the gate.',
    ],
  },
  {
    title: 'Wait for approval',
    short: 'Our team reviews your listing, usually within 24 hours.',
    details: ['Once approved, your listing is live and guests can find it on the map and in search.'],
  },
  {
    title: 'Answer guest messages',
    short: 'Guests message you in the app or on WhatsApp before they book.',
    details: [
      'Use chat for boat pickups, meals and arrival times.',
      'Ulendo, the concierge assistant in your dashboard, can draft replies and suggest rates.',
    ],
  },
  {
    title: 'Confirm the booking',
    short: 'Review the request and confirm the dates in your dashboard.',
    details: [
      'Connect your Airbnb, Booking.com or other calendar with an iCal link so dates never overlap.',
      'Block dates yourself at any time.',
    ],
  },
  {
    title: 'Get paid directly',
    short: 'Guests pay you on Airtel Money, TNM Mpamba, bank transfer or card.',
    details: [
      'Travel Malawi takes 0% commission. If you set MK 85,000, you keep MK 85,000.',
      'You set your own deposit and cancellation terms.',
    ],
  },
];

const GUIDES = [
  { to: '/host-guide', title: 'Host Starter Pack', note: 'Setup manual and message templates' },
  { to: '/listing-guide', title: 'Property Listing Guide', note: 'Directions, photos and room names' },
  { to: '/leaflet', title: 'Stay Owner Leaflet', note: 'One printable page' },
];

export default function HowHostingWorks() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-16">
      <SEOHead
        title="How Hosting Works — Direct Booking Architecture & Host Tools"
        description="Learn how hosting works on Travel Malawi. Direct WhatsApp guest communication, local currency deposits (MWK & USD), real-time availability calendar, and 0% host commissions."
        keywords="how hosting works Malawi, lodge hosting guide, cottage management Malawi, Travel Malawi host workflow"
        url="https://ulendomalawi.com/how-hosting-works"
      />

      <main className="tm-page max-w-3xl py-8 sm:py-12">
        <header>
          <h1 className="tm-h1">How hosting works</h1>
          <p className="tm-lead mt-2">Five steps from listing to payment. No commission, no waiting for overseas payouts.</p>
        </header>

        <ol className="mt-8 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="tm-panel flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-medium text-stone-50">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="tm-h2">{step.title}</h2>
                <p className="mt-1 text-sm text-stone-700">{step.short}</p>
                <details className="mt-2 text-sm">
                  <summary className="tm-link cursor-pointer">Details</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600">
                    {step.details.map((d) => (
                      <li key={d} className="break-words">{d}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </li>
          ))}
        </ol>

        <div className="tm-actions mt-8">
          <Link to="/list-your-property" className="tm-btn tm-btn-primary">
            Start your listing
            <ArrowRight size={16} />
          </Link>
          <a
            href="https://api.whatsapp.com/send?phone=265999000000&text=Muli%20bwanji!%20I%20have%20questions%20about%20listing%20my%20property%20on%20Travel%20Malawi."
            target="_blank"
            rel="noopener noreferrer"
            className="tm-btn tm-btn-secondary"
          >
            <Phone size={16} />
            Ask on WhatsApp
          </a>
        </div>

        <section className="tm-divider mt-10 pt-6">
          <h2 className="tm-h2">Guides for hosts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {GUIDES.map((g) => (
              <li key={g.to} className="break-words">
                <Link to={g.to} className="tm-link">{g.title}</Link>
                <span className="tm-muted"> — {g.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
