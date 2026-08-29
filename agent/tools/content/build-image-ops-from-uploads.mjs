import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [startRaw, endRaw, baseDir, assetManifestPath, uploadsPath, opsDir, summaryPath] = process.argv.slice(2);
if (!startRaw || !endRaw || !baseDir || !assetManifestPath || !uploadsPath || !opsDir || !summaryPath) {
  throw new Error('usage: build-image-ops-from-uploads.mjs <start> <end> <base-dir> <asset-manifest.json> <uploads.json> <ops-dir> <summary.json>');
}

const start = Number(startRaw);
const end = Number(endRaw);
const workOrder = JSON.parse(readFileSync(join(new URL('.', import.meta.url).pathname, '../../handoff/work-order.json'), 'utf8'));
const assets = JSON.parse(readFileSync(assetManifestPath, 'utf8')).files;
const uploads = JSON.parse(readFileSync(uploadsPath, 'utf8')).uploads;
const uploadBySource = new Map(uploads.map((upload) => [upload.source, upload]));

function walk(value, pathParts = [], out = []) {
  if (Array.isArray(value)) value.forEach((entry, index) => walk(entry, pathParts.concat(`[${index}]`), out));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, pathParts.concat((pathParts.length ? '.' : '') + key), out);
  } else if (typeof value === 'string' && value.includes('/files/lesson-images/')) {
    out.push({ path: pathParts.join('').replace(/^\./, ''), url: value });
  }
  return out;
}

mkdirSync(opsDir, { recursive: true });
const summaries = [];
for (const item of workOrder.filter((entry) => entry.order >= start && entry.order <= end)) {
  const orderAssets = assets.filter((asset) => asset.order === item.order).sort((a, b) => a.slot - b.slot);
  if (orderAssets.length !== item.shared_images) throw new Error(`asset count mismatch order ${item.order}`);
  const original = JSON.parse(readFileSync(join(baseDir, 'docs', `${item.lesson_id}.json`), 'utf8'));
  const segments = original.locales['es-MX'].document.segments;
  const ops = [];
  const urls = [];

  for (let index = 0; index < item.urls.length; index++) {
    const oldUrl = item.urls[index];
    const upload = uploadBySource.get(orderAssets[index].source);
    if (!upload) throw new Error(`missing upload for ${orderAssets[index].source}`);
    urls.push(upload.url);
    const hits = [];
    for (const segment of segments) {
      for (const hit of walk(segment)) {
        if (hit.url === oldUrl) hits.push({ segment_id: segment.id, path: hit.path });
      }
    }
    if (hits.length === 0) throw new Error(`no hits for order ${item.order} ${oldUrl}`);
    for (const hit of hits) ops.push({ op: 'set_field', segment_id: hit.segment_id, path: hit.path, value: upload.url });
  }

  writeFileSync(join(opsDir, `${item.lesson_id}.json`), `${JSON.stringify({
    lesson_id: item.lesson_id,
    notes: `Order ${String(item.order).padStart(4, '0')} ${item.slug}: replace shared production image URLs with Codex-generated WebP assets.`,
    ops,
  }, null, 2)}\n`);
  summaries.push({ order: item.order, lesson_id: item.lesson_id, slug: item.slug, shared_images: item.shared_images, ops: ops.length, urls });
}

writeFileSync(summaryPath, `${JSON.stringify({ opsDir, summaries }, null, 2)}\n`);
console.log(JSON.stringify({
  start,
  end,
  orders: summaries.length,
  shared_images: summaries.reduce((sum, item) => sum + item.shared_images, 0),
  ops: summaries.reduce((sum, item) => sum + item.ops, 0),
  noops: summaries.filter((item) => item.ops === 0).length,
  opsDir,
  summary: summaryPath,
}));
