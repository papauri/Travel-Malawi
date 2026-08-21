const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf-8');

// Normalize line endings
code = code.replace(/\r\n/g, '\n');

// 1. Grey out property name
code = code.replace(
  '<input type="text" required value={editHotelData.name || \'\'} onChange={e => setEditHotelData({...editHotelData, name: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />',
  '<input type="text" required value={editHotelData.name || \'\'} readOnly disabled className="w-full bg-stone-200 border border-stone-300 p-3 rounded-xl outline-none text-stone-500 cursor-not-allowed" />\n                <p className="text-xs text-stone-400 mt-1">Property name cannot be changed after registration. Contact admin for assistance.</p>'
);
console.log('1. Property name greyed out');

// 2. Update startNewRoom defaults  
code = code.replace(
  "setEditRoomData({ name: '', description: '', price: 0, maxGuests: 2, baseGuests: 2, extraGuestFee: 0, quantity: 5, currency: 'USD', imageUrl: '', amenities: '' as any, packages: [], blockedDates: [] });",
  "setEditRoomData({ name: '', description: '', price: 0, priceMWK: 0, showDualCurrency: false, maxGuests: 2, baseGuests: 2, extraGuestFee: 0, quantity: 5, currency: 'USD', imageUrl: '', amenities: '' as any, packages: [], blockedDates: [] });"
);
console.log('2. startNewRoom defaults updated');

// 3. Replace currency dropdown + price with dual currency
const oldCurrencyLines = [
  '                  <div>',
  '                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Currency</label>',
  '                    <select value={editRoomData.currency || \'USD\'} onChange={e => setEditRoomData({...editRoomData, currency: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition">',
  '                      <option value="USD">USD ($)</option>',
  '                      <option value="MWK">Malawian Kwacha (MWK)</option>',
  '                    </select>',
  '                  </div>',
  '                  <div>',
  '                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Price per night</label>',
  '                    <input type="number" required value={editRoomData.price || 0} onChange={e => setEditRoomData({...editRoomData, price: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" />',
  '                  </div>',
].join('\n');

const newCurrencyLines = [
  '                  <div>',
  '                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Price in USD ($)</label>',
  '                    <input type="number" required value={editRoomData.price || 0} onChange={e => setEditRoomData({...editRoomData, price: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="e.g. 150" />',
  '                  </div>',
  '                  <div>',
  '                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Price in MWK (Kwacha)</label>',
  '                    <input type="number" value={editRoomData.priceMWK || 0} onChange={e => setEditRoomData({...editRoomData, priceMWK: Number(e.target.value)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="e.g. 250000" />',
  '                  </div>',
  '                  <div className="md:col-span-2">',
  '                    <label className="flex items-center gap-3 cursor-pointer">',
  '                      <input type="checkbox" checked={editRoomData.showDualCurrency || false} onChange={e => setEditRoomData({...editRoomData, showDualCurrency: e.target.checked})} className="w-5 h-5 rounded text-stone-900 border-stone-300" />',
  '                      <span className="text-sm font-medium text-stone-700">Show both USD and MWK prices to guests</span>',
  '                    </label>',
  '                  </div>',
].join('\n');

if (code.includes(oldCurrencyLines)) {
  code = code.replace(oldCurrencyLines, newCurrencyLines);
  console.log('3. Dual currency pricing added');
} else {
  console.log('3. WARNING: Could not find currency block');
}

// 4. Add packages + blocked dates before submit buttons
const oldSubmit = [
  '                </div>',
  '                <div className="pt-4 flex justify-end gap-3">',
  '                  <button type="button" onClick={cancelEditRoom}',
].join('\n');

