import type { Behavior } from '../core/world';

// Jump when the key is pressed while standing on something. Needs the gravity block after it.
// Values: power (higher = jumps higher), key (action name in controls.json).
export const jump: Behavior = {
  type: 'jump',
  update(o, { power = 240, key = 'jump' }, _s, _dt, { input }) {
    if (o.onGround && input.wasPressed(key)) o.vy = -power;
  },
};
