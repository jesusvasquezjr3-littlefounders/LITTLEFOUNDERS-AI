import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
// Scratch: how much a kept capture moves (mean absolute difference of each frame from the first, 0-255). node scripts/motion-energy.mjs <dir>
const dir = process.argv[2];
const names = readdirSync(dir).filter((n) => n.endsWith('.jpg')).sort();
const first = await sharp(join(dir, names[0])).resize(160, 190).greyscale().raw().toBuffer();
let peak = 0;
for (let i = 1; i < names.length; i += 4) {
  const cur = await sharp(join(dir, names[i])).resize(160, 190).greyscale().raw().toBuffer();
  let sum = 0; for (let p = 0; p < cur.length; p++) sum += Math.abs(cur[p] - first[p]);
  peak = Math.max(peak, sum / cur.length);
}
console.log(dir.split(/[\/]/).pop(), 'peak', peak.toFixed(2));
