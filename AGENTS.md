# AGENTS.md

Map of this repo for coding agents. Read this first, then open only the files the task needs.
The owner is a game designer with no coding background: explain results in plain Korean.

## What it is
A small pixel-art engine (TypeScript, Canvas 2D; 3D nodes drawn with three.js under the 2D world) plus a Godot-style editor
that runs in the browser, served by a local Node server that reads/writes the game project folder and runs git.
AI agents (Claude Code / Codex) run outside the editor, in the game folder; the editor writes their guide there (`server/project-agents.md` → `AGENTS.md`).

## Layout
- `src/engine/` runtime, shared by editor and game. No DOM outside renderer/textures/input/game.
  - `node.ts` Node base: tree ops, props via static `props: PropDef[]`. `registry.ts` registers every node class.
  - `nodes/` node types (node2d, visual = Sprite2D/ColorRect/Label, scene-nodes = Parallax2D/Camera2D/CanvasModulate/CanvasLayer,
    node3d = Node3D/MeshInstance3D/Sprite3D/Camera3D/DirectionalLight3D/OmniLight3D/WorldEnvironment: data only, Godot axes, degrees).
  - `scene.ts` *.scene.json read/write (only non-default props; compact printer). `renderer.ts` draw + transforms + parallax.
  - `game.ts` runs a scene: scripts, ready/process/input, camera view. `math.ts` Vec2, Vec3, Mat2D.
  - `three/world3d.ts` keeps a three.js scene in step with the node tree (game and editor). `three/game3d.ts` renders it offscreen;
    `renderer.ts` draws that canvas as the `underlay` under the 2D world. three.js is imported only when `has3D(root)`.
- `src/player/play.ts` game page (play.html): editor's play window and the web export.
- `src/editor/` editor UI, plain TS + `h()` from `ui.ts` (no framework). `state.ts` = store, events (`on`/`emit`), undo (`exec`), scene ops.
  - `main.ts` layout, menus, shortcuts, center tabs (2D/3D/스크립트/연결). `viewport.ts` 2D view. `viewport3d.ts` 3D view (lazy: orbit, gizmo, picking).
  - `docks/` scene tree, inspector (node props, or a file preview when `ed.inspectFile` is set), filesystem (list/grid), add-node. `panels/` output, git.
  - `preview.ts` file previews and thumbnails, `preview3d.ts` model pictures. `graph-view.ts` the 연결 tab, data from `graph-data.ts`. `open-file.ts` double-click on a file.
  - `script-editor.ts` CodeMirror. `style.css` all styles (variables at top).
- `server/` Node, no runtime deps. `server.mjs` routes POST `/api/<name>` (JSON) and serves `/project/*`.
  - `fsapi.mjs` files (always through `paths.mjs` resolveInside), `gitapi.mjs`, `graph.mjs` (which file uses which), `export.mjs`.
  - `project-agents.md` the engine guide written into game projects as AGENTS.md (keep `examples/train-window/AGENTS.md` identical; a test checks).
- `examples/train-window/` sample project. `tests/` vitest (`*.test.ts|mjs`) and Playwright (`e2e/`).

## Adding things
- New node type: class in `src/engine/nodes/`, `registerNode` in `registry.ts`, draw in `renderer.ts` drawSelf (3D: `build()` and `keyOf()` in `world3d.ts`),
  one line in `server/project-agents.md`. The inspector builds itself from `props`. A prop holding a `res://` path shows up in the graph by itself.
- New prop editor type: `PropType` in `node.ts`, case in `docks/inspector.ts` editor().
- New server call: function in the matching `server/*api.mjs`, entry in `API` in `server.mjs`, call with `api('name', body)`.
- Every editor change to a scene goes through `exec()` in `state.ts` so undo works.

## Rules
- Keep files small and single-purpose; no new dependencies without need.
- The server only listens on 127.0.0.1 and checks the `x-engine` header and Origin; keep that.
- Project paths are `res://...`; never touch files outside the project folder.
- UI text is Korean; code and comments English.
- Before finishing: `npm run check` and, for UI changes, `npm run test:e2e`.
