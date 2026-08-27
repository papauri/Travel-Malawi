const fs = require('fs');
let content = fs.readFileSync('src/components/MobileNav.tsx', 'utf8');

content = content.replace(
  'const { user } = useAuth();',
  `const { user } = useAuth();
  
  // Hide bottom nav on hotel details pages on mobile to make room for the sticky "Book" bar
  if (pathname.includes('/hotel/')) return null;`
);

fs.writeFileSync('src/components/MobileNav.tsx', content);
