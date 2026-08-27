const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

if (!content.includes('import { isRoomAvailable, unitsRemaining }')) {
  content = content.replace("import { isRoomAvailable } from '../lib/availability';", "import { isRoomAvailable, unitsRemaining } from '../lib/availability';");
}

const datePickerTarget = `                  <DatePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onSelect={(inDate, outDate) => {`;
const datePickerReplacement = `                  <DatePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    isDateBlocked={(dateStr) => {
                      if (!selectedRoom) return false;
                      const nextDay = new Date(dateStr);
                      nextDay.setDate(nextDay.getDate() + 1);
                      const nextDayStr = nextDay.toISOString().split('T')[0];
                      return unitsRemaining(selectedRoom, bookings, dateStr, nextDayStr) === 0;
                    }}
                    onSelect={(inDate, outDate) => {`;

content = content.replace(datePickerTarget, datePickerReplacement);

// Fix the blockedDates={[]} leftover
content = content.replace("blockedDates={[]}", "");

fs.writeFileSync('src/pages/HotelDetails.tsx', content);
