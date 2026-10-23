import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AndruClient, errorFor } from '../src/client.js';
import { createServer } from '../src/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// Copy batch 11 R4 (approved by Geter 2026-10-23): a refused-for-too-many-requests call used to reach
// the agent as {"error":"Rate limit exceeded"}. It now says RATE_LIMITED, how long to wait, and the
// backend's sentence, so the agent waits instead of giving up.

const SENTENCE = 'Too many requests from this address. Try again in 312 seconds.';

test('a 429 with the backend\'s fields becomes RATE_LIMITED with the wait and the sentence', async () => {
  const res = new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded', retry_after_seconds: 312, message: SENTENCE }), { status: 429, headers: { 'Retry-After': '312' } });
  const err = await errorFor(res);
  assert.deepEqual(err.reply, { status: 'error', code: 'RATE_LIMITED', retry_after_seconds: 312, message: SENTENCE });
});

test('an older 429 with only a Retry-After header still says how long to wait', async () => {
  const res = new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded' }), { status: 429, headers: { 'Retry-After': '40' } });
  const err = await errorFor(res);
  assert.deepEqual(err.reply, { status: 'error', code: 'RATE_LIMITED', retry_after_seconds: 40, message: 'Too many requests from this address. Try again in 40 seconds.' });
});

test('other refusals are unchanged', async () => {
  const err = await errorFor(new Response(JSON.stringify({ error: { code: 'AUTH_INVALID_API_KEY', message: 'Invalid API key' } }), { status: 401 }));
  assert.equal(err.reply, undefined);
  assert.equal(err.message, 'Invalid API key');
});

test('through the server, the agent sees the RATE_LIMITED reply', async () => {
  const api = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '312' });
      res.end(JSON.stringify({ success: false, error: 'Rate limit exceeded', retry_after_seconds: 312, message: SENTENCE }));
    });
  });
  await new Promise((r) => api.listen(0, '127.0.0.1', r));
  const andru = new AndruClient(null, `http://127.0.0.1:${api.address().port}`);
  const server = createServer(andru, { transport: 'stdio' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 't', version: '1' });
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    const r = await client.callTool({ name: 'signup_status', arguments: { requestId: 'r1' } });
    assert.equal(r.isError, true);
    assert.deepEqual(JSON.parse(r.content[0].text), { status: 'error', code: 'RATE_LIMITED', retry_after_seconds: 312, message: SENTENCE });
  } finally {
    await client.close().catch(() => {});
    await new Promise((r) => api.close(r));
  }
});
