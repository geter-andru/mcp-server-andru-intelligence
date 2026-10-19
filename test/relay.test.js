import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { originOf, requestOrigin } from '../src/clientOrigin.js';
import { AndruClient } from '../src/client.js';
import { createHttpApp } from '../src/httpApp.js';

const RELAY_KEY = 'test-relay-key-0123456789abcdef0123456789abcdef';

afterEach(() => {
  delete process.env.MCP_RELAY_KEY;
  delete process.env.ANDRU_ALLOW_CUSTOM_API_URL;
});

test('the person is the cf-connecting-ip only when Cloudflare made the connection', () => {
  const viaCf = { ip: '172.70.255.173', headers: { 'cf-connecting-ip': '198.51.100.7', 'cf-ipcountry': 'gb' } };
  assert.deepEqual(originOf(viaCf), { ip: '198.51.100.7', country: 'GB' });
  // Sent straight to the server with a forged header: the peer is not Cloudflare, so it is ignored.
  const forged = { ip: '203.0.113.9', headers: { 'cf-connecting-ip': '198.51.100.7' } };
  assert.deepEqual(originOf(forged), { ip: '203.0.113.9', country: null });
  assert.equal(originOf({ ip: '::ffff:203.0.113.9', headers: {} }).ip, '203.0.113.9');
  assert.equal(originOf({ ip: '172.70.255.173', headers: { 'cf-connecting-ip': 'junk' } }).ip, '172.70.255.173');
  assert.equal(originOf({ ip: '203.0.113.9', headers: { 'cf-ipcountry': 'XX' } }).country, null);
});

test('relay headers are sent only with MCP_RELAY_KEY, a known origin and an Andru host', () => {
  const c = new AndruClient('sk_live_x');
  const origin = { ip: '198.51.100.7', country: 'GB' };
  assert.deepEqual(requestOrigin.run(origin, () => c.relayHeaders()), {}, 'no key: nothing');

  process.env.MCP_RELAY_KEY = RELAY_KEY;
  assert.deepEqual(c.relayHeaders(), {}, 'no request being handled: nothing');
  assert.deepEqual(requestOrigin.run(origin, () => c.relayHeaders()), {
    'X-Andru-Relay-Key': RELAY_KEY,
    'X-Andru-Client-IP': '198.51.100.7',
    'X-Andru-Client-Country': 'GB',
  });
  assert.deepEqual(requestOrigin.run({ ip: '198.51.100.7', country: null }, () => c.relayHeaders()), {
    'X-Andru-Relay-Key': RELAY_KEY,
    'X-Andru-Client-IP': '198.51.100.7',
  });

  // A host someone chose on purpose still never gets the relay key.
  process.env.ANDRU_ALLOW_CUSTOM_API_URL = 'true';
  const custom = new AndruClient('sk_live_x', 'https://example.com');
  assert.deepEqual(requestOrigin.run(origin, () => custom.relayHeaders()), {});
});

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

/** A fake Andru API that records the headers of each call. */
async function fakeApi() {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push({ path: req.url, headers: req.headers });
    req.resume();
    req.on('end', () => {
      if (req.url === '/api/mcp/connect') { res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }));
    });
  });
  const port = await listen(server);
  return { calls, url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

async function runSession(apiUrl) {
  const { app } = createHttpApp({ apiUrl, host: '127.0.0.1' });
  const httpServer = http.createServer(app);
  const port = await listen(httpServer);
  const client = new Client({ name: 'relay-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    // Forged: this connection doesn't come from Cloudflare, so the server must not believe it.
    requestInit: { headers: { 'X-API-Key': 'sk_live_test', 'cf-connecting-ip': '198.51.100.7' } },
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: 'get_wallet', arguments: {} });
    assert.equal(result.content[0].text, 'ok');
  } finally {
    await client.close().catch(() => {});
    httpServer.closeAllConnections?.();
    await new Promise((r) => httpServer.close(r));
  }
}

test('hosted server: every API call carries the caller\'s IP through the real MCP transport', async () => {
  process.env.MCP_RELAY_KEY = RELAY_KEY;
  const api = await fakeApi();
  try {
    await runSession(api.url);
    const toolCall = api.calls.find((c) => c.path === '/api/mcp/tools/call');
    const connect = api.calls.find((c) => c.path === '/api/mcp/connect');
    assert.ok(toolCall && connect, `API calls seen: ${api.calls.map((c) => c.path).join(', ')}`);
    for (const c of [toolCall, connect]) {
      assert.equal(c.headers['x-andru-relay-key'], RELAY_KEY);
      assert.equal(c.headers['x-andru-client-ip'], '127.0.0.1', 'the real peer, not the forged header');
      assert.equal(c.headers['x-mcp-transport'], 'http');
    }
  } finally {
    await api.close();
  }
});

test('hosted server without MCP_RELAY_KEY sends no relay headers', async () => {
  const api = await fakeApi();
  try {
    await runSession(api.url);
    assert.ok(api.calls.length >= 2);
    for (const c of api.calls) {
      assert.equal(c.headers['x-andru-relay-key'], undefined);
      assert.equal(c.headers['x-andru-client-ip'], undefined);
    }
  } finally {
    await api.close();
  }
});
