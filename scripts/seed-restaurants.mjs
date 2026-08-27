/**
 * Seeds trading hours, kwacha pricing and restaurant menus onto the imported
 * listings, so the currency switch, opening hours and Menu tab all have real
 * data behind them.
 *
 * Kwacha amounts are set explicitly rather than converted: the whole point of
 * the pricing model is that a property authors each currency itself. The rates
 * here are plausible figures for testing, not a live exchange rate.
 *
 *   node scripts/seed-restaurants.mjs            # dry run
 *   node scripts/seed-restaurants.mjs --apply
 */
import { db, APPLY, heading, plan, summarise } from './admin.mjs';

const id = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** Seven days, index 0 = Sunday, matching Date.getDay(). */
const week = (open, close) => Array.from({ length: 7 }, () => ({ closed: false, open, close }));

function weekWith(open, close, overrides = {}) {
  const days = week(open, close);
  for (const [index, value] of Object.entries(overrides)) days[Number(index)] = value;
  return days;
}

/** Kwacha rate used to seed MWK prices, rounded to something a menu would print. */
const roundMwk = (usd, unit = 1000) => Math.round((usd * 1750) / unit) * unit;

const menuFor = (template, name, tagline, description, sections, footnote) => ({
  enabled: true,
  name,
  tagline,
  description,
  template,
  logoOnly: false,
  hours: weekWith('12:00', '22:00'),
  sections,
  footnote,
});

const dish = (name, usd, description, tags) => ({
  id: id('item'),
  name,
  description,
  prices: { USD: usd, MWK: roundMwk(usd, 500) },
  ...(tags ? { tags } : {}),
});

/** Menus keyed by listing name. Templates differ so each one gets exercised. */
const RESTAURANTS = {
  'Blue Zebra Island Lodge': menuFor(
    'elegant',
    'The Boathouse',
    'Lakeside dining',
    'Whatever came out of the lake this morning, cooked simply and eaten with your feet in the sand.',
    [
      {
        id: id('sec'),
        name: 'To begin',
        items: [
          dish('Chambo ceviche', 14, 'Lake Malawi chambo, lime, red onion, chilli', ['gf']),
          dish('Smoked kampango pâté', 12, 'With sourdough from the island oven'),
          dish('Garden tomatoes', 10, 'Basil, olive oil, sea salt', ['v', 'gf']),
        ],
      },
      {
        id: id('sec'),
        name: 'From the lake',
        items: [
          dish('Grilled chambo', 26, 'Whole fish over coals, chilli-lime butter, greens', ['gf']),
          dish('Butterfish curry', 24, 'Coconut, ginger, coriander rice'),
          dish('Usipa fritters', 18, 'Crisp lake sardines, tamarind dip'),
        ],
      },
      {
        id: id('sec'),
        name: 'From the land',
        items: [
          dish('Slow beef short rib', 30, 'Eight hours, red wine, smoked mash'),
          dish('Pumpkin and groundnut stew', 20, 'Nsima, wild greens', ['v']),
        ],
      },
      {
        id: id('sec'),
        name: 'To finish',
        items: [
          dish('Baobab posset', 9, 'Cream, baobab, shortbread'),
          dish('Malawi coffee affogato', 8, 'Mzuzu roast over vanilla ice cream'),
        ],
      },
    ],
    'Two sittings nightly, 7pm and 8.30pm. Please tell us about allergies when you book. A 10% service charge supports the island team.'
  ),

  'Kaya Mawa': menuFor(
    'heritage',
    'Kaya Mawa Table',
    'Est. 1998 · Likoma Island',
    'One menu, changed daily, served at a long table under the fig tree.',
    [
      {
        id: id('sec'),
        name: 'First course',
        items: [
          dish('Chilled cucumber and mint', 11, 'Island garden cucumbers, yoghurt', ['v', 'gf']),
          dish('Crab and avocado', 15, 'Lake crab, lime, chilli'),
        ],
      },
      {
        id: id('sec'),
        name: 'Second course',
        items: [
          dish('Line-caught chambo', 28, 'Charred lemon, samp, greens', ['gf']),
          dish('Goat shoulder', 27, 'Slow roast, cumin, flatbread'),
          dish('Aubergine and lentil', 21, 'Tamarind, coriander, coconut rice', ['v']),
        ],
      },
      {
        id: id('sec'),
        name: 'Third course',
        items: [
          dish('Dark chocolate and chilli tart', 10, ''),
          dish('Island fruit', 8, 'Whatever is ripe, with lime', ['v', 'gf']),
        ],
      },
    ],
    'Dinner is a set menu at 7.30pm. Vegetarian and gluten-free versions of every course are available with a day’s notice.'
  ),

  'Pumulani Lodge': menuFor(
    'bistro',
    'Pumulani Terrace',
    'All day, lake view',
    'Breakfast until late, long lunches, and something cold at sundown.',
    [
      {
        id: id('sec'),
        name: 'Breakfast',
        items: [
          dish('Full Malawian', 13, 'Eggs, tomato, beans, toast'),
          dish('Banana and groundnut porridge', 8, '', ['v']),
          dish('Fruit and yoghurt', 7, 'Mango, papaya, honey', ['v', 'gf']),
        ],
      },
      {
        id: id('sec'),
        name: 'Lunch',
        items: [
          dish('Chambo sandwich', 15, 'Grilled fish, tartare, ciabatta'),
          dish('Chickpea and greens salad', 12, 'Lemon, tahini', ['v', 'gf']),
          dish('Beef burger', 17, 'Aged cheddar, tomato relish, chips'),
        ],
      },
      {
        id: id('sec'),
        name: 'Sundowners',
        items: [
          dish('Kuche Kuche', 4, 'Cold, local, in a bottle'),
          dish('Gin and tonic', 7, 'Malawi gin, cucumber'),
          dish('Baobab and lime soda', 5, '', ['v']),
        ],
      },
      {
        id: id('sec'),
        name: 'Dinner',
        items: [
          dish('Grilled catch of the day', 25, 'With whatever the garden gave us', ['gf']),
          dish('Pork belly', 24, 'Apple, mustard mash'),
          dish('Vegetable curry', 19, 'Coconut, rice, sambals', ['v']),
        ],
      },
    ],
    'Kitchen closes at 10pm. Room service available to all chalets.'
  ),
};

