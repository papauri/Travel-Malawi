const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

const target = "const [activeTab, setActiveTab] = useState<'stay' | 'menu'>('stay');";
const replacement = target + "\n  const [currentReviewPage, setCurrentReviewPage] = useState(1);\n  const reviewsPerPage = 4;";

if (content.includes(target) && !content.includes('currentReviewPage')) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/pages/HotelDetails.tsx', content);
}
