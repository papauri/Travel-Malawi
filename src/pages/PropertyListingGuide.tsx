import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Camera, 
  BedDouble, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  ListPlus,
  Phone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAuthDialog } from '../contexts/AuthDialogContext';
import { isHotelManager } from '../lib/roles';
import EditableSection from '../components/EditableSection';

export default function PropertyListingGuide() {
  const { user } = useAuth();
  const { openAuth } = useAuthDialog();

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <div className="bg-stone-900 text-stone-300 py-3 px-4 sm:px-6 lg:px-8 border-b border-stone-800 text-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-stone-400" />
            <span className="text-stone-300 font-medium">Host Operations Manual</span>
          </div>
          <span className="text-stone-400 text-xs">Public Resource</span>
        </div>
      </div>

      <header className="relative bg-stone-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 text-xs font-semibold uppercase tracking-wider mb-6">
            <ListPlus className="w-3.5 h-3.5 text-stone-400" />
            <span>Onboarding Guide</span>
          </div>
          
          <h1 className="font-serif text-3xl sm:text-5xl text-white tracking-tight leading-tight">
            How to List Your Property
          </h1>
          
          <p className="mt-4 text-stone-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed font-light">
            <EditableSection
              docId="docs_listing"
              fieldId="header_subtitle"
              defaultText="Welcome to Travel Malawi! We've made listing your property as simple and straightforward as possible. We don't take any commission cuts, and there are absolutely no fees to list your hotel, resort, lodge, or camp."
              multiline
            />
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 space-y-6">
        
        {/* Step 1 */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Step 1</span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1">Create a Host Account</h2>
            </div>
          </div>
          <div className="space-y-4 text-stone-600 text-sm leading-relaxed">
            <p>1. Click the <strong>"List your property"</strong> button in the top navigation bar.</p>
            <p>2. You will be greeted by our host onboarding page. Click <strong>"Create your host account"</strong>.</p>
            <p>3. If you already have a traveler account, you can simply click <strong>"Start hosting on this account"</strong> to instantly upgrade your account to a Property Manager role.</p>
          </div>
        </section>

        {/* Step 2 */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <ListPlus className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Step 2</span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1">The Basics</h2>
            </div>
          </div>
          <p className="text-stone-600 text-sm mb-4">Once your account is ready, our onboarding wizard will guide you through the setup:</p>
          <ul className="space-y-3 text-stone-600 text-sm leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Property Name:</strong> Enter the official name of your hotel, resort, lodge, or camp.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Description:</strong> Write a compelling description of what makes your property unique.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Category:</strong> Choose from categories like Safari Camp, Luxury Lodge, Boutique Hotel, or Backpacker Hostel so guests can filter for you.</span></li>
          </ul>
        </section>

        {/* Step 3 */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Step 3</span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1">Location & Amenities</h2>
            </div>
          </div>
          <p className="text-stone-600 text-sm mb-4">Help guests figure out exactly where you are located and what you have to offer.</p>
          <ul className="space-y-3 text-stone-600 text-sm leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Town or Area:</strong> Select your primary location (e.g., Cape Maclear, Lilongwe, Nkhata Bay).</span></li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Directions (Optional):</strong> Provide any specific directions or landmarks to help guests find you, especially if you are off the beaten path.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Amenities:</strong> Click to toggle common amenities like WiFi, Pool, Restaurant, or Air Conditioning. You can also type in custom amenities like "Kayaks", "Curio Shop", or "Guided Tours" and hit Add.</span></li>
          </ul>
        </section>

        {/* Step 4 */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Step 4</span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1">Contact Details & Photos</h2>
            </div>
          </div>
          <ul className="space-y-3 text-stone-600 text-sm leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Contact:</strong> Provide your direct Phone Number, Email, and optionally a WhatsApp number. <em>Note: These are only shown to guests once a booking request is made, ensuring your privacy.</em></span></li>
            <li className="flex gap-2"><Camera className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span><strong>Photos:</strong> Upload your property's best photos to build your gallery. You can drag and drop images directly into the uploader. The first image you upload will automatically become your <strong>Main Image</strong> shown on the search results.</span></li>
          </ul>
        </section>

        {/* Final Step */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-stone-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <BedDouble className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Final Step</span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1">Add Your Rooms!</h2>
            </div>
          </div>
          <p className="text-stone-600 text-sm mb-4">Once you submit your property details, your property will be created and you will be immediately dropped into the <strong>Room Editor</strong>.</p>
          <ul className="space-y-3 text-stone-600 text-sm leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span>You must add at least one room type (e.g., "Standard Double", "Lakeview Suite") before guests can book.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> <span>You can set Dual Currency pricing (USD and MWK) and attach room packages (e.g., Breakfast Included).</span></li>
          </ul>
          
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
            <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-serif font-bold text-amber-900 text-sm">Approval Process</h4>
              <p className="text-amber-800 text-xs mt-2 leading-relaxed">
                For quality control, all new properties are marked as <strong>Pending</strong> by default. Our global admins will review your listing and flip it to <strong>Approved</strong> within 24 hours, at which point it will instantly appear live on the Travel Malawi homepage!
              </p>
            </div>
          </div>
        </section>
        
        {/* CTA Banner */}
        <section className="rounded-3xl bg-stone-900 text-white p-8 sm:p-12 border border-stone-800 relative overflow-hidden text-center mt-8">
          <div className="max-w-2xl mx-auto relative z-10">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mt-3 tracking-tight">
              Ready to Welcome More Guests?
            </h2>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/list-your-property"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-stone-900 font-semibold px-8 py-4 rounded-full text-base transition-all shadow-sm active:scale-95"
              >
                <span>Start Listing Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
