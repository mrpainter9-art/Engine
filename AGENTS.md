# AGENTS.md

Map of this repo for coding agents. Read this first, then `docs/PLAN.md`.

## What it is
A small 2D pixel-art engine (TypeScript, Canvas 2D, runs in the browser), rebuilt from scratch one step at a time.
The owner is a game designer with no coding background who wants to learn how an engine works while building it.

## How we work
- One step = one concept = one visible result. Follow the step order in `docs/PLAN.md`; do not jump ahead.
- Before a step: agree on a one-line "done when" check. After it: explain in plain Korean what was built and why,
  and point to one number the owner can change to see the effect.
- Mark the step done in `docs/PLAN.md` and record any design decision there.

## Layout
- `src/main.ts` registers modules. `src/core/` engine loop + `Module` interface. `src/modules/<name>/` one feature each, values in a JSON next to it.
- Run: `npm run dev`. Before finishing: `npm run check`.

## Structure rules
- Tiny core: runs the loop and registers modules, nothing else.
- One feature = one folder = one module. Removing a feature = removing its registration line.
- Modules do not import each other; they talk through the core.
- Tunable values (routes, speeds, colors) live in data files (JSON), not code.
- Keep files small and single-purpose; no new dependencies without need.

## Rules
- UI text is Korean; code and comments English.
- The previous attempt (editor v1) is in git history at commit `0fb485f`; reuse ideas from it only when a step needs them.
