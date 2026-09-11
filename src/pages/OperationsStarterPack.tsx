import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase,
  Building2,
  MapPin, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Target,
  Users,
  MessageSquare,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../hooks/useSystemSettings';
import EditableSection from '../components/EditableSection';

export default function OperationsStarterPack() {
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const domain = settings.platformDomain || 'https://travel-malawi-10840607522.us-west1.run.app';

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-stone-400" />
            <span className="text-stone-300 font-medium">Internal Operations Manual</span>
          </div>
          <span className="text-stone-400 text-xs">Admin & Operations Access</span>
        </div>
      </div>

      <header className="relative bg-stone-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 text-xs font-semibold uppercase tracking-wider mb-6">
            <Briefcase className="w-3.5 h-3.5 text-stone-400" />
            <span>Operations Toolkit</span>
          </div>
          
          <h1 className="font-serif text-3xl sm:text-5xl text-white tracking-tight leading-tight">
            Operations Starter Pack
          </h1>
          
          <p className="mt-4 text-stone-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-light">
            <EditableSection
              docId="docs_operations"
              fieldId="header_subtitle"
              defaultText="Your comprehensive guide to property acquisition, onboarding, direct bookings, and ecosystem growth for Travel Malawi."
              multiline
            />
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 space-y-6">
        
        {/* Core Operations */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Pillars</span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1">Core Responsibilities</h2>
            </div>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-5 h-5 text-stone-700" />
                <h3 className="font-bold text-stone-900">1. Property Acquisition</h3>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Get the best hotels, resorts, lodges, cottages, campsites, and boutique hotels across Malawi listed on our platform. Target Cape Maclear, Lilongwe, Blantyre, and Zomba.
              </p>
            </div>
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="w-5 h-5 text-stone-700" />
                <h3 className="font-bold text-stone-900">2. Quality Control</h3>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Ensure properties have beautiful, high-res photos, exact Google Maps pins, and competitive rates in both USD and MWK. No blurry photos.
              </p>
            </div>
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-5 h-5 text-stone-700" />
                <h3 className="font-bold text-stone-900">3. Concierge Desk</h3>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Handle WhatsApp inquiries from travelers. Answer questions about road conditions, recommend itineraries, and connect them to hosts.
              </p>
            </div>
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-3 mb-3">
                <TrendingUp className="w-5 h-5 text-stone-700" />
                <h3 className="font-bold text-stone-900">4. Growth & Marketing</h3>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Post high-quality Reels, TikToks, and Facebook guides targeting domestic expats, diaspora, and regional tourists looking for getaways.
              </p>
            </div>
          </div>
        </section>

        {/* Value Prop */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-serif font-bold text-stone-900">Value Proposition: Why Properties Choose Us</h2>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              When pitching to properties, emphasize these three core pillars.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border border-stone-200 bg-emerald-50/50">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">0% Commission Model</h4>
                <p className="text-xs text-stone-600 mt-1">Unlike international OTAs charging 15-20%, we charge 0%. Hosts keep 100% of their revenue.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border border-stone-200 bg-blue-50/50">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">Direct Guest Connection</h4>
                <p className="text-xs text-stone-600 mt-1">Guests inquire via WhatsApp or direct call, ensuring hosts own the relationship and payment settlement.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border border-stone-200 bg-amber-50/50">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">Dual-Currency Support (MWK & USD)</h4>
                <p className="text-xs text-stone-600 mt-1">Protect against kwacha fluctuations. Publish local rates in MWK and international rates in USD simultaneously.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Playbook */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-serif font-bold text-stone-900">Property Acquisition Playbook</h2>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Your primary operational metric in Month 1 is the Number of Verified Live Properties.
            </p>
          </div>
          
          <div className="space-y-8">
            <div>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider mb-3">1. Target Identification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-stone-200 p-4 rounded-xl text-xs">
                  <strong>Lakefront (Cape Maclear/Mangochi):</strong><br/>
                  Kaya Mawa, Pumulani, Gecko Lounge, The Warm Heart Adventure Lodge, Zabov Cottages, Nanchengwa.
                </div>
                <div className="border border-stone-200 p-4 rounded-xl text-xs">
                  <strong>Safari & Wildlife:</strong><br/>
                  Mvuu Camp, Thawale Camp, Mkulumadzi, Tongole Wilderness Lodge, Bua River.
                </div>
                <div className="border border-stone-200 p-4 rounded-xl text-xs">
                  <strong>Mountain & Forest:</strong><br/>
                  Sunbird Ku Chawe, Zomba Forest Lodge, Kara O Mula, Luwawa Forest Lodge, Chelinda Camp.
                </div>
                <div className="border border-stone-200 p-4 rounded-xl text-xs">
                  <strong>City Boutiques (LLW/BT):</strong><br/>
                  Latitude 13°, Woodlands, Sunbird Mount Soche, Sunbird Capital, boutique Airbnbs.
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wider mb-3">2. Onboarding Options</h3>
              <div className="space-y-4">
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-sm">
                  <strong>A. Self-Service (Host Does It):</strong><br/>
                  Send them the link to `{domain}/list-your-property`. They create their account and add their details.
                </div>
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-sm">
                  <strong>B. White-Glove Concierge (You Do It For Them - Recommended for Top Tier):</strong><br/>
                  For high-end luxury properties, managers are busy. You ask for their rates and 5 photos via WhatsApp, create the listing via Admin dashboard, and transfer ownership later.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-serif font-bold text-stone-900">First 90 Days Roadmap & KPIs</h2>
          </div>
          
          <div className="space-y-4">
            <div className="border border-stone-200 rounded-2xl p-5">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-stone-900">Month 1: Foundation (Days 1–30)</h4>
                <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full font-medium">Anchor Acquisition</span>
              </div>
              <ul className="text-xs text-stone-600 space-y-1">
                <li>• Onboard 25 core hotels, resorts, and lodges.</li>
                <li>• Launch official social channels (IG, TikTok).</li>
                <li>• Target: 25 live listings, 50 inquiries, 1k followers.</li>
              </ul>
            </div>
            
            <div className="border border-stone-200 rounded-2xl p-5">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-stone-900">Month 2: Expansion (Days 31–60)</h4>
                <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full font-medium">Geographic Reach</span>
              </div>
              <ul className="text-xs text-stone-600 space-y-1">
                <li>• Scale to 60 properties (Liwonde, Majete, Nyika).</li>
                <li>• Launch 4x4 car rental partnerships.</li>
                <li>• Target: 60 live listings, 3 corporate retreat bookings.</li>
              </ul>
            </div>

            <div className="border border-stone-200 rounded-2xl p-5">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-stone-900">Month 3: Dominance (Days 61–90)</h4>
                <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full font-medium">Scale</span>
              </div>
              <ul className="text-xs text-stone-600 space-y-1">
                <li>• Scale to 100+ active properties across all regions.</li>
                <li>• Launch peak holiday season campaigns.</li>
                <li>• Target: Default direct-booking portal for Malawi.</li>
              </ul>
            </div>
          </div>
        </section>
        
      </main>
    </div>
  );
}
