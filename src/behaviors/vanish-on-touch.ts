import type { Behavior } from '../core/world';

// Disappear when an object of another kind touches this one (e.g. a coin picked up).
// Values: by (kind name), score (added to the score when it vanishes), sound.
export const vanishOnTouch: Behavior = {
  type: 'vanish-on-touch',
  label: '닿으면 사라지기',
  defaults: { by: 'player', score: 0, sound: '' },
  update(o, { by, score, sound }, _s, _dt, { world, vars, sound: audio }) {
    if (world.find(by).some((t) => world.touching(o, t))) {
      world.remove(o);
      vars.score = (vars.score ?? 0) + score;
      audio.play(sound);
    }
  },
};
