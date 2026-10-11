// Makes the onboarding's compositions. A developer tool, run by hand; not part of the build.
//
// LOOPS (what the pages show): a looping H.264 MP4 and a WebP poster per color mode, into public/onboarding/loops/.
// A video cannot be transparent in every browser, so each scene is rendered once, transparent, and every frame is laid
// on the light and on the dark page color. The owner approves a composition as a still before its loop is made.
//
//   npm run render:onboarding -- --loops                        every scene, 8 seconds at 24 fps (hours in software GL)
//   npm run render:onboarding -- --loops --scene zara-look      one scene (or several, comma separated)
//   npm run render:onboarding -- --loops --scene rho-nod --frames 24   a short test
//
// STILLS (to look at a composition, and the portraits of the choice cards): transparent PNGs through pngquant, into
// public/onboarding/stills/.
//
//   npm run render:onboarding -- --scene zara-portrait          one still into public/
//   npm run render:onboarding -- --scene rho-nod --at 1.6 --draft
//                                                     a full-size PNG into audit-out/onboarding-render/ to look at,
//                                                     nothing written to public/
//
// Needs Chrome (CHROME_PATH if unusual), the source models in glb/, pngquant for the stills (PNGQUANT=<path> if it is
// not on the PATH) and Blender for the loops (BLENDER=<path to blender.exe>). No dev server.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';
import { startServer } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '../..');
const args = parseArgs();
const outDir = join(frontend, 'public/onboarding/stills');
const scratch = join(frontend, 'audit-out/onboarding-render');
const PNGQUANT = process.env.PNGQUANT ?? 'pngquant';
const MENTORS = ['zara', 'rho', 'liruf', 'dina'];
// The second of the loop each still is taken at: the pose at its clearest.
const AT = { 'group-greet': 1.95, 'group-attend': 3, look: 1.4, nod: 1.3, lean: 3.2, portrait: 0, games: 2.0, seeds: 1.6 };
const ALL = ['group-greet', 'group-attend', ...MENTORS.flatMap((mentor) => ['look', 'nod', 'lean', 'portrait', 'games', 'seeds'].map((pose) => `${mentor}-${pose}`))];
// A portrait is a still on a card and has no loop.
const LOOPED = ALL.filter((scene) => !scene.endsWith('-portrait'));
const scenes = typeof args.scene === 'string' ? args.scene.split(',') : args.loops ? LOOPED : ALL;
const LOOP_SECONDS = 8;
const FPS = 24;
const total = Number(args.frames ?? LOOP_SECONDS * FPS);
const CRF = args.crf ?? '28';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const loopsDir = join(frontend, 'public/onboarding/loops');
// The page's own color in each mode (--v-canvas in src/styles/lf-theme.css): the loop is laid on it.
const PAGE = { light: '#f4f5fd', dark: '#0b0d1b' };

mkdirSync(outDir, { recursive: true });
mkdirSync(scratch, { recursive: true });

const server = await startServer(here);
const browser = await launch();

try {
  for (const scene of scenes) {
    const extra = typeof args.query === 'string' ? `&${args.query}` : '';
    const page = await browser.newPage({ width: 1200, height: 900, url: `${server.origin}/onboarding-scene.html?scene=${scene}${extra}`, settle: 500 });

    for (let n = 0; n < 400; n++) {
      if (await page.ev("document.body.dataset.ready === '1'")) break;
      await sleep(200);
    }

    if (!(await page.ev("document.body.dataset.ready === '1'"))) throw new Error(`${scene}: the scene never became ready`);

    if (args.loops) {
      const size = await page.ev('({ width: document.querySelector("canvas") ? window.__size.width : 0, height: window.__size.height })');
      const started = Date.now();

      for (const mode of ['light', 'dark']) {
        rmSync(join(scratch, `${scene}-${mode}`), { recursive: true, force: true });
        mkdirSync(join(scratch, `${scene}-${mode}`), { recursive: true });
      }

      // one render per frame, laid on both page colors
      for (let i = 0; i < total; i++) {
        await page.ev(`window.__render(${i / FPS})`);

        for (const mode of ['light', 'dark']) {
          writeFileSync(join(scratch, `${scene}-${mode}`, `frame-${String(i).padStart(4, '0')}.jpg`), Buffer.from((await page.ev(`window.__frameOn('${PAGE[mode]}')`)).split(',')[1], 'base64'));
        }
      }

      // the poster is the moment the approved still was taken at
      await page.ev(`window.__render(${Number(AT[scene] ?? AT[scene.split('-')[1]] ?? 0)})`);

      const posters = {};

      for (const mode of ['light', 'dark']) posters[mode] = await page.ev(`window.__frameOn('${PAGE[mode]}', 'image/webp', 0.88)`);

      await page.close();
      mkdirSync(loopsDir, { recursive: true });

      for (const mode of ['light', 'dark']) {
        const base = join(loopsDir, `${scene}-${mode}`);
        const run = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', join(here, 'encode.py'), '--', join(scratch, `${scene}-${mode}`), base, String(FPS), String(size.width), String(size.height), String(total), String(CRF)], { encoding: 'utf8' });

        if (run.status !== 0 || !existsSync(`${base}.mp4`)) throw new Error(`${scene} ${mode}: the encode failed:\n${run.stdout?.slice(-1200)}\n${run.stderr?.slice(-600)}`);

        writeFileSync(`${base}-poster.webp`, Buffer.from(posters[mode].split(',')[1], 'base64'));

        if (!args.keep) rmSync(join(scratch, `${scene}-${mode}`), { recursive: true, force: true });
      }

      console.log(`${scene}: ${total} frames in ${Math.round((Date.now() - started) / 1000)} s; light ${Math.ceil(statSync(join(loopsDir, `${scene}-light.mp4`)).size / 1024)} KB, dark ${Math.ceil(statSync(join(loopsDir, `${scene}-dark.mp4`)).size / 1024)} KB`);
      continue;
    }

    const at = Number(args.at ?? AT[scene] ?? AT[scene.split('-')[1]] ?? 0);

    await page.ev(`window.__render(${at})`);

    const full = join(scratch, `${scene}.png`);

    writeFileSync(full, Buffer.from((await page.ev("window.__frame('image/png')")).split(',')[1], 'base64'));
    await page.close();

    if (args.draft) { console.log(`${scene}: ${full}`); continue; }

    const run = spawnSync(PNGQUANT, ['--quality=70-90', '--speed', '1', '--strip', '--force', '--output', join(outDir, `${scene}.png`), full], { encoding: 'utf8' });

    if (run.status !== 0) throw new Error(`pngquant failed (is it installed? set PNGQUANT to its path): ${run.error?.message ?? run.stderr}`);

    console.log(`${scene}: ${(statSync(join(outDir, `${scene}.png`)).size / 1024).toFixed(1)} KB`);
  }
} finally {
  await browser.close();
  server.close();
}
