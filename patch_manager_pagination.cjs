const fs = require('fs');
let content = fs.readFileSync('src/pages/ManagerDashboard.tsx', 'utf8');

if (!content.includes('import Pagination from')) {
  content = content.replace("import { motion } from 'motion/react';", "import { motion } from 'motion/react';\nimport Pagination from '../components/Pagination';");
}

const paginationState = `  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;`;

if (!content.includes('const [currentPage')) {
  content = content.replace("const [loading, setLoading] = useState(true);", "const [loading, setLoading] = useState(true);\n" + paginationState);
}

const mapRegex = /hotels\.map\(hotel => \(/;
const newMapStr = `
          hotels.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(hotel => (
`;

if (content.match(mapRegex)) {
  content = content.replace(mapRegex, newMapStr.trim());
}

const endOfGridRegex = /<\/div>\n\s*\{hotels\.length === 0 && !showAddForm && \(/;
if (content.match(endOfGridRegex)) {
  content = content.replace(endOfGridRegex, `</div>

        {hotels.length > 0 && !showAddForm && (
          <Pagination 
            currentPage={currentPage} 
            totalPages={Math.ceil(hotels.length / itemsPerPage)} 
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {hotels.length === 0 && !showAddForm && (`);
}

fs.writeFileSync('src/pages/ManagerDashboard.tsx', content);
