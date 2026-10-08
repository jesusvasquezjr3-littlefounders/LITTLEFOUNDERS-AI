import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
// Scratch: a contact sheet of a kept capture, to look at a clip without playing it. node scripts/contact-sheet.mjs <dir> <out.png> <seconds,...>
const [dir, out, list] = process.argv.slice(2);
const names = readdirSync(dir).filter((n) => n.endsWith('.jpg')).sort();
const times = list.split(',').map(Number);
const tiles = await Promise.all(times.map(async (t) => sharp(join(dir, names[Math.min(names.length - 1, Math.round(t * 30))])).resize(Number(process.env.TW ?? 480), Number(process.env.TH ?? 360)).toBuffer()));
const cols = 3, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * Number(process.env.TW ?? 480), height: rows * Number(process.env.TH ?? 360), channels: 3, background: '#fff' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * Number(process.env.TW ?? 480), top: Math.floor(i / cols) * Number(process.env.TH ?? 360) }))).png().toFile(out);
