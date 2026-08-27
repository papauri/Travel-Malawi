const fs = require('fs');
let content = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');
content = content.replace("isOpen={true}", "open={true}");
fs.writeFileSync('src/pages/MyBookings.tsx', content);
