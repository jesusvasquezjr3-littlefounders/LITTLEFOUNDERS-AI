#!/usr/bin/env node
/*
 * Regenerates every browser and home-screen icon from the one brand mark,
 * `/rebuild/brand/mark.svg` (manifest id `brand.mark`, Frontend Bible 07 §1
 * and §3: our own flat asset in token hues, no stock figures, no gradient
 * text; 02 D8: one system for marketing too).
 *
 *   public/favicon-48.png        the tab icon the prerendered pages link
 *   public/favicon.ico           32 + 48 px, for the browsers that ask for /favicon.ico
 *   public/apple-touch-icon.png  180 px on the primary ground (iOS fills transparency with black)
 *   public/icon-192.png, icon-512.png  the web app manifest icons (512 is also the JSON-LD logo)
 *
 * The icons were the legacy raster logo (gradient text and two stock child
 * figures) until gap-fix round 2. `npm run seo:icons`; the static server,
 * Chrome launch and DevTools client are shared with render-cards.mjs.
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FRONTEND, launchChrome, openPage, startServer, waitFor } from './cdp.mjs';

/** The registered brand mark (the asset gate checks this script carries its path). */
const MARK = '/rebuild/brand/mark.svg';
/** Primary token (tokens.css --primary): the apple-touch ground, so the rounded corners never turn black. */
const PRIMARY = '#5c55fd';

const ICONS = [
  { file: 'favicon-48.png', size: 48 },
  { file: 'apple-touch-icon.png', size: 180, ground: PRIMARY },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];
const ICO_SIZES = [32, 48];

const page = (params) => {
  const size = Number(params.get('size'));
  const ground = params.get('ground');
  return {
    type: 'text/html; charset=utf-8',
    body: `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${size}px; height: ${size}px; overflow: hidden; background: ${ground ? ground : 'transparent'}; }
img { display: block; width: ${size}px; height: ${size}px; }
</style></head><body><img id="mark" src="/public${MARK}" alt=""></body></html>`,
  };
};

/** An ICO whose entries are PNGs (supported by every browser since Vista-era IE). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, bytes }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...pngs.map((png) => png.bytes)]);
}

async function main() {
  const { server, port } = await startServer({ '/__icon.html': page });
  const userDataDir = join(tmpdir(), `lf-icons-${process.pid}`);
  await mkdir(userDataDir, { recursive: true });
  let chrome;
  try {
    chrome = await launchChrome(userDataDir);
    const cdp = await openPage(chrome);
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const render = async (size, ground) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
      const query = new URLSearchParams({ size: String(size), ...(ground ? { ground } : {}) });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/__icon.html?${query}` });
      await waitFor(cdp, `(() => { const m = document.getElementById('mark'); return m && m.complete && m.naturalWidth > 0; })()`, `Icon ${size}px`);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      return Buffer.from(shot.data, 'base64');
    };
    for (const icon of ICONS) {
      const bytes = await render(icon.size, icon.ground);
      await writeFile(join(FRONTEND, 'public', icon.file), bytes);
      console.log(`  ${icon.file.padEnd(22)} ${icon.size}px  ${(bytes.length / 1024).toFixed(1)} KB`);
    }
    const favicons = [];
    for (const size of ICO_SIZES) favicons.push({ size, bytes: await render(size) });
    const icoBytes = ico(favicons);
    await writeFile(join(FRONTEND, 'public/favicon.ico'), icoBytes);
    console.log(`  ${'favicon.ico'.padEnd(22)} ${ICO_SIZES.join('+')}px  ${(icoBytes.length / 1024).toFixed(1)} KB`);
    cdp.close();
  } finally {
    chrome?.child.kill();
    server.close();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
  console.log(`seo:icons — ${ICONS.length + 1} icons written to public/ from ${MARK}`);
}

await main();
