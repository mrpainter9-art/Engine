import { Assets, drawLoading } from './core/assets';
import { Camera } from './core/camera';
import { Engine } from './core/engine';
import { Input } from './core/input';
import type { Game } from './core/module';
import { Save } from './core/save';
import { scenes } from './core/scenes';
import { setupScreen, type ScreenSettings } from './core/screen';
import { Sound } from './core/sound';
import { World, type KindDef } from './core/world';
import { animateByMovement } from './behaviors/animate-by-movement';
import { bob } from './behaviors/bob';
import { cameraFollow } from './behaviors/camera-follow';
import { chase } from './behaviors/chase';
import { faceMovement } from './behaviors/face-movement';
import { gravity } from './behaviors/gravity';
import { jump } from './behaviors/jump';
import { moveWithKeys } from './behaviors/move-with-keys';
import { patrol } from './behaviors/patrol';
import { respawnOnFall } from './behaviors/respawn-on-fall';
import { sendBackOnTouch } from './behaviors/send-back-on-touch';
import { solid } from './behaviors/solid';
import { stayInWorld } from './behaviors/stay-in-world';
import { text } from './behaviors/text';
import { vanishOnTouch } from './behaviors/vanish-on-touch';
import { createBackground } from './modules/background/background';
import { createMusic } from './modules/music/music';
import { createRules } from './modules/rules/rules';
import controls from './controls.json';
import kinds from './kinds.json';
import settings from './settings.json';

document.title = settings.title;
const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas, settings as ScreenSettings);
const assets = new Assets();
const sound = new Sound(settings);
await Promise.all([assets.load((p) => drawLoading(ctx, p)), sound.load()]);

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
  .addBehavior(solid)
  .addBehavior(gravity)
  .addBehavior(jump)
  .addBehavior(respawnOnFall)
  .addBehavior(animateByMovement)
  .addBehavior(text);

const game: Game = {
  width: canvas.width,
  height: canvas.height,
  input: new Input(controls, canvas),
  assets,
  sound,
  save: new Save(settings.saveName),
  world,
  camera: new Camera(canvas.width, canvas.height, canvas.width, canvas.height),
  vars: {},
  paused: false,
  editing: false,
  scene: { objects: [] },
  sceneName: '',
  goTo: () => {}, // the engine fills this in
};

// Register modules here. Removing a feature = removing its line. Earlier modules draw first (behind).
const engine = new Engine(ctx, game, scenes)
  .add(createBackground())
  .add(world)
  .add(createRules())
  .add(createMusic());

// The editor (step 14) is only there while developing, not in exported games.
if (import.meta.env.DEV || __EDITOR_DEMO__) {
  const { createEditor } = await import('./editor/editor');
  engine.add(createEditor({ kinds: kinds as Record<string, KindDef>, scenes, canSave: import.meta.env.DEV }));
}

engine.start(settings.firstScene);

// Lets you look at the game from the browser console while developing (type "game").
if (import.meta.env.DEV) Object.assign(window, { game });
