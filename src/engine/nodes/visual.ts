import type { PropDef } from '../node';
import { Node2D } from './node2d';
import { vec2, type Vec2 } from '../math';

type TexSize = (path: string) => { width: number; height: number } | null;

export class Sprite2D extends Node2D {
  static typeName = 'Sprite2D';
  static icon = '▣';
  static description = '이미지(PNG) 한 장을 그린다.';
  static props: PropDef[] = [
    { name: 'texture', type: 'texture', default: '' },
    { name: 'centered', type: 'bool', default: true },
    { name: 'offset', type: 'vec2', default: vec2() },
    { name: 'flipH', type: 'bool', default: false },
    { name: 'flipV', type: 'bool', default: false },
  ];
  declare texture: string;
  declare centered: boolean;
  declare offset: Vec2;
  declare flipH: boolean;
  declare flipV: boolean;

  localBounds(tex?: TexSize) {
    const t = this.texture && tex ? tex(this.texture) : null;
    const w = t ? t.width : 16, h = t ? t.height : 16;
    return { x: this.offset.x - (this.centered ? w / 2 : 0), y: this.offset.y - (this.centered ? h / 2 : 0), w, h };
  }
}

export class ColorRect extends Node2D {
  static typeName = 'ColorRect';
  static icon = '■';
  static description = '색을 칠한 사각형. 그라데이션도 된다 (하늘 등).';
  static props: PropDef[] = [
    { name: 'size', type: 'vec2', default: vec2(64, 64) },
    { name: 'color', type: 'color', default: '#4a7fc0' },
    { name: 'gradient', type: 'bool', default: false, hint: '위에서 아래로 color → colorBottom' },
    { name: 'colorBottom', type: 'color', default: '#a9d3ee' },
  ];
  declare size: Vec2;
  declare color: string;
  declare gradient: boolean;
  declare colorBottom: string;

  localBounds() {
    return { x: 0, y: 0, w: this.size.x, h: this.size.y };
  }
}

export class Label extends Node2D {
  static typeName = 'Label';
  static icon = 'T';
  static description = '글자를 그린다.';
  static props: PropDef[] = [
    { name: 'text', type: 'text', default: 'Label' },
    { name: 'fontSize', type: 'int', default: 8, min: 4 },
    { name: 'color', type: 'color', default: '#ffffff' },
    { name: 'align', type: 'enum', default: 'left', options: ['left', 'center', 'right'] },
    { name: 'font', type: 'string', default: 'monospace', hint: 'CSS 글꼴 이름' },
  ];
  declare text: string;
  declare fontSize: number;
  declare color: string;
  declare align: 'left' | 'center' | 'right';
  declare font: string;

  localBounds() {
    const lines = String(this.text).split('\n');
    const w = Math.max(...lines.map((l) => l.length)) * this.fontSize * 0.6;
    const h = lines.length * this.fontSize * 1.2;
    const x = this.align === 'center' ? -w / 2 : this.align === 'right' ? -w : 0;
    return { x, y: 0, w, h };
  }
}
