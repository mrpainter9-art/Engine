import type { Behavior } from '../core/world';

// Never leave the screen. Put it after the moving blocks.
export const stayInScreen: Behavior = {
  type: 'stay-in-screen',
  update(o, _p, _s, _dt, { width, height }) {
    o.x = Math.max(0, Math.min(width - o.w, o.x));
    o.y = Math.max(0, Math.min(height - o.h, o.y));
  },
};
