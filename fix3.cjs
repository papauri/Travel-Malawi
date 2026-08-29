const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');
content = content.replace(/`n/g, '\n');
fs.writeFileSync('src/pages/HotelDetails.tsx', content);
