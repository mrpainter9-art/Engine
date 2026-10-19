import { defineConfig } from 'vite';

// "npm run export" builds in "export" mode: every picture, sound and the font are packed
// into the code so the whole game fits in one HTML file (see tools/export.mjs).
export default defineConfig(({ mode }) => ({
  base: './',
  build:
    mode === 'export'
      ? {
          outDir: 'dist-export',
          assetsInlineLimit: () => true,
          modulePreload: false,
          chunkSizeWarningLimit: 100000,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {},
}));
