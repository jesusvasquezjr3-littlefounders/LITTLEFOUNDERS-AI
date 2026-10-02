import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = resolve(root, 'backend/src/services/v2AnswerShapes.ts');
const copies = [
  ['browser', resolve(root, 'frontend/src/rebuild/learning/v2AnswerShapes.generated.ts')],
  ['Forge', resolve(root, 'coursegen/src/v2/v2AnswerShapes.generated.ts')],
];
const canonical = readFileSync(source, 'utf8');
if (process.argv.includes('--check')) {
  const drift = copies.filter(([, path]) => { try { return readFileSync(path, 'utf8') !== canonical; } catch { return true; } });
  if (drift.length) { console.error(`V2 answer shapes drift (${drift.map(([name]) => name).join(', ')}): regenerate the copies from the canonical Core source.`); process.exitCode = 1; }
  else console.log('V2 answer shapes source parity OK (browser, Forge).');
} else {
  for (const [, path] of copies) writeFileSync(path, canonical);
  console.log('Generated the browser and Forge answer shapes from the canonical Core source.');
}
