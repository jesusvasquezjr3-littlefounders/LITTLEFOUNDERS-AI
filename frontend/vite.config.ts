import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  server: {
    host: "::",
    port: 8080,
    proxy: env.VITE_DEV_API_PROXY
      ? {
          // Dev-only proxy: set VITE_DEV_API_PROXY (e.g. the Railway backend URL)
          // and VITE_API_URL=/api-proxy to test against a remote backend without CORS.
          "/api-proxy": {
            target: env.VITE_DEV_API_PROXY,
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api-proxy/, ""),
          },
        }
      : undefined,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        en: path.resolve(__dirname, 'index-en.html'),
      }
    }
  }
  };
});
