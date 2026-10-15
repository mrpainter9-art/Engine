import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { keymap } from '@codemirror/view';
import { oneDarkish } from './cm-theme';
import { ed, on, emit, log } from './state';
import { api } from './api';
import { h, clear } from './ui';

let view: EditorView | null = null;
let host: HTMLElement;
let list: HTMLElement;
let title: HTMLElement;

export async function openScript(path: string) {
  let sc = ed.scripts.find((s) => s.path === path);
  if (!sc) {
    const { text } = await api('fs/read', { path });
    sc = { path, text, saved: text, mtime: ed.files.find((f) => f.path === path)?.mtime };
    ed.scripts.push(sc);
  }
  ed.currentScript = sc;
  ed.tab = 'script';
  emit('tab');
  emit('scripts');
}

export async function saveScript(sc = ed.currentScript) {
  if (!sc) return;
  const r = await api('fs/write', { path: sc.path, text: sc.text });
  sc.saved = sc.text;
  sc.mtime = r.mtime;
  log(`저장함: ${sc.path}`, 'ok');
  emit('scripts');
}

function closeScript(path: string) {
  const i = ed.scripts.findIndex((s) => s.path === path);
  if (i < 0) return;
  ed.scripts.splice(i, 1);
  if (ed.currentScript?.path === path) ed.currentScript = ed.scripts[Math.min(i, ed.scripts.length - 1)] || null;
  emit('scripts');
}

function mount() {
  const sc = ed.currentScript;
  title.textContent = sc ? sc.path + (sc.text !== sc.saved ? ' (저장 안 됨)' : '') : '';
  if (!sc) { view?.destroy(); view = null; clear(host).append(h('div', { class: 'muted pad' }, '파일시스템에서 .js 파일을 두 번 누르거나, 노드에 스크립트를 붙이면 여기서 열려요.')); return; }
  if (view && (view as any).__path === sc.path) {
    if (view.state.doc.toString() !== sc.text) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: sc.text } });
    return;
  }
  view?.destroy();
  clear(host);
  view = new EditorView({
    parent: host,
    doc: sc.text,
    extensions: [
      basicSetup,
      sc.path.endsWith('.js') ? javascript() : [],
      oneDarkish,
      keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { saveScript(); return true; } }]),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged || !ed.currentScript) return;
        const was = ed.currentScript.text !== ed.currentScript.saved;
        ed.currentScript.text = u.state.doc.toString();
        if (was !== (ed.currentScript.text !== ed.currentScript.saved)) renderList();
      }),
    ],
  });
  (view as any).__path = sc.path;
}

function renderList() {
  clear(list);
  for (const sc of ed.scripts) {
    const dirty = sc.text !== sc.saved;
    list.append(h('div', { class: 'row' + (sc === ed.currentScript ? ' sel' : ''), title: sc.path, onclick: () => { ed.currentScript = sc; emit('scripts'); } },
      h('span', { class: 'name' }, sc.path.split('/').pop() + (dirty ? ' •' : '')),
      h('span', { class: 'close', title: '닫기', onclick: (e: MouseEvent) => { e.stopPropagation(); closeScript(sc.path); } }, '✕')));
  }
  if (ed.currentScript) title.textContent = ed.currentScript.path + (ed.currentScript.text !== ed.currentScript.saved ? ' (저장 안 됨)' : '');
}

export function createScriptEditor(): HTMLElement {
  host = h('div', { class: 'cm-host' });
  list = h('div', { class: 'tree script-list' });
  title = h('span', { class: 'muted' });
  on('scripts', () => { renderList(); mount(); });
  renderList(); mount();
  return h('div', { class: 'script-editor' },
    h('div', { class: 'script-side' }, h('div', { class: 'dock-title' }, '스크립트'), list),
    h('div', { class: 'script-main' },
      h('div', { class: 'vp-toolbar' }, title, h('span', { class: 'grow' }), h('button', { class: 'tool', onclick: () => saveScript() }, '저장 (Ctrl+S)')),
      host));
}
