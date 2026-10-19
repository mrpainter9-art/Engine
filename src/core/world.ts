import type { Game, Module } from './module';
import { warn } from './warn';

// One thing in the game: a picture at a position, of some kind ("player", "coin", ...).
export interface GameObject {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where it was placed in the scene. Some blocks send objects back here. */
  startX: number;
  startY: number;
  image: string;
  flipX: boolean;
  blocks: BlockInstance[];
}

/** Values a block gets from kinds.json (and the scene), e.g. { speed: 30, distance: 60 }. */
export type Params = Record<string, any>;

// A behavior block: one small thing an object can do ("patrol", "bob", ...).
// One block = one file in src/behaviors/. Kinds are made by listing blocks in kinds.json.
export interface Behavior {
  type: string;
  setup?(obj: GameObject, params: Params, state: Record<string, any>, game: Game): void;
  update?(obj: GameObject, params: Params, state: Record<string, any>, dt: number, game: Game): void;
}

interface BlockInstance {
  behavior: Behavior;
  params: Params;
  state: Record<string, any>; // the block's own memory for this object
}

/** A kind from kinds.json: a picture plus a list of blocks with their values. */
export interface KindDef {
  image: string;
  blocks: ({ type: string } & Params)[];
}

/** One entry of a scene file: which kind, where, and optional values that override the kind's. */
export interface Placement {
  kind: string;
  x: number;
  y: number;
  [override: string]: unknown;
}

// The world keeps every object in one flat list, in drawing order (first = behind).
export class World implements Module {
  name = 'world';
  objects: GameObject[] = [];
  private behaviors = new Map<string, Behavior>();
  private pending: Placement[] = [];
  private game!: Game;

  constructor(private kinds: Record<string, KindDef>) {}

  addBehavior(b: Behavior): this {
    this.behaviors.set(b.type, b);
    return this;
  }

  /** Objects to create when the game starts, usually from a scene file. */
  load(placements: Placement[]): this {
    this.pending.push(...placements);
    return this;
  }

  spawn(p: Placement): GameObject | null {
    const kind = this.kinds[p.kind];
    if (!kind) {
      warn(`장면에 "${p.kind}"라는 종류가 있는데 kinds.json에 없어요.`);
      return null;
    }
    const { kind: name, x, y, ...overrides } = p;
    const img = this.game.assets.image(kind.image);
    const obj: GameObject = {
      kind: name, x, y, startX: x, startY: y,
      w: img?.width ?? 16, h: img?.height ?? 16,
      image: kind.image, flipX: false, blocks: [],
    };
    for (const { type, ...values } of kind.blocks) {
      const behavior = this.behaviors.get(type);
      if (!behavior) {
        warn(`"${name}"에 쓰인 "${type}" 블록이 없어요. 이름이 맞는지, main.ts에 등록됐는지 확인해 주세요.`);
        continue;
      }
      // A scene line can change a block's value just for this one object, e.g. "distance": 90.
      const params: Params = { ...values };
      for (const key of Object.keys(values)) if (key in overrides) params[key] = overrides[key];
      obj.blocks.push({ behavior, params, state: {} });
    }
    this.objects.push(obj);
    for (const b of obj.blocks) b.behavior.setup?.(obj, b.params, b.state, this.game);
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
    for (const obj of [...this.objects]) {
      for (const b of obj.blocks) b.behavior.update?.(obj, b.params, b.state, dt, game);
    }
  }

  draw(ctx: CanvasRenderingContext2D, { assets }: Game): void {
    for (const o of this.objects) assets.draw(ctx, o.image, o.x, o.y, { flipX: o.flipX });
  }
}
