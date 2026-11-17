export interface SunucuEnv {
  apiKey: string;
  apiBase: string;
}

const KEYS_URL = 'https://sunucu.com/account/api-keys';

/** Read + validate the env for the stdio transport. The hosted HTTP transport
 *  reads the key per-request instead (see src/http/index.ts). */
export function readEnv(): SunucuEnv {
  const apiKey = process.env.SUNUCU_API_KEY?.trim() || '';
  if (!apiKey) {
    throw new Error(
      `SUNUCU_API_KEY is not set. Create one at ${KEYS_URL} and set the SUNUCU_API_KEY ` +
        'environment variable, then restart this MCP server.',
    );
  }
  if (!apiKey.startsWith('snc_')) {
    throw new Error(
      `SUNUCU_API_KEY does not look like a sunucu.com API key (expected prefix "snc_"). ` +
        `Generate a new key at ${KEYS_URL}.`,
    );
  }
  // The public API is served directly at https://api.sunucu.com/v1/* (the edge
  // rewrites /v1 → the in-app /api/v1). So the base is the host; tools call /v1/*.
  const apiBase = (process.env.SUNUCU_API_BASE?.trim() || 'https://api.sunucu.com').replace(/\/+$/, '');
  return { apiKey, apiBase };
}
