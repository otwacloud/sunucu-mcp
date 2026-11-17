import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { mediumConfirm } from '../guards/confirm';
import { jsonResult, safeHandler } from './_helpers';

const idArg = { id: z.string().describe('Hosting account UUID. Retrieve via sunucu_list_hosting.') };

/** Site control-panel tools (scope `hosting:manage`). Covers the automatable
 *  operations; streaming (file/backup download, upload), the browser-SSH
 *  terminal, and git deploy live on the REST API only. */
export function registerHostingPanelTools(server: McpServer, client: SunucuClient): void {
  server.registerTool(
    'sunucu_hosting_stats',
    { title: 'Hosting site stats', description: 'Disk/inode/bandwidth/mailbox usage for a hosting account.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/stats`))),
  );

  server.registerTool(
    'sunucu_hosting_logs',
    { title: 'Tail hosting logs', description: 'Tail the access or error log.', inputSchema: { ...idArg, kind: z.enum(['access', 'error']).optional(), lines: z.number().int().optional() } },
    safeHandler(async ({ id, kind, lines }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/logs?kind=${kind || 'access'}&lines=${lines || 100}`))),
  );

  server.registerTool(
    'sunucu_hosting_set_php',
    { title: 'Set PHP version', description: 'Switch the account\'s PHP-FPM version.', inputSchema: { ...idArg, phpVersion: z.string().describe('e.g. "8.3".') } },
    safeHandler(async ({ id, phpVersion }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/php-version`, { method: 'PUT', body: { php_version: phpVersion } }))),
  );

  server.registerTool(
    'sunucu_hosting_get_cron',
    { title: 'Get cron jobs', description: 'Read the crontab.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/cron`))),
  );

  server.registerTool(
    'sunucu_hosting_set_cron',
    { title: 'Set cron jobs', description: 'Replace the crontab.', inputSchema: { ...idArg, jobs: z.array(z.object({ schedule: z.string(), command: z.string(), comment: z.string().nullable().optional() })), header: z.string().optional() } },
    safeHandler(async ({ id, jobs, header }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/cron`, { method: 'PUT', body: { jobs, header } }))),
  );

  server.registerTool(
    'sunucu_hosting_list_databases',
    { title: 'List hosting databases', description: 'Extra MySQL databases on the account.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/databases`))),
  );

  server.registerTool(
    'sunucu_hosting_add_database',
    { title: 'Add a hosting database', description: 'Create an extra MySQL database.', inputSchema: { ...idArg, suffix: z.string().describe('Database name suffix.') } },
    safeHandler(async ({ id, suffix }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/databases`, { method: 'POST', body: { suffix } }))),
  );

  server.registerTool(
    'sunucu_hosting_remove_database',
    { title: 'Remove a hosting database', description: 'Delete an extra MySQL database. Set confirm:true.', inputSchema: { ...idArg, name: z.string().describe('Database name.'), ...mediumConfirm } },
    safeHandler(async ({ id, name }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/databases/${encodeURIComponent(name)}`, { method: 'DELETE' }))),
  );

  server.registerTool(
    'sunucu_hosting_list_backups',
    { title: 'List hosting backups', description: 'Site backups (restore points).', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/backups`))),
  );

  server.registerTool(
    'sunucu_hosting_create_backup',
    { title: 'Create a hosting backup', description: 'Create a new site backup.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/backups`, { method: 'POST' }))),
  );

  server.registerTool(
    'sunucu_hosting_restore_backup',
    { title: 'Restore a hosting backup', description: 'Restore the site from a backup — overwrites current files. Set confirm:true.', inputSchema: { ...idArg, backupId: z.string(), ...mediumConfirm } },
    safeHandler(async ({ id, backupId }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/backups/${encodeURIComponent(backupId)}/restore`, { method: 'POST' }))),
  );

  server.registerTool(
    'sunucu_hosting_delete_backup',
    { title: 'Delete a hosting backup', description: 'Delete a backup. Set confirm:true.', inputSchema: { ...idArg, backupId: z.string(), ...mediumConfirm } },
    safeHandler(async ({ id, backupId }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/backups/${encodeURIComponent(backupId)}`, { method: 'DELETE' }))),
  );

  server.registerTool(
    'sunucu_hosting_list_files',
    { title: 'List site files', description: 'List a directory in the site (default /public_html).', inputSchema: { ...idArg, path: z.string().optional() } },
    safeHandler(async ({ id, path }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path || '/public_html')}`))),
  );

  server.registerTool(
    'sunucu_hosting_read_file',
    { title: 'Read a site file', description: 'Read a text file\'s contents.', inputSchema: { ...idArg, path: z.string() } },
    safeHandler(async ({ id, path }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/files/read?path=${encodeURIComponent(path)}`))),
  );

  server.registerTool(
    'sunucu_hosting_write_file',
    { title: 'Write a site file', description: 'Create or overwrite a text file.', inputSchema: { ...idArg, path: z.string(), content: z.string() } },
    safeHandler(async ({ id, path, content }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/files`, { method: 'PUT', body: { path, content } }))),
  );

  server.registerTool(
    'sunucu_hosting_delete_file',
    { title: 'Delete a site file/dir', description: 'Delete a file or directory. Set confirm:true.', inputSchema: { ...idArg, path: z.string(), recursive: z.boolean().optional(), ...mediumConfirm } },
    safeHandler(async ({ id, path, recursive }) => jsonResult(await client.request(`/v1/hosting/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path)}&recursive=${recursive ? 'true' : 'false'}`, { method: 'DELETE' }))),
  );
}
