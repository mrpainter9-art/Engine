import type { Behavior } from '../core/world';

// When touching an object of another kind, send that object back to where it started.
// Values: target (kind name).
export const sendBackOnTouch: Behavior = {
  type: 'send-back-on-touch',
  update(o, { target = 'player' }, _s, _dt, { world }) {
    for (const t of world.find(target)) {
      if (world.touching(o, t)) {
        t.x = t.startX;
        t.y = t.startY;
      }
    }
  },
};
