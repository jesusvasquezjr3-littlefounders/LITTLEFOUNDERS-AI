import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// GAP-FIX-R2 learning (Appendix P Part 8 scorer parity): the browser runs the
// canonical scorer on the canonical semantic payload. The copy differs from
// Core's source only in the import specifier of the synced families module.
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = resolve(root, 'backend/src/services/v2ScorerPayload.ts');
const browser = resolve(root, 'frontend/src/rebuild/learning/v2ScorerPayload.generated.ts');
const canonical = readFileSync(source, 'utf8').replace("from './v2SegmentFamilies.js'", "from './v2SegmentFamilies.generated'");
if (process.argv.includes('--check')) {
  const copy = readFileSync(browser, 'utf8');
  if (copy !== canonical) { console.error('V2 scorer payload drift: regenerate the browser copy from the canonical Core source.'); process.exitCode = 1; }
  else console.log('V2 scorer payload source parity OK.');
} else { writeFileSync(browser, canonical); console.log('Generated the browser scorer payload from the canonical Core source.'); }
