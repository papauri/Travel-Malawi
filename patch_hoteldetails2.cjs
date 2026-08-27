const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

content = content.replace("pb-safe-4", "pb-6");

fs.writeFileSync('src/pages/HotelDetails.tsx', content);
