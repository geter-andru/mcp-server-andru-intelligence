/**
 * Trusted API hosts (1.9.6).
 *
 * ANDRU_API_URL and ANDRU_WS_URL decide where the API key is sent. A typo or a copied config
 * that points them at another host would hand that host the key, so only Andru's own hosts and
 * this machine are accepted. Set ANDRU_ALLOW_CUSTOM_API_URL=true to use any other host on purpose.
 */

const TRUSTED_HOSTS = ['andru-ai.com', 'hs-andru-test.onrender.com'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function isTrustedHost(hostname) {
  return TRUSTED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

/**
 * True when `url` points at an Andru host (https/wss) or this machine, whatever
 * ANDRU_ALLOW_CUSTOM_API_URL says. The hosted server's relay key is sent only to these.
 * @param {string} url
 */
export function isAndruApiUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return LOCAL_HOSTS.includes(hostname) || ((protocol === 'https:' || protocol === 'wss:') && isTrustedHost(hostname));
  } catch {
    return false;
  }
}

/**
 * Throws unless `url` points at an Andru host (https/wss) or this machine (any scheme).
 * @param {string} url
 * @param {string} [name] - the setting the URL came from, for the error message
 * @returns {string} the URL, unchanged
 */
export function assertTrustedApiUrl(url, name = 'ANDRU_API_URL') {
  if (process.env.ANDRU_ALLOW_CUSTOM_API_URL === 'true') return url;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${name} is not a valid URL: ${url}`);
  }

  const { protocol, hostname } = parsed;
  if (LOCAL_HOSTS.includes(hostname)) return url;
  if ((protocol === 'https:' || protocol === 'wss:') && isTrustedHost(hostname)) return url;

  throw new Error(
    `${name} points at ${parsed.host}, which is not an Andru host. Your API key is only sent to ` +
    `https://*.andru-ai.com or this machine. Set ANDRU_ALLOW_CUSTOM_API_URL=true to use another host on purpose.`
  );
}
