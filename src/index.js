#!/usr/bin/env node

/**
 * Andru Revenue Intelligence MCP Server
 *
 * Standalone entry point for use with Claude Desktop, Claude Code,
 * or any MCP-compatible client.
 *
 * Environment variables:
 *   ANDRU_API_KEY  (required) — Your Andru Platform API key
 *   ANDRU_API_URL  (optional) — API base URL (default: https://api.andru.ai)
 *
 * Usage:
 *   ANDRU_API_KEY=sk_live_... npx @andru/mcp-server-intelligence
 *
 * Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "andru-intelligence": {
 *         "command": "npx",
 *         "args": ["@andru/mcp-server-intelligence"],
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

async function main() {
  const apiKey = process.env.ANDRU_API_KEY;
  const apiUrl = process.env.ANDRU_API_URL || 'https://api.andru.ai';

  // When no API key, server still starts (tool listing works from static catalog,
  // but tool execution will return an error). This allows registry scanners
  // to discover tools without needing credentials.
  let client = null;
  if (apiKey) {
    client = new AndruClient(apiKey, apiUrl);
  } else {
    console.error('[Andru MCP] Warning: ANDRU_API_KEY not set. Tool listing works, but execution requires an API key.');
    console.error('[Andru MCP] Get your API key at https://app.andru.ai/settings/api-keys');
  }

  const server = createServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('[Andru MCP] Server running on stdio transport');
  if (client) {
    console.error(`[Andru MCP] API endpoint: ${apiUrl}`);
  }
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
