import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Node, Node3D, clone, sameValue, has3D, type Vec3 } from '../engine';
import { World3D } from '../engine/three/world3d';
import { ed, on, emit, select, addNode, exec, type OpenScene } from './state';
import { projectUrl } from './api';
import { h } from './ui';
import { nodeForAsset } from './preview';

// The 3D view: Godot-like orbit camera, a move/rotate/scale gizmo, click to select, drop models and images to place them.
// Loaded on first use (it pulls in three.js), from main.ts.

type Mode = 'select' | 'translate' | 'rotate' | 'scale';
const DEG = 180 / Math.PI;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

let canvas: HTMLCanvasElement;
let renderer: THREE.WebGLRenderer;
let world: World3D;
let camera: THREE.PerspectiveCamera;
let orbit: OrbitControls;
let gizmo: TransformControls;
let gizmoHelper: THREE.Object3D;
let grid: THREE.Group;
let box: THREE.BoxHelper;
let mode: Mode = 'translate';
let snap = false;
let local = false;
let preview = false;
let pixel = false;
let pending = false;
let shownScene: OpenScene | null = null;
let hint: HTMLElement;

export function render3D() {
  if (pending || !renderer) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(); });
}

function makeGrid(): THREE.Group {
  const g = new THREE.Group();
  const fine = new THREE.GridHelper(100, 100, 0x2c323c, 0x2c323c);
  const coarse = new THREE.GridHelper(100, 10, 0x3a4250, 0x3a4250);
  const axis = (a: number[], b: number[], color: number) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), new THREE.LineBasicMaterial({ color }));
  g.add(fine, coarse, axis([-50, 0.001, 0], [50, 0.001, 0], 0xe05050), axis([0, 0.001, -50], [0, 0.001, 50], 0x5080e0));
  for (const o of [fine, coarse]) { (o.material as THREE.Material).transparent = true; (o.material as THREE.Material).opacity = 0.7; }
  return g;
}

/** Save and restore the editor camera per open scene, so switching tabs keeps each view. */
function storeView() {
  if (shownScene) shownScene.view3d = { pos: camera.position.toArray(), target: orbit.target.toArray() };
}
function restoreView(s: OpenScene) {
  const v = s.view3d;
  if (v) { camera.position.fromArray(v.pos); orbit.target.fromArray(v.target); }
  else { camera.position.set(4, 3.5, 6); orbit.target.set(0, 0.8, 0); }
  orbit.update();
}

function syncGizmo() {
  const n = ed.current?.selected;
  const obj = n instanceof Node3D ? world.objectOf(n) : null;
  if (obj && mode !== 'select') { if (gizmo.object !== obj) gizmo.attach(obj); gizmo.setMode(mode); }
  else gizmo.detach();
  gizmo.setSpace(local ? 'local' : 'world');
  gizmo.setTranslationSnap(snap ? 0.5 : null);
  gizmo.setRotationSnap(snap ? THREE.MathUtils.degToRad(15) : null);
  gizmo.setScaleSnap(snap ? 0.1 : null);
}

function draw() {
  const s = ed.current;
  const wrap = canvas.parentElement!;
  const w = wrap.clientWidth, hgt = wrap.clientHeight;
  if (!w || !hgt) return;
  // pixel view: render near the game's resolution and let the browser scale it up without smoothing
  const k = pixel ? Math.max(1, Math.round(hgt / ed.project.viewport.height)) : 1;
  const ratio = pixel ? 1 / k : Math.min(2, devicePixelRatio || 1);
  if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== hgt) renderer.setSize(w, hgt, false);
  canvas.classList.toggle('pixel', pixel);

  if (s !== shownScene) { if (shownScene) storeView(); shownScene = s; if (s) restoreView(s); }
  world.sync(s?.root || null);
  renderer.shadowMap.enabled = world.shadows;
  hint.hidden = !s || has3D(s.root);
  syncGizmo();

  const sel = s?.selected;
  const selObj = sel instanceof Node3D ? world.objectOf(sel) : null;
  box.visible = !!selObj && !preview;
  if (selObj) box.setFromObject(selObj);
  grid.visible = gizmoHelper.visible = !preview;

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, hgt);
  if (preview) {
    // look through the scene's Camera3D, letterboxed to the game's shape
    const gw = ed.project.viewport.width, gh = ed.project.viewport.height;
    const scale = Math.min(w / gw, hgt / gh), vw = Math.floor(gw * scale), vh = Math.floor(gh * scale);
    const x = Math.floor((w - vw) / 2), y = Math.floor((hgt - vh) / 2);
    renderer.setClearColor(0x14171c, 1);
    renderer.clear();
    const cam = world.camera(gw / gh);
    renderer.setViewport(x, y, vw, vh);
    renderer.setScissor(x, y, vw, vh);
    renderer.setScissorTest(true);
    renderer.setClearColor(ed.project.background || '#000000', 1);
    if (cam) renderer.render(world.scene, cam);
    else renderer.clear();
    renderer.setScissorTest(false);
  } else {
    renderer.setClearColor(0x1b1f26, 1);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    renderer.render(world.scene, camera);
  }
}

