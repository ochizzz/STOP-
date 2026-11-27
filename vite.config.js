import { defineConfig } from 'vite';

// Относительные пути: сборка работает и в браузере, и внутри Capacitor
export default defineConfig({
  base: './',
  build: { outDir: 'build/web', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 1200 },
  server: { host: true },
});
