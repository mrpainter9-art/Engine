/** Loads and caches images by res:// path. get() returns null until the image has arrived, then onLoad fires so the view can redraw. */
export class Textures {
  private cache = new Map<string, HTMLImageElement>();
  private failed = new Set<string>();
  constructor(private resolve: (path: string) => string, public onLoad: () => void = () => {}) {}

  get(path: string): HTMLImageElement | null {
    if (!path) return null;
    let img = this.cache.get(path);
    if (!img) {
      img = new Image();
      img.onload = () => this.onLoad();
      img.onerror = () => { this.failed.add(path); this.onLoad(); };
      img.src = this.resolve(path);
      this.cache.set(path, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  size(path: string): { width: number; height: number } | null {
    const img = this.get(path);
    return img ? { width: img.naturalWidth, height: img.naturalHeight } : null;
  }

  isMissing(path: string): boolean {
    return this.failed.has(path);
  }

  /** Forget a path (or everything) so a changed file on disk is fetched again. */
  invalidate(path?: string): void {
    if (path) { this.cache.delete(path); this.failed.delete(path); } else { this.cache.clear(); this.failed.clear(); }
  }
}
