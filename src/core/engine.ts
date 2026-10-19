import type { Game, Module } from './module';
import type { SceneData } from './scenes';
import { warn } from './warn';

// Longest frame we accept. If the tab was hidden for a while, we don't want
// everything to jump forward by several seconds at once.
const MAX_DT = 0.1;

// The core: keeps the list of modules, runs the game loop and switches scenes. Nothing else.
export class Engine {
  private modules: Module[] = [];
  private lastTime = 0;
  private nextScene: string | null = null;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private game: Game,
    private scenes: Record<string, SceneData>,
  ) {
    game.goTo = (name) => (this.nextScene = name);
  }

  add(module: Module): this {
    this.modules.push(module);
    return this;
  }

  start(firstScene: string): void {
    for (const m of this.modules) m.init?.(this.game);
    this.enter(firstScene);
    requestAnimationFrame((t) => {
      this.lastTime = t;
      requestAnimationFrame(this.frame);
    });
  }

  // Start a scene: set the world size, then let every module set itself up for it.
  private enter(name: string): void {
    const scene = this.scenes[name];
    if (!scene) {
      warn(`"${name}" 장면이 없어요. src/scenes 폴더에 ${name}.json이 있는지 확인해 주세요.`);
      return;
    }
    const { game } = this;
    game.scene = scene;
    game.sceneName = name;
    game.paused = false;
    const size = scene.size ?? { width: game.width, height: game.height };
    game.camera.setWorld(size.width, size.height);
    for (const m of this.modules) m.enter?.(game);
  }

  // One turn of the loop: measure time, update everything, draw everything, ask for the next frame.
  private frame = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, MAX_DT);
    this.lastTime = time;

    for (const m of this.modules) m.update?.(dt, this.game);
    this.game.input.endFrame();
    if (this.nextScene !== null) {
      const name = this.nextScene;
      this.nextScene = null;
      this.enter(name);
    }

    const { ctx, game } = this;
    const { camera } = game;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, game.width, game.height);
    for (const m of this.modules) {
      // World modules are shifted by the camera; whole pixels keep the dots crisp.
      if (m.fixed) ctx.setTransform(1, 0, 0, 1, 0, 0);
      else ctx.setTransform(1, 0, 0, 1, -Math.round(camera.x), -Math.round(camera.y));
      m.draw?.(ctx, game);
    }

    requestAnimationFrame(this.frame);
  };
}
