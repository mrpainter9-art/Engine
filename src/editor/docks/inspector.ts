import { Node, nodeClass, type PropDef } from '../../engine';
import { ed, on, setProp, setScript, renameNode, refreshFiles } from '../state';
import { api, projectUrl } from '../api';
import { h, clear, ask, toast } from '../ui';
import { openScript } from '../script-editor';

export const SCRIPT_TEMPLATE = (path: string, node: string) => `// ${path}
// ${node} 노드에 붙은 스크립트. this.node 는 그 노드, this.game 은 실행 중인 게임.
export default class {
  ready() {
    // 씬이 시작될 때 한 번
  }

  process(dt) {
    // 매 프레임 (dt = 지난 프레임부터 흐른 초)
  }
}
`;

export async function attachNewScript(n: Node) {
  const name = await ask('새 스크립트', '파일 이름', n.name.replace(/[^\w-]/g, '_').toLowerCase() + '.js');
  if (!name) return;
  const path = 'res://scripts/' + (name.endsWith('.js') ? name : name + '.js');
  if (!ed.files.some((f) => f.path === path)) await api('fs/write', { path, text: SCRIPT_TEMPLATE(path, n.name) });
  setScript(n, path);
  await refreshFiles();
  await openScript(path);
  toast('스크립트를 붙였어요. 씬을 저장하면 반영돼요.');
}

const groupsOpen = new Map<string, boolean>();

function numberInput(value: number, def: PropDef, onSet: (v: number) => void, int: boolean) {
  const input = h('input', { type: 'number', value: String(value), step: def.step ?? (int ? 1 : 0.1), min: def.min, max: def.max });
  input.addEventListener('change', () => { let v = parseFloat(input.value); if (isNaN(v)) return; if (int) v = Math.round(v); if (def.min != null) v = Math.max(def.min, v); if (def.max != null) v = Math.min(def.max, v); onSet(v); });
  return input;
}

/** Godot-style label scrubbing: drag a number's label left/right to change it. */
function scrub(label: HTMLElement, get: () => number, set: (v: number) => void, step: number) {
  label.classList.add('scrub');
  label.addEventListener('mousedown', (e) => {
    const x0 = e.clientX, v0 = get();
    const move = (ev: MouseEvent) => set(+(v0 + Math.round((ev.clientX - x0) / 2) * step).toFixed(4));
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
    e.preventDefault();
  });
}

function editor(n: Node, def: PropDef): HTMLElement {
  const v = n.props[def.name];
  const set = (x: unknown) => setProp(n, def.name, x);
  switch (def.type) {
    case 'number': case 'int': return numberInput(v, def, set, def.type === 'int');
    case 'vec2': {
      const fx = numberInput(v.x, def, (x) => set({ ...n.props[def.name], x }), false);
      const fy = numberInput(v.y, def, (y) => set({ ...n.props[def.name], y }), false);
      return h('div', { class: 'vec2' }, h('span', { class: 'axis x' }, 'x'), fx, h('span', { class: 'axis y' }, 'y'), fy);
    }
    case 'bool': return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!v, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), v ? '켜짐' : '꺼짐');
    case 'color': {
      const hex = String(v).slice(0, 7);
      const text = h('input', { type: 'text', value: v, class: 'hex', onchange: (e: Event) => { const t = (e.target as HTMLInputElement).value.trim(); if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(t)) set(t.toLowerCase()); } });
      return h('div', { class: 'color' }, h('input', { type: 'color', value: hex, oninput: (e: Event) => set((e.target as HTMLInputElement).value) }), text);
    }
    case 'enum': return h('select', { onchange: (e: Event) => set((e.target as HTMLSelectElement).value) }, (def.options || []).map((o) => h('option', { value: o, selected: o === v }, o)));
    case 'text': return h('textarea', { rows: 2, value: v, onchange: (e: Event) => set((e.target as HTMLTextAreaElement).value) });
    case 'texture': {
      const images = ed.files.filter((f) => !f.dir && /\.(png|jpe?g|gif|webp)$/i.test(f.path));
      const sel = h('select', { onchange: (e: Event) => set((e.target as HTMLSelectElement).value) },
        h('option', { value: '' }, '(없음)'), images.map((f) => h('option', { value: f.path, selected: f.path === v }, f.path.replace('res://', ''))));
      const thumb = v ? h('img', { class: 'thumb', src: projectUrl(v) }) : null;
      const box = h('div', { class: 'texture' }, thumb, sel);
      box.addEventListener('dragover', (e) => e.preventDefault());
      box.addEventListener('drop', (e) => { const p = e.dataTransfer?.getData('text/x-engine-path'); if (p && /\.(png|jpe?g|gif|webp)$/i.test(p)) { e.preventDefault(); set(p); } });
      return box;
    }
    default: return h('input', { type: 'text', value: v ?? '', onchange: (e: Event) => set((e.target as HTMLInputElement).value) });
  }
}

