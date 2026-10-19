import type { Assets } from './assets';
import type { Sound } from './sound';
import type { Camera } from './camera';
import type { SceneData } from './scenes';
import type { Input } from './input';
import type { Save } from './save';
import type { World } from './world';

// What the core offers to every module. New engine services get added here.
export interface Game {
  width: number; // game screen size in pixels (e.g. 320x180)
  height: number;
  input: Input;
  assets: Assets;
  sound: Sound;
  /** Numbers kept after the browser closes (best records). */
  save: Save;
  world: World;
  camera: Camera;
  /** Numbers the game keeps track of, e.g. { score: 3 }. Blocks add to them, rules read them. */
  vars: Record<string, number>;
  /** While true, objects stop moving (e.g. on the clear or game over screen). */
  paused: boolean;
  /** The scene being played and its file name. */
  scene: SceneData;
  sceneName: string;
  /** True while the editor is open: only modules marked whileEditing keep updating. */
  editing: boolean;
  /** Switch to another scene (or the same one, to start it over) after this frame. */
  goTo(name: string): void;
}

// A module is one feature of the engine. It can hook into three moments:
// once at start (init), when a scene starts (enter), every frame to change state (update), every frame to draw (draw).
export interface Module {
  name: string;
  /** true = drawn fixed on the screen (scores, menus); otherwise drawn in the world and moves with the camera. */
  fixed?: boolean;
  /** true = keeps updating while the game is being edited (the editor itself). */
  whileEditing?: boolean;
  init?(game: Game): void;
  /** Called every time a scene starts (also when the same scene starts over). */
  enter?(game: Game): void;
  // dt = seconds since the previous frame (about 0.0167 at 60 fps).
  update?(dt: number, game: Game): void;
  draw?(ctx: CanvasRenderingContext2D, game: Game): void;
}
