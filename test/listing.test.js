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

test('30 tools, and the CRM tools are held back until CRM sync is ready', () => {
  assert.equal(tools.length, 30);
  const names = tools.map((t) => t.name);
  for (const held of ['get_syndication_status', 'trigger_syndication', 'sync_crm_deals']) assert.ok(!names.includes(held), held);
  assert.equal(new Set(names).size, names.length, 'tool names are unique');
});

test('the README states the real counts and no retired claims', () => {
  assert.match(readme, new RegExp(`${tools.length} tools`));
  assert.match(readme, /catalog of 139 assets/);
  assert.doesNotMatch(readme, /\b(28|19) (tools|of these tools)\b|138|20 years|Operational Empathy|syndication|Chrome Web Store/i);
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

test('the README says free calls are per channel, names no personas, and points at real commands', () => {
  assert.doesNotMatch(readme, /shared (across|with) (MCP|A2A)/i);
  assert.match(readme, /5 free calls a day on MCP and another 5 on A2A/);
  assert.doesNotMatch(readme, /named buyer personas|andru-intel usage/);
});
