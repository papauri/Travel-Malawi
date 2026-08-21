const fs = require('fs');

// --- NAVBAR ---
let navCode = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');
navCode = navCode.replace(/\r\n/g, '\n');

// Add Map icon if not present
if (!navCode.includes('Map,')) {
  navCode = navCode.replace('Palmtree,', 'Palmtree, Map,');
}

const oldNavLogo = `<Link to="/" className="flex items-center gap-3 group">
                <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-stone-900 text-white shadow-md group-hover:bg-emerald-600 transition duration-300">
                  <Palmtree className="h-6 w-6" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <span className="text-2xl font-serif font-bold tracking-tight text-stone-900 group-hover:text-stone-700 transition">
                  MalawiScapes
                </span>
              </Link>`;

const newNavLogo = `<Link to="/" className="flex items-center gap-3 group">
                <div className="relative flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 text-white shadow-xl group-hover:shadow-emerald-500/20 group-hover:from-emerald-600 group-hover:to-emerald-500 transition-all duration-300 transform group-hover:-translate-y-0.5">
                  <Map className="h-5 w-5 absolute opacity-30 -ml-2 -mt-2" />
                  <Palmtree className="h-6 w-6 relative z-10" />
                  <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-stone-900 group-hover:border-emerald-600 transition-colors" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-black tracking-tighter text-stone-900 leading-none group-hover:text-emerald-700 transition">
                    TRAVEL<span className="text-emerald-600 font-serif italic ml-0.5">MALAWI</span>
                  </span>
                  <span className="text-[0.65rem] font-bold text-stone-400 uppercase tracking-[0.2em] mt-1 ml-0.5">
                    The Warm Heart
                  </span>
                </div>
              </Link>`;

navCode = navCode.replace(oldNavLogo, newNavLogo);
fs.writeFileSync('src/components/Navbar.tsx', navCode, 'utf-8');

// --- FOOTER ---
let footCode = fs.readFileSync('src/components/Footer.tsx', 'utf-8');
footCode = footCode.replace(/\r\n/g, '\n');

// Add Map icon if not present
if (!footCode.includes('Map,')) {
  footCode = footCode.replace('Palmtree,', 'Palmtree, Map,');
}

const oldFootLogo = `<Link to="/" className="flex items-center gap-2 text-white">
              <Palmtree className="h-8 w-8 text-white" />
              <span className="text-2xl font-serif font-bold tracking-tight">MalawiScapes</span>
            </Link>`;
            
const newFootLogo = `<Link to="/" className="flex items-center gap-3 group">
              <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 text-white group-hover:bg-emerald-500 transition-all duration-300">
                <Palmtree className="h-6 w-6 relative z-10" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tighter text-white leading-none">
                  TRAVEL<span className="text-emerald-400 font-serif italic ml-0.5">MALAWI</span>
                </span>
              </div>
            </Link>`;
            
footCode = footCode.replace(oldFootLogo, newFootLogo);
footCode = footCode.replace('bookings@malawiscapes.com', 'bookings@travelmalawi.com');
footCode = footCode.replace('MalawiScapes. All rights', 'Travel Malawi. All rights');
fs.writeFileSync('src/components/Footer.tsx', footCode, 'utf-8');

console.log("Logo updated");
