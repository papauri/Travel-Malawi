const fs = require("fs");
let code = fs.readFileSync("src/components/AvailabilityCalendar.tsx", "utf-8");

code = code.replace(
  "export default function AvailabilityCalendar({ hotelId, rooms, onDateSelect }: Props) {",
  "export default function AvailabilityCalendar({ hotelId, rooms, onDateSelect, selectedRoom }: Props & { selectedRoom?: RoomType | null }) {"
);

code = code.replace(
  "const totalRooms = useMemo(",
  `const totalRooms = useMemo(
    () => {
      if (selectedRoom) return selectedRoom.quantity || 1;
      return rooms.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
    },
    [rooms, selectedRoom]
  );
  // dummy replace to skip the original totalRooms`
);

// We need to replace the original totalRooms calculation carefully.

