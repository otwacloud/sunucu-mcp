import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SunucuClient } from '../client/http';
import { registerAccountTools } from './account';
import { registerServerTools } from './servers';
import { registerPoolTools } from './pools';
import { registerHostingTools } from './hosting';
import { registerHostingPanelTools } from './hosting-panel';
import { registerHostingDnsTools } from './hosting-dns';
import { registerMailTools } from './mail';
import { registerDomainTools } from './domains';
import { registerBillingTools } from './billing';
import { registerTicketTools } from './tickets';
import { registerWebhookTools } from './webhooks';

export function registerAllTools(server: McpServer, client: SunucuClient): void {
  registerAccountTools(server, client);
  registerServerTools(server, client);
  registerPoolTools(server, client);
  registerHostingTools(server, client);
  registerHostingPanelTools(server, client);
  registerHostingDnsTools(server, client);
  registerMailTools(server, client);
  registerDomainTools(server, client);
  registerBillingTools(server, client);
  registerTicketTools(server, client);
  registerWebhookTools(server, client);
}
