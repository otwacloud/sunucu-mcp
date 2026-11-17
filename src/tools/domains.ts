import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { jsonResult, safeHandler } from './_helpers';

const idArg = { id: z.string().describe('Domain UUID. Retrieve via sunucu_list_domains.') };

export function registerDomainTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_list_domains',
    { title: 'List domains', description: 'Every registered domain on the account.', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/domains'))),
  );

  server.registerTool(
    'sunucu_get_domain',
    { title: 'Get a domain', description: 'Detail for one domain (status, expiry, nameservers, lock/privacy/auto-renew).', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/domains/${encodeURIComponent(id)}`))),
  );

  server.registerTool(
    'sunucu_update_domain',
    {
      title: 'Update domain settings',
      description: 'Update auto-renew, transfer lock, WHOIS privacy, and/or nameservers. Only the provided fields change.',
      inputSchema: {
        ...idArg,
        auto_renew: z.boolean().optional().describe('Enable/disable auto-renew.'),
        transfer_lock: z.boolean().optional().describe('Enable/disable the registrar transfer lock.'),
        whois_privacy: z.boolean().optional().describe('Enable/disable WHOIS privacy.'),
        nameservers: z.array(z.string()).max(6).optional().describe('Up to 6 nameservers (replaces the set).'),
      },
    },
    safeHandler(async ({ id, ...body }) =>
      jsonResult(await client.request(`/v1/domains/${encodeURIComponent(id)}`, { method: 'PATCH', body }))),
  );
}
