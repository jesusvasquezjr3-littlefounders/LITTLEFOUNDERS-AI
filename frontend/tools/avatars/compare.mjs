// Puts the reference render and its vector side by side (and the trace over a plain page color), so a trace
// can be judged by eye: audit-out/avatars/<character>/compare.png. A developer tool run by hand.
//
//   npm run avatars:compare                         all four characters
//   npm run avatars:compare -- --character Rho
//
// Needs Chrome and the files made by reference.mjs and vectorize.py.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const characters = typeof args.character === 'string' ? args.character.split(',') : ['Rho', 'Zara', 'Liruf', 'Dina'];
const height = Number(args.height ?? 640);
const svgName = typeof args.svg === 'string' ? args.svg : 'avatar-full.svg';
const base = resolve(here, '../../audit-out/avatars');
const browser = await launch();

try {
  for (const character of characters) {
    const folder = join(base, character.toLowerCase());

    if (!existsSync(join(folder, svgName))) { console.log(`${character}: no ' + svgName + ' yet`); continue; }

    const url = (name) => pathToFileURL(join(folder, name)).href;
    const cell = (label, src, bg) => `<figure style="margin:0;background:${bg};padding:12px"><img src="${src}" style="height:${height}px;display:block"><figcaption style="font:14px sans-serif;color:#555;padding-top:6px">${label}</figcaption></figure>`;

    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'compare.html'), `<!doctype html><body style="margin:0;display:flex;gap:8px;background:#fff">${cell('reference (albedo)', url('ref-albedo.png'), '#f4f5fd')}${cell('smooth vector', url(svgName), '#f4f5fd')}${cell('smooth vector on dark', url(svgName), '#0b0d1b')}</body>`);

    const page = await browser.newPage({ width: 2400, height: height + 80, url: pathToFileURL(join(folder, 'compare.html')).href, settle: 1500 });
    const width = await page.ev('Math.ceil(document.body.scrollWidth)');

    await page.call('Emulation.setDeviceMetricsOverride', { width, height: height + 80, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    writeFileSync(join(folder, 'compare.png'), await page.screenshot());
    await page.close();
    console.log(`${character}: ${join(folder, 'compare.png')}`);
  }
} finally {
  await browser.close();
}
