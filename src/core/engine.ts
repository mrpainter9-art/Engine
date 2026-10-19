import type { Module } from './module';

// Longest frame we accept. If the tab was hidden for a while, we don't want
// everything to jump forward by several seconds at once.
const MAX_DT = 0.1;

// The core: keeps the list of modules and runs the game loop. Nothing else.
export class Engine {
  private modules: Module[] = [];
  private lastTime = 0;

  constructor(private ctx: CanvasRenderingContext2D) {}

  add(module: Module): this {
    this.modules.push(module);
    return this;
  }

  start(): void {
    for (const m of this.modules) m.init?.();
    requestAnimationFrame((t) => {
      this.lastTime = t;
      requestAnimationFrame(this.frame);
    });
  }

  // One turn of the loop: measure time, update everything, draw everything, ask for the next frame.
  private frame = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, MAX_DT);
    this.lastTime = time;

    for (const m of this.modules) m.update?.(dt);

    const { canvas } = this.ctx;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const m of this.modules) m.draw?.(this.ctx);

    requestAnimationFrame(this.frame);
  };
}
