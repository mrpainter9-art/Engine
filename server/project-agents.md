# AGENTS.md

This folder is a game project for the Engine editor (a small 2D/3D pixel-art engine). Read this first, then open only the files the task needs.
The owner is a game designer: reply in their language (usually Korean), keep it short, change only what the request asks.
Edit the files directly; the editor re-reads changed files when its window gets focus.

## Files (res:// = this folder)
- project.json: name, mainScene, viewport {width,height} in game pixels, background, input {action: [KeyboardEvent.code, ...]}
- *.scene.json: {"format":1,"root":NodeData}; NodeData = {type, name, props?, script?, children?}. Write only props that differ from the defaults below.
- scripts/*.js: ES module, `export default class { ready() {} process(dt) {} input(ev) {} }`; ready() runs on children first.
  this.node = the node the script is on, this.game = the running game.
  Node: node.name, node.children, node.parent, node.find("Child/Path"), node.<prop>. Vectors are plain objects: node.position = { ...node.position, x: 3 }.
  Game: game.find("Root/Child"), game.input.isActionDown("left") / isActionPressed / isKeyDown("KeyA"), game.input.mouse {x,y}, game.time,
  game.changeScene("res://x.scene.json"), game.log("info", msg).

## Node types and props (defaults)
2D, in pixels, +y down:
- Node: (none)
- Node2D: position {x,y}, rotation 0 (degrees), scale {1,1}, visible true, opacity 1, zIndex 0
- Sprite2D (Node2D): texture "res://..png", centered true, offset {0,0}, flipH false, flipV false
- ColorRect (Node2D): size {64,64}, color "#4a7fc0", gradient false, colorBottom "#a9d3ee" (top-left at position)
- Label (Node2D): text "Label", fontSize 8, color "#ffffff", align left|center|right, font "monospace"
- Parallax2D (Node2D): scrollScale {1,1} (0 = fixed on screen), scrollOffset {0,0}, autoscroll {0,0} px/s, repeatSize {0,0}
- Camera2D (Node2D): current true, zoom 1. The screen centre follows it; without one the screen is 0..width, 0..height.
- CanvasModulate: color "#ffffff", multiplies everything below the CanvasLayers (time-of-day light).
- CanvasLayer: layer 1, visible true. Children draw in screen space on top (UI, window frame).

3D, in metres, +y up, cameras and lights look along their own -Z, rotation in degrees applied Y then X then Z:
- Node3D: position {x,y,z}, rotation {0,0,0}, scale {1,1,1}, visible true
- MeshInstance3D (Node3D): mesh box|sphere|plane|cylinder|cone|model, model "res://..glb", size {1,1,1}, color "#ffffff", texture "", unshaded false, castShadow true
- Sprite3D (Node3D): texture, pixelSize 0.01 (metres per pixel), centered true, billboard false, shaded false, flipH false
- Camera3D (Node3D): current true, projection perspective|orthogonal, fov 70, size 10 (orthogonal height), near 0.05, far 1000
- DirectionalLight3D (Node3D): color "#ffffff", energy 1, shadows false
- OmniLight3D (Node3D): color "#ffe6b0", energy 1, range 5, shadows false
- WorldEnvironment: background "#6b8fb8", clearBackground true, ambientColor "#ffffff", ambientEnergy 0.4, fogColor "#c8d4e0", fogDensity 0
The 3D layer draws under the 2D world; CanvasLayer UI draws over both.
