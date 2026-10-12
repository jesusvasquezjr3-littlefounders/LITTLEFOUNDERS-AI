// A sheet of the four finished avatars side by side (tools/avatars/out/*.svg), on light and on dark, to judge them
// together: audit-out/avatars/sheet-final.png. A developer tool run by hand.
//
//   npm run avatars:sheet
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const height = Number(args.height ?? 520);
const names = ['rho', 'zara', 'liruf', 'dina'];
const out = resolve(here, '../../audit-out/avatars');
const row = (bg) => `<div style="display:flex;gap:24px;padding:24px;background:${bg};align-items:flex-end">${names.map((n) => `<img src="${pathToFileURL(join(here, 'out', `${n}.svg`)).href}" style="height:${height}px">`).join('')}</div>`;

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'sheet-final.html'), `<!doctype html><body style="margin:0">${row('#f4f5fd')}${row('#0b0d1b')}</body>`);

const browser = await launch();

try {
  const page = await browser.newPage({ width: 2400, height: height * 2 + 100, url: pathToFileURL(join(out, 'sheet-final.html')).href, settle: 1500 });
  const width = await page.ev('Math.ceil(document.body.scrollWidth)');

  await page.call('Emulation.setDeviceMetricsOverride', { width, height: height * 2 + 100, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  writeFileSync(join(out, 'sheet-final.png'), await page.screenshot());
  console.log(join(out, 'sheet-final.png'));
  await page.close();
} finally {
  await browser.close();
}
