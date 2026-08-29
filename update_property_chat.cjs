const fs = require('fs');

const file = 'src/components/PropertyChat.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('import { useManagerPresence }')) {
  content = content.replace(
    "import { useAuth } from '../contexts/AuthContext';",
    "import { useAuth } from '../contexts/AuthContext';\nimport { useManagerPresence } from '../hooks/usePresence';"
  );
}

// 2. Add hook call
const targetHook = `  // Real-time live hotel status so online/offline updates instantly on guest screen
  const [liveHotel, setLiveHotel] = useState<Hotel>(hotel);`;
const replacementHook = `  // Real-time live hotel status so online/offline updates instantly on guest screen
  const [liveHotel, setLiveHotel] = useState<Hotel>(hotel);
  const managerPresence = useManagerPresence(hotel.managerId);
  const hostIsOnline = managerPresence?.status === 'online';`;

if (!content.includes('const hostIsOnline')) {
  if (content.includes(targetHook)) {
    content = content.replace(targetHook, replacementHook);
  } else if (content.includes(targetHook.replace(/\n/g, '\r\n'))) {
    content = content.replace(targetHook.replace(/\n/g, '\r\n'), replacementHook);
  }
}

// 3. Replace usages
content = content.replace(/liveHotel\.isOnline !== false/g, 'hostIsOnline');
content = content.replace(/liveHotel\.isOnline === false/g, '!hostIsOnline');

fs.writeFileSync(file, content);
