import { Assets, drawLoading } from './core/assets';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { setupScreen, type ScreenSettings } from './core/screen';
import { World, type Placement } from './core/world';
import { coin } from './kinds/coin/coin';
import { player } from './kinds/player/player';
import { slime } from './kinds/slime/slime';
import { createGround } from './modules/ground/ground';
import controls from './controls.json';
import scene from './scenes/main.json';
import settings from './settings.json';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas, settings as ScreenSettings);
const assets = new Assets();
await assets.load((p) => drawLoading(ctx, p));

// Kinds of objects the game knows. A scene can only place kinds listed here.
const world = new World().addKind(player).addKind(coin).addKind(slime).load(scene.objects as Placement[]);

const game = { width: canvas.width, height: canvas.height, input: new Input(controls, canvas), assets, world };

// Register modules here. Removing a feature = removing its line. Earlier modules draw first (behind).
new Engine(ctx, game)
  .add(createGround())
  .add(world)
  .start();
