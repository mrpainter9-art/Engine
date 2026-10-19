import { h } from './ui';

// Floating panels over the scene: drag the title bar to move, drag the bottom-right corner to resize,
// ▾ to fold. Where each panel sits is remembered in this browser.

const LAYOUT = 'engine-editor-layout';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  folded?: boolean;
}

export interface PanelSpec {
  id: string;
  title: string;
  content: HTMLElement;
  /** Where it starts, given the size of the area it floats in. */
  place(areaW: number, areaH: number): Rect;
}

export class Panels {
  private wins = new Map<string, { el: HTMLElement; spec: PanelSpec }>();

  constructor(private area: HTMLElement) {
    new ResizeObserver(() => this.keepInside()).observe(area);
  }

  add(spec: PanelSpec): void {
    const head = h('div', { class: 'ed-win-head' }, h('b', { textContent: spec.title }));
    const fold = h('button', { textContent: '▾', title: '접기 / 펴기' });
    head.append(fold);
    const grip = h('div', { class: 'ed-win-grip', title: '끌어서 크기 바꾸기' });
    const el = h('div', { class: 'ed-win' }, head, h('div', { class: 'ed-win-body' }, spec.content), grip);
    this.area.append(el);
    this.wins.set(spec.id, { el, spec });
    this.apply(spec.id, this.saved()[spec.id] ?? spec.place(this.area.clientWidth, this.area.clientHeight));

    fold.onclick = () => {
      el.classList.toggle('ed-folded');
      fold.textContent = el.classList.contains('ed-folded') ? '▸' : '▾';
      this.save();
    };
    // Title bar moves the panel, the bottom-right corner resizes it.
    this.dragging(head, el, (r, dx, dy) => ({ ...r, x: r.x + dx, y: r.y + dy }));
    this.dragging(grip, el, (r, dx, dy) => ({ ...r, w: Math.max(160, r.w + dx), h: Math.max(80, r.h + dy) }));
  }

  private dragging(handle: HTMLElement, el: HTMLElement, change: (r: Rect, dx: number, dy: number) => Rect): void {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY, rect: rectOf(el) };
      handle.setPointerCapture(e.pointerId);
      const move = (m: PointerEvent) => {
        const r = change(start.rect, m.clientX - start.x, m.clientY - start.y);
        Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
        this.keepInside();
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        this.save();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  /** Put every panel back where it started. */
  reset(): void {
    for (const [id, { spec }] of this.wins) this.apply(id, spec.place(this.area.clientWidth, this.area.clientHeight));
    this.save();
  }

  private apply(id: string, r: Rect): void {
    const { el } = this.wins.get(id)!;
    Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    el.classList.toggle('ed-folded', !!r.folded);
    el.querySelector('.ed-win-head button')!.textContent = r.folded ? '▸' : '▾';
    this.keepInside();
  }

  /** Never let a panel's title bar leave the area, so it can always be grabbed again. */
  private keepInside(): void {
    const { clientWidth: aw, clientHeight: ah } = this.area;
    if (!aw || !ah) return;
    for (const { el } of this.wins.values()) {
      const r = rectOf(el);
      el.style.left = `${Math.max(0, Math.min(aw - 60, r.x))}px`;
      el.style.top = `${Math.max(0, Math.min(ah - 28, r.y))}px`;
    }
  }

  private save(): void {
    const data: Record<string, Rect> = {};
    for (const [id, { el }] of this.wins) data[id] = { ...rectOf(el), folded: el.classList.contains('ed-folded') };
    try {
      localStorage.setItem(LAYOUT, JSON.stringify(data));
    } catch {
      /* layout just isn't remembered */
    }
  }

  private saved(): Record<string, Rect> {
    try {
      return JSON.parse(localStorage.getItem(LAYOUT) ?? '{}');
    } catch {
      return {};
    }
  }
}

/** A panel's place and size as written on it (works while hidden, unlike measuring it). */
function rectOf(el: HTMLElement): Rect {
  return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0, w: parseFloat(el.style.width) || 200, h: parseFloat(el.style.height) || 300 };
}
