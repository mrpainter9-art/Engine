import type { Kind } from '../../core/world';
import data from './player.json';

// Moved with the arrow keys, faces the way it walks, picks up coins.
// Touching a slime sends it back to where it started. Click to move it to the mouse.
export const player: Kind = {
  name: 'player',
  image: data.image,
  setup(o) {
    o.data.startX = o.x;
    o.data.startY = o.y;
  },
  update(o, dt, { input, width, height, world }) {
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
    if (dx) o.flipX = dx < 0;
    o.x += dx * data.speed * dt;
    o.y += dy * data.speed * dt;

    if (input.wasClicked() && input.mouse) {
      o.x = input.mouse.x - o.w / 2;
      o.y = input.mouse.y - o.h / 2;
    }
    o.x = Math.max(0, Math.min(width - o.w, o.x));
    o.y = Math.max(0, Math.min(height - o.h, o.y));

    for (const coin of world.find('coin')) {
      if (world.touching(o, coin)) world.remove(coin);
    }
    for (const slime of world.find('slime')) {
      if (world.touching(o, slime)) {
        o.x = o.data.startX as number;
        o.y = o.data.startY as number;
      }
    }
  },
};
