/**
 * AI model selection & token budget checks.
 *
 * Runs offline against a mocked provider API (no keys or network needed):
 * - the registry picks the cheapest capable model of the newest generation
 * - a deprecated model (404 "no longer available") is retired and the call
 *   moves to the next available model, honouring the provider's suggestion
 * - outdated pinned models and unreachable catalogs resolve to current models
 * - identical requests are served from cache without a second API call
 * - operations chat prompts stay within their token budgets
 *
 * Usage: npx tsx scripts/check-ai-models.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-models-check-'));
process.chdir(workDir); // registry and config files are written under ./data
process.env.GEMINI_API_KEY = 'test-gemini-key-123456';
for (const k of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'GROQ_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY', 'GEMINI_KEY', 'VITE_GEMINI_API_KEY']) {
  delete process.env[k];
}

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Mock Gemini API
// ---------------------------------------------------------------------------
const GEMINI_CATALOG = [
  'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
  'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.8-pro-preview',
  'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-embedding-001', 'gemini-3.8-flash-image',
];
/** Models that answer 404 as retired, with the replacement Google suggests. */
const retiredOnServer: Record<string, string> = {
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
};
/** Models answering 429 with Google's quota message. */
const rateLimitedOnServer = new Set<string>();
let catalogReachable = true;
/** When true, models answer 400 "invalid argument" to any thinkingConfig (as some Gemini 3 models do). */
let rejectThinkingConfig = false;
let lastGenerateBody: any = null;
const generateCalls: string[] = [];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input?.url || input);
  if (url.includes('generativelanguage.googleapis.com/v1beta/models?')) {
    if (!catalogReachable) return json(500, { error: { message: 'catalog down' } });
    return json(200, {
      models: GEMINI_CATALOG.map(id => ({
        name: `models/${id}`,
        displayName: id,
        supportedGenerationMethods: id.includes('embedding') ? ['embedContent'] : ['generateContent'],
      })),
    });
  }
  const m = url.match(/models\/([^:]+):generateContent/);
  if (m) {
    const model = m[1];
    generateCalls.push(model);
    if (retiredOnServer[model]) {
      return json(404, {
        error: {
          code: 404,
          message: `This model models/${model} is no longer available to new users. Please update your code to use models/${retiredOnServer[model]} for the latest features and improvements. We recommend you to use the Interactions API (https://ai.google.dev/gemini-api/docs/get-started).`,
        },
      });
    }
    if (rateLimitedOnServer.has(model)) {
      return json(429, {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: `You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15, model: ${model}\nPlease retry in 37.5s.`,
        },
      });
    }
    const body = JSON.parse(init?.body || '{}');
    lastGenerateBody = body;
    if (rejectThinkingConfig && body?.generationConfig?.thinkingConfig) {
      return json(400, { error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } });
    }
    const prompt = body?.contents?.[0]?.parts?.[0]?.text || '';
    return json(200, { candidates: [{ content: { parts: [{ text: `Answer from ${model}: ${prompt.slice(0, 20)}` }] } }] });
  }
  throw new Error(`Unexpected fetch in test: ${url}`);
}) as typeof fetch;

const load = (rel: string) => import(pathToFileURL(path.join(repoRoot, rel)).href);

