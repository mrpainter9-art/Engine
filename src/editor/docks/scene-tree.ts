import { Node, Node2D, CanvasLayer, createNode, nodeClass } from '../../engine';
import { ed, on, select, addNode, deleteNode, duplicateNode, moveNode, renameNode, setProp, newScene, setScript } from '../state';
import { h, clear, contextMenu } from '../ui';
import { chooseNodeType } from './add-node';
import { attachNewScript } from './inspector';

const collapsed = new WeakSet<Node>();

export async function addChildNode() {
  const s = ed.current;
  if (!s) return;
  const type = await chooseNodeType();
  if (!type) return;
  const parent = s.selected || s.root;
  addNode(parent, createNode(type));
}

function rename(n: Node, label: HTMLElement) {
  const input = h('input', { type: 'text', value: n.name, class: 'rename' });
  label.replaceWith(input);
  input.focus(); input.select();
  let done = false;
  const finish = (ok: boolean) => { if (done) return; done = true; if (ok) renameNode(n, input.value); else input.replaceWith(label); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); e.stopPropagation(); });
  input.addEventListener('blur', () => finish(true));
}

export function createSceneDock(): HTMLElement {
  const filter = h('input', { type: 'search', placeholder: '노드 찾기', class: 'filter' });
  const tree = h('div', { class: 'tree', tabIndex: 0 });
  const body = h('div', { class: 'dock-body' }, tree);
  let dragNode: Node | null = null;

  const empty = () => h('div', { class: 'root-picker' },
    h('div', { class: 'muted' }, '루트 노드 만들기:'),
    h('button', { onclick: () => newScene('Node2D') }, '✥ 2D 씬'),
    h('button', { onclick: () => newScene('CanvasLayer') }, '▤ 사용자 인터페이스'),
    h('button', { onclick: async () => { const t = await chooseNodeType('루트 노드 고르기'); if (t) newScene(t); } }, '○ 다른 노드'));

  const render = () => {
    clear(tree);
    const s = ed.current;
    if (!s) { tree.append(empty()); return; }
    const q = filter.value.trim().toLowerCase();
    const matches = (n: Node): boolean => !q || n.name.toLowerCase().includes(q) || n.children.some(matches);
    const row = (n: Node, depth: number) => {
      if (!matches(n)) return;
      const cls = nodeClass(n.type);
      const hasKids = n.children.length > 0;
      const label = h('span', { class: 'name' }, n.name);
      const vis = n instanceof Node2D || n instanceof CanvasLayer;
      const el = h('div', {
        class: 'row' + (s.selected === n ? ' sel' : ''), draggable: n !== s.root, style: { paddingLeft: 4 + depth * 14 + 'px' }, title: n.type,
        onclick: () => select(n),
        ondblclick: (e: MouseEvent) => { e.stopPropagation(); rename(n, label); },
        oncontextmenu: (e: MouseEvent) => {
          e.preventDefault(); select(n);
          contextMenu(e.clientX, e.clientY, [
            { label: '+ 자식 노드 추가', shortcut: 'Ctrl+A', action: addChildNode },
            { label: '이름 바꾸기', shortcut: 'F2', action: () => rename(n, label) },
            { label: '복제', shortcut: 'Ctrl+D', action: () => duplicateNode(n), disabled: n === s.root },
            { label: '위로', action: () => n.parent && moveNode(n, n.parent, n.parent.children.indexOf(n) - 1), disabled: !n.parent || n.parent.children[0] === n },
            { label: '아래로', action: () => n.parent && moveNode(n, n.parent, n.parent.children.indexOf(n) + 2), disabled: !n.parent || n.parent.children[n.parent.children.length - 1] === n },
            { separator: true, label: '' },
            { label: n.script ? '스크립트 떼기' : '새 스크립트 붙이기', action: () => (n.script ? setScript(n, '') : attachNewScript(n)) },
            { separator: true, label: '' },
            { label: '삭제', shortcut: 'Del', action: () => deleteNode(n), disabled: n === s.root },
          ]);
        },
        ondragstart: (e: DragEvent) => { dragNode = n; e.dataTransfer!.effectAllowed = 'move'; e.dataTransfer!.setData('text/x-engine-node', String(n.id)); },
        ondragover: (e: DragEvent) => {
          if (!dragNode || dragNode === n || dragNode.isAncestorOf(n)) return;
          e.preventDefault();
          const r = el.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
          el.dataset.drop = n === s.root ? 'in' : y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'in';
        },
        ondragleave: () => { delete el.dataset.drop; },
        ondrop: (e: DragEvent) => {
          e.preventDefault();
          const where = el.dataset.drop; delete el.dataset.drop;
          if (!dragNode || !where) return;
          if (where === 'in') moveNode(dragNode, n, n.children.length);
          else if (n.parent) moveNode(dragNode, n.parent, n.parent.children.indexOf(n) + (where === 'after' ? 1 : 0));
          dragNode = null;
        },
      },
      h('span', { class: 'arrow', onclick: (e: MouseEvent) => { e.stopPropagation(); if (collapsed.has(n)) collapsed.delete(n); else collapsed.add(n); render(); } }, hasKids ? (collapsed.has(n) && !q ? '▸' : '▾') : ''),
      h('span', { class: 'icon' }, cls.icon), label,
      n.script ? h('span', { class: 'badge', title: n.script }, '📜') : null,
      vis ? h('span', { class: 'eye' + ((n as Node2D).visible ? '' : ' off'), title: '보이기/숨기기',
        onclick: (e: MouseEvent) => { e.stopPropagation(); setProp(n, 'visible', !(n as Node2D).visible, false); } }, (n as Node2D).visible ? '👁' : '◌') : null);
      tree.append(el);
      if (!collapsed.has(n) || q) n.children.forEach((c) => row(c, depth + 1));
    };
    row(s.root, 0);
    tree.querySelector('.row.sel')?.scrollIntoView({ block: 'nearest' });
  };

  tree.addEventListener('keydown', (e) => {
    const s = ed.current, n = s?.selected;
    if (!s || !n) return;
    if (e.key === 'Delete' && n !== s.root) deleteNode(n);
    else if (e.key === 'F2') { const lbl = tree.querySelector('.row.sel .name') as HTMLElement; if (lbl) rename(n, lbl); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const all: Node[] = []; s.root.walk((x) => { all.push(x); if (collapsed.has(x)) return false; });
      const i = all.indexOf(n) + (e.key === 'ArrowDown' ? 1 : -1);
      if (all[i]) select(all[i]);
      e.preventDefault();
    } else return;
  });
  filter.addEventListener('input', render);
  on('scene', render); on('selection', render); on('scenes', render);
  render();
  return h('div', { class: 'dock' },
    h('div', { class: 'dock-title' }, '씬'),
    h('div', { class: 'dock-tools' },
      h('button', { class: 'icon-btn', title: '자식 노드 추가 (Ctrl+A)', onclick: addChildNode }, '＋'),
      filter),
    body);
}
