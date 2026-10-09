/**
 * Andru MCP Server (Thin Proxy + Local Cache)
 *
 * Lists tools and resources from the static catalog (no network needed).
 * Proxies tool execution and resource reads to the Andru backend API.
 * Phase 8: Falls back to SQLite cache when offline.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { tools, resources } from './catalog.js';

// The version clients see comes from package.json, so it can't drift from the release (it said
// 1.8.0 while 1.9.0 was being prepared, 2026-10-08).
export const PACKAGE_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** The needs_context payload of a tool result, or null. */
export function needsContextOf(result) {
  try {
    const text = result?.content?.[0]?.text;
    const parsed = typeof text === 'string' ? JSON.parse(text) : null;
    return parsed?.status === 'needs_context' ? parsed : null;
  } catch {
    return null;
  }
}

/** The one-question form: the company website, or a description instead. */
export const PRODUCT_FORM = {
  message: 'Andru needs to know what you sell, once. Share your company website and Andru will read it and remember your product for every later call. Or describe it instead.',
  requestedSchema: {
    type: 'object',
    properties: {
      website: { type: 'string', title: 'Company website', description: 'e.g. acme.com' },
      productDescription: { type: 'string', title: 'Or: what your product does and who it is for' },
    },
  },
};

/**
 * Ask once (2026-10-07). When a tool needs to know what the founder sells and the client can show
 * forms (MCP elicitation: Claude Code, Cursor, VS Code), ask for the website in one field, save it
 * with set_product_context, and retry the original call, so the person gets the answer instead of
 * an error. Clients without forms (e.g. Claude Desktop) get the original reply, which says how.
 */
export async function askOnceForProduct(server, client, name, args, result) {
  const needs = needsContextOf(result);
  const rc = needs?.required_context || needs?.requiredContext;
  if (!rc || !('productDescription' in rc) || name === 'set_product_context') return result;
  if (!server.getClientCapabilities?.()?.elicitation) return result;

  let answer;
  try {
    answer = await server.elicitInput(PRODUCT_FORM);
  } catch {
    return result;
  }
  const content = answer?.action === 'accept' ? answer.content || {} : null;
  const website = typeof content?.website === 'string' ? content.website.trim() : '';
  const productDescription = typeof content?.productDescription === 'string' ? content.productDescription.trim() : '';
  if (!website && !productDescription) return result;

  const saved = await client.callTool('set_product_context', website ? { website } : { productDescription });
  const savedInfo = (() => {
    try { return JSON.parse(saved?.content?.[0]?.text || '{}'); } catch { return {}; }
  })();
  if (!['saved', 'kept'].includes(savedInfo.status)) {
    // The site could not be read: retry with the description if given, else explain.
    if (productDescription) return client.callTool(name, { ...args, productDescription });
    return saved;
  }
  const retried = await client.callTool(name, args);
  const note = savedInfo.status === 'saved'
    ? `Andru saved your product${savedInfo.source && savedInfo.source !== 'description' ? ` from ${savedInfo.source}` : ''}: ${savedInfo.product?.productDescription || ''} Call set_product_context to correct it.`
    : savedInfo.message;
  return { ...retried, content: [...(retried?.content || []), { type: 'text', text: note }] };
}

/**
 * Create an MCP server backed by the Andru API.
 *
 * @param {import('./client.js').AndruClient | import('./cachedClient.js').CachedClient | null} client — null during scan mode (no API key). When Phase 8 cache is active, this is a cachedClient wrapper.
 * @returns {Server}
 */
export function createServer(client) {
  const server = new Server(
    {
      name: 'andru-intelligence',
      version: PACKAGE_VERSION,
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
        const result = await client.callTool(name, args || {});
        return await askOnceForProduct(server, client, name, args || {}, result);
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
