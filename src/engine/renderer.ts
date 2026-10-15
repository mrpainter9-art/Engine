import { Node } from './node';
import { Node2D } from './nodes/node2d';
import { Sprite2D, ColorRect, Label } from './nodes/visual';
import { Parallax2D, CanvasModulate, CanvasLayer } from './nodes/scene-nodes';
import { Mat2D, type Vec2 } from './math';
import type { Textures } from './textures';

/**
 * What the canvas looks at. In the game this comes from the current Camera2D; in the editor from the editor's pan and zoom.
 * parallaxOrigin is the top-left of the game screen in world space; Parallax2D layers shift by it times (1 - scrollScale).
 */
export interface View {
  center: Vec2;
  zoom: number;
  width: number; // canvas size in pixels
  height: number;
  parallaxOrigin: Vec2;
  /** Game resolution (project viewport). */
  screenSize: Vec2;
  time: number;
  /** Where CanvasLayer content goes: the canvas itself in the game, the game-screen rectangle in the editor. */
  layerMatrix: Mat2D;
  editor?: boolean;
}

export function viewMatrix(v: View): Mat2D {
  return new Mat2D(v.zoom, 0, 0, v.zoom, v.width / 2 - v.center.x * v.zoom, v.height / 2 - v.center.y * v.zoom);
}

/** The node's own transform (position, rotation, scale, and the parallax shift for Parallax2D). */
export function localMatrix(n: Node, v: View): Mat2D {
  if (!(n instanceof Node2D)) return new Mat2D();
  let m = Mat2D.translate(n.position.x, n.position.y);
  if (n instanceof Parallax2D) {
    const o = parallaxShift(n, v);
    m = Mat2D.translate(o.x, o.y).mul(m);
  }
  return m.rotate(n.rotation).scale(n.scale.x, n.scale.y);
}

export function parallaxShift(p: Parallax2D, v: View): Vec2 {
  return {
    x: v.parallaxOrigin.x * (1 - p.scrollScale.x) + p.scrollOffset.x + p.autoscroll.x * v.time,
    y: v.parallaxOrigin.y * (1 - p.scrollScale.y) + p.scrollOffset.y + p.autoscroll.y * v.time,
  };
}

/** World-to-canvas matrix of a node (first copy, for repeated parallax layers). Used for picking and gizmos. */
export function globalMatrix(n: Node, v: View): Mat2D {
  const chain: Node[] = [];
  for (let p: Node | null = n; p; p = p.parent) chain.unshift(p);
  let m = chain.some((c) => c instanceof CanvasLayer) ? v.layerMatrix : viewMatrix(v);
  for (const c of chain) m = m.mul(localMatrix(c, v));
  return m;
}

const byZ = (a: Node, b: Node) => ((a as Node2D).zIndex || 0) - ((b as Node2D).zIndex || 0);

export class Renderer {
  constructor(public textures: Textures) {}

  /** underlay: the 3D layer (already at the canvas size), drawn over the background and under the 2D world. */
  render(ctx: CanvasRenderingContext2D, root: Node | null, v: View, background = '#000000', underlay: CanvasImageSource | null = null): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, v.width, v.height); }
    if (underlay) ctx.drawImage(underlay, 0, 0, v.width, v.height);
    if (!root) return;
    const layers: CanvasLayer[] = [];
    const modulates: CanvasModulate[] = [];
    this.drawTree(ctx, root, viewMatrix(v), v, 1, layers, modulates);
    const mod = modulates.find((m) => m.color.toLowerCase() !== '#ffffff');
    if (mod) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = mod.color;
      if (v.editor) {
        // the editor tints only the game screen, so the rest of the canvas stays readable
        const a = v.layerMatrix.apply({ x: 0, y: 0 }), b = v.layerMatrix.apply(v.screenSize);
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      } else ctx.fillRect(0, 0, v.width, v.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const L of layers.sort((a, b) => a.layer - b.layer))
      for (const c of [...L.children].sort(byZ)) this.drawTree(ctx, c, v.layerMatrix, v, 1, null, null);
  }

  private drawTree(ctx: CanvasRenderingContext2D, n: Node, parent: Mat2D, v: View, alpha: number,
    layers: CanvasLayer[] | null, modulates: CanvasModulate[] | null): void {
    if (n instanceof CanvasLayer) { if (n.visible && layers) layers.push(n); return; }
    if (n instanceof CanvasModulate) { modulates?.push(n); return; }
    if (n instanceof Node2D) {
      if (!n.visible) return;
      alpha *= n.opacity;
      if (alpha <= 0) return;
    }
    const copies = n instanceof Parallax2D ? this.repeatCopies(n, parent, v) : [{ x: 0, y: 0 }];
    for (const off of copies) {
      const m = parent.mul(Mat2D.translate(off.x, off.y)).mul(localMatrix(n, v));
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.globalAlpha = alpha;
      this.drawSelf(ctx, n, v);
      for (const c of [...n.children].sort(byZ)) this.drawTree(ctx, c, m, v, alpha, layers, modulates);
    }
  }

  /** Offsets that tile a repeating Parallax2D across the visible area. */
  private repeatCopies(p: Parallax2D, parent: Mat2D, v: View): Vec2[] {
    const rx = p.repeatSize.x, ry = p.repeatSize.y;
    if (!rx && !ry) return [{ x: 0, y: 0 }];
    const inv = parent.mul(localMatrix(p, v)).invert();
    const corners = [inv.apply({ x: 0, y: 0 }), inv.apply({ x: v.width, y: v.height })];
    const span = (r: number, a: number, b: number) => {
      if (!r) return [0];
      const lo = Math.floor(Math.min(a, b) / r) - 1, hi = Math.ceil(Math.max(a, b) / r) + 1, out: number[] = [];
      for (let k = lo; k <= hi && out.length < 64; k++) out.push(k * r);
      return out;
    };
    const out: Vec2[] = [];
    for (const x of span(rx, corners[0].x, corners[1].x)) for (const y of span(ry, corners[0].y, corners[1].y)) out.push({ x, y });
    return out;
  }

  private drawSelf(ctx: CanvasRenderingContext2D, n: Node, v: View): void {
    if (n instanceof Sprite2D) {
      const img = this.textures.get(n.texture);
      const b = n.localBounds((p) => this.textures.size(p));
      if (img) {
        ctx.save();
        ctx.translate(b.x + (n.flipH ? b.w : 0), b.y + (n.flipV ? b.h : 0));
        ctx.scale(n.flipH ? -1 : 1, n.flipV ? -1 : 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else if (v.editor) {
        ctx.strokeStyle = n.texture && this.textures.isMissing(n.texture) ? '#e05050' : '#8a8f9a';
        ctx.lineWidth = 1 / v.zoom;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    } else if (n instanceof ColorRect) {
      if (n.gradient) {
        const g = ctx.createLinearGradient(0, 0, 0, n.size.y);
        g.addColorStop(0, n.color);
        g.addColorStop(1, n.colorBottom);
        ctx.fillStyle = g;
      } else ctx.fillStyle = n.color;
      ctx.fillRect(0, 0, n.size.x, n.size.y);
    } else if (n instanceof Label) {
      ctx.font = `${n.fontSize}px ${n.font}`;
      ctx.fillStyle = n.color;
      ctx.textBaseline = 'top';
      ctx.textAlign = n.align;
      String(n.text).split('\n').forEach((line, i) => ctx.fillText(line, 0, i * n.fontSize * 1.2));
    }
  }
}
