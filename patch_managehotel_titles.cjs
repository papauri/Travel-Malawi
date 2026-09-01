const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  '<SectionCard title="Property Cover Image" description="This will be the large banner on your hotel\'s hero page, and the main thumbnail in search results.">',
  '<SectionCard title="Cover Photo" description="This will be the large banner on your hotel\'s hero page, and the main thumbnail in search results.">'
);

code = code.replace(
  '<SectionCard title="Property Gallery" description="These appear in the main photo grid/carousel at the top of your property page.">',
  '<SectionCard title="Gallery" description="These appear in the main photo grid/carousel at the top of your property page.">'
);

// RoomMediaEditor titles
code = code.replace(
  'label="Room Cover Photo"',
  'label="Cover Photo"'
);

code = code.replace(
  'label="Room Gallery"',
  'label="Gallery"'
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
