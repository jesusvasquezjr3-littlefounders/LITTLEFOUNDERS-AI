import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { transcodeToWebp } from '../../../picturegen/src/gen/transcode.ts';
import { uploadFile } from '../../../picturegen/src/filebase/client.ts';

const workDir = process.argv[2];
const outDir = process.argv[3];
if (!workDir || !outDir) throw new Error('usage: convert-production-pngs.mts <export-dir> <out-dir>');

const raw = await new Promise<string>((resolve, reject) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { text += chunk; });
  process.stdin.on('end', () => resolve(text));
  process.stdin.on('error', reject);
});
const config = JSON.parse(raw);
const filebaseUrl = String(config.FILEBASE_URL).replace(/\/$/, '');
const internalKey = String(config.FILEBASE_INTERNAL_KEY);
if (!filebaseUrl || !internalKey) throw new Error('missing Depot configuration');

const docsDir = join(workDir, 'docs');
const docs = (await readdir(docsDir)).filter((name) => name.endsWith('.json')).sort();
const urlToLessons = new Map<string, Set<string>>();
const lessonOps = new Map<string, any[]>();

function walk(value: any, path: string, callback: (path: string, url: string) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, `${path}[${index}]`, callback));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key.endsWith('image_url') && typeof child === 'string' && child.endsWith('.png')) callback(childPath, child);
    else walk(child, childPath, callback);
  }
}

for (const name of docs) {
  const lesson = JSON.parse(await readFile(join(docsDir, name), 'utf8'));
  const lessonId = lesson.lesson_id;
  const ops: any[] = [];
  for (const segment of lesson.locales['es-MX'].document.segments) {
    walk(segment, '', (path, url) => {
      const normalizedPath = path.startsWith('payload.') || path === 'payload' ? path : path;
      ops.push({ op: 'set_field', segment_id: segment.id, path: normalizedPath, value: `__PENDING__${url}` });
      if (!urlToLessons.has(url)) urlToLessons.set(url, new Set());
      urlToLessons.get(url)!.add(lessonId);
    });
  }
  if (ops.length) lessonOps.set(lessonId, ops);
}

await mkdir(outDir, { recursive: true });
const opsDir = join(outDir, 'ops');
await mkdir(opsDir, { recursive: true });
const mapping: Record<string, { new_url: string; original_bytes: number; webp_bytes: number; mime: string }> = {};

for (const [oldUrl] of urlToLessons) {
  const response = await fetch(oldUrl);
  if (!response.ok) throw new Error(`download ${response.status}: ${oldUrl}`);
  const source = Buffer.from(await response.arrayBuffer());
  const transcoded = await transcodeToWebp(source, response.headers.get('content-type') ?? 'image/png', 82);
  if (transcoded.contentType !== 'image/webp') throw new Error(`transcode did not produce WebP: ${oldUrl}`);
  const result = await uploadFile(transcoded.bytes, `${basename(new URL(oldUrl).pathname, '.png')}.webp`, 'image/webp', 'lesson-images', 'public', {
    filebaseUrl,
    internalKey,
  });
  mapping[oldUrl] = { new_url: result.url, original_bytes: source.length, webp_bytes: transcoded.bytes.length, mime: result.mime };
  console.log(JSON.stringify({ old_url: oldUrl, new_url: result.url, original_bytes: source.length, webp_bytes: transcoded.bytes.length }));
}

for (const [lessonId, ops] of lessonOps) {
  const resolved = ops.map((op) => ({ ...op, value: mapping[op.value.slice('__PENDING__'.length)]?.new_url ?? (() => { throw new Error(`missing mapping for ${op.value}`); })() }));
  await writeFile(join(opsDir, `${lessonId}.json`), `${JSON.stringify({ lesson_id: lessonId, ops: resolved }, null, 2)}\n`);
}
await writeFile(join(outDir, 'mapping.json'), `${JSON.stringify(mapping, null, 2)}\n`);
console.log(JSON.stringify({ png_urls: Object.keys(mapping).length, lessons: lessonOps.size, ops_dir: opsDir }));
