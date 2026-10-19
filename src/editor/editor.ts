import { isTyping } from '../core/input';
import type { Game, Module } from '../core/module';
import type { SceneData } from '../core/scenes';
import type { GameObject, KindDef, Placement } from '../core/world';
import { formatJson } from './format';
import { prefabFor, renderBrowser } from './browser';
import { Dock, type Layout } from './dock';
import { renderHierarchy } from './hierarchy';
import { duplicate, removeSelected, renderPanel } from './panels';
import { NAME_RULE, type Ed } from './state';
import { eachNode } from './tree';
import { STYLE, h, selectInput } from './ui';

// The editor: place objects with the mouse, change kinds, blocks and scenes, and save to the JSON files.
// It only exists while developing (start.bat) and in the editor demo; exported games don't include it.
// Saving writes src/kinds.json and src/scenes/*.json through the dev server (tools/editor-server.ts).

export interface EditorSetup {
  kinds: Record<string, KindDef>;
  scenes: Record<string, SceneData>;
  /** False in the demo page, where there are no files to save to. */
  canSave: boolean;
}

const PAN_SPEED = 240; // pixels per second when moving the map with the arrow keys
const MEMORY = 'engine-editor'; // remembers editing/scene across page reloads (this tab only)

export function createEditor({ kinds, scenes, canSave }: EditorSetup): Module {
  let game!: Game;
  let canvas!: HTMLCanvasElement;
  let camKeep: { x: number; y: number } | null = null;
  let mouse: { x: number; y: number } | null = null; // in world pixels
  let drag: { obj: GameObject; dx: number; dy: number; before: string; moved: boolean } | null = null;
  let pan: { x: number; y: number; camX: number; camY: number } | null = null;
  const undo: string[] = [];
  let saved: Record<string, string> = {};
  let message = '';
  let dock!: Dock;

  // One element per panel; the dock decides where each one sits.
  const projectPanel = h('div', { class: 'ed-panel' });
  const objectPanel = h('div', { class: 'ed-panel' });
  const treePanel = h('div', { class: 'ed-panel' });
  const kindPanel = h('div', { class: 'ed-panel' });
  const scenePanel = h('div', { class: 'ed-panel' });
  const bar = h('div', { id: 'ed-bar' });

  const ed: Ed = {
    game: null as unknown as Game,
    kinds,
    scenes,
    behaviors: [],
    palette: null,
    selected: null,
    kindName: null,
    grid: 4,
    dragging: null,
    change(fn) {
      undo.push(snapshot());
      if (undo.length > 100) undo.shift();
      fn();
      restartScene();
      render();
    },
    show: (id) => dock.show(id),
    openScene: (name) => goToScene(name),
    newScene: (name) => newScene(name),
    render: () => render(),
    say(text) {
      message = text;
      renderBar();
    },
  };

  // ---- data: undo and save ----

  const snapshot = () => JSON.stringify({ kinds, scenes });

  function restore(text: string): void {
    const data = JSON.parse(text);
    for (const k of Object.keys(kinds)) delete kinds[k];
    Object.assign(kinds, data.kinds);
    for (const k of Object.keys(scenes)) delete scenes[k];
    Object.assign(scenes, data.scenes);
    game.scene = scenes[game.sceneName] ?? game.scene;
    ed.selected = null;
    restartScene();
    render();
  }

  /** Every file the editor can write, with its text as it would be saved now. */
  function files(): Record<string, string> {
    const out: Record<string, string> = { 'src/kinds.json': formatJson(kinds, 2) + '\n' };
    for (const [name, scene] of Object.entries(scenes)) out[`src/scenes/${name}.json`] = formatJson(scene) + '\n';
    return out;
  }

  const unsaved = () => Object.entries(files()).filter(([path, text]) => saved[path] !== text);

  async function save(): Promise<void> {
    const changed = unsaved();
    if (!changed.length) return ed.say('바뀐 게 없어요.');
    if (!canSave) return ed.say('체험판이라 저장은 안 돼요. 내 컴퓨터에서 start.bat으로 열면 파일에 저장돼요.');
    try {
      const res = await fetch('/__editor/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ files: changed.map(([path, text]) => ({ path, text })) }),
      });
      if (!res.ok) throw new Error(await res.text());
      for (const [path, text] of changed) saved[path] = text;
      ed.say(`저장했어요: ${changed.map(([p]) => p.replace('src/', '')).join(', ')}`);
    } catch (e) {
      ed.say(`저장하지 못했어요 (${e instanceof Error ? e.message : e}). start.bat으로 연 화면인지 확인해 주세요.`);
    }
  }

  // ---- scene control ----

  /** Start the scene again from its file data, keeping the editor's camera where it was. */
  function restartScene(): void {
    camKeep = { x: game.camera.x, y: game.camera.y };
    game.goTo(game.sceneName);
  }

  function setEditing(on: boolean): void {
    game.editing = on;
    document.body.classList.toggle('ed-editing', on);
    ed.palette = null;
    drag = null;
    dock.showOnly(on ? null : 'view');
    setScaling();
    if (on) restartScene();
    else game.goTo(game.sceneName); // play from the start, camera follows the player again
    render();
  }

  /** While editing, the scene view uses every pixel it has (fill); playing uses the game's own setting. */
  function setScaling(): void {
    if (game.editing) canvas.dataset.scaling = 'fill';
    else delete canvas.dataset.scaling;
  }

  function goToScene(name: string): void {
    ed.selected = null;
    camKeep = { x: 0, y: 0 };
    game.goTo(name);
  }

  function newScene(name: string): void {
    if (!NAME_RULE.test(name) || scenes[name]) return ed.say('장면 이름은 영어, 숫자, -, _ 만 쓰고 다른 장면과 겹치지 않게 해 주세요.');
    undo.push(snapshot());
    scenes[name] = {
      size: { width: game.width * 2, height: game.height },
      rules: { timeLimit: 60 },
      objects: [
        { kind: 'ground', x: 0, y: game.height - 16, w: game.width * 2 },
        { kind: 'player', x: 16, y: game.height - 32 },
      ].filter((o) => kinds[o.kind]),
    };
    goToScene(name);
    ed.say(`새 장면 "${name}"을 만들었어요. 저장하면 src/scenes/${name}.json 파일이 생겨요.`);
  }

  function remember(): void {
    try {
      sessionStorage.setItem(MEMORY, JSON.stringify({ editing: game.editing, scene: game.sceneName }));
    } catch {
      /* fine without it */
    }
  }

  // ---- map: mouse and keys ----

  const snap = (v: number) => Math.round(v / ed.grid) * ed.grid;

  function toWorld(e: MouseEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width + game.camera.x,
      y: ((e.clientY - r.top) / r.height) * canvas.height + game.camera.y,
    };
  }

  /** The front-most object under a point. */
  function pick(p: { x: number; y: number }): GameObject | null {
    const list = game.world.objects;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (p.x >= o.x && p.x < o.x + o.w && p.y >= o.y && p.y < o.y + o.h) return o;
    }
    return null;
  }

  function size(kind: string): { w: number; h: number } {
    const def = kinds[kind];
    const img = def ? game.assets.image(def.image) : null;
    return img ? { w: Math.floor(img.width / (def.frames ?? 1)), h: img.height } : { w: 16, h: 16 };
  }

  /** A new scene line for a kind, centered on a map point. */
  function spot(kind: string, p: { x: number; y: number }): Placement {
    const { w, h: ht } = size(kind);
    return { kind, x: snap(p.x - w / 2), y: snap(p.y - ht / 2) };
  }

  function place(kind: string, p: { x: number; y: number }): void {
    const placement = spot(kind, p);
    ed.change(() => game.scene.objects.push(placement));
    ed.selected = placement;
    render();
  }

  function moveCamera(dx: number, dy: number): void {
    const c = game.camera;
    c.jumpTo(c.x + dx + c.viewWidth / 2, c.y + dy + c.viewHeight / 2);
  }

  function setupMouse(): void {
    // Keys should go to the game, not to the last clicked button or list (Space would press it again).
    const unfocus = () => (document.activeElement as HTMLElement | null)?.blur?.();
    document.addEventListener('click', (e) => e.target instanceof HTMLButtonElement && unfocus());
    document.addEventListener('change', (e) => e.target instanceof HTMLSelectElement && unfocus());
    canvas.addEventListener('pointerdown', unfocus);
    canvas.addEventListener('contextmenu', (e) => game.editing && e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (!game.editing) return;
      const p = toWorld(e);
      canvas.setPointerCapture(e.pointerId);
      if (e.button !== 0) {
        pan = { x: e.clientX, y: e.clientY, camX: game.camera.x, camY: game.camera.y };
        return;
      }
      if (ed.palette) return place(ed.palette, p);
      const hit = pick(p);
      ed.selected = hit?.source ?? null;
      if (hit) {
        drag = { obj: hit, dx: p.x - hit.x, dy: p.y - hit.y, before: snapshot(), moved: false };
      }
      render();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!game.editing) return;
      mouse = toWorld(e);
      if (pan) {
        const r = canvas.getBoundingClientRect();
        const k = canvas.width / r.width;
        game.camera.jumpTo(pan.camX - (e.clientX - pan.x) * k + game.camera.viewWidth / 2, pan.camY - (e.clientY - pan.y) * k + game.camera.viewHeight / 2);
      }
      if (drag) {
        const { obj } = drag;
        const dx = snap(mouse.x - drag.dx) - obj.x;
        const dy = snap(mouse.y - drag.dy) - obj.y;
        if (!dx && !dy) return;
        if (!drag.moved) undo.push(drag.before);
        drag.moved = true;
        obj.source.x += dx; // a child's x/y is relative to its parent, so add the change instead of setting it
        obj.source.y += dy;
        // Move it and everything inside it on screen right away.
        for (const o of game.world.objects) {
          if (!isUnder(o, obj)) continue;
          o.x = o.startX += dx;
          o.y = o.startY += dy;
        }
      }
    });
    canvas.addEventListener('pointerup', () => {
      if (drag?.moved) {
        restartScene();
        render();
      }
      drag = null;
      pan = null;
    });
    canvas.addEventListener('pointerleave', () => (mouse = null));
    // Prefabs and pictures dragged from the 프로젝트 panel.
    canvas.addEventListener('dragover', (e) => {
      if (!game.editing || !ed.dragging) return;
      e.preventDefault();
      mouse = toWorld(e);
    });
    canvas.addEventListener('dragleave', () => (mouse = null));
    canvas.addEventListener('drop', (e) => {
      const item = ed.dragging;
      ed.dragging = null;
      if (!game.editing || !item) return;
      e.preventDefault();
      const p = toWorld(e);
      if (item.type === 'prefab') return place(item.name, p);
      let placement: Placement | null = null;
      ed.change(() => {
        const kind = prefabFor(kinds, item.name);
        game.scene.objects.push((placement = spot(kind, p)));
      });
      ed.selected = placement;
      render();
    });
    canvas.addEventListener('wheel', (e) => {
      if (!game.editing) return;
      e.preventDefault();
      if (e.shiftKey) moveCamera(0, e.deltaY * 0.5);
      else moveCamera((e.deltaX || e.deltaY) * 0.5, 0);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.code === 'KeyS') {
        e.preventDefault();
        save();
      }
      if (!game.editing) return;
      if (ctrl && e.code === 'KeyZ') {
        e.preventDefault();
        const last = undo.pop();
        if (last) restore(last);
        else ed.say('더 되돌릴 게 없어요.');
      } else if (ctrl && e.code === 'KeyD') {
        e.preventDefault();
        duplicate(ed);
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        removeSelected(ed);
      } else if (e.code === 'Escape') {
        ed.palette = null;
        ed.selected = null;
        render();
      }
    });
    window.addEventListener('beforeunload', (e) => {
      if (canSave && unsaved().length) e.preventDefault(); // ask before closing with unsaved changes
    });
  }

  // ---- panels ----

  function render(): void {
    renderBar();
    renderBrowser(ed, projectPanel);
    renderHierarchy(ed, treePanel);
    renderPanel(ed, objectPanel, 'object');
    renderPanel(ed, kindPanel, 'kind');
    renderPanel(ed, scenePanel, 'scene');
  }

  function renderBar(): void {
    const changed = unsaved().length;
    const grid = selectInput([['1', '격자 1 (자유롭게)'], ['4', '격자 4'], ['8', '격자 8'], ['16', '격자 16']], String(ed.grid), (v) => (ed.grid = Number(v)));
    grid.title = '놓거나 옮길 때 몇 픽셀 단위로 맞출지';
    const items: (Node | false)[] = [
      h('button', {
        class: 'ed-primary',
        textContent: game.editing ? '▶ 플레이' : '✎ 편집하기',
        title: game.editing ? '지금 장면을 처음부터 해 봐요' : '게임을 멈추고 맵을 고쳐요',
        onclick: () => setEditing(!game.editing),
      }),
      h('span', { textContent: '장면' }),
      selectInput(Object.keys(scenes).map((n) => [n, n]), game.sceneName, goToScene),
      game.editing && h('button', {
        class: ed.palette ? '' : 'ed-on',
        textContent: ed.palette ? `놓는 중: ${ed.palette} (Esc: 그만)` : '↖ 고르기 · 옮기기',
        title: '프로젝트 패널에서 프리팹을 클릭하면 놓기 도구가 돼요',
        onclick: () => ((ed.palette = null), render()),
      }),
      game.editing && grid,
      game.editing && h('button', { textContent: '↶ 되돌리기', title: 'Ctrl+Z', onclick: () => { const last = undo.pop(); if (last) restore(last); } }),
      h('button', { textContent: canSave ? '저장 (Ctrl+S)' : '저장 (체험판은 꺼짐)', onclick: save }),
      game.editing && dock.closed().length > 0 &&
        selectInput([['', '+ 패널 열기'], ...dock.closed().map((p): [string, string] => [p.id, p.title])], '', (id) => id && dock.show(id)),
      game.editing && h('button', { textContent: '패널 배치 처음대로', title: '나누고 합친 패널을 처음 배치로', onclick: () => dock.reset() }),
      game.editing && h('span', { class: 'ed-help-icon', textContent: '?', title: HELP }),
      h('span', {
        class: `ed-status ${changed ? 'ed-unsaved' : ''}`,
        textContent: message || (changed ? `저장 안 된 파일 ${changed}개` : '모두 저장됨'),
      }),
    ];
    bar.replaceChildren(...items.filter((i): i is Node => i !== false));
    message = '';
  }

  // ---- the module ----

  return {
    name: 'editor',
    whileEditing: true,
    init(g) {
      game = ed.game = g;
      ed.behaviors = g.world.behaviorList();
      canvas = document.getElementById('screen') as HTMLCanvasElement;
      document.head.append(h('style', { textContent: STYLE }));
      // Under the top bar the window is split into panels around the scene view (see dock.ts).
      const app = document.getElementById('app')!;
      const stage = document.getElementById('stage')!;
      const area = h('div', { id: 'ed-dock' });
      app.replaceChildren(h('div', { id: 'ed-center' }, bar, area));
      dock = new Dock(area, defaultLayout);
      dock.add({ id: 'view', title: '장면 보기', el: stage, closable: false });
      dock.add({ id: 'project', title: '프로젝트', el: projectPanel });
      dock.add({ id: 'tree', title: '오브젝트 목록', el: treePanel });
      dock.add({ id: 'object', title: '오브젝트', el: objectPanel });
      dock.add({ id: 'kind', title: '프리팹', el: kindPanel });
      dock.add({ id: 'scene', title: '장면', el: scenePanel });
      dock.load();
      dock.onChange = renderBar;
      saved = files();
      setupMouse();
      // After a page reload, come back to the same scene and mode.
      try {
        const memory = JSON.parse(sessionStorage.getItem(MEMORY) ?? '{}');
        if (memory.scene && scenes[memory.scene]) camKeep = { x: 0, y: 0 };
        if (memory.editing) {
          g.editing = true;
          document.body.classList.add('ed-editing');
        }
        if (!g.editing) dock.showOnly('view');
        setScaling();
        if (memory.scene && scenes[memory.scene]) g.goTo(memory.scene);
      } catch {
        /* start normally */
      }
    },
    enter(g) {
      // Starting the scene again moves the camera to the player; while editing keep it where it was.
      if (g.editing && camKeep) g.camera.jumpTo(camKeep.x + g.camera.viewWidth / 2, camKeep.y + g.camera.viewHeight / 2);
      camKeep = null;
      let stillThere = false;
      eachNode(g.scene.objects, (p) => (stillThere ||= p === ed.selected));
      if (!stillThere) ed.selected = null;
      remember();
      render();
    },
    update(dt, g) {
      if (!g.editing) return;
      const { input } = g;
      const dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
      const dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
      if (dx || dy) moveCamera(dx * PAN_SPEED * dt, dy * PAN_SPEED * dt);
    },
    draw(ctx, g) {
      if (!g.editing) return;
      const { camera } = g;
      ctx.save();
      ctx.lineWidth = 1;
      // Edge of the map.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(0.5, 0.5, camera.worldWidth - 1, camera.worldHeight - 1);
      ctx.setLineDash([]);
      // Object under the mouse, and the selected one.
      // Empty nodes have no picture: show them as a small diamond.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      for (const o of g.world.objects) {
        if (o.image) continue;
        const cx = Math.round(o.x + o.w / 2) + 0.5;
        const cy = Math.round(o.y + o.h / 2) + 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx, cy + 4);
        ctx.lineTo(cx - 4, cy);
        ctx.closePath();
        ctx.stroke();
      }
      const hover = mouse && !ed.palette ? pick(mouse) : null;
      if (hover) outline(ctx, hover, 'rgba(255,255,255,0.6)');
      const sel = g.world.objects.find((o) => o.source === ed.selected);
      if (sel) outline(ctx, sel, '#f2c14e');
      // Where a new object would go.
      const ghost = ed.dragging?.type === 'image' ? { image: ed.dragging.name, frames: 1 }
        : kinds[ed.dragging?.name ?? ed.palette ?? ''];
      if (ghost && mouse) {
        const img = g.assets.image(ghost.image);
        const w = img ? Math.floor(img.width / (ghost.frames ?? 1)) : 16;
        const ht = img?.height ?? 16;
        ctx.globalAlpha = 0.6;
        g.assets.draw(ctx, ghost.image, snap(mouse.x - w / 2), snap(mouse.y - ht / 2), { frames: ghost.frames ?? 1 });
      }
      ctx.restore();
    },
  };
}

