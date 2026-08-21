
const fs = require("fs");
let code = fs.readFileSync("src/pages/HotelDetails.tsx", "utf-8");

// 1. initiateBooking
const initiateSearch = `  const initiateBooking = (room: RoomType) => {
    if (!user) {
      toast.error("Please sign in as a traveller to book.");
      return;
    }
    if (user.role !== 'traveller') {
      toast.error("Only travellers can book rooms. Please sign in as a traveller.");
      return;
    }`;
const initiateReplace = `  const initiateBooking = (room: RoomType) => {
    if (user && user.role !== 'traveller') {
      toast.error("Managers cannot book rooms. Please sign out or use a traveller account.");
      return;
    }`;
code = code.replace(initiateSearch, initiateReplace);

// 2. handleManualBook checks
const handleSearch = `if (!user || !selectedRoom) return;`;
const handleReplace = `if (!selectedRoom) return;\n    if (!guestName || !guestEmail || !guestPhone) {\n      toast.error("Please provide your name, email, and phone number.");\n      return;\n    }`;
code = code.replace(handleSearch, handleReplace);

// 3. guestId
const guestIdSearch = `guestId: user.uid,`;
const guestIdReplace = `guestId: user?.uid || 'anonymous',`;
code = code.replace(guestIdSearch, guestIdReplace);

// 4. success
const successSearch = `toast.success('Manual booking requested! Manager will review.');
      setSelectedRoom(null);
      navigate('/my-bookings');`;
const successReplace = `toast.success('Booking requested! The manager will contact you shortly.');
      setSelectedRoom(null);
      if (user) {
        navigate('/my-bookings');
      }`;
code = code.replace(successSearch, successReplace);

fs.writeFileSync("src/pages/HotelDetails.tsx", code, "utf-8");

