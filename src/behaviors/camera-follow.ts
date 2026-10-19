import type { Behavior } from '../core/world';

// The camera follows this object. Values: speed (higher = catches up faster, 0 = sticks exactly).
export const cameraFollow: Behavior = {
  type: 'camera-follow',
  setup(o, _p, _s, { camera }) {
    camera.jumpTo(o.x + o.w / 2, o.y + o.h / 2);
  },
  update(o, { speed = 5 }, _s, dt, { camera }) {
    camera.follow(o.x + o.w / 2, o.y + o.h / 2, speed, dt);
  },
};
