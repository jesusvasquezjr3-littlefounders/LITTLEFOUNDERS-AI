// Full-page screenshots to look at. Scrolls once so reveal-on-scroll content is in, then captures the whole page.
// Files go to frontend/audit-out/ (not tracked).
//
//   npm run audit:shot                                  light, en-US, 1440 px
//   npm run audit:shot -- --matrix --themes light,dark
//   npm run audit:shot -- --width 390 --lang pt-BR --consent unset   (consent unset shows the cookie banner)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, parseArgs, run } from './lib.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '../../audit-out');

mkdirSync(out, { recursive: true });

await run('shot', parseArgs(), async (page, config) => {
  await page.scrollThrough();

  const height = await page.ev('document.documentElement.scrollHeight');
  const file = join(out, `${config.width}-${config.lang}-${config.theme}.png`);

  writeFileSync(file, await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: config.width, height, scale: 1 } }));
  console.log(`[${describe(config)}] ${file} (${height} px tall)`);
});
