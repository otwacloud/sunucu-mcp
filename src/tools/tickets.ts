import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { jsonResult, safeHandler } from './_helpers';

export function registerTicketTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_list_tickets',
    { title: 'List support tickets', description: 'Every support ticket on the account.', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/tickets'))),
  );

  server.registerTool(
    'sunucu_get_ticket',
    { title: 'Get a ticket', description: 'Ticket detail with the message thread.', inputSchema: { id: z.string().describe('Ticket UUID.') } },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/tickets/${encodeURIComponent(id)}`))),
  );

  server.registerTool(
    'sunucu_open_ticket',
    {
      title: 'Open a support ticket',
      description: 'Open a new support ticket. Idempotent per call.',
      inputSchema: {
        subject: z.string().min(3).max(255).describe('Ticket subject.'),
        message: z.string().min(10).describe('The opening message body.'),
        department: z.enum(['billing', 'technical', 'sales', 'abuse', 'other']).optional().describe('Department (default other).'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority (default medium).'),
      },
    },
    safeHandler(async (body) => jsonResult(await client.request('/v1/tickets', { method: 'POST', idempotent: true, body }))),
  );

  server.registerTool(
    'sunucu_reply_ticket',
    {
      title: 'Reply to a ticket',
      description: 'Post a customer reply on an existing ticket.',
      inputSchema: { id: z.string().describe('Ticket UUID.'), body: z.string().min(1).describe('Reply text.') },
    },
    safeHandler(async ({ id, body }) =>
      jsonResult(await client.request(`/v1/tickets/${encodeURIComponent(id)}/reply`, { method: 'POST', body: { body } }))),
  );

  server.registerTool(
    'sunucu_close_ticket',
    { title: 'Close a ticket', description: 'Close a support ticket.', inputSchema: { id: z.string().describe('Ticket UUID.') } },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/tickets/${encodeURIComponent(id)}/close`, { method: 'POST' }))),
  );
}
