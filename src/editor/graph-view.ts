import { ed, on, inspectFile, refreshFiles } from './state';
import { h, clear } from './ui';
import { getGraph, type Graph, type GraphNode, type GraphEdge, type GraphKind } from './graph-data';
import { thumbnail, fmtSize, KIND_ICON, KIND_LABEL } from './preview';
import { openFile } from './open-file';

// The "연결" tab: every file of the project is a card, and a line runs from each place that uses a file
// (a node in a scene, a line in a script) to that file. Columns follow the usual flow: project → scenes → scripts → assets.
// Cards can be dragged; their places are remembered per project (localStorage).

export const KIND_COLOR: Record<GraphKind, string> = {
  project: '#a8b2c2', scene: '#70bafa', script: '#ffd166', image: '#7ad67a', model: '#d79bff',
  audio: '#ff9f6b', data: '#6fd6c9', other: '#8f99a8', missing: '#ff6b6b',
};
const COLUMN: Record<GraphKind, number> = { project: 0, scene: 1, script: 2, image: 3, model: 3, audio: 3, data: 3, other: 3, missing: 4 };
const CARD_W = 210, GAP_X = 120, GAP_Y = 18;
const SVG = 'http://www.w3.org/2000/svg';

interface Row { to: string; el: HTMLElement }
interface Card { node: GraphNode; el: HTMLElement; head: HTMLElement; rows: Row[]; x: number; y: number }
type Pos = Record<string, [number, number]>;

const storeKey = () => 'engine.graph.' + (ed.projectName || 'project');
function loadPos(): Pos { try { return JSON.parse(localStorage.getItem(storeKey()) || '{}'); } catch { return {}; } }
function savePos(cards: Map<string, Card>) {
  try { localStorage.setItem(storeKey(), JSON.stringify(Object.fromEntries([...cards].map(([p, c]) => [p, [Math.round(c.x), Math.round(c.y)]])))); } catch { /* storage off */ }
}

/** One row per file used: seven pine trees using pine.glb become one row "Pine1 · model 외 6곳". */
function groupOut(edges: GraphEdge[]): { to: string; labels: string[] }[] {
  const by = new Map<string, string[]>();
  for (const e of edges) by.set(e.to, [...(by.get(e.to) || []), e.label]);
  return [...by].map(([to, labels]) => ({ to, labels }));
}

/** Columns by kind, ordered with a few barycenter sweeps so lines cross less, each column centred on the tallest. */
function autoLayout(nodes: GraphNode[], edges: GraphEdge[], height: (p: string) => number): Map<string, { x: number; y: number }> {
  const cols = [...new Set(nodes.map((n) => COLUMN[n.kind]))].sort((a, b) => a - b)
    .map((c) => nodes.filter((n) => COLUMN[n.kind] === c).sort((a, b) => a.path.localeCompare(b.path)));
  const col = new Map<string, number>(), rank = new Map<string, number>();
  const index = () => cols.forEach((c, ci) => c.forEach((n, i) => { col.set(n.path, ci); rank.set(n.path, (i + 0.5) / c.length); }));
  index();
  const near = new Map<string, string[]>();
  for (const e of edges) { near.set(e.from, [...(near.get(e.from) || []), e.to]); near.set(e.to, [...(near.get(e.to) || []), e.from]); }
  for (let pass = 0; pass < 4; pass++)
    for (const c of cols) {
      const key = new Map(c.map((n) => {
        const o = (near.get(n.path) || []).filter((p) => col.has(p) && col.get(p) !== col.get(n.path));
        return [n.path, o.length ? o.reduce((s, p) => s + rank.get(p)!, 0) / o.length : rank.get(n.path)!];
      }));
      c.sort((a, b) => key.get(a.path)! - key.get(b.path)!);
      index();
    }
  const colH = cols.map((c) => c.reduce((s, n) => s + height(n.path) + GAP_Y, -GAP_Y));
  const maxH = Math.max(...colH);
  const out = new Map<string, { x: number; y: number }>();
  cols.forEach((c, ci) => {
    let y = (maxH - colH[ci]) / 2;
    for (const n of c) { out.set(n.path, { x: ci * (CARD_W + GAP_X), y }); y += height(n.path) + GAP_Y; }
  });
  return out;
}

