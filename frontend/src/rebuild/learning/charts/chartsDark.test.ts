import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEAT_CEILING, heatShade } from './readingGeometry';

/*
 * Fix round (dark mode): the reading charts draw only with tokens that flip with
 * the theme. The constant tokens (--ink, --primary, --sky, --mint, --berry, the
 * -ridge and --on- pairs) keep one value in light and dark, so on a surface that
 * flips they are right in one theme and wrong in the other.
 */

const read = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');
const tokens = read('../../design/tokens.css');
const block = (selector: string) => {
  const start = tokens.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return tokens.slice(start, tokens.indexOf('\n}', start));
};
const parse = (text: string) => new Map([...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/g)].map((match) => [match[1]!, match[2]!] as const));
const light = parse(block('.lf-rebuild'));
const dark = parse(block('.lf-rebuild[data-theme="dark"]'));
const themes = { light, dark: new Map([...light, ...dark]) } as const;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (colour: number[]) => 0.2126 * channel(colour[0]!) + 0.7152 * channel(colour[1]!) + 0.0722 * channel(colour[2]!);
const ratio = (a: number[], b: number[]) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
const mix = (top: number[], bottom: number[], alpha: number) => top.map((value, i) => value * alpha + bottom[i]! * (1 - alpha));

const sources = {
  'charts.css': read('charts.css'),
  'readingCharts.tsx': read('readingCharts.tsx'),
  'TeachingChart.tsx': read('TeachingChart.tsx'),
};

describe('reading charts in dark mode', () => {
  it('parses a light and a dark token layer that differ', () => {
    expect(light.get('surface')).toBe('#ffffff');
    expect(dark.get('surface')).toBe('#131627');
    expect(dark.size).toBeGreaterThan(15);
  });

  it('draws with theme-flipping colour tokens only, never a constant one or a raw colour', () => {
    const flips = (name: string) => dark.has(name) && dark.get(name) !== light.get(name);
    for (const [file, text] of Object.entries(sources)) {
      for (const [, name] of text.matchAll(/var\(--([a-z0-9-]+)/g)) {
        if (!light.has(name!)) continue;
        expect(flips(name!), `${file} uses --${name}, which keeps one value in light and dark`).toBe(true);
      }
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b(?:rgba?|hsla?)\(/);
      expect(text, file).not.toMatch(/(?:fill|stroke|color)\s*[:=]\s*["']?(?:white|black|currentColor)\b/);
    }
  });

  it('keeps the essential marks off the faint outline token', () => {
    const plots = sources['readingCharts.tsx'];
    for (const retired of ['lf-chart-axis', 'lf-chart-stem', 'lf-chart-halo']) expect(plots, retired).not.toContain(retired);
    expect(plots).toContain('lf-chart-baseline');
    expect(plots).toContain('lf-chart-whisker');
    const css = sources['charts.css'];
    expect(css).toMatch(/\.lf-chart-baseline \{[^}]*stroke: var\(--edge\)/);
    expect(css).toMatch(/\.lf-chart-whisker \{[^}]*stroke: var\(--content-muted\)/);
    expect(css).not.toContain('.lf-chart-halo');
  });

  for (const theme of ['light', 'dark'] as const) {
    const colour = (name: string) => rgb(themes[theme].get(name)!);

    it(`gives the heat cell text 4.5 to 1 at every shade in ${theme}`, () => {
      const base = colour('sunken'); const ink = colour('sky-strong'); const text = colour('content');
      for (let step = 0; step <= 20; step += 1) {
        const shade = heatShade(step, [0, 20]);
        expect(ratio(text, mix(ink, base, shade)), `${theme} step ${step} shade ${shade.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(heatShade(20, [0, 20])).toBeCloseTo(HEAT_CEILING);
    });

    it(`keeps axes, whiskers and the three series hues at 3 to 1 on the surface in ${theme}`, () => {
      const surface = colour('surface');
      expect(ratio(colour('edge'), surface), 'axis (--edge)').toBeGreaterThanOrEqual(3);
      expect(ratio(colour('content-muted'), surface), 'whisker (--content-muted)').toBeGreaterThanOrEqual(3);
      for (const hue of ['sky-strong', 'mint-strong', 'berry-strong']) expect(ratio(colour(hue), surface), hue).toBeGreaterThanOrEqual(3);
      expect(ratio(colour('content'), surface), 'tag text').toBeGreaterThanOrEqual(7);
    });
  }
});
