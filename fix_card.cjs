const fs = require('fs');
let code = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

// Replace the motion.div class to use grid
code = code.replace(
  'className="w-[85vw] sm:w-[400px] md:w-full shrink-0 snap-center flex flex-col md:flex-row md:items-start gap-6 p-5 md:p-6 lg:p-7 bg-white border border-stone-200 rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300"',
  'className="w-[85vw] sm:w-[400px] md:w-full shrink-0 snap-center grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 p-5 md:p-6 lg:p-7 bg-white border border-stone-200 rounded-[24px] shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"'
);

// We need to also add overflow-hidden to the card just in case, but grid + min-w-0 should fix it.

// Fix image container width
code = code.replace(
  '<div className="w-full md:w-[45%] lg:w-2/5 aspect-[4/3] overflow-hidden rounded-[16px] relative shrink-0 group">',
  '<div className="w-full aspect-[4/3] overflow-hidden rounded-[16px] relative group">'
);

// Fix text container
code = code.replace(
  '<div className="w-full md:w-auto flex-1 min-w-0 flex flex-col justify-between py-1 md:py-2 md:pl-2">',
  '<div className="w-full flex flex-col justify-between py-1 min-w-0">'
);

// Make the price+reserve container wrap
code = code.replace(
  '<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-4 pt-4 border-t border-stone-100">',
  '<div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mt-4 pt-4 border-t border-stone-100 flex-wrap">'
);

fs.writeFileSync('src/pages/HotelDetails.tsx', code);
console.log("Patched grid layout");
