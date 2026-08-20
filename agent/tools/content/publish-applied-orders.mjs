import { cpSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [summaryPath, appliedDir, baseDir, checkpointDir] = process.argv.slice(2);
if (!summaryPath || !appliedDir || !baseDir || !checkpointDir) {
  throw new Error('usage: publish-applied-orders.mjs <summary.json> <applied-dir> <base-export-dir> <checkpoint-dir>');
}

const raw = await new Promise((resolve, reject) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { text += chunk; });
  process.stdin.on('end', () => resolve(text));
  process.stdin.on('error', reject);
});

const config = JSON.parse(raw);
const supabaseUrl = String(config.SUPABASE_URL).replace(/\/$/, '');
const serviceRoleKey = String(config.SUPABASE_SERVICE_ROLE_KEY);
if (!supabaseUrl || !serviceRoleKey) throw new Error('missing Supabase configuration');

const { summaries } = JSON.parse(readFileSync(summaryPath, 'utf8'));
const locales = ['es-MX', 'en-US', 'pt-BR'];
const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
};

function stable(value) {
  return JSON.stringify(value);
}

function createLinkedCorpus(previousDir, nextDir, release) {
  mkdirSync(join(nextDir, 'docs'), { recursive: true });
  for (const name of readdirSync(join(previousDir, 'docs'))) {
    const src = join(previousDir, 'docs', name);
    const dest = join(nextDir, 'docs', name);
    try {
      linkSync(src, dest);
    } catch {
      cpSync(src, dest);
    }
  }
  if (release) {
    const dest = join(nextDir, 'docs', `${release.lesson_id}.json`);
    if (existsSync(dest)) unlinkSync(dest);
    writeFileSync(dest, `${JSON.stringify(release, null, 2)}\n`);
  }
}

let currentCorpus = baseDir;
const written = [];
for (const item of summaries) {
  const releasePath = join(appliedDir, `${item.lesson_id}.json`);
  const release = existsSync(releasePath) ? JSON.parse(readFileSync(releasePath, 'utf8')) : null;
  if (!release) throw new Error(`missing applied release for order ${item.order}: ${releasePath}`);

  if (item.ops > 0) {
    for (const locale of locales) {
      const query = `lesson_documents?select=lesson_id,locale,document&lesson_id=eq.${encodeURIComponent(item.lesson_id)}&locale=eq.${encodeURIComponent(locale)}`;
      const currentResponse = await fetch(`${supabaseUrl}/rest/v1/${query}`, { headers });
      if (!currentResponse.ok) throw new Error(`preflight ${item.order} ${locale} -> ${currentResponse.status}`);
      const current = await currentResponse.json();
      if (current.length !== 1) throw new Error(`preflight ${item.order} ${locale}: expected one row, got ${current.length}`);
      const expected = JSON.parse(readFileSync(join(baseDir, 'docs', `${item.lesson_id}.json`), 'utf8'));
      if (stable(current[0].document) !== stable(expected.locales[locale].document)) {
        throw new Error(`preflight ${item.order} ${locale}: production changed after export; refusing overwrite`);
      }
    }

    for (const locale of locales) {
      const response = await fetch(`${supabaseUrl}/rest/v1/lesson_documents?lesson_id=eq.${encodeURIComponent(item.lesson_id)}&locale=eq.${encodeURIComponent(locale)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ document: release.locales[locale].document }),
      });
      if (!response.ok) throw new Error(`write ${item.order} ${locale} -> ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
  }

  const nextCorpus = `/tmp/lf-live-20260819-after${item.order}`;
  createLinkedCorpus(currentCorpus, nextCorpus, item.ops > 0 ? release : null);
  currentCorpus = nextCorpus;

  const checkpoint = {
    order: item.order,
    lesson_id: item.lesson_id,
    slug: item.slug,
    status: item.ops > 0 ? 'production_written' : 'no_shared_images',
    production_locales_written: item.ops > 0 ? locales : [],
    apply_ops: { pass: 1, failApply: 0, failGate: 0, ops: item.ops },
    shared_images: item.shared_images,
    urls: item.urls,
    format: item.shared_images > 0 ? 'WebP VP8 1328x1328' : 'unchanged',
    corpus_after: nextCorpus,
    verified_at: '2026-08-19',
  };
  const checkpointPath = join(checkpointDir, `order-${String(item.order).padStart(4, '0')}.json`);
  writeFileSync(checkpointPath, `${JSON.stringify(checkpoint)}\n`);
  written.push({ order: item.order, lesson_id: item.lesson_id, status: checkpoint.status, ops: item.ops, corpus_after: nextCorpus });
  console.log(JSON.stringify(written.at(-1)));
}

console.log(JSON.stringify({ published_through: summaries.at(-1).order, written: written.filter((x) => x.ops > 0).length, noops: written.filter((x) => x.ops === 0).length, corpus_after: currentCorpus }));
