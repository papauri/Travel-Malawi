const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

if (!content.includes('import DatePicker from')) {
  content = content.replace("import { BookingLike, isRoomAvailable, unitsRemaining } from '../lib/availability';", "import { BookingLike, isRoomAvailable, unitsRemaining } from '../lib/availability';\nimport DatePicker from '../components/DatePicker';");
}

fs.writeFileSync('src/pages/HotelDetails.tsx', content);
