/**
 * Validation rules, checked.
 *
 * The form rules are pure functions on purpose, so they can be exercised
 * without a browser or a Firestore. Bounds like "quantity may be zero but not
 * negative", or "a local WhatsApp number is expanded to +265", are the kind of
 * thing that rots silently — a stray `>=` and a property stops being bookable
 * with nothing anywhere reporting an error.
 *
 *   npm run check:validation
 */

import { validateRoom } from '../src/lib/validateRoom';
import { validateProperty } from '../src/lib/listing';
import { emailProblem, phoneProblem, telLink, whatsappLink } from '../src/lib/contact';
import { newChimeState, shouldChime } from '../src/lib/notificationSound';
import {
  distanceKm, isWithinMalawi, looksSwapped, mapEmbedUrl, parseCoordinates, pinProblem,
} from '../src/lib/geo';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`FAIL ${label}\n  got      ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

/* ---------------------------------------------------------------- rooms -- */

console.log('\n— Rooms —');

const room = {
  name: 'Lake-facing chalet',
  description: 'Right on the sand.',
  currencies: ['USD' as const],
  prices: { USD: 120 },
  maxGuests: 4,
  baseGuests: 2,
  quantity: 6,
  packages: [],
  blockedDates: [],
};

check('a complete room has no errors', Object.keys(validateRoom(room)).length, 0);
check('name is required', !!validateRoom({ ...room, name: '   ' }).name, true);
check('at least one currency', !!validateRoom({ ...room, currencies: [] }).currencies, true);
check('a currency with no rate', !!validateRoom({ ...room, prices: {} }).prices, true);
check('a zero rate', !!validateRoom({ ...room, prices: { USD: 0 } }).prices, true);
check('a negative rate', !!validateRoom({ ...room, prices: { USD: -5 } }).prices, true);
check('maxGuests below one', !!validateRoom({ ...room, maxGuests: 0 }).maxGuests, true);
check('a fractional maxGuests', !!validateRoom({ ...room, maxGuests: 2.5 }).maxGuests, true);
check('quantity may be zero — off sale, not invalid', !!validateRoom({ ...room, quantity: 0 }).quantity, false);
check('a negative quantity', !!validateRoom({ ...room, quantity: -1 }).quantity, true);
check('base guests above max', !!validateRoom({ ...room, baseGuests: 9, maxGuests: 4 }).baseGuests, true);
check('a negative extra-guest fee', !!validateRoom({ ...room, extraGuestFees: { USD: -1 } }).extraGuestFees, true);
check('a zero extra-guest fee is fine', !!validateRoom({ ...room, extraGuestFees: { USD: 0 } }).extraGuestFees, false);
check('a malformed blocked date', !!validateRoom({ ...room, blockedDates: ['2026-13-99'] }).blockedDates, true);
check(
  'an unnamed package',
  !!validateRoom({
    ...room,
    packages: [{ id: 'a', name: '', type: 'per_room', price: 5, prices: { USD: 5 } }] as any,
  }).packages,
  true
);
check(
  'a package with no price in any sold currency',
  !!validateRoom({
    ...room,
    packages: [{ id: 'a', name: 'Dinner', type: 'per_room', price: 0, prices: {} }] as any,
  }).packages,
  true
);
check(
  'every problem is reported at once, not just the first',
  Object.keys(validateRoom({ ...room, name: '', currencies: [], maxGuests: 0 })).length >= 3,
  true
);

/* -------------------------------------------------------------- contact -- */

console.log('\n— Contact —');

check('a real address passes', emailProblem('a@b.mw', 'Email', true), null);
check('a domain with no dot fails', !!emailProblem('a@b', 'Email', true), true);
check('blank passes when optional', emailProblem('', 'Email', false), null);
check('blank fails when required', !!emailProblem('', 'Email', true), true);
check('too few digits', !!phoneProblem('123', 'Phone', true), true);
check('an international number passes', phoneProblem('+265 991 234 567', 'Phone', true), null);
check('letters are not a number', !!phoneProblem('call me', 'Phone', true), true);
check('a local number gains the country code', whatsappLink('0991234567'), 'https://wa.me/265991234567');
check('an international number is left alone', whatsappLink('+265991234567'), 'https://wa.me/265991234567');
check('no number yields no link', whatsappLink(''), null);
check('tel: keeps the plus', telLink('+265 991 234 567'), 'tel:+265991234567');

/* ----------------------------------------------------------- properties -- */

console.log('\n— Properties —');

const property = {
  name: 'Nkhata Bay Beach Lodge',
  category: 'Lake & Beach',
  location: 'Nkhata Bay',
  description: 'x'.repeat(80),
  imageUrl: 'https://example.com/a.jpg',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  managerName: 'Kondwani Banda',
  contactEmail: 'stay@lodge.mw',
  contactPhone: '+265991234567',
  contactWhatsapp: '',
};

check('a complete listing publishes', Object.keys(validateProperty(property, 'publish')).length, 0);
check('a thin description blocks publishing', !!validateProperty({ ...property, description: 'Too short' }, 'publish').description, true);
check('...but does not block editing an older listing', !!validateProperty({ ...property, description: 'Too short' }, 'edit').description, false);
check('an empty description blocks either way', !!validateProperty({ ...property, description: '' }, 'edit').description, true);
check('no contact details block publishing', !!validateProperty({ ...property, contactEmail: '', contactPhone: '' }, 'publish').contactEmail, true);
check('...but do not block editing', !!validateProperty({ ...property, contactEmail: '', contactPhone: '' }, 'edit').contactEmail, false);
check('a malformed email blocks either way', !!validateProperty({ ...property, contactEmail: 'nope' }, 'edit').contactEmail, true);
check('no category blocks publishing', !!validateProperty({ ...property, category: '' }, 'publish').category, true);
check('...but does not block editing', !!validateProperty({ ...property, category: '' }, 'edit').category, false);
check('a category off the list blocks either way', !!validateProperty({ ...property, category: 'Spaceship' }, 'edit').category, true);
check('the editor\'s categories array is read too', Object.keys(validateProperty({ ...property, category: undefined, categories: ['Luxury'] }, 'publish')).length, 0);
check('a listing with no photo', !!validateProperty({ ...property, imageUrl: '' }, 'edit').imageUrl, true);
check('an impossible check-in time', !!validateProperty({ ...property, checkInTime: '25:00' }, 'edit').checkInTime, true);
check('an empty name', !!validateProperty({ ...property, name: '' }, 'edit').name, true);
check('no manager name blocks publishing', !!validateProperty({ ...property, managerName: '' }, 'publish').managerName, true);
check('...but does not block editing', !!validateProperty({ ...property, managerName: '' }, 'edit').managerName, false);

/* --------------------------------------------------------------- chime -- */

// The chime's own sound needs a browser, but the decision of *whether* to make
// one is pure: never for the backlog a chat opens with, never for a message you
// sent yourself. Getting this wrong means a chat that pings once per existing
// message the moment it is opened.
console.log('\n- Chime gating -');

const state = newChimeState();
const backlog = [{ id: '1', senderId: 'them' }, { id: '2', senderId: 'me' }];

check('silent on the conversation a chat opens with', shouldChime(backlog, 'me', state), false);

const mine = [...backlog, { id: '3', senderId: 'me' }];
check('silent for a message you sent yourself', shouldChime(mine, 'me', state), false);

const theirs = [...mine, { id: '4', senderId: 'them' }];
check('sounds for a message from the other party', shouldChime(theirs, 'me', state), true);
check('a repeated snapshot does not sound again', shouldChime(theirs, 'me', state), false);


/* ----------------------------------------------------------------- geo -- */

// Nobody types coordinates; they paste a link off a phone. Each of these shapes
// comes out of a real Google Maps copy, and a parser that quietly returns null
// for one of them leaves the pin unset with no error anywhere.
console.log('\n- Map pins -');

const kayaMawa = { lat: -12.0699, lng: 34.7239 };

check('a bare pair', parseCoordinates('-13.98, 33.78'), { lat: -13.98, lng: 33.78 });
check('a pair separated by a space', parseCoordinates('-13.98 33.78'), { lat: -13.98, lng: 33.78 });
check('an @lat,lng map URL', parseCoordinates('https://www.google.com/maps/place/Lilongwe/@-13.9626,33.7741,13z'), { lat: -13.9626, lng: 33.7741 });
check('a ?q= link', parseCoordinates('https://maps.google.com/maps?q=-13.9626,33.7741&z=15'), { lat: -13.9626, lng: 33.7741 });
check('the !3d!4d place form wins over @', parseCoordinates('https://www.google.com/maps/place/X/@-13.0,33.0,17z/data=!3m1!4b1!3d-13.9626!4d33.7741'), { lat: -13.9626, lng: 33.7741 });
check('prose is not a coordinate', parseCoordinates('Near the mission, turn left'), null);
check('empty input', parseCoordinates(''), null);
check('an out-of-range pair is refused', parseCoordinates('-913.98, 33.78'), null);

check('a Malawian pin is inside', isWithinMalawi(kayaMawa), true);
check('London is not', isWithinMalawi({ lat: 51.5, lng: -0.12 }), false);
check('a swapped pair is spotted', looksSwapped({ lat: 34.7239, lng: -12.0699 }), true);
check('a correct pair is not called swapped', looksSwapped(kayaMawa), false);

check('no pin reports missing', pinProblem(undefined), 'missing');
check('a good pin reports nothing', pinProblem(kayaMawa), null);
check('a swapped pin is named', pinProblem({ lat: 34.7239, lng: -12.0699 }), 'swapped');
check('a foreign pin is named', pinProblem({ lat: 51.5, lng: -0.12 }), 'outside');
check('rubbish is named', pinProblem({ lat: 'x', lng: 3 }), 'invalid');

// A real record: "Lilongwe Grand" was pinned at 53.298, -7.558 — the middle of
// Ireland — by someone tapping "use my position" from the wrong continent. It
// is not a swapped pair (swapping lands it in the Indian Ocean), so it has to
// report as outside rather than be silently "corrected".
check('a pin on the wrong continent', pinProblem({ lat: 53.29815, lng: -7.55821 }), 'outside');
check('...and is not mistaken for a swap', looksSwapped({ lat: 53.29815, lng: -7.55821 }), false);

// Lilongwe to Blantyre is about 300 km by air.
const lilongwe = { lat: -13.9626, lng: 33.7741 };
const blantyre = { lat: -15.7861, lng: 35.0058 };
check('distance is in a sane range', Math.round(distanceKm(lilongwe, blantyre) / 10) * 10, 240);
check('distance to self is zero', Math.round(distanceKm(lilongwe, lilongwe)), 0);

check('the embed uses the pin when there is one', mapEmbedUrl({ location: 'Somewhere', coordinates: kayaMawa }).includes('-12.0699,34.7239'), true);
check('the embed falls back to the text', mapEmbedUrl({ location: 'Cape Maclear', coordinates: null }).includes('Cape%20Maclear'), true);


console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
