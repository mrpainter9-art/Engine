import type { Module } from '../../core/module';
import { drawText } from '../../core/text';

// Draws the scene's "texts" fixed on the screen (titles, hints).
// {name} shows a number from the game, e.g. {score}, or a saved one, e.g. {best-stage1}.
export function createTexts(): Module {
  return {
    name: 'texts',
    fixed: true,
    draw(ctx, { scene, vars, save }) {
      for (const t of scene.texts ?? []) {
        const text = t.text.replace(/\{([\w-]+)\}/g, (_, key) => String(vars[key] ?? save.get(key)));
        drawText(ctx, text, t.x, t.y, { align: t.align, color: t.color, scale: t.scale });
      }
    },
  };
}
