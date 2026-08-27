const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const mapRegex = /\{filteredHotels\.length > 0 \? filteredHotels\.map\(\(entry, index\) => \(/;

const newMapStr = `
            {filteredHotels.length > 0 ? filteredHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((entry, index) => (
`;

if (content.match(mapRegex)) {
  content = content.replace(mapRegex, newMapStr.trim());
}

fs.writeFileSync('src/pages/Home.tsx', content);
