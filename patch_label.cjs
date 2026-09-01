const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');
code = code.replace('label="Gallery Images"', 'label="Gallery"');
fs.writeFileSync('src/pages/ManageHotel.tsx', code);
