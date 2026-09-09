const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace(
  /className="text-sm font-medium text-stone-600 hover:text-stone-900 transition flex items-center gap-1"/g,
  "className={`text-sm font-medium transition relative after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all flex items-center gap-1 ${location.pathname.startsWith('/dashboard') ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}"
);

code = code.replace(
  /<Link\s*to="\/admin"\s*className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"/g,
  "<Link\n                      to=\"/admin\"\n                      className={`text-sm font-medium transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all ${location.pathname.startsWith('/admin') ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}"
);

code = code.replace(
  /<Link\s*to="\/saved"\s*className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"/g,
  "<Link\n                        to=\"/saved\"\n                        className={`text-sm font-medium transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all ${location.pathname === '/saved' ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}"
);

code = code.replace(
  /<Link\s*to="\/my-bookings"\s*className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"/g,
  "<Link\n                        to=\"/my-bookings\"\n                        className={`text-sm font-medium transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-stone-900 after:transition-all ${location.pathname.startsWith('/my-bookings') ? 'text-stone-900 after:w-full' : 'text-stone-600 hover:text-stone-900 after:w-0 hover:after:w-full'}`}"
);

fs.writeFileSync('src/components/Navbar.tsx', code);
