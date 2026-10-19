import type { Module } from '../../core/module';
import data from './ground.json';

// Step 4 demo: a sky color and one small tile picture repeated along the bottom of the screen.
export function createGround(): Module {
  return {
    name: 'ground',
    draw(ctx, { width, height, assets }) {
      ctx.fillStyle = data.skyColor;
      ctx.fillRect(0, 0, width, height);

      const tile = assets.image(data.image);
      const size = tile?.width ?? 16;
      for (let row = 0; row < data.rows; row++) {
        for (let x = 0; x < width; x += size) {
          assets.draw(ctx, data.image, x, height - size * (row + 1));
        }
      }
    },
  };
}
