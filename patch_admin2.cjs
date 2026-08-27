const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const target = `  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = async (hotelId: string, newStatus: 'approved' | 'rejected' | 'pending') => {`;

const replacement = `  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleDeleteHotel = async (hotelId: string) => {
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

  const handleUpdateStatus = async (hotelId: string, newStatus: 'approved' | 'rejected' | 'pending') => {`;

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
