const fs = require('fs');
function addImport(file) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes("import { useBodyScrollLock }")) {
    // Add import after first line
    const lines = code.split('\n');
    lines.splice(1, 0, "import { useBodyScrollLock } from '../hooks/useBodyScrollLock';");
    fs.writeFileSync(file, lines.join('\n'));
    console.log("Fixed " + file);
  }
}
addImport('src/components/CompareWidget.tsx');
addImport('src/components/MobileNav.tsx');
addImport('src/pages/ManageHotel.tsx');
