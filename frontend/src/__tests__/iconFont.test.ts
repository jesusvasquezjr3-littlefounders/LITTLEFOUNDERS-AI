import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** The rebuilt UI uses manifest-authored SVG glyphs; retired icon fonts cannot ship. */
describe('the in-house glyph contract', () => {
  it('ships only the approved text fonts and no retired external icon font', () => {
    expect(readdirSync(resolve('public/fonts')).filter((file) => file.endsWith('.woff2')).sort()).toEqual([
      'fredoka-latin-v1.woff2', 'nunito-latin-v1.woff2',
    ]);
    expect(existsSync(resolve('public/fonts/material-symbols-outlined.woff2'))).toBe(false);
  });

  it('renders manifest-authored SVG glyphs without a font or third-party icon library', () => {
    const source = readFileSync(resolve('src/rebuild/design/glyphs.tsx'), 'utf8');
    expect(source).toContain("import manifest from '../assets/manifest.json'");
    expect(source).toContain('<svg');
    expect(source).not.toMatch(/material-symbols|font-family|lucide|heroicons|fontawesome/);
  });
});
