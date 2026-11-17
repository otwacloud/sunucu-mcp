import { readFileSync } from 'fs';
import { join } from 'path';

let cached: { name: string; version: string } | null = null;

export function packageInfo(): { name: string; version: string } {
  if (cached) return cached;
  try {
    const raw = readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { name?: string; version?: string };
    // Fallbacks are brand-neutral on purpose — the published package uses the
    // public sunucu scope; keep the internal workspace scope out of dist.
    cached = { name: pkg.name || 'sunucu-mcp', version: pkg.version || '0.0.0' };
  } catch {
    cached = { name: 'sunucu-mcp', version: '0.0.0' };
  }
  return cached;
}
