import type { Behavior } from '../core/world';

// Look left when moving left, right when moving right. Put it after the moving blocks.
export const faceMovement: Behavior = {
  type: 'face-movement',
  label: '가는 쪽 바라보기',
  setup(o, _p, s) {
    s.lastX = o.x;
  },
  update(o, _p, s) {
    if (o.x < s.lastX) o.flipX = true;
    if (o.x > s.lastX) o.flipX = false;
    s.lastX = o.x;
  },
};
