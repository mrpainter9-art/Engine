import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two pages: the editor (index.html) and the game player (play.html), which is also what a web export ships.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200, // the editor bundles CodeMirror; it loads from localhost, so size is fine
    rollupOptions: { input: { editor: resolve(__dirname, 'index.html'), play: resolve(__dirname, 'play.html') } },
  },
  test: { environment: 'node', include: ['tests/*.test.ts', 'tests/*.test.mjs'] },
} as any);
