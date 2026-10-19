import type { Placement } from '../core/world';
import type { Ed } from './state';
import { typeIcon } from './icons';
import { eachNode, moveNode, nodeLabel, outermost, spotOf } from './tree';
import { h, thumbnail } from './ui';

// The 오브젝트 panel: every node of the scene as a tree, like Unity's Hierarchy.
// Click to select (Ctrl+click adds or removes one, Shift+click picks a whole run), drag onto a node
// to put it inside, drag between rows to change the order (lower in the list = drawn in front).

const folded = new WeakSet<Placement>();
let dragged: Placement | null = null;
let anchor: Placement | null = null; // where a Shift+click run starts

export function renderHierarchy(ed: Ed, root: HTMLElement): void {
  const scene = ed.game.scene;
  const list = h('div', { class: 'ed-tree' });

  const shown: Placement[] = [];
  eachNode(scene.objects, (p, depth) => {
    if (hiddenByFold(ed, p)) return;
    shown.push(p);
    const kind = ed.kinds[p.kind];
    const hasKids = !!p.children?.length;
    const toggle = h('span', { class: 'ed-fold', textContent: hasKids ? (folded.has(p) ? '▸' : '▾') : '' });
    toggle.onclick = (e) => {
      e.stopPropagation();
      if (folded.has(p)) folded.delete(p);
      else folded.add(p);
      ed.render();
    };
    // Same look as the 프로젝트 panel: the picture with a small type mark in its corner.
    const icon = kind?.image
      ? h('span', { class: 'ed-thumb-box ed-small' }, thumbnail(ed.game.assets.image(kind.image), kind.frames, 18), h('span', { class: 'ed-badge' }, typeIcon('prefab', 9)))
      : typeIcon(kind?.blocks.some((b) => b.type === 'text') ? 'text' : 'empty', 18);
    const row = h('div', {
      class: `ed-node ${ed.selected === p ? 'ed-on' : ed.selection.includes(p) ? 'ed-also' : ''}`,
      draggable: true,
      style: `padding-left:${6 + depth * 14}px`,
      title: '끌어서 다른 오브젝트 위에 놓으면 그 안으로, 사이에 놓으면 순서 바꾸기',
    }, toggle, icon, h('span', { textContent: nodeLabel(p) }), p.name && p.kind ? h('small', { textContent: p.kind }) : null);
    row.onclick = (e) => {
      if (e.shiftKey && anchor && shown.includes(anchor)) {
        // Shift+click: everything between the last clicked row and this one.
        const [a, b] = [shown.indexOf(anchor), shown.indexOf(p)].sort((x, y) => x - y);
        ed.pick(null);
        for (const q of shown.slice(a, b + 1)) ed.toggle(q);
        ed.selection = [...ed.selection.filter((q) => q !== p), p]; // the clicked one is the main pick
        ed.selected = p;
      } else if (e.ctrlKey || e.metaKey) {
        ed.toggle(p);
        anchor = p;
      } else {
        ed.pick(p);
        anchor = p;
      }
      ed.render();
    };
    row.addEventListener('dragstart', (e) => {
      dragged = p;
      e.dataTransfer?.setData('text/plain', nodeLabel(p));
    });
    row.addEventListener('dragover', (e) => {
      if (!dragged || dragged === p) return;
      e.preventDefault();
      row.dataset.drop = zone(e, row);
    });
    row.addEventListener('dragleave', () => delete row.dataset.drop);
    row.addEventListener('dragend', () => (dragged = null));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const node = dragged;
      const where = zone(e, row);
      dragged = null;
      if (node && node !== p) ed.change(() => moveMany(ed, node, p, where));
    });
    list.append(row);
  });

  // Dropping below the list takes a node out of its parent, to the top level.
  const end = h('div', { class: 'ed-tree-end', textContent: scene.objects.length ? '' : '오브젝트가 없어요. 위 버튼으로 만들어 보세요.' });
  end.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    end.dataset.drop = 'end';
  });
  end.addEventListener('dragleave', () => delete end.dataset.drop);
  end.addEventListener('drop', (e) => {
    e.preventDefault();
    const node = dragged;
    dragged = null;
    if (node) ed.change(() => moveMany(ed, node, null, 'after'));
  });

  root.replaceChildren(
    h('div', { class: 'ed-buttons', style: 'margin:6px 8px' },
      h('button', { textContent: '+ 오브젝트', title: '맨 위 단계에 빈 오브젝트 만들기', onclick: () => addNode(ed, null) }),
      h('button', { textContent: '+ 자식 오브젝트', title: '고른 오브젝트 안에 만들기', disabled: !ed.selected, onclick: () => addNode(ed, ed.selected) })),
    list,
    end,
  );
}

/** Make an empty node (choose its prefab in the 인스펙터). At the middle of the view, or just inside the parent. */
function addNode(ed: Ed, parent: Placement | null): void {
  const { camera } = ed.game;
  const node: Placement = parent
    ? { kind: '', x: 8, y: 0 }
    : { kind: '', x: Math.round(camera.x + camera.viewWidth / 2), y: Math.round(camera.y + camera.viewHeight / 2) };
  ed.change(() => {
    if (parent) {
      (parent.children ??= []).push(node);
      folded.delete(parent);
    } else {
      ed.game.scene.objects.push(node);
    }
  });
  ed.pick(node);
  ed.show('inspector');
  ed.render();
}

/** Move the dragged node, or every selected node when the dragged one is part of the selection (keeping their order). */
function moveMany(ed: Ed, node: Placement, target: Placement | null, where: 'before' | 'after' | 'into'): void {
  const scene = ed.game.scene;
  const nodes = ed.selection.includes(node) ? outermost(scene, ed.selection).filter((n) => n !== target) : [node];
  for (const n of where === 'after' && target ? [...nodes].reverse() : nodes) moveNode(scene, n, target, where);
}

/** Top quarter of a row = before it, bottom quarter = after it, middle = inside it. */
function zone(e: DragEvent, row: HTMLElement): 'before' | 'after' | 'into' {
  const r = row.getBoundingClientRect();
  const f = (e.clientY - r.top) / r.height;
  return f < 0.25 ? 'before' : f > 0.75 ? 'after' : 'into';
}

function hiddenByFold(ed: Ed, p: Placement): boolean {
  for (let parent = spotOf(ed.game.scene, p)?.parent; parent; parent = spotOf(ed.game.scene, parent)?.parent) {
    if (folded.has(parent)) return true;
  }
  return false;
}
