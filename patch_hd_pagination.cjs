const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

if (!content.includes('import Pagination from')) {
  content = content.replace("import { motion } from 'motion/react';", "import { motion } from 'motion/react';\nimport Pagination from '../components/Pagination';");
}

const paginationState = `  const [currentReviewPage, setCurrentReviewPage] = useState(1);
  const reviewsPerPage = 4;`;

if (!content.includes('const [currentReviewPage')) {
  content = content.replace("const [showConfirmModal, setShowConfirmModal] = useState(false);", "const [showConfirmModal, setShowConfirmModal] = useState(false);\n" + paginationState);
}

const mapRegex = /\{allReviews\.map\(review => \(/;
const newMapStr = `
                {allReviews.slice((currentReviewPage - 1) * reviewsPerPage, currentReviewPage * reviewsPerPage).map(review => (
`;

if (content.match(mapRegex)) {
  content = content.replace(mapRegex, newMapStr.trim());
}

const endOfListRegex = /<\/div>\n\s*<\/section>\n\s*\{\/\* Amenities \*\/\}/;
if (content.match(endOfListRegex)) {
  content = content.replace(endOfListRegex, `</div>
              
              {allReviews.length > 0 && (
                <Pagination 
                  currentPage={currentReviewPage} 
                  totalPages={Math.ceil(allReviews.length / reviewsPerPage)} 
                  onPageChange={setCurrentReviewPage}
                />
              )}
            </section>

            {/* Amenities */}`);
}

fs.writeFileSync('src/pages/HotelDetails.tsx', content);
