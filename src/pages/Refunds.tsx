import React from 'react';
import { Helmet } from 'react-helmet-async';
import { CreditCard } from 'lucide-react';

export default function Refunds() {
  return (
    <div className="min-h-screen bg-stone-50 py-20 px-6">
      <Helmet>
        <title>Refund & Cancellation Policy - ProManaged IT Hotel Booking</title>
        <meta name="description" content="Our policies regarding refunds, payments, and cancellations." />
      </Helmet>
      
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 p-8 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-stone-100 p-3 rounded-2xl text-stone-900">
            <CreditCard className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Refund & Cancellation Policy</h1>
        </div>
        
        <div className="space-y-6 text-stone-600 leading-relaxed">
          <p>Because of our unique booking model, our refund and cancellation policies are very straightforward.</p>
          
          <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">1. No Online Payments</h2>
          <p>Our platform does not process any online payments, deposits, or credit card authorizations. Because no money changes hands through our website, <strong>we do not issue refunds directly</strong>.</p>
          
          <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">2. Property-Specific Policies</h2>
          <p>Any financial transactions, including deposits, full payments, cancellations, or refund requests, are strictly governed by the individual policies of the property you have booked.</p>
          <p>If you need to cancel a reservation or request a refund for a deposit you paid directly to a property, you must contact the property manager directly using the contact information provided in your booking confirmation.</p>
          
          <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">3. Cancelling a Pending Request</h2>
          <p>If you have submitted a booking request through our platform but have not yet paid the property or checked in, you can usually cancel it without penalty by notifying the property manager immediately.</p>
          
          <p className="pt-8 text-sm text-stone-400">Last updated: August 2026</p>
        </div>
      </div>
    </div>
  );
}
