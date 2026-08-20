import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import sharp from '../../../picturegen/node_modules/sharp/dist/index.cjs';
import { transcodeToWebp } from '../../../picturegen/src/gen/transcode.ts';
import { uploadFile } from '../../../picturegen/src/filebase/client.ts';

const filePath = process.argv[2];
if (!filePath) throw new Error('usage: upload-production.mjs <file>');
const raw = await new Promise((resolve, reject) => {
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

const sourceBytes = await readFile(filePath);
const normalizedPng = await sharp(sourceBytes).resize(1328, 1328, { fit: 'fill' }).png().toBuffer();
const { bytes, contentType } = await transcodeToWebp(normalizedPng, 'image/png', 82);
const result = await uploadFile(bytes, `${basename(filePath, '.png')}.webp`, contentType, 'lesson-images', 'public', {
  filebaseUrl,
  internalKey,
});
console.log(JSON.stringify({ url: result.url, bytes: result.bytes, id: result.id, mime: result.mime }));
