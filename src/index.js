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

const apiKey = process.env.ANDRU_API_KEY;

if (!apiKey) {
  console.error('[Andru MCP] Error: ANDRU_API_KEY environment variable is required');
  console.error('[Andru MCP] Get your API key at https://app.andru.ai/settings/api-keys');
  process.exit(1);
}

const apiUrl = process.env.ANDRU_API_URL || 'https://api.andru.ai';

const client = new AndruClient(apiKey, apiUrl);
const server = createServer(client);
const transport = new StdioServerTransport();

await server.connect(transport);

console.error('[Andru MCP] Server running on stdio transport');
console.error(`[Andru MCP] API endpoint: ${apiUrl}`);
