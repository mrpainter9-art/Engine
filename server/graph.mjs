import fs from 'node:fs/promises';
import path from 'node:path';
import { list } from './fsapi.mjs';
import { resolveInside } from './paths.mjs';

export function kindOf(p) {
  if (p === 'res://project.json') return 'project';
  if (p.endsWith('.scene.json')) return 'scene';
  if (/\.m?js$/i.test(p)) return 'script';
  if (/\.(png|jpe?g|gif|webp)$/i.test(p)) return 'image';
  if (/\.(glb|gltf)$/i.test(p)) return 'model';
  if (/\.(wav|mp3|ogg)$/i.test(p)) return 'audio';
  if (/\.json$/i.test(p)) return 'data';
  return 'other';
}

/** 'res://scripts/a.js' + '../lib/b.js' -> 'res://lib/b.js' (null if it leaves the project). */
function relative(from, spec) {
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(from.slice(6)), spec));
  return p.startsWith('..') ? null : 'res://' + p;
}

function sceneRefs(from, text, add) {
  let root;
  try { root = JSON.parse(text).root; } catch { return; }
  // node paths are relative to the scene root, as in node.find(): "Outside/Trees/Pine1"; the root itself goes by its name
  const walk = (n, rel) => {
    if (!n || typeof n !== 'object') return;
    const p = rel || n.name;
    if (n.script) add(from, n.script, `${p} · 스크립트`);
    for (const [k, v] of Object.entries(n.props || {})) if (typeof v === 'string' && v.startsWith('res://')) add(from, v, `${p} · ${k}`);
    for (const c of n.children || []) walk(c, rel ? rel + '/' + c.name : c.name);
  };
  walk(root, '');
}

function scriptRefs(from, text, add) {
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/(['"`])(res:\/\/[^'"`\s]+)\1/g)) {
      const call = /(\w+)\s*\(\s*$/.exec(line.slice(0, m.index));
      add(from, m[2], `${i + 1}행${call ? ' · ' + call[1] : ''}`);
    }
    for (const m of line.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\1/g)) {
      const to = relative(from, m[2]);
      if (to) add(from, to, `${i + 1}행 · import`);
    }
  });
}

function gltfRefs(from, text, add) {
  let g;
  try { g = JSON.parse(text); } catch { return; }
  for (const [list, label] of [[g.images, '텍스처'], [g.buffers, '데이터']])
    for (const x of list || []) if (x.uri && !x.uri.startsWith('data:')) { const to = relative(from, decodeURIComponent(x.uri)); if (to) add(from, to, label); }
}

/**
 * Which file uses which: scenes -> scripts and assets (per node and property), scripts -> res:// paths and imports,
 * project.json -> main scene, .gltf -> its textures. Files nothing points to are "unused"; targets that don't exist are "missing".
 */
export async function graph(root) {
  const files = (await list(root)).filter((f) => !f.dir);
  const edges = [];
  const seen = new Set();
  const add = (from, to, label) => { const k = from + '\n' + to + '\n' + label; if (!seen.has(k)) { seen.add(k); edges.push({ from, to, label }); } };
  for (const f of files) {
    const kind = kindOf(f.path);
    const readable = kind === 'project' || kind === 'scene' || kind === 'script' || f.path.endsWith('.gltf');
    if (!readable || (f.size || 0) > 2_000_000) continue;
    let text;
    try { text = await fs.readFile(resolveInside(root, f.path), 'utf8'); } catch { continue; }
    if (kind === 'project') { try { const p = JSON.parse(text); if (p.mainScene) add(f.path, p.mainScene, '메인 씬'); } catch { /* broken json shows as no edges */ } }
    else if (kind === 'scene') sceneRefs(f.path, text, add);
    else if (kind === 'script') scriptRefs(f.path, text, add);
    else gltfRefs(f.path, text, add);
  }
  const used = new Set(edges.map((e) => e.to));
  const have = new Set(files.map((f) => f.path));
  // plain documents (AGENTS.md, notes) only show up when something points at them
  const nodes = files.filter((f) => kindOf(f.path) !== 'other' || used.has(f.path)).map((f) => ({ path: f.path, kind: kindOf(f.path), size: f.size, used: used.has(f.path) }));
  for (const to of used) if (!have.has(to)) nodes.push({ path: to, kind: 'missing', used: true });
  return { nodes, edges };
}
