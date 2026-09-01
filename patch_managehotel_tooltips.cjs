const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

// Update Property Cover Photo
code = code.replace(
  `                  hint="This will be the large hero banner spanning the top of the property page, and the main thumbnail in search results. Choose an impressive exterior or best-view shot."`,
  `                  hint="Choose an impressive exterior or best-view shot."\n                  tooltip="Guest View: This image appears as the large hero banner spanning the top of your property page, and serves as the main thumbnail in search results."`
);

// Update Property Gallery
code = code.replace(
  `                  hint="These appear in the photo grid at the top of the property page. Include common areas and surroundings. Do NOT put specific room photos here."`,
  `                  hint="Include common areas and surroundings. Do NOT put specific room photos here."\n                  tooltip="Guest View: These appear in the photo grid/carousel at the top of your property page, just below the cover photo."`
);

// Update Room Cover Photo
code = code.replace(
  `            hint="This image appears as the primary cover photo for this room type in the booking list."`,
  `            hint="Make it a well-lit, wide shot of the bed and room."\n            tooltip="Guest View: This image appears as the primary thumbnail for this room type in the booking list on your property page."`
);

// Update Room Gallery
code = code.replace(
  `            hint="These photos appear in the image carousel when a guest clicks to view more details about this room type."`,
  `            hint="Add photos of the en-suite bathroom, the view from this room, and specific room amenities."\n            tooltip="Guest View: These photos form the image carousel when a guest clicks to view more details about this specific room type."`
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
