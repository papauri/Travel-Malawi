const fs = require('fs');
let content = fs.readFileSync('src/components/Navbar.tsx', 'utf8');
content = content.replace(/`n/g, '\n');
fs.writeFileSync('src/components/Navbar.tsx', content);
