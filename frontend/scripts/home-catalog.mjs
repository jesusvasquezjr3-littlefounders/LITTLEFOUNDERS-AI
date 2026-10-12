// The compositions of the home page exist in two places that must agree: Core chooses one by name
// (backend/src/services/home.ts) and this package serves its files (public/stage/loops/). This check
// fails the build when a name has no files, or files have no name, so a person is never shown a
// composition that is not there.
//
// It runs in `npm run build`. Where only this package is checked out (a deployment that builds the
// frontend alone), Core's list is not there to read and the check says so and passes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = resolve(frontend, '../backend/src/services/home.ts');
const loops = join(frontend, 'public/stage/loops');

if (!existsSync(core)) {
  console.log('home-catalog: Core is not in this checkout, nothing to compare');
  process.exit(0);
}

const list = /export const COMPOSITIONS = \[([\s\S]*?)\] as const;/.exec(readFileSync(core, 'utf8'));

if (!list) {
  console.error('home-catalog: could not read COMPOSITIONS in backend/src/services/home.ts');
  process.exit(1);
}

const names = [...list[1].matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
const files = new Set(readdirSync(loops));
const expected = (name) => ['light', 'dark'].flatMap((mode) => [`${name}-${mode}.mp4`, `${name}-${mode}-poster.webp`]);
const missing = names.flatMap((name) => expected(name).filter((file) => !files.has(file)));
const known = new Set(names.flatMap(expected));
const extra = [...files].filter((file) => !known.has(file));

if (missing.length || extra.length || new Set(names).size !== names.length) {
  if (missing.length) console.error(`home-catalog: Core names compositions that have no files: ${missing.join(', ')}`);
  if (extra.length) console.error(`home-catalog: files that no composition of Core's names: ${extra.join(', ')}`);
  if (new Set(names).size !== names.length) console.error('home-catalog: a composition is listed twice');
  process.exit(1);
}

console.log(`home-catalog: ${names.length} compositions, each with its two videos and two posters`);
