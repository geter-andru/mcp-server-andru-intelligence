import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHttpApp } from '../src/httpApp.js';
import { PAID_TOOL_LINE } from '../src/catalog.js';

// 1.10.0 (AGENT_PLATFORM_PLAN_2026-10-22): with no key, a session opens and lists every tool; only
// the signup and preview tools run; a key from signup is used for the rest of the session.

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

const NEW_KEY = `sk_live_${'b'.repeat(64)}`;

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
  const port = await listen(server);
  return { calls, url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

test('no key: list everything, refuse paid work with how to sign up, sign up, then work', async () => {
  const api = await fakeApi();
  const { app } = createHttpApp({ apiUrl: api.url, host: '127.0.0.1' });
  const httpServer = http.createServer(app);
  const port = await listen(httpServer);
  const client = new Client({ name: 'keyless-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const n of ['preview_company', 'signup_start', 'signup_verify', 'signup_status', 'whoami', 'quote', 'get_pre_brief']) {
      assert.ok(names.includes(n), `${n} listed`);
    }
    // The pre-meeting brief is free since 2026-10-24; the thesis check is a paid example.
    const brief = tools.find((t) => t.name === 'get_thesis_match');
    assert.ok(brief.description.endsWith(PAID_TOOL_LINE), 'paid tools carry the billing terms');
    assert.ok(!tools.find((t) => t.name === 'get_pre_brief').description.endsWith(PAID_TOOL_LINE), 'the free brief carries no billing terms');
    assert.ok(brief.inputSchema.properties.idempotencyKey && brief.inputSchema.properties.quoteId);
    // Copy batch 6 J1: the agent's own price ceiling, as the backend lists it.
    assert.deepEqual(brief.inputSchema.properties.maxAmountCents, { type: 'integer', minimum: 0, description: 'Optional: the most this call may cost, in cents. If the price is higher, nothing runs and nothing is charged.' });

    const refused = await client.callTool({ name: 'get_pre_brief', arguments: { companyName: 'Acme' } });
    assert.equal(refused.isError, true);
    const why = JSON.parse(refused.content[0].text);
    assert.equal(why.code, 'AUTH_REQUIRED');
    assert.match(why.message, /^No API key yet\. Your agent can set one up now: call signup_start/);
    assert.equal(why.next_action.tool, 'signup_start');
    assert.equal(api.calls.filter((c) => c.path === '/api/mcp/tools/call').length, 0, 'nothing sent to the API');

    const signedIn = await client.callTool({ name: 'signup_verify', arguments: { email: 'pat@acme.com', code: '123456' } });
    assert.equal(JSON.parse(signedIn.content[0].text).apiKey, NEW_KEY);
    assert.match(signedIn.content.at(-1).text, /^This session now uses the new key\. To keep it after this session, save it in your MCP client settings as ANDRU_API_KEY, or send it as the X-API-Key header\.$/);
    assert.equal(api.calls.find((c) => c.tool === 'signup_verify').key, null, 'signup went without a key');

    await client.callTool({ name: 'get_pre_brief', arguments: { companyName: 'Acme' } });
    assert.equal(api.calls.find((c) => c.tool === 'get_pre_brief').key, NEW_KEY, 'the rest of the session uses the new key');
  } finally {
    await client.close().catch(() => {});
    httpServer.closeAllConnections?.();
    await new Promise((r) => httpServer.close(r));
    await api.close();
  }
});

test('a keyed session works as before', async () => {
  const api = await fakeApi();
  const { app } = createHttpApp({ apiUrl: api.url, host: '127.0.0.1' });
  const httpServer = http.createServer(app);
  const port = await listen(httpServer);
  const client = new Client({ name: 'keyed-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers: { 'X-API-Key': 'sk_live_test' } } });
  try {
    await client.connect(transport);
    await client.callTool({ name: 'whoami', arguments: {} });
    assert.equal(api.calls.find((c) => c.tool === 'whoami').key, 'sk_live_test');
  } finally {
    await client.close().catch(() => {});
    httpServer.closeAllConnections?.();
    await new Promise((r) => httpServer.close(r));
    await api.close();
  }
});

// The billing terms go on exactly the tools the backend lists with them (agentPricing priceFor().counts,
// checked against backend cdbd597 on 2026-10-23). generate_asset is billed by its job at the asset's
// catalog price and carries no billing terms; 1.10.0's draft wrongly added them.
test('the billing terms are on the same nine tools as the backend (the brief is free since 2026-10-24)', async () => {
  const { listedTools, PAID_TOOL_LINE: line } = await import('../src/catalog.js');
  const paid = listedTools().filter((t) => t.description.endsWith(line)).map((t) => t.name).sort();
  assert.deepEqual(paid, [
    'assess_company_readiness', 'consult_agent', 'discover_prospects', 'generate_portfolio_brief', 'get_account_plan',
    'get_portfolio_readiness_rollup', 'get_sales_blueprint', 'get_thesis_match', 'simulate_buyer_persona',
  ]);
  const asset = listedTools().find((t) => t.name === 'generate_asset');
  assert.equal(asset.inputSchema.properties.idempotencyKey, undefined);
});
