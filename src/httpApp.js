/**
 * The Streamable HTTP app (moved out of httpServer.js 2026-10-19 so tests can run it).
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AndruClient } from './client.js';
import { createServer } from './server.js';
import { originOf, requestOrigin } from './clientOrigin.js';

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

  // --- The key, when there is one (1.10.0) ---
  // No key: the session still opens and lists every tool; only signup_start, signup_verify,
  // signup_status and preview_company run, and every other call says how to get a key (server.js).
  // A key from signup is used for the rest of that session.
  function readApiKey(req, _res, next) {
    const key = req.headers['x-api-key'] || req.query.ANDRU_API_KEY;
    req.auth = { apiKey: typeof key === 'string' && key.trim() ? key.trim() : null };
    next();
  }
  const sessionClients = new Map();

  // --- Rate limiting: per API key ---
  const mcpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per API key per window
    keyGenerator: (req) => req.auth?.apiKey || ipKeyGenerator(req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Rate limit exceeded. Try again later.' },
      id: null,
    },
    handler: (req, res) => {
      console.warn(`[Andru MCP HTTP] Rate limit exceeded for key: ${req.auth?.apiKey?.slice(0, 8)}...`);
      res.status(429).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Rate limit exceeded. Try again later.' },
        id: null,
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

    if (!transport) {
      // New session — create per-key client, server, and transport
      client = new AndruClient(req.auth.apiKey, apiUrl);
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
