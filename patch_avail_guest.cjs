const fs = require('fs');
let code = fs.readFileSync('src/components/AvailabilityCalendar.tsx', 'utf8');

console.log("Original getAvailability:");
console.log(code.match(/function getAvailability.*?}/s)[0]);

