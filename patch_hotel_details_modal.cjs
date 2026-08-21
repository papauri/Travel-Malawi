const fs = require('fs');
let code = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf-8');

// Replace handleManualBook
const handleManualBookOld = /const handleManualBook = async \(e: React\.FormEvent\) => \{[\s\S]*?setBookingStatus\(''\);\n      \}\n    \};\n/m;
const handleManualBookNew = `const handleManualBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    if (!guestName || !guestEmail || !guestPhone) {
      toast.error("Please provide your name, email, and phone number.");
      return;
    }
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = checkIn && checkOut && checkOutDate > checkInDate 
      ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)) 
      : 0;
      
    if (nights <= 0) {
      toast.error("Please select valid check-in and check-out dates.");
      return;
    }
    
    setBookingStatus(\`Checking availability for \${selectedRoom.name}...\`);
    try {
      // 1. Check Availability
      const q = query(
        collection(db, 'bookings'),
        where('hotelId', '==', hotel?.id),
        where('roomTypeId', '==', selectedRoom.id),
        where('status', 'in', ['pending', 'confirmed'])
      );
      const snap = await getDocs(q);
      const map: Record<string, number> = {};
      
      if (selectedRoom.blockedDates) {
        selectedRoom.blockedDates.forEach(d => {
          map[d] = selectedRoom.quantity ?? 1;
        });
      }
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.checkIn || !data.checkOut) return;
        let cursor = data.checkIn;
        while (cursor < data.checkOut) {
          map[cursor] = (map[cursor] || 0) + (data.quantity || 1);
          const d = new Date(cursor);
          d.setDate(d.getDate() + 1);
          cursor = d.toISOString().slice(0, 10);
        }
      });

      let isAvailable = true;
      let checkCursor = checkIn;
      while (checkCursor < checkOut) {
        if ((map[checkCursor] || 0) >= (selectedRoom.quantity ?? 1)) {
          isAvailable = false;
          break;
        }
        const d = new Date(checkCursor);
        d.setDate(d.getDate() + 1);
        checkCursor = d.toISOString().slice(0, 10);
      }

      if (!isAvailable) {
        toast.error("Some dates in your range are fully booked or blocked. Please select another date range.");
        setBookingStatus('');
        return;
      }

      // 2. Add Booking
      await addDoc(collection(db, 'bookings'), {
        hotelId: hotel?.id,
        managerId: hotel?.managerId,
        roomTypeId: selectedRoom.id,
        guestId: user?.uid || 'anonymous',
        guestName: guestName,
        guestEmail: guestEmail,
        guestPhone: guestPhone,
        guestWhatsapp: guestWhatsapp,
        checkIn: checkIn,
        checkOut: checkOut,
        specialRequests: specialRequests,
        guests: guestsCount,
        quantity: 1,
        total: (() => {
            const basePrice = selectedRoom.price || 0;
            const extraGuestFee = selectedRoom.extraGuestFee || 0;
            const baseGuests = selectedRoom.baseGuests || selectedRoom.maxGuests || 2;
            const extraGuestsCount = Math.max(0, guestsCount - baseGuests);
            let total = (basePrice + (extraGuestsCount * extraGuestFee)) * nights;
            if (selectedRoom.packages) {
              selectedRoom.packages.forEach(pkg => {
                if (pkg.type === 'per_person') total += (pkg.price * guestsCount * nights);
                else if (pkg.type === 'per_room') total += (pkg.price * nights);
                else if (pkg.type === 'per_stay') total += pkg.price;
              });
            }
            return total;
        })(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      toast.success("Booking request submitted! We will contact you shortly.");
      setBookingStatus('');
      setSelectedRoom(null);
      setCheckIn('');
      setCheckOut('');
      setSpecialRequests('');
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit request.");
      setBookingStatus('');
    }
  };
`;
code = code.replace(handleManualBookOld, handleManualBookNew);

