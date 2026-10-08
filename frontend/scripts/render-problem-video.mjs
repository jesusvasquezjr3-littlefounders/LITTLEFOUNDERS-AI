import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The landing hero's video (owner direction, 2026-10-06: a light looping video
 * that plays on any device, not the live 3D scene).
 *
 * The scene is `src/rebuild/site/hero/HeroScene.tsx` on the preview entry
 * (`rebuild.html?screen=problem-capture`). It is played on a VIRTUAL CLOCK stepped
 * by hand at 60 steps a second, so the renderer reaches its high tier and every
 * frame is exact; 24 video frames a second are taken from it (2 or 3 steps
 * apart, so the time of each is within 8 ms of nominal). The scene is periodic
 * in LOOP seconds, and the last second is cross-faded onto the first so that
 * what little is not periodic (the characters' breathing) does not show at the
 * seam. Frames are rendered at 1.5x and reduced with Lanczos to the delivered
 * size (07 §3: supersample, then downsample).
 *
 * Frames go to a scratch folder; Blender's bundled FFmpeg encodes them
 * (scripts/hero-video-encode.py; no other encoder is installed or needed):
 * one H.264 MP4 that every browser and phone decodes in hardware (a VP9 WebM is
 * available with HERO_CRF_WEBM, but with this encoder it came out larger), and a
 * WebP poster for the first paint and for reduced motion.
 *
 * Delivered to `public/rebuild/landing/problem/` per colour mode:
 *   problem-<mode>.mp4, problem-<mode>-poster.webp
 *
 * Prerequisites (gitignored): the runtime models in `public/scenes/` and the Basis
 * transcoder in `public/basis/`; a Vite dev server; Blender installed.
 *   REBUILD_URL=http://localhost:5173 node scripts/render-problem-video.mjs
 * Env: HERO_MODES=light (subset), HERO_GPU=software (default hardware), HERO_FRAMES=48 (a short test run),
 *      HERO_KEEP=1 (keep the frames), HERO_ENCODE_ONLY=1 (encode the kept frames again), HERO_CRF_MP4 / HERO_CRF_WEBM,
 *      BLENDER=<path to blender.exe>.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5173';
const MODES = process.env.HERO_MODES?.split(',') ?? ['light', 'dark'];
const GPU = process.env.HERO_GPU === 'software' ? 'software' : 'hardware';
const LOOP = 30; // seconds; must equal LOOP in src/rebuild/site/hero/heroProps.tsx
const FPS = 24;
const SIZE = { width: 1000, height: 800 }; // HERO_VIDEO_SIZE in HeroCapture.tsx
const SCALE = 1.5;
const SEAM = FPS; // frames cross-faded
const WARM_UP = 4; // seconds on the virtual clock before the first frame: tier, light and camera settle, the gestures are under way
const total = Number(process.env.HERO_FRAMES ?? LOOP * FPS);
const outDir = resolve('public/rebuild/landing/problem');
const scratch = resolve('../audit-results/problem-video');
const CRF = { mp4: process.env.HERO_CRF_MP4 ?? '32', webm: process.env.HERO_CRF_WEBM ?? '0' };
const ENCODE_ONLY = process.env.HERO_ENCODE_ONLY === '1';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';

mkdirSync(outDir, { recursive: true });
mkdirSync(scratch, { recursive: true });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const VIRTUAL_CLOCK = `(() => {
  let now = 0; const base = Date.now(); let queue = [];
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (count) => { for (let i = 0; i < count; i++) { now += 1000 / 60; const run = queue; queue = []; for (const cb of run) cb(now); } return now; };
})();`;

/** Advances the virtual clock until the scene's own time reaches `target` seconds (the scene sums the frame deltas). */
async function advanceTo(page, target) {
  for (let guard = 0; guard < 8; guard++) {
    const time = await page.evaluate('window.__heroClock ? window.__heroClock.current : -1');
    if (time < 0) { await page.evaluate('window.__step(2)'); await wait(20); continue; }
    if (time >= target - 1e-4) return time;
    const steps = Math.max(1, Math.min(60, Math.round((target - time) * 60 - 0.5)));
    await page.evaluate(`window.__step(${steps})`);
    await wait(30); // React commits the beat change in real time; the next frames must see it
  }
  return page.evaluate('window.__heroClock.current');
}

const browser = ENCODE_ONLY ? { child: { kill() {} } } : await launchBrowser(mkdtempSync(join(scratch, 'chrome-')), { gpuMode: GPU });
try {
  for (const mode of MODES) {
    const frames = join(scratch, mode);
    if (!ENCODE_ONLY) {
    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const page = await openPage(browser.browser, { width: SIZE.width, height: SIZE.height, dark: mode === 'dark' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: SIZE.width, height: SIZE.height, deviceScaleFactor: SCALE, mobile: false });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    await page.send('Page.navigate', { url: `${origin}/rebuild.html?screen=problem-capture&theme=${mode}&locale=en-US` });

    let ready = false;
    for (let n = 0; n < 600 && !ready; n++) {
      await wait(200);
      await page.evaluate('window.__step && window.__step(2)').catch(() => {});
      ready = await page.evaluate("document.body.dataset.heroReady === '1' && !!window.__heroClock").catch(() => false);
    }
    if (!ready) throw new Error(`${mode}: the problem scene never became ready`);
    await advanceTo(page, WARM_UP);

    const grab = async (index) => {
      await advanceTo(page, WARM_UP + index / FPS);
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 96, clip: { x: 0, y: 0, width: SIZE.width, height: SIZE.height, scale: 1 }, captureBeyondViewport: false });
      const file = join(frames, `raw-${String(index).padStart(4, '0')}.jpg`);
      await sharp(Buffer.from(shot.data, 'base64')).resize(SIZE.width, SIZE.height, { kernel: 'lanczos3' })
        .jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(file);
      return file;
    };
    const started = Date.now();
    for (let i = 0; i < total + SEAM; i++) {
      await grab(i);
      if (i % 60 === 0) console.log(`${mode}: frame ${i}/${total + SEAM} (${Math.round((Date.now() - started) / 1000)} s)`);
    }
    await page.send('Page.close').catch(() => {});

    // The seam: the first SEAM frames fade from the frames that FOLLOW the last one (the loop continuing) to the real first frames.
    for (let i = 0; i < total; i++) {
      const name = `frame-${String(i).padStart(4, '0')}.jpg`;
      const raw = join(frames, `raw-${String(i).padStart(4, '0')}.jpg`);
      if (i >= SEAM) { await sharp(raw).toFile(join(frames, name)); continue; }
      const follow = join(frames, `raw-${String(total + i).padStart(4, '0')}.jpg`);
      const mix = i / SEAM;
      const [a, b] = await Promise.all([sharp(follow).raw().toBuffer({ resolveWithObject: true }), sharp(raw).raw().toBuffer({ resolveWithObject: true })]);
      const out = Buffer.alloc(a.data.length);
      for (let p = 0; p < out.length; p++) out[p] = Math.round(a.data[p] * (1 - mix) + b.data[p] * mix);
      await sharp(out, { raw: a.info }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(join(frames, name));
    }
    for (const f of readdirSync(frames)) if (f.startsWith('raw-')) rmSync(join(frames, f));
    }

    await sharp(join(frames, 'frame-0000.jpg')).webp({ quality: 84, effort: 6 }).toFile(join(outDir, `problem-${mode}-poster.webp`));
    const run = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', resolve('scripts/hero-video-encode.py'), '--', frames, join(outDir, `problem-${mode}`), String(FPS), String(SIZE.width), String(SIZE.height), String(total), CRF.mp4, CRF.webm], { encoding: 'utf8' });
    if (run.status !== 0 || !existsSync(join(outDir, `problem-${mode}.mp4`))) throw new Error(`Blender encode failed:\n${run.stdout?.slice(-1500)}\n${run.stderr?.slice(-800)}`);
    for (const ext of CRF.webm === '0' ? ['mp4'] : ['mp4', 'webm']) {
      const file = join(outDir, `problem-${mode}.${ext}`);
      console.log(`${mode} ${ext}: ${existsSync(file) ? Math.ceil(statSync(file).size / 1024) : 'missing'} KB`);
    }
    console.log(`${mode} poster: ${Math.ceil(statSync(join(outDir, `problem-${mode}-poster.webp`)).size / 1024)} KB`);
    if (process.env.HERO_KEEP !== '1') rmSync(frames, { recursive: true, force: true });
  }
} finally {
  browser.child.kill();
}
