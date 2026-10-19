import type { Behavior } from '../core/world';

// Jump when the key is pressed while standing on something. Needs the gravity block after it.
// Values: power (higher = jumps higher), key (action name in controls.json), sound (played when jumping).
export const jump: Behavior = {
  type: 'jump',
  update(o, { power = 240, key = 'jump', sound = '' }, _s, _dt, { input, sound: audio }) {
    if (o.onGround && input.wasPressed(key)) {
      o.vy = -power;
      audio.play(sound);
    }
  },
};
