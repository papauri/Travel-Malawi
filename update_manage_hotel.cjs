const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  '<SmartImage src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />',
  '<SmartImage src={getRoomImage(room, hotel)} alt={room.name} className="w-full h-full object-cover" />'
);

code = code.replace(
  '<SmartImage src={editHotelData.imageUrl} alt="Main" className="w-full h-full object-cover" />',
  '<SmartImage src={getHotelImage(editHotelData)} alt="Main" className="w-full h-full object-cover" />'
);

// We should be careful replacing the rest since there might be multiple occurrences.

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
