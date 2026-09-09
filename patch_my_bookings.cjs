const fs = require('fs');
let code = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');

code = code.replace(
  `  useEffect(() => {
    if (authLoading) return;
    if (!user || !isTraveller(user)) {
      navigate('/');
      return;
    }
    const uid = user.uid;`,
  `  const [activeMainTab, setActiveMainTab] = useState<'guest' | 'host'>('guest');
  const [managerHotels, setManagerHotels] = useState<Hotel[]>([]);
  const [hostBookings, setHostBookings] = useState<EnrichedBooking[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/');
      return;
    }
    const uid = user.uid;`
);

code = code.replace(
  `    async function fetchBookings() {`,
  `    async function fetchHostData() {
      try {
        const hDocs = await getDocs(query(collection(db, 'hotels'), where('managerId', '==', uid)));
        const hotels = hDocs.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        setManagerHotels(hotels);
        if (hotels.length > 0) {
          setActiveMainTab('host');
          const hIds = hotels.map(h => h.id);
          // Firestore 'in' query supports max 10, so chunk it if needed, or query all and filter
          // For simplicity we will query all bookings where hotelId in hIds up to 10
          if (hIds.length > 0) {
            const batches = [];
            for(let i=0; i<hIds.length; i+=10) {
               batches.push(hIds.slice(i, i+10));
            }
            let allHostBookings: EnrichedBooking[] = [];
            for (const batch of batches) {
              const bDocs = await getDocs(query(collection(db, 'bookings'), where('hotelId', 'in', batch)));
              const batchBookings = bDocs.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
              allHostBookings = [...allHostBookings, ...batchBookings];
            }
            
            const roomIds = [...new Set(allHostBookings.map(b => b.roomTypeId).filter(Boolean))];
            const roomSnaps = await Promise.all(roomIds.map(rid => getDoc(doc(db, 'room_types', rid))));
            const roomsById = new Map(roomSnaps.filter(s => s.exists()).map(s => [s.id, { id: s.id, ...s.data() } as RoomType]));

            const enrichedHost: EnrichedBooking[] = allHostBookings.map(b => ({
              ...b,
              hotel: hotels.find(h => h.id === b.hotelId),
              room: roomsById.get(b.roomTypeId),
            }));
            enrichedHost.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setHostBookings(enrichedHost);
          }
        }
      } catch (err) {
        console.error("Error fetching host data:", err);
      }
    }

    async function fetchBookings() {`
);

code = code.replace(
  `    fetchBookings();`,
  `    fetchBookings();
    fetchHostData();`
);

fs.writeFileSync('src/pages/MyBookings.tsx', code);
