const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const target1 = `        if (appliedSearch.coords) {
          if (!entry.hotel.coordinates) return false;
          const dist = getDistance(
            appliedSearch.coords.lat, appliedSearch.coords.lng,
            entry.hotel.coordinates.lat, entry.hotel.coordinates.lng
          );
          if (dist > appliedSearch.proximity) return false;
        } else if (appliedSearch.location) {`;
const replacement1 = `        if (appliedSearch.location && appliedSearch.location !== 'Near Me') {`;

content = content.replace(target1, replacement1);

// Remove the radius range input because proximity is no longer needed
const radiusRegex = /\{\/\* Radius, anchored under the field([\s\S]*?)<\/div>\s*<\/div>\s*\)\}/;
if (content.match(radiusRegex)) {
  content = content.replace(radiusRegex, '');
}

// Remove the "Search near me" button
const nearMeBtnRegex = /<button\s*type="button"\s*title="Search near me"([\s\S]*?)<\/button>/;
if (content.match(nearMeBtnRegex)) {
  content = content.replace(nearMeBtnRegex, '');
}

fs.writeFileSync('src/pages/Home.tsx', content);
