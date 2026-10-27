import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttpApp, SESSION_NOT_FOUND_MESSAGE } from '../src/httpApp.js';

// An unknown session id gets 404 (Streamable HTTP), so the client starts a new session. Sessions are
// in memory and every deploy drops them; before this, the request got 400 "Server not initialized"
// and the client gave up (Geter 2026-10-27: "fix the session bug").

async function listen(server) {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server.address().port;
}
async function start(env = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const api = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (req.url === '/api/mcp/connect') { res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: [{ type: 'text', text: '{"status":"ok"}' }] }));
    });
  });
  const apiPort = await listen(api);
  const { app } = createHttpApp({ apiUrl: `http://127.0.0.1:${apiPort}`, host: '127.0.0.1' });
  const httpServer = http.createServer(app);
  const port = await listen(httpServer);
  process.env = saved;
  return {
    port,
    close: async () => {
      httpServer.closeAllConnections?.();
      await new Promise((r) => httpServer.close(r));
      await new Promise((r) => api.close(r));
    },
  };
}
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
const send = (port, method, body, headers = {}) => fetch(`http://127.0.0.1:${port}/mcp`, {
  method, headers: { ...HEADERS, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const INIT = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } };
const STALE = { 'mcp-session-id': 'a-session-from-before-the-deploy' };
const notFound = (id) => ({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found. Start a new session with initialize.' }, id });

test('the approved message, word for word', () => {
  assert.equal(SESSION_NOT_FOUND_MESSAGE, 'Session not found. Start a new session with initialize.');
});

test('an unknown session id gets 404 on POST, GET and DELETE', async () => {
  const s = await start();
  try {
    let r = await send(s.port, 'POST', { jsonrpc: '2.0', id: 7, method: 'tools/list' }, STALE);
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), notFound(7));
    r = await send(s.port, 'GET', null, STALE);
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), notFound(null));
    r = await send(s.port, 'DELETE', null, STALE);
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), notFound(null));
  } finally { await s.close(); }
});

test('after the 404 the client re-initializes and carries on', async () => {
  const s = await start();
  try {
    // An initialize that still sends the stale id starts a new session too.
    for (const headers of [{}, STALE]) {
      const init = await send(s.port, 'POST', INIT, headers);
      assert.equal(init.status, 200);
      const sid = init.headers.get('mcp-session-id');
      assert.ok(sid && sid !== STALE['mcp-session-id']);
      await init.text();
      await (await send(s.port, 'POST', { jsonrpc: '2.0', method: 'notifications/initialized' }, { 'mcp-session-id': sid })).text();
      const list = await send(s.port, 'POST', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { 'mcp-session-id': sid });
      assert.equal(list.status, 200);
      assert.match(await list.text(), /"tools"/);
    }
  } finally { await s.close(); }
});

test('no session id and not an initialize: still 400, as the SDK answers', async () => {
  const s = await start();
  try {
    const r = await send(s.port, 'POST', { jsonrpc: '2.0', id: 3, method: 'tools/list' });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error.message, /Server not initialized/);
  } finally { await s.close(); }
});

test('OAuth on: an account call with no credential gets the sign-in 401 before the session 404', async () => {
  const s = await start({ ANDRU_OAUTH: 'on', MCP_PUBLIC_URL: 'https://mcp.andru-ai.com/mcp' });
  try {
    const r = await send(s.port, 'POST', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_pre_brief', arguments: {} } }, STALE);
    assert.equal(r.status, 401);
    // Signed in, the same stale session then gets the 404, and the client re-initializes.
    const again = await send(s.port, 'POST', { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_pre_brief', arguments: {} } }, { ...STALE, Authorization: 'Bearer an-oauth-token' });
    assert.equal(again.status, 404);
    assert.deepEqual(await again.json(), notFound(5));
  } finally { await s.close(); }
});
