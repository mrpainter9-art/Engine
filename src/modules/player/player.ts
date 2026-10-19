import type { Module } from '../../core/module';
import data from './player.json';

// Step 4 demo: a character picture moved with the arrow keys. It faces the way it last walked.
// Click to move it to the mouse.
export function createPlayer(): Module {
  let x = 0;
  let y = 0;
  let facingLeft = false;
  let w = 16;
  let h = 16;

  return {
    name: 'player',
    init({ width, height, assets }) {
      const img = assets.image(data.image);
      if (img) {
        w = img.width;
        h = img.height;
      }
      x = (width - w) / 2;
      y = (height - h) / 2;
    },
    update(dt, { input, width, height }) {
      let dx = 0;
      let dy = 0;
      if (input.isDown('left')) dx -= 1;
      if (input.isDown('right')) dx += 1;
      if (input.isDown('up')) dy -= 1;
      if (input.isDown('down')) dy += 1;
      if (dx && dy) {
        // Same speed diagonally as straight.
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }
      if (dx) facingLeft = dx < 0;
      x += dx * data.speed * dt;
      y += dy * data.speed * dt;

      if (input.wasClicked() && input.mouse) {
        x = input.mouse.x - w / 2;
        y = input.mouse.y - h / 2;
      }
      x = Math.max(0, Math.min(width - w, x));
      y = Math.max(0, Math.min(height - h, y));
    },
    draw(ctx, { assets, input }) {
      assets.draw(ctx, data.image, x, y, { flipX: facingLeft });

      // Mouse cursor as a small cross, so you can see where the game thinks the mouse is.
      if (input.mouse) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(input.mouse.x - 2, input.mouse.y, 5, 1);
        ctx.fillRect(input.mouse.x, input.mouse.y - 2, 1, 5);
      }
    },
  };
}
