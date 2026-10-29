import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHttpApp, needsAccount } from '../src/httpApp.js';

// OAuth on the hosted server (AGENT_OAUTH_PLAN_2026-10-23, option B): with ANDRU_OAUTH=on, protected
// resource metadata names Andru's authorization server; a call that needs the person's account, sent
// with no credential, gets HTTP 401 pointing at it; an OAuth token is passed to the API as Bearer.

async function listen(server) {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server.address().port;
}
async function fakeApi() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ path: req.url, key: req.headers['x-api-key'] || null, authorization: req.headers.authorization || null, tool: body.tool });
      if (req.url === '/api/mcp/connect') { res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ status: 'ok', tool: body.tool }) }] }));
    });
  });
  return { calls, url: `http://127.0.0.1:${await listen(server)}`, close: () => new Promise((r) => server.close(r)) };
}
async function start(env) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const api = await fakeApi();
  const { app } = createHttpApp({ apiUrl: api.url, host: '127.0.0.1' });
  const httpServer = http.createServer(app);
  const port = await listen(httpServer);
  process.env = saved;
  return { api, port, close: async () => { httpServer.closeAllConnections?.(); await new Promise((r) => httpServer.close(r)); await api.close(); } };
}
const rpc = (port, body, headers = {}) => fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });

test('needsAccount: tool calls outside signup and preview, and resource reads', () => {
  assert.equal(needsAccount({ method: 'tools/call', params: { name: 'get_pre_brief' } }), true);
  assert.equal(needsAccount({ method: 'tools/call', params: { name: 'signup_start' } }), false);
  assert.equal(needsAccount({ method: 'tools/list' }), false);
  assert.equal(needsAccount({ method: 'initialize' }), false);
  assert.equal(needsAccount([{ method: 'tools/list' }, { method: 'resources/read' }]), true);
});

test('OAuth on: metadata names the authorization server; an unauthenticated protected call gets 401 with the pointer', async () => {
  const s = await start({ ANDRU_OAUTH: 'on', MCP_PUBLIC_URL: 'https://mcp.andru-ai.com/mcp' });
  try {
    const meta = await (await fetch(`http://127.0.0.1:${s.port}/.well-known/oauth-protected-resource`)).json();
    assert.deepEqual(meta, { resource: 'https://mcp.andru-ai.com/mcp', authorization_servers: ['https://api.andru-ai.com'], scopes_supported: ['andru:agent'], bearer_methods_supported: ['header'] });
    const r = await rpc(s.port, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_pre_brief', arguments: {} } });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('www-authenticate'), 'Bearer resource_metadata="https://mcp.andru-ai.com/.well-known/oauth-protected-resource", scope="andru:agent"');
    assert.equal(s.api.calls.length, 0, 'nothing reached the API');
  } finally { await s.close(); }
});

test('OAuth on: listing and signup work without signing in, and an OAuth token reaches the API as Bearer', async () => {
  const s = await start({ ANDRU_OAUTH: 'on' });
  const client = new Client({ name: 'claude-ai', version: '1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${s.port}/mcp`)));
    const { tools } = await client.listTools();
    assert.ok(tools.length > 30);
    await client.callTool({ name: 'signup_status', arguments: { requestId: 'r' } });
    assert.equal(s.api.calls.find((c) => c.tool === 'signup_status').authorization, null);
    await client.close();

    const authed = new Client({ name: 'claude-ai', version: '1' });
    await authed.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${s.port}/mcp`), { requestInit: { headers: { Authorization: 'Bearer eyJ.oauth.token' } } }));
    await authed.callTool({ name: 'get_pre_brief', arguments: { companyName: 'a logistics software company' } });
    const call = s.api.calls.find((c) => c.tool === 'get_pre_brief');
    assert.equal(call.authorization, 'Bearer eyJ.oauth.token');
    assert.equal(call.key, null);
    await authed.close();
  } finally { await s.close(); }
});

test('OAuth off (today): no metadata, and an unauthenticated call is answered by the tool layer, not a 401', async () => {
  const s = await start({ ANDRU_OAUTH: 'off' });
  try {
    assert.equal((await fetch(`http://127.0.0.1:${s.port}/.well-known/oauth-protected-resource`)).status, 404);
    const r = await rpc(s.port, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_pre_brief', arguments: {} } });
    assert.notEqual(r.status, 401);
  } finally { await s.close(); }
});

test('sign-in-first address: with no credential even initialize gets the 401; with a token it works; /mcp is unchanged', async () => {
  const s = await start({ ANDRU_OAUTH: 'on', MCP_PUBLIC_URL: 'https://mcp.andru-ai.com/mcp' });
  try {
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'cursor', version: '1' } } };
    const r = await fetch(`http://127.0.0.1:${s.port}/mcp?signin=first`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(init) });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('www-authenticate'), 'Bearer resource_metadata="https://mcp.andru-ai.com/.well-known/oauth-protected-resource", scope="andru:agent"');
    const body = await r.json();
    assert.equal(body.error.message, 'Sign in with your Andru account to connect.');
    assert.equal(body.id, 1);

    assert.equal((await rpc(s.port, init)).status, 200, '/mcp still opens a session with no credential');

    const authed = new Client({ name: 'cursor', version: '1' });
    await authed.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${s.port}/mcp?signin=first`), { requestInit: { headers: { Authorization: 'Bearer eyJ.oauth.token' } } }));
    assert.ok((await authed.listTools()).tools.length > 30);
    await authed.callTool({ name: 'get_pre_brief', arguments: { companyName: 'a logistics software company' } });
    assert.equal(s.api.calls.find((c) => c.tool === 'get_pre_brief').authorization, 'Bearer eyJ.oauth.token');
    await authed.close();

    const keyed = new Client({ name: 'cursor', version: '1' });
    await keyed.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${s.port}/mcp?signin=first`), { requestInit: { headers: { 'X-API-Key': 'sk_test_abc' } } }));
    assert.ok((await keyed.listTools()).tools.length > 30, 'an API key works there too');
    await keyed.close();
  } finally { await s.close(); }
});

test('sign-in-first address with OAuth off: behaves like /mcp (no sign-in that could not finish)', async () => {
  const s = await start({ ANDRU_OAUTH: 'off' });
  try {
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'cursor', version: '1' } } };
    const r = await fetch(`http://127.0.0.1:${s.port}/mcp?signin=first`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(init) });
    assert.equal(r.status, 200);
  } finally { await s.close(); }
});
