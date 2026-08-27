const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import MobileNav')) {
  content = content.replace("import Navbar from './components/Navbar';", "import Navbar from './components/Navbar';\nimport MobileNav from './components/MobileNav';");
}

if (!content.includes('<MobileNav />')) {
  content = content.replace('<main className="flex-1">', '<main className="flex-1 pb-16 md:pb-0">');
  content = content.replace('<Footer />', '<Footer />\n          <MobileNav />');
}

fs.writeFileSync('src/App.tsx', content);
