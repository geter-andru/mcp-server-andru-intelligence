import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { listedTools, TOOL_TITLES, SERVER_INSTRUCTIONS } from '../src/catalog.js';
import { TOOL_DESCRIPTIONS } from '../src/toolDescriptions.js';
import { createServer } from '../src/server.js';
import { AndruClient } from '../src/client.js';

// Copy batch 12 (Claude's Connectors Directory asks for a title on every tool and for server
// instructions): every listed tool has its approved title, and the server sends the instructions.

test('every listed tool has its approved title, and every title belongs to a listed tool', () => {
  const tools = listedTools();
  assert.equal(tools.length, 36); // no top-up tool since 2026-10-23; wellness and capability profile retired 2026-10-24; cancel_job and list_my_assets added 2026-10-27
  for (const t of tools) assert.equal(t.title, TOOL_TITLES[t.name], `${t.name} has its title`);
  assert.deepEqual(Object.keys(TOOL_TITLES).sort(), tools.map((t) => t.name).sort());
});

test('titles are short and plain: no prices', () => {
  for (const [name, title] of Object.entries(TOOL_TITLES)) {
    assert.ok(title.length <= 40, `${name}: ${title}`);
    assert.doesNotMatch(title, /\$\d|\bfree\b/i, `${name}: ${title}`);
  }
});

test('the server sends the approved instructions when a client connects, and the titles in tools/list', async () => {
  const server = createServer(new AndruClient(null, 'http://127.0.0.1:1'), { transport: 'stdio' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    assert.equal(client.getInstructions(), SERVER_INSTRUCTIONS);
    // Copy batch 21 S1 (approved by Geter 2026-10-27), the same words as the backend.
    assert.ok(SERVER_INSTRUCTIONS.startsWith("Andru is the person's enterprise buyer specialist: it already knows their buyers, and it scores companies and deals the same way every time. Use it when the person asks who their buyers are and what each one needs, whether a company or deal is a good fit, who is on a buying committee, how to prepare for a meeting with a buyer, how to make a first sales hire, which investors fit their company, or how their portfolio companies are doing with their buyers.\n\n"));
    assert.doesNotMatch(SERVER_INSTRUCTIONS, /go-to-market|\bGTM\b|revenue intelligence/i);
    assert.equal(TOOL_TITLES.generate_portfolio_brief, 'Brief on portfolio sales activity');
    assert.match(SERVER_INSTRUCTIONS, /Don't use Andru for general web research, for companies unrelated to the person's own sales or portfolio, or to send messages to anyone\.$/);
    const { tools } = await client.listTools();
    assert.equal(tools.find((t) => t.name === 'get_pre_brief').title, 'Prepare for a meeting');
  } finally {
    await client.close().catch(() => {});
  }
});

test('there is no top-up tool: money is added only on Andru\'s billing page (Geter 2026-10-23)', () => {
  assert.equal(listedTools().find((t) => t.name === 'get_topup_link'), undefined);
  assert.equal(TOOL_TITLES.get_topup_link, undefined);
});

// Copy batch 22 (approved by Geter 2026-10-27: "approve batch 22"): the same words as the backend.
test('batch 22: what Claude reads without the server instructions', () => {
  const by = Object.fromEntries(listedTools().map((t) => [t.name, t]));
  assert.ok(by.get_founder_context.description.includes("Andru is the person's enterprise buyer specialist."));
  assert.equal(TOOL_TITLES.get_revenue_memory, 'Search what Andru remembers');
  assert.equal(TOOL_TITLES.log_revenue_insight, 'Save what a deal taught');
  assert.ok(by.get_revenue_memory.description.startsWith('What Andru has learned about their buyers and deals:'));
  assert.ok(by.list_assets.description.includes("Searches Andru's catalog of 139 assets, from enterprise deals to hiring, fundraising and buying."));
  assert.ok(by.get_icp_profile.description.includes('the enterprise buyers who decide'));
  assert.ok(by.whoami.description.startsWith('Use this when the person asks what this key or connection can spend'));
  assert.equal(TOOL_DESCRIPTIONS.whoami, by.whoami.description);
});

// The Connectors Directory reads each tool's listing name from annotations.title (2026-10-27: 36/36
// tools flagged "Missing title annotation"). Same text as the top-level title, every listed tool.
test('every listed tool has annotations.title equal to its title, and keeps its hints', async () => {
  const listed = listedTools();
  assert.equal(listed.length, 36);
  for (const t of listed) {
    assert.ok(t.title, `${t.name} has a title`);
    assert.equal(t.annotations?.title, t.title, t.name);
  }
  assert.equal(listed.find((t) => t.name === 'preview_company').annotations.readOnlyHint, true);
  // Over the wire too.
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(new AndruClient(null, 'http://127.0.0.1:1')).connect(b);
  await client.connect(a);
  const { tools } = await client.listTools();
  for (const t of tools) assert.equal(t.annotations?.title, t.title, t.name);
  await client.close();
});
