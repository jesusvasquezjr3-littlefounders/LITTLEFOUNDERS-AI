import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const releasePath = process.argv[2];
const outDir = process.argv[3];
if (!releasePath || !outDir) throw new Error('usage: prepare-dev-preview.mjs <release-json> <frontend-public-dev-lessons>');
const release = JSON.parse(await readFile(releasePath, 'utf8'));
const original = JSON.parse(await readFile(`/tmp/lf-production-images/docs/${release.lesson_id}.json`, 'utf8'));
await mkdir(outDir, { recursive: true });
const index = [];
for (const locale of ['es-MX', 'en-US', 'pt-BR']) {
  const document = release.locales[locale].document;
  await writeFile(join(outDir, `${document.meta.slug}.${locale}.json`), `${JSON.stringify({
    document,
    audio: original.locales[locale].audio ?? {},
  })}\n`);
  index.push({ slug: document.meta.slug, title: document.meta.title, locale, types: document.segments.map((segment) => segment.type) });
}
await writeFile(join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify({ outDir, files: index.length + 1, slug: index[0]?.slug }));
