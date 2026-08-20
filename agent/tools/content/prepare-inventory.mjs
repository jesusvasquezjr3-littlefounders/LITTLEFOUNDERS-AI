import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('usage: prepare-inventory.mjs <export-dir>');
const corpus = join(source, 'corpus');
await mkdir(join(corpus, 'docs'), { recursive: true });
const manifest = JSON.parse(await readFile(join(source, 'export-manifest.json'), 'utf8'));
for (const lesson of manifest.lessons) {
  await cp(join(source, 'docs', `${lesson.id}.json`), join(corpus, 'docs', `${lesson.id}.json`));
}
await writeFile(join(corpus, 'index.json'), `${JSON.stringify(manifest.lessons.map((lesson) => ({
  lesson_id: lesson.id,
  slug: lesson.slug,
  position: lesson.position,
  adventure: 'archipielago-del-trueque',
})), null, 2)}\n`);
await writeFile(join(source, 'final-cuts.json'), '[]\n');
console.log(JSON.stringify({ corpus_docs: manifest.lessons.length, final_cuts: 0 }));
