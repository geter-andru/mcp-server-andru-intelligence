#!/usr/bin/env node

/**
 * Andru MCP Server — Streamable HTTP Transport
 *
 * Hosted entry point for Smithery, Salesforce AgentExchange, and any
 * MCP client that connects via Streamable HTTP (the MCP 2025-03-26 spec).
 *
 * Environment variables:
 *   ANDRU_API_URL  (optional) — API base URL (default: https://api.andru-ai.com)
 *   PORT           (optional) — HTTP port (default: 3100)
 *   HOST           (optional) — Bind address (default: 0.0.0.0)
 *   MCP_RELAY_KEY  (hosted server only) — lets the API believe the person's IP (src/clientOrigin.js)
 *   TRUST_PROXY_HOPS (optional) — proxies in front of this server (default: 2 on Render, else none)
 *
 * Each client authenticates with X-API-Key header per request.
 * Sessions are stateful — each initialization creates a scoped Server+Transport.
 *
 * Usage:
 *   PORT=3100 node src/httpServer.js
 */

import { createHttpApp } from './httpApp.js';

async function main() {
  const apiUrl = process.env.ANDRU_API_URL || 'https://api.andru-ai.com';
  const port = parseInt(process.env.PORT || '3100', 10);
  const host = process.env.HOST || '0.0.0.0';
  const { app, transports } = createHttpApp({ apiUrl, host });

  // --- Cleanup on exit ---
  const shutdown = async () => {
    console.log('[Andru MCP HTTP] Shutting down...');
    for (const [id, transport] of transports) {
      await transport.close().catch(() => {});
      transports.delete(id);
    }
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
