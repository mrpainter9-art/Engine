import type { Module } from '../../core/module';
import data from './ground.json';

// A sky color and one small tile picture repeated along the bottom of the whole world.
export function createGround(): Module {
  return {
    name: 'ground',
    draw(ctx, { width, height, assets, camera }) {
      ctx.fillStyle = data.skyColor;
      ctx.fillRect(Math.round(camera.x), Math.round(camera.y), width, height);

      const tile = assets.image(data.image);
      const size = tile?.width ?? 16;
      // Only draw the tiles that are on screen.
      const first = Math.floor(camera.x / size) * size;
      for (let row = 0; row < data.rows; row++) {
        for (let x = first; x < camera.x + width; x += size) {
          assets.draw(ctx, data.image, x, camera.worldHeight - size * (row + 1));
        }
      }
    },
  };
}
