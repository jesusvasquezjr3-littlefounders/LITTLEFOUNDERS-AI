import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [startRaw, endRaw, outPath, ...rootSpecs] = process.argv.slice(2);
if (!startRaw || !endRaw || !outPath || rootSpecs.length === 0) {
  throw new Error('usage: build-order-assets-manifest.mjs <start> <end> <out.json> <start-end=asset-dir>...');
}

const start = Number(startRaw);
const end = Number(endRaw);
const workOrder = JSON.parse(readFileSync('/tmp/littlefounders-image-session/agent/handoff/work-order.json', 'utf8'));
const roots = rootSpecs.map((spec) => {
  const [range, dir] = spec.split('=');
  const [a, b] = range.split('-').map(Number);
  return { a, b, dir };
});

const files = [];
for (const item of workOrder.filter((entry) => entry.order >= start && entry.order <= end)) {
  const root = roots.find((entry) => item.order >= entry.a && item.order <= entry.b);
  if (!root) throw new Error(`no asset root for order ${item.order}`);
  const present = existsSync(root.dir)
    ? readdirSync(root.dir).filter((name) => name.startsWith(`order-${item.order}-`) && name.endsWith('.png')).sort()
    : [];
  if (present.length !== item.shared_images) {
    throw new Error(`asset count mismatch order ${item.order}: expected ${item.shared_images}, got ${present.length} in ${root.dir}`);
  }
  present.forEach((name, index) => files.push({
    order: item.order,
    slot: index + 1,
    lesson_id: item.lesson_id,
    slug: item.slug,
    source: join(root.dir, name),
  }));
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify({ files }, null, 2)}\n`);
console.log(JSON.stringify({ start, end, files: files.length, manifest: outPath }));
