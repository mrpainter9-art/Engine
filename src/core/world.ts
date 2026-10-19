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
  /** Speed in pixels per second, used by blocks like gravity and jump. */
  vx: number;
  vy: number;
  /** True while standing on something solid (set when falling is stopped). */
  onGround: boolean;
  /** Solid objects stop others that move with world.move (walls, floors, platforms). */
  solid: boolean;
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
  private scene: Placement[] = [];
  private game!: Game;

  constructor(private kinds: Record<string, KindDef>) {}

  addBehavior(b: Behavior): this {
    this.behaviors.set(b.type, b);
    return this;
  }

  /** Objects to create when the game starts, usually from a scene file. */
  load(placements: Placement[]): this {
    this.scene.push(...placements);
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
    // A scene line may give w/h to make an object bigger than its picture (the picture repeats).
    const obj: GameObject = {
      kind: name, x, y, startX: x, startY: y,
      w: Number(p.w ?? img?.width ?? 16), h: Number(p.h ?? img?.height ?? 16),
      image: kind.image, flipX: false, vx: 0, vy: 0, onGround: false, solid: false, blocks: [],
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

  /** Is there a solid object at this point? */
  solidAt(x: number, y: number, except?: GameObject): boolean {
    return this.objects.some((s) => s.solid && s !== except && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
  }

  /**
   * Move an object, stopping it at solid objects. Moves sideways first, then up/down,
   * so sliding along a floor or wall works. Returns which direction was blocked.
   */
  move(o: GameObject, dx: number, dy: number): { x: boolean; y: boolean } {
    const hit = { x: false, y: false };
    if (dx) {
      o.x += dx;
      for (const s of this.solidsTouching(o)) {
        o.x = dx > 0 ? s.x - o.w : s.x + s.w;
        hit.x = true;
      }
    }
    if (dy) {
      o.y += dy;
      for (const s of this.solidsTouching(o)) {
        o.y = dy > 0 ? s.y - o.h : s.y + s.h;
        if (dy > 0) o.onGround = true;
        hit.y = true;
      }
    }
    return hit;
  }

  private solidsTouching(o: GameObject): GameObject[] {
    return this.objects.filter((s) => s.solid && s !== o && this.touching(o, s));
  }

  init(game: Game): void {
    this.game = game;
    this.start();
  }

  /** Put every object back the way the scene file says (used to play again). */
  restart(): void {
    this.objects = [];
    this.start();
  }

  private start(): void {
    for (const p of this.scene) this.spawn(p);
  }

  update(dt: number, game: Game): void {
    if (game.paused) return;
    // Copy the list so objects can be added or removed while we go through it.
    for (const obj of [...this.objects]) {
      for (const b of obj.blocks) b.behavior.update?.(obj, b.params, b.state, dt, game);
    }
  }

  draw(ctx: CanvasRenderingContext2D, { assets }: Game): void {
    for (const o of this.objects) {
      const img = assets.image(o.image);
      if (img && (o.w > img.width || o.h > img.height)) assets.drawTiled(ctx, o.image, o.x, o.y, o.w, o.h);
      else assets.draw(ctx, o.image, o.x, o.y, { flipX: o.flipX });
    }
  }
}