// Replace Manual Booking Modal rendering
const modalRegex = /\{\/\* Manual Booking Modal \*\/\}\n[\s\S]*?\{bookingStatus && \(/m;

const modalNew = `{/* Manual Booking Modal - Rosello Style */}
      <AnimatePresence>
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col"
          >
            <div className="p-8 md:p-12 border-b border-stone-100 flex justify-between items-start sticky top-0 bg-white/90 backdrop-blur z-10">
              <div>
                <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase mb-2 block">Reservation</span>
                <h2 className="text-4xl font-serif text-stone-900 leading-none">{selectedRoom.name}</h2>
              </div>
              <button 
                onClick={() => setSelectedRoom(null)} 
                className="text-stone-400 hover:text-stone-900 transition p-2"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleManualBook} className="p-8 md:p-12 flex-1 flex flex-col space-y-8">
              {/* Rosello elegant inputs */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-widest">Guest Name</label>
                  <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-transparent border-b border-stone-300 py-3 text-lg font-serif outline-none focus:border-stone-900 transition rounded-none placeholder-stone-200" placeholder="John Doe" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-widest">Email</label>
                    <input type="email" required value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full bg-transparent border-b border-stone-300 py-3 text-lg font-serif outline-none focus:border-stone-900 transition rounded-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-widest">Phone</label>
                    <input type="tel" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="w-full bg-transparent border-b border-stone-300 py-3 text-lg font-serif outline-none focus:border-stone-900 transition rounded-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-widest">Check In</label>
                    <input type="date" required min={today} value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full bg-transparent border-b border-stone-300 py-3 text-lg font-serif outline-none focus:border-stone-900 transition rounded-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-widest">Check Out</label>
                    <input type="date" required min={checkIn || today} value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full bg-transparent border-b border-stone-300 py-3 text-lg font-serif outline-none focus:border-stone-900 transition rounded-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-widest">Special Requests</label>
                  <input type="text" value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Arrival time, allergies, etc." className="w-full bg-transparent border-b border-stone-300 py-3 text-lg font-serif outline-none focus:border-stone-900 transition rounded-none placeholder-stone-200" />
                </div>
              </div>

              {/* DYNAMIC PRICING AND PACKAGES SECTION */}
              <div className="bg-stone-50 p-8 rounded-xl border border-stone-100 mt-8">
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
                      if (pkg.type === 'per_person') packagesTotal += (pkg.price * guestsCount * nights);
                      else if (pkg.type === 'per_room') packagesTotal += (pkg.price * nights);
                      else if (pkg.type === 'per_stay') packagesTotal += pkg.price;
                    });
                  }
                  
                  const grandTotal = accommodationTotal + packagesTotal;

                  return (
                    <div className="space-y-4 font-serif text-stone-600">
                      <div className="flex justify-between">
                        <span>{selectedRoom.currency === "MWK" ? "MWK " : "$"}{roomTotalPerNight} x {nights} nights</span>
                        <span>{selectedRoom.currency === "MWK" ? "MWK " : "$"}{accommodationTotal}</span>
                      </div>
                      
                      {selectedRoom.packages && selectedRoom.packages.length > 0 && (
                        <div className="pt-4 border-t border-stone-200">
                          <p className="font-bold text-xs font-sans tracking-widest uppercase mb-3 text-stone-400">Add-ons</p>
                          {selectedRoom.packages.map(pkg => (
                            <div key={pkg.id} className="flex justify-between items-center mb-2">
                              <span>{pkg.name}</span>
                              <span className="text-sm">+\${pkg.price}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center border-t border-stone-200 pt-6 mt-4">
                        <span className="font-sans font-bold text-stone-900 tracking-widest uppercase text-xs">Total</span>
                        <span className="font-serif text-3xl text-stone-900">{selectedRoom.currency === "MWK" ? "MWK " : "$"}{grandTotal}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-6 mt-auto">
                <button type="submit" className="w-full bg-stone-900 text-white px-8 py-5 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-stone-800 transition">
                  Confirm Reservation
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {bookingStatus && (`;

code = code.replace(modalRegex, modalNew);

fs.writeFileSync('src/pages/HotelDetails.tsx', code, 'utf-8');
console.log('HotelDetails modal updated');
