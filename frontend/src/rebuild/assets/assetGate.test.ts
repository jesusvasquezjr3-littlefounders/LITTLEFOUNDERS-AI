import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  mkdirSync(join(dir, 'src/tutor-scene'), { recursive: true });
  cpSync(join(frontend, 'src/tutor-scene/poseLibrary.ts'), join(dir, 'src/tutor-scene/poseLibrary.ts'));
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
    mkdirSync(join(dir, 'src/i18n', locale), { recursive: true });
    cpSync(join(frontend, 'src/i18n', locale, 'rebuild.json'), join(dir, 'src/i18n', locale, 'rebuild.json'));
  }
  return dir;
}
const manifestPath = (dir: string) => join(dir, 'src/rebuild/assets/manifest.json');
const readManifest = (dir: string) => JSON.parse(readFileSync(manifestPath(dir), 'utf8')) as Row[];
const writeManifest = (dir: string, rows: Row[]) => writeFileSync(manifestPath(dir), JSON.stringify(rows));
function run(dir: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [gate, ...args], { env: { ...process.env, REBUILD_ASSET_ROOT: dir }, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
function mutate(change: (dir: string) => void) {
  const dir = tree();
  change(dir);
  return run(dir);
}

beforeAll(() => { base = mkdtempSync(join(tmpdir(), 'lf-asset-gate-')); });
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('rebuild asset gate', { timeout: 90_000 }, () => {
  it('passes the real manifest and refuses every draft in a release build', () => {
    const dir = tree();
    const ok = run(dir);
    expect(ok.output).toContain('Rebuild asset integrity OK');
    expect(ok.status).toBe(0);
    const release = run(dir, '--release');
    expect(release.status).toBe(1);
    expect(release.output).toContain('Unapproved asset blocks the build');
  });

  it('caps the glyph set at 24 families from one source, drawn to the live area', () => {
    const extra = mutate((dir) => {
      const rows = readManifest(dir);
      const glyphs = Array.from({ length: 6 }, (_, i) => ({ id: `glyph.extra${'abcdef'[i]}`, class: 'A', type: 'glyph', source: 'littlefounders-in-house', slot: 'system.glyph', modes: 'both', altKey: 'decorative', reason: 'test', names: { [`extra${'abcdef'[i]}`]: ['M6 12h12'] } }));
      writeManifest(dir, [...glyphs, ...rows]);
    });
    expect(extra.output).toContain('Glyph budget exceeded: 25 families');
    const secondSource = mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'glyph.menu' ? { ...row, source: 'lucide' } : row))));
    expect(secondSource.output).toContain('Glyph from a second source');
    const outside = mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'glyph.minus' ? { ...row, names: { minus: ['M1 12h22'] } } : row))));
    expect(outside.output).toContain('Glyph leaves the 20 px live area');
    const arc = mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'glyph.info' ? { ...row, names: { info: ['M12 1a11 11 0 1 0 0 22 11 11 0 1 0 0-22z'] } } : row))));
    expect(arc.output).toContain('Glyph leaves the 20 px live area');
    const missing = mutate((dir) => writeManifest(dir, readManifest(dir).filter((row) => row.id !== 'glyph.search')));
    expect(missing.output).toContain('Starting-list glyph missing from the manifest: search');
    for (const result of [extra, secondSource, outside, arc, missing]) expect(result.status).toBe(1);
  });

  it('keeps the manifest the one glyph source: no path data, stray icons or icon packs in rebuilt code', () => {
    const module = join('src/rebuild/design/glyphs.tsx');
    const drift = mutate((dir) => writeFileSync(join(dir, module), readFileSync(join(dir, module), 'utf8').replace("'refresh',", "'refresh', 'star',")));
    expect(drift.output).toContain('GLYPH_NAMES does not mirror the manifest');
    const pathData = mutate((dir) => writeFileSync(join(dir, module), `${readFileSync(join(dir, module), 'utf8')}\nexport const STAR = 'M12 2l3 7';\n`));
    expect(pathData.output).toContain('glyphs.tsx carries path data');
    const stray = mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Stray.tsx'), 'export const Star = () => <svg viewBox="0 0 24 24"><path d="M12 2l3 7" /></svg>;\n'));
    expect(stray.output).toContain('Off-list 24 px icon drawn outside the glyph set: src/rebuild/family/Stray.tsx');
    const pack = mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Pack.tsx'), "import { Star } from 'lucide-react';\nexport { Star };\n"));
    expect(pack.output).toContain('Icon pack imported into the rebuilt frontend');
    const avatars = mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Avatar.tsx'), "import { createAvatar } from '@dicebear/core';\nexport { createAvatar };\n"));
    expect(avatars.output).toContain('Icon pack imported into the rebuilt frontend');
  });

  it('refuses a Mentor avatar that is not a transparent render of the real model in a catalogue pose', () => {
    const opaque = mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.dina.avatar.light'
      ? { ...row, path: '/rebuild/mentor-stills/dina-square-light.png', sizesKb: 90 } : row.id === 'lesson.dina.square.light' ? { ...row, path: '/rebuild/mentor-stills/unused.png' } : row))));
    expect(opaque.output).toMatch(/Background is not transparent|A transparent slot needs an 8-bit RGBA PNG/);
    const lookalike = mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.zara.avatar.dark' ? { ...row, sourceModel: '/generated/zara-lookalike.glb' } : row))));
    expect(lookalike.output).toContain("Render not from the character's own model");
    const pose = mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.rho.avatar.light' ? { ...row, poseId: 'made.up' } : row))));
    expect(pose.output).toContain('Render pose is not in the pose catalogue');
    const incomplete = mutate((dir) => writeManifest(dir, readManifest(dir).filter((row) => row.id !== 'mentor.liruf.avatar.dark')));
    expect(incomplete.output).toContain('No dark avatar render for liruf');
    const approvedWithoutReviewer = mutate((dir) => writeManifest(dir, readManifest(dir).map((row) => (row.id === 'mentor.dina.avatar.dark' ? { ...row, reviewStatus: 'approved' } : row))));
    expect(approvedWithoutReviewer.output).toContain('approvedBy must be set exactly when approved');
    for (const result of [opaque, lookalike, pose, incomplete, approvedWithoutReviewer]) expect(result.status).toBe(1);
  });

  it('refuses unregistered references, off-token SVG colour and text inside art', () => {
    const unregistered = mutate((dir) => writeFileSync(join(dir, 'src/rebuild/family/Art.tsx'), "export const art = '/rebuild/art/unregistered-coin.svg';\n"));
    expect(unregistered.output).toContain('references an unregistered or retired asset: /rebuild/art/unregistered-coin.svg');
    const colour = mutate((dir) => writeFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), readFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), 'utf8').replace('#5C55FD', '#FF00FF')));
    expect(colour.output).toContain('SVG colour #FF00FF is not a token colour');
    const text = mutate((dir) => writeFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), readFileSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), 'utf8').replace('</svg>', '<text>Gold</text></svg>')));
    expect(text.output).toContain('SVG must be plain in-house shapes');
    const unreferenced = mutate((dir) => {
      cpSync(join(dir, 'public/rebuild/art/lesson-medal.svg'), join(dir, 'public/rebuild/art/lesson-medal-copy.svg'));
      writeManifest(dir, [...readManifest(dir), { id: 'badge.spare', class: 'B', type: 'svg', path: '/rebuild/art/lesson-medal-copy.svg', slot: 'badge', modes: 'both', altKey: 'decorative', sizesKb: 2, motionTokens: [], generatedBy: 'in-house SVG', reviewFamily: 'badges', reviewStatus: 'draft', approvedBy: null }]);
    });
    expect(unreferenced.output).toContain('Registered asset is referenced nowhere: badge.spare');
    for (const result of [unregistered, colour, text, unreferenced]) expect(result.status).toBe(1);
  });

  it('keeps reserved hues out of art and at most 3 hues per asset (07 §3, 02 §4.2)', () => {
    const svg = (dir: string) => join(dir, 'public/rebuild/art/pocket-share.svg');
    const recolour = (from: string, to: string) => mutate((dir) => writeFileSync(svg(dir), readFileSync(svg(dir), 'utf8').replace(from, to)));
    const error = recolour('#CC2E72', '#DB1B2B');
    expect(error.output).toContain('Error red never appears in our own art');
    const accent = recolour('#CC2E72', '#EB7301');
    expect(accent.output).toContain('The accent is the call to action only');
    const four = mutate((dir) => writeFileSync(svg(dir), readFileSync(svg(dir), 'utf8').replace('</svg>',
      '<circle cx="8" cy="8" r="4" fill="#4B94FF"/><circle cx="20" cy="8" r="4" fill="#05A893"/><circle cx="32" cy="8" r="4" fill="#5C55FD"/></svg>')));
    expect(four.output).toContain('More than 3 hues in one asset');
    for (const result of [error, accent, four]) expect(result.status).toBe(1);
  });
});
