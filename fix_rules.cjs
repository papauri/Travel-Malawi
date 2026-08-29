const fs = require('fs');

const file = 'firestore.rules';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/`n/g, '\n');

fs.writeFileSync(file, content);
