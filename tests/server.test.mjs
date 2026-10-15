import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveInside } from '../server/paths.mjs';
import * as fsapi from '../server/fsapi.mjs';
import * as git from '../server/gitapi.mjs';
import { graph } from '../server/graph.mjs';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'engine-test-'));

describe('project paths', () => {
  it('keeps every path inside the project folder', () => {
    const root = path.resolve('/proj');
    expect(resolveInside(root, 'res://a/b.png')).toBe(path.join(root, 'a/b.png'));
    expect(() => resolveInside(root, 'res://../secret')).toThrow();
    expect(() => resolveInside(root, '../../etc/passwd')).toThrow();
    expect(() => resolveInside(root, 'res://a/../../x')).toThrow();
  });
});

describe('file api', () => {
  it('writes, lists, renames and removes files', async () => {
    const root = await tmp();
    await fsapi.write(root, { path: 'res://scenes/a.scene.json', text: '{}' });
    await fsapi.write(root, { path: 'res://art/p.png', base64: Buffer.from('png').toString('base64') });
    let files = (await fsapi.list(root)).map((f) => f.path);
    expect(files).toContain('res://scenes/a.scene.json');
    expect(files).toContain('res://art/p.png');
    await fsapi.rename(root, { from: 'res://scenes/a.scene.json', to: 'res://scenes/b.scene.json' });
    expect((await fsapi.read(root, 'res://scenes/b.scene.json')).text).toBe('{}');
    await fsapi.remove(root, { path: 'res://art' });
    files = (await fsapi.list(root)).map((f) => f.path);
    expect(files).not.toContain('res://art/p.png');
    await expect(fsapi.remove(root, { path: 'res://' })).rejects.toThrow();
  });
});

describe('asset graph', () => {
  it('links the example: project → scenes → scripts and assets, scripts → scenes', async () => {
    const g = await graph(path.resolve('examples/train-window'));
    const has = (from, to, label) => g.edges.some((e) => e.from === from && e.to === to && (!label || e.label === label));
    expect(has('res://project.json', 'res://scenes/main.scene.json', '메인 씬')).toBe(true);
    expect(has('res://scenes/main.scene.json', 'res://scripts/train.js', 'Main · 스크립트')).toBe(true);
    expect(has('res://scenes/cabin.scene.json', 'res://models/pine.glb', 'Outside/Trees/Pine1 · model')).toBe(true);
    expect(g.edges.find((e) => e.from === 'res://scripts/train.js' && e.to === 'res://scenes/cabin.scene.json')?.label).toMatch(/행 · changeScene$/);
    expect(g.nodes.filter((n) => !n.used).map((n) => n.path)).toEqual(['res://project.json']);
    expect(g.nodes.some((n) => n.path.endsWith('AGENTS.md'))).toBe(false);
  });

  it('finds unused and missing files and relative imports', async () => {
    const root = await tmp();
    await fsapi.write(root, { path: 'res://scripts/a.js', text: "import { b } from './lib/b.js';\nconst img = 'res://art/gone.png';\n" });
    await fsapi.write(root, { path: 'res://scripts/lib/b.js', text: 'export const b = 1;\n' });
    await fsapi.write(root, { path: 'res://art/old.png', base64: '' });
    const g = await graph(root);
    expect(g.edges).toContainEqual({ from: 'res://scripts/a.js', to: 'res://scripts/lib/b.js', label: '1행 · import' });
    expect(g.nodes.find((n) => n.path === 'res://art/gone.png')?.kind).toBe('missing');
    expect(g.nodes.find((n) => n.path === 'res://art/old.png')?.used).toBe(false);
  });
});

describe('AI guide for game projects', () => {
  it('the example ships the same AGENTS.md the editor writes', async () => {
    const [a, b] = await Promise.all([fs.readFile('server/project-agents.md', 'utf8'), fs.readFile('examples/train-window/AGENTS.md', 'utf8')]);
    expect(b).toBe(a);
  });
});

describe('git api', () => {
  it('inits, shows changes and commits', async () => {
    const root = await tmp();
    expect((await git.status(root)).isRepo).toBe(false);
    await git.init(root);
    await fs.writeFile(path.join(root, 'project.json'), '{"name":"t"}\n');
    const st = await git.status(root);
    expect(st.isRepo).toBe(true);
    expect(st.files.map((f) => f.path)).toContain('res://project.json');
    expect((await git.diff(root, { path: 'res://project.json' })).text).toContain('"name"');
    await git.commit(root, { message: '첫 커밋' });
    expect((await git.status(root)).files).toEqual([]);
    expect((await git.log(root)).commits[0].subject).toBe('첫 커밋');
  });
});
