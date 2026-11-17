import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { destructiveConfirm, mediumConfirm } from '../guards/confirm';
import { jsonResult, safeHandler } from './_helpers';

const idArg = { id: z.string().describe('Server UUID. Retrieve via sunucu_list_servers.') };

export function registerServerTools(server: McpServer, client: SunucuClient): void {
  // ── Reads ──────────────────────────────────────────────────────────────
  server.registerTool(
    'sunucu_list_servers',
    { title: 'List servers', description: 'Every server on the account (id, label, status, region, IP). Use the id with per-server tools.', inputSchema: {} },
    safeHandler(async () => jsonResult(await client.request('/v1/servers'))),
  );

  server.registerTool(
    'sunucu_get_server',
    { title: 'Get a server', description: 'Full detail for one server. Always call this before any destructive op so the user can confirm against the current label.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}`))),
  );

  server.registerTool(
    'sunucu_get_server_stats',
    { title: 'Live server stats', description: 'Latest CPU / memory / network / disk usage for a server, fresh from the hypervisor.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/stats`))),
  );

  server.registerTool(
    'sunucu_list_snapshots',
    { title: 'List snapshots', description: 'Disk snapshots (restore points) for a server.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/snapshots`))),
  );

  server.registerTool(
    'sunucu_list_server_ips',
    { title: 'List server IPs & reverse DNS', description: 'Every IP on a server with its current PTR (reverse DNS) record. zoneHosted:false means the PTR cannot be managed here.', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/ips`))),
  );

  server.registerTool(
    'sunucu_list_plan_options',
    { title: 'List plan options (resize targets)', description: 'Plans a server can resize to — same family, same disk size. Returns current plan + options (cheapest first). Pass an option id to sunucu_change_plan. Empty options = no same-disk plans to move to (Cloud Router S/M/L today).', inputSchema: idArg },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/plan-options`))),
  );

  server.registerTool(
    'sunucu_get_server_stats_history',
    {
      title: 'Server usage history',
      description:
        'CPU, memory, network and disk over time from the hypervisor. range: 1h (20 s samples), 24h (5 min), 7d (30 min). ' +
        'A null sample is missing data, not zero. On 24h/7d the in/out and read/write split may be absent — then use netTotal / diskTotal (see `available`).',
      inputSchema: { ...idArg, range: z.enum(['1h', '24h', '7d']).optional().describe('Window (default 1h).') },
    },
    safeHandler(async ({ id, range }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/stats/history`, { query: { range: range ?? '1h' } }))),
  );

  // ── Writes (servers:write) ───────────────────────────────────────────────
  server.registerTool(
    'sunucu_rename_server',
    {
      title: 'Rename a server',
      description: 'Change the display name (1–63 printable characters). Hostname and IP are untouched. Refused while the server is still provisioning.',
      inputSchema: { ...idArg, label: z.string().min(1).max(63).describe('New display name.') },
    },
    safeHandler(async ({ id, label }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/label`, { method: 'PATCH', body: { label } }))),
  );

  server.registerTool(
    'sunucu_power_server',
    {
      title: 'Power action on a server',
      description: 'Start, stop, or reboot a server. stop/reboot interrupt the workload — set confirm:true.',
      inputSchema: {
        ...idArg,
        action: z.enum(['start', 'stop', 'reboot']).describe('Power action.'),
        ...mediumConfirm,
      },
    },
    safeHandler(async ({ id, action }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/power/${action}`, { method: 'POST' }))),
  );

  server.registerTool(
    'sunucu_change_plan',
    {
      title: 'Change plan (resize vCPU/RAM)',
      description: 'Switch a server to another plan in the same family with the same disk size — an in-place vCPU/RAM resize. The server REBOOTS (~1 min); disk never changes. Only the recurring price changes (no proration up, no credit down). Call sunucu_list_plan_options first for valid productIds, and confirm with the user (it reboots).',
      inputSchema: {
        ...idArg,
        productId: z.string().describe('Target plan id — an option id from sunucu_list_plan_options.'),
        ...mediumConfirm,
      },
    },
    safeHandler(async ({ id, productId }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/change-plan`, { method: 'POST', body: { productId } }))),
  );

  // ── Add-ons ──────────────────────────────────────────────────────────────
  server.registerTool(
    'sunucu_list_addons',
    {
      title: 'List server add-ons',
      description: "Add-ons this server's plan offers — extra IPs, /24 class blocks, the SEO IP Pack (7 dedicated IPs each from a DIFFERENT /24, for SEO hosting and sender-reputation isolation) and backups. Prices are in cents: monthly_usd_cents recurs, prorated_usd_cents is what a purchase costs today. Only ONE add-on per type may be active, so owned_by_type:true means not orderable until the active one is removed. available:false with a stock_note means temporarily out of stock.",
      inputSchema: idArg,
    },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/addons`))),
  );

  server.registerTool(
    'sunucu_purchase_addon',
    {
      title: 'Purchase a server add-on',
      description: 'Attach an add-on to a running server. DEBITS the prepaid balance immediately, prorated to the end of the current cycle, and the add-on then renews with the server EVERY MONTH. Call sunucu_list_addons first and show the user both numbers. For IP add-ons the addresses are routed to the server but must be configured inside the guest OS. 400s if an add-on of the same type is already active (remove it first), stock is short, or the balance is insufficient.',
      inputSchema: {
        ...idArg,
        addonId: z.string().describe('Add-on id from sunucu_list_addons.'),
        ...mediumConfirm,
      },
    },
    safeHandler(async ({ id, addonId }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/addons`, { method: 'POST', body: { addonId } }))),
  );

  server.registerTool(
    'sunucu_remove_addon',
    {
      title: 'Remove a server add-on',
      description: 'Cancel an add-on. NO REFUND is issued for the remainder of the current period — the recurring price drops from the NEXT renewal. For IP add-ons this is immediate and disruptive: the addresses are released and stop routing to the server, so anything bound to them (websites, SSL, mail) breaks — tell the user to unconfigure them first.',
      inputSchema: {
        ...idArg,
        addonId: z.string().describe('Add-on id currently active on the server.'),
        ...mediumConfirm,
      },
    },
    safeHandler(async ({ id, addonId }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/addons/${encodeURIComponent(addonId)}`, { method: 'DELETE' }))),
  );

  // (No password-reset tool: the platform never resets a server's root
  // password — credentials are read-only on every surface, /v1 included.)

  server.registerTool(
    'sunucu_create_snapshot',
    {
      title: 'Create a snapshot',
      description: 'Take a disk snapshot of a server. Idempotent per call.',
      inputSchema: {
        ...idArg,
        name: z.string().optional().describe('Optional snapshot name.'),
        description: z.string().optional().describe('Optional description.'),
      },
    },
    safeHandler(async ({ id, name, description }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/snapshots`, {
        method: 'POST', idempotent: true, body: { name, description },
      }))),
  );

  server.registerTool(
    'sunucu_delete_snapshot',
    {
      title: 'Delete a snapshot',
      description: 'Remove a snapshot (does not touch the live disk).',
      inputSchema: { ...idArg, snapshotId: z.string().describe('Snapshot id from sunucu_list_snapshots.') },
    },
    safeHandler(async ({ id, snapshotId }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapshotId)}`, { method: 'DELETE' }))),
  );

  server.registerTool(
    'sunucu_set_server_ptr',
    {
      title: 'Set reverse DNS (PTR)',
      description: 'Point an IP\'s PTR record at a hostname (e.g. mail.example.com). Affects mail deliverability — set confirm:true after telling the user the IP and hostname.',
      inputSchema: {
        ...idArg,
        ip: z.string().describe('IP address on the server (from sunucu_list_server_ips).'),
        hostname: z.string().describe('Hostname the IP should resolve to, e.g. mail.example.com.'),
        ...mediumConfirm,
      },
    },
    safeHandler(async ({ id, ip, hostname }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/ips/${encodeURIComponent(ip)}/ptr`, {
        method: 'PUT', body: { hostname },
      }))),
  );

  server.registerTool(
    'sunucu_delete_server_ptr',
    {
      title: 'Clear reverse DNS (PTR)',
      description: 'Remove the PTR record for an IP. Affects mail deliverability — set confirm:true.',
      inputSchema: {
        ...idArg,
        ip: z.string().describe('IP address on the server (from sunucu_list_server_ips).'),
        ...mediumConfirm,
      },
    },
    safeHandler(async ({ id, ip }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/ips/${encodeURIComponent(ip)}/ptr`, { method: 'DELETE' }))),
  );

  // ── Destructive (servers:destroy) ────────────────────────────────────────
  server.registerTool(
    'sunucu_reinstall_server',
    {
      title: 'Reinstall a server (DESTRUCTIVE)',
      description: 'Wipe the disk and rebuild from an OS template. Destroys all data. Requires the servers:destroy scope. Idempotent.',
      inputSchema: {
        ...idArg,
        osTemplate: z.string().describe('OS template id to install.'),
        os: z.string().optional().describe('Optional OS family override.'),
        ...destructiveConfirm,
      },
    },
    safeHandler(async ({ id, osTemplate, os }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/reinstall`, {
        method: 'POST', idempotent: true, body: { osTemplate, os },
      }))),
  );

  server.registerTool(
    'sunucu_revert_snapshot',
    {
      title: 'Revert to a snapshot (DESTRUCTIVE)',
      description: 'Roll the live disk back to a snapshot, discarding changes since. Requires the servers:destroy scope.',
      inputSchema: { ...idArg, snapshotId: z.string().describe('Snapshot id.'), ...destructiveConfirm },
    },
    safeHandler(async ({ id, snapshotId }) =>
      jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapshotId)}/revert`, { method: 'POST' }))),
  );

  server.registerTool(
    'sunucu_terminate_server',
    {
      title: 'Terminate a server (DESTRUCTIVE)',
      description: 'Permanently terminate a server. Irreversible. Requires the servers:destroy scope. Call sunucu_get_server first and confirm the label with the user.',
      inputSchema: {
        ...idArg,
        expectedLabel: z.string().describe('The current server label, as a typo-guard. Must match the server being terminated.'),
        ...destructiveConfirm,
      },
    },
    safeHandler(async ({ id, expectedLabel }) => {
      const detail = await client.request<{ label?: string; hostname?: string }>(`/v1/servers/${encodeURIComponent(id)}`);
      const actual = detail?.label || detail?.hostname || '';
      if (expectedLabel && actual && expectedLabel.trim() !== actual.trim()) {
        return { isError: true, content: [{ type: 'text', text: `Refusing to terminate: expectedLabel "${expectedLabel}" does not match the server's current label "${actual}".` }] };
      }
      return jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}`, { method: 'DELETE' }));
    }),
  );

  server.registerTool(
    'sunucu_server_sso',
    { title: 'Dashboard SSO for a server', description: 'Returns a short-lived URL that logs into the dashboard for this server.', inputSchema: { id: z.string().describe('Server UUID.'), next: z.string().optional().describe('Optional dashboard path to land on.') } },
    safeHandler(async ({ id, next }) => jsonResult(await client.request(`/v1/servers/${encodeURIComponent(id)}/sso`, { method: 'POST', body: { next } }))),
  );
}