/** Copy the gizmo's edit back into the node's properties. */
function readTransform(o: THREE.Object3D): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  return {
    position: { x: r4(o.position.x), y: r4(o.position.y), z: r4(o.position.z) },
    rotation: { x: r4(o.rotation.x * DEG), y: r4(o.rotation.y * DEG), z: r4(o.rotation.z * DEG) },
    scale: { x: r4(o.scale.x), y: r4(o.scale.y), z: r4(o.scale.z) },
  };
}

function pickAt(e: MouseEvent): Node | null {
  const r = canvas.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.layers.enableAll();
  ray.params.Line.threshold = 0.1; // camera frames and light arrows are picked near their lines, not a metre away
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), preview ? (world.camera(ed.project.viewport.width / ed.project.viewport.height) || camera) : camera);
  for (const hit of ray.intersectObjects(world.scene.children, true)) {
    if (!hit.object.visible || hit.object === box) continue;
    let hidden = false;
    for (let p: THREE.Object3D | null = hit.object; p; p = p.parent) if (!p.visible) hidden = true;
    if (hidden) continue;
    const n = world.nodeOf(hit.object);
    if (n) return n;
  }
  return null;
}

/** Where the mouse points on the ground (y = 0), for dropped files. */
function groundAt(e: DragEvent): THREE.Vector3 {
  const r = canvas.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) && p.distanceTo(camera.position) < 200 ? p : orbit.target.clone();
}

function focusSelected() {
  const n = ed.current?.selected;
  const obj = n instanceof Node3D ? world.objectOf(n) : null;
  const b = obj ? new THREE.Box3().setFromObject(obj) : new THREE.Box3();
  if (b.isEmpty()) { if (obj) b.setFromCenterAndSize(obj.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(1, 1, 1)); else return; }
  const center = b.getCenter(new THREE.Vector3()), radius = Math.max(0.5, b.getSize(new THREE.Vector3()).length() / 2);
  const dir = camera.position.clone().sub(orbit.target).normalize();
  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, Math.min(radius * 2.2, 400));
  orbit.update();
  render3D();
}

