import { generateCuratedMalawiPropertyLookup } from '../server/aiService';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL: ${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

console.log('\n— Testing Onboarding Scraping & Occupancy Logic —\n');

// 1. Curated fallback property lookup
const lakeLookup = generateCuratedMalawiPropertyLookup({
  name: 'Kaya Mawa',
  location: 'Likoma Island',
});

check('lake lookup returns valid category', lakeLookup.category, 'Lake & Beach');
check('lake lookup has suggested rooms', Array.isArray(lakeLookup.suggestedRooms) && lakeLookup.suggestedRooms.length > 0, true);

for (const room of lakeLookup.suggestedRooms) {
  const baseG = Number(room.baseGuests || room.maxGuests);
  const maxG = Number(room.maxGuests);
  check(`room "${room.name}" baseGuests (${baseG}) <= maxGuests (${maxG})`, baseG <= maxG, true);
}

// 2. City fallback
const cityLookup = generateCuratedMalawiPropertyLookup({
  name: 'Sunbird Capital',
  location: 'Lilongwe',
});
check('city lookup has rooms', cityLookup.suggestedRooms.length > 0, true);
for (const room of cityLookup.suggestedRooms) {
  const baseG = Number(room.baseGuests || room.maxGuests);
  const maxG = Number(room.maxGuests);
  check(`city room "${room.name}" baseGuests (${baseG}) <= maxGuests (${maxG})`, baseG <= maxG, true);
}

// 3. Safari fallback
const safariLookup = generateCuratedMalawiPropertyLookup({
  name: 'Mvuu Camp',
  location: 'Liwonde',
});
check('safari lookup category', safariLookup.category, 'Safari & Wildlife');
for (const room of safariLookup.suggestedRooms) {
  const baseG = Number(room.baseGuests || room.maxGuests);
  const maxG = Number(room.maxGuests);
  check(`safari room "${room.name}" baseGuests (${baseG}) <= maxGuests (${maxG})`, baseG <= maxG, true);
}

// 4. URL normalization test
function normalizeTargetUrl(raw: string): string {
  let normalized = raw.trim();
  if (normalized.startsWith('www.')) {
    normalized = 'https://' + normalized;
  } else if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    if (normalized.includes('.') && !normalized.includes(' ')) {
      normalized = 'https://' + normalized;
    } else {
      return '';
    }
  }
  return normalized;
}

check('normalizes www. prefix', normalizeTargetUrl('www.kayamawa.com'), 'https://www.kayamawa.com');
check('leaves https as-is', normalizeTargetUrl('https://sunbirdhotels.com'), 'https://sunbirdhotels.com');
check('leaves http as-is', normalizeTargetUrl('http://insecure-site.mw'), 'http://insecure-site.mw');
check('normalizes domain without scheme', normalizeTargetUrl('lakecottages.mw/chalet-1'), 'https://lakecottages.mw/chalet-1');
check('returns empty for non-url text', normalizeTargetUrl('Sunbird Capital Hotel'), '');

console.log(failures === 0 ? '\nALL SCRAPING TESTS PASSED' : `\n${failures} SCRAPING TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
