import type { SceneData } from '../core/scenes';
import type { Placement } from '../core/world';

// Scene nodes form a tree: each node may hold children placed relative to it.

export interface Spot {
  /** The list the node is in (the scene's top list, or its parent's children). */
  list: Placement[];
  parent: Placement | null;
}

/** Visit every node, parents before their children. */
export function eachNode(list: Placement[], fn: (p: Placement, depth: number, parent: Placement | null) => void, depth = 0, parent: Placement | null = null): void {
  for (const p of list) {
    fn(p, depth, parent);
    if (p.children) eachNode(p.children, fn, depth + 1, p);
  }
}

export function spotOf(scene: SceneData, node: Placement): Spot | null {
  let found: Spot | null = null;
  const look = (list: Placement[], parent: Placement | null) => {
    if (list.includes(node)) found = { list, parent };
    for (const p of list) if (!found && p.children) look(p.children, p);
  };
  look(scene.objects, null);
  return found;
}

/** A node's position on the map (its own x/y plus every parent's). */
export function worldPos(scene: SceneData, node: Placement | null): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let p = node; p; p = spotOf(scene, p)?.parent ?? null) {
    x += p.x;
    y += p.y;
  }
  return { x, y };
}

/** True when b is a or sits somewhere under a. */
export function isInside(a: Placement, b: Placement): boolean {
  if (a === b) return true;
  return (a.children ?? []).some((c) => isInside(c, b));
}

export function removeNode(scene: SceneData, node: Placement): void {
  const spot = spotOf(scene, node);
  if (!spot) return;
  spot.list.splice(spot.list.indexOf(node), 1);
  if (spot.parent && !spot.parent.children?.length) delete spot.parent.children;
}

/**
 * Move a node: "into" another node (as its last child), or "before"/"after" it, or to the top level (target null).
 * It stays where it is on the map; its x/y become relative to the new parent.
 */
export function moveNode(scene: SceneData, node: Placement, target: Placement | null, where: 'into' | 'before' | 'after'): void {
  if (target && isInside(node, target)) return;
  const pos = worldPos(scene, node);
  removeNode(scene, node);
  let parent: Placement | null = null;
  if (!target) {
    scene.objects.push(node);
  } else if (where === 'into') {
    parent = target;
    (target.children ??= []).push(node);
  } else {
    const spot = spotOf(scene, target)!;
    parent = spot.parent;
    spot.list.splice(spot.list.indexOf(target) + (where === 'after' ? 1 : 0), 0, node);
  }
  const base = worldPos(scene, parent);
  node.x = pos.x - base.x;
  node.y = pos.y - base.y;
}

/** What to call a node in lists: its name, else its kind. */
export function nodeLabel(p: Placement): string {
  return p.name || p.kind || '빈 노드';
}
