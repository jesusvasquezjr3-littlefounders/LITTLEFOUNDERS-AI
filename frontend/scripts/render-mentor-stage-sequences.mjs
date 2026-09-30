import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { STAGE_STILL_POSES } from './lib/mentorStagePoses.mjs';

/*
 * The Mentor stage's rendered sequences (Frontend Bible 08 §7, 07 §4, §5; gap-fix round 8), locally and at zero
 * spend: no image or video model, no paid service.
 *
 * 08 §7: in the fallback (low-power device, no WebGL, data saver, a device that cannot hold 30 fps, a failed
 * renderer) the stage shows "pre-rendered stills and short sequences from the same models and catalogue poses";
 * "idle is a still: sequences play once per state change and settle". The stills are
 * render-mentor-stage-stills.mjs (`mentor.stageStill`). This renders the sequences: for every pose the full stage can
 * play except idle, per character and colour mode, the rebuilt Mentor stage itself (`MentorStage`, the character's
 * runtime model `/scenes/<character>.glb` on `diorama-a`, the live stage's default shot) moving from idle INTO the
 * pose, in real time, ending on that pose's registered still.
 *
 * How one sequence is made:
 *   1. The capture tab runs the LIVE stage (no reduced motion) on a virtual clock, as the stills do, so the
 *      software rasteriser does not demote the renderer; the stage idles for 6 virtual seconds.
 *   2. The preview's state changes without a reload (`history.replaceState` + `popstate`, MentorStagePreview), so the
 *      engine plays the catalogue transition exactly as it does for a learner.
 *   3. The still shows the gesture HELD at its representative frame (`HELD_ACTION_PROGRESS` of the action's clip:
 *      the authored clip's own length for the bipeds, `ACTION_SECONDS` for Dina's procedural rig). The sequence is
 *      the real motion over the last `motion token` of time before that frame (07 §5: a state change maps to a motion
 *      token; `--dur-transition`, 380 ms, and `--dur-celebration`, 700 ms, only for the D7 celebration poses), one
 *      frame every 50 ms of engine time. A pose whose action is `idle` (an emotion change) is the first 380 ms after
 *      the change.
 *   4. The last moving frame is blended half-way into the still, and the still itself is the final frame (07 §5:
 *      every rendered sequence has a still; it is the sequence's end frame). The WebP plays ONCE (loop count 1).
 *
 * The files are drafts: `src/rebuild/assets/manifest.json` registers them (`mentor.stageSequence`, type `sequence`,
 * `endFrame` = the still's id) with `reviewStatus: "draft"` until the owner approves the character-render family
 * (07 §7, OD-14).
 *
 * Prerequisites (gitignored): the runtime models in `public/scenes/` and the Basis transcoder in `public/basis/`; the
 * stage stills already rendered; a Vite dev server:
 *   REBUILD_URL=http://localhost:6410 node scripts/render-mentor-stage-sequences.mjs
 * Env: SEQ_CHARACTERS=rho,zara, SEQ_MODES=light, SEQ_POSES=think.ponder (subsets); SEQ_FORCE=1 renders files already
 * on disk again; SEQ_MANIFEST=1 prints the manifest rows for what exists on disk (no browser).
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:6410';
const CHARACTERS = process.env.SEQ_CHARACTERS?.split(',') ?? ['rho', 'zara', 'liruf', 'dina'];
const MODES = process.env.SEQ_MODES?.split(',') ?? ['light', 'dark'];

/** Every pose the full stage can play except idle, which is a still (08 §7). */
export const STAGE_SEQUENCE_POSES = STAGE_STILL_POSES.filter((row) => row.pose !== 'ambient.idle');
const POSES = process.env.SEQ_POSES ? STAGE_SEQUENCE_POSES.filter((row) => process.env.SEQ_POSES.split(',').includes(row.pose)) : STAGE_SEQUENCE_POSES;
/** The D7 celebration poses (only ever shown for a milestone, OD-7) take the celebration token; every other state change the transition token. */
const CELEBRATION_POSES = new Set(['celebrate.with', 'celebrate.applaud']);
export const tokenOf = (pose) => (CELEBRATION_POSES.has(pose) ? { token: '--dur-celebration', ms: 700 } : { token: '--dur-transition', ms: 380 });
const FIRST_FRAME_S = 4 / 60; // the first captured frame is at least this long after the change
const FRAME_MS = 50; // one frame every 50 ms of engine time (3 steps of the 60 Hz virtual clock)
const SETTLE_FRAME_MS = 100; // the final frame (the still) holds; the animation then stops on it

