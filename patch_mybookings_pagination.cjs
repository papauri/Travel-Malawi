const fs = require('fs');
let content = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');

if (!content.includes('import Pagination from')) {
  content = content.replace("import { motion } from 'motion/react';", "import { motion } from 'motion/react';\nimport Pagination from '../components/Pagination';");
}

const paginationState = `  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;`;

if (!content.includes('const [currentPage')) {
  content = content.replace("const [filter, setFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');", "const [filter, setFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');\n" + paginationState);
}

// Reset page on filter change
const filterRegex = /<button\s*onClick=\{\(\) => setFilter\('upcoming'\)\}/;
if (content.match(filterRegex)) {
  content = content.replace(/setFilter\('upcoming'\)/g, "(() => { setFilter('upcoming'); setCurrentPage(1); })()");
  content = content.replace(/setFilter\('past'\)/g, "(() => { setFilter('past'); setCurrentPage(1); })()");
  content = content.replace(/setFilter\('cancelled'\)/g, "(() => { setFilter('cancelled'); setCurrentPage(1); })()");
}

const mapRegex = /\{visible\.map\(booking => \(/;
const newMapStr = `
          {visible.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(booking => (
`;

if (content.match(mapRegex)) {
  content = content.replace(mapRegex, newMapStr.trim());
}

const endOfListRegex = /<\/div>\n\s*\{visible\.length === 0 && \(/;
if (content.match(endOfListRegex)) {
  content = content.replace(endOfListRegex, `</div>
          
          {visible.length > 0 && (
            <Pagination 
              currentPage={currentPage} 
              totalPages={Math.ceil(visible.length / itemsPerPage)} 
              onPageChange={(page) => {
                setCurrentPage(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {visible.length === 0 && (`);
}

fs.writeFileSync('src/pages/MyBookings.tsx', content);
