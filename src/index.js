#!/usr/bin/env node

/**
 * Andru MCP Server — Operational Empathy for B2B
 *
 * Standalone entry point for use with Claude Desktop, Claude Code,
 * or any MCP-compatible client.
 *
 * Environment variables:
 *   ANDRU_API_KEY  (optional) — an Andru API key (sk_live_ + 64 hex). Without one, or with anything
 *                  else in it, the agent can sign the person up from the conversation (1.10.3).
 *   ANDRU_API_URL  (optional) — API base URL (default: https://api.andru-ai.com)
 *
 * Usage:
 *   npx mcp-server-andru-intelligence
 *
 * Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "andru-intelligence": {
 *         "command": "npx",
 *         "args": ["mcp-server-andru-intelligence"]
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AndruClient } from './client.js';
import { assertTrustedApiUrl } from './apiUrl.js';
import { createServer } from './server.js';
import { initCache, closeCache, getStats } from './cache.js';
import { createCachedClient } from './cachedClient.js';
import { startSync, stopSync } from './sync.js';
import { realKey } from './apiKey.js';

async function main() {
  // A value that isn't a real key (the old README placeholder, a fragment) counts as no key (1.10.3).
  const apiKey = realKey(process.env.ANDRU_API_KEY);
  const apiUrl = process.env.ANDRU_API_URL || 'https://api.andru-ai.com';
  const cacheEnabled = process.env.ANDRU_CACHE !== 'false'; // Default: enabled

  // Initialize SQLite cache (Phase 8)
  if (cacheEnabled) {
    try {
      initCache();
      const stats = getStats();
      console.error(`[Andru MCP] Cache initialized: ${stats.total} entries (${stats.fresh} fresh) at ${stats.dbPath}`);
    } catch (err) {
      console.error('[Andru MCP] Cache init failed (continuing without cache):', err.message);
    }
  }

  // When no API key, server still starts (tool listing works from static catalog,
  // but tool execution will return an error). This allows registry scanners
  // to discover tools without needing credentials.
  // No key yet: the server still runs. The agent can sign the person up from the conversation
  // (signup_start → signup_verify / signup_status) and this session then uses the new key (1.10.0).
  let client;
  if (apiKey) {
    const baseClient = new AndruClient(apiKey, apiUrl);
    // Wrap with cache layer (Phase 8)
    client = cacheEnabled ? createCachedClient(baseClient) : baseClient;
  } else {
    client = new AndruClient(null, apiUrl);
    if (process.env.ANDRU_API_KEY && process.env.ANDRU_API_KEY.trim()) {
      // Copy batch 10 K4, option B (approved by Geter 2026-10-23): a value was set, but it isn't a key.
      console.error("[Andru MCP] ANDRU_API_KEY isn't an Andru API key (those start with sk_live_), so this session starts without one. signup_start, signup_verify, signup_status and preview_company work now; the other tools work after signup.");
    } else {
      // Copy batch 5 G1 (approved by Geter 2026-10-23).
      console.error('[Andru MCP] No ANDRU_API_KEY yet. signup_start, signup_verify, signup_status and preview_company work now; the other tools work after signup.');
    }
  }

  const server = createServer(client, { transport: 'stdio' });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('[Andru MCP] Server running on stdio transport');
  console.error(`[Andru MCP] API endpoint: ${apiUrl}`);

  // Start WebSocket sync (Phase 8) — keeps cache fresh via backend events
  if (cacheEnabled && apiKey) {
    const wsUrl = deriveWsUrl(apiUrl);
    startSync({
      wsUrl,
      token: apiKey,
      onSync: (event) => {
        console.error(`[Andru MCP] Sync event: ${event.type}`);
      },
      onError: (err) => {
        console.error(`[Andru MCP] Sync error: ${err.message}`);
      },
    });
    console.error(`[Andru MCP] Cache sync connecting to ${wsUrl}`);
  }

  // Cleanup on exit
  process.on('SIGINT', () => {
    stopSync();
    closeCache();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopSync();
    closeCache();
    process.exit(0);
  });
}

/**
 * Derive WebSocket URL from HTTP API URL.
 * https://api.andru-ai.com → wss://api.andru-ai.com/ws
 * http://localhost:3001 → ws://localhost:3001/ws
 */
function deriveWsUrl(apiUrl) {
  const wsOverride = process.env.ANDRU_WS_URL;
  if (wsOverride) return assertTrustedApiUrl(wsOverride, 'ANDRU_WS_URL');

  return apiUrl
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:')
    .replace(/\/+$/, '') + '/ws';
}

main().catch((err) => {
  console.error('[Andru MCP] Fatal error:', err);
  process.exit(1);
});

/**
 * Smithery sandbox server — used by Smithery's scanner to discover
 * tools and resources without real credentials.
 */
export function createSandboxServer() {
  return createServer(null);
}
