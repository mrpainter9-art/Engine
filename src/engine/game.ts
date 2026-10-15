import { Node, type ScriptInstance } from './node';
import { Camera2D } from './nodes/scene-nodes';
import { parseScene } from './scene';
import { Renderer, type View } from './renderer';
import { Textures } from './textures';
import { Input } from './input';
import { Mat2D } from './math';

export interface ProjectConfig {
  name: string;
  mainScene: string;
  viewport: { width: number; height: number };
  background?: string;
  input?: Record<string, string[]>;
}

/**
 * Runs a scene: loads it, attaches scripts, calls ready() once and process(dt) every frame, draws through the current Camera2D.
 * resolve() turns res:// paths into URLs, so the same runtime works in the editor's play window and in an exported web build.
 */
export class Game {
  root: Node | null = null;
  time = 0;
  readonly input: Input;
  readonly textures: Textures;
  readonly renderer: Renderer;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private scripts: ScriptInstance[] = [];

  constructor(
    public canvas: HTMLCanvasElement,
    public project: ProjectConfig,
    public resolve: (path: string) => string,
    public log: (level: 'info' | 'error', msg: string) => void = (l, m) => (l === 'error' ? console.error(m) : console.log(m)),
  ) {
    canvas.width = project.viewport.width;
    canvas.height = project.viewport.height;
    this.ctx = canvas.getContext('2d')!;
    this.input = new Input(project.input || {});
    this.textures = new Textures(resolve);
    this.renderer = new Renderer(this.textures);
  }

  async loadScene(path: string): Promise<Node> {
    const res = await fetch(this.resolve(path), { cache: 'no-store' });
    if (!res.ok) throw new Error(`씬을 열 수 없어요: ${path} (${res.status})`);
    return parseScene(await res.text());
  }

  /** Replace the running scene (like Godot's change_scene_to_file). */
  async changeScene(path: string): Promise<void> {
    const root = await this.loadScene(path);
    await this.attachScripts(root);
    this.root = root;
    this.callReady(root);
  }

  private async attachScripts(root: Node): Promise<void> {
    this.scripts = [];
    const withScripts: Node[] = [];
    root.walk((n) => { if (n.script) withScripts.push(n); });
    for (const n of withScripts) {
      try {
        const mod = await import(/* @vite-ignore */ this.resolve(n.script) + '?t=' + Date.now());
        const Cls = mod.default;
        const inst: ScriptInstance = typeof Cls === 'function' ? new Cls() : Object.create(Cls);
        inst.node = n;
        inst.game = this;
        n.scriptInstance = inst;
        this.scripts.push(inst);
      } catch (e) {
        this.log('error', `스크립트 오류 ${n.script}: ${(e as Error).message}`);
      }
    }
  }

  /** Children before parents, like Godot, so a parent's ready() can rely on its children. */
  private callReady(n: Node): void {
    for (const c of n.children) this.callReady(c);
    this.safe(n.scriptInstance, 'ready');
  }

  private safe(inst: ScriptInstance | null, fn: 'ready' | 'process', arg?: number): void {
    if (!inst || typeof inst[fn] !== 'function') return;
    try { (inst[fn] as (a?: number) => void)(arg); } catch (e) {
      this.log('error', `${inst.node?.path()} ${fn}(): ${(e as Error).message}`);
      inst[fn] = undefined; // one report per broken function, not one per frame
    }
  }

  find(path: string): Node | null {
    if (!this.root) return null;
    const rel = path.startsWith(this.root.name + '/') ? path.slice(this.root.name.length + 1) : path;
    return this.root.find(rel);
  }

  camera(): Camera2D | null {
    let cam: Camera2D | null = null;
    this.root?.walk((n) => { if (!cam && n instanceof Camera2D && n.current && n.visible) cam = n; });
    return cam;
  }

  view(): View {
    const { width, height } = this.project.viewport;
    const cam = this.camera() as Camera2D | null;
    const center = cam ? cameraWorldPos(cam) : { x: width / 2, y: height / 2 };
    const zoom = cam ? cam.zoom : 1;
    return {
      center, zoom, width, height, time: this.time,
      parallaxOrigin: { x: center.x - width / 2 / zoom, y: center.y - height / 2 / zoom },
      screenSize: { x: width, y: height },
      layerMatrix: new Mat2D(),
    };
  }

  step(dt: number): void {
    this.time += dt;
    for (const s of this.scripts) this.safe(s, 'process', dt);
    this.input.endFrame();
    this.renderer.render(this.ctx, this.root, this.view(), this.project.background || '#000000');
  }

  start(): void {
    const keys = (ev: KeyboardEvent) => {
      this.input.keyEvent(ev);
      for (const s of this.scripts) if (s.input) try { s.input(ev); } catch (e) { this.log('error', (e as Error).message); }
    };
    addEventListener('keydown', keys);
    addEventListener('keyup', keys);
    const mouse = (ev: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.input.mouse = { x: ((ev.clientX - r.left) / r.width) * this.canvas.width, y: ((ev.clientY - r.top) / r.height) * this.canvas.height };
      if (ev.type === 'mousedown') this.input.mouseDown = true;
      if (ev.type === 'mouseup') this.input.mouseDown = false;
    };
    for (const t of ['mousemove', 'mousedown', 'mouseup'] as const) this.canvas.addEventListener(t, mouse);
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}

/** A camera's position in world space, through its parents. */
export function cameraWorldPos(cam: Node): { x: number; y: number } {
  const chain: Node[] = [];
  for (let n: Node | null = cam; n; n = n.parent) chain.unshift(n);
  let m = new Mat2D();
  for (const n of chain) {
    const nn = n as unknown as { position?: { x: number; y: number }; rotation?: number; scale?: { x: number; y: number } };
    if (nn.position) m = m.translate(nn.position.x, nn.position.y).rotate(nn.rotation || 0).scale(nn.scale?.x ?? 1, nn.scale?.y ?? 1);
  }
  return m.apply({ x: 0, y: 0 });
}
