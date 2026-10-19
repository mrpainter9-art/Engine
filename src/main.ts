import { Engine } from './core/engine';
import { Input } from './core/input';
import { setupScreen, type ScreenSettings } from './core/screen';
import { createBox } from './modules/box/box';
import { createTestPattern } from './modules/test-pattern/test-pattern';
import controls from './controls.json';
import settings from './settings.json';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas, settings as ScreenSettings);
const game = { width: canvas.width, height: canvas.height, input: new Input(controls, canvas) };

// Register modules here. Removing a feature = removing its line.
new Engine(ctx, game)
  .add(createTestPattern())
  .add(createBox())
  .start();
