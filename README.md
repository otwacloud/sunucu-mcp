# @otwa/sunucu-mcp

[![npm version](https://img.shields.io/npm/v/@otwa/sunucu-mcp.svg?style=flat)](https://www.npmjs.com/package/@otwa/sunucu-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-blue.svg)](https://modelcontextprotocol.io)

Model Context Protocol server for [sunucu.com](https://sunucu.com). Manage your
servers, web hosting, domains, billing, support tickets and webhooks from Claude
Code, Claude Desktop, Cursor, VS Code and other MCP-capable AI tools — just by
talking to them.

```
> "Reboot my web server and show me its CPU usage"

Claude → calls sunucu_list_servers, sunucu_power_server, sunucu_get_server_stats
       → reboots the box and reports the live stats
```

## Two ways to connect

| Option | Best for | Setup |
|---|---|---|
| **Hosted (no install)** | Any client that supports remote HTTP MCP | Add `https://api.sunucu.com/mcp` with `Authorization: Bearer snc_…` |
| **Local stdio** | Older clients, offline, full control | `npx -y @otwa/sunucu-mcp` (set `SUNUCU_API_KEY`) |

Get an API key at **https://sunucu.com/account/api-keys** (read/write/destroy
scopes are per-key). OAuth 2.0 device-code (browser approval) is also supported
on the hosted endpoint.

### Hosted endpoint (recommended)

```
URL:    https://api.sunucu.com/mcp
Auth:   Authorization: Bearer snc_…        (API key)
  OR    Authorization: Bearer snc_at_…     (OAuth 2.0 device-code, RFC 8628)
```

Claude Code:

```bash
claude mcp add --transport http sunucu https://api.sunucu.com/mcp \
  --header "Authorization: Bearer snc_…"
```

### Local stdio

```bash
SUNUCU_API_KEY=snc_… npx -y @otwa/sunucu-mcp
```

Claude Desktop / Cursor (`mcpServers`) — VS Code uses `servers`:

```json
{
  "mcpServers": {
    "sunucu": {
      "command": "npx",
      "args": ["-y", "@otwa/sunucu-mcp"],
      "env": { "SUNUCU_API_KEY": "snc_…" }
    }
  }
}
```

## Environment

| Var | Required | Default | Notes |
|---|---|---|---|
| `SUNUCU_API_KEY` | yes (stdio) | — | Your `snc_…` key from the dashboard |
| `SUNUCU_API_BASE` | no | `https://api.sunucu.com` | Override for staging/dev |

## Tools

95 tools, each gated by your key's scopes:

- **account** — `sunucu_get_account`
- **servers** — list / get / live stats / usage history (1h/24h/7d) / snapshots / IPs+reverse-DNS / plan-options; rename, power, snapshot create/delete, set/clear PTR, change-plan/resize (`servers:write`); reinstall, snapshot revert, terminate (`servers:destroy`, with confirm + data-loss acknowledgement)
- **capacity pools** — catalogue / quote / list / get; create and resize (each needs `confirm: true` and has a quoting tool beside it, so the amount you are shown is produced by the code that charges it); the pool's own IP block (list / assign); build free servers inside a pool; terminate (`servers:destroy`, with a typed-label guard)
- **hosting** — list / get; set / verify / remove custom domain (`hosting:write`)
- **hosting DNS** — zone + default-record preview (`hosting:read`); add / update / delete records, switch our mail records off/on, restore defaults (`hosting:manage`; delete and mail-off need `confirm: true`)
- **hosting-panel** — site stats, logs, PHP, cron, databases, backups, file read/write/delete (`hosting:manage`, opt-in)
- **mail** — setup DNS + list mail domains / mailboxes / aliases (`mail:read`); add/remove domains, create/delete mailboxes + aliases, reset mailbox password (`mail:write`)
- **domains** — list / get; update auto-renew / lock / WHOIS / nameservers (`domains:write`)
- **billing** — invoices, wallet, transactions (`billing:read`)
- **tickets** — list / get; open / reply / close (`tickets:write`)
- **webhooks** — event catalogue / list / get / deliveries; create / update / delete / rotate-secret / redeliver (`webhooks:write`)

Destructive operations require the opt-in `servers:destroy` scope on the key
(not granted by default). Snapshot-create, reinstall and ticket-create carry an
automatic `Idempotency-Key` so a retried LLM call can't act twice.

## Docs

Full API reference, scopes and changelog: **https://sunucu.com/developers**

## License

MIT