const newSubmit = [
  '                </div>',
  '',
  '                {/* PACKAGES & INCLUSIONS */}',
  '                <div className="border-t border-stone-200 pt-6">',
  '                  <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-4">Room Packages & Inclusions</h4>',
  '                  <div className="flex flex-wrap gap-2 mb-4">',
  '                    {[',
  '                      { name: "Breakfast Included", price: 15, type: "per_person" as const },',
  '                      { name: "All-Inclusive", price: 50, type: "per_person" as const },',
  '                      { name: "Airport Shuttle", price: 30, type: "per_room" as const },',
  '                      { name: "Gym Access", price: 10, type: "per_person" as const },',
  '                      { name: "Kids Free (Under 12)", price: 0, type: "per_stay" as const },',
  '                      { name: "Spa Access", price: 25, type: "per_person" as const },',
  '                      { name: "WiFi Premium", price: 5, type: "per_room" as const },',
  '                    ].filter(p => !(editRoomData.packages || []).some(ep => ep.name === p.name)).map(p => (',
  '                      <button key={p.name} type="button" onClick={() => {',
  '                        const pkgs = editRoomData.packages || [];',
  '                        setEditRoomData({...editRoomData, packages: [...pkgs, { id: Date.now().toString(), ...p }]});',
  '                      }} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-xs font-medium hover:bg-stone-200 transition border border-stone-200">',
  '                        + {p.name}',
  '                      </button>',
  '                    ))}',
  '                  </div>',
  '                  {editRoomData.packages && editRoomData.packages.length > 0 && (',
  '                    <div className="space-y-3">',
  '                      {editRoomData.packages.map(pkg => (',
  '                        <div key={pkg.id} className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">',
  '                          <span className="flex-1 font-medium text-sm">{pkg.name}</span>',
  '                          <div className="flex items-center gap-2">',
  '                            <span className="text-xs text-stone-500">$</span>',
  '                            <input type="number" value={pkg.price} onChange={e => {',
  '                              const updated = editRoomData.packages!.map(p => p.id === pkg.id ? {...p, price: Number(e.target.value)} : p);',
  '                              setEditRoomData({...editRoomData, packages: updated});',
  '                            }} className="w-16 bg-white border border-stone-200 p-1.5 rounded-lg text-sm text-center outline-none focus:border-stone-900" />',
  '                          </div>',
  '                          <select value={pkg.type} onChange={e => {',
  '                            const updated = editRoomData.packages!.map(p => p.id === pkg.id ? {...p, type: e.target.value as any} : p);',
  '                            setEditRoomData({...editRoomData, packages: updated});',
  '                          }} className="bg-white border border-stone-200 p-1.5 rounded-lg text-xs outline-none focus:border-stone-900">',
  '                            <option value="per_person">Per Person</option>',
  '                            <option value="per_room">Per Room</option>',
  '                            <option value="per_stay">Per Stay</option>',
  '                          </select>',
  '                          <button type="button" onClick={() => {',
  '                            setEditRoomData({...editRoomData, packages: editRoomData.packages?.filter(p => p.id !== pkg.id)});',
  '                          }} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>',
  '                        </div>',
  '                      ))}',
  '                    </div>',
  '                  )}',
  '                </div>',
  '',
  '                {/* BLOCKED DATES */}',
  '                <div className="border-t border-stone-200 pt-6">',
  '                  <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-2">Block Dates</h4>',
  '                  <p className="text-xs text-stone-500 mb-3">Block specific dates (YYYY-MM-DD), comma separated.</p>',
  '                  <textarea rows={2} value={editRoomData.blockedDates ? editRoomData.blockedDates.join(", ") : ""} onChange={e => setEditRoomData({...editRoomData, blockedDates: e.target.value.split(",").map(d => d.trim()).filter(Boolean)})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="2026-09-01, 2026-09-02" />',
  '                </div>',
  '',
  '                <div className="pt-4 flex justify-end gap-3">',
  '                  <button type="button" onClick={cancelEditRoom}',
].join('\n');

if (code.includes(oldSubmit)) {
  code = code.replace(oldSubmit, newSubmit);
  console.log('4. Packages UI and blocked dates added');
} else {
  console.log('4. WARNING: Could not find submit button block');
}

// 5. Update room listing card price display for dual currency
const oldPrice = '{room.currency === \'MWK\' ? \'MWK \' : \'$\'}{room.price}';
const newPrice = '${room.price}';
if (code.includes(oldPrice)) {
  code = code.replace(
    '<div className="text-xl font-serif font-bold text-stone-900 whitespace-nowrap">' + oldPrice + '</div>',
    '<div className="text-right">\n                    <div className="text-xl font-serif font-bold text-stone-900 whitespace-nowrap">${room.price}</div>\n                    {room.showDualCurrency && room.priceMWK ? <div className="text-sm text-stone-500 font-medium">MWK {room.priceMWK?.toLocaleString()}</div> : null}\n                  </div>'
  );
  console.log('5. Dual currency on room cards');
} else {
  console.log('5. WARNING: Could not find old price display');
}

// 6. Add packages badges on room listing cards - find the closing </div> after availability badge
const availBadge = "{room.quantity > 0 ? `${room.quantity} Available` : 'Blocked'}";
const afterAvailIdx = code.indexOf(availBadge);
if (afterAvailIdx > -1) {
  const afterSpan = code.indexOf('</span>', afterAvailIdx);
  const afterDiv = code.indexOf('</div>', afterSpan + 7);
  // Insert packages badges before the closing </div>
  const insertAt = afterDiv;
  const pkgBadges = '\n                  {room.packages && room.packages.length > 0 && room.packages.map(pkg => (\n                    <span key={pkg.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{pkg.name}</span>\n                  ))}\n                ';
  code = code.slice(0, insertAt) + pkgBadges + code.slice(insertAt);
  console.log('6. Package badges on room cards');
}

fs.writeFileSync('src/pages/ManageHotel.tsx', code, 'utf-8');
console.log('\nAll ManageHotel patches applied!');
