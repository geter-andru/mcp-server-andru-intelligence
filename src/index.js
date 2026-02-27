#!/usr/bin/env node

/**
 * Andru Revenue Intelligence MCP Server
 *
 * Standalone entry point for use with Claude Desktop, Claude Code,
 * or any MCP-compatible client.
 *
 * Environment variables:
 *   ANDRU_API_KEY  (required) — Your Andru Platform API key
 *   ANDRU_API_URL  (optional) — API base URL (default: https://hs-andru-test.onrender.com)
 *
 * Usage:
 *   ANDRU_API_KEY=sk_live_... npx mcp-server-andru-intelligence
 *
 * Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "andru-intelligence": {
 *         "command": "npx",
 *         "args": ["mcp-server-andru-intelligence"],
 *         "env": {
 *           "ANDRU_API_KEY": "sk_live_your_key_here"
 *         }
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AndruClient } from './client.js';
import { createServer } from './server.js';
import { initCache, closeCache, getStats } from './cache.js';
import { createCachedClient } from './cachedClient.js';
import { startSync, stopSync } from './sync.js';

async function main() {
  const apiKey = process.env.ANDRU_API_KEY;
  const apiUrl = process.env.ANDRU_API_URL || 'https://hs-andru-test.onrender.com';
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
  let client = null;
  if (apiKey) {
    const baseClient = new AndruClient(apiKey, apiUrl);
    // Wrap with cache layer (Phase 8)
    client = cacheEnabled ? createCachedClient(baseClient) : baseClient;
  } else {
    console.error('[Andru MCP] Warning: ANDRU_API_KEY not set. Tool listing works, but execution requires an API key.');
    console.error('[Andru MCP] Get your API key at https://platform.andru-ai.com/settings/api-keys');
  }

  const server = createServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('[Andru MCP] Server running on stdio transport');
  if (client) {
    console.error(`[Andru MCP] API endpoint: ${apiUrl}`);
  }

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
 * https://hs-andru-test.onrender.com → wss://hs-andru-test.onrender.com/ws
 * http://localhost:3001 → ws://localhost:3001/ws
 */
function deriveWsUrl(apiUrl) {
  const wsOverride = process.env.ANDRU_WS_URL;
  if (wsOverride) return wsOverride;

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
