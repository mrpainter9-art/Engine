import { loadFont } from './text';
import { warn } from './warn';

// Images: every picture inside the assets/ folder is found automatically and can be used by
// its file name without the extension ("assets/player.png" -> "player", "assets/ui/heart.png" -> "ui/heart").
const files = import.meta.glob('/assets/**/*.{png,jpg,jpeg,gif,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface DrawOptions {
  flipX?: boolean; // mirror left-right (e.g. a character facing the other way)
  /** For animation strips: the picture is `frames` same-size pictures side by side; draw number `frame` (from 0). */
  frames?: number;
  frame?: number;
}

export class Assets {
  private images = new Map<string, HTMLImageElement>();
  private missing = new Set<string>();

  /** Load every image before the game starts. onProgress gets 0..1. */
  async load(onProgress: (done: number) => void): Promise<void> {
    const entries = Object.entries(files);
    let done = 0;
    onProgress(entries.length ? 0 : 1);
    await Promise.all([
      loadFont().catch(() => warn('글꼴을 불러오지 못했어요: assets/fonts/Galmuri9.woff2')),
      ...entries.map(async ([path, url]) => {
        const img = new Image();
        img.src = url;
        try {
          await img.decode();
          this.images.set(path.replace(/^\/assets\//, '').replace(/\.\w+$/, ''), img);
        } catch {
          console.warn(`Could not read image: ${path}`);
        }
        onProgress(++done / entries.length);
      }),
    ]);
  }

  image(name: string): HTMLImageElement | null {
    return this.images.get(name) ?? null;
  }

  /** Draw an image at a pixel position. A missing image shows as a pink box instead of crashing. */
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, opt: DrawOptions = {}): void {
    const img = this.images.get(name);
    x = Math.round(x);
    y = Math.round(y);
    if (!img) {
      this.reportMissing(name);
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(x, y, 16, 16);
      return;
    }
    const frames = Math.max(1, opt.frames ?? 1);
    const w = Math.floor(img.width / frames);
    const sx = ((opt.frame ?? 0) % frames) * w;
    if (opt.flipX) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, 0, w, img.height, 0, 0, w, img.height);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx, 0, w, img.height, x, y, w, img.height);
    }
  }

  /** Fill a w x h box by repeating an image (floors, walls, long platforms). */
  drawTiled(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number): void {
    const img = this.images.get(name);
    if (!img) return this.draw(ctx, name, x, y);
    x = Math.round(x);
    y = Math.round(y);
    for (let ty = 0; ty < h; ty += img.height) {
      for (let tx = 0; tx < w; tx += img.width) {
        const cw = Math.min(img.width, w - tx);
        const ch = Math.min(img.height, h - ty);
        ctx.drawImage(img, 0, 0, cw, ch, x + tx, y + ty, cw, ch);
      }
    }
  }

  private reportMissing(name: string): void {
    if (this.missing.has(name)) return;
    this.missing.add(name);
    warn(`그림을 못 찾았어요: ${name} (assets 폴더에 같은 이름의 그림이 있는지 확인해 주세요)`);
  }
}

/** Simple loading bar drawn on the game screen while images load. */
export function drawLoading(ctx: CanvasRenderingContext2D, progress: number): void {
  const { width, height } = ctx.canvas;
  const w = Math.floor(width / 2);
  const x = Math.floor((width - w) / 2);
  const y = Math.floor(height / 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, Math.round(w * progress), 4);
}
