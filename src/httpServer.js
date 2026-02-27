#!/usr/bin/env node

/**
 * Andru Revenue Intelligence MCP Server — Streamable HTTP Transport
 *
 * Hosted entry point for Smithery, Salesforce AgentExchange, and any
 * MCP client that connects via Streamable HTTP (the MCP 2025-03-26 spec).
 *
 * Environment variables:
 *   ANDRU_API_URL  (optional) — API base URL (default: https://hs-andru-test.onrender.com)
 *   PORT           (optional) — HTTP port (default: 3100)
 *   HOST           (optional) — Bind address (default: 0.0.0.0)
 *
 * Each client authenticates with X-API-Key header per request.
 * Sessions are stateful — each initialization creates a scoped Server+Transport.
 *
 * Usage:
 *   PORT=3100 node src/httpServer.js
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import { AndruClient } from './client.js';
import { createServer } from './server.js';
import { createCachedClient } from './cachedClient.js';
import { initCache, closeCache } from './cache.js';

// Per-session transport map (stateful mode)
const transports = new Map();

async function main() {
  const apiUrl = process.env.ANDRU_API_URL || 'https://hs-andru-test.onrender.com';
  const port = parseInt(process.env.PORT || '3100', 10);
  const host = process.env.HOST || '0.0.0.0';
  const cacheEnabled = process.env.ANDRU_CACHE !== 'false';

  // Initialize SQLite cache
  if (cacheEnabled) {
    try {
      initCache();
      console.log('[Andru MCP HTTP] Cache initialized');
    } catch (err) {
      console.warn('[Andru MCP HTTP] Cache init failed (continuing without):', err.message);
    }
  }

  const app = createMcpExpressApp({ host });

  // --- Health check ---
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      transport: 'streamable-http',
      sessions: transports.size,
    });
  });

  // --- Auth middleware: require X-API-Key on MCP requests ---
  function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.ANDRU_API_KEY;
    if (!key) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'X-API-Key header required' },
        id: null,
      });
    }
    req.auth = { apiKey: key };
    next();
  }

  // --- POST /mcp — JSON-RPC requests (initialize, tools/list, tools/call, etc.) ---
  app.post('/mcp', requireApiKey, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      // New session — create per-key client, server, and transport
      const baseClient = new AndruClient(req.auth.apiKey, apiUrl);
      const client = cacheEnabled ? createCachedClient(baseClient) : baseClient;
      const server = createServer(client);

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      await server.connect(transport);

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          console.log(`[Andru MCP HTTP] Session closed: ${transport.sessionId}`);
        }
      };
    }

    await transport.handleRequest(req, res, req.body);

    // Store transport by its generated session ID (set after first handleRequest)
    if (transport.sessionId && !transports.has(transport.sessionId)) {
      transports.set(transport.sessionId, transport);
      console.log(`[Andru MCP HTTP] Session created: ${transport.sessionId}`);
    }
  });

  // --- GET /mcp — SSE stream for server-initiated notifications ---
  app.get('/mcp', requireApiKey, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'No active session. Send initialize first via POST.' },
        id: null,
      });
    }
    await transport.handleRequest(req, res);
  });

  // --- DELETE /mcp — session termination ---
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (transport) {
      await transport.close();
      transports.delete(sessionId);
      console.log(`[Andru MCP HTTP] Session terminated: ${sessionId}`);
    }
    res.status(200).end();
  });

  // --- Cleanup on exit ---
  const shutdown = async () => {
    console.log('[Andru MCP HTTP] Shutting down...');
    for (const [id, transport] of transports) {
      await transport.close().catch(() => {});
      transports.delete(id);
    }
    closeCache();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  app.listen(port, host, () => {
    console.log(`[Andru MCP HTTP] Streamable HTTP server listening on http://${host}:${port}/mcp`);
    console.log(`[Andru MCP HTTP] Health check: http://${host}:${port}/health`);
    console.log(`[Andru MCP HTTP] API backend: ${apiUrl}`);
  });
}

main().catch((err) => {
  console.error('[Andru MCP HTTP] Fatal error:', err);
  process.exit(1);
});
