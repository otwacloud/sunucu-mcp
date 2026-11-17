import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SunucuClient } from '../client/http';
import { jsonResult, safeHandler } from './_helpers';

export function registerAccountTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_get_account',
    {
      title: 'Get account profile',
      description: 'Returns the authenticated sunucu.com account profile (id, email, name, country, verification, created date).',
      inputSchema: {},
    },
    safeHandler(async () => jsonResult(await client.request('/v1/account'))),
  );
}
