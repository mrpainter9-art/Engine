import type { Assets } from './assets';
import type { Camera } from './camera';
import type { Input } from './input';
import type { World } from './world';

// What the core offers to every module. New engine services get added here.
export interface Game {
  width: number; // game screen size in pixels (e.g. 320x180)
  height: number;
  input: Input;
  assets: Assets;
  world: World;
  camera: Camera;
}

// A module is one feature of the engine. It can hook into three moments:
// once at start (init), every frame to change state (update), every frame to draw (draw).
export interface Module {
  name: string;
  /** true = drawn fixed on the screen (scores, menus); otherwise drawn in the world and moves with the camera. */
  fixed?: boolean;
  init?(game: Game): void;
  // dt = seconds since the previous frame (about 0.0167 at 60 fps).
  update?(dt: number, game: Game): void;
  draw?(ctx: CanvasRenderingContext2D, game: Game): void;
}
