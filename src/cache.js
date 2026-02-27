/**
 * SQLite Cache Layer (Phase 8 — Local Agent Runtime)
 *
 * Provides offline-capable caching for MCP tool results, resources,
 * and ANDRU_SOUL.md content. Data persists at ~/.andru/cache.db.
 *
 * Cache hierarchy:
 *   1. SQLite (hot path — <1ms reads)
 *   2. Backend API (warm path — network call)
 *   3. Stale cache (cold path — expired but better than nothing)
 *
 * @module cache
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.andru');
const DB_PATH = join(CACHE_DIR, 'cache.db');

// Default TTLs in seconds
const TTL = {
  tool_result: 300,       // 5 min — tool outputs change often
  resource: 1800,         // 30 min — ICP profiles, pipeline data
  soul: 86400,            // 24h — soul content rarely changes
  prospect: 3600,         // 1h — prospect watch list data
  icp_profile: 1800,      // 30 min — ICP profiles
  pipeline: 600,          // 10 min — pipeline data
};

let db = null;

/**
 * Initialize the SQLite cache. Creates ~/.andru/ and tables if needed.
 * Safe to call multiple times — idempotent.
 *
 * @returns {Database} The database instance
 */
export function initCache() {
  if (db) return db;

  // Ensure ~/.andru/ exists
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      key TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'general',
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      access_count INTEGER DEFAULT 0,
      last_accessed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_cache_category ON cache_entries(category);
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Clean expired entries on init (background housekeeping)
  cleanExpired();

  return db;
}

/**
 * Get a cached value by key. Returns null if not found or expired.
 * Optionally returns stale entries when allowStale=true (for offline fallback).
 *
 * @param {string} key - Cache key
 * @param {object} [opts]
 * @param {boolean} [opts.allowStale=false] - Return expired entries as fallback
 * @returns {{ value: any, stale: boolean } | null}
 */
export function get(key, { allowStale = false } = {}) {
  if (!db) initCache();

  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(
    'SELECT value, expires_at FROM cache_entries WHERE key = ?'
  ).get(key);

  if (!row) return null;

  const isExpired = row.expires_at < now;

  if (isExpired && !allowStale) return null;

  // Update access stats
  db.prepare(
    'UPDATE cache_entries SET access_count = access_count + 1, last_accessed_at = ? WHERE key = ?'
  ).run(now, key);

  try {
    return { value: JSON.parse(row.value), stale: isExpired };
  } catch {
    return { value: row.value, stale: isExpired };
  }
}

/**
 * Set a cache entry.
 *
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON-stringified)
 * @param {object} [opts]
 * @param {string} [opts.category='general'] - Category for bulk operations
 * @param {number} [opts.ttl] - TTL in seconds (defaults to category TTL)
 */
export function set(key, value, { category = 'general', ttl } = {}) {
  if (!db) initCache();

  const now = Math.floor(Date.now() / 1000);
  const effectiveTtl = ttl || TTL[category] || TTL.tool_result;
  const expiresAt = now + effectiveTtl;

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  db.prepare(`
    INSERT OR REPLACE INTO cache_entries (key, category, value, created_at, expires_at, access_count, last_accessed_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(key, category, serialized, now, expiresAt, now);
}

/**
 * Get all entries matching a category. Returns fresh + optionally stale.
 *
 * @param {string} category
 * @param {object} [opts]
 * @param {boolean} [opts.allowStale=false]
 * @returns {Array<{ key: string, value: any, stale: boolean }>}
 */
export function getByCategory(category, { allowStale = false } = {}) {
  if (!db) initCache();

  const now = Math.floor(Date.now() / 1000);
  const query = allowStale
    ? 'SELECT key, value, expires_at FROM cache_entries WHERE category = ?'
    : 'SELECT key, value, expires_at FROM cache_entries WHERE category = ? AND expires_at >= ?';

  const params = allowStale ? [category] : [category, now];
  const rows = db.prepare(query).all(...params);

  return rows.map(row => {
    try {
      return {
        key: row.key,
        value: JSON.parse(row.value),
        stale: row.expires_at < now,
      };
    } catch {
      return { key: row.key, value: row.value, stale: row.expires_at < now };
    }
  });
}

/**
 * Invalidate a specific key or all keys in a category.
 *
 * @param {string} keyOrCategory - Cache key or category name
 * @param {object} [opts]
 * @param {boolean} [opts.isCategory=false] - If true, delete all entries in category
 */
export function invalidate(keyOrCategory, { isCategory = false } = {}) {
  if (!db) initCache();

  if (isCategory) {
    db.prepare('DELETE FROM cache_entries WHERE category = ?').run(keyOrCategory);
  } else {
    db.prepare('DELETE FROM cache_entries WHERE key = ?').run(keyOrCategory);
  }
}

/**
 * Get or set sync state (for tracking last-sync timestamps, etc.).
 */
export function getSyncState(key) {
  if (!db) initCache();
  const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSyncState(key, value) {
  if (!db) initCache();
  const now = Math.floor(Date.now() / 1000);
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(
    'INSERT OR REPLACE INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)'
  ).run(key, serialized, now);
}

/**
 * Cache stats for diagnostics.
 */
export function getStats() {
  if (!db) initCache();

  const now = Math.floor(Date.now() / 1000);
  const total = db.prepare('SELECT COUNT(*) as count FROM cache_entries').get();
  const fresh = db.prepare('SELECT COUNT(*) as count FROM cache_entries WHERE expires_at >= ?').get(now);
  const stale = total.count - fresh.count;
  const categories = db.prepare(
    'SELECT category, COUNT(*) as count FROM cache_entries GROUP BY category'
  ).all();

  return {
    total: total.count,
    fresh: fresh.count,
    stale,
    categories: Object.fromEntries(categories.map(c => [c.category, c.count])),
    dbPath: DB_PATH,
  };
}

/**
 * Remove all expired entries.
 */
export function cleanExpired() {
  if (!db) return;
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('DELETE FROM cache_entries WHERE expires_at < ?').run(now);
  return result.changes;
}

/**
 * Close the database connection. Call on process exit.
 */
export function closeCache() {
  if (db) {
    db.close();
    db = null;
  }
}
