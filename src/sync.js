/**
 * WebSocket Sync Client (Phase 8 — Local Agent Runtime)
 *
 * Connects to the backend WebSocket server (Phase 6) and keeps
 * the local SQLite cache fresh. Handles:
 *
 * - Auth via Supabase/API token
 * - Cache invalidation events from backend
 * - Reconnection with exponential backoff
 * - Initial bulk sync on first connect
 *
 * @module sync
 */

import WebSocket from 'ws';
import { set, invalidate, getSyncState, setSyncState } from './cache.js';

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];
const HEARTBEAT_INTERVAL_MS = 25000; // Slightly under server's 30s

let ws = null;
let reconnectAttempt = 0;
let heartbeatTimer = null;
let reconnectTimer = null;
let isConnecting = false;

/**
 * Start the sync client. Connects to backend WebSocket and
 * keeps the local cache updated.
 *
 * @param {object} opts
 * @param {string} opts.wsUrl - WebSocket URL (e.g., wss://hs-andru-test.onrender.com/ws)
 * @param {string} opts.token - Auth token (Supabase JWT or API key)
 * @param {function} [opts.onSync] - Called when sync event received
 * @param {function} [opts.onError] - Called on connection error
 */
export function startSync({ wsUrl, token, onSync, onError }) {
  if (ws || isConnecting) return;
  isConnecting = true;

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    isConnecting = false;
    if (onError) onError(err);
    scheduleReconnect({ wsUrl, token, onSync, onError });
    return;
  }

  ws.on('open', () => {
    isConnecting = false;
    reconnectAttempt = 0;

    // Authenticate
    ws.send(JSON.stringify({ type: 'auth', token }));

    // Start client heartbeat
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Auth confirmed — request initial sync
    if (msg.type === 'auth_ok') {
      requestInitialSync();
      return;
    }

    // Cache invalidation events from backend
    if (msg.type === 'cache_invalidate') {
      handleCacheInvalidation(msg);
      if (onSync) onSync(msg);
      return;
    }

    // Bulk sync response
    if (msg.type === 'sync_data') {
      handleBulkSync(msg);
      if (onSync) onSync(msg);
      return;
    }

    // Data update pushed from backend (e.g., ICP profile changed)
    if (msg.type === 'data_update') {
      handleDataUpdate(msg);
      if (onSync) onSync(msg);
      return;
    }

    // Soul preamble update (only the compressed preamble — never the full soul)
    if (msg.type === 'soul_update') {
      // Security: only cache the preamble, never full soul content
      if (msg.preamble) {
        set('soul:preamble', msg.preamble, { category: 'soul' });
      }
      if (msg.versionHash) {
        set('soul:version', msg.versionHash, { category: 'soul' });
      }
      if (onSync) onSync(msg);
      return;
    }
  });

  ws.on('close', (code) => {
    cleanup();
    // Don't reconnect if auth failed
    if (code === 4003) {
      if (onError) onError(new Error('Authentication failed'));
      return;
    }
    scheduleReconnect({ wsUrl, token, onSync, onError });
  });

  ws.on('error', (err) => {
    cleanup();
    if (onError) onError(err);
    scheduleReconnect({ wsUrl, token, onSync, onError });
  });
}

/**
 * Stop the sync client. Closes WebSocket and cancels timers.
 */
export function stopSync() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  cleanup();
  reconnectAttempt = 0;
}

/**
 * Whether the sync client is currently connected and authenticated.
 */
export function isSyncConnected() {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

// ─── Internal ────────────────────────────────────────────────────────────────

function cleanup() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (ws) {
    ws.removeAllListeners();
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }
  isConnecting = false;
}

function scheduleReconnect(opts) {
  if (reconnectTimer) return;
  const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startSync(opts);
  }, delay);
}

/**
 * Request bulk data sync from backend.
 * Sends last-sync timestamp so backend only sends changes.
 */
function requestInitialSync() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const lastSync = getSyncState('last_sync_ts');

  // Subscribe to cache invalidation channel
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['cache:updates'],
  }));

  // Request any data that changed since our last sync
  ws.send(JSON.stringify({
    type: 'sync_request',
    since: lastSync || 0,
  }));
}

/**
 * Handle cache invalidation from backend.
 */
function handleCacheInvalidation(msg) {
  if (msg.key) {
    invalidate(msg.key);
  }
  if (msg.category) {
    invalidate(msg.category, { isCategory: true });
  }
}

/**
 * Handle bulk sync data from backend.
 */
function handleBulkSync(msg) {
  if (!msg.entries || !Array.isArray(msg.entries)) return;

  for (const entry of msg.entries) {
    set(entry.key, entry.value, {
      category: entry.category || 'general',
      ttl: entry.ttl,
    });
  }

  // Record sync timestamp
  setSyncState('last_sync_ts', Date.now());
}

/**
 * Handle individual data update from backend.
 */
function handleDataUpdate(msg) {
  if (!msg.key || msg.value === undefined) return;

  set(msg.key, msg.value, {
    category: msg.category || 'general',
    ttl: msg.ttl,
  });
}
