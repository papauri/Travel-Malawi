const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  "import { getHotelImages, getHotelImage, getRoomImage } from '../lib/images';",
  "import { getHotelImages, getHotelImage, getRoomImage, localImagesForName } from '../lib/images';"
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
