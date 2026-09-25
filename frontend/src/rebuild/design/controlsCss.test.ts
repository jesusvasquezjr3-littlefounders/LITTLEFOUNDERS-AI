import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Static contract for the S03.1 shared control stylesheet (Frontend Bible 02
 * §2 rules 2, 3, 8, 11, 12, 14, 17; §7; §8; 04 §3). It reads the source CSS so
 * a violation fails in CI before any browser runs.
 */
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const read = (path: string) => readFileSync(local(path), 'utf8');
const controls = read('./controls.css');
const gallery = read('../preview/systemGallery.css');
const tokens = read('./tokens.css');
const system = read('./system.css');
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Removes every `@media (prefers-reduced-motion: no-preference) { … }` block, braces balanced. */
function outsideMotionQueries(css: string) {
  let out = '', index = 0;
  const marker = '@media (prefers-reduced-motion: no-preference)';
  for (let start = css.indexOf(marker); start !== -1; start = css.indexOf(marker, index)) {
    out += css.slice(index, start);
    let depth = 0, cursor = css.indexOf('{', start);
    for (; cursor < css.length; cursor++) {
      if (css[cursor] === '{') depth++;
      if (css[cursor] === '}' && --depth === 0) break;
    }
    index = cursor + 1;
  }
  return out + css.slice(index);
}

/** Declaration blocks keyed by selector text (top level and inside at-rules). */
function rules(css: string) {
  const found: { selector: string; body: string }[] = [];
  for (const match of withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) found.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' });
  return found;
}

