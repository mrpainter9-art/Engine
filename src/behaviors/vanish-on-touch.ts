import type { Behavior } from '../core/world';

// Disappear when an object of another kind touches this one (e.g. a coin picked up).
// Values: by (kind name), score (added to the score when it vanishes).
export const vanishOnTouch: Behavior = {
  type: 'vanish-on-touch',
  update(o, { by = 'player', score = 0 }, _s, _dt, { world, vars }) {
    if (world.find(by).some((t) => world.touching(o, t))) {
      world.remove(o);
      vars.score = (vars.score ?? 0) + score;
    }
  },
};
