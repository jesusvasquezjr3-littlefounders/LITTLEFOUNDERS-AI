import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * THE RECIPE, PINNED.
 *
 * /DESIGN.md §Screen Recipes → Auth specifies one composition for the whole
 * trust surface, and /DESIGN.md §0 calls deviating from a recipe without
 * sign-off a design bug. It drifted anyway: on 2026-08-01 four of the six auth
 * pages were moved onto a second shell - two columns over a full-bleed stock
 * photo - while /verify-parent and /upgrade-account stayed on the compliant
 * one. Every gate stayed green for weeks, because a rule written only in a
 * document is a rule nothing checks.
 *
 * These assertions read the SOURCE rather than a render, deliberately: what has
 * to hold is that no auth page can compose itself out of anything but the one
 * shell, and that is a property of the files, not of one mounted tree.
 */

const AUTH_DIR = join(process.cwd(), 'src', 'routes', 'auth');

function authPages(): { name: string; source: string }[] {
  return readdirSync(AUTH_DIR)
    .filter((f) => f.endsWith('Page.tsx'))
    .map((name) => ({ name, source: readFileSync(join(AUTH_DIR, name), 'utf8') }));
}

describe('Auth screen recipe', () => {
  it('every auth page composes from AuthShell and nothing else', () => {
    const pages = authPages();
    expect(pages.length).toBeGreaterThanOrEqual(6);
    for (const { name, source } of pages) {
      expect(source, `${name} must render <AuthShell>`).toMatch(/<AuthShell\b/);
      // The specific regression: a second shell taking over the busiest pages.
      expect(source, `${name} must not resurrect AuthSplit`).not.toMatch(/AuthSplit/);
    }
  });

  it('no auth page names a colour — cross-links come from the shared token class', () => {
    for (const { name, source } of authPages()) {
      // Six copies of `text-[#ff775c]` lived here. frontend/AGENTS.md: design
      // tokens are CHANNELS, not colours, and a component never spells one.
      const arbitrary = source.match(/(?:text|bg|border|ring)-\[#[0-9a-fA-F]{3,8}\]/g);
      expect(arbitrary, `${name} carries an arbitrary colour: ${arbitrary?.join(', ')}`).toBeNull();
    }
  });

  it('the shell keeps the recipe’s single centered column and its glow', () => {
    const shell = readFileSync(join(AUTH_DIR, 'AuthShell.tsx'), 'utf8');
    expect(shell).toMatch(/max-w-md/);
    expect(shell).toMatch(/max-w-2xl/); // verification forms
    expect(shell).toMatch(/bg-primary\/10/);
    // A photograph behind the column is what the split shell did; the recipe
    // puts the trust surface on `base`.
    expect(shell).not.toMatch(/auth-bg/);
  });

  it('the sign-in shell carries the theme control at EVERY width', () => {
    // W2: the auth chrome is the rebuilt AuthShell (app-shell/PublicLayouts.tsx); its footer holds the
    // language and theme choices. The legacy row shipped `hidden sm:inline-flex`, so a phone lost the only
    // theme control the rest of the product offers everywhere: nothing here may hide it by width.
    const layout = readFileSync(join(process.cwd(), 'src', 'app-shell', 'PublicLayouts.tsx'), 'utf8');
    const authLayout = layout.slice(layout.indexOf('export function AuthLayout'));
    expect(authLayout).toMatch(/footer=\{<Preferences \/>\}/);
    const preferences = layout.slice(layout.indexOf('function Preferences'), layout.indexOf('function SiteFooter'));
    expect(preferences).toMatch(/<SegmentedControl<ThemeChoice>/);
    expect(preferences).not.toMatch(/hidden/);
    expect(layout).not.toMatch(/auth-bg/);
  });
});
