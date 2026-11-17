import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SunucuClient } from '../client/http';
import { SunucuApiError } from '../client/errors';
import { destructiveConfirm } from '../guards/confirm';
import { jsonResult, safeHandler } from './_helpers';

const LABEL_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/;

/** The four things a pool is sold in, in the units the API takes. Repeated in
 *  every schema description because the units are the one thing a model gets
 *  wrong here: `ram2gb: 16` is 32 GB, not 16. */
const UNITS = {
  vcpu: z.number().int().min(0).describe('vCPU count. Sold one at a time, so this IS the number of cores.'),
  ram2gb: z.number().int().min(0).describe('Memory in 2 GB BLOCKS — 16 means 32 GB, not 16 GB. Sold in 2 GB steps.'),
  disk100: z.number().int().min(0).describe('Storage in 100 GB BLOCKS — 10 means 1000 GB. Sold in 100 GB steps.'),
  ip16: z.number().int().min(0).describe('Public IPv4 in BLOCKS OF 16 — 1 means 16 addresses. Minimum 1: a pool with no addresses can host nothing, because every server takes at least one unless it is built private-only.'),
};

/**
 * Capacity-pool tools.
 *
 * A pool inverts the normal product: the customer buys a block of
 * vCPU/RAM/disk/IPs ONCE, and every server built inside it is free and never
 * renews. That inversion is the thing to keep straight in every description —
 * a model that treats a pool as "a big server" quotes the wrong number, and one
 * that treats a pool server as billable tells the user they are paying twice
 * for the same capacity.
 *
 * ⚑ Every figure here is in CENTS (`*_usd_cents`), matching the rest of the
 * sunucu API. A tool that divides by 100 on the way out is a tool that will
 * eventually show somebody $1.19 for a $119.50 charge.
 *
 * ⚑ Two money paths exist and only two: buying a pool, and GROWING one. Both
 * are gated behind an explicit confirm and both have a quoting tool beside
 * them, so the amount shown to the user is produced by the code that takes it.
 * Everything else — assigning the pool's own addresses, building servers into
 * it — is free by design, and saying so is part of the tool's job.
 */
