// Tiny DOM helpers: h() builds elements, plus in-page dialogs, a context menu and toasts (no framework).
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, any> | null;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export const clear = (el: HTMLElement) => { while (el.firstChild) el.firstChild.remove(); return el; };

/** Modal dialog. Resolves with the clicked button's value (or null when closed). */
export function dialog<T = string>(title: string, body: Child, buttons: { label: string; value: T; primary?: boolean }[], opts: { width?: number; onOpen?: (box: HTMLElement) => void } = {}): Promise<T | null> {
  return new Promise((resolve) => {
    const close = (v: T | null) => { back.remove(); removeEventListener('keydown', key, true); resolve(v); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { const p = buttons.find((b) => b.primary); if (p) { e.preventDefault(); close(p.value); } }
    };
    const box = h('div', { class: 'dlg', style: { width: (opts.width || 380) + 'px' } },
      h('div', { class: 'dlg-title' }, title, h('button', { class: 'x', title: '닫기', onclick: () => close(null) }, '✕')),
      h('div', { class: 'dlg-body' }, body),
      h('div', { class: 'dlg-buttons' }, buttons.map((b) => h('button', { class: b.primary ? 'primary' : '', onclick: () => close(b.value) }, b.label))));
    const back = h('div', { class: 'dlg-back', onmousedown: (e: MouseEvent) => { if (e.target === back) close(null); } }, box);
    document.body.append(back);
    addEventListener('keydown', key, true);
    opts.onOpen?.(box);
    (box.querySelector('input,textarea,select') as HTMLElement | null)?.focus();
  });
}

export async function ask(title: string, label: string, value = ''): Promise<string | null> {
  const input = h('input', { type: 'text', value, class: 'wide' });
  const ok = await dialog(title, h('label', { class: 'field' }, label, input), [{ label: '취소', value: false }, { label: '확인', value: true, primary: true }], {
    onOpen: () => setTimeout(() => { input.focus(); const dot = value.lastIndexOf('.'); input.setSelectionRange(0, dot > 0 && !value.endsWith('.scene.json') ? dot : value.replace(/\.scene\.json$/, '').length); }),
  });
  return ok ? input.value.trim() : null;
}

export async function confirmBox(title: string, text: string, okLabel = '확인'): Promise<boolean> {
  return !!(await dialog(title, h('p', null, text), [{ label: '취소', value: false }, { label: okLabel, value: true, primary: true }]));
}

export interface MenuItem { label: string; action?: () => void; shortcut?: string; disabled?: boolean; separator?: boolean }

export function contextMenu(x: number, y: number, items: MenuItem[]): void {
  document.querySelector('.ctx')?.remove();
  const menu = h('div', { class: 'ctx' }, items.map((it) => it.separator ? h('div', { class: 'sep' }) :
    h('div', { class: 'item' + (it.disabled ? ' disabled' : ''), onclick: () => { if (it.disabled) return; menu.remove(); it.action?.(); } },
      h('span', null, it.label), it.shortcut ? h('span', { class: 'sc' }, it.shortcut) : null)));
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
  menu.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
  setTimeout(() => addEventListener('mousedown', function off(e) { if (!menu.contains(e.target as Node)) { menu.remove(); removeEventListener('mousedown', off, true); } }, true));
}

export function toast(text: string, kind: 'info' | 'error' = 'info'): void {
  const t = h('div', { class: 'toast ' + kind }, text);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

export const fileIcon = (path: string, dir = false) =>
  dir ? '📁' : path.endsWith('.scene.json') ? '🎬' : /\.(png|jpe?g|gif|webp)$/i.test(path) ? '🖼' : path.endsWith('.js') ? '📜' : path.endsWith('.json') ? '⚙' : /\.(wav|mp3|ogg)$/i.test(path) ? '🔊' : '📄';
