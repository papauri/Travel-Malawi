const fs = require('fs');
let content = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

content = content.replace(
  `to="/dashboard"
                      className="text-sm font-medium text-stone-600 hover:text-stone-900 transition flex items-center gap-1"`,
  `to="/dashboard"
                      className="hidden md:flex text-sm font-medium text-stone-600 hover:text-stone-900 transition items-center gap-1"`
);

content = content.replace(
  `to="/admin"
                      className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"`,
  `to="/admin"
                      className="hidden md:block text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"`
);

content = content.replace(
  `to="/my-bookings"
                      className="text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"`,
  `to="/my-bookings"
                      className="hidden md:block text-sm font-medium text-stone-600 hover:text-stone-900 transition relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-stone-900 after:transition-all hover:after:w-full"`
);

fs.writeFileSync('src/components/Navbar.tsx', content);