export function registerPoolTools(server: McpServer, client: SunucuClient): void {
  // ── Catalogue + quoting ─────────────────────────────────────────────────
  server.registerTool(
    'sunucu_list_pool_products',
    {
      title: 'List capacity-pool products and their unit prices',
      description:
        'Capacity-pool products on sale, each with its per-unit prices in CENTS (`pricing_cents`) and the ' +
        'bounds those units may fall between. A capacity pool is a block of vCPU / RAM / disk / IPv4 bought ' +
        'ONCE — servers built inside it are FREE, carry no monthly price of their own and never appear on a ' +
        'renewal. Units are sold in steps: 1 vCPU, 2 GB RAM, 100 GB disk, 16 IPs, so `per_2gb_ram` is the ' +
        'price of TWO gigabytes and `per_16_ip` the price of SIXTEEN addresses. Use the `id` with ' +
        'sunucu_quote_pool and sunucu_create_pool. Bounds are enforced server-side — a selection outside ' +
        'them is refused, not clamped.',
      inputSchema: {},
    },
    safeHandler(async () => jsonResult(await client.request('/v1/pools/catalogue'))),
  );

  server.registerTool(
    'sunucu_quote_pool',
    {
      title: 'Price a capacity-pool selection',
      description:
        'Monthly price for a pool shape, with a per-unit breakdown and the `resolved` figures (vCPU, GB, ' +
        'addresses) so the user sees what they actually get rather than a count of blocks. Nothing is ' +
        'charged and nothing is created. ALWAYS call this and show the user `monthly_usd_cents` before ' +
        'sunucu_create_pool — the purchase re-prices server-side, so a number worked out by multiplying ' +
        'the unit prices yourself may not be the number taken.',
      inputSchema: {
        productId: z.string().describe('Pool product id from sunucu_list_pool_products.'),
        ...UNITS,
      },
    },
    safeHandler(async ({ productId, vcpu, ram2gb, disk100, ip16 }) =>
      jsonResult(await client.request('/v1/pools/quote', {
        method: 'POST',
        body: { productId, vcpu, ram2gb, disk100, ip16 },
      }))),
  );

  // ── Reads ───────────────────────────────────────────────────────────────
  server.registerTool(
    'sunucu_list_pools',
    {
      title: 'List capacity pools on this account',
      description:
        'Every capacity pool on the account, with its quotas (vcpu_quota / ram_mb_quota / disk_gb_quota / ' +
        'ip_quota), status, monthly price in cents and billing cycle end (`expires_at`). A pool in ' +
        '`suspended` has had every server inside it powered off for non-payment — topping the balance up ' +
        'brings it back with each machine in the state it was in. Use the `id` with the other pool tools.',
      inputSchema: {},
    },
    safeHandler(async () => jsonResult(await client.request('/v1/pools'))),
  );

  server.registerTool(
    'sunucu_get_pool',
    {
      title: 'Get a capacity pool with its live usage',
      description:
        'One pool plus a `usage` block — the vCPU, RAM, disk, IPs and server count currently committed ' +
        'inside it — a `policy` block, the `bounds` a resize may move between, and the servers in it. ' +
        'Usage counts PROVISIONED resources, not live consumption: a powered-off server still holds its ' +
        'allocation, because the customer is entitled to switch it back on. Subtract usage from quota to ' +
        'answer "what will still fit". ' +
        '⚑ Read `policy.vcpuOvercommit` rather than assuming a ratio — vCPU may be committed beyond the ' +
        'quota by that factor, and it is a server setting that can change. ' +
        '⚑ `pool.rates_cents` are the per-unit prices THIS pool was SOLD at, which is what a resize is ' +
        'priced from — not necessarily what sunucu_list_pool_products quotes today.',
      inputSchema: { id: z.string().describe('Pool id from sunucu_list_pools.') },
    },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/pools/${encodeURIComponent(id)}`))),
  );

  // ── Purchase ────────────────────────────────────────────────────────────
  server.registerTool(
    'sunucu_create_pool',
    {
      title: 'Buy and provision a capacity pool',
      description:
        'Buys a capacity pool. The FULL monthly price is debited from the prepaid balance immediately, the ' +
        'capacity is created with hard CPU and memory ceilings, the IPv4 block is reserved, and the pool ' +
        'gets its own private network segment (free) that its servers can talk to each other on. ' +
        'Call sunucu_quote_pool first and show the user the monthly price — this endpoint recomputes it ' +
        'server-side and charges that, so quoting from your own arithmetic risks surprising them. ' +
        '400s if the balance cannot cover it or the selection is outside the product bounds. ' +
        'Afterwards, build free servers into it with sunucu_create_pool_server.',
      inputSchema: {
        productId: z.string().describe('Pool product id from sunucu_list_pool_products.'),
        label: z
          .string().min(1).max(64)
          .regex(LABEL_REGEX, 'Label must start with alphanumeric and contain only letters/numbers/spaces/-/_')
          .optional()
          .describe('Human-readable name for the pool, e.g. "prod-cluster".'),
        region: z.string().max(64).optional().describe("Optional location slug — source: the product's `regions`."),
        ...UNITS,
        // Optional in the schema, required at runtime — deliberately. A schema
        // violation tells the model "invalid input"; this tells it what to do
        // instead, which is the difference between recovering and retrying.
        confirm: z.boolean().optional()
          .describe('Required `true`. The user has been shown the monthly price from sunucu_quote_pool and approved the immediate charge.'),
      },
    },
    safeHandler(async ({ productId, label, region, vcpu, ram2gb, disk100, ip16, confirm }) => {
      if (confirm !== true) {
        throw new SunucuApiError(
          'Buying a capacity pool debits the balance immediately for the full monthly price. ' +
            'Call sunucu_quote_pool with this exact selection, show the user the monthly figure, ' +
            'then re-call with `confirm: true`.',
          400, 'confirmation_required',
        );
      }
      return jsonResult(await client.request('/v1/pools', {
        method: 'POST',
        body: { productId, label, region, vcpu, ram2gb, disk100, ip16 },
        idempotent: true,
        timeoutMs: 120_000,
      }));
    }),
  );

  // ── Resize ──────────────────────────────────────────────────────────────
  server.registerTool(
    'sunucu_quote_pool_resize',
    {
      title: 'Price a pool resize without applying it',
      description:
        'Prices a new shape for an existing pool. Nothing is charged. Returns ' +
        '`previous_monthly_usd_cents`, the new `monthly_usd_cents`, the `delta_usd_cents`, and ' +
        '`charge_now_usd_cents` — the prorated amount that would be taken immediately for the days left in ' +
        'the current cycle. The same code produces this figure and takes the money in sunucu_resize_pool, ' +
        'so it is the number to show the user. ' +
        'Takes the WHOLE shape in absolute units, not deltas: to add 8 vCPU to a 16-vCPU pool, send 24.',
      inputSchema: { id: z.string().describe('Pool id.'), ...UNITS },
    },
    safeHandler(async ({ id, vcpu, ram2gb, disk100, ip16 }) =>
      jsonResult(await client.request(`/v1/pools/${encodeURIComponent(id)}/resize-quote`, {
        method: 'POST',
        body: { vcpu, ram2gb, disk100, ip16 },
      }))),
  );

  server.registerTool(
    'sunucu_resize_pool',
    {
      title: 'Resize a capacity pool',
      description:
        "Changes a pool's shape. Takes the WHOLE shape in absolute units, never deltas. " +
        '**Growing a pool is a purchase**: the new shape is re-priced at the rates the pool was SOLD at ' +
        "(not today's catalogue) and the difference is charged to the balance immediately, prorated for " +
        'the days left in the cycle — so call sunucu_quote_pool_resize first and show the user both the ' +
        'immediate charge and the new monthly. Shrinking is NOT refunded; the lower price applies from the ' +
        'next renewal. ' +
        "Refuses to shrink below what the pool's servers already hold (delete servers first) and 400s if " +
        'the balance will not cover an increase.',
      inputSchema: {
        id: z.string().describe('Pool id.'),
        ...UNITS,
        confirm: z.boolean().optional()
          .describe('Required `true`. The user has seen `charge_now_usd_cents` and the new monthly price from sunucu_quote_pool_resize and approved them.'),
      },
    },
    safeHandler(async ({ id, vcpu, ram2gb, disk100, ip16, confirm }) => {
      if (confirm !== true) {
        throw new SunucuApiError(
          'Growing a pool charges the balance immediately and changes the recurring monthly price. ' +
            'Call sunucu_quote_pool_resize with this exact shape, show the user `charge_now_usd_cents` and ' +
            'the new monthly, then re-call with `confirm: true`. (Shrinking is not refunded, so confirm that too.)',
          400, 'confirmation_required',
        );
      }
      return jsonResult(await client.request(`/v1/pools/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { vcpu, ram2gb, disk100, ip16 },
        timeoutMs: 120_000,
      }));
    }),
  );

  // ── Building servers inside a pool ───────────────────────────────────────
  server.registerTool(
    'sunucu_create_pool_server',
    {
      title: 'Build a free server inside a capacity pool',
      description:
        'Creates a server inside the pool. **It is free** — nothing is charged now, it has no monthly ' +
        'price and it never renews; the pool carries the bill, and the build is checked against the ' +
        "pool's quota instead of the balance. This is why it does NOT go through sunucu_create_server, " +
        'which orders a billable server. ' +
        '⚑ `ipCount` chooses how many of the pool\'s own public addresses it takes (default 1) and they ' +
        'cost nothing — they were bought with the pool. **`ipCount: 0` is private-only: no public ' +
        'interface, no default route, and NO INTERNET AT ALL** — it cannot fetch updates or packages. It ' +
        "is reachable from the pool's other servers on the private network and through the web console, " +
        'and only a Linux image can be built that way. Say this to the user before choosing 0. ' +
        'The pool must be `active`; call sunucu_get_pool first to check what will still fit.',
      inputSchema: {
        id: z.string().describe('Pool id — the server is built inside THIS pool.'),
        productId: z.string().describe('Server plan id (the shape of the machine) from sunucu_list_products. Its price is not charged — the pool pays.'),
        label: z.string().max(64).optional().describe('Human-readable name shown in the panel.'),
        hostname: z.string().max(63).optional().describe('DNS-style hostname set inside the guest.'),
        os: z.string().optional().describe('OS family, e.g. "ubuntu". Defaults to the plan\'s default image.'),
        osTemplate: z.string().optional().describe('Specific image id, e.g. "ubuntu-24.04". Defaults to the plan\'s default.'),
        ipCount: z.number().int().min(0).max(16).optional()
          .describe('Public addresses from the pool\'s block. Default 1. 0 = private-only with no internet (Linux only) — confirm with the user first.'),
      },
    },
    safeHandler(async ({ id, productId, label, hostname, os, osTemplate, ipCount }) =>
      jsonResult(await client.request(`/v1/pools/${encodeURIComponent(id)}/servers`, {
        method: 'POST',
        body: { productId, label, hostname, os, osTemplate, ipCount },
        idempotent: true,
        timeoutMs: 120_000,
      }))),
  );

  // ── The pool's own IP block ─────────────────────────────────────────────
  server.registerTool(
    'sunucu_list_pool_ips',
    {
      title: "List the pool's IPv4 block",
      description:
        'Every address the pool owns, with its current PTR and which server holds it. `assigned_to: null` ' +
        'means the address is free inside the block and can be handed to a server at no cost. ' +
        '`is_primary` marks the address the guest OS is configured with and that appears on its ' +
        'credentials. These addresses were bought with the pool, so none is billed separately — to get ' +
        "MORE of them, resize the pool's `ip16`; add-ons are refused on a pool server.",
      inputSchema: { id: z.string().describe('Pool id.') },
    },
    safeHandler(async ({ id }) => jsonResult(await client.request(`/v1/pools/${encodeURIComponent(id)}/ips`))),
  );

  server.registerTool(
    'sunucu_assign_pool_ips',
    {
      title: "Assign, move or return addresses in the pool's block",
      description:
        "Moves addresses around inside the pool's own block, in one batch. Each change names an `ip` and " +
        'the `serverId` to hand it to; `serverId: null` returns it to the block. FREE — the block was ' +
        'bought with the pool, so nothing here touches the balance. ' +
        'Addresses only ever move between the pool and the servers inside it, and naming a server outside ' +
        'this pool refuses the WHOLE batch with nothing written. ' +
        '⚑ Two things this does NOT do. It does not configure the address inside the guest OS — after ' +
        'assigning one, the user must add it in the machine. And moving an address AWAY is immediately ' +
        'disruptive: it stops routing at once, so anything bound to it (sites, TLS, mail) breaks. ' +
        'Send every change in ONE call rather than one call per address: each call reprograms the router, ' +
        'and the endpoint allows only 6 per minute.',
      inputSchema: {
        id: z.string().describe('Pool id.'),
        changes: z
          .array(z.object({
            ip: z.string().describe('IPv4 address that belongs to this pool — source: sunucu_list_pool_ips.'),
            serverId: z.string().nullable()
              .describe('Server to hand the address to. Must be a server INSIDE this pool. `null` returns it to the block.'),
          }))
          .min(1).max(256)
          .describe('The whole set of changes to apply at once. Validated as a unit — one bad entry refuses all of them.'),
        confirm: z.literal(true)
          .describe('Must be exactly `true`. Moving an address away from a server breaks anything bound to it immediately — the user has been told.'),
      },
    },
    safeHandler(async ({ id, changes }) =>
      jsonResult(await client.request(`/v1/pools/${encodeURIComponent(id)}/ips/apply`, {
        method: 'POST',
        body: { changes },
        timeoutMs: 120_000,
      }))),
  );

  // ── Teardown ────────────────────────────────────────────────────────────
  server.registerTool(
    'sunucu_terminate_pool',
    {
      title: 'Terminate a capacity pool',
      description:
        'Tears a pool down. Every server inside it is POWERED OFF — they are preserved rather than ' +
        'destroyed — all IPv4 addresses are returned and the private network segment is deleted. There is ' +
        'NO refund for the remainder of the cycle. Requires the `servers:destroy` scope.\n\n' +
        'SAFETY: Before calling, (1) call sunucu_get_pool and read the user its label, quotas and how many ' +
        'servers are inside, (2) wait for explicit confirmation in chat, (3) pass `expectedLabel` matching ' +
        'the current label as a typo-guard. If labels differ, the call is rejected.',
      inputSchema: {
        id: z.string().describe('Pool id.'),
        expectedLabel: z.string()
          .describe("The pool's CURRENT label (from sunucu_get_pool). The call fails if this does not match — a typo-guard against tearing down the wrong pool."),
        ...destructiveConfirm,
      },
    },
    safeHandler(async ({ id, expectedLabel }) => {
      const current = await client.request<{ pool?: { label?: string } }>(`/v1/pools/${encodeURIComponent(id)}`);
      const actualLabel = current?.pool?.label || '';
      if (actualLabel.trim() !== expectedLabel.trim()) {
        throw new SunucuApiError(
          `Refusing to terminate pool ${id}: expectedLabel "${expectedLabel}" does not match the ` +
            `current label "${actualLabel}". Re-fetch via sunucu_get_pool, confirm with the user, ` +
            'and call again with the correct expectedLabel.',
          400, 'label_mismatch',
        );
      }
      return jsonResult(await client.request(`/v1/pools/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        timeoutMs: 180_000,
      }));
    }),
  );
}
