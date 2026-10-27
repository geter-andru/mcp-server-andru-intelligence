import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttpApp, retryAfterSeconds, countedBy, tooManyMessage, SIGN_IN_MESSAGE } from '../src/httpApp.js';
import { NO_KEY_NEXT_ACTION, SETUP_URL, SETUP_DOCS_URL } from '../src/server.js';
import { listedTools } from '../src/catalog.js';

// The hosted server's refusals say what to do next (copy batch 17 A1 and B1, approved by Geter
// 2026-10-27): the sign-in 401 names signup_start for a client that uses a key, and the 429 says how
// long to wait, in the Retry-After header and the body, as the backend's 429 does (batch 11 R3/R4).

async function listen(server) {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server.address().port;
}
async function start(env) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const api = http.createServer((req, res) => { res.writeHead(204); res.end(); });
  const apiPort = await listen(api);
  const { app } = createHttpApp({ apiUrl: `http://127.0.0.1:${apiPort}`, host: '127.0.0.1' });
  const server = http.createServer(app);
  const port = await listen(server);
  process.env = saved;
  return { port, close: async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await new Promise((r) => api.close(r)); } };
}
const rpc = (port, body, headers = {}) => fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });

test('A1: the sign-in 401 keeps its header and names the next call, the setup page and the docs', async () => {
  const s = await start({ ANDRU_OAUTH: 'on', MCP_PUBLIC_URL: 'https://mcp.andru-ai.com/mcp' });
  try {
    const r = await rpc(s.port, { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'get_pre_brief', arguments: {} } });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('www-authenticate'), 'Bearer resource_metadata="https://mcp.andru-ai.com/.well-known/oauth-protected-resource", scope="andru:agent"');
    const body = await r.json();
    assert.equal(body.id, 7);
    assert.equal(body.error.code, -32001);
    assert.equal(body.error.message, "Sign in to Andru to use this tool. Or set up a key now: call signup_start with the person's email. Andru emails them a code and an Approve button.");
    assert.deepEqual(body.error.data, { next_action: { tool: 'signup_start', arguments: { email: "<the person's email>" } }, setup: 'https://platform.andru-ai.com/settings/developer', docs: 'https://andru-ai.com/docs/mcp' });
  } finally { await s.close(); }
});

test('A1 reuses the approved pieces word for word', () => {
  assert.ok(SIGN_IN_MESSAGE.startsWith('Sign in to Andru to use this tool. '), 'batch 14 E1');
  assert.ok(SIGN_IN_MESSAGE.endsWith("call signup_start with the person's email. Andru emails them a code and an Approve button."), 'batch 1 C3');
  assert.deepEqual(NO_KEY_NEXT_ACTION, { tool: 'signup_start', arguments: { email: "<the person's email>" } });
  assert.equal(SETUP_URL, 'https://platform.andru-ai.com/settings/developer');
  assert.equal(SETUP_DOCS_URL, 'https://andru-ai.com/docs/mcp');
});

test('B1: over the limit, the 429 says how long to wait, in the header and the body', async () => {
  const s = await start({});
  try {
    const call = () => rpc(s.port, { jsonrpc: '2.0', id: 9, method: 'tools/list' }, { 'X-API-Key': 'sk_test_limit' });
    for (let i = 0; i < 100; i += 1) await (await call()).arrayBuffer();
    const r = await call();
    assert.equal(r.status, 429);
    const wait = Number(r.headers.get('retry-after'));
    assert.ok(wait > 0 && wait <= 900, `Retry-After ${wait}`);
    const body = await r.json();
    assert.equal(body.id, 9);
    assert.equal(body.error.code, -32000);
    assert.deepEqual(body.error.data, { code: 'RATE_LIMITED', retry_after_seconds: wait });
    assert.equal(body.error.message, `Too many requests from this key. Try again in ${wait} seconds.`);
  } finally { await s.close(); }
});

test('B1: the word says what was counted, and the wait comes from the window', () => {
  assert.equal(countedBy({ auth: { apiKey: 'k' } }), 'key');
  assert.equal(countedBy({ auth: { bearer: 't' } }), 'connection');
  assert.equal(countedBy({ auth: {} }), 'address');
  assert.equal(tooManyMessage('address', 312), 'Too many requests from this address. Try again in 312 seconds.', 'batch 11 R3 verbatim');
  const now = Date.now();
  assert.equal(retryAfterSeconds({ rateLimit: { resetTime: new Date(now + 41_500) } }, now), 42);
  assert.equal(retryAfterSeconds({ rateLimit: { resetTime: new Date(now - 5) } }, now), 1);
  assert.equal(retryAfterSeconds({}, now), 900);
});

test('F: set_product_context says it replaces data (destructiveHint true)', () => {
  const t = listedTools().find((x) => x.name === 'set_product_context');
  assert.equal(t.annotations.destructiveHint, true);
  assert.equal(t.annotations.readOnlyHint, false);
});

test('a key is never read from the URL; the X-API-Key header still works', async () => {
  const s = await start({ ANDRU_OAUTH: 'on', MCP_PUBLIC_URL: 'https://mcp.andru-ai.com/mcp' });
  try {
    const body = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_pre_brief', arguments: {} } };
    const inUrl = await fetch(`http://127.0.0.1:${s.port}/mcp?ANDRU_API_KEY=sk_test_in_url`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });
    assert.equal(inUrl.status, 401, 'a key in the URL counts as no key');
    await inUrl.arrayBuffer();
    const inHeader = await rpc(s.port, body, { 'X-API-Key': 'sk_test_in_header' });
    assert.notEqual(inHeader.status, 401);
    await inHeader.arrayBuffer();
  } finally { await s.close(); }
});

test('Smithery sends the key as the X-API-Key header, not in the URL', async () => {
  const { readFile } = await import('node:fs/promises');
  const cfg = JSON.parse(await readFile(new URL('../smithery-config.json', import.meta.url), 'utf8'));
  assert.deepEqual(cfg.properties.ANDRU_API_KEY['x-from'], { header: 'x-api-key' });
});
