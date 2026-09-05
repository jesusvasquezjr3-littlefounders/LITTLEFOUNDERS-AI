import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * EVERY `lf-*` CLASS THE APP USES MUST EXIST, AND EVERY GAMIFIED CLASS THAT
 * EXISTS MUST BE USED.
 *
 * Both directions, because both failures happened and every one was SILENT:
 *
 *  1. `md:lf-bubble-tail`. Tailwind generates no variants for a class defined
 *     in `@layer components`, so it compiled to nothing and the speech tail
 *     never appeared.
 *  2. Deleting one unused block from index.css with an index-based slice took
 *     EIGHT more with it — the coin, the slot well, the summary bar, the stage
 *     pill, the orb ring, the live dot, the eyebrow, the waveform. The TSX kept
 *     referencing all of them. Type-check, lint and 1813 tests all passed while
 *     the money exercise rendered coins as plain text.
 *  3. `lf-body-sm` (30 uses), `lf-display-sm` (4) and `lf-display` (4) had NEVER
 *     been defined. Thirty-eight elements — admin tables, the story family, four
 *     page <h1>s — had been taking their size from whatever they inherited.
 *  4. `.lf-token` shipped with no call site at all, and five more classes sat in
 *     the stylesheet rendering nothing. DESIGN.md §Tactile states the rule for
 *     that section — if it is listed there, something calls it — and a rule
 *     nobody can check is already broken somewhere.
 *
 * A missing or dead CSS class is invisible to every other gate here: nothing
 * throws, nothing fails to compile, and the only symptom is a screen that looks
 * wrong to whoever opens it — /AGENTS.md §1.14's shape, in a codebase where
 * looking is expensive.
 *
 * It reads SOURCE, never the compiled stylesheet: Tailwind purges unused
 * component classes, so a build cannot tell "never defined" from "defined and
 * correctly dropped".
 */

const SRC = resolve(__dirname, '..');
const HTML = readFileSync(resolve(SRC, '..', 'index.html'), 'utf8');

