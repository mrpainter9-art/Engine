import { clone } from './math';

export type PropType = 'number' | 'int' | 'vec2' | 'vec3' | 'color' | 'string' | 'text' | 'bool' | 'texture' | 'model' | 'enum';

/** One inspector-editable, serialized property. Subclasses list their own; the inspector shows them grouped by class. */
export interface PropDef {
  name: string;
  type: PropType;
  default: unknown;
  options?: string[]; // for 'enum'
  min?: number;
  max?: number;
  step?: number;
  hint?: string; // shown as a tooltip in the inspector
}

/** A script attached to a node: any class with optional ready()/process(dt)/input(ev); the engine sets .node and .game before ready(). */
export interface ScriptInstance {
  node?: Node;
  game?: unknown;
  ready?(): void;
  process?(dt: number): void;
  input?(ev: KeyboardEvent | MouseEvent): void;
}

let uid = 1;

export class Node {
  static typeName = 'Node';
  static icon = '○';
  static description = '가장 기본 노드. 다른 노드를 묶는 용도.';
  static props: PropDef[] = [];

  /** Every property this class has, base classes first, grouped by the class that declared them. */
  static propGroups(): { cls: string; props: PropDef[] }[] {
    const chain: (typeof Node)[] = [];
    for (let c: any = this; c && c.typeName; c = Object.getPrototypeOf(c)) chain.unshift(c);
    return chain.filter((c) => Object.prototype.hasOwnProperty.call(c, 'props')).map((c) => ({ cls: c.typeName, props: c.props }));
  }
  static allProps(): PropDef[] {
    return this.propGroups().flatMap((g) => g.props);
  }

  readonly id = uid++;
  name: string;
  parent: Node | null = null;
  children: Node[] = [];
  /** res:// path of the attached script, or '' */
  script = '';
  props: Record<string, any> = {};
  scriptInstance: ScriptInstance | null = null;

  constructor(name?: string) {
    const cls = this.constructor as typeof Node;
    this.name = name || cls.typeName;
    for (const p of cls.allProps()) this.props[p.name] = clone(p.default);
  }

  get type(): string {
    return (this.constructor as typeof Node).typeName;
  }

  addChild(child: Node, index = this.children.length): Node {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    child.name = this.uniqueName(child.name, child);
    this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child: Node): number {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
    }
    return i;
  }

  /** Godot keeps sibling names unique; so do we (Sprite2D, Sprite2D2, ...). */
  uniqueName(base: string, self?: Node): string {
    const taken = new Set(this.children.filter((c) => c !== self).map((c) => c.name));
    if (!taken.has(base)) return base;
    const stem = base.replace(/\d+$/, '');
    for (let i = 2; ; i++) if (!taken.has(stem + i)) return stem + i;
  }

  /** Path from the scene root, e.g. "Main/Far/Sprite". */
  path(): string {
    const parts: string[] = [];
    for (let n: Node | null = this; n; n = n.parent) parts.unshift(n.name);
    return parts.join('/');
  }

  /** Find a descendant by relative path ("Far/Sprite"). */
  find(rel: string): Node | null {
    let n: Node | null = this;
    for (const part of rel.split('/').filter(Boolean)) {
      if (!n) return null;
      n = part === '..' ? n.parent : n.children.find((c) => c.name === part) || null;
    }
    return n;
  }

  walk(fn: (n: Node) => void | false): void {
    if (fn(this) === false) return;
    for (const c of this.children) c.walk(fn);
  }

  isAncestorOf(n: Node): boolean {
    for (let p = n.parent; p; p = p.parent) if (p === this) return true;
    return false;
  }
}
