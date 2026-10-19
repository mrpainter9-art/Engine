import { Assets, drawLoading } from './core/assets';
import { Camera } from './core/camera';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { setupScreen, type ScreenSettings } from './core/screen';
import { World, type KindDef, type Placement } from './core/world';
import { bob } from './behaviors/bob';
import { cameraFollow } from './behaviors/camera-follow';
import { chase } from './behaviors/chase';
import { faceMovement } from './behaviors/face-movement';
import { moveWithKeys } from './behaviors/move-with-keys';
import { patrol } from './behaviors/patrol';
import { sendBackOnTouch } from './behaviors/send-back-on-touch';
import { stayInWorld } from './behaviors/stay-in-world';
import { vanishOnTouch } from './behaviors/vanish-on-touch';
import { createGround } from './modules/ground/ground';
import controls from './controls.json';
import kinds from './kinds.json';
import scene from './scenes/main.json';
import settings from './settings.json';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas, settings as ScreenSettings);
const assets = new Assets();
await assets.load((p) => drawLoading(ctx, p));

// Behavior blocks that kinds.json can use. A new block = one file in behaviors/ + one line here.
const world = new World(kinds as Record<string, KindDef>)
  .addBehavior(moveWithKeys)
  .addBehavior(patrol)
  .addBehavior(bob)
  .addBehavior(chase)
  .addBehavior(faceMovement)
  .addBehavior(stayInWorld)
  .addBehavior(cameraFollow)
  .addBehavior(vanishOnTouch)
  .addBehavior(sendBackOnTouch)
  .load(scene.objects as Placement[]);

// The scene decides how big the world is; without a size it is one screen.
const size = scene.size ?? { width: canvas.width, height: canvas.height };
const camera = new Camera(canvas.width, canvas.height, size.width, size.height);

const game = { width: canvas.width, height: canvas.height, input: new Input(controls, canvas), assets, world, camera };

// Register modules here. Removing a feature = removing its line. Earlier modules draw first (behind).
new Engine(ctx, game)
  .add(createGround())
  .add(world)
  .start();
