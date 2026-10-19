import type { Kind } from '../../core/world';
import data from './slime.json';

// Walks back and forth. A scene can give each slime its own "distance" or "speed".
export const slime: Kind = {
  name: 'slime',
  image: data.image,
  setup(o) {
    o.data.startX = o.x;
    o.data.dir = 1;
    o.data.speed ??= data.speed;
    o.data.distance ??= data.distance;
  },
  update(o, dt) {
    const start = o.data.startX as number;
    const dist = o.data.distance as number;
    o.x += (o.data.dir as number) * (o.data.speed as number) * dt;
    if (o.x > start + dist) o.data.dir = -1;
    if (o.x < start) o.data.dir = 1;
    o.flipX = o.data.dir === -1;
  },
};
