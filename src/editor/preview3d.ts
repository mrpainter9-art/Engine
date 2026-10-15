import * as THREE from 'three';
import { Node, createNode, type MeshInstance3D, type DirectionalLight3D, type WorldEnvironment } from '../engine';
import { World3D } from '../engine/three/world3d';
import { projectUrl } from './api';

// Pictures of 3D things for the asset previews: model thumbnails, the model viewer in the inspector, and the 3D part of scene thumbnails.
// One shared WebGL renderer draws them all and each picture is copied into an ordinary canvas.

let gl: THREE.WebGLRenderer | null = null;
function renderer(w: number, h: number): THREE.WebGLRenderer {
  if (!gl) {
    gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    gl.setPixelRatio(1);
    gl.shadowMap.type = THREE.BasicShadowMap;
  }
  const size = gl.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) gl.setSize(w, h, false);
  return gl;
}

function copyTo(target: HTMLCanvasElement, src: HTMLCanvasElement) {
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(src, 0, 0, target.width, target.height);
}

/** Sync until every texture and model the scene uses has arrived (or a few seconds passed). */
async function settle(world: World3D, root: Node): Promise<void> {
  world.sync(root);
  for (let i = 0; i < 60 && world.pending > 0; i++) { await new Promise((r) => setTimeout(r, 50)); world.sync(root); }
  world.sync(root);
}

/** The 3D layer of a scene seen through its Camera3D, as the game would draw it (for scene thumbnails). */
export async function renderScene3D(root: Node, w: number, h: number): Promise<HTMLCanvasElement> {
  const world = new World3D(projectUrl);
  await settle(world, root);
  const r = renderer(w, h);
  r.shadowMap.enabled = world.shadows;
  r.setClearColor(0x000000, 0);
  let cam = world.camera(w / h);
  if (!cam) { const c = new THREE.PerspectiveCamera(70, w / h, 0.05, 1000); c.position.set(0, 2, 6); c.lookAt(0, 0, 0); cam = c; }
  r.render(world.scene, cam);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  copyTo(out, r.domElement);
  world.dispose();
  return out;
}

export interface ModelInfo { meshes: number; triangles: number; materials: number; size: { x: number; y: number; z: number } }

/** A small studio for one model: the model, a sun and some fill light. */
async function studio(path: string) {
  const root = createNode('Node3D', 'Preview');
  const env = createNode('WorldEnvironment') as WorldEnvironment;
  env.clearBackground = false; env.ambientEnergy = 0.7;
  const sun = createNode('DirectionalLight3D') as DirectionalLight3D;
  sun.rotation = { x: -40, y: -35, z: 0 };
  const mesh = createNode('MeshInstance3D') as MeshInstance3D;
  mesh.mesh = 'model'; mesh.model = path;
  root.addChild(env); root.addChild(sun); root.addChild(mesh);
  const world = new World3D(projectUrl);
  await settle(world, root);
  const obj = world.objectOf(mesh)!;
  const box = new THREE.Box3().setFromObject(obj);
  const info: ModelInfo = { meshes: 0, triangles: 0, materials: 0, size: { x: 0, y: 0, z: 0 } };
  const mats = new Set<THREE.Material>();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    info.meshes++;
    const g = m.geometry;
    info.triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    for (const mat of ([] as THREE.Material[]).concat(m.material)) mats.add(mat);
  });
  info.materials = mats.size;
  if (!box.isEmpty()) { const s = box.getSize(new THREE.Vector3()); info.size = { x: s.x, y: s.y, z: s.z }; }
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const radius = box.isEmpty() ? 1 : Math.max(0.01, box.getSize(new THREE.Vector3()).length() / 2);
  const cam = new THREE.PerspectiveCamera(35, 1, radius / 100, radius * 100);
  const shoot = (yaw: number, pitch: number, aspect: number) => {
    const d = (radius / Math.sin((cam.fov * Math.PI) / 360)) * 1.05;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    cam.position.set(center.x + d * Math.cos(pitch) * Math.sin(yaw), center.y + d * Math.sin(pitch), center.z + d * Math.cos(pitch) * Math.cos(yaw));
    cam.lookAt(center);
  };
  return { world, cam, shoot, info, failed: box.isEmpty() };
}

export async function modelThumbnail(path: string, size: number): Promise<HTMLCanvasElement | null> {
  const s = await studio(path);
  if (s.failed) { s.world.dispose(); return null; }
  s.shoot(0.6, 0.35, 1);
  const r = renderer(size, size);
  r.setClearColor(0x000000, 0);
  r.render(s.world.scene, s.cam);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  copyTo(out, r.domElement);
  s.world.dispose();
  return out;
}

/** A turntable for the inspector: turns slowly by itself, drag to look around. Stops when it leaves the page. */
export async function modelViewer(path: string, canvas: HTMLCanvasElement): Promise<ModelInfo | null> {
  const s = await studio(path);
  if (s.failed) { s.world.dispose(); return null; }
  let yaw = 0.6, pitch = 0.35, drag: { x: number; y: number; yaw: number; pitch: number } | null = null, last = performance.now();
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    yaw = drag.yaw - (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * 0.01));
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  const frame = (now: number) => {
    if (!canvas.isConnected) { s.world.dispose(); return; }
    if (!drag) yaw += (now - last) * 0.0004;
    last = now;
    const w = canvas.width, h = canvas.height;
    s.shoot(yaw, pitch, w / h);
    const r = renderer(w, h);
    r.setClearColor(0x000000, 0);
    r.render(s.world.scene, s.cam);
    copyTo(canvas, r.domElement);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return s.info;
}
