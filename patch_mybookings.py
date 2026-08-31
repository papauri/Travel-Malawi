import re

with open('src/pages/MyBookings.tsx', 'r') as f:
    content = f.read()

# Add Broadcast to types import
if "import { Booking, RoomType, Hotel" in content:
    content = content.replace(
        "import { Booking, RoomType, Hotel } from '../types';",
        "import { Booking, RoomType, Hotel, Broadcast } from '../types';"
    )
elif "import { Booking, Hotel" in content:
    content = content.replace(
        "import { Booking, Hotel, RoomType } from '../types';",
        "import { Booking, Hotel, RoomType, Broadcast } from '../types';"
    )
else:
    # Fallback
    content = content.replace("import { Booking", "import { Broadcast, Booking")

# Add Megaphone to lucide-react imports
if "Megaphone" not in content:
    content = content.replace("from 'lucide-react';", ", Megaphone } from 'lucide-react';")

# Add broadcasts state and effect
state_and_effect = """
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  const upcomingHotelIds = useMemo(() => {
    return Array.from(new Set(grouped.upcoming.map(b => b.hotelId))).filter(Boolean) as string[];
  }, [grouped.upcoming]);

  useEffect(() => {
    if (upcomingHotelIds.length === 0) {
      setBroadcasts([]);
      return;
    }
    const batch = upcomingHotelIds.slice(0, 30);
    const q = query(
      collection(db, 'broadcasts'),
      where('hotelId', 'in', batch),
      where('isActive', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast));
      docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBroadcasts(docs);
    }, (err) => {
      console.warn('Failed to listen to broadcasts:', err);
    });
    return () => unsub();
  }, [upcomingHotelIds]);

"""

if "const [broadcasts, setBroadcasts] = useState" not in content:
    content = content.replace("const handleCancel = async", state_and_effect + "  const handleCancel = async")

# Add UI
ui = """
        <div className="flex gap-2 mb-10 border-b border-stone-200">
"""
new_ui = """
        {broadcasts.length > 0 && filter === 'upcoming' && (
          <div className="mb-10 space-y-4">
            <h2 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
              <Megaphone className="w-5 h-5" /> Live Updates
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {broadcasts.map(broadcast => {
                const hotel = grouped.upcoming.find(b => b.hotelId === broadcast.hotelId)?.hotel;
                return (
                  <div key={broadcast.id} className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-full shrink-0 ${
                      broadcast.type === 'alert' ? 'bg-red-100 text-red-600' :
                      broadcast.type === 'event' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                          {hotel?.name || 'Property Update'}
                        </span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{broadcast.type}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs text-stone-500">{new Date(broadcast.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-stone-900 font-medium">{broadcast.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-10 border-b border-stone-200">
"""

if "Live Updates" not in content:
    content = content.replace(ui, new_ui)

with open('src/pages/MyBookings.tsx', 'w') as f:
    f.write(content)
