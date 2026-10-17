/**
 * Andru API Client
 *
 * Thin HTTP client that proxies MCP operations to the Andru backend.
 * Authenticates via X-API-Key header.
 */

import { readFileSync } from 'node:fs';
import { assertTrustedApiUrl } from './apiUrl.js';

const DEFAULT_API_URL = 'https://api.andru-ai.com';
const REQUEST_TIMEOUT_MS = 60_000; // 60s for AI-calling tools
const PACKAGE_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/**
 * The backend sends errors as a string or as { code, message, suggestion }. Return readable text
 * either way (an object used to come through as "[object Object]").
 */
export function readErrorMessage(parsed) {
  const err = parsed?.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    return [err.message, err.suggestion].filter(Boolean).join('. ') || err.code || null;
  }
  return typeof parsed?.message === 'string' ? parsed.message : null;
}

export class AndruClient {
  /**
   * @param {string} apiKey - Andru Platform API key
   * @param {string} [baseUrl] - API base URL (default: https://api.andru-ai.com)
   */
  constructor(apiKey, baseUrl = DEFAULT_API_URL) {
    this.apiKey = apiKey;
    this.baseUrl = assertTrustedApiUrl(baseUrl).replace(/\/+$/, ''); // Strip trailing slashes
    this.clientInfo = {};
  }

  /**
   * Which app the person is using, as the MCP client named itself when it connected (1.9.7), and
   * how it connects ('stdio', 'http', 'cli'). Sent with every request as X-MCP-Client-Name /
   * -Version and X-MCP-Transport, so Andru can tell Claude Desktop from Cursor or Claude Code.
   * Names only; never prompts or content.
   */
  setClientInfo({ name, version, transport } = {}) {
    const clean = (v) => {
      const s = String(v ?? '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, 80);
      return s || undefined;
    };
    this.clientInfo = {
      ...this.clientInfo,
      ...(clean(name) ? { name: clean(name) } : {}),
      ...(clean(version) ? { version: clean(version) } : {}),
      ...(clean(transport) ? { transport: clean(transport) } : {}),
    };
  }

  /** The X-MCP-* headers for the client info set so far. */
  clientHeaders() {
    const h = {};
    if (this.clientInfo.name) h['X-MCP-Client-Name'] = this.clientInfo.name;
    if (this.clientInfo.version) h['X-MCP-Client-Version'] = this.clientInfo.version;
    if (this.clientInfo.transport) h['X-MCP-Transport'] = this.clientInfo.transport;
    return h;
  }

  /**
   * Tell Andru a client connected (1.9.7), so a connection that never calls a tool is still seen.
   * Never throws: a failed connect note must not affect the session.
   */
  async connect() {
    try {
      await this.post('/api/mcp/connect', {});
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all available MCP tools.
   * @returns {Promise<{ tools: Array<{ name: string, description: string, inputSchema: object }> }>}
   */
  async listTools() {
    return this.post('/api/mcp/tools/list', {});
  }

  /**
   * Execute an MCP tool.
   * @param {string} name - Tool name
   * @param {object} args - Tool arguments
   * @returns {Promise<{ content: Array<{ type: string, text: string }>, isError?: boolean }>}
   */
  async callTool(name, args) {
    return this.post('/api/mcp/tools/call', { tool: name, arguments: args });
  }

  /**
   * List all available MCP resources.
   * @returns {Promise<{ resources: Array<{ uri: string, name: string, description: string, mimeType: string }> }>}
   */
  async listResources() {
    return this.post('/api/mcp/resources/list', {});
  }

  /**
   * Read an MCP resource by URI.
   * @param {string} uri - Resource URI (e.g., "andru://icp/profile")
   * @returns {Promise<{ contents: Array<{ uri: string, mimeType: string, text: string }> }>}
   */
  async readResource(uri) {
    return this.post('/api/mcp/resources/read', { uri });
  }

  /**
   * Get wallet balance and recent MCP usage.
   * @returns {Promise<{ data: { balance: object, plan: string, unlimited: boolean, recent_mcp_charges: Array, topup_url: string } }>}
   */
  async getUsage() {
    return this.get('/api/mcp/usage');
  }

  /**
   * @private
   */
  async get(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'User-Agent': `andru-mcp-server/${PACKAGE_VERSION}`,
          ...this.clientHeaders(),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMessage;
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = readErrorMessage(parsed) || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorBody.slice(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request to ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * @private
   */
  async post(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': `andru-mcp-server/${PACKAGE_VERSION}`,
          ...this.clientHeaders(),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMessage;
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = readErrorMessage(parsed) || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorBody.slice(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      if (response.status === 204) return null; // no content (e.g. /api/mcp/connect)
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request to ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
