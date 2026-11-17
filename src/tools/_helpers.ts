import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SunucuApiError } from '../client/errors';

/** Format a JSON value as a single pretty-printed text block. */
export function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/** Format a plain prose response (no JSON). */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/** Wrap a tool handler so any throw becomes a structured error result instead
 *  of crashing the transport. */
export function safeHandler<TArgs>(
  fn: (args: TArgs) => Promise<CallToolResult>,
): (args: TArgs) => Promise<CallToolResult> {
  return async (args: TArgs) => {
    try {
      return await fn(args);
    } catch (err: unknown) {
      const message =
        err instanceof SunucuApiError ? err.message : err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  };
}
