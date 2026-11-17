export class SunucuApiError extends Error {
  override readonly name = 'SunucuApiError';
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

const KEYS_URL = 'https://sunucu.com/account/api-keys';

/** Translate an HTTP response from the sunucu.com API into a message the LLM
 *  can act on — always saying what to do next, not just what went wrong. */
export function mapHttpError(status: number, body: unknown, requestId?: string): SunucuApiError {
  const bodyMessage = extractMessage(body);

  if (status === 401) {
    return new SunucuApiError(
      `SUNUCU_API_KEY is invalid, expired, or revoked. Ask the user to create a fresh key at ${KEYS_URL}, ` +
        'update the SUNUCU_API_KEY env var, and restart this MCP server.',
      status, 'unauthorized', body,
    );
  }
  if (status === 403) {
    return new SunucuApiError(
      bodyMessage ||
        `Forbidden — the API key is missing a required scope. Re-issue a key with the right scopes at ${KEYS_URL}.`,
      status, 'forbidden', body,
    );
  }
  if (status === 402) {
    return new SunucuApiError(
      'Account balance is too low for this operation. Tell the user to top up their wallet at https://sunucu.com/account/wallet.',
      status, 'payment_required', body,
    );
  }
  if (status === 404) {
    return new SunucuApiError(
      bodyMessage || 'Resource not found. If this is a server id, call sunucu_list_servers to see what exists.',
      status, 'not_found', body,
    );
  }
  if (status === 409) {
    return new SunucuApiError(
      bodyMessage || 'Conflict — the resource is already in the target state, or the operation is in progress.',
      status, 'conflict', body,
    );
  }
  if (status === 422 || status === 400) {
    return new SunucuApiError(
      bodyMessage || 'Validation failed. Check the field constraints and call again.',
      status, 'validation_failed', body,
    );
  }
  if (status === 429) {
    return new SunucuApiError(
      'Rate-limited (120 req/min per key). Wait a few seconds before retrying — see the Retry-After header.',
      status, 'rate_limited', body,
    );
  }
  if (status >= 500) {
    const trace = requestId ? ` Request id: ${requestId}.` : '';
    return new SunucuApiError(
      `The sunucu.com API returned ${status}. Retry once, then open a ticket if it persists.${trace}`,
      status, 'upstream_error', body,
    );
  }
  return new SunucuApiError(bodyMessage || `Unexpected HTTP ${status} from the sunucu.com API.`, status, 'unknown', body);
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message === 'string') return b.message;
  if (Array.isArray(b.message)) return b.message.join('; ');
  if (typeof b.error === 'string') return b.error;
  return null;
}