export function createInspector(): HTMLElement {
  const body = h('div', { class: 'dock-body inspector' });
  const render = () => {
    // keep the field being typed in (and its caret) across re-renders
    const active = document.activeElement as HTMLInputElement | null;
    const focusKey = active && body.contains(active) ? active.closest('[data-prop]')?.getAttribute('data-prop') + '|' + [...(active.closest('[data-prop]')?.querySelectorAll('input,select,textarea') || [])].indexOf(active) : null;
    clear(body);
    const n = ed.current?.selected;
    if (!n) { body.append(h('div', { class: 'muted pad' }, '노드를 선택하면 속성이 여기 나와요.')); return; }
    const cls = nodeClass(n.type);
    const nameInput = h('input', { type: 'text', value: n.name, onchange: (e: Event) => renameNode(n, (e.target as HTMLInputElement).value) });
    body.append(h('div', { class: 'insp-head' }, h('span', { class: 'icon' }, cls.icon), h('b', null, n.type), nameInput));
    const scripts = ed.files.filter((f) => !f.dir && f.path.endsWith('.js'));
    body.append(h('div', { class: 'insp-row', 'data-prop': '__script' },
      h('label', null, 'script'),
      h('div', { class: 'script-field' },
        h('select', { onchange: (e: Event) => setScript(n, (e.target as HTMLSelectElement).value) },
          h('option', { value: '' }, '(없음)'), scripts.map((f) => h('option', { value: f.path, selected: f.path === n.script }, f.path.replace('res://', '')))),
        n.script ? h('button', { title: '스크립트 열기', onclick: () => openScript(n.script) }, '열기') : h('button', { title: '새 스크립트 만들어 붙이기', onclick: () => attachNewScript(n) }, '새로'))));
    for (const g of cls.propGroups()) {
      if (!g.props.length) continue;
      const open = groupsOpen.get(g.cls) ?? true;
      const head = h('div', { class: 'insp-group' + (open ? '' : ' closed'), onclick: () => { groupsOpen.set(g.cls, !open); render(); } }, (open ? '▾ ' : '▸ ') + g.cls);
      body.append(head);
      if (!open) continue;
      for (const def of g.props) {
        const label = h('label', { title: def.hint || def.name }, def.name);
        if (def.type === 'number' || def.type === 'int') scrub(label, () => n.props[def.name], (v) => setProp(n, def.name, def.type === 'int' ? Math.round(v) : v), def.step ?? (def.type === 'int' ? 1 : 0.1));
        body.append(h('div', { class: 'insp-row', 'data-prop': def.name }, label, editor(n, def)));
      }
    }
    if (focusKey) {
      const [prop, idx] = focusKey.split('|');
      const el = body.querySelectorAll(`[data-prop="${prop}"] input, [data-prop="${prop}"] select, [data-prop="${prop}"] textarea`)[+idx] as HTMLInputElement | undefined;
      el?.focus();
    }
  };
  on('selection', render); on('scene', render); on('files', render);
  render();
  return h('div', { class: 'dock' }, h('div', { class: 'dock-title' }, '인스펙터'), body);
}
