const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

if (!content.includes('import Pagination from')) {
  content = content.replace("import { useNavigate, Link } from 'react-router-dom';", "import { useNavigate, Link } from 'react-router-dom';\nimport Pagination from '../components/Pagination';");
}

const paginationState = `  const [currentHotelPage, setCurrentHotelPage] = useState(1);
  const [currentManagerPage, setCurrentManagerPage] = useState(1);
  const itemsPerPage = 5;`;

if (!content.includes('const [currentHotelPage')) {
  content = content.replace("const [loading, setLoading] = useState(true);", "const [loading, setLoading] = useState(true);\n" + paginationState);
}

const hotelMapRegex = /\{hotels\.map\(hotel => \(/;
const newHotelMapStr = `
            {hotels.slice((currentHotelPage - 1) * itemsPerPage, currentHotelPage * itemsPerPage).map(hotel => (
`;

if (content.match(hotelMapRegex)) {
  content = content.replace(hotelMapRegex, newHotelMapStr.trim());
}

const managerMapRegex = /\{managers\.map\(\(manager, idx\) => \(/;
const newManagerMapStr = `
              {managers.slice((currentManagerPage - 1) * itemsPerPage, currentManagerPage * itemsPerPage).map((manager, idx) => (
`;

if (content.match(managerMapRegex)) {
  content = content.replace(managerMapRegex, newManagerMapStr.trim());
}

// Hotel Pagination
const hotelEndRegex = /<\/div>\n\s*\{hotels\.length === 0 && \(/;
if (content.match(hotelEndRegex)) {
  content = content.replace(hotelEndRegex, `</div>
            
            {hotels.length > 0 && (
              <Pagination 
                currentPage={currentHotelPage} 
                totalPages={Math.ceil(hotels.length / itemsPerPage)} 
                onPageChange={setCurrentHotelPage}
              />
            )}
            
            {hotels.length === 0 && (`);
}

// Manager Pagination
const managerEndRegex = /<\/div>\n\s*\{managers\.length === 0 && \(/;
if (content.match(managerEndRegex)) {
  content = content.replace(managerEndRegex, `</div>
            
            {managers.length > 0 && (
              <Pagination 
                currentPage={currentManagerPage} 
                totalPages={Math.ceil(managers.length / itemsPerPage)} 
                onPageChange={setCurrentManagerPage}
              />
            )}
            
            {managers.length === 0 && (`);
}

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
