// Scene framing: where does the visible scene sit inside each poster of public/landing? Finds the box of pixels
// that differ from the page ground and reports its center and size as a share of the frame. A scene that is not
// centered makes a text/image pair look unbalanced even when the boxes are (docs/engineering/FRONTEND-GUIDE.md).
//
//   npm run audit:scene
//
// A poster is marked "off center" when its center is more than 8 points from the middle of the frame, vertically or
// horizontally. That is information, not a failure: the page crops such a poster where it is shown (see
// object-position and aspect in the component that uses it); the problem scene is cropped to 5:3, anchored at the
// bottom, for this reason.
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs, DEFAULT_URL } from './lib.mjs';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../public');
const posters = [];
const walk = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) (entry.isDirectory() ? walk(join(dir, entry.name)) : /-poster\.webp$/.test(entry.name) && posters.push('/' + relative(publicDir, join(dir, entry.name)).replaceAll('\\', '/'))); };

walk(join(publicDir, 'landing'));

const MEASURE = (src) => `(async () => {
  const img = new Image();

  img.src = ${JSON.stringify(src)};
  await img.decode();

  const canvas = document.createElement('canvas');

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const g = canvas.getContext('2d', { willReadFrequently: true });

  g.drawImage(img, 0, 0);

  const { data, width, height } = g.getImageData(0, 0, canvas.width, canvas.height);
  const bg = [data[0], data[1], data[2]];
  let x0 = width, x1 = 0, y0 = height, y1 = 0;

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;

    if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }

  return { size: width + 'x' + height, centerX: Math.round(((x0 + x1) / 2 / width) * 100), centerY: Math.round(((y0 + y1) / 2 / height) * 100), widthPct: Math.round(((x1 - x0) / width) * 100), heightPct: Math.round(((y1 - y0) / height) * 100) };
})()`;

parseArgs();

const browser = await launch();
let flagged = 0;

try {
  const page = await browser.newPage({ settle: 2500 });

  for (const src of posters) {
    const m = await page.ev(MEASURE(new URL(src, DEFAULT_URL).pathname));
    const off = Math.abs(m.centerX - 50) > 8 || Math.abs(m.centerY - 50) > 8;

    console.log(`${src}  ${m.size}  center ${m.centerX}% / ${m.centerY}%  fills ${m.widthPct}% x ${m.heightPct}%${off ? '   <- off center' : ''}`);
    flagged += off ? 1 : 0;
  }

  await page.close();
} finally {
  await browser.close();
}

console.log(flagged === 0 ? '\nscene: every poster is centered.' : `\nscene: ${flagged} poster(s) off center; check that the component showing each one crops it.`);
