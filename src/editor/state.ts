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
  /** The scene line (placed object) shown in the 인스펙터. */
  selected: Placement | null;
  /** A file picked in the 프로젝트 panel, shown in the 인스펙터 instead of the selected object. */
  inspecting: { type: 'prefab' | 'image' | 'sound' | 'scene'; name: string } | null;
  /** A prefab or picture being dragged from the 프로젝트 panel (shown on the map until dropped). */
  dragging: { type: 'prefab' | 'image'; name: string } | null;
  /** Placed objects snap to this many pixels. */
  grid: number;
  /** Change the game data: remembers the old state for undo, applies fn, restarts the scene, redraws panels. */
  change(fn: () => void): void;
  /** Select a placed object (or nothing): the 인스펙터 shows it again. */
  pick(p: Placement | null): void;
  /** Show a file of the 프로젝트 panel in the 인스펙터. */
  inspect(type: 'prefab' | 'image' | 'sound' | 'scene', name: string): void;
  /** Bring a panel to the front (opens it if it was closed). */
  show(panel: string): void;
  /** Redraw the panels (after selecting something). */
  render(): void;
  /** Open another scene in the scene view. */
  openScene(name: string): void;
  /** Make a new scene file and open it. */
  newScene(name: string): void;
  /** Show a short message in the top bar. */
  say(text: string): void;
}

/** Scene, kind and file names: letters, numbers, - and _ (they become file names and JSON keys). */
export const NAME_RULE = /^[a-z0-9_-]+$/i;
