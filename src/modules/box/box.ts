import type { Module } from '../../core/module';
import data from './box.json';

// Step 1 demo: a box that crosses the screen at a constant speed (pixels per second)
// and wraps around to the left edge.
export function createBox(screenWidth: number, screenHeight: number): Module {
  let x = 0;
  const y = (screenHeight - data.size) / 2;

  return {
    name: 'box',
    update(dt) {
      x += data.speed * dt;
      if (x > screenWidth) x = -data.size;
    },
    draw(ctx) {
      ctx.fillStyle = data.color;
      ctx.fillRect(Math.round(x), Math.round(y), data.size, data.size);
    },
  };
}
