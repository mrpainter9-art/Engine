import type { Behavior } from '../core/world';

// Never leave the world (the whole map, not just the screen). Put it after the moving blocks.
// Values: bottom (false = may fall out of the bottom, e.g. into a pit).
export const stayInWorld: Behavior = {
  type: 'stay-in-world',
  label: '맵 밖으로 안 나가기',
  defaults: { bottom: true },
  update(o, { bottom }, _s, _dt, { camera }) {
    o.x = Math.max(0, Math.min(camera.worldWidth - o.w, o.x));
    o.y = Math.max(0, bottom ? Math.min(camera.worldHeight - o.h, o.y) : o.y);
  },
};
