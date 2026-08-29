const fs = require('fs');

const file = 'src/pages/HotelDetails.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace presence indicator logic
content = content.replace(
  /hotel\.isOnline !== false \? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-600 border-stone-200'/g,
  `managerPresence?.status === 'online' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : managerPresence?.status === 'away' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-stone-100 text-stone-600 border-stone-200'`
);

content = content.replace(
  /hotel\.isOnline !== false \? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'/g,
  `managerPresence?.status === 'online' ? 'bg-emerald-500 animate-pulse' : managerPresence?.status === 'away' ? 'bg-amber-400' : 'bg-stone-400'`
);

content = content.replace(
  /hotel\.isOnline !== false \? 'Host Online' : 'Host Away'/g,
  `managerPresence?.status === 'online' ? 'Host Online' : managerPresence?.status === 'away' ? 'Host Away' : 'Host Offline'`
);

content = content.replace(
  /hotel\.isOnline !== false \? 'Live Host Chat' : 'Leave a Message'/g,
  `managerPresence?.status === 'online' ? 'Live Host Chat' : 'Leave a Message'`
);

content = content.replace(
  /hotel\.isOnline !== false \? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'/g,
  `managerPresence?.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'`
);

content = content.replace(
  /hotel\.isOnline !== false \? 'Online now' : 'Leave a message'/g,
  `managerPresence?.status === 'online' ? 'Online now' : 'Leave a message'`
);

// Only render the PhoneCall button if online
const phoneCallStr = `{telLink(hotel.contactPhone) && (
                      <a
                        href={telLink(hotel.contactPhone)!}
                        className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-800 border border-stone-200 transition hover:bg-stone-200 shadow-2xs"
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> {hotel.contactPhone}
                      </a>
                    )}`;
const phoneCallReplace = `{telLink(hotel.contactPhone) && managerPresence?.status === 'online' && (
                      <a
                        href={telLink(hotel.contactPhone)!}
                        className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-800 border border-stone-200 transition hover:bg-stone-200 shadow-2xs"
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> {hotel.contactPhone}
                      </a>
                    )}`;
content = content.replace(phoneCallStr, phoneCallReplace);

// Also maybe hide whatsapp if offline? User said "call the stay if they are online only". Usually WhatsApp is async, so leaving WhatsApp is fine. I'll leave WhatsApp.

fs.writeFileSync(file, content);
