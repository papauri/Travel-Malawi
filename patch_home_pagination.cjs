const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

if (!content.includes('import Pagination from')) {
  content = content.replace("import { motion } from 'motion/react';", "import { motion } from 'motion/react';\nimport Pagination from '../components/Pagination';");
}

const paginationState = `  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;`;

if (!content.includes('const [currentPage')) {
  content = content.replace("const [sortKey, setSortKey] = useState<SortKey>('recommended');", "const [sortKey, setSortKey] = useState<SortKey>('recommended');\n" + paginationState);
}

// Reset page on search or filter changes
const handleSearchResetPage = `setCurrentPage(1);`;
if (!content.includes('setCurrentPage(1)') && content.includes('setAppliedSearch(next)')) {
    content = content.replace('setAppliedSearch(next);', 'setAppliedSearch(next);\n    setCurrentPage(1);');
}
if (!content.includes('setCurrentPage(1)') && content.includes('setAppliedSearch(NO_SEARCH)')) {
    content = content.replace('setAppliedSearch(NO_SEARCH);', 'setAppliedSearch(NO_SEARCH);\n    setCurrentPage(1);');
}

// Check where filteredHotels.map is
const mapRegex = /\{filteredHotels\.map\(\(entry\) => \(/;

const newMapStr = `
            {filteredHotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((entry) => (
`;

if (content.match(mapRegex)) {
  content = content.replace(mapRegex, newMapStr.trim());
}

// Find where to put the pagination component
const endOfGridRegex = /<\/div>\s*\{\/\* Empty State \*\/\}/;
if (content.match(endOfGridRegex)) {
  content = content.replace(endOfGridRegex, `</div>\n\n            {filteredHotels.length > 0 && (\n              <Pagination \n                currentPage={currentPage} \n                totalPages={Math.ceil(filteredHotels.length / itemsPerPage)} \n                onPageChange={(page) => {\n                  setCurrentPage(page);\n                  document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth' });\n                }}\n              />\n            )}\n\n            {/* Empty State */}`);
}

fs.writeFileSync('src/pages/Home.tsx', content);