describe('shared control stylesheet contract', () => {
  for (const [name, css] of [['controls.css', controls], ['systemGallery.css', gallery]] as const) {
    const source = withoutComments(css);
    it(`${name} uses tokens only: no colour literals, no off-token sizes`, () => {
      expect(source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
      expect(source.match(/\b(?:rgba?|hsla?|oklch|lab|lch)\(/gi) ?? []).toEqual([]);
      // 2px is the functional edge line (02 §4.4 exception 1); every other length is a token.
      expect((source.match(/\b\d+(?:\.\d+)?(?:px|rem|em|pt)\b/g) ?? []).filter((value) => value !== '2px' && !/^\d+(?:\.\d+)?em$/.test(value))).toEqual([]);
      expect(source).not.toMatch(/!important/);
    });
    it(`${name} uses logical properties only`, () => {
      expect(source).not.toMatch(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\b/m);
      expect(source).not.toMatch(/(?:^|[\s;{])(?:left|right|top|bottom)\s*:/m);
      expect(source).not.toMatch(/(?:^|[\s;{])(?:min-|max-)?(?:width|height)\s*:/m);
      expect(source).not.toMatch(/text-align:\s*(?:left|right)|float:/);
    });
    it(`${name} never truncates or hides text and never fakes depth or glass`, () => {
      expect(source).not.toMatch(/text-overflow|line-clamp|backdrop-filter|background-clip:\s*text|clamp\(|linear-gradient|radial-gradient/);
    });
    it(`${name} moves only inside a no-preference motion query and never springs`, () => {
      expect(outsideMotionQueries(source)).not.toMatch(/(?:^|[\s;{])(?:transition|animation)(?:-[a-z-]+)?\s*:/m);
      expect(source).not.toMatch(/--ease-spring|--dur-celebration/);
    });
    it(`${name} references only defined tokens`, () => {
      const defined = new Set([...(tokens + system).matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
      const used = [...source.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]);
      expect(used.filter((token) => !defined.has(token))).toEqual([]);
    });
  }

  it('gives every pressable and field a touch floor from the target tokens (02 §8)', () => {
    const all = rules(controls);
    const floor = (selector: string) => all.some((rule) => rule.selector.split(',').some((part) => part.trim().endsWith(selector))
      && /(?:min-)?block-size:\s*var\(--target-(?:min|base|lg)\)/.test(rule.body));
    for (const selector of ['.lf-icon-button', '.lf-input', '.lf-input-reveal', '.lf-check', '.lf-radio-option', '.lf-segmented-option',
      '.lf-toggle', '.lf-slider-input', '.lf-stepper-button', '.lf-choice-chip', '.lf-list-row', '.lf-button--sm', '.lf-button--lg']) {
      expect(floor(selector), selector).toBe(true);
    }
  });

  it('draws a visible keyboard focus for controls that replace the default outline', () => {
    const all = rules(controls);
    const input = all.find((rule) => rule.selector === '.lf-rebuild .lf-input:focus-visible');
    expect(input?.body).toMatch(/box-shadow:\s*inset 0 0 0 var\(--focus-width\) var\(--focus-color\)/);
    const choice = all.find((rule) => rule.selector.includes(':has(:focus-visible)'));
    expect(choice?.body).toMatch(/outline:\s*var\(--focus-width\) solid var\(--focus-color\)/);
    expect(choice?.body).toMatch(/outline-offset:\s*var\(--focus-offset\)/);
  });

  it('styles every colour role, tone and size the components expose', () => {
    for (const variant of ['brand', 'reward', 'sky', 'mint', 'berry', 'danger', 'inverse', 'sm', 'lg', 'pending']) expect(controls).toContain(`.lf-button--${variant}`);
    for (const variant of ['accent', 'success']) expect(system).toContain(`.lf-button--${variant}`);
    for (const tone of ['success', 'warning', 'error', 'sky', 'primary', 'reward']) expect(controls).toContain(`.lf-status-chip--${tone}`);
    for (const tone of ['primary', 'success', 'reward', 'sky', 'mint', 'berry', 'inverse']) expect(controls).toContain(`.lf-pill--${tone}`);
    for (const tone of ['success', 'retry', 'error', 'info']) { expect(controls).toContain(`.lf-banner--${tone}`); expect(controls).toContain(`.lf-notice--${tone}`); }
    for (const tone of ['primary', 'sky', 'mint', 'berry']) expect(controls).toContain(`.lf-card--${tone}`);
    for (const size of ['md', 'lg']) expect(controls).toContain(`.lf-avatar--${size}`);
  });

  it('shares no class name with the legacy application, whose global CSS would otherwise restyle a shared control', () => {
    const classes = [...new Set([...withoutComments(controls).matchAll(/\.(lf-[a-z0-9-]+)/g)].map((match) => match[1]))];
    const src = local('../..');
    const legacy = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(?:tsx?|css)$/.test(file) && !file.replace(/\\/g, '/').startsWith('rebuild/'))
      .map((file) => readFileSync(join(src, file), 'utf8')).join('\n');
    expect(classes.length).toBeGreaterThan(50);
    expect(classes.filter((name) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(legacy))).toEqual([]);
  });

  it('keeps a wrong answer out of the error hue (02 §4.2)', () => {
    const retry = rules(controls).filter((rule) => rule.selector.includes('--retry'));
    expect(retry.length).toBeGreaterThan(0);
    for (const rule of retry) expect(rule.body).not.toMatch(/--error/);
  });

  it('never puts a line around a filled component (02 §4.4)', () => {
    for (const rule of rules(controls)) {
      if (!/background:\s*var\(--(?:primary|accent|reward|success|error|sky|mint|berry|warning)\)/.test(rule.body)) continue;
      expect(rule.body, rule.selector).not.toMatch(/(?:^|;)\s*border:\s*(?!0)/);
      expect(rule.body, rule.selector).not.toMatch(/box-shadow:\s*inset/);
    }
  });
});

describe('generated tokens', () => {
  it('match the binding Bible 02 token block exactly', () => {
    const script = local('../../../scripts/build-rebuild-tokens.mjs');
    expect(execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' })).toContain('match the binding specification');
  });

  it('carry typography, elevation, focus and motion, with dark mode separating by surface step', () => {
    for (const token of ['--type-button:', '--type-label:', '--type-caption:', '--type-numeral:', '--elevation-card:', '--elevation-control:',
      '--elevation-float:', '--focus-width: 3px', '--focus-offset: 3px', '--focus-color: var(--primary-strong)', '--dur-instant: 80ms',
      '--dur-micro: 150ms', '--dur-component: 250ms', '--dur-transition: 380ms', '--dur-celebration: 700ms', '--ease-standard:', '--press-scale: 0.97']) {
      expect(tokens).toContain(token);
    }
    const dark = (tokens.split('.lf-rebuild[data-theme="dark"]')[1] ?? '').split('}')[0];
    expect(dark).toContain('--elevation-card: none');
    expect(dark).toContain('--elevation-control: none');
    // Captions and chips are the smallest type: never below the 14 px floor (02 rule 11).
    expect(tokens).toMatch(/--type-caption: 700 0\.875rem/);
    expect(tokens).toMatch(/@container app \(min-width: 640px\)[\s\S]*--type-display-lg: 700 32px/);
  });
});
