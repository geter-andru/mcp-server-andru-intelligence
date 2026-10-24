import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listedTools, PAID_TOOLS, PAID_TOOL_LINE } from '../src/catalog.js';

// Copy batch 13 (approved by Geter 2026-10-23: "approve batch 13 with X yes"): descriptions carry no
// prices, no "Free." and no pointers to a paid asset; paid tools end with the neutral X line. The
// hosted address is mcp.andru-ai.com, added beside the onrender one (add, never swap).

const PRICE = /\$\d|\bFree\.|charged only|charged at|For a written comparison|For the full investor analysis/i;

test('no listed tool description states a price, "Free.", a charge, or a paid upgrade', () => {
  for (const t of listedTools()) assert.doesNotMatch(t.description.replace(PAID_TOOL_LINE, ''), PRICE, t.name);
});

test('paid tools, and only paid tools, end with "Paid. Check the price with quote before running."', () => {
  assert.equal(PAID_TOOL_LINE, 'Paid. Check the price with quote before running.');
  for (const t of listedTools()) assert.equal(t.description.endsWith(PAID_TOOL_LINE), PAID_TOOLS.has(t.name), t.name);
});

test('mcp.andru-ai.com is the first remote, and the onrender address stays (copy batch 13 L1)', () => {
  const remotes = JSON.parse(fs.readFileSync(new URL('../server.json', import.meta.url), 'utf8')).remotes.map((r) => r.url);
  assert.deepEqual(remotes, ['https://mcp.andru-ai.com/mcp', 'https://mcp-server-andru-intelligence.onrender.com/mcp']);
});
