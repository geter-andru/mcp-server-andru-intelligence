/**
 * Andru MCP Server (Thin Proxy)
 *
 * Lists tools and resources from the static catalog (no network needed).
 * Proxies tool execution and resource reads to the Andru backend API.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { tools, resources } from './catalog.js';

/**
 * Create an MCP server backed by the Andru API.
 *
 * @param {import('./client.js').AndruClient | null} client — null during scan mode (no API key)
 * @returns {Server}
 */
export function createServer(client) {
  const server = new Server(
    {
      name: 'andru-intelligence',
      version: '0.1.1',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // --- Tool listing (static catalog — no network) ---

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => ({ tools })
  );

  // --- Tool execution (proxy to backend) ---

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'ANDRU_API_KEY not configured. Tool execution requires an API key.' }) }],
          isError: true,
        };
      }
      const { name, arguments: args } = request.params;
      try {
        return await client.callTool(name, args || {});
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: error.message }),
          }],
          isError: true,
        };
      }
    }
  );

  // --- Resource listing (static catalog — no network) ---

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async () => ({ resources })
  );

  // --- Resource reading (proxy to backend) ---

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      if (!client) {
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: JSON.stringify({ error: 'ANDRU_API_KEY not configured. Resource reads require an API key.' }),
          }],
        };
      }
      const { uri } = request.params;
      try {
        return await client.readResource(uri);
      } catch (error) {
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: JSON.stringify({ error: error.message }),
          }],
        };
      }
    }
  );

  return server;
}
