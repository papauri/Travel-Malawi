const fs = require('fs');
let content = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

if (!content.includes('import Pagination from')) {
  content = content.replace("import { motion } from 'motion/react';", "import { motion } from 'motion/react';\nimport Pagination from '../components/Pagination';");
}

const paginationState = `  const [currentBookingPage, setCurrentBookingPage] = useState(1);
  const bookingsPerPage = 5;`;

if (!content.includes('const [currentBookingPage')) {
  content = content.replace("const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');", "const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');\n" + paginationState);
}

// Reset page on filter change
if (content.includes('onClick={() => setBookingFilter(tab.key)}')) {
  content = content.replace('onClick={() => setBookingFilter(tab.key)}', "onClick={() => {\n                  setBookingFilter(tab.key);\n                  setCurrentBookingPage(1);\n                }}");
}

const mapRegex = /\{visibleBookings\.map\(booking => \(/;
const newMapStr = `
              {visibleBookings.slice((currentBookingPage - 1) * bookingsPerPage, currentBookingPage * bookingsPerPage).map(booking => (
`;

if (content.match(mapRegex)) {
  content = content.replace(mapRegex, newMapStr.trim());
}

const endOfListRegex = /<\/ul>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*\)\}/;
if (content.match(endOfListRegex)) {
  content = content.replace(endOfListRegex, `</ul>
            
            {visibleBookings.length > 0 && (
              <Pagination 
                currentPage={currentBookingPage} 
                totalPages={Math.ceil(visibleBookings.length / bookingsPerPage)} 
                onPageChange={(page) => {
                  setCurrentBookingPage(page);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )}`);
}

fs.writeFileSync('src/pages/ManageHotel.tsx', content);
