// Makes export/game.html: the whole game in one file that opens by double-click or can be sent to anyone.
import { build } from 'vite';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'dist-export';
await build({ mode: 'export', logLevel: 'warn' });

let html = readFileSync(join(outDir, 'index.html'), 'utf8');
for (const file of readdirSync(join(outDir, 'assets')).filter((f) => f.endsWith('.js'))) {
  const code = readFileSync(join(outDir, 'assets', file), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace(new RegExp(`<script[^>]*src="\\./assets/${file}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
}
if (/src="\.\/assets\//.test(html)) throw new Error('Some files were not packed into the HTML.');

mkdirSync('export', { recursive: true });
writeFileSync('export/game.html', html);
console.log(`export/game.html (${Math.round(html.length / 1024)} KB)`);
