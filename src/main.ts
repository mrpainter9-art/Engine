import { Engine } from './core/engine';
import { setupScreen, type ScreenSettings } from './core/screen';
import { createBox } from './modules/box/box';
import { createTestPattern } from './modules/test-pattern/test-pattern';
import settings from './settings.json';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = setupScreen(canvas, settings as ScreenSettings);

// Register modules here. Removing a feature = removing its line.
new Engine(ctx)
  .add(createTestPattern(canvas.width, canvas.height))
  .add(createBox(canvas.width, canvas.height))
  .start();
