import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * Mentor avatar renders from the REAL models (Frontend Bible 07 §4, 02 rule 21).
 *
 * Renders each of the four Mentor characters in one pose-catalogue pose, in
 * both colour modes, with a transparent background, locally and at zero spend:
 * no image model, no paid service. It drives the development pose lab
 * (`/dev/pose-lab`), which composes `CharacterStage`, the same one-character
 * surface the Lesson Engine uses, so the render is of the runtime model the
 * learner sees (`/scenes/<character>.glb`) and not of a second rig built to be
 * photographed. The stage's `auto` lighting follows the page theme, so the
 * light and dark renders are lit like the surface each one sits on.
 *
 * Two steps:
 *   1. render: the full 2048 px canvas (a 1024 px stage at dpr 2, `high`
 *      tier) is saved as a master in `audit-results/mentor-avatar-masters/`
 *      (gitignored);
 *   2. crop: each master is framed for the square avatar slot and downsampled
 *      in the browser to `public/rebuild/mentor-avatars/<character>-<mode>.png`
 *      (RGBA). `AVATAR_FROM_MASTERS=1` re-crops without re-rendering.
 *
 * The files are drafts: `src/rebuild/assets/manifest.json` registers them with
 * `reviewStatus: "draft"` until the owner approves the character-render family
 * (07 §7, OD-14), and the release build refuses drafts.
 *
 * Prerequisites (both gitignored; see README "Rebuild assets and audits"):
 *   - the runtime models in `public/scenes/` (a copy from a provisioned
 *     checkout) and the Basis transcoder in `public/basis/`
 *     (`node scripts/copy-3d-decoders.mjs`);
 *   - a Vite dev server: `REBUILD_URL=http://localhost:5310 npm run assets:render-avatars`.
 *
 * Env: AVATAR_CHARACTERS=rho,zara (subset), AVATAR_POSE (default below).
 * About four minutes per render under the software rasteriser.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5310';
const POSE = process.env.AVATAR_POSE ?? 'ambient.idle';
const CHARACTERS = process.env.AVATAR_CHARACTERS?.split(',') ?? ['rho', 'zara', 'liruf', 'dina'];
const MODES = ['light', 'dark'];
const STAGE = 1024; // stage size in CSS px, rendered at dpr 2
const OUT = 256; // delivered size: 2.67x the largest avatar slot (96 px)
const outDir = resolve('public/rebuild/mentor-avatars');
const masterDir = resolve('../audit-results/mentor-avatar-masters');
mkdirSync(outDir, { recursive: true });
mkdirSync(masterDir, { recursive: true });

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const browser = await launchBrowser(mkdtempSync(join(masterDir, 'chrome-')));
const report = [];

/*
 * A VIRTUAL CLOCK, stepped by hand. Under the software rasteriser the stage's
 * adaptive governor measures ~17 fps, demotes itself to the `low` tier and
 * cuts the render scale, so a real-time capture photographs the cheapest
 * settings. Replacing `requestAnimationFrame` and the clocks before any page
 * script runs makes every frame exactly 1/60 s apart: the governor then
 * promotes to `high` as it would on a capable device, and the idle animation,
 * the camera framing and the light rig's exponential ease are all sampled at
 * the same virtual moment on every run. This touches only the capture tab;
 * no runtime setting is changed (the Mentor stage keeps its budget).
 */
const VIRTUAL_CLOCK = `(() => {
  let now = 0; const base = Date.now(); let queue = [];
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__stepFrames = (count) => { for (let i = 0; i < count; i++) { now += 1000 / 60; const run = queue; queue = []; for (const cb of run) cb(now); } return now; };
})();`;
const step = (page, count) => page.evaluate(`window.__stepFrames(${count})`);
const stats = (page) => page.evaluate(`document.querySelector('[data-scene-stats]')?.textContent ?? ''`);
const master = (character, mode) => join(masterDir, `${character}-${mode}.png`);

