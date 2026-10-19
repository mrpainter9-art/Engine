import type { Module } from '../../core/module';
import data from './background.json';

// The color behind everything (the sky). A scene can pick its own with "background".
export function createBackground(): Module {
  return {
    name: 'background',
    fixed: true,
    draw(ctx, { width, height, scene }) {
      ctx.fillStyle = scene.background ?? data.color;
      ctx.fillRect(0, 0, width, height);
    },
  };
}
