import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Lock } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import MarkdownContent from '../components/MarkdownContent';

export default function Privacy() {
  const { settings } = useSystemSettings();
  
  return (
    <div className="min-h-screen bg-stone-50 py-20 px-6">
      <Helmet>
        <title>Privacy Policy - ProManaged IT Hotel Booking</title>
        <meta name="description" content="How we handle and protect your personal information." />
      </Helmet>
      
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 p-8 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-stone-100 p-3 rounded-2xl text-stone-900">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Privacy Policy</h1>
        </div>
        
        <div className="space-y-6 text-stone-600 leading-relaxed">
          {settings.privacyPolicy ? (
            <MarkdownContent content={settings.privacyPolicy} />
          ) : (
            <>
              <p>Your privacy is important to us. This policy outlines how we collect, use, and protect your personal information.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">1. Information We Collect</h2>
              <p>When you use our platform to request a booking, we collect basic contact information necessary to facilitate the reservation. This includes your Name, Email Address, Phone Number, and any Special Requests you provide.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">2. How We Use Your Information</h2>
              <p>Your information is solely used to connect you with the property you are booking. When you submit a request, your contact details are securely transmitted directly to the manager of that specific property so they can confirm your reservation.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">3. Data Sharing and Protection</h2>
              <p><strong>We do not sell, rent, or trade your personal data to third parties.</strong> Your data is stored securely using industry-standard cloud infrastructure (Google Firebase). Only the administrators of this platform and the manager of the property you booked can access your booking details.</p>
              
              <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4">4. Payment Information</h2>
              <p>Because we do not process payments online, we never ask for, collect, or store your credit card details or banking information.</p>
              
              <p className="pt-8 text-sm text-stone-400">Last updated: August 2026</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
