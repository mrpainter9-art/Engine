import type { Behavior } from '../core/world';

// Others can't walk or fall through this object (floors, walls, platforms).
export const solid: Behavior = {
  type: 'solid',
  label: '단단함 (벽, 바닥)',
  setup(o) {
    o.solid = true;
  },
};
