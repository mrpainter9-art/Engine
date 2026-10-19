import type { Module } from '../../core/module';
import data from './box.json';

// Step 3 demo: move the box with the "left/right/up/down" actions, hold "action" to change
// its color, click to move it to the mouse. It stays inside the screen.
export function createBox(): Module {
  let x = 0;
  let y = 0;
  let color = data.color;

  return {
    name: 'box',
    init(game) {
      x = (game.width - data.size) / 2;
      y = (game.height - data.size) / 2;
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
      x += dx * data.speed * dt;
      y += dy * data.speed * dt;

      if (input.wasClicked() && input.mouse) {
        x = input.mouse.x - data.size / 2;
        y = input.mouse.y - data.size / 2;
      }
      x = Math.max(0, Math.min(width - data.size, x));
      y = Math.max(0, Math.min(height - data.size, y));

      color = input.isDown('action') ? data.actionColor : data.color;
    },
    draw(ctx, { input }) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), data.size, data.size);

      // Mouse cursor as a small cross, so you can see where the game thinks the mouse is.
      if (input.mouse) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(input.mouse.x - 2, input.mouse.y, 5, 1);
        ctx.fillRect(input.mouse.x, input.mouse.y - 2, 1, 5);
      }
    },
  };
}
