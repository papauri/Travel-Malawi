const fs = require('fs');
let code = fs.readFileSync('src/pages/ManagerDashboard.tsx', 'utf8');

code = code.replace(
  `          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-stone-200 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-800 mx-auto mb-5">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Host Dashboard Access
            </h1>
            <p className="text-stone-600 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              The Host Dashboard is reserved for registered Malawian property owners, B&B hosts, lodge managers, cottage operators, and safari camps.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4 text-left">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                <div className="font-bold text-stone-900 flex items-center justify-between">
                  <span>Guest Account</span>
                  <span className="text-[10px] text-stone-500 uppercase">Traveler</span>
                </div>
                <ul className="text-stone-600 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Browse stays, B&amp;Bs &amp; direct host chats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>Booking vouchers &amp; trip list</span>
                  </li>
                  <li className="text-stone-400 italic">
                    (No dashboard or listing tools)
                  </li>
                </ul>
              </div>
              <div className="p-4 rounded-2xl bg-stone-900 text-white border border-stone-800 text-xs space-y-2">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Property Owner Account</span>
                  <span className="text-[10px] text-stone-300 uppercase font-semibold">Host</span>
                </div>
                <ul className="text-stone-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Host Dashboard: Manage rooms &amp; rates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>Host Starter Pack &amp; response templates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                    <span>0% commission direct WhatsApp stays</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => openAuth('host')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition shadow-sm cursor-pointer"
              >
                <span>Sign Up as Property Owner</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-6 py-3.5 rounded-full text-sm transition border border-stone-200 cursor-pointer"
              >
                Sign In to Existing Account
              </button>
            </div>
          </div>`,
  `          <div className="bg-white rounded-3xl p-8 sm:p-12 md:px-16 border border-stone-200 shadow-sm text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 mb-4">
              List your property on Travel Malawi
            </h1>
            <p className="text-stone-600 text-base md:text-lg mb-10 max-w-lg mx-auto">
              Join our community of Malawian property owners, B&B hosts, and lodge managers. Manage your bookings, connect directly with guests, and pay 0% commissions.
            </p>

            <div className="flex flex-col items-center justify-center gap-4">
              <button
                onClick={() => openAuth('host')}
                className="w-full sm:w-80 inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-bold px-8 py-4 rounded-full text-base transition shadow-md cursor-pointer"
              >
                <span>Become a Host</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-stone-500 text-sm mt-4">
                Already have an account?{' '}
                <button
                  onClick={() => openAuth('signin')}
                  className="font-bold text-emerald-700 hover:text-emerald-800 underline transition cursor-pointer"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </div>`
);

fs.writeFileSync('src/pages/ManagerDashboard.tsx', code);
