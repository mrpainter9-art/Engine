// Small helpers to build the editor's panels out of plain page elements.

type Child = Node | string | null | false | undefined;

/** Make an element: h('button', { class: 'x', onclick }, 'text'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & { class?: string; style?: string; title?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  const { class: cls, style, ...rest } = props;
  if (cls) e.className = cls;
  if (style) e.setAttribute('style', style);
  Object.assign(e, rest);
  for (const c of children) if (c !== null && c !== false && c !== undefined) e.append(c);
  return e;
}

/** A labeled row: "빠르기 [ 90 ]". */
export function row(label: string, input: HTMLElement, hint = ''): HTMLElement {
  return h('label', { class: 'ed-row', title: hint }, h('span', {}, label), input);
}

/** Number box. Empty = undefined (use the usual value, shown greyed as placeholder). */
export function numberInput(value: number | undefined, onChange: (v: number | undefined) => void, placeholder = ''): HTMLInputElement {
  const input = h('input', { type: 'number', value: value === undefined ? '' : String(value), placeholder });
  input.addEventListener('change', () => onChange(input.value === '' ? undefined : Number(input.value)));
  return input;
}

export function textInput(value: string | undefined, onChange: (v: string) => void, placeholder = ''): HTMLInputElement {
  const input = h('input', { type: 'text', value: value ?? '', placeholder });
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

export function checkInput(value: boolean, onChange: (v: boolean) => void): HTMLInputElement {
  const input = h('input', { type: 'checkbox', checked: value });
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

/** Drop-down list. options: [value, shown text]. */
export function selectInput(options: [string, string][], value: string, onChange: (v: string) => void): HTMLSelectElement {
  const select = h('select', {}, ...options.map(([v, text]) => h('option', { value: v, textContent: text, selected: v === value })));
  if (!options.some(([v]) => v === value)) select.prepend(h('option', { value, textContent: value || '(없음)', selected: true }));
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

/** A button that asks "정말?" on the first press and acts on the second (no pop-up windows needed). */
export function confirmButton(text: string, onConfirm: () => void): HTMLButtonElement {
  const b = h('button', { class: 'ed-danger', textContent: text });
  let armed = false;
  b.onclick = () => {
    if (armed) return onConfirm();
    armed = true;
    b.textContent = '정말요? 한 번 더 누르기';
    setTimeout(() => {
      armed = false;
      b.textContent = text;
    }, 3000);
  };
  return b;
}

/** Small picture of the first frame of an image, for lists. */
export function thumbnail(img: HTMLImageElement | null, frames = 1, size = 28): HTMLCanvasElement {
  const c = h('canvas', { width: size, height: size, class: 'ed-thumb' });
  if (!img) return c;
  const w = Math.floor(img.width / Math.max(1, frames));
  const zoom = Math.max(1, Math.floor(size / Math.max(w, img.height)));
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const dw = Math.min(size, w * zoom);
  const dh = Math.min(size, img.height * zoom);
  g.drawImage(img, 0, 0, w, img.height, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return c;
}

export const STYLE = `
#ed-center { flex: 1; min-width: 0; display: flex; flex-direction: column; }
#ed-dock { flex: 1; min-height: 0; display: flex; }
#ed-dock > * { flex: 1; min-width: 0; min-height: 0; }
.ed-panel { color: #ddd; font: 13px system-ui, sans-serif; min-height: 100%; display: flex; flex-direction: column; }
.dk-split { display: flex; min-width: 0; min-height: 0; }
.dk-row { flex-direction: row; }
.dk-col { flex-direction: column; }
.dk-cell { display: flex; min-width: 0; min-height: 0; overflow: hidden; }
.dk-cell > * { flex: 1; min-width: 0; min-height: 0; }
.dk-gutter { flex: none; background: #111; }
.dk-row > .dk-gutter { width: 4px; cursor: col-resize; }
.dk-col > .dk-gutter { height: 4px; cursor: row-resize; }
.dk-gutter:hover { background: #4c6ef5; }
.dk-area { display: flex; flex-direction: column; background: #1e1e26; min-width: 0; min-height: 0; }
.dk-tabs { display: flex; flex: none; background: #26262f; border-bottom: 1px solid #333; overflow: hidden; }
.dk-tab { display: flex; align-items: center; gap: 6px; padding: 5px 10px; color: #999; font: 12px system-ui, sans-serif; cursor: grab;
  user-select: none; border-right: 1px solid #333; white-space: nowrap; }
.dk-tab.dk-on { color: #fff; background: #1e1e26; box-shadow: inset 0 2px #6c8cff; }
.dk-tab button { background: none; border: 0; color: #777; cursor: pointer; padding: 0; font-size: 11px; }
.dk-tab button:hover { color: #fff; }
.dk-body { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
.dk-body > * { flex: 1; }
.dk-body > #stage { overflow: hidden; background: #111; }
.dk-only { height: 100%; }
.dk-drop { position: fixed; display: none; background: rgba(76, 110, 245, 0.25); border: 2px solid #4c6ef5; pointer-events: none; z-index: 10; }
.dk-ghost { position: fixed; padding: 3px 8px; background: #3b5bdb; color: #fff; font: 12px system-ui, sans-serif; border-radius: 4px; pointer-events: none; z-index: 11; }
#ed-bar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; background: #1e1e26; color: #ddd; font: 13px system-ui, sans-serif; border-bottom: 1px solid #333; flex-wrap: wrap; }
#ed-bar .ed-status { margin-left: auto; color: #aaa; }
#ed-bar .ed-status.ed-unsaved { color: #f2c14e; }
.ed-editing canvas { cursor: default; }
.ed-panel h3 { margin: 10px 10px 4px; font-size: 12px; color: #999; font-weight: 600; }
.ed-tool { display: flex; align-items: center; gap: 8px; padding: 3px 10px; cursor: pointer; }
.ed-tool:hover { background: #2a2a35; }
.ed-tool.ed-on { background: #3b4a7a; }
.ed-thumb { image-rendering: pixelated; background: #2a2a35; border-radius: 3px; flex: none; }
.ed-help { margin: auto 10px 10px; color: #888; font-size: 12px; line-height: 1.6; }
.ed-body { padding: 4px 10px 16px; }
.ed-body > select, .ed-body > input { width: 100%; box-sizing: border-box; margin: 4px 0; }
.ed-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
.ed-row > span { width: 92px; flex: none; color: #aaa; }
.ed-row input[type=number], .ed-row input[type=text], .ed-row select, .ed-row textarea { flex: 1; min-width: 0; }
.ed-panel input, .ed-panel select, .ed-panel textarea, #ed-bar select, #ed-bar input { background: #111; color: #eee; border: 1px solid #444; border-radius: 3px; padding: 3px 5px; font: inherit; }
.ed-panel button, #ed-bar button { background: #2f2f3b; color: #eee; border: 1px solid #444; border-radius: 4px; padding: 4px 9px; font: inherit; cursor: pointer; }
.ed-panel button:hover, #ed-bar button:hover { background: #3a3a48; }
#ed-bar button.ed-primary { background: #3b5bdb; border-color: #4c6ef5; }
button.ed-danger { color: #ff9a9a !important; }
.ed-card { border: 1px solid #383848; border-radius: 6px; padding: 6px 8px; margin: 8px 0; background: #23232d; }
.ed-card-head { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; flex-wrap: wrap; }
.ed-card-head b { flex: 1 1 auto; min-width: 70px; }
.ed-card-head small { color: #888; }
.ed-card-head button { padding: 1px 6px !important; }
.ed-note { color: #888; font-size: 12px; margin: 6px 0; line-height: 1.5; }
.ed-buttons { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
`;
