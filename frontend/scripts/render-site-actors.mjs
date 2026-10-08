import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The landing's characters in motion (owner brief, 2026-10-07): a Mentor that moves is a short looping video, and it is TRANSPARENT, so
 * the model stands on the page itself with no rectangle around it. Each clip is the real 3D model performing a catalogue pose
 * (greet.hop jumps, think.ponder thinks, celebrate.lesson celebrates...), captured from `rebuild.html?screen=site-actor` on a virtual
 * clock with the page's background removed, once per colour mode (the light rig differs). The clip starts and ends at rest, and its
 * first frames fade from the frames that would follow, so the loop has no seam. A video has no alpha channel in the codecs every
 * browser plays, so the alpha rides beside the picture: each frame is twice as wide, the colour (premultiplied) on the left and the
 * alpha as grey on the right, in an ordinary H.264 MP4 encoded by Blender's bundled FFmpeg (scripts/hero-video-encode.py, as the hero
 * does). The page's `ActorClip` draws it through a small WebGL shader that puts the two halves back together. The first frame is the
 * transparent WebP poster the page paints before it plays, and what stays for reduced motion or less data.
 *
 *   REBUILD_URL=http://localhost:5173 node scripts/render-site-actors.mjs
 * Env: ACTORS=lesson-hello,lesson-think (subsets), ACTOR_CRF (default 28), ACTOR_KEEP=1, HERO_GPU=software, BLENDER.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5173';
// One set of clips for both colour modes: the characters are always lit by the light rig (a dark rig leaves them dim on a dark page).
const MODES = process.env.ACTOR_MODES?.split(',') ?? ['light'];
const CRF = process.env.ACTOR_CRF ?? '28';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const GPU = process.env.HERO_GPU === 'software' ? 'software' : 'hardware';
const FPS = 30;
const SEAM = 15; // frames cross-faded
const SIZE = { width: 640, height: 760 };
const outDir = resolve('public/rebuild/landing/actors');
const scratch = resolve('../audit-results/site-actors');
mkdirSync(outDir, { recursive: true });
mkdirSync(scratch, { recursive: true });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** `seconds` is the loop's length; `fire` is when the pose's action starts (the clip is at rest before and after it). */
const ACTORS = [
  // Measured on Dina (mean frame difference from rest, 0-255): hop 28, celebrate 15, nod and ponder 12; a wave barely moves her short arms.
  { name: 'lesson-hello', who: 'dina', pose: 'greet.hop', fill: 0.64, fire: 0.4, seconds: 3 },
  { name: 'lesson-think', who: 'dina', pose: 'think.ponder', fill: 0.64, fire: 0.5, seconds: 3.6 },
  { name: 'lesson-nod', who: 'dina', pose: 'feedback.retry.gentle', fill: 0.64, fire: 0.5, seconds: 3 },
  { name: 'lesson-celebrate', who: 'dina', pose: 'celebrate.lesson', fill: 0.64, fire: 0.3, seconds: 3.6 },
  { name: 'peek-zara', who: 'zara', pose: 'ambient.curious', fill: 0.92, fire: 0.5, seconds: 4 },
].filter((actor) => !process.env.ACTORS || process.env.ACTORS.split(',').includes(actor.name));

const VIRTUAL_CLOCK = `(() => {
  let now = 0; const base = Date.now(); let queue = [];
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (count) => { for (let i = 0; i < count; i++) { now += 1000 / 60; const run = queue; queue = []; for (const cb of run) cb(now); } return now; };
})();`;

