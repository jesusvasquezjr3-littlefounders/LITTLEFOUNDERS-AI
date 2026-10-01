import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Audit fixtures compile Depot's actual compositor using frontend dependencies.
// CI installs frontend alone: no filebase runtime or node_modules is required.
const frontendRequire = createRequire(new URL('../../package.json', import.meta.url));
export async function renderBadgeFixture({ source = fileURLToPath(new URL('../../../filebase/src/lib/badge.ts', import.meta.url)), params = { kind: 'course_badge', label: 'Money basics', firstName: 'Sofía', locale: 'en-US' } } = {}) {
  const { build } = frontendRequire('esbuild');
  const sharpUrl = pathToFileURL(frontendRequire.resolve('sharp')).href;
  const bundled = await build({
    entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'frontend-sharp', setup(builder) {
      builder.onResolve({ filter: /^sharp$/ }, () => ({ path: sharpUrl, external: true }));
    } }],
  });
  const { renderBadgePng } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  return renderBadgePng(params);
}
