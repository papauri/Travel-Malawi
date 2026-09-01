const fs = require('fs');
let code = fs.readFileSync('src/lib/images.ts', 'utf8');

code = code.replace(/if\s*\(hotel\)\s*\{[\s\S]*?return\s*images\[1\]\s*\?\?\s*images\[0\];\s*\}/, '');

fs.writeFileSync('src/lib/images.ts', code);
