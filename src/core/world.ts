import type { Game, Module } from './module';

// One thing in the game: a picture at a position, of some kind ("player", "coin", ...).
export interface GameObject {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  image: string;
  flipX: boolean;
  /** Free space for the kind's own values (speed, start position, ...). */
  data: Record<string, unknown>;
}

// A kind says how objects of that kind behave. One kind = one folder in src/kinds/.
export interface Kind {
  name: string;
  image: string;
  setup?(obj: GameObject, game: Game): void;
  update?(obj: GameObject, dt: number, game: Game): void;
}

/** One entry of a scene file: which kind, where, and optional extra values. */
export interface Placement {
  kind: string;
  x: number;
  y: number;
  [extra: string]: unknown;
}

// The world keeps every object in one flat list, in drawing order (first = behind).
export class World implements Module {
  name = 'world';
  objects: GameObject[] = [];
  private kinds = new Map<string, Kind>();
  private pending: Placement[] = [];
  private game!: Game;

  addKind(kind: Kind): this {
    this.kinds.set(kind.name, kind);
    return this;
  }

  /** Objects to create when the game starts, usually from a scene file. */
  load(placements: Placement[]): this {
    this.pending.push(...placements);
    return this;
  }

  spawn(p: Placement): GameObject | null {
    const kind = this.kinds.get(p.kind);
    if (!kind) {
      console.warn(`Unknown kind "${p.kind}" in scene. Is it registered in main.ts?`);
      return null;
    }
    const { kind: _k, x, y, ...extra } = p;
    const img = this.game.assets.image(kind.image);
    const obj: GameObject = {
      kind: kind.name, x, y, w: img?.width ?? 16, h: img?.height ?? 16,
      image: kind.image, flipX: false, data: { ...extra },
    };
    this.objects.push(obj);
    kind.setup?.(obj, this.game);
    return obj;
  }

  remove(obj: GameObject): void {
    this.objects = this.objects.filter((o) => o !== obj);
  }

  /** All objects of one kind, e.g. find('coin'). */
  find(kind: string): GameObject[] {
    return this.objects.filter((o) => o.kind === kind);
  }

  /** True when two objects' boxes overlap. */
  touching(a: GameObject, b: GameObject): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  init(game: Game): void {
    this.game = game;
    for (const p of this.pending) this.spawn(p);
    this.pending = [];
  }

  update(dt: number, game: Game): void {
    // Copy the list so objects can be added or removed while we go through it.
    for (const obj of [...this.objects]) this.kinds.get(obj.kind)?.update?.(obj, dt, game);
  }

  draw(ctx: CanvasRenderingContext2D, { assets }: Game): void {
    for (const o of this.objects) assets.draw(ctx, o.image, o.x, o.y, { flipX: o.flipX });
  }
}
