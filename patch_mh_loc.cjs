const fs = require('fs');
let content = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

const target = `<div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Map Coordinates</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((position) => {
                          setEditHotelData({...editHotelData, coordinates: { lat: position.coords.latitude, lng: position.coords.longitude }});
                          toast.success('Coordinates updated!');
                        }, () => toast.error('Failed to get location'));
                      }
                    }}
                    className="bg-stone-200 text-stone-700 px-4 rounded-xl hover:bg-stone-300 transition font-medium whitespace-nowrap"
                  >
                    Get Current Location
                  </button>
                </div>
                {editHotelData.coordinates && (
                  <p className="text-xs text-stone-500 mt-2">Saved coordinates: {editHotelData.coordinates.lat.toFixed(4)}, {editHotelData.coordinates.lng.toFixed(4)}</p>
                )}`;

const replacement = `<div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Map Coordinates</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((position) => {
                          setEditHotelData({...editHotelData, coordinates: { lat: position.coords.latitude, lng: position.coords.longitude }});
                          toast.success('Coordinates updated!');
                        }, () => toast.error('Failed to get location'));
                      }
                    }}
                    className="bg-stone-200 text-stone-700 px-3 py-1 rounded-lg hover:bg-stone-300 transition font-medium text-xs whitespace-nowrap"
                  >
                    Use My Location
                  </button>
                </div>
                <div className="flex gap-4 mt-2">
                   <div className="flex-1">
                     <label className="block text-[10px] uppercase text-stone-400 mb-1">Latitude</label>
                     <input type="number" step="any" value={editHotelData.coordinates?.lat ?? ''} onChange={e => setEditHotelData({...editHotelData, coordinates: { lat: parseFloat(e.target.value), lng: editHotelData.coordinates?.lng ?? 0 }})} className="w-full bg-stone-50 border border-stone-200 p-2 rounded-lg outline-none focus:border-stone-900 transition text-sm" placeholder="-13.9626" />
                   </div>
                   <div className="flex-1">
                     <label className="block text-[10px] uppercase text-stone-400 mb-1">Longitude</label>
                     <input type="number" step="any" value={editHotelData.coordinates?.lng ?? ''} onChange={e => setEditHotelData({...editHotelData, coordinates: { lat: editHotelData.coordinates?.lat ?? 0, lng: parseFloat(e.target.value) }})} className="w-full bg-stone-50 border border-stone-200 p-2 rounded-lg outline-none focus:border-stone-900 transition text-sm" placeholder="33.7741" />
                   </div>
                </div>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/pages/ManageHotel.tsx', content);
