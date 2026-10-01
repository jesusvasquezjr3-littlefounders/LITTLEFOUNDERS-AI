import { defineConfig, mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import appConfig from '../../vite.config.ts';

const frontend = fileURLToPath(new URL('../../', import.meta.url));

/** Local verification build only: the production build keeps its original single entry. */
export default defineConfig(mergeConfig(appConfig, {
  root: frontend,
  plugins: [{
    name: 'compiled-audit-preview-entry',
    enforce: 'pre',
    transform(code, id) {
      // Enable only the development specimen entry in this isolated build.
      // The actual application retains production DEV guards and behavior.
      if (id.replaceAll('\\', '/') === resolve(frontend, 'src/rebuild/preview/main.tsx').replaceAll('\\', '/')) {
        return { code: code.replace('import.meta.env.DEV', 'true'), map: null };
      }
    },
  }],
  build: {
    // The runner creates a fresh temporary output; no existing directory is emptied.
    emptyOutDir: false,
    rollupOptions: {
      input: {
        app: resolve(frontend, 'index.html'),
        rebuild: resolve(frontend, 'rebuild.html'),
        fixtures: resolve(frontend, 'audit-fixtures.html'),
      },
    },
  },
}));
