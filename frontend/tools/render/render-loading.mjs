// Renders the loading window's runners: 12 frames of one stride per character and per color mode, then builds the sprite sheets
// (loading-sheets.py). A developer tool, run by hand; it is not part of the build.
//
//   npm run render:loading                     all four characters, both modes (several minutes in software GL)
//   npm run render:loading -- --only rho,zara  some characters
//   npm run render:loading -- --mode dark      one mode
//
// Needs: Chrome (CHROME_PATH if unusual), the source models in glb/, and Python with Pillow 11.3 or later (AVIF) for the sheets.
// Frames go to frontend/audit-out/loading-render/ (not tracked); the sheets to frontend/public/loading/.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';
import { startServer } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '../..');
const args = parseArgs();
const CHARACTERS = typeof args.only === 'string' ? args.only.split(',') : ['rho', 'zara', 'liruf', 'dina'];
const MODES = typeof args.mode === 'string' ? [args.mode] : ['light', 'dark'];
const FRAMES = 12;
const SIZE = { width: 960, height: 576 };

const server = await startServer(here);
const browser = await launch();

try {
  for (const mode of MODES) {
    for (const name of CHARACTERS) {
      const page = await browser.newPage({ ...SIZE, url: `${server.origin}/loading-scene.html?c=${name}&mode=${mode}`, settle: 500 });

      for (let n = 0; n < 200; n++) {
        if (await page.ev("document.body.dataset.ready === '1'")) break;
        await sleep(200);
      }

      if (!(await page.ev("document.body.dataset.ready === '1'"))) throw new Error(`${name} ${mode}: the scene never became ready`);

      const dir = join(frontend, 'audit-out/loading-render', mode, name);

      mkdirSync(dir, { recursive: true });

      for (let i = 0; i < FRAMES; i++) {
        await page.ev(`window.__render(${i / FRAMES})`);
        writeFileSync(join(dir, `f-${String(i).padStart(2, '0')}.png`), Buffer.from((await page.ev('window.__frame()')).split(',')[1], 'base64'));
      }

      await page.close();
      console.log(`${name} ${mode}: ${FRAMES} frames`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

const sheets = join(here, 'loading-sheets.py');
let run = spawnSync('python', [sheets], { encoding: 'utf8' });

if (run.error) run = spawnSync('python3', [sheets], { encoding: 'utf8' });

process.stdout.write(run.stdout ?? '');

if (run.status !== 0) throw new Error(`The sheets failed:\n${run.stderr}`);
