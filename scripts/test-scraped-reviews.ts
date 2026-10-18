import { handleCuratedActionFallback } from '../server/aiService';
import assert from 'node:assert';

// When no AI provider can scrape reviews, the fallback must return an empty list —
// never fabricated reviews (AGENTS.md: no scripted AI; only onboarded properties exist).
console.log('--- Review fallback never fabricates reviews ---');

for (const name of ['Example Lakeside Cottage', 'Example Safari Camp', 'Example City Hotel']) {
  const result = handleCuratedActionFallback({
    action: 'scrape_reviews',
    entityType: 'property',
    details: { name, location: 'Malawi' },
  });
  assert.deepStrictEqual(result.data, [], `${name}: fallback must return no reviews`);
  assert.strictEqual(JSON.parse(result.text).length, 0, `${name}: fallback text must be an empty list`);
  console.log(`ok   ${name}: no fabricated reviews`);
}

console.log('\nAll checks passed');
