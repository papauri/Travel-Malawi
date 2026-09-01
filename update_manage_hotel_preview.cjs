const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  '<SmartImage src={getRoomImage(room, hotel)} alt={room.name} className="w-full h-full object-cover" />',
  '<SmartImage src={getRoomImage(room, editHotelData)} alt={room.name} className="w-full h-full object-cover" />'
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
