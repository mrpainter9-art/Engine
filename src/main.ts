import { Assets, drawLoading } from './core/assets';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { setupScreen, type ScreenSettings } from './core/screen';
import { World, type KindDef, type Placement } from './core/world';
import { bob } from './behaviors/bob';
import { chase } from './behaviors/chase';
import { faceMovement } from './behaviors/face-movement';
import { moveWithKeys } from './behaviors/move-with-keys';
import { patrol } from './behaviors/patrol';
import { sendBackOnTouch } from './behaviors/send-back-on-touch';
import { stayInScreen } from './behaviors/stay-in-screen';
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
  .addBehavior(stayInScreen)
  .addBehavior(vanishOnTouch)
  .addBehavior(sendBackOnTouch)
  .load(scene.objects as Placement[]);

const game = { width: canvas.width, height: canvas.height, input: new Input(controls, canvas), assets, world };

// Register modules here. Removing a feature = removing its line. Earlier modules draw first (behind).
new Engine(ctx, game)
  .add(createGround())
  .add(world)
  .start();
