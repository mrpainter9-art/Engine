import { Node, Node2D, Sprite2D, Renderer, Textures, globalMatrix, viewMatrix, localMatrix, Mat2D, createNode, type View } from '../engine';
import { ed, on, select, setProp, addNode } from './state';
import { projectUrl } from './api';
import { h } from './ui';

export const textures = new Textures(projectUrl, () => redraw());
const renderer = new Renderer(textures);
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let pending = false;
let snap = true;
let zoomLabel: HTMLSpanElement;

export function redraw() {
  if (pending || !canvas) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(); });
}

function viewState() {
  const s = ed.current!;
  if (!s.view) fitView();
  return s.view!;
}

/** Zoom so the whole game screen fits the viewport. */
export function fitView() {
  const s = ed.current;
  if (!s || !canvas) return;
  const { width, height } = ed.project.viewport;
  const z = Math.max(0.1, Math.min((canvas.width - 40) / width, (canvas.height - 40) / height));
  s.view = { x: width / 2, y: height / 2, zoom: z >= 1 ? Math.floor(z) : z };
  redraw();
}

function view(): View {
  const v = viewState();
  const base: View = {
    center: { x: v.x, y: v.y }, zoom: v.zoom, width: canvas.width, height: canvas.height, time: 0, editor: true,
    parallaxOrigin: { x: 0, y: 0 }, screenSize: { x: ed.project.viewport.width, y: ed.project.viewport.height }, layerMatrix: new Mat2D(),
  };
  base.layerMatrix = viewMatrix(base);
  return base;
}

const texSize = (p: string) => textures.size(p);

/** Nodes in the order they are drawn, so the last hit is the one on top. */
function drawOrder(root: Node): Node[] {
  const out: Node[] = [];
  const visit = (n: Node) => {
    if ((n as Node2D).visible === false) return;
    out.push(n);
    [...n.children].sort((a, b) => ((a as Node2D).zIndex || 0) - ((b as Node2D).zIndex || 0)).forEach(visit);
  };
  visit(root);
  return out;
}

function pick(x: number, y: number): Node | null {
  const s = ed.current;
  if (!s) return null;
  const v = view();
  let hit: Node | null = null;
  for (const n of drawOrder(s.root)) {
    if (!(n instanceof Node2D)) continue;
    const b = n.localBounds(texSize);
    if (!b) continue;
    const p = globalMatrix(n, v).invert().apply({ x, y });
    if (p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h) hit = n;
  }
  return hit;
}

function draw() {
  const s = ed.current;
  const r = canvas.parentElement!.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!s) return;
  const v = view();
  const vm = viewMatrix(v);
  const { width: W, height: H } = ed.project.viewport;
  // grid
  const step = v.zoom * 16 >= 8 ? 16 : v.zoom * 64 >= 8 ? 64 : 256;
  const inv = vm.invert(), a = inv.apply({ x: 0, y: 0 }), b = inv.apply({ x: canvas.width, y: canvas.height });
  ctx.lineWidth = 1;
  for (let gx = Math.floor(a.x / step) * step; gx <= b.x; gx += step) {
    const x = Math.round(vm.apply({ x: gx, y: 0 }).x) + 0.5;
    ctx.strokeStyle = gx % (step * 8) === 0 ? '#2c323c' : '#232830';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let gy = Math.floor(a.y / step) * step; gy <= b.y; gy += step) {
    const y = Math.round(vm.apply({ x: 0, y: gy }).y) + 0.5;
    ctx.strokeStyle = gy % (step * 8) === 0 ? '#2c323c' : '#232830';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  // game screen
  const tl = vm.apply({ x: 0, y: 0 }), br = vm.apply({ x: W, y: H });
  ctx.fillStyle = ed.project.background || '#000000';
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  renderer.render(ctx, s.root, v, '');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  // axes and the game screen outline
  const o = vm.apply({ x: 0, y: 0 });
  ctx.strokeStyle = 'rgba(224,80,80,.7)'; ctx.beginPath(); ctx.moveTo(0, Math.round(o.y) + 0.5); ctx.lineTo(canvas.width, Math.round(o.y) + 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,200,90,.7)'; ctx.beginPath(); ctx.moveTo(Math.round(o.x) + 0.5, 0); ctx.lineTo(Math.round(o.x) + 0.5, canvas.height); ctx.stroke();
  ctx.strokeStyle = '#9b7ef0';
  ctx.strokeRect(Math.round(tl.x) + 0.5, Math.round(tl.y) + 0.5, Math.round(br.x - tl.x), Math.round(br.y - tl.y));
  // selection
  const sel = s.selected;
  if (sel instanceof Node2D) {
    const m = globalMatrix(sel, v);
    const bb = sel.localBounds(texSize);
    ctx.strokeStyle = '#ffa53c';
    ctx.lineWidth = 1.5;
    if (bb) {
      const pts = [{ x: bb.x, y: bb.y }, { x: bb.x + bb.w, y: bb.y }, { x: bb.x + bb.w, y: bb.y + bb.h }, { x: bb.x, y: bb.y + bb.h }].map((p) => m.apply(p));
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
    }
    const c = m.apply({ x: 0, y: 0 });
    ctx.beginPath(); ctx.moveTo(c.x - 6, c.y); ctx.lineTo(c.x + 6, c.y); ctx.moveTo(c.x, c.y - 6); ctx.lineTo(c.x, c.y + 6); ctx.stroke();
  }
  zoomLabel.textContent = Math.round(v.zoom * 100) + '%';
}

/** Parent-space matrix, to turn mouse movement into a position change for the dragged node. */
function parentMatrix(n: Node, v: View): Mat2D {
  return n.parent ? globalMatrix(n.parent, v) : viewMatrix(v);
}

