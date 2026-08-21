const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
code = code.replace(/\r\n/g, '\n');

// 1. Remove Trust Strip section
const trustStart = code.indexOf('{/* Trust Strip */}');
if (trustStart > -1) {
  // Find the closing </motion.div> for this section
  let depth = 0;
  let i = code.indexOf('<motion.div', trustStart);
  let end = -1;
  for (let j = i; j < code.length; j++) {
    if (code.substring(j, j + 11) === '<motion.div') depth++;
    if (code.substring(j, j + 13) === '</motion.div>') {
      depth--;
      if (depth === 0) {
        end = j + 13;
        break;
      }
    }
  }
  if (end > -1) {
    // Remove from the comment to the end of the motion.div
    code = code.substring(0, trustStart) + code.substring(end);
    console.log('1. Trust strip removed');
  }
} else {
  console.log('1. Trust strip already removed or not found');
}

// 2. Filter hotels for approved status on the homepage
// Find where hotels are fetched from Firestore and displayed
// Look for the hotel cards rendering
const filterSearch = 'hotels.filter(h =>';
const hotelFilterIdx = code.indexOf(filterSearch);
if (hotelFilterIdx === -1) {
  // Look for how hotels are mapped/rendered
  const mapIdx = code.indexOf('.map((hotel');
  if (mapIdx > -1) {
    // Find which variable is being mapped
    const lineStart = code.lastIndexOf('\n', mapIdx);
    const line = code.substring(lineStart, mapIdx + 20);
    console.log('2. Hotels map context: ' + line.trim());
  }
}

// Find where filteredHotels is used - check if there's a filter already
const filteredIdx = code.indexOf('filteredHotels');
if (filteredIdx > -1) {
  console.log('2. filteredHotels found in code');
  // Add approved status filter to the existing filter logic
  const filterDef = code.indexOf('const filteredHotels');
  if (filterDef > -1) {
    const filterEnd = code.indexOf(';', filterDef);
    const existing = code.substring(filterDef, filterEnd + 1);
    console.log('   Existing filter: ' + existing.substring(0, 100) + '...');
    
    // Add .filter for approved status after the existing filter chain
    if (!existing.includes('status')) {
      // Insert .filter(h => !h.status || h.status === 'approved') 
      const newFilter = existing.replace(
        /\.filter\(/,
        '.filter(h => !h.status || h.status === \'approved\').filter('
      );
      code = code.replace(existing, newFilter);
      console.log('2. Added approved status filter');
    }
  }
} else {
  console.log('2. No filteredHotels found, checking for hotels rendering...');
}

fs.writeFileSync('src/pages/Home.tsx', code, 'utf-8');
console.log('\nHome.tsx patches applied!');
