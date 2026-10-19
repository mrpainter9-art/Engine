// Images: every picture inside the assets/ folder is found automatically and can be used by
// its file name without the extension ("assets/player.png" -> "player", "assets/ui/heart.png" -> "ui/heart").
const files = import.meta.glob('/assets/**/*.{png,jpg,jpeg,gif,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface DrawOptions {
  flipX?: boolean; // mirror left-right (e.g. a character facing the other way)
}

export class Assets {
  private images = new Map<string, HTMLImageElement>();
  private missing = new Set<string>();

  /** Load every image before the game starts. onProgress gets 0..1. */
  async load(onProgress: (done: number) => void): Promise<void> {
    const entries = Object.entries(files);
    let done = 0;
    onProgress(entries.length ? 0 : 1);
    await Promise.all(
      entries.map(async ([path, url]) => {
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
    );
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
    if (opt.flipX) {
      ctx.save();
      ctx.translate(x + img.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y);
    }
  }

  // Tell the person making the game, in plain words, which picture is missing.
  private reportMissing(name: string): void {
    if (this.missing.has(name)) return;
    this.missing.add(name);
    let bar = document.getElementById('asset-warning');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'asset-warning';
      bar.style.cssText =
        'position:fixed;left:0;right:0;top:0;padding:8px 12px;background:#b3261e;color:#fff;font:14px sans-serif';
      document.body.appendChild(bar);
    }
    bar.textContent = `그림을 못 찾았어요: ${[...this.missing].join(', ')} (assets 폴더에 같은 이름의 그림이 있는지 확인해 주세요)`;
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
