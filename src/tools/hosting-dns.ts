import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { mediumConfirm } from '../guards/confirm';
import { jsonResult, safeHandler } from './_helpers';

const idArg = { id: z.string().describe('Hosting account UUID. Retrieve via sunucu_list_hosting.') };
const recordArg = { recordId: z.string().describe('Record id from sunucu_get_hosting_dns.') };

const recordBody = {
  host: z.string().max(253).optional().describe('Name relative to the zone: "@" for the apex, "www", "_dmarc"… (default "@").'),
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']).describe('Record type.'),
  value: z.string().max(4096).describe('Record value (IP, target hostname with trailing dot, TXT text, CAA value…).'),
  ttl: z.number().int().min(60).max(604800).optional().describe('TTL in seconds (default 3600).'),
  priority: z.number().int().min(0).max(65535).optional().describe('MX / SRV priority.'),
  weight: z.number().int().min(0).max(65535).optional().describe('SRV weight.'),
  port: z.number().int().min(0).max(65535).optional().describe('SRV port.'),
  flags: z.number().int().min(0).max(255).optional().describe('CAA flags.'),
  tag: z.string().max(16).optional().describe('CAA tag (issue, issuewild, iodef).'),
};

/** DNS zone of a hosting site's domain, when our nameservers serve it.
 *  Reads: hosting:read. Changes: hosting:manage — a record can take the site
 *  or its mail offline, so deletes and switching our mail records off are
 *  confirm-gated. Records we own (SOA, our NS) are locked server-side. */
export function registerHostingDnsTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_get_hosting_dns',
    {
      title: 'Get a hosting DNS zone',
      description: 'Records (id; managed = created by us; locked = not editable), nameservers, dnssec, defaults + defaultsDrifted, and mailEnabled (whether we handle the domain\'s mail).',
      inputSchema: idArg,
    },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/dns`))),
  );

  server.registerTool(
    'sunucu_get_hosting_dns_defaults',
    { title: 'Preview default DNS records', description: 'What sunucu_reset_hosting_dns would add or correct, and what is already right. Read-only.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/dns/defaults`))),
  );

  server.registerTool(
    'sunucu_add_hosting_dns_record',
    { title: 'Add a DNS record', description: 'Add one record to the zone. Returns the full record list.', inputSchema: { ...idArg, ...recordBody } },
    safeHandler(async ({ id, ...body }) =>
      jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/dns/records`, { method: 'POST', body, idempotent: true }))),
  );

  server.registerTool(
    'sunucu_update_hosting_dns_record',
    { title: 'Update a DNS record', description: 'Replace one record (all fields as for add). Returns the full record list.', inputSchema: { ...idArg, ...recordArg, ...recordBody } },
    safeHandler(async ({ id, recordId, ...body }) =>
      jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/dns/records/${encodeURIComponent(recordId)}`, { method: 'PUT', body }))),
  );

  server.registerTool(
    'sunucu_delete_hosting_dns_record',
    {
      title: 'Delete a DNS record',
      description: 'Delete one record. Deleting a record we created (managed: true) can take the site or its mail offline — show the user the record first.',
      inputSchema: { ...idArg, ...recordArg, ...mediumConfirm },
    },
    safeHandler(async ({ id, recordId }) =>
      jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/dns/records/${encodeURIComponent(recordId)}`, { method: 'DELETE' }))),
  );

  server.registerTool(
    'sunucu_set_hosting_dns_mail',
    {
      title: 'Switch our mail records on/off',
      description: 'enabled:false removes only the mail records we wrote (MX, SPF, DMARC, mail A) — use it when the domain\'s mail is hosted elsewhere; the user\'s own records are untouched. enabled:true puts ours back.',
      inputSchema: { ...idArg, enabled: z.boolean().describe('Whether we handle this domain\'s mail.'), ...mediumConfirm },
    },
    safeHandler(async ({ id, enabled }) =>
      jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/dns/mail-enabled`, { method: 'POST', body: { enabled } }))),
  );

  server.registerTool(
    'sunucu_reset_hosting_dns',
    { title: 'Restore default DNS records', description: 'Add or correct the records we would have created. Additive — never deletes a record the user added.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/dns/reset`, { method: 'POST' }))),
  );
}
