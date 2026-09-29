import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The boot veil (Bible 02 rule 2, D13, rule 23; 04 §2) lives in index.html, so its
 * values sit OUTSIDE the module graph every other test can reach: nothing
 * imports it, nothing type-checks it, and a change to the palette or to the
 * prerenderer cannot break it loudly. That makes it exactly the shape §1.14
 * keeps naming — a constant hand-copied into a second file, where the copies
 * drift silently and the failure is cosmetic rather than thrown. This file is
 * the gate that pins the copies together.
 */

const FRONTEND = resolve(__dirname, '../..');
const HTML = readFileSync(resolve(FRONTEND, 'index.html'), 'utf8');
const TOKENS = readFileSync(resolve(FRONTEND, 'src/rebuild/design/tokens.css'), 'utf8');
const DOCUMENT = readFileSync(resolve(FRONTEND, 'src/rebuild/design/document.css'), 'utf8');
const MAIN = readFileSync(resolve(FRONTEND, 'src/main.tsx'), 'utf8');
const THEME = readFileSync(resolve(FRONTEND, 'src/theme/useTheme.tsx'), 'utf8');
const BOOT = readFileSync(resolve(FRONTEND, 'src/lib/boot.ts'), 'utf8');

/** One token's value in the light block, or in the dark block when `dark` is set (02 D4, the generated sheet). */
function token(name: string, dark = false): string {
  const start = dark ? TOKENS.indexOf('.lf-rebuild[data-theme="dark"] {') : TOKENS.indexOf('.lf-rebuild {');
  expect(start, 'token block not found').toBeGreaterThan(-1);
  const block = TOKENS.slice(start, TOKENS.indexOf('}', start));
  const match = block.match(new RegExp(`${name}: (#[0-9a-f]{6});`));
  expect(match, `${name} not found`).not.toBeNull();
  return match![1]!;
}

