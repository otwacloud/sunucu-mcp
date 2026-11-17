import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { jsonResult, safeHandler } from './_helpers';

const idArg = { id: z.string().describe('Hosting account UUID. Retrieve via sunucu_list_hosting.') };

export function registerHostingTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_list_hosting',
    { title: 'List hosting accounts', description: 'Every web-hosting account on the account.', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/hosting'))),
  );

  server.registerTool(
    'sunucu_get_hosting',
    { title: 'Get a hosting account', description: 'Detail + connection info for one hosting account.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}`))),
  );

  server.registerTool(
    'sunucu_set_hosting_custom_domain',
    {
      title: 'Set a custom domain on hosting',
      description: 'Attach a custom domain to a hosting account.',
      inputSchema: { ...idArg, domain: z.string().describe('The custom domain, e.g. example.com.') },
    },
    safeHandler(async ({ id, domain }) =>
      jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/custom-domain`, { method: 'PUT', body: { domain } }))),
  );

  server.registerTool(
    'sunucu_verify_hosting_custom_domain',
    {
      title: 'Verify a hosting custom domain',
      description: 'Re-check DNS and attach the custom domain once it points to us.',
      inputSchema: idArg,
    },
    safeHandler(async ({ id }) =>
      jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/custom-domain/verify`, { method: 'POST' }))),
  );

  server.registerTool(
    'sunucu_remove_hosting_custom_domain',
    {
      title: 'Remove a hosting custom domain',
      description: 'Detach the custom domain from a hosting account.',
      inputSchema: idArg,
    },
    safeHandler(async ({ id }) =>
      jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/custom-domain`, { method: 'DELETE' }))),
  );
}
