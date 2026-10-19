import type { Behavior } from '../core/world';

// Disappear when an object of another kind touches this one (e.g. a coin picked up).
// Values: by (kind name).
export const vanishOnTouch: Behavior = {
  type: 'vanish-on-touch',
  update(o, { by = 'player' }, _s, _dt, { world }) {
    if (world.find(by).some((t) => world.touching(o, t))) world.remove(o);
  },
};
