import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/index.css?inline', () => ({ default: 'html { scroll-behavior: smooth } body { background: rgb(248 250 252) }' }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { acquireLegacySheet, LegacySheetScope, LEGACY_SHEET_ATTRIBUTE } = await import('./legacySheet');

/*
 * Frontend Bible 02 rule 23 / D13 and OD-24: the legacy global sheet is the v1
 * island's alone. It is present while the island (or the staff v1 preview) is
 * mounted and gone once the learner navigates back to a rebuilt route, so no
 * Tailwind preflight or legacy `body` ground outlives the lesson.
 */
const sheets = () => document.head.querySelectorAll(`style[${LEGACY_SHEET_ATTRIBUTE}]`);

afterEach(() => { document.head.querySelectorAll(`style[${LEGACY_SHEET_ATTRIBUTE}]`).forEach((node) => node.remove()); });

describe('the scoped legacy sheet', () => {
  it('is in the document only while a legacy surface is mounted, and its children never render without it', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let sheetsAtChildRender = -1;
    function Probe() { sheetsAtChildRender = sheets().length; return <p>v1 lesson</p>; }
    expect(sheets()).toHaveLength(0);
    act(() => root.render(<LegacySheetScope><Probe /></LegacySheetScope>));
    expect(sheets()).toHaveLength(1);
    expect(sheetsAtChildRender).toBe(1);
    expect(host.textContent).toBe('v1 lesson');
    // Client-side navigation back to /learn unmounts the island.
    act(() => root.render(<main className="lf-rebuild">learn</main>));
    expect(sheets()).toHaveLength(0);
    act(() => root.unmount());
    host.remove();
  });

  it('is reference-counted: one element for two holders, removed only by the last release, release is idempotent', () => {
    const a = acquireLegacySheet();
    const b = acquireLegacySheet();
    expect(sheets()).toHaveLength(1);
    a();
    a();
    expect(sheets()).toHaveLength(1);
    b();
    expect(sheets()).toHaveLength(0);
  });

  it('is the only way any non-lab module loads the legacy sheet', () => {
    const src = resolve(__dirname, '..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
    const loaders = walk(src)
      .map((file) => ({ file: relative(src, file).replace(/\\/g, '/'), text: readFileSync(file, 'utf8') }))
      .filter(({ text }) => /import\s*(?:\(\s*)?(?:\w+\s+from\s+)?['"]@\/index\.css/.test(text))
      .map(({ file }) => file)
      // The dev labs are DevRoute-only full-page tools, never reached from a rebuilt route.
      .filter((file) => !/\/lab\//.test(file));
    expect(loaders).toEqual(['app-routes/legacySheet.tsx']);
  });
});
