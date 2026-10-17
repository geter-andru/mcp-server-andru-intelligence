import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AndruClient } from '../src/client.js';
import { createCachedClient } from '../src/cachedClient.js';
import { createServer } from '../src/server.js';

function withFetch(handler, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return Promise.resolve(fn(calls)).finally(() => { globalThis.fetch = original; });
}

test('client info is cleaned and sent as X-MCP-* headers', async () => {
  const c = new AndruClient('sk_live_x');
  assert.deepEqual(c.clientHeaders(), {});
  c.setClientInfo({ name: 'claude-ai\n', version: '0.1.0', transport: 'stdio' });
  c.setClientInfo({ name: '' }); // an empty value never erases what is known
  assert.deepEqual(c.clientHeaders(), {
    'X-MCP-Client-Name': 'claude-ai',
    'X-MCP-Client-Version': '0.1.0',
    'X-MCP-Transport': 'stdio',
  });

  await withFetch(async () => new Response(JSON.stringify({ tools: [] }), { status: 200 }), async (calls) => {
    await c.listTools();
    assert.equal(calls[0].init.headers['X-MCP-Client-Name'], 'claude-ai');
    assert.equal(calls[0].init.headers['X-API-Key'], 'sk_live_x');
  });
});

test('connect posts to /api/mcp/connect, reads a 204, and never throws', async () => {
  const c = new AndruClient('sk_live_x');
  await withFetch(async () => new Response(null, { status: 204 }), async (calls) => {
    assert.equal(await c.connect(), true);
    assert.equal(calls[0].url, 'https://api.andru-ai.com/api/mcp/connect');
  });
  await withFetch(async () => { throw new Error('offline'); }, async () => {
    assert.equal(await c.connect(), false);
  });
  await withFetch(async () => new Response('{"error":"nope"}', { status: 401 }), async () => {
    assert.equal(await c.connect(), false);
  });
});

test('the cached client passes client info and connect through', async () => {
  const seen = [];
  const base = { setClientInfo: (i) => seen.push(i), connect: async () => true };
  const cached = createCachedClient(base);
  cached.setClientInfo({ name: 'cursor' });
  assert.deepEqual(seen, [{ name: 'cursor' }]);
  assert.equal(await cached.connect(), true);
});

test('when an MCP client connects, its name and version reach the API client and a connect is sent', async () => {
  const info = [];
  let connects = 0;
  const fake = { setClientInfo: (i) => info.push(i), connect: async () => { connects += 1; return true; } };
  const server = createServer(fake, { transport: 'stdio' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const mcp = new Client({ name: 'claude-ai', version: '0.1.0' });
  await mcp.connect(clientSide);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(info, [{ name: 'claude-ai', version: '0.1.0', transport: 'stdio' }]);
  assert.equal(connects, 1);
  await mcp.close();
});

test('without an API key (scan mode) nothing is sent on connect', async () => {
  const server = createServer(null, { transport: 'stdio' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const mcp = new Client({ name: 'registry-scanner', version: '1' });
  await mcp.connect(clientSide);
  const { tools } = await mcp.listTools();
  assert.ok(tools.length > 0);
  await mcp.close();
});
