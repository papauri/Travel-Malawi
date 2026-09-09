const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  `{/* Manager WhatsApp controls (ONLY visible when WhatsApp is enabled in Admin Portal) */}
                          {whatsappEnabled && (`,
  `{/* Manager WhatsApp controls */}
                          {`
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
