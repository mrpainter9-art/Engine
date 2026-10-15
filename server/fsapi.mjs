import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveInside, toRes } from './paths.mjs';

const SKIP = new Set(['.git', 'node_modules', 'export', '.godot', '.DS_Store']);

/** Every file and folder in the project as a flat list, so the editor can build its tree and notice outside changes by mtime. */
export async function list(root) {
  const out = [];
  async function walk(dir) {
    let ents = [];
    try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (SKIP.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { out.push({ path: toRes(root, abs), dir: true }); await walk(abs); }
      else { const st = await fs.stat(abs); out.push({ path: toRes(root, abs), dir: false, size: st.size, mtime: st.mtimeMs }); }
    }
  }
  await walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export const read = async (root, p) => ({ text: await fs.readFile(resolveInside(root, p), 'utf8') });

export async function write(root, { path: p, text, base64 }) {
  const abs = resolveInside(root, p);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, base64 != null ? Buffer.from(base64, 'base64') : text);
  return { mtime: (await fs.stat(abs)).mtimeMs };
}

export async function mkdir(root, { path: p }) {
  await fs.mkdir(resolveInside(root, p), { recursive: true });
  return {};
}

export async function rename(root, { from, to }) {
  const a = resolveInside(root, from), b = resolveInside(root, to);
  try { await fs.access(b); throw Object.assign(new Error('같은 이름이 이미 있어요: ' + to), { status: 409 }); } catch (e) { if (e.status) throw e; }
  await fs.mkdir(path.dirname(b), { recursive: true });
  await fs.rename(a, b);
  return {};
}

export async function remove(root, { path: p }) {
  const abs = resolveInside(root, p);
  if (abs === path.resolve(root)) throw Object.assign(new Error('프로젝트 폴더 자체는 지울 수 없어요'), { status: 400 });
  await fs.rm(abs, { recursive: true, force: true });
  return {};
}
