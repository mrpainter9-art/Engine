import { defineConfig } from 'vite';
import { editorServer } from './tools/editor-server';

// "npm run export" builds in "export" mode: every picture, sound and the font are packed
// into the code so the whole game fits in one HTML file (see tools/export.mjs).
// EDITOR_DEMO=1 keeps the editor in that file (for trying the editor without installing anything).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [editorServer()],
  define: { __EDITOR_DEMO__: JSON.stringify(process.env.EDITOR_DEMO === '1') },
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
