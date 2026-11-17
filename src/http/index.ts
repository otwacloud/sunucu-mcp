#!/usr/bin/env node
import express from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../server';
import { packageInfo } from '../util/version';

const PORT = parseInt(process.env.PORT || '3218', 10);
const HOST = process.env.HOST || '127.0.0.1';
const API_BASE = (process.env.SUNUCU_API_BASE?.trim() || 'https://api.sunucu.com').replace(/\/+$/, '');
// Public hostname this server is exposed under — used in the RFC 9728 metadata
// + WWW-Authenticate challenge. Override for staging.
const PUBLIC_BASE = (process.env.MCP_PUBLIC_BASE?.trim() || 'https://mcp.sunucu.com').replace(/\/+$/, '');
// OAuth 2.0 Authorization Server clients should talk to (the sunucu.com API
// host that issues keys + device-code tokens). Clients that support OAuth
// discover the endpoints via the AS metadata there.
const OAUTH_AS = (process.env.SUNUCU_OAUTH_AS?.trim() || 'https://api.sunucu.com').replace(/\/+$/, '');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '1mb' }));

const pkg = packageInfo();

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ ok: true, service: pkg.name, version: pkg.version, apiBase: API_BASE });
});

// RFC 9728 Protected Resource Metadata — announces this MCP server is an
// OAuth-protected resource served by the sunucu.com authorization server.
// Purely additive: Bearer API-key callers keep working unchanged.
const protectedResourceMetadata = () => ({
  resource: `${PUBLIC_BASE}/mcp`,
  authorization_servers: [OAUTH_AS],
  bearer_methods_supported: ['header'],
  scopes_supported: [
    'account:read',
    'servers:read', 'servers:write', 'servers:destroy',
    'hosting:read', 'hosting:write',
    'domains:read', 'domains:write',
    'billing:read',
    'tickets:read', 'tickets:write',
    'webhooks:read', 'webhooks:write',
  ],
  resource_name: 'sunucu-mcp',
  resource_documentation: 'https://sunucu.com/developers',
});
app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=3600').json(protectedResourceMetadata());
});
app.get('/.well-known/oauth-protected-resource/mcp', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=3600').json(protectedResourceMetadata());
});

const WWW_AUTH_HEADER =
  `Bearer realm="sunucu-mcp", resource_metadata="${PUBLIC_BASE}/.well-known/oauth-protected-resource"`;

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    transport: 'streamable-http',
    docs: 'https://sunucu.com/developers',
    endpoints: { mcp: 'POST /mcp', health: 'GET /healthz' },
    auth: 'Bearer snc_… (from https://sunucu.com/account/api-keys) or an OAuth access token',
  });
});

function extractBearer(req: Request): string | null {
  const raw = req.header('authorization') || req.header('Authorization');
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/.exec(raw.trim());
  return m && m[1] ? m[1].trim() : null;
}

/** Stateless Streamable HTTP — fresh McpServer + transport per request, scoped
 *  to the caller's bearer token. Accepts `snc_…` API keys and `snc_at_…` OAuth
 *  access tokens (both validated upstream by the sunucu.com API). */
app.post('/mcp', async (req: Request, res: Response) => {
  const token = extractBearer(req);
  if (!token) {
    res.set('WWW-Authenticate', WWW_AUTH_HEADER).status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Missing Authorization header. Set "Authorization: Bearer snc_…" with a key from https://sunucu.com/account/api-keys' },
      id: null,
    });
    return;
  }
  if (!token.startsWith('snc_')) {
    res.set('WWW-Authenticate', WWW_AUTH_HEADER).status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Bearer token does not look like a sunucu.com credential (expected prefix "snc_").' },
      id: null,
    });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createServer({ apiKey: token, apiBase: API_BASE });

  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[sunucu-mcp-http] handler error: ${msg}\n`);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: `Internal error: ${msg}` }, id: null });
    }
  }
});

// Stateless — refuse the session-oriented GET/DELETE forms per spec.
app.get('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method Not Allowed. This server is stateless — use POST /mcp.' }, id: null });
});
app.delete('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method Not Allowed. This server is stateless.' }, id: null });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

app.use((err: Error, req: Request, res: Response, _next: express.NextFunction) => {
  const id = randomUUID();
  process.stderr.write(`[sunucu-mcp-http] ${id} ${req.method} ${req.path}: ${err.stack || err.message}\n`);
  if (!res.headersSent) res.status(500).json({ error: 'internal_error', requestId: id });
});

const httpServer = app.listen(PORT, HOST, () => {
  process.stdout.write(`[sunucu-mcp-http] ${pkg.name} ${pkg.version} listening on ${HOST}:${PORT} (API base: ${API_BASE})\n`);
});

const shutdown = (signal: string): void => {
  process.stderr.write(`[sunucu-mcp-http] shutdown on ${signal}\n`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
