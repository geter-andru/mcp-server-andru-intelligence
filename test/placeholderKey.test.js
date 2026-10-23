import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { realKey } from '../src/apiKey.js';

// 1.10.3: the README's Claude Desktop config used to say "ANDRU_API_KEY": "sk_live_your_key_here".
// With that set, 1.10.2 counted it as a key, never used the key from signup, and every call after
// signup failed with "Invalid API key". These run the package the way Claude Desktop does: over stdio,
// started with the env from the config.

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NEW_KEY = `sk_live_${'b'.repeat(64)}`;
const OLD_KEY = `sk_live_${'a'.repeat(64)}`;

async function fakeApi() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ path: req.url, key: req.headers['x-api-key'] || null, tool: body.tool });
      if (req.url === '/api/mcp/connect') { res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const payload = body.tool === 'signup_verify'
        ? { status: 'signed_in', message: 'Signed in.', apiKey: NEW_KEY, keyName: 'Claude Desktop' }
        : { status: 'ok', tool: body.tool };
      res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }] }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { calls, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

/** Start the package over stdio with this ANDRU_API_KEY (undefined = not set), as a client config would. */
async function startStdio(apiUrl, apiKey) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'andru-mcp-home-'));
  const env = { PATH: process.env.PATH, HOME: home, ANDRU_API_URL: apiUrl, ANDRU_CACHE: 'false' };
  if (apiKey !== undefined) env.ANDRU_API_KEY = apiKey;
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'src/index.js')], env, stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', (d) => { stderr += d; });
  const client = new Client({ name: 'claude-desktop-like', version: '1.0.0' });
  await client.connect(transport);
  return { client, stderr: () => stderr, close: async () => { await client.close().catch(() => {}); fs.rmSync(home, { recursive: true, force: true }); } };
}

test('only a key in the format Andru issues counts as a configured key', () => {
  assert.equal(realKey(NEW_KEY), NEW_KEY);
  assert.equal(realKey(`  ${NEW_KEY}\n`), NEW_KEY);
  assert.equal(realKey(`sk_test_${'0123456789abcdef'.repeat(4)}`), `sk_test_${'0123456789abcdef'.repeat(4)}`);
  for (const bad of ['sk_live_your_key_here', 'sk_live_...', 'sk_live_', 'undefined', '', '   ', null, undefined, `sk_live_${'b'.repeat(63)}`, `sk_live_${'B'.repeat(64)}`, `pk_live_${'b'.repeat(64)}`]) {
    assert.equal(realKey(bad), null, `${JSON.stringify(bad)} is not a key`);
  }
});

test('the old README placeholder counts as no key: signup works and the session then uses the new key', async () => {
  const api = await fakeApi();
  const s = await startStdio(api.url, 'sk_live_your_key_here');
  try {
    await s.client.callTool({ name: 'signup_start', arguments: { email: 'founder@example.com' } });
    assert.equal(api.calls.find((c) => c.tool === 'signup_start').key, null, 'the placeholder is never sent');
    const signedIn = await s.client.callTool({ name: 'signup_verify', arguments: { email: 'founder@example.com', code: '123456' } });
    assert.match(signedIn.content.at(-1).text, /^This session now uses the new key\./);
    await s.client.callTool({ name: 'whoami', arguments: {} });
    assert.equal(api.calls.find((c) => c.tool === 'whoami').key, NEW_KEY, 'the call after signup carries the new key');
    // Copy batch 10 K4, option B: a value was set, but it isn't a key.
    assert.match(s.stderr(), /ANDRU_API_KEY isn't an Andru API key \(those start with sk_live_\), so this session starts without one\. signup_start, signup_verify, signup_status and preview_company work now; the other tools work after signup\./);
  } finally {
    await s.close();
    await api.close();
  }
});

test('a real-format key is used as before, and a key from a new signup replaces it (a revoked key recovers)', async () => {
  const api = await fakeApi();
  const s = await startStdio(api.url, OLD_KEY);
  try {
    await s.client.callTool({ name: 'whoami', arguments: {} });
    assert.equal(api.calls.find((c) => c.tool === 'whoami').key, OLD_KEY);
    assert.doesNotMatch(s.stderr(), /No ANDRU_API_KEY yet/);
    await s.client.callTool({ name: 'signup_verify', arguments: { email: 'founder@example.com', code: '123456' } });
    await s.client.callTool({ name: 'get_pre_brief', arguments: { companyName: 'Acme' } });
    assert.equal(api.calls.find((c) => c.tool === 'get_pre_brief').key, NEW_KEY);
  } finally {
    await s.close();
    await api.close();
  }
});