export function createViewport3D(): HTMLElement {
  canvas = h('canvas', { class: 'vp-canvas vp3d', tabIndex: 0 });
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.type = THREE.BasicShadowMap;
  world = new World3D(projectUrl, () => render3D(), true);
  camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
  camera.layers.enableAll();
  orbit = new OrbitControls(camera, canvas);
  // Godot-like: right drag orbits, middle (or Shift+right) drag pans, wheel zooms; left button is for picking and the gizmo
  orbit.mouseButtons = { LEFT: null as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
  orbit.enableDamping = false;
  orbit.zoomToCursor = true;
  orbit.addEventListener('change', () => render3D());
  orbit.addEventListener('end', storeView);
  gizmo = new TransformControls(camera, canvas);
  gizmoHelper = gizmo.getHelper();
  grid = makeGrid();
  box = new THREE.BoxHelper(new THREE.Object3D(), 0xffa53c);
  (box.material as THREE.LineBasicMaterial).depthTest = false;
  box.renderOrder = 5;
  world.scene.add(grid, gizmoHelper, box);

  let before: ReturnType<typeof readTransform> | null = null;
  gizmo.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value;
    const n = ed.current?.selected, obj = gizmo.object;
    if (!(n instanceof Node3D) || !obj) return;
    if (e.value) { before = { position: clone(n.position), rotation: clone(n.rotation), scale: clone(n.scale) }; return; }
    const after = readTransform(obj), was = before;
    before = null;
    if (!was || (sameValue(was, after))) return;
    // one undo step per drag
    exec({ label: '3D 변형', do: () => Object.assign(n.props, clone(after)), undo: () => Object.assign(n.props, clone(was)) });
  });
  gizmo.addEventListener('objectChange', () => {
    const n = ed.current?.selected, obj = gizmo.object;
    if (!(n instanceof Node3D) || !obj) return;
    Object.assign(n.props, readTransform(obj)); // live while dragging; the undo step is added when the drag ends
    if (ed.current) ed.current.dirty = true;
    emit('scene');
  });
  gizmo.addEventListener('change', () => render3D());

  const tool = (m: Mode, label: string, key: string, title: string) => {
    const b = h('button', { class: 'tool' + (mode === m ? ' on' : ''), title: `${title} (${key})`, onclick: () => setMode(m) }, label);
    b.dataset.mode = m;
    return b;
  };
  const toggle = (label: string, title: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = h('button', { class: 'tool' + (get() ? ' on' : ''), title }, label);
    b.onclick = () => { set(!get()); b.classList.toggle('on', get()); render3D(); };
    return b;
  };
  const tools = [tool('select', '➤ 선택', 'Q', '고르기만'), tool('translate', '✥ 이동', 'W', '이동'), tool('rotate', '⟳ 회전', 'E', '회전'), tool('scale', '⤢ 크기', 'R', '크기')];
  const setMode = (m: Mode) => { mode = m; tools.forEach((b) => b.classList.toggle('on', b.dataset.mode === m)); render3D(); };
  const toolbar = h('div', { class: 'vp-toolbar' }, tools,
    h('span', { class: 'sep-v' }),
    toggle('▦ 스냅', '이동 0.5m, 회전 15°, 크기 0.1 단위로', () => snap, (v) => { snap = v; }),
    toggle('로컬', '노드 자신의 축으로 움직이기', () => local, (v) => { local = v; }),
    h('span', { class: 'sep-v' }),
    toggle('🎥 카메라로 보기', '씬의 Camera3D로 게임 화면처럼 보기', () => preview, (v) => { preview = v; }),
    toggle('▩ 픽셀', '게임 해상도로 그려서 픽셀이 보이게', () => pixel, (v) => { pixel = v; }),
    h('span', { class: 'grow' }),
    h('span', { class: 'muted vp-help' }, '오른쪽 끌기: 회전 · 가운데/Shift+오른쪽: 이동 · 휠: 확대'),
    h('button', { class: 'tool', title: '고른 노드로 화면 맞추기 (F)', onclick: focusSelected }, '⌖ 맞춤'));
  hint = h('div', { class: 'vp-empty' }, '이 씬에는 3D 노드가 없어요. 씬 패널에서 3D 노드를 추가해 보세요 (Ctrl+A).');
  const empty = h('div', { class: 'vp-empty' }, '씬을 열거나 씬 패널에서 "3D 씬"을 만들어 주세요.');
  const wrap = h('div', { class: 'vp-wrap' }, canvas, hint, empty);

  // left click picks (on release, so orbit drags and gizmo drags don't change the selection)
  let down: { x: number; y: number; gizmo: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => { canvas.focus(); down = e.button === 0 ? { x: e.clientX, y: e.clientY, gizmo: gizmo.axis !== null } : null; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || e.button !== 0 || !ed.current) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4, onGizmo = down.gizmo;
    down = null;
    if (moved || onGizmo) return;
    select(pickAt(e) || ed.current.root);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const m = ({ q: 'select', w: 'translate', e: 'rotate', r: 'scale' } as Record<string, Mode>)[e.key.toLowerCase()];
    if (m) { setMode(m); e.preventDefault(); }
    else if (e.key.toLowerCase() === 'f') { focusSelected(); e.preventDefault(); }
  });
  // drop a model to make a MeshInstance3D, or an image to make a Sprite3D, where it lands on the ground
  wrap.addEventListener('dragover', (e) => { if (ed.current) e.preventDefault(); });
  wrap.addEventListener('drop', (e) => {
    const path = e.dataTransfer?.getData('text/x-engine-path');
    const s = ed.current;
    const n = path && s ? nodeForAsset(path) : null;
    if (!n || !s) return;
    e.preventDefault();
    const p = groundAt(e);
    n.position = { x: r4(p.x), y: r4(p.y), z: r4(p.z) };
    addNode(s.root, n);
  });

  new ResizeObserver(() => render3D()).observe(wrap);
  const sync = () => { empty.hidden = !!ed.current; render3D(); };
  on('scene', render3D); on('selection', render3D); on('scenes', sync); on('project', render3D); on('files', render3D);
  sync();
  return h('div', { class: 'viewport' }, toolbar, wrap);
}

