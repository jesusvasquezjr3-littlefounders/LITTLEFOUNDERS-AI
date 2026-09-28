import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = resolve(root, 'backend/src/services/v2ConceptBoards.ts');
const browser = resolve(root, 'frontend/src/rebuild/learning/v2ConceptBoards.generated.ts');
const canonical = readFileSync(source, 'utf8');
if (process.argv.includes('--check')) {
  const copy = readFileSync(browser, 'utf8');
  if (copy !== canonical) { console.error('V2 concept boards drift: regenerate the browser copy from the canonical Core model.'); process.exitCode = 1; }
  else console.log('V2 concept boards source parity OK.');
} else { writeFileSync(browser, canonical); console.log('Generated the browser concept boards from the canonical Core model.'); }
