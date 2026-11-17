import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { jsonResult, safeHandler } from './_helpers';

const idArg = { id: z.string().describe('Webhook subscription UUID.') };

export function registerWebhookTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_list_webhook_events',
    { title: 'List webhook events', description: 'Every event a webhook can subscribe to. Use these names in sunucu_create_webhook / sunucu_update_webhook (or "*" for all).', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/webhooks/events'))),
  );

  server.registerTool(
    'sunucu_list_webhooks',
    { title: 'List webhooks', description: 'Every webhook subscription on the account (secrets masked).', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/webhooks'))),
  );

  server.registerTool(
    'sunucu_get_webhook',
    { title: 'Get a webhook', description: 'Detail for one webhook subscription.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/webhooks/${encodeURIComponent(id)}`))),
  );

  server.registerTool(
    'sunucu_list_webhook_deliveries',
    {
      title: 'List webhook deliveries',
      description: 'Recent delivery attempts for a webhook subscription.',
      inputSchema: { ...idArg, limit: z.number().int().min(1).max(200).optional().describe('How many (default 50).') },
    },
    safeHandler(async ({ id, limit }) =>
      jsonResult(await client.request(`/v1/webhooks/${encodeURIComponent(id)}/deliveries`, { query: { limit } }))),
  );

  server.registerTool(
    'sunucu_create_webhook',
    {
      title: 'Create a webhook',
      description: 'Subscribe a URL to events. The signing secret is returned ONCE here — summarise it to the user to store securely.',
      inputSchema: {
        url: z.string().describe('HTTPS URL to receive POSTs.'),
        events: z.array(z.string()).min(1).describe('Event names, or ["*"] for all. e.g. ["server.created","invoice.paid"].'),
        description: z.string().optional().describe('Optional label.'),
      },
    },
    safeHandler(async (body) => jsonResult(await client.request('/v1/webhooks', { method: 'POST', body }))),
  );

  server.registerTool(
    'sunucu_update_webhook',
    {
      title: 'Update a webhook',
      description: 'Change url, events, description, or pause/resume (isActive). Only provided fields change.',
      inputSchema: {
        ...idArg,
        url: z.string().optional(),
        events: z.array(z.string()).min(1).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional().describe('false pauses delivery, true resumes.'),
      },
    },
    safeHandler(async ({ id, ...body }) =>
      jsonResult(await client.request(`/v1/webhooks/${encodeURIComponent(id)}`, { method: 'PATCH', body }))),
  );

  server.registerTool(
    'sunucu_delete_webhook',
    { title: 'Delete a webhook', description: 'Delete a webhook subscription.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' }))),
  );

  server.registerTool(
    'sunucu_rotate_webhook_secret',
    {
      title: 'Rotate a webhook secret',
      description: 'Issue a fresh signing secret (returned ONCE). The old secret stops working immediately.',
      inputSchema: idArg,
    },
    safeHandler(async ({ id }) =>
      jsonResult(await client.request(`/v1/webhooks/${encodeURIComponent(id)}/rotate-secret`, { method: 'POST' }))),
  );

  server.registerTool(
    'sunucu_redeliver_webhook',
    {
      title: 'Redeliver a webhook event',
      description: 'Re-queue a past delivery for another attempt.',
      inputSchema: { ...idArg, deliveryId: z.string().describe('Delivery id from sunucu_list_webhook_deliveries.') },
    },
    safeHandler(async ({ id, deliveryId }) =>
      jsonResult(await client.request(`/v1/webhooks/${encodeURIComponent(id)}/deliveries/${encodeURIComponent(deliveryId)}/redeliver`, { method: 'POST' }))),
  );
}
