const fs = require('fs');
let code = fs.readFileSync('src/components/AvailabilityCalendar.tsx', 'utf8');

const oldBlockedSet = `  const blockedSet = useMemo(
    () => new Set(blockedInventory.map(b => b.date)),
    [blockedInventory]
  );`;

const newBlockedSet = `  const blockedSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of blockedInventory) {
      if (totalRooms > 0 && b.units >= totalRooms) {
        set.add(b.date);
      } else if (totalRooms === 0 && b.units > 0) {
        set.add(b.date);
      }
    }
    return set;
  }, [blockedInventory, totalRooms]);`;

code = code.replace(oldBlockedSet, newBlockedSet);
fs.writeFileSync('src/components/AvailabilityCalendar.tsx', code);
console.log("Patched blockedSet to only include fully blocked dates.");