const browser = await launchBrowser(mkdtempSync(join(scratch, 'chrome-')), { gpuMode: GPU });
try {
  for (const mode of MODES) for (const actor of ACTORS) {
    const label = actor.name;
    const frames = join(scratch, label);
    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const page = await openPage(browser.browser, { width: SIZE.width, height: SIZE.height, dark: mode === 'dark' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: SIZE.width, height: SIZE.height, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await page.send('Page.navigate', { url: `${origin}/rebuild.html?screen=site-actor&who=${actor.who}&pose=${actor.pose}&fill=${actor.fill}&fire=${actor.fire}&theme=${mode}&locale=en-US` });
    let ready = false;
    for (let n = 0; n < 480 && !ready; n++) {
      await wait(250);
      await page.evaluate('window.__step && window.__step(2)').catch(() => {});
      ready = await page.evaluate("!!document.querySelector('[data-site-actor] canvas')").catch(() => false);
    }
    if (!ready) throw new Error(`${label}: the stage never mounted`);
    // The page's own backgrounds would paint over the transparent canvas; the clip is the character alone.
    await page.evaluate("document.head.insertAdjacentHTML('beforeend', '<style>html,body,.lf-rebuild{background:transparent!important}</style>')");
    // The renderer promotes its tier, the camera and light settle: two virtual seconds at rest before the clip starts.
    for (let s = 0; s < 4; s++) { await page.evaluate('window.__step(30)'); await wait(60); }
    await page.evaluate('window.__actorStart = performance.now()');

    const total = Math.round(actor.seconds * FPS);
    let covered = null;
    for (let i = 0; i < total + SEAM; i++) {
      await page.evaluate('window.__step(2)');
      await wait(28); // React commits the pose change in real time; the next frames must see it
      // A frame the renderer has not drawn yet comes out (nearly) empty: take it again rather than put a blank flash in the loop.
      let picture = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: SIZE.width, height: SIZE.height, scale: 1 }, captureBeyondViewport: false });
        picture = await sharp(Buffer.from(shot.data, 'base64')).ensureAlpha().png({ compressionLevel: 3 }).toBuffer();
        const { channels } = await sharp(picture).stats();
        const coverage = channels[3].mean / 255;
        covered = covered === null ? coverage : covered;
        if (coverage > covered * 0.5) break;
        await page.evaluate('window.__step(1)');
        await wait(60);
      }
      await sharp(picture).toFile(join(frames, `raw-${String(i).padStart(4, '0')}.png`));
    }
    await page.send('Page.close').catch(() => {});

    // The seam: the first SEAM frames fade from the frames that FOLLOW the last one (the loop continuing) to the real first frames.
    for (let i = 0; i < total; i++) {
      const name = `frame-${String(i).padStart(4, '0')}.png`;
      const raw = join(frames, `raw-${String(i).padStart(4, '0')}.png`);
      if (i >= SEAM) { await sharp(raw).toFile(join(frames, name)); continue; }
      const follow = join(frames, `raw-${String(total + i).padStart(4, '0')}.png`);
      const mix = i / SEAM;
      const [a, b] = await Promise.all([sharp(follow).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
      const out = Buffer.alloc(a.data.length);
      for (let p = 0; p < out.length; p++) out[p] = Math.round(a.data[p] * (1 - mix) + b.data[p] * mix);
      await sharp(out, { raw: a.info }).png({ compressionLevel: 3 }).toFile(join(frames, name));
    }
    for (const f of readdirSync(frames)) if (f.startsWith('raw-')) rmSync(join(frames, f));

    await sharp(join(frames, 'frame-0000.png')).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(join(outDir, `${label}.webp`));
    // Pack each frame: colour (premultiplied, i.e. over black) on the left, the alpha as grey on the right.
    const packed = join(scratch, `${label}-packed`);
    rmSync(packed, { recursive: true, force: true });
    mkdirSync(packed, { recursive: true });
    for (let i = 0; i < total; i++) {
      const { data, info } = await sharp(join(frames, `frame-${String(i).padStart(4, '0')}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const out = Buffer.alloc(info.width * 2 * info.height * 3);
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const from = (y * info.width + x) * 4, alpha = data[from + 3] / 255;
        const left = (y * info.width * 2 + x) * 3, right = (y * info.width * 2 + info.width + x) * 3;
        out[left] = Math.round(data[from] * alpha); out[left + 1] = Math.round(data[from + 1] * alpha); out[left + 2] = Math.round(data[from + 2] * alpha);
        out[right] = out[right + 1] = out[right + 2] = data[from + 3];
      }
      await sharp(out, { raw: { width: info.width * 2, height: info.height, channels: 3 } }).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toFile(join(packed, `frame-${String(i).padStart(4, '0')}.jpg`));
    }
    const base = join(outDir, label);
    const run = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', resolve('scripts/hero-video-encode.py'), '--', packed, base, String(FPS), String(SIZE.width * 2), String(SIZE.height), String(total), CRF, '0'], { encoding: 'utf8' });
    if (run.status !== 0 || !existsSync(`${base}.mp4`)) throw new Error(`${label}: Blender encode failed:
${run.stdout?.slice(-1200)}
${run.stderr?.slice(-600)}`);
    console.log(`${label}: ${actor.seconds} s, ${Math.ceil(statSync(`${base}.mp4`).size / 1024)} KB`);
    rmSync(packed, { recursive: true, force: true });
    if (process.env.ACTOR_KEEP !== '1') rmSync(frames, { recursive: true, force: true });
  }
} finally {
  browser.child.kill();
}
