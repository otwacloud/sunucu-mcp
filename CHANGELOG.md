# Changelog

## 0.9.1

- No change to the tools. Released from GitHub Actions through npm Trusted Publishing, with dependencies installed from a committed lockfile and every build tool pinned to an exact version.

## 0.9.0

- `sunucu_get_server_stats_history` — CPU / memory / network / disk over 1h, 24h or 7d
  (`servers:read`); `sunucu_rename_server` (`servers:write`).
- Hosting DNS — 7 tools: `sunucu_get_hosting_dns`, `sunucu_get_hosting_dns_defaults`
  (`hosting:read`); `sunucu_add_hosting_dns_record`, `sunucu_update_hosting_dns_record`,
  `sunucu_delete_hosting_dns_record`, `sunucu_set_hosting_dns_mail`,
  `sunucu_reset_hosting_dns` (`hosting:manage`). Delete and switching our mail records
  off require `confirm: true`; add carries an automatic Idempotency-Key.
- `sunucu_list_webhook_events` — the event catalogue.
- Invoice PDFs and ticket attachments are on the REST API (v1.16) only, like the other
  downloads. Tool count is now 95.

## 0.8.0

- **Capacity pools** — 11 tools: `sunucu_list_pool_products`, `sunucu_quote_pool`,
  `sunucu_list_pools`, `sunucu_get_pool`, `sunucu_create_pool`,
  `sunucu_quote_pool_resize`, `sunucu_resize_pool`, `sunucu_list_pool_ips`,
  `sunucu_assign_pool_ips`, `sunucu_create_pool_server`, `sunucu_terminate_pool`.
  Buy a block of vCPU/RAM/disk/IPs once and fill it with as many servers as you
  like, each billed at $0.00.
- Both money paths (`create`, `resize`) require `confirm: true` and each has a
  quoting tool beside it, so the figure you are shown is produced by the code that
  takes the money. Terminate additionally requires `expectedLabel` to match.
- Tool count is now 85.

## 0.7.0

- `sunucu_server_sso` — short-lived dashboard SSO URL for a server. Tool count is now 71.

## 0.6.0

- `sunucu_set_auto_recharge` (`billing:write`, opt-in) — configure automatic wallet top-up. Tool count is now 70.

## 0.5.0

- Hosting control-panel tools (scope `hosting:manage`, opt-in): site stats,
  log tail, PHP version, cron get/set, databases (list/add/remove), backups
  (list/create/restore/delete), and the file manager (list/read/write/delete).
  Destructive ops are medium-confirm gated. Streaming file/backup download,
  upload, the browser-SSH terminal, and git deploy are on the REST API only.
  Tool count is now 69.

## 0.4.0

- Email-hosting tools (full mail-panel parity): `sunucu_mail_setup`,
  `sunucu_list_mail_domains`/`sunucu_add_mail_domain`/`sunucu_delete_mail_domain`,
  `sunucu_list_domain_mailboxes`/`sunucu_list_domain_aliases`,
  `sunucu_list_mailboxes`/`sunucu_create_mailbox`/`sunucu_reset_mailbox_password`/
  `sunucu_delete_mailbox`, `sunucu_create_alias`/`sunucu_delete_alias`. Reads
  carry `mail:read`, mutations `mail:write`; domain/mailbox deletes are
  medium-confirm gated. Tool count is now 53.

## 0.3.0

- Server resize tools: `sunucu_list_plan_options` (`servers:read`) lists the
  plans a server can switch to (same family, same disk); `sunucu_change_plan`
  (`servers:write`, medium-confirm) moves it to one — an in-place vCPU/RAM
  resize that reboots the server (~1 min) and never changes disk. Only the
  recurring price changes (no proration up, no credit down). Powers the new
  Cloud Router line. Tool count is now 41.

## 0.2.0

- Reverse DNS tools: `sunucu_list_server_ips`, `sunucu_set_server_ptr`,
  `sunucu_delete_server_ptr` (PTR writes carry the medium-confirm gate).
- Removed `sunucu_reset_server_password` — the platform never resets a
  server's root password (the backing `/v1` endpoint was retired); the tool
  always returned 404.

## 0.1.0

- Initial release. Model Context Protocol server for sunucu.com.
- 37 tools across account, servers (read/write/destroy), hosting, domains,
  billing, tickets and webhooks — each gated by the API key's scopes.
- Two transports: stdio (`sunucu-mcp`) and stateless Streamable HTTP
  (`sunucu-mcp-http`), the latter hosted at `https://api.sunucu.com/mcp`.
- Bearer auth with `snc_…` API keys or `snc_at_…` OAuth 2.0 access tokens.
- Automatic `Idempotency-Key` on snapshot-create, reinstall and ticket-create.
