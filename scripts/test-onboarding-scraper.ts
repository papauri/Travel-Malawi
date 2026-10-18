import {
  MALAWI_HOSPITALITY_REGISTRY,
  POPULAR_MALAWI_PROPERTIES_SHOWCASE,
  searchMalawiHospitalityRegistry,
} from '../src/lib/malawiHospitalityRegistry';
import { parsePropertyText } from '../src/lib/localPropertyParser';
import assert from 'node:assert';

// Onboarding guards: only onboarded properties exist (agents/directives/D1) and prices are
// entered manually per currency — never converted or invented.
console.log('--- Onboarding: no hard-coded properties, no invented prices ---');

assert.strictEqual(MALAWI_HOSPITALITY_REGISTRY.length, 0, 'registry must not list real properties');
assert.strictEqual(POPULAR_MALAWI_PROPERTIES_SHOWCASE.length, 0, 'showcase must not list real properties');
assert.strictEqual(searchMalawiHospitalityRegistry('Kaya Mawa').length, 0, 'search must not suggest non-onboarded lodges');
console.log('ok   no hard-coded properties in the registry');

const parsed = parsePropertyText(`Example Lakeside Lodge
Location: Cape Maclear, Mangochi
Lake View Room - USD 220 per night (2 guests, 2 rooms)
Garden Room - MK 140,000 per night (2 guests, 3 rooms)
Island Suite (Sleeps 2, 1 unit) - Rate on request
`);
const [usdRoom, mwkRoom, unpriced] = parsed.rooms ?? [];
assert.strictEqual(usdRoom?.prices?.USD, 220, 'USD price kept');
assert.ok(!usdRoom?.prices?.MWK, 'USD-only room must not get a converted MWK price');
assert.strictEqual(mwkRoom?.prices?.MWK, 140000, 'MWK price kept');
assert.ok(!mwkRoom?.prices?.USD, 'MWK-only room must not get a converted USD price');
assert.ok(!unpriced?.prices?.USD && !unpriced?.prices?.MWK, 'unpriced room must not get an invented price');
console.log('ok   prices kept per currency, none converted or invented');

console.log('\nAll checks passed');
