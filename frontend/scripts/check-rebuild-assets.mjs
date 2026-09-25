import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicRoot = resolve(root, 'public');
const manifest = JSON.parse(readFileSync(resolve(root, 'src/rebuild/assets/manifest.json'), 'utf8'));
const failures = [];
const listed = new Set();
const requiredStage = new Set(['young', 'teen', 'square'].flatMap((shape) => ['light', 'dark'].map((mode) => `/rebuild/mentor-stills/dina-${shape}-${mode}.png`)));
const medalPath = '/rebuild/art/lesson-medal.svg';
// S05.3e: the streak-milestone mark on the result screen (B.21, OD-7).
const inHouseSvgs = new Set([medalPath, '/rebuild/art/streak-flame.svg']);
const required = new Set([...requiredStage, ...inHouseSvgs]);

for (const asset of manifest) {
  if (listed.has(asset.path)) failures.push(`Duplicate asset path: ${asset.path}`);
  listed.add(asset.path);
  if (!required.has(asset.path)) failures.push(`Unexpected or unreferenced asset: ${asset.path}`);
  if (asset.class !== 'B') failures.push(`Invalid asset class: ${asset.id}`);
  const file = resolve(publicRoot, `.${asset.path}`);
  if (!file.startsWith(publicRoot + sep)) { failures.push(`Unsafe asset path: ${asset.path}`); continue; }
  try {
    const bytes = readFileSync(file);
    if (Math.ceil(statSync(file).size / 1024) > asset.sizesKb) failures.push(`Asset exceeds declared size: ${asset.path}`);
    if (requiredStage.has(asset.path)) {
      if (asset.type !== 'render' || asset.sourceModel !== '/scenes/dina.glb' || asset.character !== 'dina') failures.push(`Invalid stage provenance: ${asset.id}`);
      if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') failures.push(`Not a PNG: ${asset.path}`);
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      const [w, h] = asset.aspect.split(':').map(Number);
      if (!w || !h || Math.abs(width / height - w / h) > .01) failures.push(`Asset aspect differs from manifest: ${asset.path}`);
    } else if (inHouseSvgs.has(asset.path)) {
      const svg = bytes.toString('utf8');
      if (asset.type !== 'svg' || asset.generatedBy !== 'in-house SVG' || !svg.startsWith('<svg ') || svg.includes('<script') || svg.includes('<image')) {
        failures.push(`Invalid result artwork: ${asset.path}`);
      }
    }
  } catch { failures.push(`Missing or unreadable asset: ${asset.path}`); }
  if (process.argv.includes('--release') && (asset.reviewStatus !== 'approved' || !asset.approvedBy)) {
    failures.push(`Unapproved asset blocks build: ${asset.path}`);
  }
}
for (const path of required) if (!listed.has(path)) failures.push(`Unregistered asset: ${path}`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Rebuild asset integrity OK: ${manifest.length} assets${process.argv.includes('--release') ? ' approved' : `, ${manifest.filter((asset) => asset.reviewStatus === 'draft').length} awaiting review`}.`);
