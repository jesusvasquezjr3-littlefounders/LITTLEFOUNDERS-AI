/**
 * Regression guard for the Lesson Engine dark-mode safety net.
 *
 * Activity components author their island surfaces with light-only Tailwind
 * utilities (bg-white, text-slate-*, border-slate-*). Because every exercise
 * renders inside the runner's `.lp` scope, a small set of scoped `.dark .lp …`
 * overrides in index.css remaps those utilities to the dark-flipping --lp-*
 * tokens. If those rules are ever removed, dark mode silently regresses to the
 * "white slab / unreadable dark-on-dark text" bug the audit found. This test
 * fails loudly if the safety net disappears.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
// collapse whitespace so selector lists match regardless of formatting
const flat = css.replace(/\s+/g, ' ');

describe('Lesson Engine dark-mode safety net (index.css)', () => {
  it('remaps bg-white to the surface token inside .lp in dark mode', () => {
    expect(flat).toMatch(/\.dark \.lp \.bg-white\s*\{\s*background-color:\s*var\(--lp-surface\)/);
  });

  it('remaps dark slate text to --lp-ink inside .lp in dark mode', () => {
    expect(flat).toContain('.dark .lp .text-slate-900');
    expect(flat).toMatch(/\.text-slate-700\s*\{\s*color:\s*var\(--lp-ink\)/);
  });

  it('remaps muted slate text to --lp-muted inside .lp in dark mode', () => {
    expect(flat).toContain('.dark .lp .text-slate-500');
    expect(flat).toMatch(/\.text-slate-400,?\s*\.dark \.lp \.text-slate-300\s*\{\s*color:\s*var\(--lp-muted\)/);
  });

  it('remaps slate borders to --lp-line inside .lp in dark mode', () => {
    expect(flat).toContain('.dark .lp .border-slate-100');
    expect(flat).toMatch(/border-color:\s*var\(--lp-line\)/);
  });

  it('defines the dark .lp token overrides they depend on', () => {
    expect(flat).toMatch(/\.dark \.lp\s*\{[^}]*--lp-surface:\s*#0d1426/);
    expect(flat).toMatch(/\.dark \.lp\s*\{[^}]*--lp-ink:\s*#f1f5f9/);
  });
});
