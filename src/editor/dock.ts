import { h } from './ui';

// Panels that fill the window side by side, like Blender and Unity:
// - drag the line between two areas to resize them,
// - drag a tab onto the edge of an area to split it there, or onto its middle to join it as a tab,
// - ✕ closes a panel (open it again from the top bar).
// The layout is remembered in this browser.

export type Layout = { split: 'row' | 'col'; sizes: number[]; items: Layout[] } | { tabs: string[]; active: number };
type Tabs = Extract<Layout, { tabs: string[] }>;
type Split = Extract<Layout, { split: string }>;
type Zone = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface DockPanel {
  id: string;
  title: string;
  el: HTMLElement;
  /** False for the scene view: it can move but never close. */
  closable?: boolean;
}

const STORAGE = 'engine-editor-dock';

export class Dock {
  private panels = new Map<string, DockPanel>();
  private layout: Layout;
  private only: string | null = null;
  /** Called after the layout changes (e.g. to refresh the "open panel" list). */
  onChange = () => {};

  constructor(private root: HTMLElement, private defaults: () => Layout) {
    this.layout = defaults();
  }

  add(panel: DockPanel): void {
    this.panels.set(panel.id, panel);
  }

  /** Read the remembered layout (call after every panel is added). */
  load(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null') as Layout | null;
      if (saved && this.valid(saved)) this.layout = saved;
    } catch {
      /* use the default layout */
    }
    this.render();
  }

  reset(): void {
    this.layout = this.defaults();
    this.changed();
  }

  /** Show just one panel filling the window (play mode), or null for the normal layout. */
  showOnly(id: string | null): void {
    this.only = id;
    this.render();
  }

  /** Bring a panel to the front; a closed panel opens as a tab next to the first other panel. */
  show(id: string): void {
    const found = this.find(id);
    if (found) {
      found.active = found.tabs.indexOf(id);
    } else {
      const target = this.leaves().find((t) => !t.tabs.includes('view')) ?? this.leaves()[0];
      target.tabs.push(id);
      target.active = target.tabs.length - 1;
    }
    this.changed();
  }

  closed(): DockPanel[] {
    return [...this.panels.values()].filter((p) => !this.find(p.id));
  }

  // ---- drawing ----

  private render(): void {
    if (this.only) {
      const panel = this.panels.get(this.only)!;
      this.root.replaceChildren(h('div', { class: 'dk-body dk-only' }, panel.el));
      return;
    }
    this.root.replaceChildren(this.build(this.layout));
  }

  private build(node: Layout): HTMLElement {
    if ('tabs' in node) return this.buildTabs(node);
    const box = h('div', { class: `dk-split dk-${node.split}` });
    node.items.forEach((item, i) => {
      if (i > 0) box.append(this.gutter(node, i - 1, box));
      const cell = h('div', { class: 'dk-cell' }, this.build(item));
      cell.style.flex = `${node.sizes[i]} 1 0`;
      box.append(cell);
    });
    return box;
  }

  private buildTabs(node: Tabs): HTMLElement {
    node.active = Math.min(node.active, node.tabs.length - 1);
    const strip = h('div', { class: 'dk-tabs' });
    const area = h('div', { class: 'dk-area' }, strip);
    node.tabs.forEach((id, i) => {
      const panel = this.panels.get(id)!;
      const tab = h('div', { class: `dk-tab ${i === node.active ? 'dk-on' : ''}`, title: '끌어서 다른 곳에 붙이거나 나누기' }, panel.title);
      if (panel.closable !== false) {
        tab.append(h('button', { textContent: '✕', title: '닫기 (위쪽 "패널 열기"에서 다시 열어요)', onclick: () => this.close(id) }));
      }
      tab.addEventListener('pointerdown', (e) => this.dragTab(e, id, node, tab));
      strip.append(tab);
    });
    area.append(h('div', { class: 'dk-body' }, this.panels.get(node.tabs[node.active])!.el));
    (area as HTMLElement & { node?: Tabs }).node = node;
    return area;
  }

  /** The line between two areas: drag it to give one more room than the other. */
  private gutter(node: Split, i: number, box: HTMLElement): HTMLElement {
    const g = h('div', { class: 'dk-gutter' });
    g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      const row = node.split === 'row';
      const total = node.sizes[i] + node.sizes[i + 1];
      const length = row ? box.clientWidth : box.clientHeight;
      const sum = node.sizes.reduce((a, b) => a + b, 0);
      const start = { pos: row ? e.clientX : e.clientY, a: node.sizes[i] };
      const cells = [...box.children].filter((c) => c.classList.contains('dk-cell')) as HTMLElement[];
      const move = (m: PointerEvent) => {
        const delta = (((row ? m.clientX : m.clientY) - start.pos) / length) * sum;
        const min = total * 0.08;
        node.sizes[i] = Math.max(min, Math.min(total - min, start.a + delta));
        node.sizes[i + 1] = total - node.sizes[i];
        cells[i].style.flex = `${node.sizes[i]} 1 0`;
        cells[i + 1].style.flex = `${node.sizes[i + 1]} 1 0`;
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        this.save();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
    });
    return g;
  }

  // ---- moving tabs ----

  private dragTab(e: PointerEvent, id: string, from: Tabs, tab: HTMLElement): void {
    if (e.target instanceof HTMLButtonElement || e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    const marker = h('div', { class: 'dk-drop' });
    const label = h('div', { class: 'dk-ghost', textContent: this.panels.get(id)!.title });
    let target: { node: Tabs; zone: Zone } | null = null;
    tab.setPointerCapture(e.pointerId);

    const move = (m: PointerEvent) => {
      if (!dragging && Math.hypot(m.clientX - start.x, m.clientY - start.y) < 6) return;
      if (!dragging) {
        dragging = true;
        document.body.append(marker, label);
      }
      label.style.left = `${m.clientX + 12}px`;
      label.style.top = `${m.clientY + 8}px`;
      target = this.dropTarget(m.clientX, m.clientY, marker);
    };
    const up = () => {
      tab.removeEventListener('pointermove', move);
      tab.removeEventListener('pointerup', up);
      marker.remove();
      label.remove();
      if (!dragging) {
        from.active = from.tabs.indexOf(id);
        return this.changed();
      }
      if (target) this.moveTab(id, from, target.node, target.zone);
    };
    tab.addEventListener('pointermove', move);
    tab.addEventListener('pointerup', up);
  }

  /** Which area is under the pointer and which part of it (edges split, middle joins). Draws the blue hint. */
  private dropTarget(x: number, y: number, marker: HTMLElement): { node: Tabs; zone: Zone } | null {
    marker.style.display = 'none';
    const area = document.elementFromPoint(x, y)?.closest('.dk-area') as (HTMLElement & { node?: Tabs }) | null;
    if (!area?.node) return null;
    const r = area.getBoundingClientRect();
    const fx = (x - r.left) / r.width;
    const fy = (y - r.top) / r.height;
    const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
    let zone: Zone = 'center';
    if (edge < 0.25) zone = edge === fx ? 'left' : edge === 1 - fx ? 'right' : edge === fy ? 'top' : 'bottom';
    const box = { left: r.left, top: r.top, width: r.width, height: r.height };
    if (zone === 'left' || zone === 'right') box.width /= 2;
    if (zone === 'right') box.left += r.width / 2;
    if (zone === 'top' || zone === 'bottom') box.height /= 2;
    if (zone === 'bottom') box.top += r.height / 2;
    Object.assign(marker.style, { display: 'block', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    return { node: area.node, zone };
  }

  private moveTab(id: string, from: Tabs, to: Tabs, zone: Zone): void {
    if (from === to && (zone === 'center' || from.tabs.length === 1)) return;
    from.tabs.splice(from.tabs.indexOf(id), 1);
    if (zone === 'center') {
      to.tabs.push(id);
      to.active = to.tabs.length - 1;
    } else {
      const leaf: Tabs = { tabs: [id], active: 0 };
      const dir = zone === 'left' || zone === 'right' ? 'row' : 'col';
      const first = zone === 'left' || zone === 'top';
      const parent = this.parentOf(to);
      if (parent && parent.split === dir) {
        const i = parent.items.indexOf(to);
        const half = parent.sizes[i] / 2;
        parent.sizes[i] = half;
        parent.items.splice(first ? i : i + 1, 0, leaf);
        parent.sizes.splice(first ? i : i + 1, 0, half);
      } else {
        this.replace(to, { split: dir, sizes: [1, 1], items: first ? [leaf, to] : [to, leaf] });
      }
    }
    this.changed();
  }

  private close(id: string): void {
    const node = this.find(id);
    if (!node) return;
    node.tabs.splice(node.tabs.indexOf(id), 1);
    this.changed();
  }

  // ---- layout bookkeeping ----

  private changed(): void {
    this.layout = tidy(this.layout) ?? this.defaults();
    this.save();
    this.render();
    this.onChange();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(this.layout));
    } catch {
      /* layout just isn't remembered */
    }
  }

  private leaves(node: Layout = this.layout): Tabs[] {
    return 'tabs' in node ? [node] : node.items.flatMap((i) => this.leaves(i));
  }

  private find(id: string): Tabs | undefined {
    return this.leaves().find((t) => t.tabs.includes(id));
  }

  private parentOf(child: Layout, node: Layout = this.layout): Split | null {
    if ('tabs' in node) return null;
    if (node.items.includes(child)) return node;
    for (const item of node.items) {
      const p = this.parentOf(child, item);
      if (p) return p;
    }
    return null;
  }

  private replace(old: Layout, by: Layout): void {
    const parent = this.parentOf(old);
    if (parent) parent.items[parent.items.indexOf(old)] = by;
    else this.layout = by;
  }

  /** A remembered layout is usable if it shows the scene view once and only names known panels. */
  private valid(layout: Layout): boolean {
    const ids = this.leaves(layout).flatMap((t) => t.tabs);
    return ids.includes('view') && ids.every((id) => this.panels.has(id)) && new Set(ids).size === ids.length;
  }
}

/** Remove empty areas and splits that hold only one thing. */
function tidy(node: Layout): Layout | null {
  if ('tabs' in node) return node.tabs.length ? node : null;
  const kept: { item: Layout; size: number }[] = [];
  node.items.forEach((item, i) => {
    const t = tidy(item);
    if (!t) return;
    // A split inside a split going the same way becomes part of it.
    if ('split' in t && t.split === node.split) {
      const sum = t.sizes.reduce((a, b) => a + b, 0);
      t.items.forEach((sub, j) => kept.push({ item: sub, size: (node.sizes[i] * t.sizes[j]) / sum }));
    } else {
      kept.push({ item: t, size: node.sizes[i] });
    }
  });
  if (!kept.length) return null;
  if (kept.length === 1) return kept[0].item;
  return { split: node.split, sizes: kept.map((k) => k.size), items: kept.map((k) => k.item) };
}
