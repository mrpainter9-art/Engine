import type { Behavior } from '../core/world';

// Float up and down. Values: height (pixels), speed. Works together with blocks that move the object.
export const bob: Behavior = {
  type: 'bob',
  label: '둥실둥실',
  defaults: { height: 2, speed: 3 },
  setup(_o, _p, s) {
    s.time = Math.random() * 10; // so objects don't all bob in sync
    s.offset = 0;
  },
  update(o, { height, speed }, s, dt) {
    s.time += dt;
    const offset = Math.round(Math.sin(s.time * speed) * height);
    o.y += offset - s.offset; // only add the change, so other blocks can still move it
    s.offset = offset;
  },
};
