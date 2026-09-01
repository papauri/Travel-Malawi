const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');
code = code.replace(
  '<h2 className="text-2xl font-serif font-bold text-stone-900">Room-Specific Galleries</h2>',
  '<h2 className="text-2xl font-serif font-bold text-stone-900">Room-Specific Photos</h2>'
);
fs.writeFileSync('src/pages/ManageHotel.tsx', code);
