import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['.git', 'node_modules', 'export', '.DS_Store']);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Web export: the built player (dist/play.html + its assets) as index.html, plus the project files under project/.
 * The result is a static folder that runs on any web host, and is what a desktop (Steam) wrapper would load.
 */
export async function exportWeb(projectRoot, outDir = path.join(projectRoot, 'export', 'web')) {
  const dist = path.join(ROOT, 'dist');
  try { await fs.access(path.join(dist, 'play.html')); } catch { throw Object.assign(new Error('먼저 npm run build 로 엔진을 빌드해 주세요'), { status: 400 }); }
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.copyFile(path.join(dist, 'play.html'), path.join(outDir, 'index.html'));
  await fs.cp(path.join(dist, 'assets'), path.join(outDir, 'assets'), { recursive: true });
  // copied file by file: the default output folder sits inside the project, which fs.cp refuses
  async function copyDir(src, dst) {
    await fs.mkdir(dst, { recursive: true });
    for (const e of await fs.readdir(src, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const a = path.join(src, e.name), b = path.join(dst, e.name);
      if (e.isDirectory()) await copyDir(a, b); else await fs.copyFile(a, b);
    }
  }
  await copyDir(projectRoot, path.join(outDir, 'project'));
  return { out: outDir };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const proj = path.resolve(process.argv[2] || 'examples/train-window');
  exportWeb(proj, process.argv[3] && path.resolve(process.argv[3])).then((r) => console.log('웹 내보내기 완료:', r.out), (e) => { console.error(e.message); process.exit(1); });
}
