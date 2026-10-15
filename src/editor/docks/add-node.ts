import { nodeTypes, parentType, type NodeClass } from '../../engine';
import { dialog, h, clear } from '../ui';
import { ed } from '../state';

/** Godot's "Create New Node" dialog: a searchable tree of node types with a description. */
export async function chooseNodeType(title = '새 노드 만들기'): Promise<string | null> {
  let chosen = ed.tab === '3d' ? 'MeshInstance3D' : 'Node2D';
  const search = h('input', { type: 'search', placeholder: '검색', class: 'wide' });
  const list = h('div', { class: 'type-tree' });
  const desc = h('div', { class: 'type-desc' });
  const types = nodeTypes();
  const kids = (name: string | null) => types.filter((t) => parentType(t) === name);
  let resolveDbl: (() => void) | null = null;

  const render = () => {
    clear(list);
    const q = search.value.trim().toLowerCase();
    const row = (t: NodeClass, depth: number) => {
      const el = h('div', { class: 'type-row' + (t.typeName === chosen ? ' sel' : ''), style: { paddingLeft: 6 + depth * 14 + 'px' },
        onclick: () => { chosen = t.typeName; render(); }, ondblclick: () => { chosen = t.typeName; resolveDbl?.(); } },
        h('span', { class: 'icon' }, t.icon), t.typeName);
      list.append(el);
    };
    if (q) types.filter((t) => t.typeName.toLowerCase().includes(q) || t.description.includes(q)).forEach((t) => row(t, 0));
    else { const walk = (t: NodeClass, d: number) => { row(t, d); kids(t.typeName).forEach((k) => walk(k, d + 1)); }; kids(null).forEach((t) => walk(t, 0)); }
    const t = types.find((x) => x.typeName === chosen);
    desc.textContent = t ? `${t.typeName}: ${t.description}` : '';
  };
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    const first = types.find((t) => t.typeName.toLowerCase().includes(q));
    if (first) chosen = first.typeName;
    render();
  });
  render();
  const result = await dialog(title, h('div', { class: 'add-node' }, search, list, desc), [{ label: '취소', value: '' }, { label: '만들기', value: 'ok', primary: true }], {
    width: 420,
    onOpen: (box) => { resolveDbl = () => (box.querySelector('.dlg-buttons .primary') as HTMLButtonElement).click(); },
  });
  return result === 'ok' ? chosen : null;
}
