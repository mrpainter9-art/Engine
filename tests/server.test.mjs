import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveInside } from '../server/paths.mjs';
import * as fsapi from '../server/fsapi.mjs';
import * as git from '../server/gitapi.mjs';
import { agentCommand, buildPrompt, claudeEvents } from '../server/aiapi.mjs';

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

describe('ai api', () => {
  it('starts claude read-only by default and with edits allowed on request', () => {
    expect(agentCommand('claude', { mode: 'ask' }).args).toContain('plan');
    expect(agentCommand('claude', { mode: 'edit', resume: true }).args).toEqual(expect.arrayContaining(['acceptEdits', '--continue']));
    expect(agentCommand('codex', { mode: 'ask' }).args).toContain('read-only');
  });

  it('puts the engine cheat-sheet and editor state before the request', () => {
    const p = buildPrompt({ prompt: '구름 추가', context: { scene: 'res://scenes/main.scene.json' } });
    expect(p).toContain('Node types and their props');
    expect(p).toContain('Open scene: res://scenes/main.scene.json');
    expect(p.trim().endsWith('구름 추가')).toBe(true);
  });

  it('turns claude stream-json into panel events', () => {
    expect(claudeEvents(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '안녕' }, { type: 'tool_use', name: 'Edit', input: { file_path: 'a.js' } }] } })))
      .toEqual([{ type: 'text', text: '안녕' }, { type: 'tool', text: 'Edit a.js' }]);
    const [u] = claudeEvents(JSON.stringify({ type: 'result', duration_ms: 2000, usage: { input_tokens: 10, output_tokens: 5 }, total_cost_usd: 0.01 }));
    expect(u.type).toBe('usage');
    expect(u.text).toContain('15');
  });
});
