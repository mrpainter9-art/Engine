import type { Behavior } from '../core/world';

// Move with the left/right/up/down actions. Values: speed (pixels per second).
export const moveWithKeys: Behavior = {
  type: 'move-with-keys',
  update(o, { speed = 90 }, _s, dt, { input }) {
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
    o.x += dx * speed * dt;
    o.y += dy * speed * dt;
  },
};
