import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SunucuClient } from './client/http';
import { registerAllTools } from './tools/_register';
import { packageInfo } from './util/version';
import type { SunucuEnv } from './util/env';

/** Build a fresh McpServer wired to a SunucuClient scoped to one API key.
 *  The HTTP transport calls this per-request (stateless); stdio calls it once. */
export function createServer(env: SunucuEnv): McpServer {
  const pkg = packageInfo();
  const server = new McpServer({ name: pkg.name, version: pkg.version });
  const client = new SunucuClient({ apiKey: env.apiKey, apiBase: env.apiBase });
  registerAllTools(server, client);
  return server;
}
