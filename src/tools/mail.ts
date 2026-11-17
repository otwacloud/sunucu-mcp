import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { mediumConfirm } from '../guards/confirm';
import { jsonResult, safeHandler } from './_helpers';

const domainIdArg = { domainId: z.number().int().describe('Mail domain id. Retrieve via sunucu_list_mail_domains.') };

/** Email-hosting tools — full parity with the mail panel. Reads carry mail:read,
 *  mutations carry mail:write. */
export function registerMailTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_mail_setup',
    {
      title: 'Mail setup DNS records',
      description: 'The DNS records to add so mail for a domain routes to us, plus the webmail address. Give the domain to get the records composed for it — the MX is mail.<that domain>, not a shared host.',
      inputSchema: { domain: z.string().optional().describe('Domain to compose the records for, e.g. example.com.') },
    },
    safeHandler(async ({ domain }) => jsonResult(await client.request(
      domain ? `/v1/mail/setup?domain=${encodeURIComponent(domain)}` : '/v1/mail/setup',
    ))),
  );

  server.registerTool(
    'sunucu_list_mail_domains',
    { title: 'List mail domains', description: 'Every mail domain on the account.', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/mail/domains'))),
  );

  server.registerTool(
    'sunucu_add_mail_domain',
    { title: 'Add a mail domain', description: 'Enable email hosting for a domain.', inputSchema: { domain: z.string().describe('Domain name, e.g. example.com.') } },
    safeHandler(async ({ domain }) => jsonResult(await client.request('/v1/mail/domains', { method: 'POST', body: { domain } }))),
  );

  server.registerTool(
    'sunucu_delete_mail_domain',
    { title: 'Remove a mail domain', description: 'Disable email hosting for a domain — deletes its mailboxes and aliases. Set confirm:true.', inputSchema: { ...domainIdArg, ...mediumConfirm } },
    safeHandler(async ({ domainId }) => jsonResult(await client.request(`/v1/mail/domains/${domainId}`, { method: 'DELETE' }))),
  );

  server.registerTool(
    'sunucu_list_domain_mailboxes',
    { title: 'List a mail domain\'s mailboxes', description: 'Mailboxes under one mail domain.', inputSchema: domainIdArg },
    safeHandler(async ({ domainId }) => jsonResult(await client.request(`/v1/mail/domains/${domainId}/mailboxes`))),
  );

  server.registerTool(
    'sunucu_list_domain_aliases',
    { title: 'List a mail domain\'s aliases', description: 'Forwarding aliases under one mail domain.', inputSchema: domainIdArg },
    safeHandler(async ({ domainId }) => jsonResult(await client.request(`/v1/mail/domains/${domainId}/aliases`))),
  );

  server.registerTool(
    'sunucu_list_mailboxes',
    { title: 'List all mailboxes', description: 'Every mailbox across all your mail domains.', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/mail/mailboxes'))),
  );

  server.registerTool(
    'sunucu_create_mailbox',
    {
      title: 'Create a mailbox',
      description: 'Create a mailbox on a mail domain.',
      inputSchema: {
        ...domainIdArg,
        localPart: z.string().describe('The part before @ (e.g. "info").'),
        password: z.string().describe('Mailbox password.'),
        quotaMb: z.number().int().optional().describe('Mailbox quota in MB (optional).'),
      },
    },
    safeHandler(async ({ domainId, localPart, password, quotaMb }) =>
      jsonResult(await client.request('/v1/mail/mailboxes', { method: 'POST', body: { domain_id: domainId, local_part: localPart, password, quota_mb: quotaMb } }))),
  );

  server.registerTool(
    'sunucu_reset_mailbox_password',
    { title: 'Reset a mailbox password', description: 'Set a new password for a mailbox.', inputSchema: { id: z.number().int().describe('Mailbox id.'), password: z.string().describe('New password.') } },
    safeHandler(async ({ id, password }) => jsonResult(await client.request(`/v1/mail/mailboxes/${id}/password`, { method: 'PATCH', body: { password } }))),
  );

  server.registerTool(
    'sunucu_delete_mailbox',
    { title: 'Delete a mailbox', description: 'Permanently delete a mailbox and its mail. Set confirm:true.', inputSchema: { id: z.number().int().describe('Mailbox id.'), ...mediumConfirm } },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/mail/mailboxes/${id}`, { method: 'DELETE' }))),
  );

  server.registerTool(
    'sunucu_create_alias',
    {
      title: 'Create a forwarding alias',
      description: 'Create a forwarding alias (source → destination).',
      inputSchema: {
        ...domainIdArg,
        sourceLocal: z.string().describe('Alias source local-part (e.g. "sales").'),
        destination: z.string().describe('Destination email address.'),
      },
    },
    safeHandler(async ({ domainId, sourceLocal, destination }) =>
      jsonResult(await client.request('/v1/mail/aliases', { method: 'POST', body: { domain_id: domainId, source_local: sourceLocal, destination } }))),
  );

  server.registerTool(
    'sunucu_delete_alias',
    { title: 'Delete a forwarding alias', description: 'Remove a forwarding alias.', inputSchema: { id: z.number().int().describe('Alias id.') } },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/mail/aliases/${id}`, { method: 'DELETE' }))),
  );
}
