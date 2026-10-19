import type { Behavior } from '../core/world';

// When touching an object of another kind, send that object back to where it started.
// Values: target (kind name), sound.
export const sendBackOnTouch: Behavior = {
  type: 'send-back-on-touch',
  label: '닿으면 처음 자리로 보내기',
  defaults: { target: 'player', sound: '' },
  update(o, { target, sound }, _s, _dt, { world, sound: audio }) {
    for (const t of world.find(target)) {
      if (world.touching(o, t)) {
        t.x = t.startX;
        t.y = t.startY;
        t.vy = 0;
        audio.play(sound);
      }
    }
  },
};
