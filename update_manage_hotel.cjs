const fs = require('fs');

const file = 'src/pages/ManageHotel.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /className={`bg-white border p-6 rounded-3xl flex flex-col md:flex-row gap-6 items-center shadow-sm transition/g,
  "className={`bg-white border p-4 sm:p-6 rounded-3xl flex flex-col md:flex-row gap-4 sm:gap-6 items-stretch md:items-center shadow-sm transition"
);
content = content.replace(
  /className="w-full md:w-48 h-32 bg-stone-100 rounded-2xl overflow-hidden shrink-0"/g,
  'className="w-full md:w-48 h-48 sm:h-40 md:h-32 bg-stone-100 rounded-2xl overflow-hidden shrink-0"'
);
content = content.replace(
  /className="flex-1 min-w-0"/g,
  'className="flex-1 min-w-0 w-full flex flex-col justify-center"'
);
content = content.replace(
  /className="flex justify-between items-start mb-2"/g,
  'className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-2"'
);
content = content.replace(
  /className="text-xl font-serif font-bold text-stone-900 truncate pr-4"/g,
  'className="text-xl font-serif font-bold text-stone-900 line-clamp-2 sm:line-clamp-1 pr-0 sm:pr-4"'
);
content = content.replace(
  /className="text-right"/g,
  'className="flex flex-wrap sm:flex-col gap-x-3 gap-y-1 sm:gap-0 text-left sm:text-right items-baseline sm:items-end"'
);
content = content.replace(
  /className="flex md:flex-col w-full md:w-auto gap-2 border-t md:border-t-0 md:border-l border-stone-100 pt-4 md:pt-0 md:pl-6 shrink-0"/g,
  'className="flex md:flex-col w-full md:w-32 lg:w-40 gap-2 border-t md:border-t-0 md:border-l border-stone-100 pt-4 md:pt-0 md:pl-6 shrink-0 mt-2 md:mt-0 justify-center"'
);
content = content.replace(
  /gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl/g,
  'gap-2 px-4 py-3 md:py-2 bg-stone-100 text-stone-700 rounded-xl'
);
content = content.replace(
  /px-4 py-2 rounded-xl text-sm font-bold uppercase/g,
  'px-4 py-3 md:py-2 rounded-xl text-sm font-bold uppercase'
);

fs.writeFileSync(file, content);
