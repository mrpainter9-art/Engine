import { h } from './ui';

// The menu bar at the top (파일, 편집, ...), like any desktop program:
// click a name to open its list, move along the bar to look at the others, click outside or press Esc to close.

export interface MenuItem {
  label: string;
  /** Shortcut shown on the right, e.g. "Ctrl+S" (the key itself is handled elsewhere). */
  keys?: string;
  action?: () => void;
  disabled?: boolean;
  /** Show a tick in front (e.g. a panel that is open). */
  checked?: boolean;
  /** A list that opens to the side. */
  items?: MenuEntry[];
}

export type MenuEntry = MenuItem | '-';

export interface Menu {
  label: string;
  items: MenuEntry[];
}

let openIndex = -1;
let closeOnOutside: ((e: PointerEvent) => void) | null = null;

export function menuBar(menus: Menu[]): HTMLElement {
  const bar = h('div', { class: 'ed-menubar' });
  const close = () => {
    openIndex = -1;
    draw();
  };
  const draw = () => {
    bar.replaceChildren(...menus.map((menu, i) => {
      const top = h('div', { class: `ed-menu ${openIndex === i ? 'ed-on' : ''}`, textContent: menu.label });
      top.onclick = (e) => {
        e.stopPropagation();
        openIndex = openIndex === i ? -1 : i;
        draw();
      };
      top.onpointerenter = () => {
        if (openIndex >= 0 && openIndex !== i) {
          openIndex = i;
          draw();
        }
      };
      if (openIndex === i) top.append(list(menu.items, close));
      return top;
    }));
    if (closeOnOutside) document.removeEventListener('pointerdown', closeOnOutside);
    closeOnOutside = null;
    if (openIndex >= 0) {
      closeOnOutside = (e) => !bar.contains(e.target as Node) && close();
      document.addEventListener('pointerdown', closeOnOutside);
    }
  };
  draw();
  return bar;
}

/** Close any open menu (e.g. on Esc). Returns true if one was open. */
export function closeMenus(): boolean {
  if (openIndex < 0) return false;
  openIndex = -1;
  document.querySelectorAll('.ed-menu.ed-on').forEach((m) => {
    m.classList.remove('ed-on');
    m.querySelector('.ed-menu-list')?.remove();
  });
  return true;
}

function list(items: MenuEntry[], close: () => void): HTMLElement {
  const box = h('div', { class: 'ed-menu-list' });
  box.onclick = (e) => e.stopPropagation();
  for (const item of items) {
    if (item === '-') {
      box.append(h('div', { class: 'ed-menu-sep' }));
      continue;
    }
    const row = h('div', { class: `ed-menu-item ${item.disabled ? 'ed-off' : ''}` },
      h('span', { class: 'ed-menu-check', textContent: item.checked ? '✓' : '' }),
      h('span', { class: 'ed-menu-label', textContent: item.label }),
      h('span', { class: 'ed-menu-keys', textContent: item.items ? '▸' : item.keys ?? '' }));
    if (item.items) {
      row.classList.add('ed-has-sub');
      row.append(list(item.items, close));
    } else if (!item.disabled) {
      row.onclick = () => {
        close();
        item.action?.();
      };
    }
    box.append(row);
  }
  return box;
}
