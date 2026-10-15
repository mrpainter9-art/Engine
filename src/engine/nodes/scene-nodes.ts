import { Node, type PropDef } from '../node';
import { Node2D } from './node2d';
import { vec2, type Vec2 } from '../math';

/** Godot's Parallax2D: children scroll at scrollScale times the camera speed (0 = fixed to the screen, 1 = world speed). */
export class Parallax2D extends Node2D {
  static typeName = 'Parallax2D';
  static icon = '≋';
  static description = '카메라보다 느리게/빠르게 흐르는 배경 레이어 (원경, 중경, 근경).';
  static props: PropDef[] = [
    { name: 'scrollScale', type: 'vec2', default: vec2(1, 1), hint: '카메라 이동 대비 흐르는 비율. 원경은 작게.' },
    { name: 'scrollOffset', type: 'vec2', default: vec2() },
    { name: 'autoscroll', type: 'vec2', default: vec2(), hint: '초당 저절로 흐르는 픽셀 (구름 등)' },
    { name: 'repeatSize', type: 'vec2', default: vec2(), hint: '0이 아니면 그 간격으로 무한 반복' },
  ];
  declare scrollScale: Vec2;
  declare scrollOffset: Vec2;
  declare autoscroll: Vec2;
  declare repeatSize: Vec2;
}

export class Camera2D extends Node2D {
  static typeName = 'Camera2D';
  static icon = '◎';
  static description = '게임 화면이 비추는 위치. 화면 가운데가 이 노드 위치.';
  static props: PropDef[] = [
    { name: 'current', type: 'bool', default: true },
    { name: 'zoom', type: 'number', default: 1, min: 0.1, step: 0.1 },
  ];
  declare current: boolean;
  declare zoom: number;
}

/** Multiplies everything in the world by one colour: the cheap way to make dusk, night or a stormy day from daytime art. */
export class CanvasModulate extends Node {
  static typeName = 'CanvasModulate';
  static icon = '◐';
  static description = '세상 전체에 색을 곱한다. 낮 그림으로 노을, 밤을 만들 때.';
  static props: PropDef[] = [{ name: 'color', type: 'color', default: '#ffffff' }];
  declare color: string;
}

/** Children draw in screen space, above the world and unaffected by the camera or CanvasModulate (UI, HUD, window frame). */
export class CanvasLayer extends Node {
  static typeName = 'CanvasLayer';
  static icon = '▤';
  static description = '화면에 고정되는 층 (UI, 창틀). 카메라와 조명의 영향을 안 받는다.';
  static props: PropDef[] = [
    { name: 'layer', type: 'int', default: 1 },
    { name: 'visible', type: 'bool', default: true },
  ];
  declare layer: number;
  declare visible: boolean;
}
