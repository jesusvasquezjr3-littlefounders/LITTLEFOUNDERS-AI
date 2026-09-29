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
const overlays = read('./overlays.css');
const shells = read('./shells.css');
const motion = read('./motion.css');
const gallery = read('../preview/systemGallery.css');
const shellGallery = read('../preview/gallery.css');
/** Every shared stylesheet of the rebuilt design system (S03.1 controls, S03.2 overlays and shells). */
const shared = controls + overlays + shells;
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
  for (const [name, css] of [['controls.css', controls], ['overlays.css', overlays], ['shells.css', shells], ['systemGallery.css', gallery], ['gallery.css', shellGallery], ['motion.css', motion]] as const) {
    const source = withoutComments(css);
    it(`${name} uses tokens only: no colour literals, no off-token sizes`, () => {
      // Container-query conditions carry the Bible's own breakpoints (640, 840, 1120 px; 03 §3.2, 02 §7 rule 9, §9.8).
      const declarations = source.replace(/@container[^{]*/g, '');
      expect(declarations.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
      expect(source.match(/\b(?:rgba?|hsla?|oklch|lab|lch)\(/gi) ?? []).toEqual([]);
      // 2px is the functional edge line (02 §4.4 exception 1); every other length is a token.
      expect((declarations.match(/\b\d+(?:\.\d+)?(?:px|rem|em|pt)\b/g) ?? []).filter((value) => value !== '2px' && !/^\d+(?:\.\d+)?em$/.test(value))).toEqual([]);
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
    it(`${name} moves only inside a no-preference motion query and springs only for a milestone`, () => {
      expect(outsideMotionQueries(source)).not.toMatch(/(?:^|[\s;{])(?:transition|animation)(?:-[a-z-]+)?\s*:/m);
      // The celebration curve and duration exist only in the motion sheet, under the playing celebration (D7, OD-7).
      for (const rule of rules(css).filter((entry) => /--ease-spring|--dur-celebration/.test(entry.body))) {
        expect(name, rule.selector).toBe('motion.css');
        expect(rule.selector, rule.selector).toMatch(/\.lf-celebration--play/);
      }
    });
    it(`${name} references only defined tokens`, () => {
      const defined = new Set([...(tokens + system + motion).matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
      // A property read with a fallback (`var(--lf-celebration-order, 0)`) is set per element by the component, not a token.
      const used = [...source.matchAll(/var\((--[\w-]+)\s*\)/g)].map((match) => match[1]);
      expect(used.filter((token) => !defined.has(token))).toEqual([]);
    });
  }

  it('gives every pressable and field a touch floor from the target tokens (02 §8)', () => {
    const all = rules(shared);
    const floor = (selector: string) => all.some((rule) => rule.selector.split(',').some((part) => part.trim().endsWith(selector))
      && /(?:min-)?block-size:\s*var\(--target-(?:min|base|lg)\)/.test(rule.body));
    for (const selector of ['.lf-icon-button', '.lf-input', '.lf-input-reveal', '.lf-check', '.lf-radio-option', '.lf-segmented-option',
      '.lf-toggle', '.lf-slider-input', '.lf-stepper-button', '.lf-choice-chip', '.lf-list-row', '.lf-button--sm', '.lf-button--lg',
      '.lf-menu-item', '.lf-skip-link', '.lf-brand-mark', '.lf-nav-link--tab', '.lf-nav-link--rail', '.lf-nav-link--sheet', '.lf-auth-footer) a']) {
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

  // Reads the whole legacy source tree; generous timeout because other test files run in parallel.
  it('shares no class name with the legacy application, whose global CSS would otherwise restyle a shared control', { timeout: 30_000 }, () => {
    const classes = [...new Set([...withoutComments(shared).matchAll(/\.(lf-[a-z0-9-]+)/g)].map((match) => match[1]))];
    const src = local('../..');
    const legacy = readdirSync(src, { recursive: true, encoding: 'utf8' })
      // Tests ship no CSS and restyle nothing (bootVeil.test.ts reads the token sheet by its root class).
      .filter((file) => /\.(?:tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.replace(/\\/g, '/').startsWith('rebuild/'))
      .map((file) => readFileSync(join(src, file), 'utf8')).join('\n');
    expect(classes.length).toBeGreaterThan(50);
    expect(classes.filter((name) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(legacy))).toEqual([]);
  });

  it('ripples a soft ring in the control\'s own colour from the touch point, only with motion allowed (02 §9.1)', () => {
    const query = motion.slice(motion.lastIndexOf('@media (prefers-reduced-motion: no-preference)'));
    const ring = rules(query).find((rule) => rule.selector.trim() === '.lf-rebuild .lf-press-ring');
    expect(ring?.body).toMatch(/border: 2px solid currentColor/);
    expect(ring?.body).toMatch(/animation: lf-press-ring var\(--dur-micro\) var\(--ease-standard\) forwards/);
    expect(ring?.body).not.toMatch(/background/);
    // Outside the query the ring never shows: reduced motion keeps only the colour state change.
    expect(motion).toMatch(/\.lf-rebuild \.lf-press-ring \{ display: none; \}/);
    for (const control of ['.lf-button', '.lf-icon-button', '.lf-choice', '.lf-reply-chip', '.lf-list-row--pressable']) expect(motion).toContain(control);
  });

  it('keeps a wrong answer out of the error hue (02 §4.2)', () => {
    const retry = rules(controls).filter((rule) => rule.selector.includes('--retry'));
    expect(retry.length).toBeGreaterThan(0);
    for (const rule of retry) expect(rule.body).not.toMatch(/--error/);
  });

  it('never puts a line around a filled component (02 §4.4)', () => {
    for (const rule of rules(shared)) {
      if (!/background:\s*var\(--(?:primary|accent|reward|success|error|sky|mint|berry|warning)\)/.test(rule.body)) continue;
      expect(rule.body, rule.selector).not.toMatch(/(?:^|;)\s*border:\s*(?!0)/);
      expect(rule.body, rule.selector).not.toMatch(/box-shadow:\s*inset/);
    }
  });
});

describe('overlay and shell stylesheet contract (S03.2)', () => {
  it('anchors every overlay to the real viewport (02 rule 12)', () => {
    const all = rules(overlays + shells);
    for (const selector of ['.lf-layer', '.lf-scrim', '.lf-dialog-frame', '.lf-anchored', '.lf-toast-region', '.lf-skip-link', '.lf-sticky-action']) {
      const rule = all.find((entry) => entry.selector === `.lf-rebuild ${selector}`);
      expect(rule?.body, selector).toMatch(/position:\s*fixed/);
    }
    // `absolute` appears only in the visually-hidden pattern, never on an overlay container.
    for (const rule of all.filter((entry) => /position:\s*absolute/.test(entry.body))) expect(rule.body, rule.selector).toMatch(/clip-path:\s*inset\(50%\)/);
  });

  it('layers only through the generated 02 §9.8 order: nav 30, sheet 50, scrim 65, toast 70', () => {
    const zIndexes = [...withoutComments(shared).matchAll(/z-index:\s*([^;]+);/g)].map((match) => match[1]!.trim());
    expect(zIndexes.length).toBeGreaterThan(5);
    expect(zIndexes.filter((value) => !/^var\(--layer-(?:nav|sheet|scrim|toast)\)$/.test(value))).toEqual([]);
    const layer = (name: string) => Number(tokens.match(new RegExp(`--layer-${name}: (\\d+);`))?.[1]);
    expect([layer('nav'), layer('sheet'), layer('scrim'), layer('toast')]).toEqual([30, 50, 65, 70]);
  });

  it('changes layout by container width, never by the viewport (02 §7 rule 9)', () => {
    expect(withoutComments(overlays + shells)).not.toMatch(/@media[^{]*(?:min|max)-(?:width|height)/);
    expect(shells).toMatch(/@container app \(min-width: 840px\)/);
    expect(shells).toMatch(/@container lf-table \(max-width: 839px\)/);
    expect(shells).toMatch(/@container app \(max-width: 359px\)/);
    expect(shells).toMatch(/@container lf-dashboard \(min-width: 840px\)/);
  });

  it('pads every edge that can meet a notch or home indicator to the safe area', () => {
    for (const side of ['top', 'bottom', 'left', 'right']) expect(shells, side).toContain(`env(safe-area-inset-${side})`);
    for (const side of ['top', 'bottom', 'left', 'right']) expect(overlays, side).toContain(`env(safe-area-inset-${side})`);
  });

  it('separates overlays by the raised surface step in dark mode (plus the dark soft shadow, OD-28 V-04), never by an outline (02 §5)', () => {
    expect(overlays).toMatch(/\[data-theme='dark'\] :is\(\.lf-dialog, \.lf-sheet--bottom, \.lf-popover, \.lf-menu\) \{ background: var\(--raised\); \}/);
    for (const rule of rules(overlays + shells)) expect(rule.body, rule.selector).not.toMatch(/(?:^|;)\s*border(?:-[a-z-]+)?:\s*(?!0)[^;]*(?:outline|edge)/);
  });
});

describe('generated tokens', () => {
  it('match the binding Bible 02 token block exactly', () => {
    const script = local('../../../scripts/build-rebuild-tokens.mjs');
    expect(execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' })).toContain('match the binding specification');
  }, 60_000); // spawns a Node child process: a full 8-worker suite can take it past vitest's 5 s default

  it('carry typography, elevation, focus and motion, with dark mode keeping a soft shadow as well as its surface step (OD-28, V-04)', () => {
    for (const token of ['--type-button:', '--type-label:', '--type-caption:', '--type-numeral:', '--elevation-card:', '--elevation-control:',
      '--elevation-float:', '--focus-width: 3px', '--focus-offset: 3px', '--focus-color: var(--primary-strong)', '--dur-instant: 80ms',
      '--dur-micro: 150ms', '--dur-component: 250ms', '--dur-transition: 380ms', '--dur-celebration: 700ms', '--ease-standard:', '--press-scale: 0.97']) {
      expect(tokens).toContain(token);
    }
    const dark = (tokens.split('.lf-rebuild[data-theme="dark"]')[1] ?? '').split('}')[0] ?? '';
    // OD-28 (V-04) overrides 02 §5 "never a shadow": the same geometry, cast in the dark sunken colour, soft (alpha <= .6).
    for (const name of ['card', 'control', 'float']) {
      const value = dark.match(new RegExp(`--elevation-${name}: ([^;]+);`))?.[1] ?? 'none';
      expect(value, name).not.toBe('none');
      const alphas = [...value.matchAll(/rgba\(6,7,19,([\d.]+)\)/g)].map((match) => Number(match[1]));
      expect(alphas.length, name).toBeGreaterThan(0);
      for (const alpha of alphas) expect(alpha).toBeLessThanOrEqual(0.6);
    }
    expect(dark).toContain('--sunken: #060713');
    expect(system).toMatch(/\.lf-rebuild\[data-theme='dark'\] \{ color-scheme: dark; --shadow-control: 0 1px 3px rgb\(6 7 19 \/ \.56\); \}/);
    // Captions and chips are the smallest type: never below the 14 px floor (02 rule 11).
    expect(tokens).toMatch(/--type-caption: 700 0\.875rem/);
    expect(tokens).toMatch(/@container app \(min-width: 640px\)[\s\S]*--type-display-lg: 700 32px/);
  });
});

describe('motion budget across every rebuilt stylesheet (02 §9.4, D7, 04 §3; S03.7)', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.css') ? [join(dir, entry.name)] : []));
  const sheets = walk(local('..')).map((file) => ({ file: file.slice(file.lastIndexOf('rebuild')).replace(/\\/g, '/'), css: withoutComments(readFileSync(file, 'utf8')) }));

  it('loops only the one breathing call to action and the busy motion; every other idle loop is a component that claims a slot', () => {
    const loops = sheets.flatMap(({ file, css }) => rules(css).filter((rule) => /\binfinite\b/.test(rule.body)).map((rule) => `${file}: ${rule.selector}`));
    expect(loops.length).toBeGreaterThan(0);
    // OD-28 (V-04): the loading shimmer and the pending spinner are busy motion, bound to [data-busy-motion] (motion.tsx contract).
    const busy = (loop: string) => /^rebuild\/design\/motion\.css: .*\[data-busy-motion='(?:shimmer|spinner)'\]/.test(loop);
    expect(loops.filter((loop) => !/^rebuild\/design\/motion\.css: .*\.lf-button--breathing/.test(loop) && !busy(loop))).toEqual([]);
    expect(loops.filter(busy)).toHaveLength(2);
  });

  it('keeps the busy motion off under reduced motion, as a still state (OD-28, V-04)', () => {
    const still = outsideMotionQueries(withoutComments(motion + controls));
    expect(still).not.toMatch(/lf-shimmer|lf-spin\b|data-busy-motion/);
    // Outside the motion query the shimmer band is invisible and the spinner is a still ring beside the label.
    expect(controls).toMatch(/\.lf-skeleton-line::after \{[^}]*opacity: 0;/);
    expect(controls).toMatch(/\.lf-button-spinner \{[^}]*border-radius: var\(--rounded-full\);/);
  });

  it('keeps the spring curve and the celebration duration inside the motion sheet', () => {
    expect(sheets.filter(({ file, css }) => file !== 'rebuild/design/motion.css' && /var\(--(?:ease-spring|dur-celebration)\)/.test(css)).map(({ file }) => file)).toEqual([]);
  });

  it('animates only inside a no-preference motion query, so reduced motion keeps every state and drops the travel', () => {
    const offences = sheets.filter(({ css }) => /(?:^|[\s;{])animation(?:-name)?\s*:/m.test(outsideMotionQueries(css))).map(({ file }) => file);
    expect(offences).toEqual([]);
  });

  it('references only defined tokens in every rebuilt stylesheet (the undefined --content-secondary is gone)', () => {
    const defined = new Set(sheets.flatMap(({ css }) => [...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])));
    const offences = sheets.flatMap(({ file, css }) => [...css.matchAll(/var\((--[\w-]+)\s*\)/g)].map((match) => match[1]!)
      .filter((token) => !defined.has(token)).map((token) => `${file}: ${token}`));
    expect(offences).toEqual([]);
  });
});

describe('Text Fit Contract across every rebuilt stylesheet (02 §7 rules 1-4)', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.css') ? [join(dir, entry.name)] : []));
  const sheets = walk(local('..')).map((file) => ({ file: file.slice(file.lastIndexOf('rebuild')), css: withoutComments(readFileSync(file, 'utf8')) }));

  it('never squeezes a button below its longest word or keeps its label on one line', () => {
    // Rule 4: every button carries min-inline-size: min-content; rule 2: buttons wrap and grow.
    const offences: string[] = [];
    // A text button's minimum inline size is min-content, or a floor that only widens it (min(100%, >= 120px)).
    // A zero, a touch-target length or any smaller length replaces min-content and lets a word spill.
    const allowed = (value: string) => value === 'min-content' || (/^min\(100%,\s*\d+px\)$/.test(value) && Number(/(\d+)px/.exec(value)![1]) >= 120);
    for (const { file, css } of sheets) for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const isTextButton = /\.lf-button\b/.test(selector!);
      if ((isTextButton || /(^|[\s,>(])button\b/.test(selector!)) && /\bwhite-space\s*:\s*nowrap/.test(declarations!)) offences.push(`${file}: ${selector!.trim()} (nowrap)`);
      if (!isTextButton) continue;
      for (const [, value] of declarations!.matchAll(/\bmin-(?:inline-size|width)\s*:\s*([^;]+)/g)) {
        if (!allowed(value!.trim().replace(/\s*!important$/, ''))) offences.push(`${file}: ${selector!.trim()} (min-inline-size: ${value!.trim()})`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('never truncates system text with an ellipsis or a line clamp (rule 1)', () => {
    const offences = sheets.filter(({ css }) => /text-overflow\s*:\s*ellipsis|line-clamp\s*:/.test(css)).map(({ file }) => file);
    expect(offences).toEqual([]);
  });

  it('sizes in fixed steps by the container, never fluid clamp() or by the viewport width (02 §6, §7 rule 9; 03 §3.2)', () => {
    // Found by the S03.5 authenticated-route audit: the age screen padded by clamp(…, 10vh, …) (74 px, off the 4 px grid)
    // and four surfaces changed layout with viewport media queries. `100vw` stays legal for a fixed overlay's viewport cap.
    const offences = sheets.flatMap(({ file, css }) => [
      ...[...css.matchAll(/\bclamp\(/g)].map(() => `${file}: clamp()`),
      ...[...css.matchAll(/@media[^{]*\b(?:min|max)-(?:width|height)\b[^{]*/g)].map(([query]) => `${file}: ${query.trim()}`),
      ...[...css.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)(vw|vh|vmin|vmax|svh|lvh)\b/g)].filter(([whole]) => whole !== '100vw').map(([whole]) => `${file}: ${whole}`),
    ]);
    expect(offences).toEqual([]);
  });
});

/*
 * Gap-fix round 3: the flat, token-only contract of the shared sheets, widened to every rebuilt stylesheet
 * (Bible 02 rules 2, 10 and 11, §4.4, §3 input and type tokens; 07 §3 token colours). The feature sheets had
 * drifted: an off-token relief ridge on the CPA counters, a line around a filled flowchart outcome, an outlined
 * branch card, a raw outlined textarea and 12-13 px text.
 */
describe('flat, token-only contract across every rebuilt stylesheet (02 rules 2, 10, 11; §4.4; 07 §3)', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.css') ? [join(dir, entry.name)] : []));
  const sheets = walk(local('..')).map((file) => ({ file: file.slice(file.lastIndexOf('rebuild')).replace(/\\/g, '/'), css: withoutComments(readFileSync(file, 'utf8')) }));
  const declarations = (body: string) => body.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const colon = part.indexOf(':');
    return { prop: part.slice(0, colon).trim().toLowerCase(), value: part.slice(colon + 1).trim() };
  });
  /** Every `@rule { … }` and plain rule, innermost blocks included (container and media queries hold rules too). */
  const everyRule = (css: string) => rules(css);
  const HUE = 'primary|accent|reward|success|error|sky|mint|berry|warning';

  it('reads the whole rebuilt tree', () => {
    expect(sheets.length).toBeGreaterThan(60);
  });

  it('names colours only through tokens: literals live in the token sheets alone', () => {
    // tokens.css and document.css define the palette; system.css defines two shadow tokens from it.
    const TOKEN_SHEETS = new Set(['rebuild/design/tokens.css', 'rebuild/design/document.css']);
    const offences: string[] = [];
    for (const { file, css } of sheets) {
      if (TOKEN_SHEETS.has(file)) continue;
      for (const { selector, body } of everyRule(css)) for (const { prop, value } of declarations(body)) {
        if (!/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/i.test(value)) continue;
        if (file === 'rebuild/design/system.css' && prop.startsWith('--')) continue;
        offences.push(`${file}: ${selector} { ${prop}: ${value} }`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('never fakes depth with an inset relief ridge (02 rules 2 and 10)', () => {
    // A ridge is an inset shadow with a vertical offset; a focus or error ring (`inset 0 0 0 …`) has none.
    const offences = sheets.flatMap(({ file, css }) => [...css.matchAll(/inset\s+-?\d*\.?\d+(?:px|rem|em)?\s+(-?\d*\.?\d+)(?:px|rem|em)?/g)]
      .filter((match) => Number(match[1]) !== 0).map((match) => `${file}: ${match[0]}`));
    expect(offences).toEqual([]);
  });

  it('never draws a line around a component with its own hue fill (02 §4.4)', () => {
    const offences: string[] = [];
    for (const { file, css } of sheets) for (const { selector, body } of everyRule(css)) {
      // Keyboard focus is an interaction state, not decoration (02 §4.4 case 2).
      if (/:focus/.test(selector)) continue;
      const decls = declarations(body);
      const filled = decls.some(({ prop, value }) => (prop === 'background' || prop === 'background-color') && new RegExp(`^var\\(--(?:${HUE})(?:-strong|-soft|-ridge)?\\)`).test(value));
      if (!filled) continue;
      for (const { prop, value } of decls) {
        if (!/^(?:border|outline)(?:-(?:inline|block|top|right|bottom|left)(?:-(?:start|end))?)?(?:-(?:width|style))?$/.test(prop)) continue;
        if (/^(?:0|0px|none|transparent)\b/.test(value)) continue;
        offences.push(`${file}: ${selector} { ${prop}: ${value} }`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('never sets HTML text below the 14 px floor (02 rule 11)', () => {
    // SVG text is sized in its drawing's own units (a rule that paints with `fill`); the board audit measures it.
    // `.lf-chart-tag` is the teaching charts' own open gap (12 px tags), closed in the charts lane, not here.
    const ALLOWED = new Set(['.lf-chart-tag']);
    const offences: string[] = [];
    for (const { file, css } of sheets) for (const { selector, body } of everyRule(css)) {
      if (ALLOWED.has(selector) || /(?:^|;)\s*fill\s*:/.test(body)) continue;
      for (const { prop, value } of declarations(body)) {
        if (prop !== 'font-size' && prop !== 'font') continue;
        const size = /(\d*\.?\d+)(rem|px)\b/.exec(value);
        if (!size) continue;
        const px = Number(size[1]) * (size[2] === 'rem' ? 16 : 1);
        if (px < 14) offences.push(`${file}: ${selector} { ${prop}: ${value} }`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('never truncates text: no text-overflow and no line clamp (02 §7 rule 1)', () => {
    expect(sheets.filter(({ css }) => /text-overflow|line-clamp/.test(css)).map(({ file }) => file)).toEqual([]);
  });

  it('uses gradients only as hard-stop pattern fills, the second channel of a series (05 §2), never as a shade', () => {
    /** The top-level comma-separated arguments of `name(…)` at `start`. */
    const args = (text: string, start: number) => {
      const parts: string[] = [];
      let depth = 0, current = '';
      for (let i = text.indexOf('(', start) + 1; i < text.length; i++) {
        const ch = text[i]!;
        if (ch === '(') depth++;
        if (ch === ')') { if (depth === 0) { parts.push(current.trim()); break; } depth--; }
        if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; } else current += ch;
      }
      return parts;
    };
    const offences: string[] = [];
    for (const { file, css } of sheets) for (const match of css.matchAll(/(?:repeating-)?(?:linear|radial|conic)-gradient\(/g)) {
      const stops = args(css, match.index!).filter((part) => /^(?:var\(|transparent\b|currentcolor\b)/i.test(part)).map((part) => {
        const colour = /^(var\([^)]*\)|\w+)/.exec(part)![1]!;
        const positions = [...part.slice(colour.length).matchAll(/(-?\d*\.?\d+)(px|%)/g)].map((p) => ({ n: Number(p[1]), unit: p[2] }));
        return { colour, positions };
      });
      // A hard stop: where the colour changes, the next stop starts where the previous one ended (1 px of anti-aliasing allowed).
      let smooth = false;
      for (let i = 1; i < stops.length; i++) {
        const prev = stops[i - 1]!, next = stops[i]!;
        if (prev.colour === next.colour) continue;
        const end = prev.positions.at(-1), start = next.positions[0];
        if (!end || !start || end.unit !== start.unit || start.n - end.n > (start.unit === 'px' ? 1 : 0)) smooth = true;
      }
      if (smooth || stops.length < 2) offences.push(`${file}: ${css.slice(match.index!, match.index! + 90)}`);
    }
    expect(offences).toEqual([]);
  });
});
