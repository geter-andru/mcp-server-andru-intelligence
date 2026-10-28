import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listedTools } from '../src/catalog.js';

// cancel_job as approved (copy batch 17 C1, C2-trim, C3; Geter 2026-10-27). The connector can't
// import the backend, so the words are pinned here: the same title and description as the backend's
// src/mcp/toolTitles.js and src/mcp/toolDescriptions.js. No charge wording (batch 13 M1).
test('cancel_job is listed with its approved title, description and hints', () => {
  const t = listedTools().find((x) => x.name === 'cancel_job');
  assert.ok(t, 'listed');
  assert.equal(t.title, 'Stop an asset build');
  assert.equal(t.description, "Use this when the person wants to stop an asset that generate_asset is still building. Send the job_id. What it had written is discarded. A build that already finished stays as it is; collect it with get_asset. Briefs and account plans can't be stopped.");
  assert.doesNotMatch(t.description, /\$\d|\bFree\.|charged/i);
  assert.deepEqual(t.annotations, { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false, title: 'Stop an asset build' });
  assert.deepEqual(t.inputSchema.required, ['job_id']);
  assert.ok(!('maxAmountCents' in t.inputSchema.properties), 'free: no billing controls');
});
