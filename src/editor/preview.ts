import { Node, Renderer, Textures, Mat2D, Camera2D, parseScene, has3D, cameraWorldPos, nodeClass, createNode, Node3D, type View, type MeshInstance3D, type Sprite3D } from '../engine';
import { ed, inspectFile, addNode } from './state';
import { api, projectUrl } from './api';
import { h, clear, toast } from './ui';
import { getGraph } from './graph-data';
import { openFile } from './open-file';

// Asset previews: small thumbnails (file dock grid, graph cards) and the big preview the inspector shows for a selected file.

export type AssetKind = 'folder' | 'project' | 'scene' | 'script' | 'image' | 'model' | 'audio' | 'data' | 'text' | 'other' | 'missing';

export function assetKind(path: string, dir = false): AssetKind {
  if (dir) return 'folder';
  if (path === 'res://project.json') return 'project';
  if (path.endsWith('.scene.json')) return 'scene';
  if (/\.m?js$/i.test(path)) return 'script';
  if (/\.(png|jpe?g|gif|webp)$/i.test(path)) return 'image';
  if (/\.(glb|gltf)$/i.test(path)) return 'model';
  if (/\.(wav|mp3|ogg)$/i.test(path)) return 'audio';
  if (/\.json$/i.test(path)) return 'data';
  if (/\.(md|txt|css)$/i.test(path)) return 'text';
  return 'other';
}

export const KIND_LABEL: Record<AssetKind, string> = {
  folder: '폴더', project: '프로젝트 설정', scene: '씬', script: '스크립트', image: '이미지', model: '3D 모델', audio: '소리', data: '데이터', text: '문서', other: '파일', missing: '없는 파일',
};
export const KIND_ICON: Record<AssetKind, string> = {
  folder: '📁', project: '⚙', scene: '🎬', script: '📜', image: '🖼', model: '🧊', audio: '🔊', data: '🗂', text: '📄', other: '📄', missing: '⚠',
};

export const fmtSize = (n = 0) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('이미지를 읽지 못했어요')); img.src = src; });
}

// ---------- scene pictures ----------

/** A still of a scene as the game would show its first frame (scripts don't run), at the game's resolution. */
export async function renderScenePicture(root: Node): Promise<HTMLCanvasElement> {
  const { width: W, height: H } = ed.project.viewport;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const tex = new Textures(projectUrl);
  const paths: string[] = [];
  root.walk((n) => { for (const p of nodeClass(n.type).allProps()) if (p.type === 'texture' && n.props[p.name]) paths.push(n.props[p.name]); });
  for (let t = 0; t < 60 && paths.some((p) => !tex.get(p) && !tex.isMissing(p)); t++) await sleep(50);
  const under = has3D(root) ? await (await import('./preview3d')).renderScene3D(root, W, H) : null;
  let cam: Camera2D | null = null;
  root.walk((n) => { if (!cam && n instanceof Camera2D && n.current) cam = n; });
  const center = cam ? cameraWorldPos(cam) : { x: W / 2, y: H / 2 }, zoom = (cam as Camera2D | null)?.zoom ?? 1;
  const view: View = { center, zoom, width: W, height: H, time: 0, parallaxOrigin: { x: center.x - W / 2 / zoom, y: center.y - H / 2 / zoom }, screenSize: { x: W, y: H }, layerMatrix: new Mat2D() };
  new Renderer(tex).render(c.getContext('2d')!, root, view, ed.project.background || '#000000', under);
  return c;
}

// ---------- thumbnails ----------

const thumbs = new Map<string, Promise<HTMLCanvasElement | null>>();

async function makeThumb(path: string, size: number): Promise<HTMLCanvasElement | null> {
  const kind = assetKind(path);
  let src: CanvasImageSource | null = null, w = 0, hh = 0;
  if (kind === 'image') { const img = await loadImage(projectUrl(path)); src = img; w = img.naturalWidth; hh = img.naturalHeight; }
  else if (kind === 'scene') { const pic = await renderScenePicture(parseScene((await api('fs/read', { path })).text)); src = pic; w = pic.width; hh = pic.height; }
  else if (kind === 'model') { const pic = await (await import('./preview3d')).modelThumbnail(path, size * 2); if (!pic) return null; src = pic; w = hh = size * 2; }
  if (!src) return null;
  const k = Math.min(size / w, size / hh);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w * k)); out.height = Math.max(1, Math.round(hh * k));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = k < 1 && kind !== 'image' ? true : k < 1; // shrink smoothly, enlarge pixel art crisply
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** A canvas that fills in with the file's thumbnail when it is ready (cached per file version). Null for kinds without pictures. */
export function thumbnail(path: string, size = 96): HTMLCanvasElement | null {
  const kind = assetKind(path);
  if (kind !== 'image' && kind !== 'scene' && kind !== 'model') return null;
  const mtime = ed.files.find((f) => f.path === path)?.mtime || 0;
  const key = `${path}|${mtime}|${size}`;
  if (!thumbs.has(key)) thumbs.set(key, makeThumb(path, size).catch(() => null));
  const c = h('canvas', { class: 'thumb-canvas', width: 1, height: 1 });
  thumbs.get(key)!.then((src) => {
    if (!src) { c.classList.add('none'); return; }
    c.width = src.width; c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
  });
  return c;
}

