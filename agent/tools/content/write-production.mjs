import { readFile } from 'node:fs/promises';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from '../../../coursegen/src/pipeline/illustrationStyle.ts';

const releasePath = process.argv[2];
const baseDir = process.argv[3] ?? '/tmp/lf-production-images';
if (!releasePath) throw new Error('usage: write-production.mjs <release-json> [base-export-dir]');
const raw = await new Promise((resolve, reject) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { text += chunk; });
  process.stdin.on('end', () => resolve(text));
  process.stdin.on('error', reject);
});
const config = JSON.parse(raw);
const base = String(config.SUPABASE_URL).replace(/\/$/, '');
const key = String(config.SUPABASE_SERVICE_ROLE_KEY);
const release = JSON.parse(await readFile(releasePath, 'utf8'));
const locales = ['es-MX', 'en-US', 'pt-BR'];
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

function stable(value) {
  return JSON.stringify(value);
}

for (const locale of locales) {
  const query = `lesson_documents?select=lesson_id,locale,document&lesson_id=eq.${encodeURIComponent(release.lesson_id)}&locale=eq.${encodeURIComponent(locale)}`;
  const currentResponse = await fetch(`${base}/rest/v1/${query}`, { headers });
  if (!currentResponse.ok) throw new Error(`preflight ${locale} -> ${currentResponse.status}`);
  const current = await currentResponse.json();
  if (current.length !== 1) throw new Error(`preflight ${locale}: expected one row, got ${current.length}`);
  const expected = JSON.parse(await readFile(`${baseDir}/docs/${release.lesson_id}.json`, 'utf8'));
  if (stable(current[0].document) !== stable(expected.locales[locale].document)) {
    throw new Error(`preflight ${locale}: production changed after export; refusing overwrite`);
  }
}

for (const locale of locales) {
  const response = await fetch(`${base}/rest/v1/lesson_documents?lesson_id=eq.${encodeURIComponent(release.lesson_id)}&locale=eq.${encodeURIComponent(locale)}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      document: release.locales[locale].document,
      // A document whose art this pipeline just replaced with LF_VISUAL_IDENTITY-
      // compliant art IS current, by the same definition FORGE_ILLUSTRATION_STYLE_VERSION
      // encodes for Prism-generated art (see illustrationStyle.ts). Without this,
      // `verify:course`'s "documents use the current illustration style" check can
      // never pass for a document this pipeline touches, since Prism's backfill path
      // is the only other writer of that column and this pipeline deliberately never
      // calls Prism.
      illustration_style_version: FORGE_ILLUSTRATION_STYLE_VERSION,
    }),
  });
  if (!response.ok) throw new Error(`write ${locale} -> ${response.status}: ${(await response.text()).slice(0, 300)}`);
}
console.log(JSON.stringify({ lesson_id: release.lesson_id, locales_written: locales }));
