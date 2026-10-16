import { parseIcalToBlockedDates } from '../server/icalService';
import { allBlockedDatesForRoom, isRoomAvailable } from '../src/lib/availability';
import { RoomType } from '../src/types';

// Sample RFC 5545 iCal payload from RoomRaccoon / Airbnb
const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RoomRaccoon//PMS Calendar Sync//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:rr-booking-101@roomraccoon.com
DTSTART;VALUE=DATE:20261101
DTEND;VALUE=DATE:20261105
SUMMARY:AfricaWildTruck Safari Guest (RoomRaccoon)
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:airbnb-res-202@airbnb.com
DTSTART:20261110T140000Z
DTEND:20261114T100000Z
SUMMARY:Reserved - Airbnb
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:cancelled-booking-303@booking.com
DTSTART;VALUE=DATE:20261120
DTEND;VALUE=DATE:20261122
SUMMARY:Cancelled Booking
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

async function runTests() {
  console.log('--- Testing RFC 5545 iCal Parsing ---');
  const result = parseIcalToBlockedDates(sampleIcal);
  console.log(`Parsed ${result.eventCount} active events (cancelled events skipped).`);
  console.log(`Extracted ${result.blockedDates.length} blocked nights:`, result.blockedDates);

  if (result.eventCount !== 2) {
    throw new Error(`Expected 2 events, got ${result.eventCount}`);
  }

  const [event1, event2] = result.events;
  console.log(`Event 1: ${event1.start} to ${event1.end} (${event1.summary})`);
  console.log(`Event 2: ${event2.start} to ${event2.end} (${event2.summary})`);

  if (event1.start !== '2026-11-01' || event1.end !== '2026-11-05') {
    throw new Error(`Event 1 dates mismatch: ${event1.start} -> ${event1.end}`);
  }

  if (event2.start !== '2026-11-10' || event2.end !== '2026-11-14') {
    throw new Error(`Event 2 dates mismatch: ${event2.start} -> ${event2.end}`);
  }

  // DTEND is exclusive: Nov 1 to Nov 5 should block Nov 1, Nov 2, Nov 3, Nov 4
  if (!result.blockedDates.includes('2026-11-01') || !result.blockedDates.includes('2026-11-04') || result.blockedDates.includes('2026-11-05')) {
    throw new Error('Event 1 blocked dates range error');
  }

  console.log('--- Testing Availability Integration ---');
  const testRoom: RoomType = {
    id: 'test-room-1',
    hotelId: 'test-hotel-1',
    name: 'Garden Chalet',
    price: 85,
    maxGuests: 2,
    quantity: 1,
    description: 'Cozy garden chalet',
    amenities: ['Wi-Fi'],
    imageUrl: 'https://example.com/chalet.jpg',
    blockedDates: ['2026-11-07'],
    icalBlockedDates: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'],
  };

  const allBlocked = allBlockedDatesForRoom(testRoom);
  console.log('Combined Blocked Dates:', allBlocked);

  if (!allBlocked.includes('2026-11-01') || !allBlocked.includes('2026-11-07')) {
    throw new Error('Combined blocked dates missing either manual or iCal dates');
  }

  // Check availability on blocked dates (should be false)
  const isAvailDuringIcal = isRoomAvailable(testRoom, [], '2026-11-01', '2026-11-03');
  const isAvailDuringManual = isRoomAvailable(testRoom, [], '2026-11-06', '2026-11-08');
  const isAvailOpenDates = isRoomAvailable(testRoom, [], '2026-11-15', '2026-11-18');

  console.log(`Available during iCal dates (should be false): ${isAvailDuringIcal}`);
  console.log(`Available during manual dates (should be false): ${isAvailDuringManual}`);
  console.log(`Available on open dates (should be true): ${isAvailOpenDates}`);

  if (isAvailDuringIcal !== false || isAvailDuringManual !== false || isAvailOpenDates !== true) {
    throw new Error('Availability logic mismatch!');
  }

  console.log('--- Testing RFC 5545 Line Unfolding and TZID Formats ---');
  const complexIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//macOS 14.5//EN
BEGIN:VEVENT
UID:complex-event-1@travelmalawi.app
DTSTART;TZID=Africa/Blantyre:20261205T140000
DTEND;TZID=Africa/Blantyre:20261208T100000
SUMMARY:Long summary that was folded
  across multiple lines by the
	originating PMS or channel manager
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:single-day-block@nightsbridge.com
DTSTART;VALUE=DATE:20261215
DTEND;VALUE=DATE:20261215
SUMMARY:Single Night Block
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  const complexResult = parseIcalToBlockedDates(complexIcal);
  console.log(`Complex parsed event count: ${complexResult.eventCount}`);
  console.log('Complex blocked dates:', complexResult.blockedDates);

  if (complexResult.eventCount !== 2) {
    throw new Error(`Expected 2 complex events, got ${complexResult.eventCount}`);
  }

  // Dec 5 to Dec 8 should block Dec 5, Dec 6, Dec 7
  if (!complexResult.blockedDates.includes('2026-12-05') ||
      !complexResult.blockedDates.includes('2026-12-06') ||
      !complexResult.blockedDates.includes('2026-12-07') ||
      complexResult.blockedDates.includes('2026-12-08')) {
    throw new Error('Multi-day timezone-bounded event blocked dates calculation error');
  }

  // Single-day block (Dec 15)
  if (!complexResult.blockedDates.includes('2026-12-15')) {
    throw new Error('Single-day event blocked date missing');
  }

  console.log('\n✓ ALL ICAL INTEGRATION TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
