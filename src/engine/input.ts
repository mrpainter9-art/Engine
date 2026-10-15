import type { Vec2 } from './math';

/** Keyboard and mouse state for scripts. Actions map names to key codes (KeyboardEvent.code), set in project.json "input". */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  mouse: Vec2 = { x: 0, y: 0 };
  mouseDown = false;

  constructor(public actions: Record<string, string[]> = {}) {}

  keyEvent(ev: KeyboardEvent): void {
    if (ev.type === 'keydown') { if (!this.down.has(ev.code)) this.pressed.add(ev.code); this.down.add(ev.code); }
    else { this.down.delete(ev.code); this.released.add(ev.code); }
  }

  isKeyDown(code: string): boolean { return this.down.has(code); }
  isKeyPressed(code: string): boolean { return this.pressed.has(code); }

  private codes(action: string): string[] { return this.actions[action] || [action]; }
  isActionDown(action: string): boolean { return this.codes(action).some((c) => this.down.has(c)); }
  isActionPressed(action: string): boolean { return this.codes(action).some((c) => this.pressed.has(c)); }
  isActionReleased(action: string): boolean { return this.codes(action).some((c) => this.released.has(c)); }

  /** Called once per frame after scripts ran. */
  endFrame(): void { this.pressed.clear(); this.released.clear(); }
}
