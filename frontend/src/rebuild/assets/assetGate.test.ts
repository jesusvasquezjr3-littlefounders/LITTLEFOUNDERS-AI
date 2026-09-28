import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/*
 * Mutation tests for the asset gate (scripts/check-rebuild-assets.mjs,
 * Frontend Bible 07 §2, §3, §6, §7). Each case copies the parts of the
 * frontend the gate reads into a temporary tree, breaks one rule, and expects
 * the gate to refuse it with the rule's message; the unbroken copy passes.
 */
const frontend = resolve(__dirname, '../../..');
const gate = join(frontend, 'scripts/check-rebuild-assets.mjs');
let base: string;

type Row = Record<string, unknown> & { id: string; class: string; names?: Record<string, string[]> };

function tree() {
  const dir = mkdtempSync(join(base, 'case-'));
  cpSync(join(frontend, 'src/rebuild'), join(dir, 'src/rebuild'), { recursive: true });
  cpSync(join(frontend, 'public/rebuild'), join(dir, 'public/rebuild'), { recursive: true });
  // Sound cues live under public/sounds (OD-28 L-02): copy only the registered files, not the legacy MP3 set.
  for (const row of readManifest(frontend).filter((r) => r.type === 'wav')) {
    const path = join(dir, 'public', String(row.path));
    mkdirSync(dirname(path), { recursive: true });
    cpSync(join(frontend, 'public', String(row.path)), path);
  }
  mkdirSync(join(dir, 'src/tutor-scene'), { recursive: true });
  cpSync(join(frontend, 'src/tutor-scene/poseLibrary.ts'), join(dir, 'src/tutor-scene/poseLibrary.ts'));
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
    mkdirSync(join(dir, 'src/i18n', locale), { recursive: true });
    for (const file of readdirSync(join(frontend, 'src/i18n', locale)).filter((name) => /^rebuild-[a-z]+\.json$/.test(name))) {
      cpSync(join(frontend, 'src/i18n', locale, file), join(dir, 'src/i18n', locale, file));
    }
  }
  return dir;
}
const manifestPath = (dir: string) => join(dir, 'src/rebuild/assets/manifest.json');
const readManifest = (dir: string) => JSON.parse(readFileSync(manifestPath(dir), 'utf8')) as Row[];
const writeManifest = (dir: string, rows: Row[]) => writeFileSync(manifestPath(dir), JSON.stringify(rows));
// Asynchronous on purpose: a synchronous child blocks the test worker's event
// loop for the whole gate run, and vitest's worker RPC times out under load.
// The OCR no-text check (OD-28 V-16) runs only where a case is about it: every
// other case sets REBUILD_ASSET_OCR=off so the file stays fast under load.
// The local draft override and the hosted-builder markers are cleared, so a case sees only the env it sets.
const HOSTED = ['LF_LOCAL_DRAFT_ASSETS', 'CI', 'VERCEL', 'RAILWAY_ENVIRONMENT', 'NETLIFY'];
function run(dir: string, ...args: string[]) { return spawnGate({}, dir, args, 'off'); }
function runWithOcr(dir: string, ...args: string[]) { return spawnGate({}, dir, args, 'on'); }
function runWith(extra: Record<string, string>, dir: string, ...args: string[]) { return spawnGate(extra, dir, args, 'off'); }
function spawnGate(extra: Record<string, string>, dir: string, args: string[], ocr: 'on' | 'off'): Promise<{ status: number | null; output: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, REBUILD_ASSET_ROOT: dir, REBUILD_ASSET_OCR: ocr };
  for (const name of HOSTED) delete env[name];
  Object.assign(env, extra);
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [gate, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', fail);
    child.on('close', (status) => done({ status, output: `${stdout}${stderr}` }));
  });
}
async function mutate(change: (dir: string) => void) {
  const dir = tree();
  change(dir);
  return run(dir);
}

