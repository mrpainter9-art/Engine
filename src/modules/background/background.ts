import type { Module } from '../../core/module';
import data from './background.json';

// The color behind everything (the sky). Floors and walls are objects in the scene now (step 8).
export function createBackground(): Module {
  return {
    name: 'background',
    fixed: true,
    draw(ctx, { width, height }) {
      ctx.fillStyle = data.color;
      ctx.fillRect(0, 0, width, height);
    },
  };
}
