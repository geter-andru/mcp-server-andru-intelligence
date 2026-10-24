import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listedTools, PAID_TOOLS } from '../src/catalog.js';

// Geter 2026-10-23: "I approve marking the 7 paid tools as not read-only". Claude runs read-only tools
// without asking; a tool that charges the person's wallet must ask first. No paid tool is read-only,
// and none is destructive (they change no data).

test('no paid tool is marked read-only, so Claude asks before each paid call', () => {
  const tools = listedTools();
  for (const name of PAID_TOOLS) {
    const t = tools.find((x) => x.name === name);
    assert.ok(t, `${name} is listed`);
    assert.equal(t.annotations.readOnlyHint, false, `${name} asks first`);
    assert.equal(t.annotations.destructiveHint, false, `${name} deletes nothing`);
  }
  assert.equal(PAID_TOOLS.size, 9); // get_pre_brief is free since 2026-10-24
});

test('free lookups stay read-only, so they still run without a prompt', () => {
  const tools = listedTools();
  for (const name of ['get_icp_fit_score', 'get_icp_profile', 'get_persona_profile', 'batch_fit_score', 'list_assets', 'whoami', 'quote']) {
    assert.equal(tools.find((x) => x.name === name).annotations.readOnlyHint, true, `${name} is read-only`);
  }
});
