const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
code = code.replace(/\r\n/g, '\n');

// Replace Hero Section outer container
code = code.replace(
  '<section className="relative h-[75vh] md:h-[80vh] w-full flex flex-col items-center justify-center overflow-hidden rounded-b-[2rem] md:rounded-b-[2.5rem] shadow-2xl bg-stone-900">',
  '<section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-stone-900">'
);

// Replace img with motion.img for slow zoom
const oldImg = `<img 
          src="https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=2940&auto=format&fit=crop"
          alt="Luxury Resort"
          className="absolute inset-0 w-full h-full object-cover object-center z-0 animate-pulse-slow"
         
        />`;
const newImg = `<motion.img 
          initial={{ scale: 1 }}
          animate={{ scale: 1.1 }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2940&auto=format&fit=crop"
          alt="Luxury Resort"
          className="absolute inset-0 w-full h-full object-cover object-center z-0"
        />`;
code = code.replace(oldImg, newImg);

// Replace headline
code = code.replace(
  'className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif text-white max-w-4xl leading-[1.1] mb-8 md:mb-12 drop-shadow-xl px-4"',
  'className="text-5xl sm:text-6xl md:text-8xl lg:text-[7rem] font-serif text-white max-w-5xl leading-[1] tracking-tighter mb-12 drop-shadow-2xl px-4"'
);
code = code.replace(
  'Find the perfect place to stay.',
  'Discover the warm heart of Africa.'
);

// Update section paddings for Dwellis aesthetic (luxurious spacing)
code = code.replace(
  '<section className="max-w-7xl mx-auto px-6 lg:px-8 py-20 w-full flex-1">',
  '<section className="max-w-[90rem] mx-auto px-6 lg:px-12 py-32 w-full flex-1">'
);

// Update H2 in search results section
code = code.replace(
  'className="text-3xl font-serif text-stone-900 mb-3"',
  'className="text-4xl md:text-5xl font-serif text-stone-900 mb-4 tracking-tight"'
);

// Update List Your Property CTA
code = code.replace(
  '<section className="bg-emerald-900 text-white py-24 relative overflow-hidden">',
  '<section className="bg-stone-900 text-white py-32 relative overflow-hidden">'
);
code = code.replace(
  'className="text-4xl md:text-5xl font-serif mb-6 leading-tight"',
  'className="text-5xl md:text-6xl font-serif mb-8 leading-tight tracking-tight"'
);

fs.writeFileSync('src/pages/Home.tsx', code, 'utf-8');
console.log("Home updated");
