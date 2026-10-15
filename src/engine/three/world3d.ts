import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Node } from '../node';
import { Node3D, MeshInstance3D, Sprite3D, Camera3D, DirectionalLight3D, OmniLight3D, WorldEnvironment } from '../nodes/node3d';

// Light strength: three.js uses physical units, these make energy 1 look like Godot's default.
const SUN = 2.2;
const AMBIENT = 1.2;
const DEG = Math.PI / 180;
const EPS = 1e-6;

interface Entry {
  group: THREE.Group; // the node's transform; child nodes' groups hang under it
  visual: THREE.Object3D | null; // what the node draws (mesh, light, camera, editor icon)
  key: string; // visual is rebuilt when this changes
  camera?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  light?: THREE.DirectionalLight | THREE.PointLight;
}

const iconCache = new Map<string, THREE.Texture>();
function iconTexture(emoji: string): THREE.Texture {
  let t = iconCache.get(emoji);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(33,38,46,.85)';
    g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.font = '36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 32, 35);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    iconCache.set(emoji, t);
  }
  return t;
}

/** Editor helpers live on layer 1: the editor camera sees every layer, a scene's Camera3D only layer 0 (as in the game). */
export const EDITOR_LAYER = 1;
function editorOnly<T extends THREE.Object3D>(o: T): T {
  o.userData.editorOnly = true;
  o.layers.set(EDITOR_LAYER);
  return o;
}

/** Marker for nodes that draw nothing themselves (cameras, lights): a screen-sized icon you can click. */
function editorIcon(emoji: string): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(emoji), depthTest: false, sizeAttenuation: false, transparent: true }));
  s.scale.set(0.06, 0.06, 1);
  s.renderOrder = 10;
  return editorOnly(s);
}

function lines(points: number[][], color: number): THREE.LineSegments {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return editorOnly(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8 })));
}

function geometry(n: MeshInstance3D): THREE.BufferGeometry {
  const s = n.size;
  switch (n.mesh) {
    case 'sphere': return new THREE.SphereGeometry(s.x / 2, 16, 12);
    case 'plane': return new THREE.PlaneGeometry(s.x, s.z).rotateX(-Math.PI / 2); // lies flat and faces up, like Godot's PlaneMesh
    case 'cylinder': return new THREE.CylinderGeometry(s.x / 2, s.x / 2, s.y, 16);
    case 'cone': return new THREE.ConeGeometry(s.x / 2, s.y, 16);
    default: return new THREE.BoxGeometry(s.x, s.y, s.z);
  }
}

/** The scene's camera set up for an aspect ratio. */
export function setupCamera(cam: THREE.PerspectiveCamera | THREE.OrthographicCamera, n: Camera3D, aspect: number): void {
  if (cam instanceof THREE.PerspectiveCamera) {
    cam.fov = n.fov; cam.aspect = aspect;
  } else {
    const h = n.size / 2;
    cam.top = h; cam.bottom = -h; cam.left = -h * aspect; cam.right = h * aspect;
  }
  cam.near = n.near; cam.far = n.far;
  cam.updateProjectionMatrix();
}

/**
 * Keeps a three.js scene in step with the engine's node tree. Call sync() before each render: transforms are copied every time,
 * meshes and lights are rebuilt only when the properties they are made from change. Used by the game and by the editor's 3D view.
 */
export class World3D {
  readonly scene = new THREE.Scene();
  readonly ambient = new THREE.AmbientLight(0xffffff, 0.4 * AMBIENT);
  /** True when a visible light wants shadows (the renderer turns its shadow map on). */
  shadows = false;
  /** Files still loading; previews wait for this to reach 0 before taking a picture. */
  pending = 0;
  environment: WorldEnvironment | null = null;
  cameraNode: Camera3D | null = null;
  private entries = new Map<Node, Entry>();
  private textures = new Map<string, THREE.Texture>();
  private models = new Map<string, { scene: THREE.Object3D | null; failed: boolean }>();
  private loader = new GLTFLoader();
  private background = new THREE.Color();
  private fog = new THREE.FogExp2(0xffffff, 0);

