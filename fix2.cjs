const fs = require('fs');
let content = fs.readFileSync('src/hooks/usePresence.ts', 'utf8');
content = content.replace(/`n/g, '\n');
fs.writeFileSync('src/hooks/usePresence.ts', content);
