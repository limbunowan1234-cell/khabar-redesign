// Usage: node scripts/patro/generate.mjs 2026 2027 [--print]
// Writes data/patro/<year>.json (committed). Add a new year well before December of the last one.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildYear } from './engine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const print = args.includes('--print');
const years = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
if (!years.length) { console.error('usage: node scripts/patro/generate.mjs <year> [<year>...] [--print]'); process.exit(1); }

mkdirSync(join(root, 'data', 'patro'), { recursive: true });
for (const y of years) {
  const t0 = Date.now();
  const data = buildYear(y);
  writeFileSync(join(root, 'data', 'patro', `${y}.json`), JSON.stringify(data));
  console.log(`${y}: ${data.days.length} days, ${data.events.length} events, ${data.notes.length} notes (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  data.notes.forEach((n) => console.log('  note:', n));
  if (print) data.events.forEach((e) => console.log('  ', e.date, e.id));
}
