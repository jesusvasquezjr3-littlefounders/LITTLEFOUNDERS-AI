import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Stable libraries get their own files, so a deploy that only changes our code does not invalidate them in a returning visitor's cache.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (/[/](react|react-dom|scheduler)[/]/.test(id)) return 'react';

          if (/[/](motion|framer-motion|motion-dom|motion-utils)[/]/.test(id)) return 'motion';

          if (/[/](react-router|react-router-dom|@remix-run)[/]/.test(id)) return 'router';

          if (/[/](i18next|react-i18next|i18next-browser-languagedetector)[/]/.test(id)) return 'i18n';

          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    // Core allows this one origin: a second dev server stops here instead of moving to 5174, where nothing works
    strictPort: true,
  },
});
