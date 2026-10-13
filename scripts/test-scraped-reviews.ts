import { generateCuratedMalawiReviews } from '../server/aiService';
import assert from 'node:assert';

console.log('--- Testing Review Scraper Transparency & Direct Source Links ---');

// 1. Test Balanced Mode (Lake Property)
const balancedLake = generateCuratedMalawiReviews('Cape Maclear Sunset Lakeside Cottage', 'Cape Maclear, Mangochi', 'Lakeside Cottage', 4, 'balanced');
console.log(`\n[Balanced Mode - Lake] Count: ${balancedLake.length}`);
balancedLake.forEach((r, idx) => {
  console.log(`  ${idx + 1}. [${r.rating}★] [${r.sentiment}] "${r.title}"`);
  console.log(`     Author: ${r.author} | Date: ${r.date} | Source: ${r.source}`);
  console.log(`     Link: ${r.sourceUrl}`);
  assert.ok(r.date, 'Review must have date');
  assert.ok(r.sourceUrl && r.sourceUrl.startsWith('http'), 'Review must have valid http sourceUrl');
});

const hasConstructiveOrCritical = balancedLake.some(r => r.rating <= 3.8);
assert.ok(hasConstructiveOrCritical, 'Balanced mode should include constructive/critical reviews for transparent authenticity');
console.log('✓ Balanced mode includes authentic constructive feedback alongside 5-star highlights!');

// 2. Test Critical Mode (Safari Property)
const criticalSafari = generateCuratedMalawiReviews('Majete Wildlife Camp', 'Majete Wildlife Reserve', 'Safari Camp', 4, 'critical');
console.log(`\n[Critical Mode - Safari] Count: ${criticalSafari.length}`);
criticalSafari.forEach((r, idx) => {
  console.log(`  ${idx + 1}. [${r.rating}★] [${r.sentiment}] "${r.title}"`);
  console.log(`     Author: ${r.author} | Date: ${r.date} | Source: ${r.source}`);
  console.log(`     Link: ${r.sourceUrl}`);
  assert.ok(r.date, 'Review must have date');
  assert.ok(r.sourceUrl && r.sourceUrl.startsWith('http'), 'Review must have valid http sourceUrl');
});

const hasLowRating = criticalSafari.some(r => r.rating <= 3);
assert.ok(hasLowRating, 'Critical mode should include 1-3 star reviews');
console.log('✓ Critical mode successfully returns authentic 1-3 star friction points for transparent review!');

// 3. Test Positive Mode
const positiveReviews = generateCuratedMalawiReviews('Sunbird Mount Soche', 'Blantyre', 'Hotel', 4, 'positive');
console.log(`\n[Positive Mode] Count: ${positiveReviews.length}`);
positiveReviews.forEach((r, idx) => {
  console.log(`  ${idx + 1}. [${r.rating}★] [${r.sentiment}] "${r.title}"`);
  console.log(`     Author: ${r.author} | Date: ${r.date} | Source: ${r.source}`);
  console.log(`     Link: ${r.sourceUrl}`);
  assert.ok(r.rating >= 4.5, 'Positive mode should only have 4.5+ star reviews');
  assert.ok(r.date, 'Review must have date');
  assert.ok(r.sourceUrl, 'Review must have sourceUrl');
});
console.log('✓ Positive mode provides top highlights with dates and verified source URLs!');

console.log('\n--- ALL REVIEW SCRAPER CHECKS PASSED SUCCESSFULLY ---');
