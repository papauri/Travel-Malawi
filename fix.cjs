const fs = require('fs');

const file = 'src/pages/HotelDetails.tsx';
let content = fs.readFileSync(file, 'utf8');

// fix the literal \n strings left by powershell
content = content.replace(/`n/g, '\n');

fs.writeFileSync(file, content);