/** Property hours; a lodge reception is not a nine-to-five. */
const PROPERTY_HOURS = {
  'Blue Zebra Island Lodge': { hours: weekWith('06:00', '22:00'), checkInTime: '14:00', checkOutTime: '10:00' },
  'Kaya Mawa': { hours: weekWith('00:00', '00:00'), checkInTime: '13:00', checkOutTime: '10:00' },
  'Pumulani Lodge': { hours: weekWith('06:30', '23:00'), checkInTime: '14:00', checkOutTime: '11:00' },
  'Sunbird Ku Chawe': { hours: weekWith('07:00', '21:00'), checkInTime: '14:00', checkOutTime: '11:00' },
  'Mvuu Camp & Lodge': { hours: weekWith('05:30', '21:30'), checkInTime: '13:00', checkOutTime: '10:00' },
  'Lilongwe Grand': { hours: weekWith('00:00', '00:00'), checkInTime: '15:00', checkOutTime: '12:00' },
};

let changes = 0;

// --- 1. Hours and check-in / check-out times --------------------------------
heading('Property hours and check-in / check-out times');
const hotels = await db.collection('hotels').get();

for (const doc of hotels.docs) {
  const hotel = doc.data();
  const config = PROPERTY_HOURS[hotel.name];
  if (!config) continue;
  if (hotel.hours && hotel.checkInTime && hotel.checkOutTime) {
    console.log(`  ok    ${hotel.name}`);
    continue;
  }
  plan(`set hours and times on "${hotel.name}"`);
  changes++;
  if (APPLY) await doc.ref.update(config);
}

// --- 2. Kwacha prices on every room -----------------------------------------
heading('Room pricing in both currencies');
const rooms = await db.collection('room_types').get();

for (const doc of rooms.docs) {
  const room = doc.data();
  const usd = Number(room.prices?.USD ?? room.price ?? 0);
  if (!(usd > 0)) {
    console.log(`  skip  ${room.name}: no USD rate to work from`);
    continue;
  }
  if (room.prices?.MWK > 0 && room.currencies?.includes('MWK')) {
    console.log(`  ok    ${room.name}`);
    continue;
  }

  const mwk = roundMwk(usd, 5000);
  const update = {
    currencies: ['USD', 'MWK'],
    prices: { USD: usd, MWK: mwk },
    extraGuestFees: { USD: 25, MWK: roundMwk(25, 1000) },
    currency: 'USD',
    // Legacy mirrors, kept in step for anything still reading them.
    price: usd,
    priceMWK: mwk,
    showDualCurrency: true,
    extraGuestFee: 25,
    packages: (room.packages ?? []).map(pkg => ({
      ...pkg,
      prices: { USD: Number(pkg.price ?? 0), MWK: roundMwk(Number(pkg.price ?? 0), 500) },
    })),
  };

  plan(`price "${room.name}" at $${usd} / MK ${mwk.toLocaleString()}`);
  changes++;
  if (APPLY) await doc.ref.update(update);
}

// --- 3. Restaurants ----------------------------------------------------------
heading('Restaurant menus');
for (const doc of hotels.docs) {
  const hotel = doc.data();
  const restaurant = RESTAURANTS[hotel.name];
  if (!restaurant) continue;
  if (hotel.restaurant?.sections?.length) {
    console.log(`  ok    ${hotel.name} already has a menu`);
    continue;
  }
  const dishes = restaurant.sections.reduce((n, s) => n + s.items.length, 0);
  plan(`add "${restaurant.name}" to ${hotel.name} — ${restaurant.template} template, ${dishes} dishes`);
  changes++;
  if (APPLY) await doc.ref.update({ restaurant });
}

summarise(changes);
process.exit(0);