  constructor(public resolve: (path: string) => string, public onChange: () => void = () => {}, public editor = false) {
    this.scene.add(this.ambient);
  }

  sync(root: Node | null): void {
    const seen = new Set<Node>();
    this.environment = null;
    this.cameraNode = null;
    this.shadows = false;
    const visit = (n: Node, parent: THREE.Object3D) => {
      let next = parent;
      if (n instanceof WorldEnvironment && !this.environment) this.environment = n;
      if (n instanceof Node3D) {
        seen.add(n);
        const e = this.entry(n);
        if (e.group.parent !== parent) parent.add(e.group);
        this.apply(n, e);
        next = e.group;
        if (n instanceof Camera3D && n.current && !this.cameraNode) this.cameraNode = n;
        if ((n instanceof DirectionalLight3D || n instanceof OmniLight3D) && n.shadows && n.visible) this.shadows = true;
      }
      for (const c of n.children) visit(c, next);
    };
    if (root) visit(root, this.scene);
    for (const [n, e] of this.entries) if (!seen.has(n)) { e.group.removeFromParent(); this.dropVisual(e); this.entries.delete(n); }
    const env = this.environment as WorldEnvironment | null; // set inside visit(), which TS cannot see
    this.ambient.color.set(env ? env.ambientColor : '#ffffff');
    this.ambient.intensity = (env ? env.ambientEnergy : 0.4) * AMBIENT;
    this.scene.background = env && env.clearBackground ? this.background.set(env.background) : null;
    if (env && env.fogDensity > 0) { this.fog.color.set(env.fogColor); this.fog.density = env.fogDensity; this.scene.fog = this.fog; } else this.scene.fog = null;
  }

  /** The scene's current Camera3D as a three.js camera for this aspect ratio, or null when the scene has none. */
  camera(aspect: number): THREE.Camera | null {
    const n = this.cameraNode;
    const cam = n && this.entries.get(n)?.camera;
    if (!n || !cam) return null;
    setupCamera(cam, n, aspect);
    return cam;
  }

  /** The node a three.js object belongs to (for picking in the editor). */
  nodeOf(o: THREE.Object3D | null): Node | null {
    for (let p = o; p; p = p.parent) if (p.userData.node) return p.userData.node as Node;
    return null;
  }

  objectOf(n: Node): THREE.Group | null {
    return this.entries.get(n)?.group || null;
  }

  texture(path: string): THREE.Texture | null {
    if (!path) return null;
    let t = this.textures.get(path);
    if (!t) {
      this.pending++;
      t = new THREE.TextureLoader().load(this.resolve(path), () => this.loaded(), undefined, () => this.loaded());
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter; // pixel art stays crisp
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      this.textures.set(path, t);
    }
    return t;
  }

  private ready(t: THREE.Texture | null): t is THREE.Texture {
    return !!t && !!(t.image as { width?: number } | undefined)?.width;
  }

