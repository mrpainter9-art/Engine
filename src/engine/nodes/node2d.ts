import { Node, type PropDef } from '../node';
import { vec2, type Vec2 } from '../math';

/** Anything with a position in the 2D world. */
export class Node2D extends Node {
  static typeName = 'Node2D';
  static icon = '✥';
  static description = '위치, 회전, 크기를 가진 2D 노드.';
  static props: PropDef[] = [
    { name: 'position', type: 'vec2', default: vec2() },
    { name: 'rotation', type: 'number', default: 0, step: 1, hint: '도(degree)' },
    { name: 'scale', type: 'vec2', default: vec2(1, 1) },
    { name: 'visible', type: 'bool', default: true },
    { name: 'opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.05 },
    { name: 'zIndex', type: 'int', default: 0, hint: '형제 노드끼리 그리는 순서. 클수록 위.' },
  ];
  declare position: Vec2;
  declare rotation: number;
  declare scale: Vec2;
  declare visible: boolean;
  declare opacity: number;
  declare zIndex: number;

  /** Local-space box for picking and the selection outline, or null for nodes that draw nothing. */
  localBounds(_tex?: (path: string) => { width: number; height: number } | null): { x: number; y: number; w: number; h: number } | null {
    return null;
  }
}
