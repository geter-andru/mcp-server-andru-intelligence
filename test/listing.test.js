// The listing says what the package does (Geter, 2026-10-08). Pins the tool count, the held-back CRM
// tools, the asset count and the registry limits, so a release can't ship a stale number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tools } from '../src/catalog.js';
import { PACKAGE_VERSION } from '../src/server.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const server = JSON.parse(read('server.json'));
const readme = read('README.md');

// 2026-10-24 (Geter): get_founder_wellness and get_capability_profile retired, 30 → 28.
test('30 tools, and the CRM tools are held back until CRM sync is ready', () => {
  assert.equal(tools.length, 30); // cancel_job and list_my_assets added 2026-10-27
  for (const retired of ['get_founder_wellness', 'get_capability_profile']) assert.ok(!tools.some((t) => t.name === retired), retired);
  const names = tools.map((t) => t.name);
  for (const held of ['get_syndication_status', 'trigger_syndication', 'sync_crm_deals']) assert.ok(!names.includes(held), held);
  assert.equal(new Set(names).size, names.length, 'tool names are unique');
});

// The README states the real tool count;
// the count wording was approved 2026-10-24 (listings, 41).
test('the README states the real tool count', () => {
  assert.match(readme, new RegExp(`\\b${tools.length} tools`));
});

test('the README states the real asset count and no retired claims', () => {
  assert.match(readme, /catalog of 139 assets/);
  assert.doesNotMatch(readme, /\b19 (tools|of these tools)\b|138|20 years|Operational Empathy|syndication|Chrome Web Store/i);
  for (const t of tools) assert.ok(readme.includes(`\`${t.name}\``), `README documents ${t.name}`);
});

test('server.json fits the MCP Registry schema and matches the package version', () => {
  assert.ok(server.description.length <= 100, 'description max 100');
  assert.ok(server.title.length <= 100, 'title max 100');
  assert.equal(server.version, pkg.version);
  for (const p of server.packages) assert.equal(p.version, pkg.version);
});

test('the server reports the package version', () => {
  assert.equal(PACKAGE_VERSION, pkg.version);
  assert.doesNotMatch(read('src/server.js'), /version: '\d+\.\d+\.\d+'/);
});

// README copy (approved by Geter 2026-10-27): no prices; they're on andru-ai.com/pricing.
test('the README names no prices, points to the pricing page, names no personas, and points at real commands', () => {
  assert.match(readme, /at the same prices as the platform: \[andru-ai\.com\/pricing\]\(https:\/\/andru-ai\.com\/pricing\)/);
  assert.doesNotMatch(readme.replace(/--arr "\$2M"/g, ''), /\$\d/);
  assert.doesNotMatch(readme, /revenue intelligence|go-to-market/i);
  assert.doesNotMatch(readme, /another 5|sk_live_your_key_here|sk_live_\.\.\./);
  assert.doesNotMatch(readme, /\$3 or less/);
  assert.doesNotMatch(readme, /named buyer personas|andru-intel usage/);
});

test('tool copy uses buyer-side language (approved by Geter, 2026-10-09)', () => {
  // Descriptions only. mbtiCategory is no longer listed (item 22, 2026-10-24); the backend still accepts it.
  const descriptions = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (k === 'description' && typeof x === 'string' ? descriptions.push(x) : walk(x));
  };
  walk(tools);
  assert.ok(descriptions.length > 30);
  // Parameter names in backticks (`mbtiCategory`) are identifiers, not the retired label.
  assert.doesNotMatch(descriptions.join('\n').replace(/`[^`]*`/g, ''), /MBTI|battle ?card|objection|landmine|where they'll attack|questions to plant/i);
  assert.doesNotMatch(readme, /MBTI|battle ?card|where they'll attack|questions to plant|anticipated objections/i);
  // Role-play prepares for the real meeting; it is not pitch practice (Geter, 2026-10-09).
  for (const text of [descriptions.join('\n'), readme]) assert.doesNotMatch(text, /practi[cs]e (your|a) pitch|pitch practice|push(es)? back|get the objections/i);
});

// Descriptions promise only what the tools return (audited 2026-10-15 by running each tool).
test('tool claims match what the backend returns', () => {
  const d = (n) => tools.find((t) => t.name === n).description;
  assert.doesNotMatch(d('get_competitive_positioning'), /what you have in common|discovery questions/i);
  assert.match(d('get_competitive_positioning'), /competitorFeatures/);
  assert.doesNotMatch(d('get_evaluation_criteria'), /actually/i);
  assert.doesNotMatch(readme, /what you have in common|app\.andru-ai\.com/);
  // 2026-10-16: prospects come from a web search for the user's product, not past winners.
  assert.doesNotMatch(d('discover_prospects'), /winners|15-30 seconds/i);
  assert.match(d('discover_prospects'), /links the page behind every piece of evidence/);
});
