import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { jsonResult, safeHandler } from './_helpers';

export function registerBillingTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_list_invoices',
    {
      title: 'List invoices',
      description: 'Paginated invoice list.',
      inputSchema: {
        page: z.number().int().min(1).optional().describe('Page number (default 1).'),
        limit: z.number().int().min(1).max(100).optional().describe('Page size (default 50).'),
      },
    },
    safeHandler(async ({ page, limit }) =>
      jsonResult(await client.request('/v1/billing/invoices', { query: { page, limit } }))),
  );

  server.registerTool(
    'sunucu_get_invoice',
    { title: 'Get an invoice', description: 'A single invoice with line items.', inputSchema: { id: z.string().describe('Invoice id.') } },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/billing/invoices/${encodeURIComponent(id)}`))),
  );

  server.registerTool(
    'sunucu_get_wallet',
    { title: 'Get wallet balance', description: 'Prepaid wallet balance and state.', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/billing/wallet'))),
  );

  server.registerTool(
    'sunucu_list_wallet_transactions',
    {
      title: 'List wallet transactions',
      description: 'Recent wallet transactions.',
      inputSchema: { limit: z.number().int().min(1).max(100).optional().describe('How many (default 20).') },
    },
    safeHandler(async ({ limit }) =>
      jsonResult(await client.request('/v1/billing/wallet/transactions', { query: { limit } }))),
  );

  server.registerTool(
    'sunucu_set_auto_recharge',
    {
      title: 'Configure wallet auto-recharge',
      description: 'Turn on/off automatic wallet top-up and set the threshold + amount (in USD cents). Requires the opt-in billing:write scope.',
      inputSchema: {
        enabled: z.boolean().optional().describe('Enable/disable auto-recharge.'),
        thresholdUsdCents: z.number().int().min(100).optional().describe('Top up when the balance drops below this (USD cents).'),
        amountUsdCents: z.number().int().min(500).optional().describe('How much to add each time (USD cents).'),
      },
    },
    safeHandler(async ({ enabled, thresholdUsdCents, amountUsdCents }) =>
      jsonResult(await client.request('/v1/billing/wallet/auto-recharge', { method: 'PATCH', body: { enabled, threshold_usd_cents: thresholdUsdCents, amount_usd_cents: amountUsdCents } }))),
  );
}