beforeAll(() => { base = mkdtempSync(join(tmpdir(), 'lf-asset-gate-')); });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('rebuild asset gate', { timeout: 90_000 }, () => {
  it('passes the real manifest and refuses every draft in a release build', async () => {
    const dir = tree();
    const ok = await runWithOcr(dir);
    expect(ok.output).toContain('Rebuild asset integrity OK');
    expect(ok.output).toMatch(/[1-9]\d* raster\(s\) free of text by OCR/);
    expect(ok.status).toBe(0);
    const release = await run(dir, '--release');
    expect(release.status).toBe(1);
    expect(release.output).toContain('Unapproved asset blocks the build');
    expect(release.output).toContain('Unapproved asset blocks the build (07 §6): /sounds/edu/not_yet.wav');
    // This case runs OCR over every live raster too (302 since GAP-FIX-R2): about 80 s alone on a 16-thread machine.
  }, 300_000);

  it('lets only a local build ship drafts (LF_LOCAL_DRAFT_ASSETS), never on CI or a hosting builder, never past another rule', async () => {
    const dir = tree();
    const local = await runWith({ LF_LOCAL_DRAFT_ASSETS: '1' }, dir, '--release');
    expect(local.status).toBe(0);
    expect(local.output).toContain('LOCAL DRAFT BUILD');
    expect(local.output).not.toContain('Unapproved asset blocks the build');
    // Without --release the flag changes nothing: the ordinary gate already allows drafts.
    const plain = await runWith({ LF_LOCAL_DRAFT_ASSETS: '1' }, dir);
    expect(plain.status).toBe(0);
    expect(plain.output).not.toContain('LOCAL DRAFT BUILD');
    // "0"/"false" are not the flag.
    expect((await runWith({ LF_LOCAL_DRAFT_ASSETS: '0' }, dir, '--release')).status).toBe(1);
    for (const hosted of ['CI', 'VERCEL']) {
      const refused = await runWith({ LF_LOCAL_DRAFT_ASSETS: '1', [hosted]: hosted === 'CI' ? 'true' : '1' }, dir, '--release');
      expect(refused.status, hosted).toBe(1);
      expect(refused.output).toContain(`refused on a hosted or CI build (${hosted} is set)`);
      expect(refused.output).toContain('Unapproved asset blocks the build');
    }
    // The override covers `draft` only: a retired asset still blocks the local release build.
    const rows = readManifest(dir);
    const scene = rows.find((row) => row.path === '/rebuild/art/scene-valley.svg');
    expect(scene).toBeDefined();
    scene!.reviewStatus = 'retired';
    writeManifest(dir, rows);
    const broken = await runWith({ LF_LOCAL_DRAFT_ASSETS: '1' }, dir, '--release');
    expect(broken.status).toBe(1);
    expect(broken.output).toContain('Unapproved asset blocks the build (07 §6): /rebuild/art/scene-valley.svg');
  });

  it('caps the glyph set at 24 families from one source, drawn to the live area', async () => {
    const extra = await mutate((dir) => {
      const rows = readManifest(dir);
      const glyphs = Array.from({ length: 6 }, (_, i) => ({ id: `glyph.extra${'abcdef'[i]}`, class: 'A', type: 'glyph', source: 'littlefounders-in-house', slot: 'system.glyph', modes: 'both', altKey: 'decorative', reason: 'test', names: { [`extra${'abcdef'[i]}`]: ['M6 12h12'] } }));
      writeManifest(dir, [...glyphs, ...rows]);
    });
    expect(extra.output).toContain('Glyph budget exceeded: 25 families');
    const secondSource = await mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'glyph.menu' ? { ...row, source: 'lucide' } : row))));
    expect(secondSource.output).toContain('Glyph from a second source');
    const outside = await mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'glyph.minus' ? { ...row, names: { minus: ['M1 12h22'] } } : row))));
    expect(outside.output).toContain('Glyph leaves the 20 px live area');
    const arc = await mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'glyph.info' ? { ...row, names: { info: ['M12 1a11 11 0 1 0 0 22 11 11 0 1 0 0-22z'] } } : row))));
    expect(arc.output).toContain('Glyph leaves the 20 px live area');
    const missing = await mutate((dir) => writeManifest(dir, readManifest(dir).filter((row) => row.id !== 'glyph.search')));
    expect(missing.output).toContain('Starting-list glyph missing from the manifest: search');
    for (const result of [extra, secondSource, outside, arc, missing]) expect(result.status).toBe(1);
  });

  it('keeps the manifest the one glyph source: no path data, stray icons or icon packs in rebuilt code', async () => {
    const module = join('src/rebuild/design/glyphs.tsx');
    const drift = await mutate((dir) => writeFileSync(join(dir, module), readFileSync(join(dir, module), 'utf8').replace("'refresh',", "'refresh', 'star',")));
    expect(drift.output).toContain('GLYPH_NAMES does not mirror the manifest');
    const pathData = await mutate((dir) => writeFileSync(join(dir, module), `${readFileSync(join(dir, module), 'utf8')}\nexport const STAR = 'M12 2l3 7';\n`));
    expect(pathData.output).toContain('glyphs.tsx carries path data');
    const stray = await mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Stray.tsx'), 'export const Star = () => <svg viewBox="0 0 24 24"><path d="M12 2l3 7" /></svg>;\n'));
    expect(stray.output).toContain('Off-list 24 px icon drawn outside the glyph set: src/rebuild/family/Stray.tsx');
    const pack = await mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Pack.tsx'), "import { Star } from 'lucide-react';\nexport { Star };\n"));
    expect(pack.output).toContain('Icon pack imported into the rebuilt frontend');
    const avatars = await mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Avatar.tsx'), "import { createAvatar } from '@dicebear/core';\nexport { createAvatar };\n"));
    expect(avatars.output).toContain('Icon pack imported into the rebuilt frontend');
  });

  it('refuses a Mentor avatar that is not a transparent render of the real model in a catalogue pose', async () => {
    const opaque = await mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.dina.avatar.light'
      ? { ...row, path: '/rebuild/mentor-stills/dina-square-light.png', sizesKb: 90 } : row.id === 'lesson.dina.square.light' ? { ...row, path: '/rebuild/mentor-stills/unused.png' } : row))));
    expect(opaque.output).toMatch(/Background is not transparent|A transparent slot needs an 8-bit RGBA PNG/);
    const lookalike = await mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.zara.avatar.dark' ? { ...row, sourceModel: '/generated/zara-lookalike.glb' } : row))));
    expect(lookalike.output).toContain("Render not from the character's own model");
    const pose = await mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.rho.avatar.light' ? { ...row, poseId: 'made.up' } : row))));
    expect(pose.output).toContain('Render pose is not in the pose catalogue');
    const incomplete = await mutate((dir) => writeManifest(dir, readManifest(dir).filter((row) => row.id !== 'mentor.liruf.avatar.dark')));
    expect(incomplete.output).toContain('No dark avatar render for liruf');
    const approvedWithoutReviewer = await mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.dina.avatar.dark' ? { ...row, reviewStatus: 'approved' } : row))));
    expect(approvedWithoutReviewer.output).toContain('approvedBy must be set exactly when approved');
    for (const result of [opaque, lookalike, pose, incomplete, approvedWithoutReviewer]) expect(result.status).toBe(1);
  });

  it('refuses unregistered references, off-token SVG colour and text inside art', async () => {
    const unregistered = await mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Art.tsx'), "export const art = '/rebuild/art/unregistered-coin.svg';\n"));
    expect(unregistered.output).toContain('references an unregistered or retired asset: /rebuild/art/unregistered-coin.svg');
    const colour = await mutate((dir) => writeFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), readFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), 'utf8').replace('#5C55FD', '#FF00FF')));
    expect(colour.output).toContain('SVG colour #FF00FF is not a token colour');
    const text = await mutate((dir) => writeFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), readFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), 'utf8').replace('</svg>', '<text>Gold</text></svg>')));
    expect(text.output).toContain('SVG must be plain in-house shapes');
    const unreferenced = await mutate((dir) => {
      cpSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), join(dir, 'public/rebuild/art/lesson-medal-copy.svg'));
      writeManifest(dir, [...readManifest(dir), { id: 'badge.spare', class: 'B', type: 'svg', path: '/rebuild/art/lesson-medal-copy.svg', slot: 'badge', modes: 'both', altKey: 'decorative', sizesKb: 2, motionTokens: [], generatedBy: 'in-house SVG', reviewFamily: 'badges', reviewStatus: 'draft', approvedBy: null }]);
    });
    expect(unreferenced.output).toContain('Registered asset is referenced nowhere: badge.spare');
    for (const result of [unregistered, colour, text, unreferenced]) expect(result.status).toBe(1);
  });

  it('refuses raster art with text in it, dark or light, in any locale (07 §7 OCR no-text check, OD-28 V-16)', async () => {
    // A square transparent render with a painted blob, as the avatars are, plus one word.
    const render = (word: string, ink: string) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
      <circle cx="160" cy="110" r="70" fill="#5C55FD"/><text x="70" y="250" font-family="Arial" font-size="48" fill="${ink}">${word}</text></svg>`)).png().toBuffer();
    const dir = tree();
    writeFileSync(join(dir, 'public/rebuild/mentor-avatars/rho-light.png'), await render('Ahorra', '#1B2130'));
    writeFileSync(join(dir, 'public/rebuild/mentor-avatars/zara-dark.png'), await render('Poupar', '#FFFFFF'));
    const result = await runWithOcr(dir);
    expect(result.output).toMatch(/Raster art contains text \(07 §7, OCR read "Ahorra" \d+%\): \/rebuild\/mentor-avatars\/rho-light\.png/);
    expect(result.output).toMatch(/Raster art contains text \(07 §7, OCR read "Poupar" \d+%\): \/rebuild\/mentor-avatars\/zara-dark\.png/);
    expect(result.output).not.toMatch(/Raster art contains text[^\n]*(rho-dark|liruf|dina)/);
    expect(result.status).toBe(1);
    // OCR reads every live raster in the copied tree: GAP-FIX-R2 grew the Mentor renders from 118 to 302 rasters.
  }, 300_000);

  it('keeps reserved hues out of art and at most 3 hues per asset (07 §3, 02 §4.2)', async () => {
    const svg = (dir: string) => join(dir, 'public/rebuild/art/pocket-share.svg');
    const recolour = (from: string, to: string) => mutate((dir) => writeFileSync(svg(dir), readFileSync(svg(dir), 'utf8').replace(from, to)));
    const error = await recolour('#CC2E72', '#DB1B2B');
    expect(error.output).toContain('Error red never appears in our own art');
    const accent = await recolour('#CC2E72', '#EB7301');
    expect(accent.output).toContain('The accent is the call to action only');
    const four = await mutate((dir) => writeFileSync(svg(dir), readFileSync(svg(dir), 'utf8').replace('</svg>',
      '<circle cx="8" cy="8" r="4" fill="#4B94FF"/><circle cx="20" cy="8" r="4" fill="#05A893"/><circle cx="32" cy="8" r="4" fill="#5C55FD"/></svg>')));
    expect(four.output).toContain('More than 3 hues in one asset');
    for (const result of [error, accent, four]) expect(result.status).toBe(1);
  });

  // OD-28 L-02: the gentle "not yet" cue. Each case below breaks one thing in a shared tree, runs the gate
  // asynchronously (13 synchronous runs would block the worker past Vitest's RPC timeout), then restores it.
  const soundId = 'sound.lesson.not-yet';
  function soundTree() {
    const dir = tree();
    const wavPath = join(dir, 'public/sounds/edu/not_yet.wav');
    const original = readFileSync(wavPath);
    const rows = readManifest(dir);
    const extra = join(dir, 'src/rebuild/family/Sound.tsx');
    const attempt = async (change: () => void) => {
      change();
      const result = await run(dir);
      writeFileSync(wavPath, original);
      writeManifest(dir, rows);
      rmSync(extra, { force: true });
      return result;
    };
    const patchRow = (patch: Record<string, unknown>) => writeManifest(dir, rows.map((row) => (row.id === soundId ? { ...row, ...patch } : row)));
    return { dir, wavPath, original, rows, extra, attempt, patchRow };
  }
  /** A mono 16-bit PCM WAV of `seconds` of a sine at `level` (fraction of full scale); `fade` ramps both edges over 10 ms. */
  function tone(seconds: number, level: number, rate: number, fade = true) {
    const count = Math.round(seconds * rate), data = Buffer.alloc(44 + count * 2);
    data.write('RIFF', 0, 'ascii'); data.writeUInt32LE(36 + count * 2, 4); data.write('WAVE', 8, 'ascii');
    data.write('fmt ', 12, 'ascii'); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
    data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
    data.write('data', 36, 'ascii'); data.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++) {
      const edge = fade ? Math.min(1, i / (0.01 * rate), (count - 1 - i) / (0.01 * rate)) : 1;
      data.writeInt16LE(Math.round(32767 * level * edge * Math.cos(2 * Math.PI * 523.25 * i / rate)), 44 + i * 2);
    }
    return data;
  }

  it('holds a sound cue to a bounded, gentle 16-bit PCM WAV (missing, over budget, not WAV, loud, long, click)', async () => {
    const { dir, wavPath, original, attempt, patchRow } = soundTree();
    const missing = await attempt(() => rmSync(wavPath));
    expect(missing.output).toContain('Missing or unreadable asset: /sounds/edu/not_yet.wav');
    // A valid WAV padded with an unknown 40 KB chunk: over the 32 KB sound budget.
    const heavy = await attempt(() => {
      const pad = Buffer.alloc(8 + 40 * 1024); pad.write('pad ', 0, 'ascii'); pad.writeUInt32LE(40 * 1024, 4);
      const bytes = Buffer.concat([original, pad]); bytes.writeUInt32LE(bytes.length - 8, 4);
      writeFileSync(wavPath, bytes); patchRow({ sizesKb: 64 });
    });
    expect(heavy.output).toContain('Asset over the 07 §3.2 budget (59 KB > 32) without a reason: /sounds/edu/not_yet.wav');
    const notWav = await attempt(() => writeFileSync(wavPath, readFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'))));
    expect(notWav.output).toContain('Not a 16-bit PCM mono WAV: /sounds/edu/not_yet.wav');
    const loud = await attempt(() => writeFileSync(wavPath, tone(0.3, 1, 22_050)));
    expect(loud.output).toContain('Sound cue peaks above -9 dBFS (-0.0 dBFS');
    const long = await attempt(() => writeFileSync(wavPath, tone(1.5, 0.2, 8000)));
    expect(long.output).toContain('Sound cue longer than 1 s (1.50 s)');
    const click = await attempt(() => writeFileSync(wavPath, tone(0.3, 0.2, 22_050, false)));
    expect(click.output).toContain('Sound cue starts or ends on a click');
    for (const result of [missing, heavy, notWav, loud, long, click]) expect(result.status).toBe(1);
  });

  it('holds a Lottie motion asset to 07 §5: its static frame, no text or gradient, token colours, 3 s and its generator (OD-28 V-12)', async () => {
    const id = 'celebration.lesson-complete.confetti';
    const json = (dir: string) => join(dir, 'public/rebuild/motion/lesson-confetti.json');
    const patch = (dir: string, change: Partial<Row>) => writeManifest(dir, readManifest(dir).map((row) => (row.id === id ? { ...row, ...change } : row)));
    type Item = Record<string, unknown> & { c?: { k: number[] } };
    type Anim = { op: number; fr: number; layers: Array<Record<string, unknown> & { shapes?: Array<{ it: Item[] }> }> };
    const edit = (dir: string, change: (anim: Anim) => void) => {
      const anim = JSON.parse(readFileSync(json(dir), 'utf8')) as Anim;
      change(anim);
      writeFileSync(json(dir), JSON.stringify(anim));
    };
    const noStill = await mutate((dir) => patch(dir, { staticFrame: undefined }));
    expect(noStill.output).toContain('A Lottie needs its reduced-motion static frame (07 §5)');
    const wrongStill = await mutate((dir) => patch(dir, { staticFrame: '/rebuild/art/lesson-medal.svg' }));
    expect(wrongStill.output).toContain(`A Lottie's static frame is a registered, live SVG of the same slot (07 §5): ${id}`);
    const text = await mutate((dir) => edit(dir, (anim) => { anim.layers.push({ ty: 5, nm: 'caption', t: { d: { k: [] } } }); }));
    expect(text.output).toContain('A motion asset never carries text (07 §5)');
    const gradient = await mutate((dir) => edit(dir, (anim) => { anim.layers[0]!.shapes![0]!.it.push({ ty: 'gf', nm: 'glow' }); }));
    expect(gradient.output).toContain('Lottie gradient; token fills only');
    const offToken = await mutate((dir) => edit(dir, (anim) => { anim.layers[0]!.shapes![0]!.it[1]!.c!.k = [0.1, 0.2, 0.3, 1]; }));
    expect(offToken.output).toMatch(/Lottie colour #1a334d is not a token colour/);
    const long = await mutate((dir) => edit(dir, (anim) => { anim.op = 60 * 4; }));
    expect(long.output).toContain('Lottie longer than 3 s or empty');
    const fast = await mutate((dir) => edit(dir, (anim) => { anim.fr = 120; }));
    expect(fast.output).toContain('Lottie frame rate must be at most 60 fps');
    const untimed = await mutate((dir) => patch(dir, { motionTokens: ['--dur-slow'] }));
    expect(untimed.output).toContain(`A motion asset maps to the motion tokens (07 §5): ${id}`);
    const unplayed = await mutate((dir) => {
      const view = join(dir, 'src/rebuild/learning/LessonResultView.tsx');
      writeFileSync(view, readFileSync(view, 'utf8').split(id).join('celebration.lesson-complete.other'));
    });
    expect(unplayed.output).toContain(`Registered asset is referenced nowhere: ${id}`);
    expect(unplayed.output).toContain('Registered asset is referenced nowhere: celebration.lesson-complete.confetti-still');
    // Every edit above also drifts the file from its zero-spend generator.
    expect(text.output).toContain('Asset does not match its generator scripts/generate-lesson-confetti.mjs; rerun it: /rebuild/motion/lesson-confetti.json');
    for (const result of [noStill, wrongStill, text, gradient, offToken, long, fast, untimed, unplayed]) expect(result.status).toBe(1);
  }, 600_000); // nine gate runs in a row: longer than the suite's 90 s budget on a loaded machine

  it('holds a sound cue to its generator, its review status and the draft-only wiring exemption', async () => {
    const { dir, rows, extra, attempt, patchRow } = soundTree();
    // A valid, gentle WAV that is not what the checked-in generator makes.
    const drift = await attempt(() => writeFileSync(join(dir, 'public/sounds/edu/not_yet.wav'), tone(0.3, 0.2, 22_050)));
    expect(drift.output).toContain('Asset does not match its generator scripts/synthesize-not-yet-sound.mjs');
    expect(drift.output).not.toContain('Sound cue');
    const approvedWithoutReviewer = await attempt(() => patchRow({ reviewStatus: 'approved' }));
    expect(approvedWithoutReviewer.output).toContain(`approvedBy must be set exactly when approved: ${soundId}`);
    // The exemption is for a draft with a planned call site only: approved and unplayed, or a draft without one, fails.
    // The W2 learner lane already plays the cue (sfx.ts, lessonCue.ts): unwire both call sites for these two cases.
    const callSites = ['src/lesson-engine/player/sfx.ts', 'src/rebuild/learning/lessonCue.ts'].map((file) => join(dir, file)).filter((file) => existsSync(file));
    const played = callSites.map((file) => readFileSync(file, 'utf8'));
    const unwire = () => callSites.forEach((file, i) => writeFileSync(file, played[i]!.split('/sounds/edu/not_yet.wav').join('')));
    const rewire = () => callSites.forEach((file, i) => writeFileSync(file, played[i]!));
    const approvedUnwired = await attempt(() => { unwire(); patchRow({ reviewStatus: 'approved', approvedBy: 'owner' }); });
    expect(approvedUnwired.output).toContain(`Registered asset is referenced nowhere: ${soundId}`);
    const draftWithoutWiring = await attempt(() => { unwire(); writeManifest(dir, rows.map((row) => (row.id === soundId ? { ...row, wiring: undefined } : row))); });
    expect(draftWithoutWiring.output).toContain(`Registered asset is referenced nowhere: ${soundId}`);
    rewire();
    const informative = await attempt(() => patchRow({ altKey: 'lesson.feedback.notYet', modes: 'light' }));
    expect(informative.output).toContain('A sound cue is decorative in both modes');
    const unregistered = await attempt(() => writeFileSync(extra, "export const cue = '/sounds/edu/unregistered.wav';\n"));
    expect(unregistered.output).toContain('src/rebuild/family/Sound.tsx references an unregistered or retired sound: /sounds/edu/unregistered.wav');
    for (const result of [drift, approvedWithoutReviewer, approvedUnwired, draftWithoutWiring, informative, unregistered]) expect(result.status).toBe(1);
    // Restored, the tree passes again: a draft that plays is still a draft (--release refuses it).
    const restored = await run(dir);
    expect(restored.output).toContain('Rebuild asset integrity OK');
    expect(restored.status).toBe(0);
  });
});
