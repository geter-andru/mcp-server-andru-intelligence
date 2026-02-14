/**
 * Andru MCP Server (Thin Proxy)
 *
 * Creates an MCP server that proxies all tool and resource requests
 * to the Andru backend API via the AndruClient.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Create an MCP server backed by the Andru API.
 *
 * @param {import('./client.js').AndruClient} client
 * @returns {Server}
 */
export function createServer(client) {
  const server = new Server(
    {
      name: 'andru-intelligence',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // --- Tool handlers (proxy to backend) ---

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {
      const result = await client.listTools();
      return { tools: result.tools };
    }
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
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

  // --- Resource handlers (proxy to backend) ---

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async () => {
      const result = await client.listResources();
      return { resources: result.resources };
    }
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
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
