import type { Behavior } from '../core/world';

// Walk right and back. Values: speed, distance (how far right of the start to go).
export const patrol: Behavior = {
  type: 'patrol',
  setup(_o, _p, s) {
    s.dir = 1;
  },
  update(o, { speed = 30, distance = 60 }, s, dt) {
    o.x += s.dir * speed * dt;
    if (o.x > o.startX + distance) s.dir = -1;
    if (o.x < o.startX) s.dir = 1;
  },
};
