/// <reference types="vitest/config" />
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A worktree whose node_modules is a junction into another checkout resolves
// packages to that checkout's real path, outside this root, and Vite's file
// guard then refuses asset imports such as the Lottie player's `?url` WASM.
// Allowing the real node_modules path keeps the guard for everything else.
const nodeModules = fileURLToPath(new URL('./node_modules', import.meta.url));
const realNodeModules = existsSync(nodeModules) ? realpathSync(nodeModules) : nodeModules;

export default defineConfig({
  // Parallel checkouts that share one node_modules (e.g. worktrees joined by a
  // junction) must not share Vite's dependency cache; VITE_CACHE_DIR separates them.
  cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), realNodeModules] },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
