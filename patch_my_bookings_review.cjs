const fs = require('fs');
let code = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');
code = code.replace(
  `const canReview = isStayComplete(booking) && booking.id && !reviewedBookingIds.has(booking.id);`,
  `const canReview = activeMainTab === 'guest' && isStayComplete(booking) && booking.id && !reviewedBookingIds.has(booking.id);`
);
fs.writeFileSync('src/pages/MyBookings.tsx', code);
