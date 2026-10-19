// Reads keyboard and mouse. Games ask about actions ("left", "jump") instead of raw keys,
// so which keys do what lives in controls.json and can change without touching game code.
export type Controls = Record<string, string[]>;

/** True when a key press goes to a text box or list on the page instead of the game. */
export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

export class Input {
  private down = new Set<string>(); // keys held right now (KeyboardEvent.code)
  private pressed = new Set<string>(); // keys that went down during this frame
  private mouseDownNow = false;
  private mousePressed = false;
  /** Mouse position in game pixels, or null when outside the screen. */
  mouse: { x: number; y: number } | null = null;

  constructor(private controls: Controls, canvas: HTMLCanvasElement) {
    const gameKeys = new Set(Object.values(controls).flat());
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return; // typing in a text box (the editor) is not playing
      if (gameKeys.has(e.code)) e.preventDefault(); // stop arrows/space from scrolling the page
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear()); // don't keep walking after alt-tab

    canvas.addEventListener('pointermove', (e) => {
      // The canvas is drawn zoomed (step 2), so convert page pixels back to game pixels.
      const r = canvas.getBoundingClientRect();
      this.mouse = {
        x: Math.floor(((e.clientX - r.left) / r.width) * canvas.width),
        y: Math.floor(((e.clientY - r.top) / r.height) * canvas.height),
      };
    });
    canvas.addEventListener('pointerleave', () => (this.mouse = null));
    canvas.addEventListener('pointerdown', () => {
      this.mouseDownNow = true;
      this.mousePressed = true;
    });
    window.addEventListener('pointerup', () => (this.mouseDownNow = false));
  }

  /** True while any key of this action is held. */
  isDown(action: string): boolean {
    return this.keys(action).some((k) => this.down.has(k));
  }

  /** True only on the frame the action started (one tap = one true). */
  wasPressed(action: string): boolean {
    return this.keys(action).some((k) => this.pressed.has(k));
  }

  isMouseDown(): boolean {
    return this.mouseDownNow;
  }

  wasClicked(): boolean {
    return this.mousePressed;
  }

  /** Called by the engine after every frame. */
  endFrame(): void {
    this.pressed.clear();
    this.mousePressed = false;
  }

  private keys(action: string): string[] {
    return this.controls[action] ?? [];
  }
}