export function createGraphView(): HTMLElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.classList.add('graph-edges');
  const world = h('div', { class: 'graph-world' });
  world.append(svg);
  const note = h('div', { class: 'vp-empty' }, '연결 정보를 읽는 중…');
  const legend = h('div', { class: 'graph-legend' });
  const wrap = h('div', { class: 'graph-wrap' }, world, note, legend,
    h('div', { class: 'graph-hint' }, '클릭: 미리보기 · 두 번 클릭: 열기 · 카드 끌기: 옮기기 · 빈 곳 끌기: 화면 이동 · 휠: 확대'));
  const search = h('input', { type: 'search', placeholder: '파일 찾기', class: 'graph-search' });
  const stats = h('span', { class: 'muted graph-stats' });
  const unusedBtn = h('button', { class: 'tool', title: '어디에서도 쓰지 않는 파일만 밝게 보기' });
  const toolbar = h('div', { class: 'vp-toolbar' },
    h('button', { class: 'tool', title: '파일을 다시 읽어서 새로 그리기', onclick: () => refreshFiles() }, '⟳'),
    h('button', { class: 'tool', title: '카드를 종류별 줄로 다시 놓기', onclick: () => arrange() }, '자동 정렬'),
    h('button', { class: 'tool', title: '전체가 보이게 맞추기', onclick: () => fit() }, '⌖ 맞춤'),
    h('span', { class: 'sep-v' }), search, unusedBtn, stats);

  let graph: Graph | null = null;
  const cards = new Map<string, Card>();
  const view = { x: 40, y: 40, zoom: 1 };
  let selected = '', onlyUnused = false, stale = true, fitted = false, token = 0;
  let lastClick = { path: '', at: 0 };

  const applyView = () => {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    wrap.style.backgroundSize = `${24 * view.zoom}px ${24 * view.zoom}px`;
    wrap.style.backgroundPosition = `${view.x}px ${view.y}px`;
  };
  const place = (c: Card) => { c.el.style.left = c.x + 'px'; c.el.style.top = c.y + 'px'; };

  const build = (g: Graph) => {
    for (const c of cards.values()) c.el.remove();
    cards.clear();
    const kindOf = new Map(g.nodes.map((n) => [n.path, n.kind]));
    for (const n of g.nodes) {
      const name = n.path.split('/').pop() || n.path;
      const folder = n.path.slice(6, Math.max(6, n.path.length - name.length - 1));
      const unused = !n.used && n.kind !== 'project';
      const head = h('div', { class: 'gc-head' }, h('span', { class: 'gc-port in' }), h('span', { class: 'icon' }, KIND_ICON[n.kind]), h('span', { class: 'gc-name' }, name),
        n.kind === 'missing' ? h('span', { class: 'gc-badge' }, '없는 파일') : unused ? h('span', { class: 'gc-badge' }, '안 씀') : null);
      const thumb = n.kind === 'missing' ? null : thumbnail(n.path, 180);
      const rows = groupOut(g.edges.filter((e) => e.from === n.path)).map(({ to, labels }) => {
        const el = h('div', { class: 'gc-row', title: `${labels.join('\n')}\n→ ${to}` },
          h('span', { class: 'gc-label' }, labels.length > 1 ? `${labels[0]} 외 ${labels.length - 1}곳` : labels[0]),
          h('span', { class: 'gc-to' }, to.split('/').pop()), h('span', { class: 'gc-port out' }));
        el.style.setProperty('--k', KIND_COLOR[kindOf.get(to) || 'missing']);
        el.dataset.to = to;
        return { to, el };
      });
      const el = h('div', { class: 'gcard' + (n.kind === 'missing' ? ' missing' : unused ? ' unused' : ''), title: n.path },
        head, h('div', { class: 'gc-sub' }, `${folder ? folder + '/' : 'res://'} · ${KIND_LABEL[n.kind]}${n.size != null ? ' · ' + fmtSize(n.size) : ''}`),
        thumb && h('div', { class: 'gc-thumb' + (n.kind === 'image' ? ' pixel' : '') }, thumb),
        rows.length ? h('div', { class: 'gc-rows' }, rows.map((r) => r.el)) : null);
      el.style.setProperty('--k', KIND_COLOR[n.kind]);
      el.dataset.path = n.path;
      world.append(el);
      cards.set(n.path, { node: n, el, head, rows, x: 0, y: 0 });
    }
    const kinds = [...new Set(g.nodes.map((n) => n.kind))].sort((a, b) => COLUMN[a] - COLUMN[b]);
    clear(legend).append(...kinds.map((k) => { const s = h('span', null, h('i'), KIND_LABEL[k]); s.style.setProperty('--k', KIND_COLOR[k]); return s; }));
    const unused = g.nodes.filter((n) => !n.used && n.kind !== 'project').length;
    const missing = g.nodes.filter((n) => n.kind === 'missing').length;
    unusedBtn.textContent = `안 쓰는 파일 ${unused}`;
    unusedBtn.disabled = !unused;
    if (!unused) onlyUnused = false;
    unusedBtn.classList.toggle('on', onlyUnused);
    clear(stats).append(`파일 ${g.nodes.length - missing} · 연결 ${g.edges.length}`, missing ? h('span', { class: 'err' }, ` · 없는 파일 ${missing}`) : '');
  };

  /** Saved places first; files added since then go under the last card of their column. */
  const layout = (fresh: boolean) => {
    if (!graph) return;
    const saved = fresh ? {} : loadPos();
    const auto = autoLayout(graph.nodes, graph.edges, (p) => cards.get(p)!.el.offsetHeight);
    const placed: Card[] = [], rest: Card[] = [];
    for (const c of cards.values()) { const s = saved[c.node.path]; if (s) { [c.x, c.y] = s; placed.push(c); } else rest.push(c); }
    rest.sort((a, b) => auto.get(a.node.path)!.y - auto.get(b.node.path)!.y);
    for (const c of rest) {
      const a = auto.get(c.node.path)!;
      c.x = a.x;
      c.y = placed.length ? placed.filter((p) => Math.abs(p.x - a.x) < CARD_W).reduce((m, p) => Math.max(m, p.y + p.el.offsetHeight + GAP_Y), a.y) : a.y;
      if (placed.length) placed.push(c);
    }
    cards.forEach(place);
  };

  /** A lane for a line that runs right-to-left (a script opening a scene): above or below the cards in the way, whichever is nearer. */
  const lane = (xa: number, xb: number, top: number, bottom: number, mid: number) => {
    const hit = (y: number) => [...cards.values()].find((k) => k.x < xb && k.x + k.el.offsetWidth > xa && k.y - 8 < y && k.y + k.el.offsetHeight + 8 > y);
    let up = top - 16, down = bottom + 16;
    for (let i = 0, k; i < 50 && (k = hit(up)); i++) up = k.y - 16;
    for (let i = 0, k; i < 50 && (k = hit(down)); i++) down = k.y + k.el.offsetHeight + 16;
    return mid - up <= down - mid ? up : down;
  };

  const edgePath = (c: Card, t: Card, x1: number, y1: number, x2: number, y2: number) => {
    if (x2 >= x1 + 40) { const dx = Math.max(50, (x2 - x1) * 0.5); return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`; }
    const y = lane(x2 - 30, x1 + 30, Math.min(c.y, t.y), Math.max(c.y + c.el.offsetHeight, t.y + t.el.offsetHeight), (y1 + y2) / 2);
    const k1 = Math.min(60, Math.abs(y - y1) / 2 + 20), k2 = Math.min(60, Math.abs(y - y2) / 2 + 20);
    return `M${x1} ${y1} C${x1 + k1} ${y1} ${x1 + k1} ${y} ${x1} ${y} L${x2} ${y} C${x2 - k2} ${y} ${x2 - k2} ${y2} ${x2} ${y2}`;
  };

  const drawEdges = () => {
    while (svg.firstChild) svg.firstChild.remove();
    for (const c of cards.values()) {
      const w = c.el.offsetWidth, top = c.el.clientTop;
      for (const r of c.rows) {
        const t = cards.get(r.to);
        if (!t) continue;
        const x1 = c.x + w, y1 = c.y + top + r.el.offsetTop + r.el.offsetHeight / 2;
        const x2 = t.x, y2 = t.y + t.el.clientTop + t.head.offsetTop + t.head.offsetHeight / 2;
        const p = document.createElementNS(SVG, 'path');
        p.setAttribute('d', edgePath(c, t, x1, y1, x2, y2));
        p.setAttribute('stroke', KIND_COLOR[t.node.kind]);
        const hot = !!selected && (c.node.path === selected || r.to === selected);
        p.setAttribute('class', 'edge' + (hot ? ' hot' : selected || onlyUnused ? ' dim' : ''));
        const tip = document.createElementNS(SVG, 'title');
        tip.textContent = `${c.node.path.slice(6)} → ${r.to.slice(6)}`;
        p.append(tip);
        svg.append(p);
      }
    }
  };

  /** Selection, search and the unused filter all show as fading the cards that don't matter right now. */
  const paint = () => {
    const q = search.value.trim().toLowerCase();
    const near = new Set<string>();
    for (const e of graph?.edges || []) { if (e.from === selected) near.add(e.to); if (e.to === selected) near.add(e.from); }
    for (const c of cards.values()) {
      const p = c.node.path;
      c.el.classList.toggle('sel', p === selected);
      const off = (!!selected && p !== selected && !near.has(p)) || (onlyUnused && c.node.used) || (!!q && !p.toLowerCase().includes(q));
      c.el.classList.toggle('faded', off);
    }
    drawEdges();
  };

  /** Zoom and pan so every card shows. False when the view has no size yet (hidden). */
  const fit = (): boolean => {
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!cards.size || !W || !H) return false;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cards.values()) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.el.offsetWidth); y1 = Math.max(y1, c.y + c.el.offsetHeight); }
    const z = Math.max(0.25, Math.min(1, (W - 48) / (x1 - x0), (H - 48) / (y1 - y0)));
    view.zoom = z;
    view.x = Math.max(24, (W - (x1 - x0) * z) / 2) - x0 * z;
    view.y = Math.max(24, (H - (y1 - y0) * z) / 2) - y0 * z;
    applyView();
    return true;
  };

  /** Pan just enough to bring a card into view (centred). */
  const reveal = (path: string) => {
    const c = cards.get(path);
    if (!c) return;
    const W = wrap.clientWidth, H = wrap.clientHeight, w = c.el.offsetWidth, hh = c.el.offsetHeight;
    const sx = view.x + c.x * view.zoom, sy = view.y + c.y * view.zoom;
    if (sx >= 0 && sy >= 0 && sx + w * view.zoom <= W && sy + hh * view.zoom <= H) return;
    view.x = W / 2 - (c.x + w / 2) * view.zoom;
    view.y = H / 2 - (c.y + hh / 2) * view.zoom;
    applyView();
  };

  const choose = (path: string) => {
    selected = path;
    paint();
    if (ed.inspectFile !== path) inspectFile(path);
  };

  const arrange = () => {
    try { localStorage.removeItem(storeKey()); } catch { /* storage off */ }
    layout(true);
    paint();
    fit();
  };

  const refresh = async () => {
    const my = ++token;
    stale = false;
    let g: Graph;
    try { g = await getGraph(); }
    catch (e) { if (my === token) { note.hidden = false; note.textContent = '연결 정보를 읽지 못했어요: ' + (e as Error).message; } return; }
    if (my !== token) return;
    graph = g;
    build(g);
    note.hidden = g.nodes.length > 0;
    note.textContent = '프로젝트에 파일이 없어요.';
    layout(false);
    if (selected && !cards.has(selected)) selected = '';
    if (!selected && cards.has(ed.inspectFile)) selected = ed.inspectFile;
    paint();
    if (!fitted) fitted = fit();
  };

  wrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    const cardEl = e.button === 0 ? target.closest<HTMLElement>('.gcard') : null;
    const card = cardEl ? cards.get(cardEl.dataset.path!) : undefined;
    const row = card ? target.closest<HTMLElement>('.gc-row') : null;
    const x0 = e.clientX, y0 = e.clientY, vx = view.x, vy = view.y, cx = card?.x ?? 0, cy = card?.y ?? 0;
    let moved = false;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      if (!moved && card) world.append(card.el); // dragged card on top
      moved = true;
      if (card) { card.x = cx + (ev.clientX - x0) / view.zoom; card.y = cy + (ev.clientY - y0) / view.zoom; place(card); drawEdges(); }
      else { wrap.classList.add('panning'); view.x = vx + ev.clientX - x0; view.y = vy + ev.clientY - y0; applyView(); }
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      wrap.classList.remove('panning');
      if (moved) { if (card) savePos(cards); return; }
      if (e.button !== 0) return;
      const path = row ? row.dataset.to! : card ? card.node.path : '';
      const now = performance.now();
      if (path && lastClick.path === path && now - lastClick.at < 400) { lastClick = { path: '', at: 0 }; if (card?.node.kind !== 'missing' || row) openFile(path); return; }
      lastClick = { path, at: now };
      choose(path);
      if (row) reveal(path);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });

  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const z = Math.max(0.25, Math.min(2, view.zoom * Math.exp(-e.deltaY * 0.0015)));
    view.x = mx - ((mx - view.x) * z) / view.zoom;
    view.y = my - ((my - view.y) * z) / view.zoom;
    view.zoom = z;
    applyView();
  }, { passive: false });

  search.addEventListener('input', paint);
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = search.value.trim().toLowerCase();
    const hit = [...cards.keys()].find((p) => p.toLowerCase().includes(q));
    if (q && hit) { choose(hit); reveal(hit); }
  });
  unusedBtn.addEventListener('click', () => { onlyUnused = !onlyUnused; unusedBtn.classList.toggle('on', onlyUnused); paint(); });

  // the graph is only built while it is on screen (cards are measured); otherwise it just notes that it is out of date
  on('files', () => { stale = true; if (ed.tab === 'graph') refresh(); });
  on('project', () => { stale = true; fitted = false; });
  on('tab', () => { if (ed.tab === 'graph') requestAnimationFrame(() => { if (stale || !graph) refresh(); else paint(); }); });
  on('inspect', () => {
    const p = cards.has(ed.inspectFile) ? ed.inspectFile : '';
    if (p === selected) return;
    selected = p;
    if (ed.tab === 'graph') { paint(); if (p) reveal(p); }
  });
  new ResizeObserver(() => { if (ed.tab === 'graph' && graph && !fitted) fitted = fit(); }).observe(wrap);
  applyView();

  return h('div', { class: 'center-view graph-view' }, toolbar, wrap);
}