function collect(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      collect(full, match, out);
    } else if (match.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/*
 * ONE list, built ONCE, read by every assertion below.
 *
 * An earlier version called the walker again inside each test and got an empty
 * array back, which made the first assertion pass by scanning nothing. A gate
 * that can pass by looking at zero files is worse than no gate, so the count is
 * asserted before anything else is.
 */
const SOURCES = collect(SRC, /\.tsx?$/)
  .filter((f) => !/\.test\.tsx?$/.test(f))
  .map((file) => ({ file, text: readFileSync(file, 'utf8') }));

/*
 * There are SIX stylesheets in this app — index.css plus the rig, the learn
 * scenes and three marketing files — and some CSS ships inside a component as a
 * template literal injected as a <style> tag (MicOrb does this for its three
 * animations, deliberately: the motion belongs to one control and travels with
 * it). All of them count as definitions.
 *
 * A DEFINITION is a selector: `.lf-x` followed by a brace, a comma, another
 * selector fragment, or a descendant — `.lf-scene [class*="animate-"]` defines
 * `lf-scene` as a scoping hook that needs no rule of its own.
 */
const defined = new Set<string>();
for (const text of [
  HTML,
  ...collect(SRC, /\.css$/).map((f) => readFileSync(f, 'utf8')),
  ...SOURCES.map((s) => s.text),
]) {
  for (const m of text.matchAll(/\.(lf-[a-z0-9-]+)\s*(?=[,{.:[>+~]|\s)/g)) defined.add(m[1]!);
}

/*
 * `lf-` is not only a class prefix here. The same token opens CSS custom
 * properties (`--lf-primary`), injected-script ids (`lf-plausible`), storage
 * keys and chart series ids. A scan that cannot tell the difference reports
 * seventy "missing classes" and is ignored inside a week.
 */
const ASSEMBLED = [
  'lf-rig-', // limb hooks, composed per action by the character rig
  'lf-act-', // action wrappers, same
  'lf-actor', // the rig's own root
  'lf-scene-', // per-scene decorations, composed from a scene id
  'lf-hiw-', // how-it-works section hooks
  'lf-how-',
  'lf-course-', // course badge parts, composed from a slug
  'lf-behavior-', // chart series ids, never classes
  'lf-streak', // celebration parts, composed per beat
  'lf-atlas', // the marketing graph's namespace
];

const NOT_CLASSES = new Set([
  'lf-plausible',
  'lf-ga4',
  'lf-umami',
  'lf-sidebar-collapsed',
  'lf-container-max',
  'lf-theme',
  'lf-aid',
  'lf-boot',
]);

describe('design classes', () => {
  it('scanned the whole source tree', () => {
    // Asserted first, so no assertion below can pass by looking at nothing.
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(defined.size).toBeGreaterThan(50);
  });

  it('references no class the stylesheets do not define', () => {
    const missing = new Map<string, string[]>();

    for (const { file, text: source } of SOURCES) {
      for (const m of source.matchAll(/(['"`])((?:[^'"`\\]|\\.)*)\1/g)) {
        const text = m[2] ?? '';
        for (const t of text.matchAll(/\blf-[a-z0-9-]+\b/g)) {
          const cls = t[0];
          const at = t.index ?? 0;
          // `--lf-x` is a custom property, not a class.
          if (text.slice(Math.max(0, at - 2), at) === '--') continue;
          /*
           * A PREFIX, not a class. `\blf-[a-z0-9-]+\b` on the literal
           * `lf-act-${action}` yields `lf-act` — the word boundary eats the
           * trailing dash — so the only way to tell a truncated prefix from a
           * real class is the character after it. General, so a new composed
           * hook needs no new exception.
           */
          if (text[at + cls.length] === '-') continue;
          // ...and the same prefix when the dash came along with it
          // (`lf-hero-${id}` can yield either form depending on what follows).
          if (cls.endsWith('-')) continue;
          if (defined.has(cls)) continue;
          if (NOT_CLASSES.has(cls)) continue;
          if (ASSEMBLED.some((p) => cls.startsWith(p))) continue;
          const rel = file.slice(SRC.length + 1);
          const where = missing.get(cls) ?? [];
          if (!where.includes(rel)) where.push(rel);
          missing.set(cls, where);
        }
      }
    }

    const report = [...missing.entries()].map(([c, f]) => `${c} (${f.join(', ')})`);
    expect(missing.size, `referenced but never defined: ${report.join(' | ')}`).toBe(0);
  });

  it('has no gamified class the app never renders', () => {
    /*
     * The other direction. Scoped to the gamified prefixes rather than to every
     * `lf-*`, because plenty of the older material is applied from CSS itself
     * (descendant selectors, `@apply`) and would report false positives that
     * take a person to dismiss.
     */
    const GAMIFIED =
      /^lf-(ambient|panel|chip|term|track|coin|slot|summary|now|live|eyebrow|stage-pill|orb-ring|token|group-label)/;
    const rendered = new Set<string>();
    for (const { text } of SOURCES) {
      for (const m of text.matchAll(/lf-[a-z0-9-]+/g)) rendered.add(m[0]);
    }
    const orphans = [...defined].filter((c) => GAMIFIED.test(c) && !rendered.has(c));
    expect(orphans, `defined but never rendered: ${orphans.join(', ')}`).toEqual([]);
  });

  it('defines the gamified surface the design study needs', () => {
    for (const cls of [
      'lf-ambient',
      'lf-panel',
      'lf-panel-head',
      'lf-chip',
      'lf-term',
      'lf-track',
      'lf-coin',
      'lf-slot',
      'lf-summary',
      'lf-now',
      'lf-live-dot',
      'lf-eyebrow',
      'lf-stage-pill',
      'lf-live-emerald',
      'lf-orb-ring',
      'lf-tactile',
      'lf-press',
    ]) {
      expect(defined.has(cls), `${cls} is not defined`).toBe(true);
    }
  });

  it('keeps the type scale closed', () => {
    /*
     * DESIGN.md §Typography: the scale is the ONLY way to set type, and it is
     * CLOSED. `lf-body-sm`, `lf-display-sm` and `lf-display` were used in
     * thirty-eight places and existed in none — which is not widening the
     * scale, it is opting out of it by accident.
     */
    const scale = [...defined]
      .filter((c) => /^lf-(display|headline|title|body|caption|label)(-|$)/.test(c))
      .sort();
    expect(scale).toEqual([
      'lf-body',
      'lf-body-lg',
      'lf-caption',
      'lf-caption-tail',
      'lf-display-lg',
      'lf-display-xl',
      'lf-headline',
      'lf-label',
      'lf-title',
    ]);
  });
});
