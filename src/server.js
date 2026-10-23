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
import { listedTools, resources, KEYLESS_TOOLS } from './catalog.js';

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

/** Copy batch 1 C3 (approved by Geter 2026-10-22): the same "no API key" answer as every channel. */
export const NO_KEY_MESSAGE = "No API key yet. Your agent can set one up now: call signup_start with the person's email. Andru emails them a code and an Approve button, and your first calls each day are free. Or get a key in Andru (Settings → API access).";
export const NO_KEY_NEXT_ACTION = { tool: 'signup_start', arguments: { email: "<the person's email>" } };

/** The API key in a signup result (signup_verify, or signup_status once approved), or null. */
export function keyFromSignup(name, result) {
  if (name !== 'signup_verify' && name !== 'signup_status') return null;
  try {
    const parsed = JSON.parse(result?.content?.[0]?.text || '{}');
    return typeof parsed.apiKey === 'string' && parsed.apiKey.startsWith('sk_') ? parsed.apiKey : null;
  } catch {
    return null;
  }
}

/**
 * Create an MCP server backed by the Andru API.
 *
 * @param {import('./client.js').AndruClient | import('./cachedClient.js').CachedClient | null} client — null during scan mode (no API key). When Phase 8 cache is active, this is a cachedClient wrapper.
 * @param {{ transport?: 'stdio' | 'http' }} [options] — how this server is reached, sent with each request (1.9.7)
 * @returns {Server}
 */
export function createServer(client, { transport } = {}) {
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

  // Once the client has introduced itself, pass its name and version on with every request and note
  // the connection, so installs that never call a tool are visible to Andru (1.9.7).
  server.oninitialized = () => {
    if (!client) return;
    const info = server.getClientVersion?.() || {};
    client.setClientInfo?.({ name: info.name, version: info.version, transport });
    // The connect note needs a key; a keyless session is still seen when it calls signup.
    if (client.apiKey !== null) client.connect?.();
  };

  // --- Tool listing (static catalog — no network) ---

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => ({ tools: listedTools() })
  );

  // --- Tool execution (proxy to backend) ---

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      const { name, arguments: args } = request.params;
      // Before signup only the no-key account tools run; everything else says how to get a key.
      if (!client || (!client.apiKey && !KEYLESS_TOOLS.has(name))) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'error', code: 'AUTH_REQUIRED', message: NO_KEY_MESSAGE, next_action: NO_KEY_NEXT_ACTION }) }],
          isError: true,
        };
      }
      try {
        const result = await client.callTool(name, args || {});
        // Signed up inside this session: use the new key for the rest of it, so the agent can go
        // straight on to its first call. (Saving it for next time is the agent's job; the reply says so.)
        // Also when a key was already set (1.10.3): one that doesn't work, like a revoked key, would
        // otherwise keep every later call failing.
        const newKey = keyFromSignup(name, result);
        if (newKey && newKey !== client.apiKey) {
          client.setApiKey(newKey);
          // Copy batch 5 G2 (approved by Geter 2026-10-23).
          const note = 'This session now uses the new key. To keep it after this session, save it in your MCP client settings as ANDRU_API_KEY, or send it as the X-API-Key header.';
          return { ...result, content: [...(result?.content || []), { type: 'text', text: note }] };
        }
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
      if (!client || !client.apiKey) {
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: JSON.stringify({ status: 'error', code: 'AUTH_REQUIRED', message: NO_KEY_MESSAGE, next_action: NO_KEY_NEXT_ACTION }),
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
