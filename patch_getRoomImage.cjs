const fs = require('fs');
let code = fs.readFileSync('src/lib/images.ts', 'utf8');

code = code.replace(
`  if (hotel) {
    const images = getHotelImages(hotel);
    // Prefer a gallery shot over the hero image so a room card does not simply
    // repeat the picture shown at the top of the page.
    return images[1] ?? images[0];
  }

  return PLACEHOLDER_IMAGE;`,
`  return PLACEHOLDER_IMAGE;`
);

fs.writeFileSync('src/lib/images.ts', code);
