# AGENTS.md

Map of this repo for coding agents. Read this first, then open only the files the task needs.
The owner is a game designer with no coding background: explain results in plain Korean.

## What it is
A small 2D pixel-art engine (TypeScript, Canvas 2D) plus a Godot-style editor that runs in the browser,
served by a local Node server that reads/writes the game project folder, runs git and starts Claude Code / Codex.

## Layout
- `src/engine/` runtime, shared by editor and game. No DOM outside renderer/textures/input/game.
  - `node.ts` Node base: tree ops, props via static `props: PropDef[]`. `registry.ts` registers every node class.
  - `nodes/` node types (node2d, visual = Sprite2D/ColorRect/Label, scene-nodes = Parallax2D/Camera2D/CanvasModulate/CanvasLayer).
  - `scene.ts` *.scene.json read/write (only non-default props; compact printer). `renderer.ts` draw + transforms + parallax.
  - `game.ts` runs a scene: scripts, ready/process/input, camera view. `math.ts` Vec2, Mat2D.
- `src/player/play.ts` game page (play.html): editor's play window and the web export.
- `src/editor/` editor UI, plain TS + `h()` from `ui.ts` (no framework). `state.ts` = store, events (`on`/`emit`), undo (`exec`), scene ops.
  - `main.ts` layout, menus, shortcuts. `viewport.ts` 2D view. `docks/` scene tree, inspector, filesystem, add-node. `panels/` output, git, ai.
  - `script-editor.ts` CodeMirror. `style.css` all styles (variables at top).
- `server/` Node, no runtime deps. `server.mjs` routes POST `/api/<name>` (JSON) and serves `/project/*`.
  - `fsapi.mjs` files (always through `paths.mjs` resolveInside), `gitapi.mjs`, `aiapi.mjs` (+ `ai-context.md` sent with every AI prompt), `export.mjs`.
- `examples/train-window/` sample project. `tests/` vitest (`*.test.ts|mjs`) and Playwright (`e2e/`).

## Adding things
- New node type: class in `src/engine/nodes/`, `registerNode` in `registry.ts`, draw in `renderer.ts` drawSelf, one line in `server/ai-context.md`. The inspector builds itself from `props`.
- New prop editor type: `PropType` in `node.ts`, case in `docks/inspector.ts` editor().
- New server call: function in the matching `server/*api.mjs`, entry in `API` in `server.mjs`, call with `api('name', body)`.
- Every editor change to a scene goes through `exec()` in `state.ts` so undo works.

## Rules
- Keep files small and single-purpose; no new dependencies without need.
- The server only listens on 127.0.0.1 and checks the `x-engine` header and Origin; keep that.
- Project paths are `res://...`; never touch files outside the project folder.
- UI text is Korean; code and comments English.
- Before finishing: `npm run check` and, for UI changes, `npm run test:e2e`.
