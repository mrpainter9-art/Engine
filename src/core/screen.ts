// The game always draws into a small canvas (e.g. 320x180). This file only decides how big
// that canvas looks on the page, so pixels stay square and crisp at any window size.
export type Scaling =
  | 'sharp' // whole-number zoom (x2, x3, ...): every pixel the same size, may leave borders
  | 'fill'; // largest zoom that fits: fewer borders, pixels can be slightly uneven

export interface ScreenSettings {
  screenWidth: number;
  screenHeight: number;
  scaling: Scaling;
  borderColor: string;
}

export function setupScreen(canvas: HTMLCanvasElement, s: ScreenSettings): CanvasRenderingContext2D {
  canvas.width = s.screenWidth;
  canvas.height = s.screenHeight;
  canvas.style.imageRendering = 'pixelated';
  document.body.style.background = s.borderColor;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const resize = () => {
    // Work in device pixels so a "x3" zoom is really 3 screen pixels on high-DPI displays.
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((window.innerWidth * dpr) / s.screenWidth, (window.innerHeight * dpr) / s.screenHeight);
    const zoom = s.scaling === 'sharp' ? Math.max(1, Math.floor(fit)) : fit;
    canvas.style.width = `${(s.screenWidth * zoom) / dpr}px`;
    canvas.style.height = `${(s.screenHeight * zoom) / dpr}px`;
    canvas.dataset.zoom = zoom.toFixed(2);
  };
  window.addEventListener('resize', resize);
  resize();
  return ctx;
}