// ---------- the inspector's file preview ----------

function refList(title: string, items: { path: string; label: string }[]): HTMLElement | null {
  if (!items.length) return null;
  return h('div', { class: 'pv-refs' }, h('div', { class: 'pv-sub' }, title),
    items.map((it) => h('div', { class: 'pv-ref', title: it.path, onclick: () => inspectFile(it.path), ondblclick: () => openFile(it.path) },
      h('span', { class: 'icon' }, KIND_ICON[assetKind(it.path)]), h('span', { class: 'name' }, it.path.replace('res://', '')), h('span', { class: 'muted' }, it.label))));
}

/** Group "used by" edges per file: "Trees/Pine1 · model" ×7 becomes one line with a count. */
function grouped(edges: { path: string; label: string }[]) {
  const by = new Map<string, string[]>();
  for (const e of edges) by.set(e.path, [...(by.get(e.path) || []), e.label]);
  return [...by].map(([path, labels]) => ({ path, label: labels.length > 1 ? `${labels[0]} 외 ${labels.length - 1}곳` : labels[0] }));
}

function imagePreview(path: string, meta: HTMLElement): HTMLElement {
  const img = h('img', { class: 'pv-img', src: projectUrl(path) + '?t=' + (ed.files.find((f) => f.path === path)?.mtime || 0) });
  const box = h('div', { class: 'pv-stage checker' }, img);
  let zoom = 0; // 0 = fit
  const apply = () => {
    if (!img.naturalWidth) return;
    const fit = Math.min((box.clientWidth - 2) / img.naturalWidth, 220 / img.naturalHeight);
    const z = zoom || fit;
    img.style.width = img.naturalWidth * z + 'px';
    img.style.height = img.naturalHeight * z + 'px';
    zooms.forEach((b) => b.classList.toggle('on', +b.dataset.z! === zoom));
  };
  const zooms = [0, 1, 2, 4].map((z) => { const b = h('button', { class: 'tool', onclick: () => { zoom = z; apply(); } }, z ? `${z}x` : '맞춤'); b.dataset.z = String(z); return b; });
  img.onload = () => { meta.append(h('span', null, `${img.naturalWidth} × ${img.naturalHeight} px`)); apply(); };
  new ResizeObserver(apply).observe(box);
  return h('div', null, box, h('div', { class: 'pv-tools' }, zooms));
}

async function scenePreview(path: string, body: HTMLElement, meta: HTMLElement) {
  const root = parseScene((await api('fs/read', { path })).text);
  const count = new Map<string, number>();
  let total = 0;
  root.walk((n) => { total++; count.set(n.type, (count.get(n.type) || 0) + 1); });
  meta.append(h('span', null, `노드 ${total}개`));
  const pic = await renderScenePicture(root);
  pic.className = 'pv-scene';
  body.append(h('div', { class: 'pv-stage' }, pic),
    h('div', { class: 'pv-types' }, [...count].map(([t, n]) => h('span', { class: 'chip' }, `${nodeClass(t).icon} ${t}${n > 1 ? ' ×' + n : ''}`))),
    h('div', { class: 'pv-tools' }, h('button', { class: 'primary', onclick: () => openFile(path) }, '씬 열기')));
}

