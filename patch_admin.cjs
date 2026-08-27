const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

if (!content.includes('import { collection, getDocs, doc, updateDoc, deleteDoc } from')) {
    content = content.replace("import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';", "import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';");
}

if (!content.includes('import { Shield, Building2, CheckCircle, XCircle, Clock, MapPin, Users, Edit2, Key, Trash2 } from')) {
    content = content.replace("import { Shield, Building2, CheckCircle, XCircle, Clock, MapPin, Users, Edit2, Key } from 'lucide-react';", "import { Shield, Building2, CheckCircle, XCircle, Clock, MapPin, Users, Edit2, Key, Trash2 } from 'lucide-react';");
}

const updateStatusFnRegex = /const handleUpdateStatus = async \(hotelId: string, status: 'approved' \| 'pending' \| 'rejected'\) => \{/;
if (content.match(updateStatusFnRegex)) {
  const deleteFn = `const handleDeleteHotel = async (hotelId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this hotel listing? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'hotels', hotelId));
      toast.success('Listing deleted');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete listing');
    }
  };
  
  const handleUpdateStatus = async (hotelId: string, status: 'approved' | 'pending' | 'rejected') => {`;
  content = content.replace(updateStatusFnRegex, deleteFn);
}

// Add the delete button
const editBtnRegex = /<Edit2 className="h-4 w-4" \/> Edit\s*<\/Link>/;
if (content.match(editBtnRegex)) {
  const deleteBtn = `<Edit2 className="h-4 w-4" /> Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteHotel(hotel.id!)}
                      className="bg-red-100 text-red-700 p-2 rounded-xl hover:bg-red-200 transition ml-2"
                      title="Delete Listing"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>`;
  content = content.replace(editBtnRegex, deleteBtn);
}

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
