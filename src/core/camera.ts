// The camera decides which part of the world is on screen. The world can be bigger than the
// screen (its size comes from the scene file); the camera never shows outside the world.
export class Camera {
  x = 0; // top-left corner of the view, in world pixels
  y = 0;

  constructor(
    public viewWidth: number,
    public viewHeight: number,
    public worldWidth: number,
    public worldHeight: number,
  ) {}

  /**
   * Move toward a point so it ends up in the middle of the screen.
   * speed: how quickly it catches up (higher = snappier, 0 = instantly).
   */
  follow(cx: number, cy: number, speed: number, dt: number): void {
    const k = speed <= 0 ? 1 : 1 - Math.exp(-speed * dt);
    this.x += (cx - this.viewWidth / 2 - this.x) * k;
    this.y += (cy - this.viewHeight / 2 - this.y) * k;
    this.clamp();
  }

  /** Jump straight to a point (used when the game starts). */
  jumpTo(cx: number, cy: number): void {
    this.x = cx - this.viewWidth / 2;
    this.y = cy - this.viewHeight / 2;
    this.clamp();
  }

  private clamp(): void {
    this.x = Math.max(0, Math.min(this.worldWidth - this.viewWidth, this.x));
    this.y = Math.max(0, Math.min(this.worldHeight - this.viewHeight, this.y));
  }
}
