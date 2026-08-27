import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import sharp from '../../../picturegen/node_modules/sharp/dist/index.cjs';
import { transcodeToWebp } from '../../../picturegen/src/gen/transcode.ts';
import { uploadFile } from '../../../picturegen/src/filebase/client.ts';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex === -1 ? null : args[outIndex + 1];
if (outIndex !== -1) args.splice(outIndex, 2);
const manifestIndex = args.indexOf('--asset-manifest');
const assetManifestPath = manifestIndex === -1 ? null : args[manifestIndex + 1];
if (manifestIndex !== -1) args.splice(manifestIndex, 2);
let filePaths = args;
if (assetManifestPath) {
  const manifest = JSON.parse(await readFile(assetManifestPath, 'utf8'));
  filePaths = manifest.files.map((entry) => entry.source);
}
if (filePaths.length === 0) throw new Error('usage: upload-many-production.mjs [--asset-manifest manifest.json] <file>...');

const raw = await new Promise((resolve, reject) => {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { text += chunk; });
  process.stdin.on('end', () => resolve(text));
  process.stdin.on('error', reject);
});

const config = JSON.parse(raw);
const base = String(config.FILEBASE_URL).replace(/\/$/, '');
const key = String(config.FILEBASE_INTERNAL_KEY);
if (!base || !key) throw new Error('missing Depot configuration');

const uploads = [];
for (const filePath of filePaths) {
  const sourceBytes = await readFile(filePath);
  const normalizedPng = await sharp(sourceBytes)
    .flatten({ background: '#ffffff' })
    .resize(1328, 1328, { fit: 'fill' })
    .png()
    .toBuffer();
  const { bytes, contentType } = await transcodeToWebp(normalizedPng, 'image/png', 82);
  const result = await uploadFile(
    bytes,
    `${basename(filePath, '.png')}.webp`,
    contentType,
    'lesson-images',
    'public',
    { filebaseUrl: base, internalKey: key },
  );
  uploads.push({ source: filePath, url: result.url, bytes: result.bytes, id: result.id, mime: result.mime });
  console.error(`uploaded ${filePath} -> ${result.url}`);
}

const payload = JSON.stringify({ uploads }, null, 2);
if (outPath) {
  await writeFile(outPath, `${payload}\n`);
  console.log(JSON.stringify({ uploaded: uploads.length, manifest: outPath }));
} else {
  console.log(payload);
}
