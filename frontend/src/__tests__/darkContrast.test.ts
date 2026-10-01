import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The shipped rebuild uses generated hex tokens; the legacy RGB sheet is gone.
const css = readFileSync(resolve(process.cwd(), 'src/rebuild/design/tokens.css'), 'utf8');
const lightBlock = css.match(/\.lf-rebuild\s*\{([^}]+)\}/)?.[1];
const darkBlock = css.match(/\.lf-rebuild\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
if (!lightBlock || !darkBlock) throw new Error('Both rebuilt theme token blocks must exist');

function palette(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--([a-z][a-z-]+):\s*(#[0-9a-f]{6});/gi)]
    .map((match) => [match[1]!, match[2]!]));
}
const light = palette(lightBlock);
const dark = new Map([...light, ...palette(darkBlock)]);

function token(name: string, theme: Map<string, string>): number[] {
  const color = theme.get(name);
  if (!color) throw new Error(`Missing rebuilt theme token ${name}`);
  return [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
}
function luminance(rgb: number[]) {
  const linear = rgb.map((v) => v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
function contrast(a: number[], b: number[]) {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1]! + 0.05) / (values[0]! + 0.05);
}

describe.each([['light', light], ['dark', dark]] as const)('%s rebuilt theme text contrast', (_name, theme) => {
  it.each([
    ['content', 'base'], ['content', 'surface'], ['content-muted', 'base'],
    ['on-primary', 'primary'], ['on-accent', 'accent'], ['on-success', 'success'],
    ['primary-strong', 'primary-soft'], ['success-strong', 'success-soft'],
    ['error-strong', 'error-soft'], ['warning-strong', 'warning-soft'],
  ])('keeps %s readable on %s at WCAG AA', (foreground, background) => {
    expect(contrast(token(foreground, theme), token(background, theme)), `${foreground} on ${background}`)
      .toBeGreaterThanOrEqual(4.5);
  });
});
