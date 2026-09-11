import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FileText } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import MarkdownContent from '../components/MarkdownContent';

export default function Terms() {
  const { settings } = useSystemSettings();

  return (
    <div className="min-h-screen bg-stone-50 py-10 sm:py-16 md:py-20 px-4 sm:px-6">
      <Helmet>
        <title>Terms of Service - Travel Malawi</title>
        <meta name="description" content="Terms and conditions for using our booking platform." />
      </Helmet>
      
      <div className="max-w-3xl mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-stone-200 p-5 sm:p-8 md:p-12">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-stone-100 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-stone-900">
            <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">Terms of Service</h1>
        </div>
        
        <div className="space-y-6 text-stone-600 leading-relaxed">
          {settings.termsOfService ? (
            <MarkdownContent content={settings.termsOfService} />
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
