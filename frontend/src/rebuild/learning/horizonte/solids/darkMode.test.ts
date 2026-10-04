import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Dark-mode regression for the whole pack. `--ink` is the constant dark ink of the light theme, so a surface that stays dark-on-dark in
 * the dark theme must read `--content` (which flips) instead. Colour literals do not flip at all. Both are caught here in the pack's CSS
 * and in the SVG and style attributes of its boards, so the defect fixed in the fix round cannot come back.
 */
const dir = resolve(__dirname);
const sources = readdirSync(dir).filter((file) => /\.(css|tsx)$/.test(file) && !/\.test\./.test(file));
const text = (file: string): string => readFileSync(resolve(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the pack follows the theme', () => {
  it('finds the pack styles and boards', () => {
    expect(sources).toContain('solids.css');
    expect(sources).toContain('SolidScene3D.tsx');
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each(sources)('%s uses no constant ink and no colour literal', (file) => {
    const source = text(file);
    expect(source, `${file} reads var(--ink)`).not.toMatch(/var\(--ink\)/);
    expect(source, `${file} has a hex colour`).not.toMatch(/['"`\s:(,]#[0-9a-fA-F]{3,8}\b/);
    expect(source, `${file} has an rgb, hsl or oklch literal`).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/);
    expect(source, `${file} has a white or black value`).not.toMatch(/(?:color|fill|stroke|background|border[\w-]*|outline[\w-]*|box-shadow)\s*:\s*[^;{}]*\b(?:white|black)\b/);
    expect(source, `${file} has a currentColor value`).not.toMatch(/(?:fill|stroke)\s*[:=]\s*["']?currentColor/);
  });

  it('draws the surfaces that sit on the page with the flipping tokens', () => {
    const css = text('solids.css');
    const flipping = ['--content', '--content-muted', '--surface', '--sunken', '--outline'];
    for (const token of flipping) expect(css, token).toContain(`var(${token}`);
    for (const selector of ['.lf-poly-name', '.lf-poly-len', '.lf-fold-tag']) {
      const rule = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? '';
      expect(rule, selector).toMatch(/var\(--content/);
    }
  });

  it('reads the 3D palette from the themed host and follows a theme change', () => {
    const scene = text('SolidScene3D.tsx');
    expect(scene).toContain('MutationObserver');
    expect(scene).toContain('data-theme');
    expect(scene).toContain('getComputedStyle');
  });
});
