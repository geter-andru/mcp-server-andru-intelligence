import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listedTools, PAID_TOOLS, SERVER_INSTRUCTIONS } from '../src/catalog.js';

// Copy batch 13 (approved by Geter 2026-10-23: "approve batch 13 with X yes"): descriptions carry no
// prices, no "Free." and no pointers to a paid asset. Copy batch 20 (approved by Geter 2026-10-27:
// "remove prices from results"): nothing listed steers to a price, and the X line is gone. The hosted address is mcp.andru-ai.com, added beside the onrender one (add, never swap).

const PRICE = /\$\d|\bFree\.|charged only|charged at|For a written comparison|For the full investor analysis/i;

test('no listed tool description states a price, "Free.", a charge, or a paid upgrade', () => {
  for (const t of listedTools()) assert.doesNotMatch(t.description, PRICE, t.name);
});

test('copy batch 20 D1–D5: no paid-tool line, no price steering, no prices in parameter hints', () => {
  const byName = Object.fromEntries(listedTools().map((t) => [t.name, t]));
  for (const t of listedTools()) {
    assert.ok(!t.description.includes('Check the price'), t.name);
    assert.doesNotMatch(JSON.stringify(t.inputSchema || {}), /\(\$\d+\)|\(free\)|\(\$5 for|charged only/, t.name);
  }
  // Paid tools keep the billing parameters.
  for (const n of PAID_TOOLS) assert.ok(byName[n].inputSchema.properties.idempotencyKey, n);
  assert.ok(byName.quote.description.startsWith('Use this when the person asks what a call would cost. Send the tool name and its arguments.'));
  assert.ok(byName.list_assets.description.includes('the business outcome, whether it needs'));
  assert.equal(byName.get_account_plan.inputSchema.properties.refresh.description, 'Build a new plan even if one from the last 30 days exists. Default false.');
  assert.equal(byName.simulate_buyer_persona.inputSchema.properties.mode.description, "meetings = the user's calendar meetings in the next 7 days. brief = the brief for a meeting (10 a day). opening = open a Deal Prep session from a brief_id, or with one buyer. reply = the founder's next message; speaker picks who answers. list = the user's six buyers.");
  assert.ok(SERVER_INSTRUCTIONS.includes("Lookups that read the person's own data are free. Some tools draw on the person's prepaid Andru wallet and are charged only when they deliver; quote gives the price if the person asks."));
});

test('mcp.andru-ai.com is the first remote, and the onrender address stays (copy batch 13 L1)', () => {
  const remotes = JSON.parse(fs.readFileSync(new URL('../server.json', import.meta.url), 'utf8')).remotes.map((r) => r.url);
  assert.deepEqual(remotes, ['https://mcp.andru-ai.com/mcp', 'https://mcp-server-andru-intelligence.onrender.com/mcp']);
});
