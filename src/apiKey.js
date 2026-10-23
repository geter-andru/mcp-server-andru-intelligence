/**
 * What counts as a configured API key (1.10.3). Andru issues keys as sk_live_ or sk_test_ followed by
 * 64 hex characters (backend platformApiKeyService). Anything else in ANDRU_API_KEY, such as the
 * README's old "sk_live_your_key_here" or a pasted fragment, is treated as no key, so the agent can
 * still sign the person up from the conversation instead of every call failing with "Invalid API key".
 */
export const REAL_KEY = /^sk_(live|test)_[0-9a-f]{64}$/;

/** The key if it looks like one Andru issued, else null. */
export function realKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return REAL_KEY.test(key) ? key : null;
}
