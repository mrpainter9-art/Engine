import * as THREE from 'three';
import type { Node } from '../node';
import { World3D } from './world3d';

/**
 * The game's 3D layer: renders the scene's 3D nodes at the game resolution into its own canvas,
 * which the 2D renderer then draws under the 2D world (so pixel-art 2D and UI sit on top of 3D).
 */
export class GameRenderer3D {
  readonly canvas = document.createElement('canvas');
  readonly renderer: THREE.WebGLRenderer;
  readonly world: World3D;
  private fallback = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);

  constructor(resolve: (path: string) => string, private width: number, private height: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // hard-edged shadows suit pixel art
    this.world = new World3D(resolve);
    this.fallback.position.set(0, 2, 6);
    this.fallback.lookAt(0, 0, 0);
  }

  render(root: Node | null): HTMLCanvasElement {
    this.world.sync(root);
    this.renderer.shadowMap.enabled = this.world.shadows;
    const aspect = this.width / this.height;
    let cam = this.world.camera(aspect);
    if (!cam) { this.fallback.aspect = aspect; this.fallback.updateProjectionMatrix(); cam = this.fallback; }
    this.renderer.render(this.world.scene, cam);
    return this.canvas;
  }
}
