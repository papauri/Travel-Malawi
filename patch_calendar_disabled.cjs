const fs = require('fs');
let code = fs.readFileSync('src/components/AvailabilityCalendar.tsx', 'utf8');

const oldDisabled = `              // sold-out ones, so a date can always be taken off sale.
              const disabled = avail === 'past' || (!isManagerMode && (avail === 'full' || avail === 'blocked'));
              
              const isSelected = day.dateStr === checkIn || day.dateStr === checkOut;`;

const newDisabled = `              // sold-out ones, so a date can always be taken off sale.
              const isSelectingCheckout = !isManagerMode && checkIn && !checkOut && day.dateStr > checkIn;
              
              // We need to check if the range from checkIn to day.dateStr is valid before enabling it as a checkout date
              let isValidCheckout = false;
              if (isSelectingCheckout) {
                isValidCheckout = true;
                let cursor = checkIn;
                while (cursor < day.dateStr) {
                  const b = bookedMap[cursor] || 0;
                  const isBlocked = blockedSet.has(cursor);
                  if (totalRooms === 0 || isBlocked || b >= totalRooms) {
                    isValidCheckout = false;
                    break;
                  }
                  cursor = addDays(cursor, 1);
                }
              }

              const disabled = avail === 'past' || (!isManagerMode && !isValidCheckout && (avail === 'full' || avail === 'blocked'));
              
              const isSelected = day.dateStr === checkIn || day.dateStr === checkOut;`;

code = code.replace(oldDisabled, newDisabled);
fs.writeFileSync('src/components/AvailabilityCalendar.tsx', code);
console.log("Patched disabled logic.");
