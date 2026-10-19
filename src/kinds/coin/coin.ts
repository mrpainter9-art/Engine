import type { Kind } from '../../core/world';
import data from './coin.json';

// Floats gently up and down in place. The player picks it up.
export const coin: Kind = {
  name: 'coin',
  image: data.image,
  setup(o) {
    o.data.baseY = o.y;
    o.data.time = Math.random() * 10; // so coins don't all bob in sync
  },
  update(o, dt) {
    const t = (o.data.time as number) + dt;
    o.data.time = t;
    o.y = (o.data.baseY as number) + Math.round(Math.sin(t * data.bobSpeed) * data.bobHeight);
  },
};
