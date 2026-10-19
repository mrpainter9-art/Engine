import type { Behavior } from '../core/world';

// Move with the left/right/up/down actions, stopped by solid objects.
// Values: speed (pixels per second), axes ("both" = 4 directions, "horizontal" = left/right only, for jumping games).
export const moveWithKeys: Behavior = {
  type: 'move-with-keys',
  label: '방향키로 움직이기',
  defaults: { speed: 90, axes: 'both' },
  choices: { axes: ['both', 'horizontal'] },
  update(o, { speed, axes }, _s, dt, { input, world }) {
    let dx = 0;
    let dy = 0;
    if (input.isDown('left')) dx -= 1;
    if (input.isDown('right')) dx += 1;
    if (axes !== 'horizontal') {
      if (input.isDown('up')) dy -= 1;
      if (input.isDown('down')) dy += 1;
    }
    if (dx && dy) {
      // Same speed diagonally as straight.
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    world.move(o, dx * speed * dt, dy * speed * dt);
  },
};
