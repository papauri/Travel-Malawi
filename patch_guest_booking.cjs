const fs = require("fs");
let code = fs.readFileSync("src/pages/HotelDetails.tsx", "utf-8");

// 1. Update initiateBooking
const initiateBookingSearch = `  const initiateBooking = (room: RoomType) => {
    if (!user) {
      toast.error("Please sign in as a traveller to book.");
      return;
    }
    if (user.role !== 'traveller') {
      toast.error("Only travellers can book rooms. Please sign in as a traveller.");
      return;
    }`;
const initiateBookingReplace = `  const initiateBooking = (room: RoomType) => {
    if (user && user.role !== 'traveller') {
      toast.error("Managers cannot book rooms. Please sign out or use a traveller account.");
      return;
    }`;

code = code.replace(initiateBookingSearch, initiateBookingReplace);

// 2. Update handleManualBook
const manualBookSearch1 = `if (!user || !selectedRoom) return;`;
const manualBookReplace1 = `if (!selectedRoom) return;\n      if (!guestName || !guestEmail || !guestPhone) {\n        toast.error("Please fill in your name, email, and phone number.");\n        return;\n      }`;

code = code.replace(manualBookSearch1, manualBookReplace1);

const manualBookSearch2 = `guestId: user.uid,`;
const manualBookReplace2 = `guestId: user?.uid || 'anonymous',`;

code = code.replace(manualBookSearch2, manualBookReplace2);

const manualBookSearch3 = `toast.success('Manual booking requested! Manager will review.');
      setSelectedRoom(null);
      navigate('/my-bookings');`;
const manualBookReplace3 = `toast.success('Booking requested! The manager will contact you shortly.');
      setSelectedRoom(null);
      if (user) {
        navigate('/my-bookings');
      }`;

code = code.replace(manualBookSearch3, manualBookReplace3);

fs.writeFileSync("src/pages/HotelDetails.tsx", code, "utf-8");

