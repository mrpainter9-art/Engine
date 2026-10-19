import { Engine } from './core/engine';
import { createBox } from './modules/box/box';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Register modules here. Removing a feature = removing its line.
new Engine(ctx)
  .add(createBox(canvas.width, canvas.height))
  .start();
