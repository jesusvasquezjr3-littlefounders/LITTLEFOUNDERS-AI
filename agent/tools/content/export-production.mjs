import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const workDir = process.argv[2];
if (!workDir) throw new Error('usage: export-production.mjs <work-dir>');

const config = JSON.parse(await new Promise((resolve, reject) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { text += chunk; });
  process.stdin.on('end', () => resolve(text));
  process.stdin.on('error', reject);
}));
const base = String(config.SUPABASE_URL).replace(/\/$/, '');
const key = String(config.SUPABASE_SERVICE_ROLE_KEY);
if (!base || !key) throw new Error('missing Supabase configuration');

async function get(path, range = '0-999') {
  const response = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Range: range, Prefer: 'count=exact' },
  });
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return { rows: await response.json(), contentRange: response.headers.get('content-range') ?? '' };
}

async function getAll(path) {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { rows: page, contentRange } = await get(path, `${start}-${start + 999}`);
    rows.push(...page);
    const total = Number(contentRange.split('/')[1]);
    if (page.length === 0 || page.length < 1000 || (Number.isFinite(total) && rows.length >= total)) break;
  }
  return rows;
}

const lessons = await getAll('lessons?select=id,slug,position,status&status=eq.published&order=position.asc');
if (lessons.length !== 988) console.warn(`published lesson count is ${lessons.length}, expected 988`);

const docs = [];
for (let start = 0; start < lessons.length; start += 100) {
  const ids = lessons.slice(start, start + 100).map((lesson) => lesson.id);
  const filter = ids.join(',');
  const rows = await getAll(`lesson_documents?select=lesson_id,locale,schema_version,document,answer_keys,audio,updated_at&lesson_id=in.(${filter})`);
  docs.push(...rows);
}

const byLesson = new Map();
for (const lesson of lessons) byLesson.set(lesson.id, { lesson_id: lesson.id, slug: lesson.slug, locales: {} });
for (const row of docs) {
  const record = byLesson.get(row.lesson_id);
  if (!record) throw new Error(`document for unpublished or unknown lesson ${row.lesson_id}`);
  record.locales[row.locale] = {
    document: row.document,
    answer_keys: row.answer_keys,
    audio: row.audio,
    schema_version: row.schema_version,
    updated_at: row.updated_at,
  };
}
for (const record of byLesson.values()) {
  const locales = Object.keys(record.locales).sort();
  if (locales.join(',') !== 'en-US,es-MX,pt-BR') throw new Error(`${record.lesson_id} has locales ${locales.join(',')}`);
}

await mkdir(join(workDir, 'docs'), { recursive: true });
for (const record of byLesson.values()) {
  await writeFile(join(workDir, 'docs', `${record.lesson_id}.json`), `${JSON.stringify(record)}\n`);
}
await writeFile(join(workDir, 'export-manifest.json'), `${JSON.stringify({
  exported_at: new Date().toISOString(),
  published_lessons: lessons.length,
  document_rows: docs.length,
  lessons: lessons.map(({ id, slug, position, status }) => ({ id, slug, position, status })),
}, null, 2)}\n`);
console.log(JSON.stringify({ workDir, published_lessons: lessons.length, document_rows: docs.length }));