const SCENE = 'diorama-a';
const SHOTS = { rho: 'closeup', zara: 'closeup', liruf: 'closeup', dina: 'closeup-wide' };
const WIDE = new Set(['dina']);
const VIEW = { width: 400, height: 500 };
const WIDE_VIEW = { width: 700, height: 500 };
const OUT = { width: 400, height: 500 };
const outDir = resolve('public/rebuild/mentor-sequence');
const stillDir = resolve('public/rebuild/mentor-stage');
const masterDir = resolve('../audit-results/mentor-sequence-masters');
const dashed = (pose) => pose.replace(/\./g, '-');
const fileOf = (character, pose, mode) => `${character}-${dashed(pose)}-${mode}.webp`;
const stillOf = (character, pose, mode) => join(stillDir, `${character}-${dashed(pose)}-${mode}.png`);

if (process.env.SEQ_MANIFEST === '1') {
  const rows = [];
  for (const character of CHARACTERS) for (const { pose } of STAGE_SEQUENCE_POSES) for (const mode of MODES) {
    const file = join(outDir, fileOf(character, pose, mode));
    let kb;
    try { kb = Math.ceil(statSync(file).size / 1024); } catch { continue; }
    const meta = await sharp(file, { animated: true }).metadata();
    const durationMs = meta.delay.slice(0, -1).reduce((sum, ms) => sum + ms, 0);
    const { token } = tokenOf(pose);
    rows.push(JSON.stringify({
      id: `mentor.${character}.sequence.${pose}.${mode}`, class: 'B', type: 'sequence', path: `/rebuild/mentor-sequence/${fileOf(character, pose, mode)}`,
      slot: 'mentor.stageSequence', aspect: '4:5', modes: mode, character, poseId: pose, sourceModel: `/scenes/${character}.glb`, altKey: 'decorative',
      endFrame: `mentor.${character}.stage.${pose}.${mode}`, durationMs, sizesKb: kb + 2, motionTokens: [token],
      ...(kb > 150 ? { budgetReason: 'A --dur-celebration sequence (700 ms): 15 moving frames and the still at 400x500, over the 150 KB character-still budget (07 3.2 is an initial judgement)' } : {}),
      generatedBy: `local render: scripts/render-mentor-stage-sequences.mjs (MentorStage live on ${SCENE}, ${SHOTS[character]}, virtual clock, ending on its still)`,
      reviewFamily: 'character-renders', reviewStatus: 'draft', approvedBy: null,
    }).replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/,"/g, ', "').replace(/":/g, '": '));
  }
  console.log(rows.map((row) => `  ${row},`).join('\n'));
  process.exit(0);
}

/** The catalogue action each pose plays (`src/tutor-scene/poseLibrary.ts`); the capture checks the stage agrees. */
function poseActions() {
  const text = readFileSync(resolve('src/tutor-scene/poseLibrary.ts'), 'utf8');
  return Object.fromEntries([...text.matchAll(/\{ id: '([a-z.]+)',[^}]*?action: '([a-z]+)'/g)].map((m) => [m[1], m[2]]));
}
const STAGE_POSE_ACTIONS = poseActions();

/** The engine time, after the change, of the frame the still holds: the token's span when the action is idle. */
function heldTime(action, character, tokenMs, tables) {
  if (action === 'idle') return tokenMs / 1000;
  const length = character === 'dina' ? tables.seconds[action] : (CLIPS[`${action}@${character}`] ?? CLIPS[action] ?? tables.seconds[action]);
  return Math.max(tables.held[action] * length, tokenMs / 1000);
}

/** The authored biped clips' own lengths (the runtime plays `<action>@<character>` when it exists, else `<action>`). */
function clipSeconds() {
  const glb = readFileSync(resolve('public/scenes/clips-biped.glb'));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  return Object.fromEntries(json.animations.map((animation) => [animation.name,
    Math.max(...animation.samplers.map((sampler) => json.accessors[sampler.input].max[0]))]));
}
const CLIPS = clipSeconds();

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

const stageUrl = (character, query, mode) => `${origin}/rebuild.html?screen=mentor-stage&character=${character}&${query}&scene=${SCENE}&shot=${SHOTS[character]}&theme=${mode}&locale=en-US`;

const dataset = (page) => page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return s ? { ...s.dataset } : {}; })()`);
const step = (page, frames) => page.evaluate(`window.__stepFrames(${frames})`);

const browser = await launchBrowser(mkdtempSync(join(masterDir, 'chrome-')));
const report = [];
try {
  for (const mode of MODES) {
    const page = await openPage(browser.browser, { width: VIEW.width, height: VIEW.height, dark: mode === 'dark' });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    for (const character of CHARACTERS) {
      const todo = POSES.filter(({ pose }) => process.env.SEQ_FORCE === '1' || !existsSync(join(outDir, fileOf(character, pose, mode))));
      if (!todo.length) continue;
      const view = WIDE.has(character) ? WIDE_VIEW : VIEW;
      await page.send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 2, mobile: true });
      for (let attempt = 1; ; attempt++) {
        try { await renderCharacter(page, view, character, mode, todo); break; } catch (error) {
          if (attempt >= 3) throw error;
          console.log(`retrying ${character} ${mode}: ${error.message}`);
        }
      }
    }
    await page.send('Page.close').catch(() => {});
  }
  writeFileSync(join(masterDir, `report-${CHARACTERS.join('-')}-${MODES.join('-')}.json`), JSON.stringify({ origin, scene: SCENE, shots: SHOTS, out: OUT, frameMs: FRAME_MS, renders: report }, null, 2));
} finally {
  browser.child.kill();
}


/** Switches the mounted preview to another query (MentorStagePreview reads it again on popstate). */
async function switchTo(page, character, query, mode) {
  const url = stageUrl(character, query, mode);
  await page.evaluate(`(() => { history.replaceState(null, '', ${JSON.stringify(url)}); dispatchEvent(new PopStateEvent('popstate')); })()`);
  // React commits on its own scheduler (real time); two virtual frames let the renderer take the new props.
  await wait(250);
  await step(page, 2);
  await wait(50);
}

async function renderCharacter(page, view, character, mode, todo) {
  const idle = 'state=idle&age=6-9';
  await page.send('Page.navigate', { url: stageUrl(character, idle, mode) });
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
  if (!ready) throw new Error(`${character}/${mode}: the live stage never became ready (${JSON.stringify(await dataset(page).catch(() => ({})))})`);
  // The same tables the engine plays from (Vite serves the module to the capture tab).
  const tables = await page.evaluate(`import('/src/tutor-scene/characterActions.ts').then((m) => ({ held: m.HELD_ACTION_PROGRESS, seconds: m.ACTION_SECONDS }))`);
  for (let s = 0; s < 6; s++) { await step(page, 60); await wait(40); }
  // Every pose once before any capture: whatever a pose loads on first use is loaded before its sequence is taken.
  for (const { query } of todo) { await switchTo(page, character, query, mode); await step(page, 30); }
  for (const { pose, query } of todo) {
    // Back to idle between poses, settled, so every sequence starts where a learner's does: from the stage at rest.
    await switchTo(page, character, idle, mode);
    const { ms: tokenMs0 } = tokenOf(pose);
    const action0 = STAGE_POSE_ACTIONS[pose];
    const heldAt0 = heldTime(action0, character, tokenMs0, tables);
    for (let s = 0; s < 3; s++) { await step(page, 60); await wait(10); }
    await switchTo(page, character, query, mode);
    const state = await dataset(page);
    if (state.renderMode !== 'live' || state.mentorCharacter !== character || state.mentorPose !== pose) throw new Error(`${character}/${pose}/${mode}: ${JSON.stringify(state)}`);
    const action = state.mentorAction;
    const { token, ms: tokenMs } = tokenOf(pose);
    if (action !== action0) throw new Error(`${character}/${pose}: the stage plays ${action}, the pose table says ${action0}`);
    const heldAt = heldAt0;
    /*
     * The window is the token's span that ends on the held frame. It never includes the first frames after the
     * change: the capture tab showed the stage without its character on the frame right after a switch (the new
     * props arrive between two virtual frames), a capture artefact the learner's continuous clock does not produce.
     */
    const startAt = Math.max(heldAt - tokenMs / 1000, FIRST_FRAME_S);
    const already = 2 / 60; // switchTo stepped two frames
    await step(page, Math.max(0, Math.round((startAt - already) * 60)));
    const count = Math.round(tokenMs / FRAME_MS) + 1;
    const frames = [];
    for (let k = 0; k < count; k++) {
      if (k > 0) await step(page, 3);
      await wait(20);
      const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: (view.width - VIEW.width) / 2, y: 0, width: VIEW.width, height: VIEW.height, scale: 1 }, captureBeyondViewport: false });
      frames.push(await sharp(Buffer.from(shot.data, 'base64')).resize(OUT.width, OUT.height, { fit: 'cover', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer());
    }
    const still = await sharp(stillOf(character, pose, mode)).resize(OUT.width, OUT.height, { fit: 'cover' }).removeAlpha().raw().toBuffer();
    // How far the last moving frame is from the still (mean absolute difference per channel, 0-255): the evidence
    // that the motion arrives at the held pose rather than being cut to it.
    let diff = 0;
    const last = frames[frames.length - 1];
    for (let i = 0; i < last.length; i++) diff += Math.abs(last[i] - still[i]);
    diff /= last.length;
    // The last two moving frames dissolve a third and two thirds into the still, then the still is the final frame.
    for (const [back, share] of [[2, 1 / 3], [1, 2 / 3]]) {
      const frame = frames[frames.length - back];
      const blend = Buffer.alloc(frame.length);
      for (let i = 0; i < frame.length; i++) blend[i] = Math.round(frame[i] * (1 - share) + still[i] * share);
      frames[frames.length - back] = blend;
    }
    frames.push(still);
    const pngs = await Promise.all(frames.map((raw) => sharp(raw, { raw: { width: OUT.width, height: OUT.height, channels: 3 } }).png().toBuffer()));
    // The moving frames share the token exactly; the final still holds.
    const moving = frames.length - 1;
    const delay = Array.from({ length: moving }, (_, k) => Math.floor(tokenMs / moving) + (k < tokenMs % moving ? 1 : 0));
    delay.push(SETTLE_FRAME_MS);
    const file = join(outDir, fileOf(character, pose, mode));
    await sharp(pngs, { join: { animated: true } }).webp({ loop: 1, delay, quality: 62, effort: 6, smartSubsample: true }).toFile(file);
    const bytes = statSync(file).size;
    report.push({ character, mode, pose, action, token, heldAt, startAt, frames: frames.length, endDiff: Number(diff.toFixed(2)), bytes });
    console.log(`rendered ${character} ${pose} ${mode}: ${frames.length} frames, ${token}, end diff ${diff.toFixed(2)}, ${Math.ceil(bytes / 1024)} KB`);
  }
}
