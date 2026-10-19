import type { Placement } from './world';

// Scenes: every file in src/scenes/ is one scene (a title screen, a stage...), used by its file name
// ("src/scenes/stage1.json" -> "stage1"). The game starts at settings.json "firstScene".
export interface SceneText {
  text: string;
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
  scale?: number;
}

export interface SceneData {
  /** World size in pixels; without it the world is one screen. */
  size?: { width: number; height: number };
  /** Sky color. */
  background?: string;
  /** Looping music (a name from assets/sounds). */
  music?: string;
  /** Words fixed on the screen, e.g. a title. */
  texts?: SceneText[];
  /** The scene's game rules (values from rules.json can be changed here). No rules = a menu: "action" goes to next. */
  rules?: Record<string, unknown>;
  /** The scene to go to after this one is cleared. */
  next?: string;
  objects: Placement[];
}

const files = import.meta.glob('/src/scenes/*.json', { eager: true, import: 'default' }) as Record<string, SceneData>;

export const scenes: Record<string, SceneData> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.replace(/^.*\//, '').replace(/\.json$/, ''), data]),
);
