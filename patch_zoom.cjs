const fs = require('fs');
let code = fs.readFileSync('src/components/InteractiveMap.tsx', 'utf8');

code = code.replace(/map\.fitBounds\(bounds, \{ padding: \[50, 50\], maxZoom: 14 \}\);/g, "map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13 });");
code = code.replace(/map\.fitBounds\(bounds, \{ padding: \[50, 50\], maxZoom: 15 \}\);/g, "map.fitBounds(bounds, { padding: [120, 120], maxZoom: 13 });");
code = code.replace(/map\.fitBounds\(bounds, \{ padding: \[60, 60\], maxZoom: 15 \}\);/g, "map.fitBounds(bounds, { paddingTopLeft: [120, 160], paddingBottomRight: [120, 120], maxZoom: 13 });");
code = code.replace(/map\.flyTo\(\[lodge\.coordinates\.lat, lodge\.coordinates\.lng\], Math\.max\(map\.getZoom\(\), 15\)/g, "map.flyTo([lodge.coordinates.lat, lodge.coordinates.lng], 13");

fs.writeFileSync('src/components/InteractiveMap.tsx', code);
