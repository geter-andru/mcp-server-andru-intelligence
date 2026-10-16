import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertTrustedApiUrl } from '../src/apiUrl.js';
import { AndruClient } from '../src/client.js';

test('Andru hosts and this machine are accepted', () => {
  delete process.env.ANDRU_ALLOW_CUSTOM_API_URL;
  for (const url of [
    'https://api.andru-ai.com',
    'https://andru-ai.com/',
    'https://hs-andru-test.onrender.com',
    'wss://api.andru-ai.com/ws',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'ws://localhost:3001/ws',
  ]) {
    assert.equal(assertTrustedApiUrl(url), url);
  }
});

test('other hosts, look-alikes and plain http are refused', () => {
  delete process.env.ANDRU_ALLOW_CUSTOM_API_URL;
  for (const url of [
    'https://evil.example.com',
    'https://andru-ai.com.evil.example',
    'https://evilandru-ai.com',
    'https://other-app.onrender.com',
    'http://api.andru-ai.com',
    'not a url',
  ]) {
    assert.throws(() => assertTrustedApiUrl(url), /ANDRU_API_URL/);
  }
});

test('the client refuses an untrusted base URL before sending anything', () => {
  delete process.env.ANDRU_ALLOW_CUSTOM_API_URL;
  assert.throws(() => new AndruClient('sk_live_x', 'https://evil.example.com'), /not an Andru host/);
  assert.equal(new AndruClient('sk_live_x').baseUrl, 'https://api.andru-ai.com');
});

test('ANDRU_ALLOW_CUSTOM_API_URL=true allows another host on purpose', () => {
  process.env.ANDRU_ALLOW_CUSTOM_API_URL = 'true';
  try {
    assert.equal(assertTrustedApiUrl('https://staging.example.com'), 'https://staging.example.com');
  } finally {
    delete process.env.ANDRU_ALLOW_CUSTOM_API_URL;
  }
});

test('backend errors read as text, not "[object Object]"', async () => {
  const { readErrorMessage } = await import('../src/client.js');
  assert.equal(
    readErrorMessage({ error: { code: 'AUTH_INVALID_API_KEY', message: 'Invalid API key', suggestion: 'Check your API key in the dashboard' } }),
    'Invalid API key. Check your API key in the dashboard'
  );
  assert.equal(readErrorMessage({ error: 'Insufficient balance' }), 'Insufficient balance');
  assert.equal(readErrorMessage({ error: { code: 'X' } }), 'X');
  assert.equal(readErrorMessage({ message: 'Not found' }), 'Not found');
  assert.equal(readErrorMessage({}), null);
});