const HELP = [
  '클릭: 고르기 / 끌기: 옮기기',
  'Delete: 지우기 · Ctrl+D: 복제 · Ctrl+Z: 되돌리기 · Ctrl+S: 저장',
  '방향키 · 휠 · 오른쪽 끌기: 맵 이동 · Esc: 고르기 도구로',
  '프로젝트 패널: 프리팹이나 그림을 장면 보기로 끌어서 놓기',
  '패널: 탭을 끌어 가장자리에 놓으면 나누기, 가운데에 놓으면 합치기',
].join('\n');

/** Where the panels start, like Unity: object list left, scene middle, settings right, project files along the bottom. */
function defaultLayout(): Layout {
  return {
    split: 'col',
    sizes: [68, 32],
    items: [
      {
        split: 'row',
        sizes: [17, 58, 25],
        items: [
          { tabs: ['tree'], active: 0 },
          { tabs: ['view'], active: 0 },
          { split: 'col', sizes: [55, 45], items: [{ tabs: ['object'], active: 0 }, { tabs: ['kind', 'scene'], active: 0 }] },
        ],
      },
      { tabs: ['project'], active: 0 },
    ],
  };
}

/** True when o is node or sits somewhere inside it. */
function isUnder(o: GameObject, node: GameObject): boolean {
  for (let p: GameObject | null = o; p; p = p.parent) if (p === node) return true;
  return false;
}

function outline(ctx: CanvasRenderingContext2D, o: GameObject, color: string): void {
  ctx.strokeStyle = color;
  ctx.strokeRect(Math.round(o.x) - 0.5, Math.round(o.y) - 0.5, o.w + 1, o.h + 1);
}
