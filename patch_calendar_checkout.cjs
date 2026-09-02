const fs = require('fs');
let code = fs.readFileSync('src/components/AvailabilityCalendar.tsx', 'utf8');

const oldHandle = `    // In manager mode, allow selecting booked dates
    if (!isManagerMode && (avail === 'full' || avail === 'blocked')) return;

    if (onRangeSelect) {
      if (!checkIn || (checkIn && checkOut)) {`;

const newHandle = `    // In manager mode, allow selecting booked dates
    // For guests, they can't start a booking on a blocked date, 
    // but they CAN end a booking on a blocked date if the range before it is valid.
    const isSelectingCheckout = !isManagerMode && checkIn && !checkOut && day.dateStr > checkIn;
    
    if (!isManagerMode && !isSelectingCheckout && (avail === 'full' || avail === 'blocked')) {
      return;
    }

    if (onRangeSelect) {
      if (!checkIn || (checkIn && checkOut)) {`;

code = code.replace(oldHandle, newHandle);
fs.writeFileSync('src/components/AvailabilityCalendar.tsx', code);
console.log("Patched checkout logic.");