export function createViewport(): HTMLElement {
  canvas = h('canvas', { class: 'vp-canvas', tabIndex: 0 });
  ctx = canvas.getContext('2d')!;
  zoomLabel = h('span', { class: 'muted' });
  const snapBtn = h('button', { class: 'tool on', title: '픽셀 단위로 맞추기', onclick: () => { snap = !snap; snapBtn.classList.toggle('on', snap); } }, '▦ 스냅');
  const toolbar = h('div', { class: 'vp-toolbar' },
    h('button', { class: 'tool on', title: '선택/이동 (끌어서 옮기기, 가운데 버튼이나 Space+끌기로 화면 이동)' }, '➤ 선택'),
    snapBtn,
    h('span', { class: 'grow' }),
    h('button', { class: 'tool', title: '100%', onclick: () => { const v = ed.current && viewState(); if (v) { v.zoom = 1; redraw(); } } }, '1:1'),
    h('button', { class: 'tool', title: '게임 화면 전체 보기', onclick: fitView }, '⤢ 맞춤'),
    zoomLabel);
  const empty = h('div', { class: 'vp-empty' }, '왼쪽 씬 패널에서 루트 노드를 만들거나, 파일시스템에서 씬을 열어 주세요.');
  const wrap = h('div', { class: 'vp-wrap' }, canvas, empty);

  let drag: null | { mode: 'pan' | 'move'; sx: number; sy: number; vx: number; vy: number; node?: Node2D; start?: { x: number; y: number }; inv?: Mat2D } = null;
  let space = false;
  const pos = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  canvas.addEventListener('mousedown', (e) => {
    if (!ed.current) return;
    canvas.focus();
    const p = pos(e), v = viewState();
    if (e.button === 1 || e.button === 2 || (e.button === 0 && space)) { drag = { mode: 'pan', sx: p.x, sy: p.y, vx: v.x, vy: v.y }; e.preventDefault(); return; }
    if (e.button !== 0) return;
    const sel = ed.current.selected;
    let target = pick(p.x, p.y);
    // keep dragging the selected node when clicking inside it, even if something else is drawn on top
    if (sel instanceof Node2D && target !== sel) {
      const bb = sel.localBounds(texSize), q = globalMatrix(sel, view()).invert().apply(p);
      if (bb && q.x >= bb.x && q.y >= bb.y && q.x <= bb.x + bb.w && q.y <= bb.y + bb.h) target = sel;
    }
    select(target || ed.current.root);
    if (target instanceof Node2D) drag = { mode: 'move', sx: p.x, sy: p.y, vx: 0, vy: 0, node: target, start: { ...target.position }, inv: parentMatrix(target, view()).invert() };
  });
  addEventListener('mousemove', (e) => {
    if (!drag || !ed.current) return;
    const p = pos(e);
    if (drag.mode === 'pan') {
      const v = viewState();
      v.x = drag.vx - (p.x - drag.sx) / v.zoom;
      v.y = drag.vy - (p.y - drag.sy) / v.zoom;
      redraw();
    } else if (drag.node && drag.inv && drag.start) {
      const a = drag.inv.apply({ x: drag.sx, y: drag.sy }), b = drag.inv.apply(p);
      // the node's own transform does not move with it, so parent space deltas are exact
      let x = drag.start.x + (b.x - a.x), y = drag.start.y + (b.y - a.y);
      if (snap) { x = Math.round(x); y = Math.round(y); }
      setProp(drag.node, 'position', { x, y });
    }
  });
  addEventListener('mouseup', () => { drag = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (!ed.current) return;
    e.preventDefault();
    const v = viewState(), p = pos(e);
    const before = view(), wp = viewMatrix(before).invert().apply(p);
    v.zoom = Math.min(32, Math.max(0.05, v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const after = viewMatrix(view()).apply(wp);
    v.x += (after.x - p.x) / v.zoom;
    v.y += (after.y - p.y) / v.zoom;
    redraw();
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    if (e.code === 'Space') space = true;
    const sel = ed.current?.selected;
    if (sel instanceof Node2D && e.key.startsWith('Arrow')) {
      const d = e.shiftKey ? 8 : 1;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      setProp(sel, 'position', { x: sel.position.x + dx, y: sel.position.y + dy });
      e.preventDefault();
    }
  });
  canvas.addEventListener('keyup', (e) => { if (e.code === 'Space') space = false; });
  // drop an image from the FileSystem dock to make a Sprite2D where it lands
  wrap.addEventListener('dragover', (e) => { if (ed.current) e.preventDefault(); });
  wrap.addEventListener('drop', (e) => {
    const path = e.dataTransfer?.getData('text/x-engine-path');
    const s = ed.current;
    if (!path || !s || !/\.(png|jpe?g|gif|webp)$/i.test(path)) return;
    e.preventDefault();
    const parent = s.selected && s.selected !== s.root && !(s.selected instanceof Sprite2D) ? s.selected : s.root;
    const sp = createNode('Sprite2D', path.split('/').pop()!.replace(/\.\w+$/, '')) as Sprite2D;
    sp.texture = path;
    const v = view();
    const local = globalMatrix(parent, v).mul(localMatrix(sp, v)).invert().apply(pos(e));
    sp.position = { x: Math.round(local.x), y: Math.round(local.y) };
    addNode(parent, sp);
  });

  new ResizeObserver(() => redraw()).observe(wrap);
  const sync = () => { empty.hidden = !!ed.current; redraw(); };
  on('scene', sync); on('selection', redraw); on('scenes', sync); on('project', redraw);
  return h('div', { class: 'viewport' }, toolbar, wrap);
}
