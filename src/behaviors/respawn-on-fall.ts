import type { Behavior } from '../core/world';

// Falling off the bottom of the map puts the object back where it started.
export const respawnOnFall: Behavior = {
  type: 'respawn-on-fall',
  update(o, _p, _s, _dt, { camera }) {
    if (o.y > camera.worldHeight) {
      o.x = o.startX;
      o.y = o.startY;
      o.vy = 0;
    }
  },
};
