import type { Behavior } from '../core/world';

// Pick an animation from how the object moves: standing still, walking, or in the air.
// Values: the animation names to use (from the kind's "animations"); "" = the kind's own picture.
// Put it after the moving blocks.
export const animateByMovement: Behavior = {
  type: 'animate-by-movement',
  label: '움직임에 맞춰 애니메이션',
  defaults: { idle: '', walk: 'walk', air: 'jump' },
  setup(o, _p, s) {
    s.lastX = o.x;
  },
  update(o, { idle, walk, air }, s) {
    const moved = Math.abs(o.x - s.lastX) > 0.01;
    s.lastX = o.x;
    if (o.vy !== 0 && !o.onGround) o.anim = air;
    else o.anim = moved ? walk : idle;
  },
};
