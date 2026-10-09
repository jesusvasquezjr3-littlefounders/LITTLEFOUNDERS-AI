// Renders the sign-in window's scene (signin-scene.js) to public/landing/signin/ as a looping H.264 MP4 and a
// WebP poster per color mode. A developer tool, run by hand; it is not part of the build.
//
//   npm run render:signin                    both modes, 12 s at 24 fps (about 8 minutes in software GL)
//   npm run render:signin -- --still 3.5     PNGs of the scene at the given seconds (comma separated) into audit-out/ to look at, per mode
//   npm run render:signin -- --mode dark     one mode
//   npm run render:signin -- --frames 48     a short test run
//
// Needs: Chrome (CHROME_PATH if unusual), Blender for the encode (BLENDER=<path to blender.exe>; the same
// encoder the landing videos used), and the source models in glb/ at the repository root (the artist sources,
// full quality, because this is a static render; the runtime copies in public/scenes/ are for the Tutor only).
// No dev server is needed: this script serves the scene page, three.js and the models itself.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs, sleep } from '../audit/lib.mjs';
import { startServer } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '../..');
const args = parseArgs();
const MODES = typeof args.mode === 'string' ? [args.mode] : ['light', 'dark'];
const FPS = 24;
const LOOP = 12; // seconds; equal to LOOP in signin-scene.js
const total = Number(args.frames ?? LOOP * FPS);
const SIZE = { width: 1440, height: 420 }; // SCENE_SIZE.signin in src/features/landing/LoopVideo.tsx
const CRF = args.crf ?? '30';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const outDir = join(frontend, 'public/landing/signin');
const scratch = join(frontend, 'audit-out/signin-render');
const stills = args.still === undefined ? null : String(args.still === true ? 0 : args.still).split(',').map(Number);

const server = await startServer(here);
const origin = server.origin;

mkdirSync(scratch, { recursive: true });
mkdirSync(outDir, { recursive: true });

const browser = await launch();

try {
  for (const mode of MODES) {
    const page = await browser.newPage({ width: 1440, height: 420, url: `${origin}/signin-scene.html?mode=${mode}${args.debug ? '&debug' : ''}`, settle: 500 });

    for (let n = 0; n < 300; n++) {
      if (await page.ev("document.body.dataset.ready === '1'")) break;
      await sleep(200);
    }

    if (!(await page.ev("document.body.dataset.ready === '1'"))) throw new Error(`${mode}: the scene never became ready`);

    if (args.debug) console.log(await page.ev("(window.__log ?? []).join(' ; ')"));

    const grab = async (t, type = 'image/jpeg') => {
      await page.ev(`window.__render(${t})`);

      return Buffer.from((await page.ev(`window.__frame('${type}', 0.96)`)).split(',')[1], 'base64');
    };

    if (stills) {
      for (const t of stills) writeFileSync(join(scratch, `still-${mode}-${t}.png`), await grab(t, 'image/png'));
      console.log(`${mode}: stills in ${scratch}`);
      await page.close();
      continue;
    }

    const frames = join(scratch, mode);

    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });

    const started = Date.now();

    for (let i = 0; i < total; i++) {
      writeFileSync(join(frames, `frame-${String(i).padStart(4, '0')}.jpg`), await grab(i / FPS));

      if (i % 48 === 0) console.log(`${mode}: frame ${i}/${total} (${Math.round((Date.now() - started) / 1000)} s)`);
    }

    writeFileSync(join(scratch, `poster-${mode}.png`), await grab(0, 'image/png'));
    await page.close();

    const run = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', join(here, 'encode.py'), '--', frames, join(outDir, `signin-${mode}`), String(FPS), String(SIZE.width), String(SIZE.height), String(total), String(CRF)], { encoding: 'utf8' });

    if (run.status !== 0 || !existsSync(join(outDir, `signin-${mode}.mp4`))) throw new Error(`The encode failed:\n${run.stdout?.slice(-1500)}\n${run.stderr?.slice(-800)}`);

    // the poster: Chrome converts the PNG to WebP through the same canvas, so no image library is needed
    const poster = await browser.newPage({ width: 10, height: 10, url: 'about:blank', settle: 0 });
    const data = readFileSync(join(scratch, `poster-${mode}.png`)).toString('base64');
    const webp = await poster.ev(`(async () => { const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL('image/webp', 0.86); })()`);

    await poster.close();
    writeFileSync(join(outDir, `signin-${mode}-poster.webp`), Buffer.from(webp.split(',')[1], 'base64'));
    console.log(`${mode}: mp4 ${Math.ceil(statSync(join(outDir, `signin-${mode}.mp4`)).size / 1024)} KB, poster ${Math.ceil(statSync(join(outDir, `signin-${mode}-poster.webp`)).size / 1024)} KB`);

    if (!args.keep) rmSync(frames, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  server.close();
}
