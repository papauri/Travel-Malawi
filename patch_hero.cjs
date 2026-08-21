const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
code = code.replace(/\r\n/g, '\n');

// Replace Hero Section classes
code = code.replace(
  'h-[80vh] w-full flex flex-col items-center justify-center overflow-hidden rounded-b-[2.5rem] shadow-2xl bg-stone-900',
  'h-[75vh] md:h-[80vh] w-full flex flex-col items-center justify-center overflow-hidden rounded-b-[2rem] md:rounded-b-[2.5rem] shadow-2xl bg-stone-900'
);

code = code.replace(
  'text-5xl md:text-7xl lg:text-8xl font-serif text-white max-w-4xl leading-[1.1] mb-12 drop-shadow-xl',
  'text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif text-white max-w-4xl leading-[1.1] mb-8 md:mb-12 drop-shadow-xl px-4'
);

code = code.replace(
  'className="bg-white rounded-full p-2 shadow-2xl flex flex-col md:flex-row items-center w-full max-w-4xl border border-stone-200"',
  'className="bg-white rounded-[2rem] md:rounded-full p-2 md:p-2 shadow-2xl flex flex-col md:flex-row items-center w-[90%] md:w-full max-w-4xl border border-stone-200"'
);

// We need to add mobile horizontal dividers.
// There are two vertical dividers: `<div className="hidden md:block w-px h-10 bg-stone-200 mx-2" />`
code = code.replaceAll(
  '<div className="hidden md:block w-px h-10 bg-stone-200 mx-2" />',
  '<div className="hidden md:block w-px h-10 bg-stone-200 mx-2" /><div className="block md:hidden w-[90%] h-px bg-stone-200 my-1" />'
);

// We should fix the spacing inside the search inputs on mobile.
// Location:
code = code.replace(
  'className="flex-1 flex items-center px-6 py-3 hover:bg-stone-50 rounded-full cursor-pointer w-full transition relative group"',
  'className="flex-1 flex items-center px-4 md:px-6 py-3 hover:bg-stone-50 rounded-3xl md:rounded-full cursor-pointer w-full transition relative group"'
);

// Dates:
code = code.replace(
  'className="flex-[1.2] flex items-center px-6 py-3 hover:bg-stone-50 rounded-full cursor-pointer w-full transition"',
  'className="flex-[1.2] flex items-center px-4 md:px-6 py-3 hover:bg-stone-50 rounded-3xl md:rounded-full cursor-pointer w-full transition"'
);

// Guests:
code = code.replace(
  'className="flex-[0.8] flex items-center pl-6 pr-2 py-2 hover:bg-stone-50 rounded-full cursor-pointer w-full transition justify-between relative"',
  'className="flex-[0.8] flex items-center pl-4 md:pl-6 pr-2 py-2 hover:bg-stone-50 rounded-3xl md:rounded-full cursor-pointer w-full transition justify-between relative"'
);

// Adjust the Guest button margin for mobile
code = code.replace(
  'className="bg-emerald-600 text-white p-3 md:p-4 rounded-full hover:bg-emerald-700 transition flex items-center justify-center ml-4 shadow-lg"',
  'className="bg-emerald-600 text-white p-3 md:p-4 rounded-full hover:bg-emerald-700 transition flex items-center justify-center ml-2 md:ml-4 shadow-lg"'
);

// Adjust Guest Dropdown on mobile so it doesn't overflow
code = code.replace(
  'className="absolute top-full mt-4 right-0 bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 w-80 z-50"',
  'className="absolute top-full mt-4 right-0 md:right-0 left-0 md:left-auto bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 w-[calc(100vw-3rem)] md:w-80 z-50"'
);

fs.writeFileSync('src/pages/Home.tsx', code, 'utf-8');
