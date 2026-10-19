import fontUrl from '/assets/fonts/Galmuri9.woff2?url';
import { readBytes } from './files';

// Text on the game screen, in a Korean pixel font (Galmuri9 by Lee Minseo, SIL Open Font License).
// The font is drawn at its native size so every letter stays on whole pixels.
const FONT = 'Galmuri9';
const SIZE = 10;

export async function loadFont(): Promise<void> {
  const face = new FontFace(FONT, await readBytes(fontUrl));
  document.fonts.add(await face.load());
}

export interface TextOptions {
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Dark outline color so text reads on any background. Empty string = no outline. */
  outline?: string;
  /** Whole-number size: 1 = normal, 2 = twice as big (still crisp). */
  scale?: number;
}

/** Write text with its top edge at y. Use \n for more lines. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opt: TextOptions = {}): void {
  const { color = '#ffffff', align = 'left', outline = '#1d1826' } = opt;
  const k = Math.max(1, Math.round(opt.scale ?? 1));
  ctx.font = `${SIZE * k}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  text.split('\n').forEach((line, i) => {
    const lx = Math.round(x);
    const ly = Math.round(y) + i * (SIZE + 2) * k;
    if (outline) {
      ctx.fillStyle = outline;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(line, lx + dx * k, ly + dy * k);
    }
    ctx.fillStyle = color;
    ctx.fillText(line, lx, ly);
  });
}
