const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

// Update Hero Heading sizes
content = content.replace(
  `className="font-serif text-white max-w-3xl tracking-[-0.03em] leading-[0.95]
                       text-[clamp(2.75rem,7vw,5.5rem)]"`,
  `className="font-serif text-white max-w-3xl tracking-[-0.03em] leading-[0.95]
                       text-[clamp(3.2rem,8vw,6rem)]"`
);

// Update Search Bar Container for mobile
content = content.replace(
  `className="mt-12 bg-white/95 backdrop-blur-xl rounded-3xl lg:rounded-full p-2
                       shadow-2xl shadow-stone-950/30 ring-1 ring-white/60
                       flex flex-col lg:flex-row lg:items-stretch gap-1 lg:gap-0 max-w-4xl"`,
  `className="mt-10 bg-white/95 backdrop-blur-xl rounded-3xl lg:rounded-full p-3 lg:p-2
                       shadow-2xl shadow-stone-950/30 ring-1 ring-white/60
                       flex flex-col lg:flex-row lg:items-stretch gap-2 lg:gap-0 max-w-4xl"`
);

// Make Search Where pill have more padding on mobile
content = content.replace(
  `className="relative flex-[1.5] min-w-0 rounded-2xl lg:rounded-full px-5 py-3 hover:bg-stone-50 transition group"`,
  `className="relative flex-[1.5] min-w-0 rounded-2xl lg:rounded-full px-4 lg:px-5 py-4 lg:py-3 hover:bg-stone-50 transition group bg-white lg:bg-transparent shadow-sm lg:shadow-none ring-1 ring-stone-100 lg:ring-0"`
);

// Do the same for Dates and Who
content = content.replace(
  `className="relative flex-[1.5] min-w-0 rounded-2xl lg:rounded-full px-5 py-3 hover:bg-stone-50 transition"`,
  `className="relative flex-[1.5] min-w-0 rounded-2xl lg:rounded-full px-4 lg:px-5 py-4 lg:py-3 hover:bg-stone-50 transition bg-white lg:bg-transparent shadow-sm lg:shadow-none ring-1 ring-stone-100 lg:ring-0"`
);

content = content.replace(
  `className="relative flex-[1.05] rounded-2xl lg:rounded-full px-5 py-3 hover:bg-stone-50 transition"`,
  `className="relative flex-[1.05] rounded-2xl lg:rounded-full px-4 lg:px-5 py-4 lg:py-3 hover:bg-stone-50 transition bg-white lg:bg-transparent shadow-sm lg:shadow-none ring-1 ring-stone-100 lg:ring-0"`
);

// Remove the mobile divider since we now have distinct "pills" on mobile inside the container
content = content.replace(
  `<div className="lg:hidden h-px mx-4 bg-stone-100" />`,
  `{/* Mobile dividers removed for pill look */}`
);
content = content.replace(
  `<div className="lg:hidden h-px mx-4 bg-stone-100" />`,
  `{/* Mobile dividers removed for pill look */}`
);

fs.writeFileSync('src/pages/Home.tsx', content);
