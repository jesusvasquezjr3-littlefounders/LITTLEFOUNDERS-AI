import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// The canonical v2 segment families (Core) and their byte-for-byte copies: the
// browser's, and (GAP-FIX-R4) Forge's, so the emitter blocks a kind outside its
// Appendix P age range with the same V2_AGE_SCOPE / v2PayloadScopeProblem Core runs.
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = resolve(root, 'backend/src/services/v2SegmentFamilies.ts');
const copies = [
  ['browser', resolve(root, 'frontend/src/rebuild/learning/v2SegmentFamilies.generated.ts')],
  ['Forge', resolve(root, 'coursegen/src/v2/v2SegmentFamilies.generated.ts')],
];
const canonical = readFileSync(source, 'utf8');
if (process.argv.includes('--check')) {
  const drift = copies.filter(([, path]) => { try { return readFileSync(path, 'utf8') !== canonical; } catch { return true; } });
  if (drift.length) { console.error(`V2 segment families drift (${drift.map(([name]) => name).join(', ')}): regenerate the copies from the canonical Core source.`); process.exitCode = 1; }
  else console.log('V2 segment families source parity OK (browser, Forge).');
} else {
  for (const [, path] of copies) writeFileSync(path, canonical);
  console.log('Generated the browser and Forge segment families from the canonical Core source.');
}
