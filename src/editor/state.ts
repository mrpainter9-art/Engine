import type { Game } from '../core/module';
import type { SceneData } from '../core/scenes';
import type { Behavior, KindDef, Placement } from '../core/world';

// What the editor's parts share: the game data being edited and what is selected.
export interface Ed {
  game: Game;
  kinds: Record<string, KindDef>;
  scenes: Record<string, SceneData>;
  behaviors: Behavior[];
  /** Kind to place with a click; null = pick-and-move tool. */
  palette: string | null;
  /** The scene line (placed object) shown in the 물건 tab. */
  selected: Placement | null;
  tab: 'object' | 'kind' | 'scene';
  /** Kind shown in the 종류 tab. */
  kindName: string | null;
  /** Placed objects snap to this many pixels. */
  grid: number;
  /** Change the game data: remembers the old state for undo, applies fn, restarts the scene, redraws panels. */
  change(fn: () => void): void;
  /** Redraw the panels (after selecting something). */
  render(): void;
  /** Show a short message in the top bar. */
  say(text: string): void;
}

/** Scene, kind and file names: letters, numbers, - and _ (they become file names and JSON keys). */
export const NAME_RULE = /^[a-z0-9_-]+$/i;
