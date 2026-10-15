export interface Vec2 { x: number; y: number }

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y });
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deep copy for the plain JSON values that node properties hold. */
export function clone<T>(v: T): T {
  return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 2D affine matrix in canvas order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export class Mat2D {
  constructor(public a = 1, public b = 0, public c = 0, public d = 1, public e = 0, public f = 0) {}
  static translate(x: number, y: number) { return new Mat2D(1, 0, 0, 1, x, y); }
  mul(m: Mat2D): Mat2D {
    return new Mat2D(
      this.a * m.a + this.c * m.b, this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d, this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e, this.b * m.e + this.d * m.f + this.f,
    );
  }
  translate(x: number, y: number) { return this.mul(Mat2D.translate(x, y)); }
  rotate(deg: number) { const r = (deg * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r); return this.mul(new Mat2D(cs, sn, -sn, cs, 0, 0)); }
  scale(x: number, y: number) { return this.mul(new Mat2D(x, 0, 0, y, 0, 0)); }
  apply(p: Vec2): Vec2 { return { x: this.a * p.x + this.c * p.y + this.e, y: this.b * p.x + this.d * p.y + this.f }; }
  invert(): Mat2D {
    const det = this.a * this.d - this.b * this.c || 1e-9;
    return new Mat2D(this.d / det, -this.b / det, -this.c / det, this.a / det, (this.c * this.f - this.d * this.e) / det, (this.b * this.e - this.a * this.f) / det);
  }
}
