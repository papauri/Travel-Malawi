const fs = require('fs');

const file = 'src/pages/ManageHotel.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `            {!editingRoomId && rooms.map(room => (
              <div key={room.id} className={\`bg-white border p-6 rounded-3xl flex flex-col md:flex-row gap-6 items-center shadow-sm transition \${room.quantity === 0 ? 'border-red-200 bg-red-50/30' : 'border-stone-200'}\`}>
                <div className="w-full md:w-48 h-32 bg-stone-100 rounded-2xl overflow-hidden shrink-0">
                  <SmartImage src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xl font-serif font-bold text-stone-900 truncate pr-4">{room.name}</h4>
                    <div className="text-right">
                      {roomCurrencies(room).map((code, i) => (
                        <div
                          key={code}
                          className={i === 0
                            ? 'text-xl font-serif font-bold text-stone-900 whitespace-nowrap'
                            : 'text-sm text-stone-500 font-medium whitespace-nowrap'}
                        >
                          {formatMoney(roomPrice(room, code) ?? 0, code)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-stone-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1.5 text-stone-600"><Users className="h-4 w-4" /> {room.maxGuests} Guests</span>
                    <span className={\`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider \${room.quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}\`}>
                      {room.quantity > 0 ? \`\${room.quantity} Available\` : 'Blocked'}
                    </span>
                  
                    {room.packages && room.packages.length > 0 && room.packages.map(pkg => (
                      <span key={pkg.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{pkg.name}</span>
                    ))}
                  </div>
                </div>
                <div className="flex md:flex-col w-full md:w-auto gap-2 border-t md:border-t-0 md:border-l border-stone-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                  <button 
                    onClick={() => startEditRoom(room)}
                    className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition text-sm font-semibold"
                  >
                    <Edit2 className="h-4 w-4" /> Edit
                  </button>
                  <button 
                    onClick={() => toggleRoomAvailability(room)}
                    className={\`flex-1 md:w-full flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition \${room.quantity === 0 ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'}\`}
                  >
                    {room.quantity === 0 ? 'Unblock' : 'Block'}
                  </button>
                </div>
              </div>
            ))}`;

const replacement = `            {!editingRoomId && rooms.map(room => (
              <div key={room.id} className={\`bg-white border p-4 sm:p-6 rounded-3xl flex flex-col md:flex-row gap-4 sm:gap-6 items-stretch md:items-center shadow-sm transition \${room.quantity === 0 ? 'border-red-200 bg-red-50/30' : 'border-stone-200'}\`}>
                <div className="w-full md:w-48 h-48 md:h-36 bg-stone-100 rounded-2xl overflow-hidden shrink-0">
                  <SmartImage src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 w-full flex flex-col justify-center">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-2">
                    <h4 className="text-xl font-serif font-bold text-stone-900 line-clamp-2 sm:line-clamp-1 pr-0 sm:pr-4">{room.name}</h4>
                    <div className="flex sm:flex-col gap-3 sm:gap-0 text-left sm:text-right items-baseline sm:items-end">
                      {roomCurrencies(room).map((code, i) => (
                        <div
                          key={code}
                          className={i === 0
                            ? 'text-xl font-serif font-bold text-stone-900 whitespace-nowrap'
                            : 'text-sm text-stone-500 font-medium whitespace-nowrap'}
                        >
                          {formatMoney(roomPrice(room, code) ?? 0, code)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-stone-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1.5 text-stone-600"><Users className="h-4 w-4" /> {room.maxGuests} Guests</span>
                    <span className={\`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider \${room.quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}\`}>
                      {room.quantity > 0 ? \`\${room.quantity} Available\` : 'Blocked'}
                    </span>
                  
                    {room.packages && room.packages.length > 0 && room.packages.map(pkg => (
                      <span key={pkg.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] sm:text-xs">{pkg.name}</span>
                    ))}
                  </div>
                </div>
                <div className="flex md:flex-col w-full md:w-32 lg:w-40 gap-2 border-t md:border-t-0 md:border-l border-stone-100 pt-4 md:pt-0 md:pl-6 shrink-0 mt-2 md:mt-0 justify-center">
                  <button 
                    onClick={() => startEditRoom(room)}
                    className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition text-sm font-semibold"
                  >
                    <Edit2 className="h-4 w-4" /> Edit
                  </button>
                  <button 
                    onClick={() => toggleRoomAvailability(room)}
                    className={\`flex-1 md:w-full flex items-center justify-center px-4 py-3 md:py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition \${room.quantity === 0 ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'}\`}
                  >
                    {room.quantity === 0 ? 'Unblock' : 'Block'}
                  </button>
                </div>
              </div>
            ))}`;

let targetCRLF = target.replace(/\n/g, '\r\n');
if (content.includes(target)) {
  content = content.replace(target, replacement);
} else if (content.includes(targetCRLF)) {
  content = content.replace(targetCRLF, replacement);
} else {
  // If exact match fails, do regex match based on boundaries
  const regex = /\{!editingRoomId && rooms\.map\(room => \([\s\S]*?\}\)\)\}/;
  content = content.replace(regex, replacement);
}

fs.writeFileSync(file, content);
