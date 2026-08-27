const fs = require('fs');
let content = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

const target = `const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');`;
const replacement = `const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [chatTarget, setChatTarget] = useState<Booking | null>(null);`;

content = content.replace(target, replacement);
fs.writeFileSync('src/pages/ManageHotel.tsx', content);
