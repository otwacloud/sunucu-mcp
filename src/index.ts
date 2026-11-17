#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server';
import { readEnv } from './util/env';
import { packageInfo } from './util/version';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--version') || argv.includes('-v')) {
    const pkg = packageInfo();
    process.stdout.write(`${pkg.name} ${pkg.version}\n`);
    return;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  let env;
  try {
    env = readEnv();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[sunucu-mcp] ${msg}\n`);
    process.exit(1);
  }

  const server = createServer(env);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (signal: string): Promise<void> => {
    try { await server.close(); } catch { /* best-effort */ }
    process.stderr.write(`[sunucu-mcp] shutdown on ${signal}\n`);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

function printHelp(): void {
  const pkg = packageInfo();
  process.stdout.write(
    `${pkg.name} ${pkg.version}\n\n` +
      'Model Context Protocol server for sunucu.com.\n\n' +
      'Usage:\n' +
      '  sunucu-mcp            Start the stdio MCP server (spawned by Claude Code, Cursor, etc.)\n' +
      '  sunucu-mcp --version  Print version and exit\n' +
      '  sunucu-mcp --help     Show this help\n\n' +
      'Environment:\n' +
      '  SUNUCU_API_KEY   Required. Generate at https://sunucu.com/account/api-keys\n' +
      '  SUNUCU_API_BASE  Optional. Default https://api.sunucu.com\n\n' +
      'Docs: https://sunucu.com/developers\n',
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  process.stderr.write(`[sunucu-mcp] fatal: ${msg}\n`);
  process.exit(1);
});
