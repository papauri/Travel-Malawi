const fs = require('fs');
let code = fs.readFileSync('src/components/MobileNav.tsx', 'utf8');
code = code.replace(
  `{user && isTraveller(user) && (`,
  `{user && (`
);
fs.writeFileSync('src/components/MobileNav.tsx', code);
