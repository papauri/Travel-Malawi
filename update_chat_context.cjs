const fs = require('fs');

const file = 'src/contexts/ChatModalContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import useManagerPresence
if (!content.includes("import { useManagerPresence }")) {
  content = content.replace(
    "import { useAuth } from './AuthContext';",
    "import { useAuth } from './AuthContext';\nimport { useManagerPresence } from '../hooks/usePresence';"
  );
}

// 2. Remove liveHotelStatus logic and replace with useManagerPresence
content = content.replace(
  `  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [liveHotelStatus, setLiveHotelStatus] = useState<{ isOnline?: boolean; name?: string }>({});`,
  `  const [isMinimized, setIsMinimized] = useState<boolean>(false);`
);

const useEffectTarget = `  // If the active chat is an inquiry, listen to the hotel's live online status for the minimized pill
  useEffect(() => {
    if (!activeChat || activeChat.type !== 'inquiry' || !activeChat.hotel?.id) {
      setLiveHotelStatus({});
      return;
    }

    const unsub = onSnapshot(doc(db, 'hotels', activeChat.hotel.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLiveHotelStatus({
          isOnline: data.isOnline !== false,
          name: data.name,
        });
      }
    }, (err) => {
      console.warn('Could not listen to hotel status in ChatModalContext:', err);
    });

    return () => unsub();
  }, [activeChat]);`;

content = content.replace(useEffectTarget, '');
content = content.replace(useEffectTarget.replace(/\n/g, '\r\n'), '');

const currentTarget = `  const currentHotelName = liveHotelStatus.name || (activeChat?.type === 'inquiry' ? activeChat.hotel.name : 'Property');
  const isOnline = liveHotelStatus.isOnline !== undefined 
    ? liveHotelStatus.isOnline 
    : (activeChat?.type === 'inquiry' ? activeChat.hotel.isOnline !== false : true);`;

const currentReplacement = `  const currentHotelName = activeChat?.type === 'inquiry' ? activeChat.hotel.name : 'Property';
  const activeManagerId = activeChat?.type === 'inquiry' ? activeChat.hotel.managerId : 
                          activeChat?.type === 'booking' ? activeChat.booking.managerId : undefined;
  const managerPresence = useManagerPresence(activeManagerId);
  const isOnline = managerPresence?.status === 'online';`;

content = content.replace(currentTarget, currentReplacement);
content = content.replace(currentTarget.replace(/\n/g, '\r\n'), currentReplacement);

fs.writeFileSync(file, content);
