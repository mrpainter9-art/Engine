import { h } from './ui';

// Small boxes in the middle of the window: ask for a name, or show some text. Esc or 닫기 closes them.

function open(title: string, ...content: Node[]): { box: HTMLElement; close: () => void } {
  const shade = h('div', { class: 'ed-shade' });
  const box = h('div', { class: 'ed-dialog' }, h('h3', { textContent: title }), ...content);
  shade.append(box);
  const close = () => {
    shade.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Escape') return;
    e.stopPropagation();
    close();
  };
  shade.onpointerdown = (e) => e.target === shade && close();
  window.addEventListener('keydown', onKey, true);
  document.body.append(shade);
  return { box, close };
}

/** Ask for one line of text; onOk gets it when Enter or 확인 is pressed. */
export function askText(title: string, placeholder: string, onOk: (text: string) => void): void {
  const input = h('input', { type: 'text', placeholder });
  const ok = () => {
    const text = input.value.trim();
    if (!text) return;
    close();
    onOk(text);
  };
  input.addEventListener('keydown', (e) => e.code === 'Enter' && ok());
  const { close } = open(title, input, h('div', { class: 'ed-buttons' },
    h('button', { class: 'ed-primary', textContent: '확인', onclick: ok }),
    h('button', { textContent: '취소', onclick: () => close() })));
  input.focus();
}

/** Show text (lines split by \n). */
export function showText(title: string, text: string): void {
  const { close } = open(title, h('pre', { class: 'ed-dialog-text', textContent: text }),
    h('div', { class: 'ed-buttons' }, h('button', { textContent: '닫기', onclick: () => close() })));
}
