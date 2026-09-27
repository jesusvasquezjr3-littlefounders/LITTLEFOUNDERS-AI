import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The Mentor chooser's pictures (Frontend Bible 08 §8: "the four real
 * characters on the Diorama, rendered from the models"; 07 §4; OD-14), locally
 * and at zero spend: no image model, no paid service.
 *
 * Each picture is the rebuilt Mentor stage itself (`MentorStage`, the one
 * component the Mentor screen and the lesson show), rendering the character's
 * runtime model (`/scenes/<character>.glb`) in the catalogue's idle pose,
 * standing on its Diorama, in both colour modes. The development preview
 * (`rebuild.html?screen=mentor-stage`) mounts it; the stage is pinned to fill
 * a 4:5 viewport and photographed at device pixel ratio 2, then downsampled
 * and palette-quantised to the delivered size.
 *
 * A VIRTUAL CLOCK, as in render-mentor-avatars.mjs: under the software
 * rasteriser the renderer would measure a low frame rate, demote itself and
 * (in the Mentor stage) fall back to a still. Stepping every frame exactly
 * 1/60 s apart lets it promote to its high tier as on a capable device; only
 * the capture tab is affected, no runtime setting changes.
 *
 * The files are drafts: `src/rebuild/assets/manifest.json` registers them
 * (`mentor.chooserStill`) with `reviewStatus: "draft"` until the owner approves
 * the character-render family (07 §7, OD-14); a release build refuses drafts.
 *
 * Prerequisites (gitignored): the runtime models in `public/scenes/` and the
 * Basis transcoder in `public/basis/`; a Vite dev server:
 *   REBUILD_URL=http://localhost:5430 node scripts/render-mentor-chooser.mjs
 * Env: CHOOSER_CHARACTERS=rho,zara and CHOOSER_MODES=light (subsets), CHOOSER_SCENE (default diorama-b: on diorama-a a
 * rock prop stands in front of the characters' legs and hands in this shot), CHOOSER_SHOT (default closeup-wide).
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5430';
const CHARACTERS = process.env.CHOOSER_CHARACTERS?.split(',') ?? ['rho', 'zara', 'liruf', 'dina'];
const SCENE = process.env.CHOOSER_SCENE ?? 'diorama-b';
const SHOT = process.env.CHOOSER_SHOT ?? 'closeup-wide';
/*
 * Per-character framing, chosen by looking. Dina is short and wide: in a 4:5
 * viewport the engine's close-up framing fills the frame with her head, and the
 * wider shots put a bush in front of her or make her a speck. She is framed in
 * a landscape viewport (WIDE) and the 4:5 picture is cut from its centre.
 * CHOOSER_SHOTS=dina=approach overrides a shot.
 */
/* On diorama-b a bush stands in front of Dina's standing spot (seen in W2M.1 and here): her picture is taken on diorama-a. */
const SCENES = { dina: 'diorama-a', ...Object.fromEntries((process.env.CHOOSER_SCENES ?? '').split(',').filter(Boolean).map((pair) => pair.split('='))) };
const WIDE = new Set((process.env.CHOOSER_WIDE ?? 'dina').split(',').filter(Boolean));
const WIDE_VIEW = { width: 700, height: 500 };
const SHOTS = { ...Object.fromEntries((process.env.CHOOSER_SHOTS ?? '').split(',').filter(Boolean).map((pair) => pair.split('='))) };
const MODES = process.env.CHOOSER_MODES?.split(',') ?? ['light', 'dark'];
const VIEW = { width: 400, height: 500 }; // 4:5, captured at dpr 2
const OUT = { width: 320, height: 400 }; // delivered: 2x the chooser's largest slot
const outDir = resolve('public/rebuild/mentor-chooser');
const masterDir = resolve('../audit-results/mentor-chooser-masters');
mkdirSync(outDir, { recursive: true });
mkdirSync(masterDir, { recursive: true });

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const VIRTUAL_CLOCK = `(() => {
  let now = 0; const base = Date.now(); let queue = [];
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__stepFrames = (count) => { for (let i = 0; i < count; i++) { now += 1000 / 60; const run = queue; queue = []; for (const cb of run) cb(now); } return now; };
})();`;

const browser = await launchBrowser(mkdtempSync(join(masterDir, 'chrome-')));
const report = [];
try {
  for (const mode of MODES) {
    const page = await openPage(browser.browser, { width: VIEW.width, height: VIEW.height, dark: mode === 'dark' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: 2, mobile: true });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    for (const character of CHARACTERS) {
      const view = WIDE.has(character) ? WIDE_VIEW : VIEW;
      await page.send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 2, mobile: true });
      await page.send('Page.navigate', { url: `${origin}/rebuild.html?screen=mentor-stage&character=${character}&state=idle&age=6-9&scene=${SCENES[character] ?? SCENE}&shot=${SHOTS[character] ?? SHOT}&theme=${mode}&locale=en-US` });
      let ready = false;
      for (let n = 0; n < 480 && !ready; n++) {
        await wait(250);
        await page.evaluate(`(() => {
          const stage = document.querySelector('.lf-mentor-stage');
          if (stage && !stage.dataset.pinned) {
            stage.dataset.pinned = '1';
            stage.style.cssText = 'position:fixed;inset:0;inline-size:100vw;block-size:100vh;z-index:2147483647;border-radius:0;';
          }
          if (typeof window.__stepFrames === 'function') window.__stepFrames(2);
        })()`).catch(() => {});
        ready = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return !!s && s.dataset.ready === 'true' && s.dataset.renderMode === 'live' && !s.dataset.stillPose; })()`).catch(() => false);
      }
      if (!ready) throw new Error(`${character}/${mode}: the live stage never became ready`);
      // 20 virtual seconds: the renderer promotes its tier, the camera settles, the light rig eases in.
      for (let s = 0; s < 20; s++) { await page.evaluate('window.__stepFrames(60)'); await wait(40); }
      const state = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return { ...s.dataset }; })()`);
      if (state.renderMode !== 'live' || state.mentorCharacter !== character || state.mentorPose !== 'ambient.idle') throw new Error(`${character}/${mode}: ${JSON.stringify(state)}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: (view.width - VIEW.width) / 2, y: 0, width: VIEW.width, height: VIEW.height, scale: 1 }, captureBeyondViewport: false });
      const master = join(masterDir, `${character}-${mode}.png`);
      writeFileSync(master, Buffer.from(shot.data, 'base64'));
      const file = join(outDir, `${character}-${mode}.png`);
      await sharp(master).resize(OUT.width, OUT.height, { fit: 'cover', kernel: 'lanczos3' })
        .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(file);
      const meta = await sharp(file).metadata();
      const bytes = statSync(file).size;
      report.push({ character, mode, scene: SCENES[character] ?? SCENE, shot: SHOTS[character] ?? SHOT, pose: state.mentorPose, bytes, width: meta.width, height: meta.height });
      console.log(`rendered ${character} ${mode}: ${meta.width}x${meta.height}, ${Math.ceil(bytes / 1024)} KB`);
    }
    await page.send('Page.close').catch(() => {});
  }
  writeFileSync(join(masterDir, 'report.json'), JSON.stringify({ origin, scene: SCENE, shot: SHOT, view: VIEW, out: OUT, renders: report }, null, 2));
} finally {
  browser.child.kill();
}
