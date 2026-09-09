const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace(/after:bottom-0/g, "after:-bottom-1");

fs.writeFileSync('src/components/Navbar.tsx', code);
