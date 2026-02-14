/**
 * Andru API Client
 *
 * Thin HTTP client that proxies MCP operations to the Andru backend.
 * Authenticates via X-API-Key header.
 */

const DEFAULT_API_URL = 'https://api.andru.ai';
const REQUEST_TIMEOUT_MS = 60_000; // 60s for AI-calling tools
const PACKAGE_VERSION = '0.1.0';

export class AndruClient {
  /**
   * @param {string} apiKey - Andru Platform API key
   * @param {string} [baseUrl] - API base URL (default: https://api.andru.ai)
   */
  constructor(apiKey, baseUrl = DEFAULT_API_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // Strip trailing slashes
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
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMessage;
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = parsed.error || parsed.message || `HTTP ${response.status}`;
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
}
