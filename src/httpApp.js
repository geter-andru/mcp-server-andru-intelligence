/**
 * The Streamable HTTP app (moved out of httpServer.js 2026-10-19 so tests can run it).
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AndruClient } from './client.js';
import { createServer, NO_KEY_NEXT_ACTION, SETUP_URL, SETUP_DOCS_URL } from './server.js';
import { originOf, requestOrigin } from './clientOrigin.js';
import { KEYLESS_TOOLS } from './catalog.js';

export const OAUTH_SCOPE = 'andru:agent';

const RATE_WINDOW_MS = 15 * 60 * 1000;
/** Seconds until the caller's rate-limit window resets (express-rate-limit's req.rateLimit), at least 1. */
export function retryAfterSeconds(req, now = Date.now()) {
  const reset = req.rateLimit?.resetTime;
  const ms = reset instanceof Date ? reset.getTime() - now : RATE_WINDOW_MS;
  return Math.max(1, Math.ceil(ms / 1000));
}

/** Copy batch 14 E1 + batch 1 C3, joined (copy batch 17 A1, approved by Geter 2026-10-27). */
export const SIGN_IN_MESSAGE = "Sign in to Andru to use this tool. Or set up a key now: call signup_start with the person's email. Andru emails them a code and an Approve button.";

/** What the hosted limit counted: an API key, a sign-in, or the address (copy batch 17 B1). */
export function countedBy(req) {
  if (req.auth?.apiKey) return 'key';
  if (req.auth?.bearer) return 'connection';
  return 'address';
}
/** Copy batch 11 R3, with the word for what was counted (copy batch 17 B1, approved 2026-10-27). */
export const tooManyMessage = (by, seconds) => `Too many requests from this ${by}. Try again in ${seconds} seconds.`;

/** True when a JSON-RPC message (or batch) calls a tool or reads a resource that needs the person's account. */
export function needsAccount(body) {
  const msgs = Array.isArray(body) ? body : [body];
  return msgs.some((m) => m && ((m.method === 'tools/call' && !KEYLESS_TOOLS.has(m.params?.name)) || m.method === 'resources/read'));
}

/**
 * @param {{ apiUrl: string, host?: string }} options
 * @returns {{ app: import('express').Express, transports: Map<string, StreamableHTTPServerTransport> }}
 */
