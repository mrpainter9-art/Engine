import type { Behavior } from '../core/world';

// Fall down until landing on something solid. Values: strength (how fast falling speeds up), maxFall (top falling speed).
export const gravity: Behavior = {
  type: 'gravity',
  update(o, { strength = 600, maxFall = 300 }, _s, dt, { world }) {
    o.vy = Math.min(o.vy + strength * dt, maxFall);
    o.onGround = false;
    if (world.move(o, 0, o.vy * dt).y) o.vy = 0; // landed, or bumped a ceiling
  },
};
