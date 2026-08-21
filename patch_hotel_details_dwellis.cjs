const fs = require('fs');
let code = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf-8');
code = code.replace(/\r\n/g, '\n');

// Increase Gallery height
code = code.replace('md:h-[60vh]', 'md:h-[70vh]');
code = code.replace('rounded-3xl', 'rounded-2xl');
code = code.replace('rounded-3xl', 'rounded-2xl');
code = code.replace('rounded-3xl', 'rounded-2xl');

// Increase Headline size
code = code.replace(
  'text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight',
  'text-5xl md:text-7xl lg:text-[6rem] font-serif font-medium tracking-tight text-white mb-4 leading-none'
);

// Add top padding to gallery container to push it down from transparent nav
code = code.replace(
  '<div className="w-full max-w-7xl mx-auto px-6 lg:px-8 mt-6">',
  '<div className="w-full max-w-[90rem] mx-auto px-4 lg:px-12 mt-4">'
);

// Widen the content area
code = code.replace(
  '<div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-3 gap-16">',
  '<div className="max-w-[90rem] mx-auto px-4 lg:px-12 py-24 grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-24">'
);

// Update H2s to Dwellis style
code = code.replaceAll(
  'text-3xl font-serif text-stone-900 mb-6',
  'text-4xl md:text-5xl font-serif text-stone-900 mb-8 tracking-tight'
);
code = code.replaceAll(
  'text-3xl font-serif text-stone-900 mb-8',
  'text-4xl md:text-5xl font-serif text-stone-900 mb-10 tracking-tight'
);

fs.writeFileSync('src/pages/HotelDetails.tsx', code, 'utf-8');
console.log('HotelDetails updated');
