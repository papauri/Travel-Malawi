/**
 * Swarm Flow Verification Test Suite
 * Validates core business logic across:
 * - Agent 1: Booking, Dates & Pricing
 * - Agent 2: Inventory, Availability & Occupancy
 * - Agent 3: Role Hierarchy & Permissions
 * - Agent 4: Currencies, Formatting & Money
 * - Agent 5: Document Hub & Export Formats
 * - Agent 6: AI Pacing & Provider Guardrails
 */

import { nightsBetween, nightsInRange, rangesOverlap, addDays, isValidDateStr, todayStr } from '../src/lib/dates';
import { 
  bookedUnitsForRange, 
  blockedUnitsForRange, 
  isRoomAvailable, 
  unitsRemaining, 
  buildOccupancyMap,
  isActiveBooking 
} from '../src/lib/availability';
import { computeBookingPricing, cancellationTerms, makeBookingReference } from '../src/lib/booking';
import { formatMoney, roomPrice, roomExtraGuestFee, packagePrice, resolveCurrency } from '../src/lib/currency';
import { userRoles, isGlobalAdmin, isAdmin, isMarketing, isHotelManager, isTraveller } from '../src/lib/roles';
import { validateBooking } from '../src/lib/validateBooking';
import { getAdminDocsList, getAdminDocContent } from '../server/docUtils';
import { RoomType, BookingLike } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, condition: boolean, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${description}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${description} ${detail ? `(${detail})` : ''}`);
  }
}

console.log('\n=== SWARM AGENT 1: Booking, Dates & Pricing Logic ===');
{
  // Test nights calculation
  assert('nightsBetween(2026-03-01, 2026-03-05) === 4', nightsBetween('2026-03-01', '2026-03-05') === 4);
  assert('nightsBetween same day is 0', nightsBetween('2026-03-01', '2026-03-01') === 0);
  assert('nightsBetween inverted is 0', nightsBetween('2026-03-05', '2026-03-01') === 0);
  
  // Test nightsInRange (check-out day exclusive)
  const range = nightsInRange('2026-03-01', '2026-03-04');
  assert('nightsInRange length is 3', range.length === 3);
  assert('nightsInRange excludes checkout day', !range.includes('2026-03-04') && range.includes('2026-03-03'));

  // Test rangesOverlap
  assert('Overlapping ranges detected', rangesOverlap('2026-03-01', '2026-03-05', '2026-03-04', '2026-03-08') === true);
  assert('Adjacent ranges do not overlap (check-out is check-in of next)', rangesOverlap('2026-03-01', '2026-03-05', '2026-03-05', '2026-03-10') === false);

  // Test Booking Reference generator
  const ref = makeBookingReference();
  assert('makeBookingReference generates valid format TM-XXXXXX', /^TM-[A-Z0-9]{6}$/.test(ref));

  // Test Pricing Calculation
  const mockRoom: RoomType = {
    id: 'room-1',
    hotelId: 'hotel-1',
    name: 'Executive Lake Chalet',
    description: 'Beautiful chalet',
    currencies: ['MWK', 'USD'],
    prices: { MWK: 120000, USD: 100 },
    extraGuestFees: { MWK: 25000, USD: 20 },
    baseGuests: 2,
    maxGuests: 4,
    quantity: 5,
    amenities: ['Wi-Fi'],
    imageUrl: '',
    price: 100,
    packages: [
      { id: 'pkg-bfast', name: 'Breakfast', type: 'per_person', price: 15, prices: { MWK: 15000, USD: 15 } },
      { id: 'pkg-kayak', name: 'Kayak Tour', type: 'per_room', price: 30, prices: { MWK: 35000, USD: 30 } }
    ]
  };

  // Pricing in MWK with 3 guests (1 extra guest), 2 nights, 1 room, with breakfast
  const pricingMWK = computeBookingPricing(
    mockRoom,
    '2026-04-01',
    '2026-04-03',
    3, // 3 guests -> 1 extra guest
    1, // 1 room
    ['pkg-bfast'],
    'MWK'
  );
  // Base: 120000 * 2 = 240000
  // Extra guest: 1 * 25000 * 2 = 50000
  // Accommodation: 290000
  // Package: 15000 * 3 guests * 2 nights = 90000
  // Total: 380000
  assert('computeBookingPricing MWK base price', pricingMWK.basePrice === 120000);
  assert('computeBookingPricing MWK extra guest total', pricingMWK.extraGuestTotal === 50000);
  assert('computeBookingPricing MWK accommodation total', pricingMWK.accommodationTotal === 290000);
  assert('computeBookingPricing MWK packages total', pricingMWK.packagesTotal === 90000);
  assert('computeBookingPricing MWK grand total', pricingMWK.total === 380000);

  // Pricing with 10% discount
  const pricingDiscount = computeBookingPricing(
    mockRoom,
    '2026-04-01',
    '2026-04-03',
    2,
    1,
    [],
    'USD',
    10 // 10% promo
  );
  // Base: 100 * 2 = 200
  // Discount: 20
  // Total: 180
  assert('computeBookingPricing USD with 10% discount', pricingDiscount.total === 180 && pricingDiscount.discountAmount === 20);

  // Cancellation policy
  const today = todayStr();
  const termsFuture = cancellationTerms({ status: 'confirmed', checkIn: addDays(today, 14) });
  assert('Cancellation > 7 days out is free', termsFuture.canCancel && termsFuture.isFree);
  const termsSoon = cancellationTerms({ status: 'confirmed', checkIn: addDays(today, 3) });
  assert('Cancellation < 7 days out is allowed but not free', termsSoon.canCancel && !termsSoon.isFree);
  const termsCancelled = cancellationTerms({ status: 'cancelled', checkIn: addDays(today, 10) });
  assert('Already cancelled booking cannot cancel again', !termsCancelled.canCancel);
}

console.log('\n=== SWARM AGENT 2: Inventory, Availability & Occupancy ===');
{
  const mockRoom: RoomType = {
    id: 'room-deluxe',
    hotelId: 'hotel-1',
    name: 'Deluxe Suite',
    description: '',
    price: 100,
    maxGuests: 2,
    quantity: 3,
    amenities: [],
    imageUrl: '',
    blockedDates: ['2026-05-10'],
    blockedUnits: { '2026-05-15': 2 }
  };

  const bookings: BookingLike[] = [
    { roomTypeId: 'room-deluxe', checkIn: '2026-05-01', checkOut: '2026-05-05', quantity: 2, status: 'confirmed' },
    { roomTypeId: 'room-deluxe', checkIn: '2026-05-03', checkOut: '2026-05-07', quantity: 1, status: 'confirmed' },
    { roomTypeId: 'room-deluxe', checkIn: '2026-05-01', checkOut: '2026-05-05', quantity: 1, status: 'cancelled' }, // cancelled releases inventory
    { roomTypeId: 'room-other', checkIn: '2026-05-01', checkOut: '2026-05-05', quantity: 1, status: 'confirmed' } // other room
  ];

  assert('isActiveBooking: confirmed is active', isActiveBooking(bookings[0]) === true);
  assert('isActiveBooking: cancelled is not active', isActiveBooking(bookings[2]) === false);

  // Overlap on 2026-05-03 to 2026-05-04: booking 1 has 2 units, booking 2 has 1 unit -> total 3 units
  const bookedPeak = bookedUnitsForRange(bookings, 'room-deluxe', '2026-05-03', '2026-05-04');
  assert('bookedUnitsForRange calculates peak concurrent bookings (2+1=3)', bookedPeak === 3);

  // Availability check
  assert('Sold out range: 3 booked out of 3 inventory -> not available', isRoomAvailable(mockRoom, bookings, '2026-05-03', '2026-05-04', 1) === false);
  assert('Available range: 2026-05-08 to 2026-05-09 (0 booked, 3 available) -> available', isRoomAvailable(mockRoom, bookings, '2026-05-08', '2026-05-09', 1) === true);

  // Blocked dates check
  assert('Blocked date in range (2026-05-10) blocks entire room', blockedUnitsForRange(mockRoom, '2026-05-09', '2026-05-11') === 3);
  assert('Partial blocked units (2026-05-15 has 2 blocked, 1 remains)', unitsRemaining(mockRoom, bookings, '2026-05-15', '2026-05-16') === 1);

  // Occupancy map: room-deluxe specific vs property wide
  const roomDeluxeBookings = bookings.filter(b => b.roomTypeId === 'room-deluxe');
  const occMapRoom = buildOccupancyMap(roomDeluxeBookings);
  assert('buildOccupancyMap for room-deluxe maps 2026-05-03 correctly to 3 occupied', occMapRoom['2026-05-03'] === 3);

  const occMapAll = buildOccupancyMap(bookings);
  assert('buildOccupancyMap for property-wide maps 2026-05-03 correctly to 4 occupied (3 deluxe + 1 other)', occMapAll['2026-05-03'] === 4);
  assert('buildOccupancyMap excludes checkout day (2026-05-05) from booking 1', occMapAll['2026-05-05'] === 1); // only booking 2 is active on 5th
}

console.log('\n=== SWARM AGENT 3: Role Hierarchy & Permissions ===');
{
  const globalAdminUser = { role: 'global_admin' as const, roles: ['global_admin' as const], email: 'admin@travelmalawi.com' };
  const emailSuperAdmin = { role: 'traveller' as const, email: 'johnpaulchirwa@gmail.com' };
  const adminUser = { role: 'admin' as const, roles: ['admin' as const] };
  const marketingUser = { role: 'marketing' as const, roles: ['marketing' as const] };
  const managerUser = { role: 'hotel_manager' as const, roles: ['hotel_manager' as const, 'traveller' as const] };
  const guestUser = { role: 'traveller' as const, roles: ['traveller' as const] };

  assert('isGlobalAdmin identifies global_admin role', isGlobalAdmin(globalAdminUser) === true);
  assert('isGlobalAdmin identifies super admin email johnpaulchirwa@gmail.com', isGlobalAdmin(emailSuperAdmin) === true);
  assert('isAdmin is true for global admin', isAdmin(globalAdminUser) === true);
  assert('isAdmin is true for admin role', isAdmin(adminUser) === true);
  assert('isMarketing is true for marketing role', isMarketing(marketingUser) === true);
  assert('isMarketing is false for guest', isMarketing(guestUser) === false);
  assert('isHotelManager is true for hotel_manager', isHotelManager(managerUser) === true);
  assert('isTraveller is true for multi-role user', isTraveller(managerUser) === true);
  assert('userRoles preserves multiple roles', userRoles(managerUser).length === 2);
}

console.log('\n=== SWARM AGENT 4: Currency & Money Formatting ===');
{
  assert('formatMoney MWK formats as MK 2,150,000 without tambala decimals', formatMoney(2150000, 'MWK') === 'MK 2,150,000');
  assert('formatMoney USD formats as $150 (clean without .00)', formatMoney(150, 'USD') === '$150');
  assert('formatMoney USD preserves non-zero fractions $150.50', formatMoney(150.50, 'USD') === '$150.50');
  assert('roomPrice resolves explicit currency', roomPrice({ prices: { MWK: 85000, USD: 75 }, price: 75, currency: 'USD' }, 'MWK') === 85000);
  assert('resolveCurrency falls back to primary if requested is not supported', resolveCurrency({ currencies: ['USD'], prices: { USD: 100 } } as any, 'MWK') === 'USD');
}

console.log('\n=== SWARM AGENT 5: Document Hub & Partner Playbooks ===');
{
  const docs = getAdminDocsList();
  assert('getAdminDocsList returns registered partner docs', docs.length >= 7);
  
  const docIds = docs.map(d => d.id);
  assert('Includes concept-validation-survey', docIds.includes('concept-validation-survey'));
  assert('Includes stay-owner-leaflet', docIds.includes('stay-owner-leaflet'));
  assert('Includes marketing-presentation', docIds.includes('marketing-presentation'));
  assert('Includes operations-starter-pack', docIds.includes('operations-starter-pack'));
  assert('Includes host-onboarding-pack', docIds.includes('host-onboarding-pack'));
  assert('Includes property-listing-guide', docIds.includes('property-listing-guide'));
  assert('Includes platform-guide-uat', docIds.includes('platform-guide-uat'));

  // Test content retrieval in all 3 formats
  const textDoc = getAdminDocContent('concept-validation-survey', 'text');
  assert('getAdminDocContent text format exists', !!textDoc && textDoc.content.length > 100);
  
  const mdDoc = getAdminDocContent('concept-validation-survey', 'md');
  assert('getAdminDocContent md format exists', !!mdDoc && mdDoc.content.includes('#'));

  const htmlDoc = getAdminDocContent('concept-validation-survey', 'html');
  assert('getAdminDocContent html format generates standalone HTML document', !!htmlDoc && htmlDoc.content.includes('<!DOCTYPE html>'));
}

console.log('\n=== SWARM AGENT 6: Form Validation & Security Guards ===');
{
  const mockRoom: RoomType = {
    id: 'room-1',
    hotelId: 'hotel-1',
    name: 'Chalet',
    description: '',
    price: 50,
    maxGuests: 4,
    quantity: 2,
    amenities: [],
    imageUrl: ''
  };

  const today = todayStr();

  // Valid booking submission
  const validErrors = validateBooking({
    guestName: 'Chikondi Banda',
    guestEmail: 'chikondi@example.mw',
    guestPhone: '+265 991 234 567',
    checkIn: addDays(today, 5),
    checkOut: addDays(today, 8),
    guests: 2
  }, mockRoom);
  assert('validateBooking returns 0 errors for valid input', validErrors.length === 0);

  // Invalid booking submissions
  const pastDateErrors = validateBooking({
    guestName: 'Chikondi',
    guestEmail: 'chikondi@example.mw',
    guestPhone: '+265 991 234 567',
    checkIn: '2020-01-01', // past date
    checkOut: '2020-01-03',
    guests: 2
  }, mockRoom);
  assert('validateBooking rejects past check-in', pastDateErrors.some(e => e.field === 'checkIn'));

  const reversedDateErrors = validateBooking({
    guestName: 'Chikondi',
    guestEmail: 'chikondi@example.mw',
    guestPhone: '+265 991 234 567',
    checkIn: addDays(today, 10),
    checkOut: addDays(today, 5), // checkout before checkin
    guests: 2
  }, mockRoom);
  assert('validateBooking rejects checkOut before checkIn', reversedDateErrors.some(e => e.field === 'checkOut'));

  const overCapacityErrors = validateBooking({
    guestName: 'Chikondi',
    guestEmail: 'chikondi@example.mw',
    guestPhone: '+265 991 234 567',
    checkIn: addDays(today, 5),
    checkOut: addDays(today, 8),
    guests: 10 // max is 4
  }, mockRoom);
  assert('validateBooking rejects guests exceeding room capacity', overCapacityErrors.some(e => e.field === 'guests'));
}

console.log(`\n======================================================`);
console.log(`SWARM VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} failures)`);
console.log(`======================================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
