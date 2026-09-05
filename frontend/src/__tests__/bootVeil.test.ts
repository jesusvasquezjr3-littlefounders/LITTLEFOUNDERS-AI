import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The boot veil (/DESIGN.md §Motion recipe 11) lives in index.html, so its
 * values sit OUTSIDE the module graph every other test can reach: nothing
 * imports it, nothing type-checks it, and a change to the palette or to the
 * prerenderer cannot break it loudly. That makes it exactly the shape §1.14
 * keeps naming — a constant hand-copied into a second file, where the copies
 * drift silently and the failure is cosmetic rather than thrown. This file is
 * the gate that pins the copies together.
 */

const FRONTEND = resolve(__dirname, '../..');
const HTML = readFileSync(resolve(FRONTEND, 'index.html'), 'utf8');
const CSS = readFileSync(resolve(FRONTEND, 'src/index.css'), 'utf8');
const THEME = readFileSync(resolve(FRONTEND, 'src/theme/useTheme.tsx'), 'utf8');
const BOOT = readFileSync(resolve(FRONTEND, 'src/lib/boot.ts'), 'utf8');

/** `--lf-base: 248 250 252` → `#f8fafc`, so the two spellings can be compared. */
function tripletToHex(triplet: string): string {
  const parts = triplet.trim().split(/\s+/).map(Number);
  expect(parts).toHaveLength(3);
  return `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function cssVar(source: string, name: string, after = 0): string {
  const at = source.indexOf(name, after);
  expect(at, `${name} not found in stylesheet`).toBeGreaterThan(-1);
  return source.slice(at + name.length + 1, source.indexOf(';', at));
}

describe('boot veil — the ground colour', () => {
  it('matches --lf-base for light', () => {
    const light = tripletToHex(cssVar(CSS, '--lf-base'));
    expect(HTML).toContain(`--lf-boot-ground: ${light};`);
  });

  it('matches --lf-base for dark', () => {
    const darkBlock = CSS.indexOf('.dark {');
    expect(darkBlock).toBeGreaterThan(-1);
    const dark = tripletToHex(cssVar(CSS, '--lf-base', darkBlock));
    expect(HTML).toContain(`--lf-boot-ground: ${dark};`);
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
