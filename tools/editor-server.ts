import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePath, type Plugin } from 'vite';

// Lets the in-browser editor save while developing (npm run dev / start.bat).
// Only kinds.json and scene files can be written, and only on this computer's dev server.
const ALLOWED = /^src\/(kinds\.json|scenes\/[\w-]+\.json)$/;

export function editorServer(): Plugin {
  const justSaved = new Set<string>();
  return {
    name: 'editor-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__editor/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { files } = JSON.parse(body) as { files: { path: string; text: string }[] };
            for (const f of files) if (!ALLOWED.test(f.path)) throw new Error(`이 파일은 저장할 수 없어요: ${f.path}`);
            for (const f of files) {
              const file = normalizePath(resolve(server.config.root, f.path));
              justSaved.add(file);
              writeFileSync(file, f.text);
            }
            res.setHeader('content-type', 'application/json');
            res.end('{"ok":true}');
          } catch (e) {
            res.statusCode = 400;
            res.end(e instanceof Error ? e.message : String(e));
          }
        });
      });
    },
    // The editor already shows what it saved, so don't reload the page for its own saves.
    handleHotUpdate({ file }) {
      if (justSaved.delete(file)) return [];
    },
  };
}
