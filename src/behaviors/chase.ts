import type { Behavior } from '../core/world';

// Move toward the nearest object of another kind when it is close enough.
// Values: target (kind name), speed, range (pixels; 0 = always chase).
export const chase: Behavior = {
  type: 'chase',
  update(o, { target = 'player', speed = 20, range = 0 }, _s, dt, { world }) {
    let best = null;
    let bestDist = Infinity;
    for (const t of world.find(target)) {
      const d = Math.hypot(t.x - o.x, t.y - o.y);
      if (d < bestDist) [best, bestDist] = [t, d];
    }
    if (!best || bestDist < 1 || (range > 0 && bestDist > range)) return;
    world.move(o, ((best.x - o.x) / bestDist) * speed * dt, ((best.y - o.y) / bestDist) * speed * dt);
  },
};
