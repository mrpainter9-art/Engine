// A module is one feature of the engine. It can hook into three moments:
// once at start (init), every frame to change state (update), every frame to draw (draw).
export interface Module {
  name: string;
  init?(): void;
  // dt = seconds since the previous frame (about 0.0167 at 60 fps).
  update?(dt: number): void;
  draw?(ctx: CanvasRenderingContext2D): void;
}