describe('boot veil — the ground colour (02 D4)', () => {
  it('is the design token --base for light', () => {
    expect(token('--base')).toBe('#f4f5fd');
    expect(HTML).toContain(`--lf-boot-ground: ${token('--base')};`);
  });

  it('is the design token --base for dark', () => {
    expect(HTML).toContain(`--lf-boot-ground: ${token('--base', true)};`);
  });

  it('carries no legacy indigo and no bloom colour', () => {
    expect(HTML).not.toMatch(/#f8fafc|#0a0e1a|79, 70, 229|129, 140, 248/);
    expect(HTML).not.toMatch(/--lf-boot-bloom|lf-boot-breathe/);
  });
});

/** One motion token's raw value in the light block (04 §2: durations and easings are mode-independent). */
function motionToken(name: string): string {
  const start = TOKENS.indexOf('.lf-rebuild {');
  const block = TOKENS.slice(start, TOKENS.indexOf('}', start));
  const match = block.match(new RegExp(`${name}: ([^;]+);`));
  expect(match, `${name} not found`).not.toBeNull();
  return match![1]!.trim();
}

/** The inline stylesheet, comments removed: the one stylesheet of the product outside src/. */
const VEIL_CSS = (() => {
  const open = HTML.indexOf('<style>');
  const close = HTML.indexOf('</style>', open);
  expect(open, 'inline <style> not found').toBeGreaterThan(-1);
  return HTML.slice(open + '<style>'.length, close).replace(/\/\*[\s\S]*?\*\//g, '');
})();

/** The body of `@media (prefers-reduced-motion: no-preference) { ... }`, by brace depth. */
function noPreferenceBlocks(css: string): { inside: string; outside: string } {
  let inside = '';
  let outside = css;
  const head = /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{/g;
  for (let match = head.exec(outside); match; match = head.exec(outside)) {
    let depth = 1;
    let at = match.index + match[0].length;
    while (depth > 0 && at < outside.length) {
      if (outside[at] === '{') depth++;
      if (outside[at] === '}') depth--;
      at++;
    }
    inside += outside.slice(match.index + match[0].length, at - 1);
    outside = outside.slice(0, match.index) + outside.slice(at);
    head.lastIndex = match.index;
  }
  return { inside, outside };
}

describe('boot veil — rebuilt from the Bible, never the legacy glass (02 rule 2, D13, rule 23)', () => {
  it('declares no backdrop-filter, filter, gradient or shadow anywhere in the inline stylesheet', () => {
    expect(VEIL_CSS).not.toMatch(/backdrop-filter|(?:^|[\s;{])filter\s*:/m);
    expect(VEIL_CSS).not.toMatch(/(?:linear|radial|conic)-gradient\(/);
    expect(VEIL_CSS).not.toMatch(/box-shadow|text-shadow/);
  });

  it('has no escape hatch left over from the blur (@supports, !important)', () => {
    expect(VEIL_CSS).not.toMatch(/@supports|!important/);
  });

  it('paints nothing on the ground: no pseudo-element bloom', () => {
    expect(VEIL_CSS).not.toMatch(/#lf-boot::?(?:after|before)/);
  });
});

describe('boot veil — motion on the 04 §2 tokens only', () => {
  it('dissolves in --dur-transition, leaving on --ease-exit and arriving on --ease-enter', () => {
    expect(motionToken('--dur-transition')).toBe('380ms');
    expect(VEIL_CSS).toContain(`--lf-boot-dissolve: ${motionToken('--dur-transition')};`);
    expect(VEIL_CSS).toContain(`--lf-boot-exit: ${motionToken('--ease-exit')};`);
    expect(VEIL_CSS).toContain(`--lf-boot-enter: ${motionToken('--ease-enter')};`);
    expect(VEIL_CSS).toMatch(/html\[data-lf-boot='off'\] #lf-boot \{[^}]*animation: lf-boot-out var\(--lf-boot-dissolve\) var\(--lf-boot-exit\)/);
    expect(VEIL_CSS).toMatch(/html\[data-lf-boot='off'\] #root \{[^}]*animation: lf-boot-in var\(--lf-boot-dissolve\) var\(--lf-boot-enter\)/);
  });

  it('writes no duration literal except the dissolve token copy and the fail-open deadline', () => {
    const rest = VEIL_CSS.replace(/--lf-boot-dissolve: \d+ms;/, '').replace(/--lf-boot-deadline: \d+s;/, '');
    expect(rest.match(/(?<![\w-])\d+(?:\.\d+)?m?s\b/g) ?? []).toEqual([]);
  });

  it('writes no easing that is not a token: every cubic-bezier is --ease-exit or --ease-enter, and no keyword curve', () => {
    const allowed = new Set([motionToken('--ease-exit'), motionToken('--ease-enter')]);
    const curves = VEIL_CSS.match(/cubic-bezier\([^)]*\)/g) ?? [];
    expect(curves.length).toBeGreaterThan(0);
    expect(curves.filter((curve) => !allowed.has(curve))).toEqual([]);
    const animations = [...VEIL_CSS.matchAll(/animation(?:-timing-function)?\s*:\s*([^;]+);/g)].map((m) => m[1]!);
    for (const value of animations) expect(value).not.toMatch(/\b(?:ease|ease-in|ease-out|ease-in-out|linear)\b|steps\(|infinite/);
  });

  it('moves only inside prefers-reduced-motion: no-preference; outside it, only the step-end deadline timer', () => {
    const { inside, outside } = noPreferenceBlocks(VEIL_CSS);
    expect(inside).toMatch(/lf-boot-out/);
    expect(inside).toMatch(/lf-boot-in /);
    const outsideAnimations = [...outside.matchAll(/(?:^|[\s;{])(animation|transition)(?:-[a-z-]+)?\s*:\s*([^;]+);/gm)].map((m) => `${m[1]}: ${m[2]!.trim()}`);
    expect(outsideAnimations.sort()).toEqual([
      'animation: lf-boot-hold var(--lf-boot-deadline) step-end both',
      'animation: lf-boot-wait var(--lf-boot-deadline) step-end both',
    ]);
    // A reduced-motion override would mean the recipe itself moves (04 §3 wants the animation absent).
    expect(VEIL_CSS).not.toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('animates opacity and nothing else', () => {
    const frames = [...VEIL_CSS.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n {6}\}/g)].map((m) => m[1]!);
    expect(frames).toHaveLength(4);
    const properties = frames.flatMap((body) => [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]));
    expect([...new Set(properties)]).toEqual(['opacity']);
  });

  it('never hand-copies a second dissolve duration into the release script', () => {
    // A parse failure means no dissolve to wait for, never a remembered legacy number.
    expect(HTML).toContain("getPropertyValue('--lf-boot-dissolve')) || 0;");
  });
});

describe('the document ground and typefaces (02 D3, D4; OD-12)', () => {
  it('paints the body in the token --base and --content, in both modes, in Nunito', () => {
    expect(DOCUMENT).toMatch(new RegExp(`body \\{[^}]*background-color: ${token('--base')};[^}]*color: ${token('--content')};[^}]*Nunito`));
    expect(DOCUMENT).toContain(`html.dark body { background-color: ${token('--base', true)}; color: ${token('--content', true)}; }`);
    expect(MAIN).toContain("import '@/rebuild/design/document.css';");
  });

  it('never loads the legacy global sheet on the product entry', () => {
    expect(MAIN).not.toMatch(/import '@\/index\.css'/);
  });

  it('requests no third-party font and preloads the two self-hosted faces, not the icon font', () => {
    expect(HTML).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|material-symbols/);
    expect(HTML).toContain('href="/fonts/fredoka-latin-v1.woff2" crossorigin');
    expect(HTML).toContain('href="/fonts/nunito-latin-v1.woff2" crossorigin');
  });
  it('keeps the legacy island sheet on the self-hosted Fredoka and Nunito, with no third-party font', () => {
    const ISLAND = readFileSync(resolve(FRONTEND, 'src/index.css'), 'utf8');
    const TAILWIND = readFileSync(resolve(FRONTEND, 'tailwind.config.js'), 'utf8');
    // No remote sheet or remote face: the only host named is in a comment explaining the Material Symbols move.
    expect(ISLAND).not.toMatch(/@import\s+url\(['"]?https?:|src:\s*url\(['"]?https?:/);
    expect(ISLAND).not.toMatch(/font-family:\s*'?(Inter|Sora)\b/);
    expect(ISLAND).toContain("src: url('/fonts/fredoka-latin-v1.woff2')");
    expect(ISLAND).toContain("src: url('/fonts/nunito-latin-v1.woff2')");
    expect(TAILWIND).not.toMatch(/'(Inter|Sora)'/);
  });
});

describe('boot veil — the release contract', () => {
  it('reads the dissolve duration from the stylesheet, never a second copy', () => {
    // The one number the bundle would otherwise have to hand-copy. index.html
    // owns the release so it can read its own --lf-boot-dissolve; src/lib/boot.ts
    // only decides when to call it, and must declare no duration of its own.
    expect(HTML).toContain("getPropertyValue('--lf-boot-dissolve')");
    expect(HTML).toMatch(/--lf-boot-dissolve: \d+ms;/);
    expect(BOOT).not.toMatch(/--lf-boot-dissolve|DISSOLVE_MS/);
  });

  it('arms the fail-open against the bundle, not against a clock', () => {
    /*
     * Measured 2026-09-04: a blind 8s deadline lifted the veil on a perfectly
     * healthy fast-3G production boot and put the raw prerendered shell back on
     * screen for 5.7 seconds — the reported defect, reintroduced for the slowest
     * connections. `load` is the only signal that answers "is the app still
     * coming"; the CSS deadline may only cover `load` never firing at all.
     */
    expect(HTML).toMatch(/addEventListener\('load'/);
    const deadline = HTML.match(/--lf-boot-deadline: (\d+)s;/);
    expect(deadline, '--lf-boot-deadline not declared in seconds').not.toBeNull();
    expect(Number(deadline![1])).toBeGreaterThanOrEqual(20);
  });

  it('reads the same storage key, with the same auto semantics, as ThemeProvider', () => {
    // If these two ever disagree the page paints one theme and corrects itself
    // to another — the exact defect the inline script was added to remove.
    expect(THEME).toContain("const STORAGE_KEY = 'lf-theme';");
    expect(HTML).toContain("getItem('lf-theme')");
    expect(HTML).toContain("stored === 'dark'");
    expect(HTML).toContain("stored !== 'light'");
    expect(HTML).toContain("matchMedia('(prefers-color-scheme: dark)')");
  });
});

describe('boot veil — it can never trap anyone', () => {
  it('is pointer-events:none, so a stuck veil still lets every control through', () => {
    const block = HTML.slice(HTML.indexOf('#lf-boot {'), HTML.indexOf('#lf-boot::after'));
    expect(block).toContain('pointer-events: none;');
  });

  it('reveals the app on a CSS deadline even if our JavaScript never runs', () => {
    // A chunk that 404s, a blocked bundle, a thrown module: none of them may
    // cost a white screen. Both halves of the reveal are armed with a bounded
    // animation that finishes without anyone calling releaseBootVeil().
    expect(HTML).toMatch(/html\[data-lf-boot='on'\] #lf-boot \{[^}]*animation: lf-boot-hold var\(--lf-boot-deadline\)/);
    expect(HTML).toMatch(/html\[data-lf-boot='on'\] #root \{[^}]*animation: lf-boot-wait var\(--lf-boot-deadline\)/);
    expect(HTML).toMatch(/--lf-boot-deadline: \d+s;/);
  });

  it('is inert until the inline script arms it, so no-JavaScript readers keep the shell', () => {
    const block = HTML.slice(HTML.indexOf('#lf-boot {'), HTML.indexOf('#lf-boot::after'));
    expect(block).toContain('display: none;');
    expect(HTML).toContain("setAttribute('data-lf-boot', 'on')");
  });
});

describe('boot veil — it does not break anything else', () => {
  it('leaves the empty #root the prerenderer replaces by exact string', () => {
    // scripts/seo/build-seo.mjs does `.replace('<div id="root"></div>', …)`
    // and throws if the built file no longer contains it.
    expect(HTML).toContain('<div id="root"></div>');
  });

  it('never puts a filter or a transform on #root', () => {
    // Either would make #root the containing block for every position:fixed
    // descendant in the product. The blur belongs to the veil's backdrop.
    const rootRules = [...HTML.matchAll(/#root \{([^}]*)\}/g)].map((m) => m[1]).join('\n');
    expect(rootRules).not.toMatch(/filter:/);
    expect(rootRules).not.toMatch(/transform:/);
  });

  it('carries no user-facing string (§1.8 — nothing here can reach i18n)', () => {
    const veil = HTML.slice(HTML.indexOf('<div id="lf-boot"'), HTML.indexOf('</body>'));
    expect(veil).toContain('aria-hidden="true"');
    expect(veil.replace(/<[^>]+>/g, '').trim()).toBe('');
  });
});
