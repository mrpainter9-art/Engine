import fontUrl from '/assets/fonts/Galmuri9.woff2?url';

// Text on the game screen, in a Korean pixel font (Galmuri9 by Lee Minseo, SIL Open Font License).
// The font is drawn at its native size so every letter stays on whole pixels.
const FONT = 'Galmuri9';
const SIZE = 10;

export async function loadFont(): Promise<void> {
  const face = new FontFace(FONT, `url(${fontUrl})`);
  document.fonts.add(await face.load());
}

export interface TextOptions {
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Dark outline color so text reads on any background. Empty string = no outline. */
  outline?: string;
}

/** Write text with its top edge at y. Use \n for more lines. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opt: TextOptions = {}): void {
  const { color = '#ffffff', align = 'left', outline = '#1d1826' } = opt;
  ctx.font = `${SIZE}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  text.split('\n').forEach((line, i) => {
    const lx = Math.round(x);
    const ly = Math.round(y) + i * (SIZE + 2);
    if (outline) {
      ctx.fillStyle = outline;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(line, lx + dx, ly + dy);
    }
    ctx.fillStyle = color;
    ctx.fillText(line, lx, ly);
  });
}
