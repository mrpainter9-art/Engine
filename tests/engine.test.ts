import { describe, expect, it } from 'vitest';
import exampleScene from '../examples/train-window/scenes/main.scene.json?raw';
import cabinScene from '../examples/train-window/scenes/cabin.scene.json?raw';
import { createNode, parseScene, serializeScene, parallaxShift, has3D, Mat2D, type Node2D, type Node3D, type MeshInstance3D, type Parallax2D, type View } from '../src/engine';

const view = (x: number): View => ({ center: { x: x + 280, y: 120 }, zoom: 1, width: 560, height: 240, parallaxOrigin: { x, y: 0 }, screenSize: { x: 560, y: 240 }, time: 0, layerMatrix: new Mat2D() });

describe('scene files', () => {
  it('round-trips the example scene unchanged', () => {
    expect(serializeScene(parseScene(exampleScene))).toBe(exampleScene);
  });

  it('round-trips the 3D example scene unchanged', () => {
    expect(serializeScene(parseScene(cabinScene))).toBe(cabinScene);
  });

  it('writes only properties that differ from the default', () => {
    const root = createNode('Node2D', 'Root');
    const s = root.addChild(createNode('Sprite2D')) as Node2D;
    s.position = { x: 3, y: 4 };
    const data = JSON.parse(serializeScene(root));
    expect(data.root.props).toBeUndefined();
    expect(data.root.children[0]).toEqual({ type: 'Sprite2D', name: 'Sprite2D', props: { position: { x: 3, y: 4 } } });
  });
});

describe('nodes', () => {
  it('keeps sibling names unique and finds nodes by path', () => {
    const root = createNode('Node', 'Root');
    const a = root.addChild(createNode('Node2D', 'Item'));
    const b = root.addChild(createNode('Node2D', 'Item'));
    expect(a.name).toBe('Item');
    expect(b.name).toBe('Item2');
    const c = b.addChild(createNode('Label', 'Text'));
    expect(root.find('Item2/Text')).toBe(c);
    expect(c.path()).toBe('Root/Item2/Text');
    expect(root.isAncestorOf(c)).toBe(true);
  });

  it('rejects unknown node types', () => {
    expect(() => createNode('Spaceship')).toThrow();
  });
});

describe('3D nodes', () => {
  it('keep 3D vectors and only save what changed', () => {
    const root = createNode('Node3D', 'World') as Node3D;
    const m = root.addChild(createNode('MeshInstance3D', 'Tree')) as MeshInstance3D;
    m.position = { x: 1, y: 0, z: -2 };
    m.mesh = 'model';
    m.model = 'res://models/pine.glb';
    const data = JSON.parse(serializeScene(root));
    expect(data.root.children[0].props).toEqual({ position: { x: 1, y: 0, z: -2 }, mesh: 'model', model: 'res://models/pine.glb' });
    const back = parseScene(serializeScene(root)).find('Tree') as MeshInstance3D;
    expect(back.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('tells 3D scenes from 2D ones (2D games never load three.js)', () => {
    expect(has3D(parseScene(exampleScene))).toBe(false);
    expect(has3D(parseScene(cabinScene))).toBe(true);
  });
});

describe('parallax', () => {
  it('moves a layer at scrollScale times the camera speed', () => {
    const far = createNode('Parallax2D') as Parallax2D;
    far.scrollScale = { x: 0.25, y: 1 };
    // screen x of the layer's origin = shift - camera left edge
    const screen = (camX: number) => parallaxShift(far, view(camX)).x - camX;
    expect(screen(0)).toBe(0);
    expect(screen(400)).toBe(-100);
  });

  it('a scrollScale of 0 stays fixed on the screen', () => {
    const sky = createNode('Parallax2D') as Parallax2D;
    sky.scrollScale = { x: 0, y: 0 };
    expect(parallaxShift(sky, view(1234)).x - 1234).toBe(0);
  });
});