async function main() {
  const registry = await load('server/modelRegistry.ts');
  const aiConfig = await load('server/aiConfig.ts');
  const aiService = await load('server/aiService.ts');
  const ops = await load('server/opsPrompt.ts');

  console.log('\n1. Ranking picks the cheapest capable model of the newest generation');
  const mk = (ids: string[]) => ids.map(id => ({ id, displayName: id, description: '' }));
  const top = (provider: string, ids: string[]) => registry.rankModels(provider, mk(ids)).find((m: any) => m.isLatestGeneration && m.stable)?.id;
  check('Gemini -> gemini-3.5-flash-lite', top('gemini', GEMINI_CATALOG) === 'gemini-3.5-flash-lite', top('gemini', GEMINI_CATALOG));
  check('OpenAI -> newest mini, skips nano/realtime/gpt-4o', top('openai', ['gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1-mini', 'gpt-realtime']) === 'gpt-5.1-mini');
  check('Anthropic -> claude-haiku-5-5', top('anthropic', ['claude-3-5-haiku-20241022', 'claude-haiku-4-5-20251001', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']) === 'claude-haiku-5-5');
  check('Groq -> Llama 4 Scout, skips 8B', top('groq', ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']) === 'meta-llama/llama-4-scout-17b-16e-instruct');
  check('Mistral -> mistral-small-latest', top('mistral', ['mistral-large-latest', 'mistral-small-latest', 'ministral-8b-latest', 'codestral-latest']) === 'mistral-small-latest');
  const hint = registry.parseReplacementHint('Please update your code to use models/gemini-3.5-flash-lite for the latest features. We recommend you to use the Interactions API');
  check('Replacement hint parsed from Google error', hint === 'gemini-3.5-flash-lite', String(hint));

  console.log('\n2. Catalog unreachable -> evergreen fallbacks, never old generations');
  catalogReachable = false;
  await aiConfig.refreshProviderCatalog('gemini', true);
  const offlinePick = registry.resolveModel('gemini', 'auto');
  check('Auto resolves to a current fallback with no catalog', registry.FALLBACK_MODELS.gemini.includes(offlinePick), offlinePick);
  check('Pinned gemini-2.0-flash is treated as outdated', registry.resolveModel('gemini', 'gemini-2.0-flash') !== 'gemini-2.0-flash');
  catalogReachable = true;
  await aiConfig.refreshProviderCatalog('gemini', true);
  check('Catalog discovered once reachable', registry.hasCatalog('gemini'));
  check('Auto resolves to gemini-3.5-flash-lite', registry.resolveModel('gemini', 'auto') === 'gemini-3.5-flash-lite', registry.resolveModel('gemini', 'auto'));
  check('Pinned current model is honoured', registry.resolveModel('gemini', 'gemini-3.8-flash') === 'gemini-3.8-flash');
  check('Pinned older-generation model is replaced', registry.resolveModel('gemini', 'gemini-2.5-flash') === 'gemini-3.5-flash-lite');

  console.log('\n3. Deprecated model -> retired, request moves to the next available model');
  // Now Google retires the auto pick itself and points at 3.8 Flash.
  retiredOnServer['gemini-3.5-flash-lite'] = 'gemini-3.8-flash';
  generateCalls.length = 0;
  const req = { action: 'draft', entityType: 'property', details: { name: 'Test Lodge', location: 'Cape Maclear' } };
  const first = await aiService.executeAIGeneration(req, 'gemini');
  check('First call tried the auto pick first', generateCalls[0] === 'gemini-3.5-flash-lite', generateCalls.join(' > '));
  check('Fell through to gemini-3.8-flash and succeeded', first.text.startsWith('Answer from gemini-3.8-flash'), first.text);
  check('Result reports the model that actually answered', first.model === 'gemini-3.8-flash', first.model);
  check('Retired model persisted', registry.isModelRetired('gemini', 'gemini-3.5-flash-lite'));
  const saved = JSON.parse(fs.readFileSync(path.join(workDir, 'data', 'model_registry.json'), 'utf-8'));
  check('Retirement written to data/model_registry.json', saved.retired?.gemini?.includes('gemini-3.5-flash-lite'));
  check('Auto now resolves past the retired model', registry.resolveModel('gemini', 'auto') !== 'gemini-3.5-flash-lite', registry.resolveModel('gemini', 'auto'));

  generateCalls.length = 0;
  await aiService.executeAIGeneration({ ...req, details: { name: 'Another Lodge', location: 'Liwonde' } }, 'gemini');
  check('Next request skips the retired model entirely', !generateCalls.includes('gemini-3.5-flash-lite'), generateCalls.join(' > '));

  console.log('\n4. Identical requests are answered from cache');
  generateCalls.length = 0;
  await aiService.executeAIGeneration({ ...req, details: { name: 'Another Lodge', location: 'Liwonde' } }, 'gemini');
  check('Repeat request made no API call', generateCalls.length === 0, generateCalls.join(' > '));

  console.log('\n5. Rate limits switch models immediately instead of waiting');
  rateLimitedOnServer.add('gemini-3.8-flash');
  generateCalls.length = 0;
  const t0 = Date.now();
  const limited = await aiService.executeAIGeneration({ ...req, details: { name: 'Rate Limit Lodge', location: 'Nkhata Bay' } }, 'gemini');
  const elapsed = Date.now() - t0;
  check('429 on the current pick moved to another model', generateCalls[0] === 'gemini-3.8-flash' && generateCalls.length === 2, generateCalls.join(' > '));
  check('No inline backoff wait for a 37s quota reset (< 12s total)', elapsed < 12_000, `${elapsed}ms`);
  check('Answer came from a model with headroom', limited.text.startsWith('Answer from') && !limited.text.includes('3.8-flash'), limited.text);
  generateCalls.length = 0;
  await aiService.executeAIGeneration({ ...req, details: { name: 'Second Lodge', location: 'Mzuzu' } }, 'gemini');
  check('Rate-limited model is skipped on the next request', !generateCalls.includes('gemini-3.8-flash'), generateCalls.join(' > '));

  console.log('\n6. Greetings are short, varied and data-aware');
  const greet = await load('src/lib/conciergeGreeting.ts');
  const quiet = greet.buildConciergeGreeting({ name: 'Grace', propertyNames: ['Esthers Guest House'], todayStr: '2026-10-14', hour: 9 });
  const busy = greet.buildConciergeGreeting({ propertyNames: ['Esthers Guest House'], todayStr: '2026-10-14', hour: 15, bookings: [
    { checkIn: '2026-10-14', checkOut: '2026-10-16', status: 'confirmed' },
    { checkIn: '2026-10-12', checkOut: '2026-10-14', status: 'confirmed' },
    { checkIn: '2026-10-20', checkOut: '2026-10-22', status: 'pending' },
  ] });
  console.log(`      quiet: "${quiet}"\n      busy:  "${busy}"`);
  check('No canned Chichewa opener or "peaceful night"', !/mwauka|peaceful night/i.test(quiet + busy));
  check('Greeting reports real numbers', busy.includes('1 arrival') && busy.includes('1 check-out') && busy.includes('1 booking waiting'));
  check('Greeting stays short (< 160 chars)', quiet.length < 160 && busy.length < 160, `${quiet.length}/${busy.length}`);

  console.log('\n7. Ulendo knows who is signed in and answers through the AI');
  rejectThinkingConfig = true;
  const swarm = await load('server/aiSwarm.ts');
  const intent = await load('src/lib/queryIntent.ts');
  const esthers = {
    id: 'h-esthers', name: 'Esthers Guest House- Boat house', location: 'Salima', status: 'approved',
    ownerName: 'Esther Banda', ownerEmail: 'esther@example.com', managerId: 'unassigned',
    rooms: [{ id: 'r1', name: 'Boat Room', priceUSD: 60, priceMWK: 105000 }],
  };
  const adminCtx = { currentDateStr: '2026-10-14', currentTimeStr: '12:00', properties: [esthers, { id: 'h2', name: 'Kaya Mawa', location: 'Likoma', rooms: [] }], bookings: [] };
  const adminReq = { userRole: 'admin', message: 'Not bad, who owns esthers', intent: 'greeting_or_chat', history: [{ role: 'user', content: 'How are you' }, { role: 'assistant', content: 'All good here.' }], context: adminCtx };
  generateCalls.length = 0;
  const opsReply = await aiService.executeOperationsAssistantChat(adminReq);
  check('Gemini 400 "invalid argument" retried without optional params', generateCalls.length >= 2 && generateCalls[0] === generateCalls[1], generateCalls.join(' > '));
  check('Reply came from the AI, not the local fallback', opsReply.provider === 'gemini' && opsReply.reply.startsWith('Answer from'), `${opsReply.provider}: ${opsReply.reply.slice(0, 60)}`);
  const sentPrompt = lastGenerateBody?.contents?.[0]?.parts?.[0]?.text || '';
  check('"Not bad, who owns esthers" gets the full context, not small talk', sentPrompt.includes('Esther Banda'));
  check('Prompt tells the AI the user is the global administrator', sentPrompt.includes('Global administrator'));
  generateCalls.length = 0;
  await aiService.executeOperationsAssistantChat({ ...adminReq, message: 'Which rooms does Kaya Mawa have?' });
  check('Model remembers which options it accepts (single call next time)', generateCalls.length === 1, generateCalls.join(' > '));
  rejectThinkingConfig = false;

  console.log('\n8. Local fallback is role-aware and stays on topic');
  check('"hi" and "how are you" are small talk', intent.isPureSmallTalk('hi') && intent.isPureSmallTalk('How are you?') && intent.isPureSmallTalk('not bad, and you?'));
  check('"Not bad, who owns esthers" is a question', !intent.isPureSmallTalk('Not bad, who owns esthers'));
  const owner = swarm.executeDeterministicSwarmReply(adminReq);
  check('Fallback answers ownership from the data', owner.reply.includes('Esther Banda') && owner.reply.includes('Manager:'), owner.reply);
  const howAdmin = swarm.executeDeterministicSwarmReply({ ...adminReq, message: 'How are you', history: [] });
  check('Admin small talk refers to the platform, not one stay', howAdmin.reply.includes('the platform') && !howAdmin.reply.includes('Esthers'), howAdmin.reply);
  const car = swarm.executeDeterministicSwarmReply({ ...adminReq, message: 'Help me buy a used car' });
  check('Off-topic request gets a friendly pivot back to stays', /transport|shuttle|4x4/i.test(car.reply), car.reply);
  const managerOwn = swarm.executeDeterministicSwarmReply({ ...adminReq, userRole: 'hotel_manager', message: 'who runs esthers?', context: { ...adminCtx, properties: [esthers] } });
  check('Manager sees their own property as managed by them', managerOwn.reply.includes('Managed by:** you'), managerOwn.reply);
  const unknown = swarm.executeDeterministicSwarmReply({ ...adminReq, message: 'What is our occupancy forecast strategy?' });
  check('Unanswerable question gets an honest reply, not a greeting', /can't reach the AI service/.test(unknown.reply), unknown.reply);

  console.log('\n9. Operations chat prompt budgets');
  const property = (i: number) => ({
    id: `h${i}`, name: ['Kaya Mawa', 'Pumulani Lodge', 'Mvuu Camp', 'Zomba Forest Lodge'][i % 4] + (i > 3 ? ` ${i}` : ''),
    description: 'A lakeside lodge with chalets, a pool and a restaurant overlooking Lake Malawi.'.repeat(2),
    location: 'Lake Malawi', category: 'Lodge', status: 'approved', isOnline: true,
    infrastructure: { powerSource: 'Solar', waterSource: 'Borehole', wifiSSID: 'Lodge', wifiPassword: 'secret' },
    crew: [{ name: 'Chikondi', role: 'Chef' }], amenities: ['Pool', 'Wi-Fi', 'Restaurant'],
    reviewsSummary: { count: 3, averageRating: 4.6, recentReviews: [{ author: 'Ann', rating: 5, comment: 'Beautiful sunsets and great food.' }] },
    restaurant: { enabled: true, name: 'Lakeside', menuSections: [{ name: 'Mains', items: Array.from({ length: 12 }, (_, k) => ({ name: `Chambo ${k}`, priceUSD: 15, priceMWK: 26000 })) }] },
    conferences: [{ id: 'c1', name: 'Baobab Hall', capacity: 60, dayRateUSD: 300 }],
    rooms: Array.from({ length: 5 }, (_, k) => ({ id: `r${i}-${k}`, name: `Chalet ${k}`, priceUSD: 120, priceMWK: 210000, maxGuests: 2, quantity: 3, amenities: ['Fan', 'Mosquito net'], description: 'Lake view chalet.' })),
  });
  const context = {
    currentDateStr: '2026-10-14', currentTimeStr: '09:30',
    properties: Array.from({ length: 12 }, (_, i) => property(i)),
    bookings: Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, hotelId: `h${i % 12}`, hotelName: 'Lodge', guestName: `Guest ${i}`, guestEmail: 'g@example.com', checkIn: '2026-10-20', checkOut: '2026-10-23', status: 'confirmed', total: 360 })),
  };
  const build = (message: string, agent: string, extra: any = {}) =>
    ops.buildOperationsChatPrompts({ userRole: 'hotel_manager', message, context, ...extra }, 'Grace', agent);
  const size = (p: any) => p.systemPrompt.length + p.userPrompt.length;
  const legacySystemChars = 38_800; // the previous fixed system prompt alone
  const wifi = build('What is the wifi password at Kaya Mawa?', 'operations_specialist');
  const rate = build('Raise the Chalet 1 rate at Pumulani Lodge to $140', 'revenue_specialist');
  const audit = build('Give me a full audit of all properties', 'swarm_coordinator');
  console.log(`      wifi question: ${size(wifi)} chars, rate change: ${size(rate)} chars, full audit: ${size(audit)} chars (old system prompt alone: ${legacySystemChars})`);
  check('Focused question uses under a quarter of the old system prompt', size(wifi) < legacySystemChars / 4, String(size(wifi)));
  check('Focused question excludes unrelated menus and other properties', !wifi.userPrompt.includes('Chambo 3') && !wifi.userPrompt.includes('Baobab Hall'));
  check('Focused question includes the answer (Wi-Fi password)', wifi.userPrompt.includes('secret'));
  check('Guest contact details only sent when asked', !rate.userPrompt.includes('g@example.com'));
  check('Change request loads action proposal schemas', rate.systemPrompt.includes('update_room_price'));
  check('Questions without a change skip action schemas', !wifi.systemPrompt.includes('update_room_price'));
  check('Full audit still gets the full context', audit.userPrompt.includes('Baobab Hall') && audit.userPrompt.includes('Chambo 3'));
  check('Volatile content is at the end (cache-friendly prefix)', wifi.userPrompt.indexOf('NOW:') > wifi.userPrompt.indexOf('PROPERTIES IN SCOPE'));
}

main()
  .catch(err => {
    failed++;
    console.error(err);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(failed > 0 ? 1 : 0);
  });
