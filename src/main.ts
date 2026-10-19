import { Assets, drawLoading } from './core/assets';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { setupScreen, type ScreenSettings } from './core/screen';
import { createGround } from './modules/ground/ground';
import { createPlayer } from './modules/player/player';
import controls from './controls.json';
import settings from './settings.json';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas, settings as ScreenSettings);
const assets = new Assets();
await assets.load((p) => drawLoading(ctx, p));

const game = { width: canvas.width, height: canvas.height, input: new Input(controls, canvas), assets };

// Register modules here. Removing a feature = removing its line. Earlier modules draw first (behind).
new Engine(ctx, game)
  .add(createGround())
  .add(createPlayer())
  .start();