async function modelPreview(path: string, body: HTMLElement, meta: HTMLElement) {
  const c = h('canvas', { class: 'pv-model', width: 280, height: 210, title: '끌어서 돌려 보기' });
  body.append(h('div', { class: 'pv-stage checker' }, c));
  const info = await (await import('./preview3d')).modelViewer(path, c);
  if (!info) { body.append(h('div', { class: 'pv-error' }, '모델을 읽지 못했어요. .glb 또는 .gltf 파일인지 확인해 주세요.')); return; }
  const f = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));
  meta.append(h('span', null, `삼각형 ${Math.round(info.triangles).toLocaleString()}개`), h('span', null, `메시 ${info.meshes} · 재질 ${info.materials}`),
    h('span', null, `크기 ${f(info.size.x)} × ${f(info.size.y)} × ${f(info.size.z)} m`));
  const s = ed.current;
  body.append(h('div', { class: 'pv-tools' }, h('button', {
    disabled: !s, title: s ? '지금 열린 씬의 루트 아래에 MeshInstance3D로 넣어요' : '씬을 먼저 열어 주세요',
    onclick: () => {
      const n = nodeForAsset(path);
      if (!ed.current || !n) return;
      addNode(ed.current.root, n);
      toast('지금 씬에 넣었어요. 3D 화면에서 옮겨 보세요.');
    },
  }, '지금 씬에 넣기')));
}

async function textPreview(path: string, body: HTMLElement, meta: HTMLElement) {
  const text: string = (await api('fs/read', { path })).text;
  const lines = text.split('\n');
  meta.append(h('span', null, `${lines.length}줄`));
  body.append(h('pre', { class: 'pv-code' }, lines.slice(0, 80).join('\n') + (lines.length > 80 ? '\n…' : '')),
    h('div', { class: 'pv-tools' }, h('button', { class: 'primary', onclick: () => openFile(path) }, '편집기에서 열기')));
}

/** Everything the inspector shows for a file: a picture or player, facts about it, and what uses it / what it uses. */
export function createFilePreview(path: string, onClose: () => void): HTMLElement {
  const f = ed.files.find((x) => x.path === path);
  const kind = f ? assetKind(path, f.dir) : 'missing';
  const name = path.split('/').pop() || path;
  const meta = h('div', { class: 'pv-meta' }, h('span', null, KIND_LABEL[kind]), f?.size != null ? h('span', null, fmtSize(f.size)) : null,
    f?.mtime ? h('span', null, new Date(f.mtime).toLocaleString()) : null);
  const body = h('div', { class: 'pv-body' });
  const refs = h('div');
  const el = h('div', { class: 'file-preview' },
    h('div', { class: 'insp-head' }, h('span', { class: 'icon' }, KIND_ICON[kind]), h('b', { class: 'grow', title: path }, name),
      h('button', { class: 'icon-btn', title: '노드 속성으로 돌아가기', onclick: onClose }, '✕')),
    h('div', { class: 'pv-path' }, path), meta, body, refs);
  const fail = (e: Error) => body.append(h('div', { class: 'pv-error' }, e.message));
  if (kind === 'missing') body.append(h('div', { class: 'pv-error' }, '이 파일이 프로젝트에 없어요. 아래 파일들이 이 경로를 쓰고 있어요.'));
  else if (kind === 'image') body.append(imagePreview(path, meta));
  else if (kind === 'scene') scenePreview(path, body, meta).catch(fail);
  else if (kind === 'model') modelPreview(path, body, meta).catch(fail);
  else if (kind === 'audio') body.append(h('audio', { controls: true, src: projectUrl(path), class: 'wide' }));
  else if (kind !== 'folder' && kind !== 'other') textPreview(path, body, meta).catch(fail);
  getGraph().then((g) => {
    const usedBy = grouped(g.edges.filter((e) => e.to === path).map((e) => ({ path: e.from, label: e.label })));
    const uses = grouped(g.edges.filter((e) => e.from === path).map((e) => ({ path: e.to, label: e.label })));
    const node = g.nodes.find((n) => n.path === path);
    clear(refs);
    if (node && !node.used && kind !== 'project' && kind !== 'folder') refs.append(h('div', { class: 'pv-unused' }, '어디에서도 쓰지 않는 파일이에요.'));
    const a = refList('이 파일을 쓰는 곳', usedBy), b = refList('이 파일이 쓰는 것', uses);
    if (a) refs.append(a);
    if (b) refs.append(b);
  }).catch(() => {});
  return el;
}

/** Make a node for a dropped or chosen asset (used by the 3D view and previews). */
export function nodeForAsset(path: string): Node3D | null {
  const kind = assetKind(path);
  const name = path.split('/').pop()!.replace(/\.\w+$/, '');
  if (kind === 'model') { const n = createNode('MeshInstance3D', name) as MeshInstance3D; n.mesh = 'model'; n.model = path; return n; }
  if (kind === 'image') { const n = createNode('Sprite3D', name) as Sprite3D; n.texture = path; return n; }
  return null;
}
