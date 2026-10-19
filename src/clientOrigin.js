/**
 * The person's IP and country on the hosted HTTP server (2026-10-19).
 *
 * The hosted server calls the Andru API for its users, so the API sees Render's address, not the
 * person's, and its 30-day security log (andru-ai.com/privacy §2.4) recorded every hosted call
 * under one IP. The server now passes the person's IP and country on as X-Andru-Client-IP and
 * X-Andru-Client-Country, with X-Andru-Relay-Key. The API believes them only when that key equals
 * its own MCP_RELAY_KEY, so nobody else can put an address of their choice in the log. Without
 * MCP_RELAY_KEY (stdio, the CLI, a self-hosted HTTP server) nothing is sent.
 *
 * The person's IP is req.ip (httpApp.js trusts Render's 2 proxy hops). When req.ip is itself a
 * Cloudflare address (another Cloudflare hop in front), cf-connecting-ip is used instead. Anyone can
 * send that header, so it is believed only then — the same rule as the API (backend
 * src/utils/requestOrigin.js).
 */
import net from 'node:net';
import { AsyncLocalStorage } from 'node:async_hooks';

// https://www.cloudflare.com/ips/ (checked 2026-10-16, the same list as the API)
const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];
const CLOUDFLARE_V6 = [
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];

const cloudflare = new net.BlockList();
for (const c of CLOUDFLARE_V4) { const [a, p] = c.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv4'); }
for (const c of CLOUDFLARE_V6) { const [a, p] = c.split('/'); cloudflare.addSubnet(a, Number(p), 'ipv6'); }

/** "::ffff:1.2.3.4" → "1.2.3.4"; anything that isn't an IP → null. */
export function normalizeIp(value) {
  const s = String(value || '').trim().replace(/^::ffff:/i, '');
  return net.isIP(s) ? s : null;
}

export function isCloudflareIp(ip) {
  const v = normalizeIp(ip);
  return !!v && cloudflare.check(v, net.isIPv6(v) ? 'ipv6' : 'ipv4');
}

/** The person's IP and two-letter country from an incoming request (either may be null). */
export function originOf(req) {
  const peer = normalizeIp(req.ip || req.socket?.remoteAddress);
  const viaCloudflare = !!peer && isCloudflareIp(peer);
  const ip = viaCloudflare ? (normalizeIp(req.headers?.['cf-connecting-ip']) || peer) : peer;
  // Read like the API does: Cloudflare sets it on every request that reaches Render.
  const c = String(req.headers?.['cf-ipcountry'] || '').trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : null;
  return { ip, country };
}

/** The origin of the request being handled; AndruClient reads it for each API call. */
export const requestOrigin = new AsyncLocalStorage();
