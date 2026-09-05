import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * EVERY `lf-*` CLASS THE APP REFERENCES MUST EXIST IN THE STYLESHEET.
 *
 * This gate exists because the failure it catches actually happened, three
 * times, and every time it was SILENT:
 *
 *  1. `md:lf-bubble-tail`. Tailwind does not generate variants for a class
 *     defined in `@layer components`, so it compiled to nothing and the speech
 *     tail simply never appeared. No error, no warning.
 *  2. Deleting one unused component block from index.css with an index-based
 *     slice took EIGHT more with it — the coin, the slot well, the summary bar,
 *     the stage pill, the mic orb's ring, the live dot, the eyebrow. The TSX
 *     kept referencing all of them. Type-check passed, lint passed, 1813 tests
 *     passed, and the money exercise quietly went back to rendering coins as
 *     plain text.
 *  3. `lf-body-sm` (30 uses across 13 files) and `lf-display-sm` (4 uses) had
 *     NEVER been defined. Those elements had been taking their size from
 *     whatever they inherited, in the admin console and the story family, for
 *     as long as the classes had existed.
 *
 * A missing CSS class is invisible to every other gate here: nothing throws,
 * nothing fails to compile, and the only symptom is a screen that looks wrong
 * to somebody who happens to open it — /AGENTS.md §1.14's shape exactly, in a
 * codebase where looking is expensive.
 *
 * It checks the SOURCE, not the compiled output, deliberately: Tailwind purges
 * unused component classes, so a built stylesheet cannot tell "never defined"
 * apart from "defined and correctly dropped".
 */

const SRC = resolve(__dirname, '..');
const HTML = readFileSync(resolve(SRC, '..', 'index.html'), 'utf8');
/*
 * ALL of them. There are six stylesheets in this app, not one — index.css plus
 * the rig, the learn scenes, and three marketing files. The first version of
 * this gate read only index.css and reported twenty classes as missing that
 * were defined perfectly well next door, which is how a useful gate becomes
 * one everybody skips.
 */
function stylesheets(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      stylesheets(full, out);
    } else if (entry.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

function walkSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walkSources(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/*
 * Classes every stylesheet defines, plus index.html's inline block, PLUS the
 * ones a component ships as a template literal and injects as a <style> tag.
 * MicOrb does exactly that for its three animations, deliberately — the motion
 * belongs to one control and travels with it. A gate that only reads `.css`
 * files calls those three missing, which they are not.
 */
const defined = new Set<string>();
const sources = [HTML, ...stylesheets(SRC).map((f) => readFileSync(f, 'utf8'))];
for (const file of walkSources(SRC)) sources.push(readFileSync(file, 'utf8'));
for (const source of sources) {
  // A DEFINITION is a selector: `.lf-x` followed by whitespace, a comma, a
  // brace or another selector fragment — never `.lf-x` inside a class string.
  // A DEFINITION is a selector: `.lf-x` followed by a brace, a comma, another
  // selector fragment, or a DESCENDANT — `.lf-scene [class*="animate-"]` in
  // scenes.css defines `lf-scene` as a scoping hook that needs no rule of its
  // own, and a scanner that misses it calls seven working files broken.
  for (const m of source.matchAll(/\.(lf-[a-z0-9-]+)\s*(?=[,{.:[>+~]|\s)/g)) defined.add(m[1]!);
}

/*
 * `lf-` is not only a class prefix in this codebase. The same token opens CSS
 * CUSTOM PROPERTIES (`--lf-primary`), DOM ids for injected scripts
 * (`lf-plausible`), storage keys (`lf-sidebar-collapsed`) and chart series ids
 * (`lf-behavior-pv`). A scan that cannot tell the difference reports seventy
 * "missing classes" and is ignored inside a week, which is worse than no gate
 * at all. Custom properties are excluded by looking at the two characters
 * BEFORE the match; everything else is a named, deliberate exception.
 */
const ASSEMBLED = [
  'lf-rig-', // limb hooks, composed per action by the character rig
  'lf-act-', // action wrappers, same
  'lf-actor', // the rig's own root, defined in rig.css
  'lf-scene-', // per-scene decorations, composed from a scene id
  'lf-hiw-', // how-it-works section hooks, composed from a section id
  'lf-how-', // ditto
  'lf-course-', // course badge parts, composed from a slug
  'lf-behavior-', // chart series ids, never classes
  'lf-streak', // celebration parts, composed per beat
  'lf-atlas', // the marketing graph's own namespace
];

/** Tokens that are ids, storage keys or series names rather than classes. */
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

describe('every lf-* class the app uses is defined', () => {
  it('has no reference to a class the stylesheet does not define', () => {
    const missing = new Map<string, string[]>();

    for (const file of walkSources(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/(['"`])((?:[^'"`\\]|\\.)*)\1/g)) {
        const text = m[2] ?? '';
        for (const t of text.matchAll(/\blf-[a-z0-9-]+\b/g)) {
          const cls = t[0];
          const at = t.index ?? 0;
          // `--lf-x` is a custom property, not a class.
          if (text.slice(Math.max(0, at - 2), at) === '--') continue;
          if (defined.has(cls)) continue;
          if (NOT_CLASSES.has(cls)) continue;
          if (ASSEMBLED.some((p) => cls.startsWith(p))) continue;
          /*
           * A PREFIX, not a class. `lf-[a-z0-9-]+` on the literal
           * `lf-act-${action}` yields `lf-act` — the trailing dash is eaten by
           * the word boundary — so the only way to tell a truncated prefix
           * from a real class is to look at what follows it in the source.
           * General, so a new composed hook needs no new exception.
           */
          if (text[at + cls.length] === '-') continue;
          // A bare prefix left behind by a template literal (`lf-scene-${id}`).
          if (cls.endsWith('-')) continue;
          const rel = file.slice(SRC.length + 1);
          const where = missing.get(cls) ?? [];
          if (!where.includes(rel)) where.push(rel);
          missing.set(cls, where);
        }
      }
    }

    const report = [...missing.entries()].map(([cls, files]) => `  ${cls} — ${files.join(', ')}`);
    expect(missing.size, `referenced but never defined:\n${report.join('\n')}`).toBe(0);
  });

  it('defines the gamified surface the design study needs', () => {
    /*
     * A spot-check on the pieces §Tactile names, so deleting one is a failing
     * test rather than a screen somebody notices later. These are exactly the
     * ones a bad slice removed.
     */
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
      'lf-wave',
      'lf-tactile',
      'lf-press',
    ]) {
      expect(defined.has(cls), `${cls} is not defined in index.css`).toBe(true);
    }
  });

  it('keeps the type scale closed', () => {
    /*
     * DESIGN.md §Typography: the scale is the ONLY way to set type, and it is
     * CLOSED. `lf-body-sm` and `lf-display-sm` were being used in seventeen
     * places and existed in none — which is not widening the scale, it is
     * opting out of it by accident.
     */
    const scale = [...defined].filter((c) => /^lf-(display|headline|title|body|caption|label)(-|$)/.test(c));
    expect(scale.sort()).toEqual(
      [
        'lf-body',
        'lf-body-lg',
        'lf-caption',
        'lf-caption-tail',
        'lf-display-lg',
        'lf-display-xl',
        'lf-headline',
        'lf-label',
        'lf-title',
      ].sort(),
    );
  });
});
