const fs = require("fs");
let code = fs.readFileSync("src/pages/HotelDetails.tsx", "utf-8");

if (!code.includes("const [selectedPackages, setSelectedPackages]")) {
  code = code.replace(
    "const [specialRequests, setSpecialRequests] = useState('');",
    "const [specialRequests, setSpecialRequests] = useState('');\n  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);"
  );
}

const submitSearch = "total: selectedRoom.price,";
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

if (!code.includes("packageIds: selectedPackages")) {
  code = code.replace(submitSearch, submitReplace);
}

if (!code.includes("setSelectedPackages([]);")) {
  code = code.replace(
    "setSelectedRoom(room);",
    "setSelectedRoom(room);\n    setSelectedPackages([]);"
  );
}

fs.writeFileSync("src/pages/HotelDetails.tsx", code, "utf-8");

