// Makes the compositions of the home page. A developer tool, run by hand; not part of the build.
//
// STILLS (what the owner approves, one by one, before any loop is made): the composition on the light and on the
// dark page color, into audit-out/home-render/. Nothing is written to public/.
//
//   npm run render:home -- --scene exchange                 one composition (or several, comma separated)
//   npm run render:home -- --scene space --at 4.2           at another second of the loop
//   npm run render:home -- --scene jungle --query "dist=16" with the camera moved (see `number()` in home-scene.js)
//
// LOOPS (what the page shows): a looping H.264 MP4 and a WebP poster per color mode, into public/home/loops/. A video
// cannot be transparent in every browser, so each composition is rendered once, transparent, and every frame is laid
// on the light and on the dark page color.
//
//   npm run render:home -- --loops --scene exchange         8 seconds at 24 fps
//   npm run render:home -- --loops --scene space --frames 24   a short test
//
// Needs Chrome (CHROME_PATH if unusual), the source models in glb/ and, for the loops, Blender
// (BLENDER=<path to blender.exe>). No dev server.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';
import { startServer } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '../..');
const args = parseArgs();
const scratch = join(frontend, 'audit-out/home-render');
const loopsDir = join(frontend, 'public/home/loops');
const FPS = 24;
const LOOP_SECONDS = 8;
const total = Number(args.frames ?? LOOP_SECONDS * FPS);
const CRF = args.crf ?? '28';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
// The page's own color in each mode (--v-canvas in src/styles/lf-theme.css): the composition is laid on it.
const PAGE = { light: '#f4f5fd', dark: '#0b0d1b' };
const MODES = ['light', 'dark'];
const data = (url) => Buffer.from(url.split(',')[1], 'base64');

if (typeof args.scene !== 'string') throw new Error('Say which composition: --scene <name> (or several, comma separated)');

mkdirSync(scratch, { recursive: true });

const server = await startServer(here);
const browser = await launch();

try {
  for (const scene of args.scene.split(',')) {
    const extra = typeof args.query === 'string' ? `&${args.query}` : '';
    const page = await browser.newPage({ width: 1200, height: 900, url: `${server.origin}/home-scene.html?scene=${scene}${extra}`, settle: 500 });

    for (let n = 0; n < 400; n++) {
      if (await page.ev("document.body.dataset.ready === '1'")) break;
      await sleep(200);
    }

    if (!(await page.ev("document.body.dataset.ready === '1'"))) throw new Error(`${scene}: the composition never became ready`);

    const still = Number(args.at ?? (await page.ev('window.__still')));

    if (!args.loops) {
      await page.ev(`window.__render(${still})`);

      for (const mode of MODES) writeFileSync(join(scratch, `${scene}-${mode}.jpg`), data(await page.ev(`window.__frameOn('${PAGE[mode]}')`)));

      await page.close();
      console.log(`${scene}: ${join(scratch, `${scene}-light.jpg`)} and -dark.jpg, at second ${still}`);
      continue;
    }

    const size = await page.ev('window.__size');
    const started = Date.now();

    for (const mode of MODES) {
      rmSync(join(scratch, `${scene}-${mode}`), { recursive: true, force: true });
      mkdirSync(join(scratch, `${scene}-${mode}`), { recursive: true });
    }

    // one render per frame, laid on both page colors
    for (let i = 0; i < total; i++) {
      await page.ev(`window.__render(${i / FPS})`);

      for (const mode of MODES) writeFileSync(join(scratch, `${scene}-${mode}`, `frame-${String(i).padStart(4, '0')}.jpg`), data(await page.ev(`window.__frameOn('${PAGE[mode]}')`)));
    }

    // the poster is the moment the approved still was taken at
    await page.ev(`window.__render(${still})`);

    const posters = {};

    for (const mode of MODES) posters[mode] = await page.ev(`window.__frameOn('${PAGE[mode]}', 'image/webp', 0.88)`);

    await page.close();
    mkdirSync(loopsDir, { recursive: true });

    for (const mode of MODES) {
      const base = join(loopsDir, `${scene}-${mode}`);
      const run = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', join(here, 'encode.py'), '--', join(scratch, `${scene}-${mode}`), base, String(FPS), String(size.width), String(size.height), String(total), String(CRF)], { encoding: 'utf8' });

      if (run.status !== 0 || !existsSync(`${base}.mp4`)) throw new Error(`${scene} ${mode}: the encode failed:\n${run.stdout?.slice(-1200)}\n${run.stderr?.slice(-600)}`);

      writeFileSync(`${base}-poster.webp`, data(posters[mode]));

      if (!args.keep) rmSync(join(scratch, `${scene}-${mode}`), { recursive: true, force: true });
    }

    console.log(`${scene}: ${total} frames in ${Math.round((Date.now() - started) / 1000)} s; light ${Math.ceil(statSync(join(loopsDir, `${scene}-light.mp4`)).size / 1024)} KB, dark ${Math.ceil(statSync(join(loopsDir, `${scene}-dark.mp4`)).size / 1024)} KB`);
  }
} finally {
  await browser.close();
  server.close();
}
