const fs = require("fs");
let code = fs.readFileSync("src/pages/HotelDetails.tsx", "utf-8");

// 1. Add selectedPackages state
code = code.replace(
  "const [specialRequests, setSpecialRequests] = useState('');",
  "const [specialRequests, setSpecialRequests] = useState('');\n  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);"
);

// 2. Add pricing calculation inside the modal render
const pricingCode = `
                {/* DYNAMIC PRICING AND PACKAGES SECTION */}
                {(() => {
                  const checkInDate = new Date(checkIn);
                  const checkOutDate = new Date(checkOut);
                  const nights = checkIn && checkOut && checkOutDate > checkInDate 
                    ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
                    : 0;
                  
                  const basePrice = selectedRoom.price || 0;
                  const extraGuestFee = selectedRoom.extraGuestFee || 0;
                  const baseGuests = selectedRoom.baseGuests || selectedRoom.maxGuests || 2;
                  const extraGuestsCount = Math.max(0, guestsCount - baseGuests);
                  
                  const roomTotalPerNight = basePrice + (extraGuestsCount * extraGuestFee);
                  const accommodationTotal = roomTotalPerNight * nights;
                  
                  let packagesTotal = 0;
                  if (selectedRoom.packages) {
                    selectedRoom.packages.forEach(pkg => {
                      if (selectedPackages.includes(pkg.id)) {
                         if (pkg.type === "per_person") packagesTotal += pkg.price * guestsCount * nights;
                         else if (pkg.type === "per_room") packagesTotal += pkg.price * nights;
                         else packagesTotal += pkg.price;
                      }
                    });
                  }
                  
                  const grandTotal = accommodationTotal + packagesTotal;
                  
                  return (
                    <div className="space-y-4">
                      {selectedRoom.packages && selectedRoom.packages.length > 0 && (
                        <div className="border border-stone-200 rounded-xl overflow-hidden mb-6">
                          <div className="bg-stone-50 px-4 py-3 border-b border-stone-200">
                            <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wide">Enhance Your Stay</h3>
                          </div>
                          <div className="divide-y divide-stone-100">
                            {selectedRoom.packages.map(pkg => (
                              <label key={pkg.id} className="flex items-center gap-3 p-4 hover:bg-stone-50 cursor-pointer transition">
                                <input 
                                  type="checkbox" 
                                  className="w-5 h-5 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                                  checked={selectedPackages.includes(pkg.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedPackages([...selectedPackages, pkg.id]);
                                    else setSelectedPackages(selectedPackages.filter(id => id !== pkg.id));
                                  }}
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-stone-900">{pkg.name}</p>
                                  <p className="text-sm text-stone-500">+$\${pkg.price} {pkg.type === "per_person" ? "per person/night" : pkg.type === "per_room" ? "per room/night" : "per stay"}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-stone-50 rounded-xl p-6 border border-stone-200 space-y-3">
                        <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wide border-b border-stone-200 pb-2 mb-3">Price Breakdown</h3>
                        
                        <div className="flex justify-between items-center text-stone-600">
                          <span>$\${basePrice} x \${nights} nights</span>
                          <span>$\${basePrice * nights}</span>
                        </div>
                        
                        {extraGuestsCount > 0 && (
                          <div className="flex justify-between items-center text-stone-600">
                            <span>Extra Guests (\${extraGuestsCount} x $\${extraGuestFee} x \${nights}n)</span>
                            <span>$\${extraGuestsCount * extraGuestFee * nights}</span>
                          </div>
                        )}
                        
                        {packagesTotal > 0 && (
                          <div className="flex justify-between items-center text-emerald-600">
                            <span>Selected Packages</span>
                            <span>+$\${packagesTotal}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center border-t border-stone-200 pt-3 mt-3">
                          <span className="font-bold text-stone-900">Total</span>
                          <span className="font-serif font-bold text-2xl text-stone-900">{selectedRoom.currency === "MWK" ? "MWK " : "$"}\${grandTotal}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
`;

code = code.replace(
  `<div className="bg-stone-50 rounded-xl p-4 flex justify-between items-center border border-stone-200">
                  <span className="text-stone-600 font-medium">{selectedRoom.name}</span>
                  <span className="font-serif font-bold text-lg text-stone-900">{selectedRoom.currency === 'MWK' ? 'MWK ' : '$'}{selectedRoom.price}/night</span>
                </div>`,
  pricingCode
);

// 3. Update the handleManualBook to save the real calculated total
const submitSearch = `total: selectedRoom.price,`;
const submitReplace = `total: (() => {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = checkIn && checkOut && checkOutDate > checkInDate 
              ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
              : 0;
            const basePrice = selectedRoom.price || 0;
            const extraGuestFee = selectedRoom.extraGuestFee || 0;
            const baseGuests = selectedRoom.baseGuests || selectedRoom.maxGuests || 2;
            const extraGuestsCount = Math.max(0, guestsCount - baseGuests);
            const accommodationTotal = (basePrice + (extraGuestsCount * extraGuestFee)) * nights;
            let packagesTotal = 0;
            if (selectedRoom.packages) {
              selectedRoom.packages.forEach(pkg => {
                if (selectedPackages.includes(pkg.id)) {
                   if (pkg.type === "per_person") packagesTotal += pkg.price * guestsCount * nights;
                   else if (pkg.type === "per_room") packagesTotal += pkg.price * nights;
                   else packagesTotal += pkg.price;
                }
              });
            }
            return accommodationTotal + packagesTotal;
          })(),
          packageIds: selectedPackages,
          extraGuestTotal: Math.max(0, guestsCount - (selectedRoom.baseGuests || selectedRoom.maxGuests || 2)) * (selectedRoom.extraGuestFee || 0),
          packagesTotal: (() => {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = checkIn && checkOut && checkOutDate > checkInDate 
              ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
              : 0;
            let pTotal = 0;
            if (selectedRoom.packages) {
              selectedRoom.packages.forEach(pkg => {
                if (selectedPackages.includes(pkg.id)) {
                   if (pkg.type === "per_person") pTotal += pkg.price * guestsCount * nights;
                   else if (pkg.type === "per_room") pTotal += pkg.price * nights;
                   else pTotal += pkg.price;
                }
              });
            }
            return pTotal;
          })(),`;

code = code.replace(submitSearch, submitReplace);

// Reset packages when modal opens
code = code.replace(
  "setSelectedRoom(room);",
  "setSelectedRoom(room);\n      setSelectedPackages([]);"
);

fs.writeFileSync("src/pages/HotelDetails.tsx", code, "utf-8");

