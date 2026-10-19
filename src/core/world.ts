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
  /** Name of the animation playing now (from the kind's "animations"); "" = the kind's own picture. */
  anim: string;
  animTime: number;
  /** Speed in pixels per second, used by blocks like gravity and jump. */
  vx: number;
  vy: number;
  /** True while standing on something solid (set when falling is stopped). */
  onGround: boolean;
  /** Solid objects stop others that move with world.move (walls, floors, platforms). */
  solid: boolean;
  blocks: BlockInstance[];
  /** The scene line this object was made from (the editor uses it to move or change the object). */
  source: Placement;
  /** The node this one sits under (it moves along with it), or null. */
  parent: GameObject | null;
  /** Where it was when this frame started (children follow how far their parent moved). */
  frameX: number;
  frameY: number;
}

/** Values a block gets from kinds.json (and the scene), e.g. { speed: 30, distance: 60 }. */
export type Params = Record<string, any>;

// A behavior block: one small thing an object can do ("patrol", "bob", ...).
// One block = one file in src/behaviors/. Kinds are made by listing blocks in kinds.json.
export interface Behavior {
  type: string;
  /** Name shown in the editor. */
  label?: string;
  /** Every value the block reads, with the value used when kinds.json doesn't give one. */
  defaults?: Params;
  /** Values that must be one of a list, e.g. { axes: ['both', 'horizontal'] }. */
  choices?: Record<string, string[]>;
  setup?(obj: GameObject, params: Params, state: Record<string, any>, game: Game): void;
  update?(obj: GameObject, params: Params, state: Record<string, any>, dt: number, game: Game): void;
}

interface BlockInstance {
  behavior: Behavior;
  params: Params;
  state: Record<string, any>; // the block's own memory for this object
}

/** A picture that may be an animation strip: `frames` pictures side by side, played at `fps` per second. */
export interface Look {
  image: string;
  frames?: number;
  fps?: number;
}

/** A kind from kinds.json: a picture plus a list of blocks with their values, and optional named animations. */
export interface KindDef extends Look {
  blocks: ({ type: string } & Params)[];
  animations?: Record<string, Look>;
}

/**
 * One node of a scene: which kind (or "" for an empty node that only groups others), where,
 * and optional values that override the kind's. Children are placed relative to their parent
 * and move along with it.
 */
export interface Placement {
  kind: string;
  x: number;
  y: number;
  /** A name to tell nodes apart in the editor, e.g. "first enemy". */
  name?: string;
  children?: Placement[];
  [override: string]: unknown;
}

// The world keeps every object in one flat list, in drawing order (first = behind).
export class World implements Module {
  name = 'world';
  objects: GameObject[] = [];
  private behaviors = new Map<string, Behavior>();
  private game!: Game;

  constructor(private kinds: Record<string, KindDef>) {}

  addBehavior(b: Behavior): this {
    this.behaviors.set(b.type, b);
    return this;
  }

  /** Make an object from a scene node (and its children). parent = the object it sits under. */
  spawn(p: Placement, parent: GameObject | null = null): GameObject {
    const kind = p.kind ? this.kinds[p.kind] : undefined;
    if (p.kind && !kind) warn(`장면에 "${p.kind}"라는 종류가 있는데 kinds.json에 없어요.`);
    const { kind: name, ...overrides } = p;
    const x = p.x + (parent?.startX ?? 0);
    const y = p.y + (parent?.startY ?? 0);
    const img = kind ? this.game.assets.image(kind.image) : null;
    const frameWidth = img ? Math.floor(img.width / (kind?.frames ?? 1)) : 8;
    // A scene line may give w/h to make an object bigger than its picture (the picture repeats).
    const obj: GameObject = {
      kind: name, x, y, startX: x, startY: y,
      w: Number(p.w ?? frameWidth), h: Number(p.h ?? img?.height ?? 8),
      image: kind?.image ?? '', flipX: false, anim: '', animTime: 0,
      vx: 0, vy: 0, onGround: false, solid: false, blocks: [], source: p, parent, frameX: x, frameY: y,
    };
    for (const { type, ...values } of kind?.blocks ?? []) {
      const behavior = this.behaviors.get(type);
      if (!behavior) {
        warn(`"${name}"에 쓰인 "${type}" 블록이 없어요. 이름이 맞는지, main.ts에 등록됐는지 확인해 주세요.`);
        continue;
      }
      // A scene line can change a block's value just for this one object, e.g. "distance": 90.
      const params: Params = { ...behavior.defaults, ...values };
      for (const key of Object.keys(params)) if (key in overrides) params[key] = overrides[key];
      obj.blocks.push({ behavior, params, state: {} });
    }
    this.objects.push(obj);
    for (const b of obj.blocks) b.behavior.setup?.(obj, b.params, b.state, this.game);
    for (const child of p.children ?? []) this.spawn(child, obj);
    return obj;
  }

  /** Every block kinds.json can use (for the editor's block list). */
  behaviorList(): Behavior[] {
    return [...this.behaviors.values()];
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
  }

  /** A scene starts: place every object the scene file lists. */
  enter(game: Game): void {
    this.objects = [];
    for (const p of game.scene.objects) this.spawn(p);
  }

  update(dt: number, game: Game): void {
    if (game.paused) return;
    for (const o of this.objects) [o.frameX, o.frameY] = [o.x, o.y];
    // Copy the list so objects can be added or removed while we go through it.
    for (const obj of [...this.objects]) {
      const anim = obj.anim;
      for (const b of obj.blocks) b.behavior.update?.(obj, b.params, b.state, dt, game);
      obj.animTime = obj.anim === anim ? obj.animTime + dt : 0; // a new animation starts from its first picture
    }
    // Children move as far as their parent moved. Parents come first in the list, so it carries down.
    for (const o of this.objects) {
      if (!o.parent) continue;
      o.x += o.parent.x - o.parent.frameX;
      o.y += o.parent.y - o.parent.frameY;
    }
  }

  draw(ctx: CanvasRenderingContext2D, { assets }: Game): void {
    for (const o of this.objects) {
      if (!o.image) continue; // empty node: nothing to draw
      const look = this.look(o);
      const img = assets.image(look.image);
      const frames = look.frames ?? 1;
      if (img && frames === 1 && (o.w > img.width || o.h > img.height)) {
        assets.drawTiled(ctx, look.image, o.x, o.y, o.w, o.h);
        continue;
      }
      const frame = Math.floor(o.animTime * (look.fps ?? 8));
      assets.draw(ctx, look.image, o.x, o.y, { flipX: o.flipX, frames, frame });
    }
  }

  /** The picture to show now: the playing animation if the kind has it, otherwise the kind's own picture. */
  private look(o: GameObject): Look {
    const kind = this.kinds[o.kind];
    return kind?.animations?.[o.anim] ?? kind ?? { image: o.image };
  }
}
