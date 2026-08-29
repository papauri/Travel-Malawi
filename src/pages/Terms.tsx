import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Shield } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-stone-50 py-20 px-6">
      <Helmet>
        <title>Terms of Service - ProManaged IT Hotel Booking</title>
        <meta name="description" content="Terms and conditions for using our booking platform." />
      </Helmet>
      
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 p-8 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-stone-100 p-3 rounded-2xl text-stone-900">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Terms of Service</h1>
        </div>
        
        <div className="space-y-6 text-stone-600 leading-relaxed">
          <p>Welcome to our platform. By accessing or using our booking service, you agree to be bound by these Terms of Service.</p>
          
          <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">1. Our Role</h2>
          <p>Our platform acts purely as an intermediary technology service that connects travelers with independent accommodation providers (Hotels, Lodges, and Retreats). We do not own, manage, or operate any of the properties listed on this site.</p>
          
          <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">2. Bookings and Payments</h2>
          <p>We do not collect payments online. When you submit a booking request through our platform, you are entering into a direct agreement with the respective property. All payments, deposits, and financial transactions are to be settled directly with the property manager according to their specific policies upon arrival or via their preferred offline methods.</p>
          
          <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">3. User Responsibilities</h2>
          <p>You agree to provide accurate and truthful information when submitting a booking request. Submitting false requests or spamming properties may result in a permanent ban from using our services.</p>
          
          <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">4. Liability</h2>
          <p>While we strive to ensure all property listings are accurate, we cannot guarantee the exact state or quality of the accommodations. We hold no liability for personal injury, property damage, or booking disputes that occur between you and the accommodation provider.</p>
          
          <p className="pt-8 text-sm text-stone-400">Last updated: August 2026</p>
        </div>
      </div>
    </div>
  );
}
