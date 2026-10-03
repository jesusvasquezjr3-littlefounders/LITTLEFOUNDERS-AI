import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = __dirname;
const files = (extension: string) => readdirSync(here).filter((name) => name.endsWith(extension));
const uncommented = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');

describe('num-a boards: colours flip with the theme', () => {
  it('uses no constant ink, hex, rgb, hsl, white or black in any stylesheet', () => {
    const forbidden = /var\(--ink\)|#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black)\b/i;
    expect(files('.css').length).toBeGreaterThanOrEqual(5);
    for (const file of files('.css')) {
      const lines = uncommented(readFileSync(resolve(here, file), 'utf8')).split('\n');
      for (const line of lines) expect(forbidden.test(line), `${file}: ${line.trim().slice(0, 80)}`).toBe(false);
    }
  });

  it('sets no colour inline on a board', () => {
    expect(files('Board.tsx').length).toBeGreaterThanOrEqual(9);
    for (const file of files('Board.tsx')) {
      expect(/\b(?:fill|stroke|color)=["{]/.test(readFileSync(resolve(here, file), 'utf8')), `${file}: an inline colour`).toBe(false);
    }
  });
});