async function renderMasters() {
  for (const mode of MODES) {
    const page = await openPage(browser.browser, { width: STAGE, height: STAGE, dark: mode === 'dark' });
    // dpr 2 so the `high` tier (pixel-ratio ceiling 2) renders a 2048 px canvas.
    await page.send('Emulation.setDeviceMetricsOverride', { width: STAGE, height: STAGE, deviceScaleFactor: 2, mobile: false });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    for (const character of CHARACTERS) {
      await page.send('Page.navigate', { url: `${origin}/dev/pose-lab?character=${character}&pose=${encodeURIComponent(POSE)}` });
      let ready = false;
      for (let n = 0; n < 240 && !ready; n++) {
        await wait(250);
        if (await page.evaluate(`typeof window.__stepFrames === 'function' && !!document.querySelector('canvas')`)) await step(page, 2);
        ready = /[1-9][\d,.]* tris/.test(await stats(page));
      }
      if (!ready) throw new Error(`${character}/${mode}: the stage never reported drawn triangles`);
      if (!await page.evaluate(`new URLSearchParams(location.search).get('pose') === ${JSON.stringify(POSE)} && new URLSearchParams(location.search).get('character') === ${JSON.stringify(character)}`)) {
        throw new Error(`${character}/${mode}: the pose lab did not accept ${POSE}`);
      }
      // Isolate the stage: fixed, square, transparent, above everything else.
      await page.evaluate(`(() => {
        const stage = document.querySelector('canvas').closest('.rounded-lg');
        stage.style.cssText = 'position:fixed;inset:0;inline-size:${STAGE}px;block-size:${STAGE}px;aspect-ratio:auto;border-radius:0;background:transparent;z-index:2147483647;';
      })()`);
      // 30 virtual seconds: five good windows promote a tier (twice), the
      // framing re-measures the new size, and the dampers arrive.
      for (let s = 0; s < 30; s++) { await step(page, 60); await wait(20); }
      const settled = await stats(page);
      if (!/\bhigh\b/.test(settled)) throw new Error(`${character}/${mode}: the stage did not reach the high tier (${settled})`);
      const png = await page.evaluate(`(() => {
        const source = document.querySelector('canvas');
        if (source.width !== ${STAGE * 2} || source.height !== ${STAGE * 2}) throw new Error('canvas is ' + source.width + 'x' + source.height);
        const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
        copy.getContext('2d').drawImage(source, 0, 0);
        return copy.toDataURL('image/png');
      })()`);
      writeFileSync(master(character, mode), Buffer.from(png.split(',')[1], 'base64'));
      report.push({ character, mode, pose: POSE, stats: settled });
      console.log(`rendered ${character} ${mode}: ${settled}`);
    }
    await page.send('Page.close').catch(() => {});
  }
}

/*
 * FRAMING FOR THE AVATAR SLOT, measured from the silhouette. Upright figures
 * are framed head and shoulders: a square centred on the head (the opaque span
 * of the top tenth of the silhouette), two thirds of the figure's height for
 * the big-headed characters (Rho, Liruf, Dina as she stands facing the camera).
 * Zara is the one character with realistic proportions, whose head is about a
 * seventh of her height: at two thirds her face would be a few pixels in the
 * 32 px tab, so her square is 0.42 of her height (looked at, not derived). A
 * figure wider than it is tall keeps its whole body.
 */
const FRAMING = { zara: 0.42 };
const CROP = `async (dataUrl, framing) => {
  const image = new Image(); image.src = dataUrl; await image.decode();
  const w = image.naturalWidth, h = image.naturalHeight;
  const copy = document.createElement('canvas'); copy.width = w; copy.height = h;
  const cx = copy.getContext('2d'); cx.drawImage(image, 0, 0);
  const data = cx.getImageData(0, 0, w, h).data;
  const alpha = (x, y) => data[(y * w + x) * 4 + 3];
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alpha(x, y) > 200) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x; }
  }
  if (bottom < 0) throw new Error('empty master');
  const bw = right - left + 1, bh = bottom - top + 1;
  let side, centreX;
  if (bh > bw * 1.2) {
    side = Math.round(bh * framing);
    let hl = w, hr = -1;
    for (let y = top; y < top + Math.round(bh * 0.1); y++) for (let x = left; x <= right; x++) if (alpha(x, y) > 200) { if (x < hl) hl = x; if (x > hr) hr = x; }
    centreX = (hl + hr) / 2;
  } else {
    side = Math.round(Math.max(bw, bh) * 1.06);
    centreX = (left + right) / 2;
  }
  const sx = Math.round(centreX - side / 2), sy = Math.round(top - side * 0.05);
  // Two-step downsample so the reduction averages every source pixel.
  const half = document.createElement('canvas'); half.width = ${OUT * 2}; half.height = ${OUT * 2};
  const hx = half.getContext('2d'); hx.imageSmoothingEnabled = true; hx.imageSmoothingQuality = 'high';
  hx.drawImage(copy, sx, sy, side, side, 0, 0, ${OUT * 2}, ${OUT * 2});
  const out = document.createElement('canvas'); out.width = ${OUT}; out.height = ${OUT};
  const ox = out.getContext('2d'); ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  ox.drawImage(half, 0, 0, ${OUT}, ${OUT});
  return { png: out.toDataURL('image/png'), bbox: [left, top, bw, bh], crop: [sx, sy, side] };
}`;

async function cropMasters() {
  const page = await openPage(browser.browser, { width: 400, height: 400, dark: false });
  for (const character of CHARACTERS) for (const mode of MODES) {
    const file = master(character, mode);
    if (!existsSync(file)) throw new Error(`No master for ${character}/${mode}; render it first`);
    const dataUrl = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
    const result = await page.evaluate(`(${CROP})(${JSON.stringify(dataUrl)}, ${FRAMING[character] ?? 0.66})`);
    const out = join(outDir, `${character}-${mode}.png`);
    writeFileSync(out, Buffer.from(result.png.split(',')[1], 'base64'));
    report.push({ character, mode, bbox: result.bbox, crop: result.crop, out });
    console.log(`cropped ${character} ${mode} -> ${out}`);
  }
}

try {
  if (process.env.AVATAR_FROM_MASTERS !== '1') await renderMasters();
  await cropMasters();
  writeFileSync(join(masterDir, 'report.json'), JSON.stringify({ origin, pose: POSE, stage: STAGE, out: OUT, steps: report }, null, 2));
} finally {
  browser.child.kill();
}
