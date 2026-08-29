import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FileText } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';

export default function Terms() {
  const { settings } = useSystemSettings();

  return (
    <div className="min-h-screen bg-stone-50 py-20 px-6">
      <Helmet>
        <title>Terms of Service - ProManaged IT Hotel Booking</title>
        <meta name="description" content="Terms and conditions for using our booking platform." />
      </Helmet>
      
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 p-8 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-stone-100 p-3 rounded-2xl text-stone-900">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Terms of Service</h1>
        </div>
        
        <div className="space-y-6 text-stone-600 leading-relaxed">
          {settings.termsOfService ? (
            <div className="whitespace-pre-wrap">{settings.termsOfService}</div>
          ) : (
            <>
              <p>Welcome to our platform. By accessing or using our service, you agree to be bound by these terms.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">1. Our Role</h2>
              <p>This platform acts exclusively as an intermediary booking board. We facilitate communication between travelers and property managers. We do not own, operate, or manage any of the properties listed on this site.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">2. Financial Transactions</h2>
              <p><strong>We process absolutely zero payments online.</strong> All financial transactions, deposits, and settlements occur strictly offline between you (the guest) and the property manager. We hold no liability for financial disputes, refunds, or payment processing.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">3. Booking Requests</h2>
              <p>Submitting a booking request does not guarantee a reservation. A booking is only finalized when you receive direct confirmation from the property host.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">4. Liability</h2>
              <p>We are not responsible for the accuracy of property listings, the quality of your stay, or any injuries, damages, or losses incurred during your trip. You agree to hold us harmless from any claims arising from your use of the properties listed here.</p>
              
              <p className="pt-8 text-sm text-stone-400">Last updated: August 2026</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
