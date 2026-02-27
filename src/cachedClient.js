/**
 * Cache-Enhanced Andru API Client (Phase 8)
 *
 * Wraps the base AndruClient with SQLite caching:
 *   - On success: cache result, return it
 *   - On failure: serve from cache (stale OK)
 *   - Offline: serve from cache transparently
 *
 * @module cachedClient
 */

import { get, set } from './cache.js';

/**
 * Create a cache-enhanced wrapper around the base client.
 *
 * @param {import('./client.js').AndruClient} client - Base API client
 * @returns {object} Client with same interface but cache-backed
 */
export function createCachedClient(client) {
  return {
    /**
     * Execute a tool with cache fallback.
     */
    async callTool(name, args) {
      const cacheKey = `tool:${name}:${stableHash(args)}`;

      try {
        const result = await client.callTool(name, args);

        // Cache successful results (not errors)
        if (!result.isError) {
          set(cacheKey, result, { category: 'tool_result' });
        }

        return result;
      } catch (err) {
        // Network failure — try cache
        const cached = get(cacheKey, { allowStale: true });
        if (cached) {
          return {
            ...cached.value,
            _fromCache: true,
            _stale: cached.stale,
          };
        }
        throw err;
      }
    },

    /**
     * Read a resource with cache fallback.
     */
    async readResource(uri) {
      const cacheKey = `resource:${uri}`;

      try {
        const result = await client.readResource(uri);
        set(cacheKey, result, { category: 'resource' });
        return result;
      } catch (err) {
        const cached = get(cacheKey, { allowStale: true });
        if (cached) {
          return {
            ...cached.value,
            _fromCache: true,
            _stale: cached.stale,
          };
        }
        throw err;
      }
    },

    /**
     * List tools — uses static catalog, no caching needed.
     */
    async listTools() {
      return client.listTools();
    },

    /**
     * List resources — uses static catalog, no caching needed.
     */
    async listResources() {
      return client.listResources();
    },

    /**
     * Pre-warm the cache with frequently-used data.
     * Called after initial WebSocket sync.
     */
    async warmCache() {
      const essentialResources = [
        'andru://icp/profile',
        'andru://pipeline/summary',
        'andru://soul/voice',
      ];

      const results = [];
      for (const uri of essentialResources) {
        try {
          const result = await client.readResource(uri);
          set(`resource:${uri}`, result, { category: 'resource' });
          results.push({ uri, status: 'cached' });
        } catch {
          results.push({ uri, status: 'failed' });
        }
      }
      return results;
    },
  };
}

/**
 * Stable hash for cache keys — deterministic JSON key ordering.
 * Simple but effective for cache key generation.
 */
function stableHash(obj) {
  if (!obj || typeof obj !== 'object') return String(obj || '');
  const sorted = JSON.stringify(obj, Object.keys(obj).sort());
  // Simple string hash (djb2)
  let hash = 5381;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) + hash + sorted.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}
