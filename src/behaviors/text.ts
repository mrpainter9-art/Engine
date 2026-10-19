import { drawText, measureText } from '../core/text';
import type { Behavior } from '../core/world';

// Shows words. The object's x, y is where the text starts (left), its middle (center) or its end (right).
// {name} shows a number from the game, e.g. {score}, or a saved one, e.g. {best-stage1}.
// screen: true keeps it fixed on the screen (titles, hints); false puts it on the map and it scrolls away.
export const text: Behavior = {
  type: 'text',
  label: '글자',
  defaults: { text: '글자', align: 'left', color: '#ffffff', scale: 1, screen: true },
  choices: { align: ['left', 'center', 'right'] },
  setup(o, _p, s) {
    // The point the text lines up on (screen pixels when fixed on the screen). The object's box is kept around it.
    s.x = o.x;
    s.y = o.y;
    s.boxX = o.x;
    s.boxY = o.y;
  },
  draw(ctx, o, p, s, { vars, save, camera }) {
    // Anything else that moved the object (a parent, the editor) moves the text too.
    s.x += o.x - s.boxX;
    s.y += o.y - s.boxY;
    const words = String(p.text).replace(/\{([\w-]+)\}/g, (_, key) => String(vars[key] ?? save.get(key)));
    const size = measureText(words, p.scale);
    const shift = p.align === 'center' ? size.w / 2 : p.align === 'right' ? size.w : 0;
    const x = s.x + (p.screen ? camera.x : 0);
    const y = s.y + (p.screen ? camera.y : 0);
    o.w = Math.max(1, size.w);
    o.h = size.h;
    o.x = s.boxX = x - shift;
    o.y = s.boxY = y;
    drawText(ctx, words, x, y, { align: p.align, color: p.color, scale: p.scale });
  },
};