export function createHttpApp({ apiUrl, host = '0.0.0.0' }) {
  // Per-session transport map (stateful mode)
  const transports = new Map();

  const app = createMcpExpressApp({ host });
  // On Render a request passes Render's Cloudflare edge and Render's proxy, so with 2 trusted hops
  // (the API uses the same 2) req.ip is the person. If another Cloudflare hop is ever put in front,
  // req.ip is that edge and originOf takes cf-connecting-ip instead. Elsewhere the direct peer is
  // used unless TRUST_PROXY_HOPS says otherwise.
  const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS, 10);
  app.set('trust proxy', Number.isInteger(hops) ? hops : (process.env.RENDER === 'true' ? 2 : false));

  // --- Health check ---
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      transport: 'streamable-http',
      sessions: transports.size,
    });
  });

  // --- OAuth (AGENT_OAUTH_PLAN_2026-10-23, option B) ---
  // On only with ANDRU_OAUTH=on, once Andru's authorization server is live, so no client starts a
  // sign-in that can't finish. RFC 9728 protected resource metadata names the authorization server.
  const oauth = process.env.ANDRU_OAUTH === 'on';
  const resource = process.env.MCP_PUBLIC_URL || 'https://mcp.andru-ai.com/mcp';
  const resourceMetadataUrl = `${new URL(resource).origin}/.well-known/oauth-protected-resource`;
  if (oauth) {
    const resourceMetadata = (_req, res) => res.json({
      resource,
      authorization_servers: [process.env.ANDRU_AUTH_SERVER || 'https://api.andru-ai.com'],
      scopes_supported: [OAUTH_SCOPE],
      bearer_methods_supported: ['header'],
    });
    app.get('/.well-known/oauth-protected-resource', resourceMetadata);
    app.get('/.well-known/oauth-protected-resource/mcp', resourceMetadata);
  }

  // --- The key, when there is one (1.10.0) ---
  // No key: the session still opens and lists every tool; only signup_start, signup_verify,
  // signup_status and preview_company run, and every other call says how to get a key (server.js).
  // A key from signup is used for the rest of that session.
  function readApiKey(req, _res, next) {
    // Never from the URL (2026-10-27, Geter: "check usage then drop ?ANDRU_API_KEY"): URLs end up in
    // logs, proxies and browser history. No outside key made a call in the 30 days before; Smithery
    // now sends the key in this header (smithery-config.json).
    const key = req.headers['x-api-key'];
    const authz = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const bearer = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
    // An sk_ key sent as Bearer is a key; any other Bearer value is an OAuth access token from
    // Andru's authorization server, which the API checks.
    const apiKey = typeof key === 'string' && key.trim() ? key.trim() : (/^sk_(live|test)_/.test(bearer) ? bearer : null);
    req.auth = { apiKey, bearer: !apiKey && bearer ? bearer : null };
    next();
  }
  const sessionClients = new Map();

  // --- Rate limiting: per API key ---
  const mcpRateLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS, // 15 minutes
    max: 100, // 100 requests per API key per window
    keyGenerator: (req) => req.auth?.apiKey || (req.auth?.bearer ? `oauth:${req.auth.bearer.slice(-24)}` : ipKeyGenerator(req.ip)),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`[Andru MCP HTTP] Rate limit exceeded for key: ${req.auth?.apiKey?.slice(0, 8)}...`);
      // How long to wait (copy batch 17 B1, approved 2026-10-27), in the header and the body, as the
      // backend's 429 does (batch 11 R3/R4), so an agent can wait instead of failing.
      const seconds = retryAfterSeconds(req);
      res.set('Retry-After', String(seconds));
      res.status(429).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: tooManyMessage(countedBy(req), seconds), data: { code: 'RATE_LIMITED', retry_after_seconds: seconds } },
        id: req.body?.id ?? null,
      });
    },
  });

  // --- POST /mcp — JSON-RPC requests (initialize, tools/list, tools/call, etc.) ---
  app.post('/mcp', readApiKey, mcpRateLimiter, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionId ? transports.get(sessionId) : undefined;

    let client = sessionId ? sessionClients.get(sessionId) : undefined;
    // A keyless session whose agent now sends the key it got at signup: use it from here on.
    if (transport && client && !client.apiKey && req.auth.apiKey) client.setApiKey(req.auth.apiKey);
    // OAuth: each request carries the current access token (they refresh); use the latest.
    if (transport && client && req.auth.bearer) client.setBearer(req.auth.bearer);

    // Lazy authentication (OAuth on): a call that needs the person's account, sent with no credential,
    // gets HTTP 401 pointing at this server's protected resource metadata, so the client signs in.
    // Listing tools and the signup and preview tools still work without one.
    if (oauth && !req.auth.apiKey && !req.auth.bearer && !(client && client.signedIn) && needsAccount(req.body)) {
      res.set('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}", scope="${OAUTH_SCOPE}"`);
      // The next call for a client that uses a key instead of signing in (copy batch 17 A1, approved
      // 2026-10-27): the same next_action, setup page and docs as every no-key answer.
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: SIGN_IN_MESSAGE, data: { next_action: NO_KEY_NEXT_ACTION, setup: SETUP_URL, docs: SETUP_DOCS_URL } },
        id: req.body?.id ?? null,
      });
    }

    if (!transport) {
      // New session — create per-key client, server, and transport
      client = new AndruClient(req.auth.apiKey, apiUrl);
      if (req.auth.bearer) client.setBearer(req.auth.bearer);
      const server = createServer(client, { transport: 'http' });

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      await server.connect(transport);

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          sessionClients.delete(transport.sessionId);
          console.log(`[Andru MCP HTTP] Session closed: ${transport.sessionId}`);
        }
      };
    }

    // Every API call made while handling this request carries the person's IP (clientOrigin.js).
    await requestOrigin.run(originOf(req), () => transport.handleRequest(req, res, req.body));

    // Store transport by its generated session ID (set after first handleRequest)
    if (transport.sessionId && !transports.has(transport.sessionId)) {
      transports.set(transport.sessionId, transport);
      if (client) sessionClients.set(transport.sessionId, client);
      console.log(`[Andru MCP HTTP] Session created: ${transport.sessionId}`);
    }
  });

  // --- GET /mcp — SSE stream for server-initiated notifications ---
  app.get('/mcp', readApiKey, mcpRateLimiter, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'No active session. Send initialize first via POST.' },
        id: null,
      });
    }
    await requestOrigin.run(originOf(req), () => transport.handleRequest(req, res));
  });

  // --- DELETE /mcp — session termination ---
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (transport) {
      await transport.close();
      transports.delete(sessionId);
      sessionClients.delete(sessionId);
      console.log(`[Andru MCP HTTP] Session terminated: ${sessionId}`);
    }
    res.status(200).end();
  });

  return { app, transports };
}
