import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Static contracts for S03.2 that no component test can see.
 *
 * 1. The component gallery (`rebuild.html?screen=gallery`) is a development
 *    and review tool: it must never reach production or production
 *    navigation.
 * 2. A destructive action is only ever offered through `DestructiveAction` /
 *    `ConfirmDialog`, so the keep option always comes first (02 §9.5, §9.8).
 */
const frontend = process.cwd();
const read = (path: string) => readFileSync(resolve(frontend, path), 'utf8');
const sources = (dir: string) => readdirSync(resolve(frontend, dir), { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.(?:tsx?|html|json)$/.test(file)).map((file) => ({ file: join(dir, file).replace(/\\/g, '/'), text: read(join(dir, file)) }));

describe('component gallery stays out of production', () => {
  it('renders only in a development build', () => {
    const entry = read('src/rebuild/preview/main.tsx');
    expect(entry).toMatch(/if \(import\.meta\.env\.DEV\) \{\s*createRoot/);
  });

  it('is not a build input, a rewrite or a link anywhere in the product', () => {
    // Vite builds index.html only unless rollupOptions.input names more entries.
    expect(read('vite.config.ts')).not.toMatch(/rebuild\.html|rollupOptions/);
    expect(read('vercel.json')).not.toMatch(/rebuild/);
    const product = [...sources('src'), { file: 'index.html', text: read('index.html') }]
      .filter(({ file }) => !file.startsWith('src/rebuild/preview/') && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'));
    expect(product.filter(({ text }) => /rebuild\.html|screen=gallery/.test(text)).map(({ file }) => file)).toEqual([]);
  });
});

describe('destructive actions always confirm first', () => {
  it('no rebuilt surface renders a danger button directly', () => {
    const offenders = sources('src/rebuild')
      .filter(({ file }) => !file.startsWith('src/rebuild/design/') && !file.startsWith('src/rebuild/preview/') && !/\.test\.tsx?$/.test(file))
      .filter(({ text }) => /variant=["']danger["']|variant:\s*["']danger["']/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('inside the design system, the danger variant appears only in the confirmation itself', () => {
    const design = sources('src/rebuild/design').filter(({ file }) => !/\.test\.tsx?$/.test(file) && /danger/.test(file) === false);
    const uses = design.filter(({ text }) => /variant=\{?["']danger["']|variant=\{destructive \? 'danger'/.test(text)).map(({ file }) => file);
    expect(uses).toEqual(['src/rebuild/design/overlays.tsx']);
  });
});
