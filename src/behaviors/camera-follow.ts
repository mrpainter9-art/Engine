import type { Behavior } from '../core/world';

// The camera follows this object. Values: speed (higher = catches up faster, 0 = sticks exactly).
export const cameraFollow: Behavior = {
  type: 'camera-follow',
  label: '카메라가 따라오기',
  defaults: { speed: 5 },
  setup(o, _p, _s, { camera }) {
    camera.jumpTo(o.x + o.w / 2, o.y + o.h / 2);
  },
  update(o, { speed }, _s, dt, { camera }) {
    camera.follow(o.x + o.w / 2, o.y + o.h / 2, speed, dt);
  },
};