  private model(path: string): { scene: THREE.Object3D | null; failed: boolean } {
    let m = this.models.get(path);
    if (!m) {
      const entry = { scene: null as THREE.Object3D | null, failed: false };
      m = entry;
      this.models.set(path, m);
      this.pending++;
      this.loader.load(this.resolve(path), (gltf) => {
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          for (const mat of ([] as THREE.Material[]).concat(mesh.material)) {
            const map = (mat as THREE.MeshStandardMaterial).map;
            if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true; }
          }
        });
        entry.scene = gltf.scene;
        this.loaded();
      }, undefined, () => { entry.failed = true; this.loaded(); });
    }
    return m;
  }

  private loaded(): void {
    this.pending--;
    for (const e of this.entries.values()) e.key = ''; // rebuild visuals that waited for this file
    this.onChange();
  }

  private entry(n: Node3D): Entry {
    let e = this.entries.get(n);
    if (!e) {
      e = { group: new THREE.Group(), visual: null, key: '\0' };
      e.group.userData.node = n;
      this.entries.set(n, e);
    }
    return e;
  }

  private apply(n: Node3D, e: Entry): void {
    const g = e.group;
    g.name = n.name;
    g.position.set(n.position.x, n.position.y, n.position.z);
    g.rotation.set(n.rotation.x * DEG, n.rotation.y * DEG, n.rotation.z * DEG, 'YXZ');
    g.scale.set(n.scale.x || EPS, n.scale.y || EPS, n.scale.z || EPS);
    g.visible = n.visible;
    const key = this.keyOf(n);
    if (key !== e.key) {
      this.dropVisual(e);
      e.visual = this.build(n, e);
      if (e.visual) g.add(e.visual);
      e.key = key;
    }
    if (e.light) {
      const l = n as DirectionalLight3D | OmniLight3D;
      e.light.color.set(l.color);
      if (l instanceof OmniLight3D && e.light instanceof THREE.PointLight) {
        e.light.distance = l.range;
        e.light.intensity = (l.energy * l.range * l.range) / 4; // `energy` brightness at half the range
      } else e.light.intensity = l.energy * SUN;
    }
  }

  /** Everything a node's visual is made from; a change means rebuild. Transforms and light colours are applied live instead. */
  private keyOf(n: Node3D): string {
    if (n instanceof MeshInstance3D) {
      const ready = n.mesh === 'model' ? (n.model ? (this.model(n.model).scene ? 'ok' : this.model(n.model).failed ? 'x' : '…') : '') : this.ready(this.texture(n.texture)) ? 'ok' : '';
      return JSON.stringify(['mesh', n.mesh, n.model, n.size, n.color, n.texture, n.unshaded, n.castShadow, ready]);
    }
    if (n instanceof Sprite3D) return JSON.stringify(['sprite', n.texture, this.ready(this.texture(n.texture)), n.pixelSize, n.centered, n.billboard, n.shaded, n.flipH]);
    if (n instanceof Camera3D) return 'camera:' + n.projection;
    if (n instanceof DirectionalLight3D) return 'sun:' + n.shadows;
    if (n instanceof OmniLight3D) return 'omni:' + n.shadows;
    return '';
  }

  private build(n: Node3D, e: Entry): THREE.Object3D | null {
    e.camera = undefined;
    e.light = undefined;
    if (n instanceof MeshInstance3D) return this.buildMesh(n);
    if (n instanceof Sprite3D) return this.buildSprite(n);
    if (n instanceof Camera3D) {
      const cam = n.projection === 'orthogonal' ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 1000) : new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
      e.camera = cam;
      const g = new THREE.Group();
      g.add(cam);
      if (this.editor) {
        const d = 0.6, w = 0.45, h = 0.3;
        g.add(lines([[0, 0, 0], [-w, h, -d], [0, 0, 0], [w, h, -d], [0, 0, 0], [w, -h, -d], [0, 0, 0], [-w, -h, -d],
          [-w, h, -d], [w, h, -d], [w, h, -d], [w, -h, -d], [w, -h, -d], [-w, -h, -d], [-w, -h, -d], [-w, h, -d], [-0.15, h + 0.05, -d], [0, h + 0.2, -d], [0, h + 0.2, -d], [0.15, h + 0.05, -d]], 0xc9a7ff));
        g.add(editorIcon('🎥'));
      }
      return g;
    }
    if (n instanceof DirectionalLight3D) {
      const l = new THREE.DirectionalLight();
      l.position.set(0, 0, 40); // three.js shadows need a position; Godot's sun has none, so it sits far back along +Z
      l.target.position.set(0, 0, 39);
      l.castShadow = n.shadows;
      if (n.shadows) {
        const c = l.shadow.camera;
        c.left = c.bottom = -15; c.right = c.top = 15; c.near = 1; c.far = 120;
        l.shadow.mapSize.set(2048, 2048);
        l.shadow.bias = -0.0005;
      }
      e.light = l;
      const g = new THREE.Group();
      g.add(l, l.target);
      if (this.editor) { g.add(lines([[0, 0, 0], [0, 0, -1.5], [0, 0, -1.5], [0.12, 0, -1.25], [0, 0, -1.5], [-0.12, 0, -1.25]], 0xffd166)); g.add(editorIcon('☀')); }
      return g;
    }
    if (n instanceof OmniLight3D) {
      const l = new THREE.PointLight(0xffffff, 1, 5, 2);
      l.castShadow = n.shadows;
      e.light = l;
      const g = new THREE.Group();
      g.add(l);
      if (this.editor) g.add(editorIcon('💡'));
      return g;
    }
    return null;
  }

  private buildMesh(n: MeshInstance3D): THREE.Object3D | null {
    if (n.mesh === 'model') {
      const m = n.model ? this.model(n.model) : null;
      if (!m?.scene) {
        if (!this.editor) return null;
        // stand-in while loading, red when the file is missing
        return editorOnly(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: m?.failed ? 0xe05050 : 0x8a8f9a })));
      }
      const o = m.scene.clone(true);
      o.userData.shared = true; // geometry and materials belong to the cached file
      o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = n.castShadow; c.receiveShadow = true; } });
      return o;
    }
    const tex = this.texture(n.texture);
    const map = this.ready(tex) ? tex : null;
    const flat = n.mesh === 'sphere' || n.mesh === 'cylinder' || n.mesh === 'cone';
    const params = { color: new THREE.Color(n.color), map, alphaTest: map ? 0.5 : 0, side: n.mesh === 'plane' ? THREE.DoubleSide : THREE.FrontSide };
    const mat = n.unshaded ? new THREE.MeshBasicMaterial(params) : new THREE.MeshStandardMaterial({ ...params, roughness: 1, metalness: 0, flatShading: flat });
    const mesh = new THREE.Mesh(geometry(n), mat);
    mesh.castShadow = n.castShadow && !n.unshaded;
    mesh.receiveShadow = !n.unshaded;
    return mesh;
  }

  private buildSprite(n: Sprite3D): THREE.Object3D | null {
    const tex = this.texture(n.texture);
    if (!this.ready(tex)) {
      if (!this.editor) return null;
      return editorOnly(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.5, 0.5)), new THREE.LineBasicMaterial({ color: 0x8a8f9a })));
    }
    const img = tex.image as { width: number; height: number };
    const w = img.width * n.pixelSize, h = img.height * n.pixelSize;
    if (n.billboard) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 }));
      s.center.set(n.centered ? 0.5 : 0, n.centered ? 0.5 : 0);
      s.scale.set(n.flipH ? -w : w, h, 1);
      return s;
    }
    const geo = new THREE.PlaneGeometry(w, h);
    if (!n.centered) geo.translate(w / 2, h / 2, 0);
    const params = { map: tex, alphaTest: 0.5, side: THREE.DoubleSide };
    const m = new THREE.Mesh(geo, n.shaded ? new THREE.MeshStandardMaterial({ ...params, roughness: 1, metalness: 0 }) : new THREE.MeshBasicMaterial(params));
    if (n.flipH) m.scale.x = -1;
    m.receiveShadow = n.shaded;
    return m;
  }

  private dropVisual(e: Entry): void {
    const v = e.visual;
    e.visual = null;
    if (!v) return;
    v.removeFromParent();
    if (v.userData.shared) return;
    v.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      for (const mat of ([] as THREE.Material[]).concat(m.material || [])) mat.dispose(); // textures are cached and stay
      if ((o as THREE.Light).isLight) (o as THREE.Light).dispose();
    });
  }

  dispose(): void {
    for (const e of this.entries.values()) this.dropVisual(e);
    this.entries.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}
