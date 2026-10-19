// Remembers numbers after the browser is closed (best records, progress), stored in this browser only.
// Every game has its own drawer, named by settings.json "saveName".
export class Save {
  constructor(private name: string) {}

  get(key: string, fallback = 0): number {
    const value = Number(this.read()[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  set(key: string, value: number): void {
    this.write({ ...this.read(), [key]: value });
  }

  /** Forget everything this game saved. */
  clear(): void {
    this.write({});
  }

  // Browsers can block storage (private windows); the game keeps working, it just won't remember.
  private read(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(this.name) ?? '{}');
    } catch {
      return {};
    }
  }

  private write(data: Record<string, number>): void {
    try {
      localStorage.setItem(this.name, JSON.stringify(data));
    } catch {
      /* not saved, see read() */
    }
  }
}
