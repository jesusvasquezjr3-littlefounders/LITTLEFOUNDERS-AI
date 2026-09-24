import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const dark = css.split('  .dark {')[1]!.split('}')[0]!;
const light = css.split('  :root {')[1]!.split('}')[0]!;
function luminance(rgb: number[]) {
  const linear = rgb.map((v) => v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
function token(name: string, palette = dark) {
  const match = palette.match(new RegExp(`--lf-${name}: ([\\d ]+);`));
  if (!match) throw new Error(`Missing theme token ${name}`);
  return match[1]!.split(' ').map(Number);
}
function contrast(a: number[], b: number[]) {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1]! + 0.05) / (values[0]! + 0.05);
}

describe('dark theme WCAG AA text contrast', () => {
  it.each(['primary', 'primary-strong'])('keeps on-primary readable on %s actions', (fill) => {
    expect(contrast(token('on-primary'), token(fill))).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps selected navigation readable on its soft well', () => {
    expect(contrast(token('primary'), token('primary-soft'))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['success', 'warning', 'accent', 'error'])('keeps %s badges readable', (tone) => {
    const match = css.match(new RegExp(`\\.dark \\.text-${tone}-strong \\{\\s*color: rgb\\(([\\d ]+)\\)`));
    expect(match).not.toBeNull();
    expect(contrast(match![1]!.split(' ').map(Number), token(`${tone}-soft`))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('light theme WCAG AA text contrast', () => {
  it.each([
    ['content-faint', 'base'], ['content-faint', 'band'],
    ['content-muted', 'band'], ['primary', 'primary-soft'],
    ['success-strong', 'success-soft'], ['warning-strong', 'warning-soft'],
  ])('keeps %s readable on %s', (foreground, background) => {
    expect(contrast(token(foreground, light), token(background, light))).toBeGreaterThanOrEqual(4.5);
  });
});
