import { Node, type PropDef } from '../node';
import { vec3, type Vec3 } from '../math';

// 3D nodes hold plain data like the 2D ones; src/engine/three/world3d.ts turns them into three.js objects.
// Axes follow Godot: +Y up, cameras and lights look down their own -Z, rotation is in degrees (Y, then X, then Z).

export class Node3D extends Node {
  static typeName = 'Node3D';
  static icon = '⬡';
  static description = '위치, 회전, 크기를 가진 3D 노드. 3D 노드를 묶는 용도로도 쓴다.';
  static props: PropDef[] = [
    { name: 'position', type: 'vec3', default: vec3(), step: 0.1 },
    { name: 'rotation', type: 'vec3', default: vec3(), step: 1, hint: '도(degree). Y축 → X축 → Z축 순서로 돈다.' },
    { name: 'scale', type: 'vec3', default: vec3(1, 1, 1), step: 0.1 },
    { name: 'visible', type: 'bool', default: true },
  ];
  declare position: Vec3;
  declare rotation: Vec3;
  declare scale: Vec3;
  declare visible: boolean;
}

export class MeshInstance3D extends Node3D {
  static typeName = 'MeshInstance3D';
  static icon = '◆';
  static description = '상자, 공, 판 같은 기본 도형이나 3D 모델 파일(.glb, .gltf)을 그린다.';
  static props: PropDef[] = [
    { name: 'mesh', type: 'enum', default: 'box', options: ['box', 'sphere', 'plane', 'cylinder', 'cone', 'model'], hint: 'model 을 고르면 아래 model 파일을 그린다.' },
    { name: 'model', type: 'model', default: '' },
    { name: 'size', type: 'vec3', default: vec3(1, 1, 1), step: 0.1, hint: '기본 도형의 크기 (공은 x가 지름, 판은 x와 z).' },
    { name: 'color', type: 'color', default: '#ffffff' },
    { name: 'texture', type: 'texture', default: '', hint: '기본 도형에 씌울 그림. 픽셀이 뭉개지지 않게 그려진다.' },
    { name: 'unshaded', type: 'bool', default: false, hint: '빛과 그림자 없이 원래 색 그대로.' },
    { name: 'castShadow', type: 'bool', default: true },
  ];
  declare mesh: 'box' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'model';
  declare model: string;
  declare size: Vec3;
  declare color: string;
  declare texture: string;
  declare unshaded: boolean;
  declare castShadow: boolean;
}

export class Sprite3D extends Node3D {
  static typeName = 'Sprite3D';
  static icon = '▧';
  static description = '그림 한 장을 3D 공간에 판으로 세운다. 픽셀 그림을 3D에 놓을 때.';
  static props: PropDef[] = [
    { name: 'texture', type: 'texture', default: '' },
    { name: 'pixelSize', type: 'number', default: 0.01, min: 0.0001, step: 0.005, hint: '그림 1픽셀이 3D에서 몇 미터인지.' },
    { name: 'centered', type: 'bool', default: true },
    { name: 'billboard', type: 'bool', default: false, hint: '항상 카메라를 바라본다.' },
    { name: 'shaded', type: 'bool', default: false, hint: '켜면 빛의 영향을 받는다.' },
    { name: 'flipH', type: 'bool', default: false },
  ];
  declare texture: string;
  declare pixelSize: number;
  declare centered: boolean;
  declare billboard: boolean;
  declare shaded: boolean;
  declare flipH: boolean;
}

export class Camera3D extends Node3D {
  static typeName = 'Camera3D';
  static icon = '🎥';
  static description = '3D 화면을 비추는 카메라. 자기 -Z 방향을 본다.';
  static props: PropDef[] = [
    { name: 'current', type: 'bool', default: true },
    { name: 'projection', type: 'enum', default: 'perspective', options: ['perspective', 'orthogonal'], hint: 'orthogonal: 멀어도 작아지지 않는다 (쿼터뷰).' },
    { name: 'fov', type: 'number', default: 70, min: 1, max: 179, step: 1, hint: '세로 시야각 (도)' },
    { name: 'size', type: 'number', default: 10, min: 0.01, step: 0.5, hint: 'orthogonal 일 때 화면 세로 크기 (미터)' },
    { name: 'near', type: 'number', default: 0.05, min: 0.001, step: 0.01 },
    { name: 'far', type: 'number', default: 1000, min: 1, step: 10 },
  ];
  declare current: boolean;
  declare projection: 'perspective' | 'orthogonal';
  declare fov: number;
  declare size: number;
  declare near: number;
  declare far: number;
}

export class DirectionalLight3D extends Node3D {
  static typeName = 'DirectionalLight3D';
  static icon = '☀';
  static description = '해처럼 한 방향에서 오는 빛. 노드를 돌려서 방향을 정한다 (-Z 방향으로 비춤).';
  static props: PropDef[] = [
    { name: 'color', type: 'color', default: '#ffffff' },
    { name: 'energy', type: 'number', default: 1, min: 0, step: 0.1 },
    { name: 'shadows', type: 'bool', default: false },
  ];
  declare color: string;
  declare energy: number;
  declare shadows: boolean;
}

export class OmniLight3D extends Node3D {
  static typeName = 'OmniLight3D';
  static icon = '💡';
  static description = '전구처럼 한 점에서 사방으로 퍼지는 빛.';
  static props: PropDef[] = [
    { name: 'color', type: 'color', default: '#ffe6b0' },
    { name: 'energy', type: 'number', default: 1, min: 0, step: 0.1 },
    { name: 'range', type: 'number', default: 5, min: 0.1, step: 0.5, hint: '빛이 닿는 거리 (미터)' },
    { name: 'shadows', type: 'bool', default: false },
  ];
  declare color: string;
  declare energy: number;
  declare range: number;
  declare shadows: boolean;
}

/** One per scene: the 3D background, the light that fills shadows, and fog. */
export class WorldEnvironment extends Node {
  static typeName = 'WorldEnvironment';
  static icon = '🌐';
  static description = '3D 배경색, 주변광, 안개.';
  static props: PropDef[] = [
    { name: 'background', type: 'color', default: '#6b8fb8' },
    { name: 'clearBackground', type: 'bool', default: true, hint: '끄면 3D 뒤로 2D 배경이 보인다.' },
    { name: 'ambientColor', type: 'color', default: '#ffffff' },
    { name: 'ambientEnergy', type: 'number', default: 0.4, min: 0, step: 0.05 },
    { name: 'fogColor', type: 'color', default: '#c8d4e0' },
    { name: 'fogDensity', type: 'number', default: 0, min: 0, step: 0.005, hint: '0이면 안개 없음' },
  ];
  declare background: string;
  declare clearBackground: boolean;
  declare ambientColor: string;
  declare ambientEnergy: number;
  declare fogColor: string;
  declare fogDensity: number;
}

/** True when a scene has anything the 3D renderer must draw (so 2D-only games never load three.js). */
export function has3D(root: Node | null): boolean {
  let found = false;
  root?.walk((n) => { if (n instanceof Node3D || n instanceof WorldEnvironment) found = true; return found ? false : undefined; });
  return found;
}
