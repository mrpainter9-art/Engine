import type { Behavior } from '../core/world';

// Float up and down in place. Values: height (pixels), speed.
export const bob: Behavior = {
  type: 'bob',
  setup(_o, _p, s) {
    s.time = Math.random() * 10; // so objects don't all bob in sync
  },
  update(o, { height = 2, speed = 3 }, s, dt) {
    s.time += dt;
    o.y = o.startY + Math.round(Math.sin(s.time * speed) * height);
  },
};
