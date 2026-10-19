import { isTyping } from '../core/input';
import type { Game, Module } from '../core/module';
import type { SceneData } from '../core/scenes';
import type { GameObject, KindDef, Placement } from '../core/world';
import { formatJson } from './format';
import { duplicate, removeSelected, renderInspector } from './panels';
import { NAME_RULE, type Ed } from './state';
import { STYLE, h, selectInput, thumbnail } from './ui';
import { Panels } from './windows';

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
  let panels: Panels | null = null;

  const left = h('div', { id: 'ed-left' });
  const right = h('div', { id: 'ed-right' });
  const bar = h('div', { id: 'ed-bar' });

  const ed: Ed = {
    game: null as unknown as Game,
    kinds,
    scenes,
    behaviors: [],
    palette: null,
    selected: null,
    tab: 'object',
    kindName: null,
    grid: 4,
    change(fn) {
      undo.push(snapshot());
      if (undo.length > 100) undo.shift();
      fn();
      restartScene();
      render();
    },
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
    if (on) restartScene();
    else game.goTo(game.sceneName); // play from the start, camera follows the player again
    render();
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

  function place(kind: string, p: { x: number; y: number }): void {
    const { w, h: ht } = size(kind);
    const placement: Placement = { kind, x: snap(p.x - w / 2), y: snap(p.y - ht / 2) };
    ed.change(() => game.scene.objects.push(placement));
    ed.selected = placement;
    ed.tab = 'object';
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
        ed.tab = 'object';
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
        const x = snap(mouse.x - drag.dx);
        const y = snap(mouse.y - drag.dy);
        if (x === obj.source.x && y === obj.source.y) return;
        if (!drag.moved) undo.push(drag.before);
        drag.moved = true;
        obj.source.x = obj.x = obj.startX = x;
        obj.source.y = obj.y = obj.startY = y;
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
    renderLeft();
    renderInspector(ed, right);
  }

  function renderBar(): void {
    const changed = unsaved().length;
    const nameBox = h('input', { type: 'text', placeholder: '새 장면 이름', style: 'width:110px' });
    nameBox.addEventListener('change', () => newScene(nameBox.value.trim()));
    const items: (Node | false)[] = [
      h('button', {
        class: 'ed-primary',
        textContent: game.editing ? '▶ 플레이' : '✎ 편집하기',
        title: game.editing ? '지금 장면을 처음부터 해 봐요' : '게임을 멈추고 맵을 고쳐요',
        onclick: () => setEditing(!game.editing),
      }),
      h('span', { textContent: '장면' }),
      selectInput(Object.keys(scenes).map((n) => [n, n]), game.sceneName, goToScene),
      game.editing && nameBox,
      game.editing && h('button', { textContent: '↶ 되돌리기', title: 'Ctrl+Z', onclick: () => { const last = undo.pop(); if (last) restore(last); } }),
      h('button', { textContent: canSave ? '저장 (Ctrl+S)' : '저장 (체험판은 꺼짐)', onclick: save }),
      game.editing && h('button', { textContent: '패널 제자리로', title: '옮기거나 크기를 바꾼 패널을 처음 위치로', onclick: () => panels?.reset() }),
      h('span', {
        class: `ed-status ${changed ? 'ed-unsaved' : ''}`,
        textContent: message || (changed ? `저장 안 된 파일 ${changed}개` : '모두 저장됨'),
      }),
    ];
    bar.replaceChildren(...items.filter((i): i is Node => i !== false));
    message = '';
  }

  function renderLeft(): void {
    const tool = (on: boolean, onclick: () => void, ...children: (Node | string)[]) =>
      h('div', { class: `ed-tool ${on ? 'ed-on' : ''}`, onclick }, ...children);
    const newKind = h('input', { type: 'text', placeholder: '새 종류 이름 + Enter', style: 'margin:6px 10px' });
    newKind.addEventListener('change', () => {
      const name = newKind.value.trim();
      if (!NAME_RULE.test(name) || kinds[name]) return ed.say('종류 이름은 영어, 숫자, -, _ 만 쓰고 겹치지 않게 해 주세요.');
      ed.change(() => (kinds[name] = { image: game.assets.names()[0] ?? '', blocks: [] }));
      ed.palette = name;
      ed.kindName = name;
      ed.tab = 'kind';
      render();
    });
    const grid = selectInput([['1', '1 (자유롭게)'], ['4', '4'], ['8', '8'], ['16', '16']], String(ed.grid), (v) => (ed.grid = Number(v)));
    left.replaceChildren(
      h('h3', { textContent: '도구' }),
      tool(!ed.palette, () => ((ed.palette = null), render()), h('span', { textContent: '↖', style: 'width:28px;text-align:center;font-size:18px' }), '고르기 · 옮기기'),
      h('h3', { textContent: '놓을 물건 (고르고 맵 클릭)' }),
      ...Object.entries(kinds).map(([name, def]) =>
        tool(ed.palette === name, () => ((ed.palette = name), (ed.kindName = name), render()), thumbnail(game.assets.image(def.image), def.frames), name)),
      newKind,
      h('label', { class: 'ed-row', style: 'margin:4px 10px' }, h('span', { textContent: '격자 칸', style: 'width:60px' }), grid),
      h('div', { class: 'ed-help', innerHTML:
        '클릭: 고르기 / 끌기: 옮기기<br>Delete: 지우기 · Ctrl+D: 복제<br>방향키 · 휠 · 오른쪽 끌기: 맵 이동<br>Esc: 고르기 도구로 · Ctrl+Z: 되돌리기<br>Ctrl+S: 파일에 저장<br>패널: 제목 끌기로 옮기기, 오른쪽 아래 모서리로 크기' }),
    );
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
      // The scene fills the window under the top bar; the panels float over it and can be moved and resized.
      const app = document.getElementById('app')!;
      const stage = document.getElementById('stage')!;
      const area = h('div', { id: 'ed-area' });
      app.replaceChildren(h('div', { id: 'ed-center' }, bar, area));
      area.append(stage);
      panels = new Panels(area);
      panels.add({ id: 'kinds', title: '놓을 물건', content: left, place: (_w, ah) => ({ x: 8, y: 8, w: 200, h: Math.min(560, ah - 16) }) });
      panels.add({ id: 'inspector', title: '고치기', content: right, place: (aw, ah) => ({ x: aw - 316, y: 8, w: 308, h: Math.min(680, ah - 16) }) });
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
        if (memory.scene && scenes[memory.scene]) g.goTo(memory.scene);
      } catch {
        /* start normally */
      }
    },
    enter(g) {
      // Starting the scene again moves the camera to the player; while editing keep it where it was.
      if (g.editing && camKeep) g.camera.jumpTo(camKeep.x + g.camera.viewWidth / 2, camKeep.y + g.camera.viewHeight / 2);
      camKeep = null;
      if (ed.selected && !g.scene.objects.includes(ed.selected)) ed.selected = null;
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
      const hover = mouse && !ed.palette ? pick(mouse) : null;
      if (hover) outline(ctx, hover, 'rgba(255,255,255,0.6)');
      const sel = g.world.objects.find((o) => o.source === ed.selected);
      if (sel) outline(ctx, sel, '#f2c14e');
      // Where a new object would go.
      if (ed.palette && mouse && kinds[ed.palette]) {
        const def = kinds[ed.palette];
        const { w, h: ht } = size(ed.palette);
        ctx.globalAlpha = 0.6;
        g.assets.draw(ctx, def.image, snap(mouse.x - w / 2), snap(mouse.y - ht / 2), { frames: def.frames ?? 1 });
      }
      ctx.restore();
    },
  };
}

function outline(ctx: CanvasRenderingContext2D, o: GameObject, color: string): void {
  ctx.strokeStyle = color;
  ctx.strokeRect(Math.round(o.x) - 0.5, Math.round(o.y) - 0.5, o.w + 1, o.h + 1);
}
