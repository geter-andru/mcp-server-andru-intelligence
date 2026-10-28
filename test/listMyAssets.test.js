import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listedTools } from '../src/catalog.js';

// list_my_assets and get_asset's asset_id as approved (copy batch 19; Geter 2026-10-27). Pinned here
// word for word, the same as the backend's src/mcp/toolTitles.js and src/mcp/toolDescriptions.js.
test('list_my_assets is listed with its approved title, description and read-only hints', () => {
  const t = listedTools().find((x) => x.name === 'list_my_assets');
  assert.ok(t, 'listed');
  assert.equal(t.title, 'List my saved assets');
  assert.equal(t.description, "Use this when the person asks what Andru has already built for them, or wants to open something they made earlier. Lists the assets saved to their Andru library: each one's name, when it was built, and whether it was built in part. Open one with get_asset and its asset_id.");
  assert.doesNotMatch(t.description, /\$\d|\bFree\.|charged/i);
  assert.deepEqual(t.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, title: 'List my saved assets' });
  assert.deepEqual(t.inputSchema.properties, {});
});

test('get_asset opens a saved asset by asset_id, or collects by job_id', () => {
  const t = listedTools().find((x) => x.name === 'get_asset');
  assert.ok(t.description.endsWith(' To open something already in the library, send its asset_id from list_my_assets instead.'));
  assert.equal(t.inputSchema.properties.asset_id.description, 'The asset_id from list_my_assets.');
  assert.ok(t.inputSchema.properties.job_id);
  assert.equal(t.inputSchema.required, undefined);
});

test('the README ICP lines say every account starts with a free cold-read ICP', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, /first ICP is free/);
  assert.equal(readme.match(/every account starts with a free cold-read ICP/g).length, 2);
});
