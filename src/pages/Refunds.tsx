import React from 'react';
import { Helmet } from 'react-helmet-async';
import { RefreshCcw } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';

export default function Refunds() {
  const { settings } = useSystemSettings();

  return (
    <div className="min-h-screen bg-stone-50 py-20 px-6">
      <Helmet>
        <title>Refunds & Cancellations - ProManaged IT Hotel Booking</title>
        <meta name="description" content="Information regarding booking cancellations and refunds." />
      </Helmet>
      
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 p-8 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-stone-100 p-3 rounded-2xl text-stone-900">
            <RefreshCcw className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Refunds & Cancellations</h1>
        </div>
        
        <div className="space-y-6 text-stone-600 leading-relaxed">
          {settings.refundPolicy ? (
            <div className="whitespace-pre-wrap">{settings.refundPolicy}</div>
          ) : (
            <>
              <p>Because our platform does not process any online payments, our refund policy is entirely informational.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">1. No Platform Refunds</h2>
              <p>Since we do not collect any money from you at the time of booking, we cannot issue any refunds. We do not hold deposits or booking fees.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">2. Property-Specific Policies</h2>
              <p>Every hotel, lodge, or camp listed on our platform has its own distinct cancellation and refund policies. When you book a stay, you are subject to the specific rules set by that property manager.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">3. Disputing Charges</h2>
              <p>If you have paid a deposit or full amount directly to a property (via bank transfer, mobile money, or in person) and need a refund due to cancellation, you must contact the property host directly to resolve the issue. We cannot mediate financial disputes.</p>
              
              <p className="pt-8 text-sm text-stone-400">Last updated: August 2026</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
