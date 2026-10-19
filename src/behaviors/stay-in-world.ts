import type { Behavior } from '../core/world';

// Never leave the world (the whole map, not just the screen). Put it after the moving blocks.
export const stayInWorld: Behavior = {
  type: 'stay-in-world',
  update(o, _p, _s, _dt, { camera }) {
    o.x = Math.max(0, Math.min(camera.worldWidth - o.w, o.x));
    o.y = Math.max(0, Math.min(camera.worldHeight - o.h, o.y));
  },
};
