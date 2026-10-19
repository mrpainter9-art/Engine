import type { Behavior } from '../core/world';

// Walk right and back. Turns around at walls too.
// Values: speed, distance (how far right of the start to go; 0 = until a wall),
// edges (true = also turn around before walking off a ledge).
export const patrol: Behavior = {
  type: 'patrol',
  setup(_o, _p, s) {
    s.dir = 1;
  },
  update(o, { speed = 30, distance = 60, edges = false }, s, dt, { world }) {
    if (world.move(o, s.dir * speed * dt, 0).x) s.dir = -s.dir;
    if (distance > 0 && o.x > o.startX + distance) s.dir = -1;
    if (distance > 0 && o.x < o.startX) s.dir = 1;
    if (edges && o.onGround) {
      const footX = s.dir > 0 ? o.x + o.w : o.x - 1;
      if (!world.solidAt(footX, o.y + o.h + 1, o)) s.dir = -s.dir;
    }
  },
};
