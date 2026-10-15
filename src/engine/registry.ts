import { Node } from './node';
import { Node2D } from './nodes/node2d';
import { Sprite2D, ColorRect, Label } from './nodes/visual';
import { Parallax2D, Camera2D, CanvasModulate, CanvasLayer } from './nodes/scene-nodes';
import { Node3D, MeshInstance3D, Sprite3D, Camera3D, DirectionalLight3D, OmniLight3D, WorldEnvironment } from './nodes/node3d';

export type NodeClass = typeof Node;

const types = new Map<string, NodeClass>();

/** Register a node class so scenes can load it and the Add Node dialog lists it; also gives instances node.position-style accessors. */
export function registerNode(cls: NodeClass): void {
  types.set(cls.typeName, cls);
  if (Object.prototype.hasOwnProperty.call(cls, 'props'))
    for (const p of cls.props)
      if (!(p.name in cls.prototype))
        Object.defineProperty(cls.prototype, p.name, {
          get(this: Node) { return this.props[p.name]; },
          set(this: Node, v) { this.props[p.name] = v; },
          configurable: true,
        });
}

export function nodeClass(type: string): NodeClass {
  const c = types.get(type);
  if (!c) throw new Error(`알 수 없는 노드 종류: ${type}`);
  return c;
}

export function createNode(type: string, name?: string): Node {
  const C = nodeClass(type) as unknown as new (name?: string) => Node;
  return new C(name);
}

export function nodeTypes(): NodeClass[] {
  return [...types.values()];
}

/** Parent class name, for the Add Node dialog's tree. */
export function parentType(cls: NodeClass): string | null {
  const p = Object.getPrototypeOf(cls);
  return p && p.typeName ? p.typeName : null;
}

for (const c of [Node, Node2D, Sprite2D, ColorRect, Label, Parallax2D, Camera2D, CanvasModulate, CanvasLayer,
  Node3D, MeshInstance3D, Sprite3D, Camera3D, DirectionalLight3D, OmniLight3D, WorldEnvironment]) registerNode(c as NodeClass);
