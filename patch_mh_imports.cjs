const fs = require('fs');
let content = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

const target = `import Modal from '../components/Modal';`;
const replacement = `import Modal from '../components/Modal';
import BookingChat from '../components/BookingChat';
import { MessageSquare } from 'lucide-react';`;

if (!content.includes('BookingChat')) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/ManageHotel.tsx', content);
}
