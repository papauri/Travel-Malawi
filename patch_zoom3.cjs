const fs = require('fs');
let code = fs.readFileSync('src/components/InteractiveMap.tsx', 'utf8');

code = code.replace(/map\.flyTo\(\[lodge\.coordinates\.lat, lodge\.coordinates\.lng\], 13/g, "map.flyTo([lodge.coordinates.lat, lodge.coordinates.lng], 12");
code = code.replace(/map\.fitBounds\(bounds, \{ paddingTopLeft: \[120, 160\], paddingBottomRight: \[120, 120\], maxZoom: 13 \}\);/g, "map.fitBounds(bounds, { paddingTopLeft: [120, 280], paddingBottomRight: [120, 120], maxZoom: 11 });");

fs.writeFileSync('src/components/InteractiveMap.tsx', code);
