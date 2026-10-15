import { Node, Node2D, Node3D, CanvasLayer, parseScene, serializeScene, createNode, nodeToData, dataToNode, clone, sameValue, has3D, type ProjectConfig } from '../engine';
import { api, type FileEntry } from './api';

/** One open scene tab: its node tree, undo history and editor camera. */
export interface OpenScene {
  path: string; // '' for a new, never-saved scene
  root: Node;
  selected: Node | null;
  dirty: boolean;
  undo: Command[];
  redo: Command[];
  view: { x: number; y: number; zoom: number } | null;
  view3d?: { pos: number[]; target: number[] };
  mtime?: number;
}

export interface OpenScript { path: string; text: string; saved: string; mtime?: number }

export interface Command { label: string; do(): void; undo(): void; key?: string; at?: number }

type Event = 'files' | 'scenes' | 'scene' | 'selection' | 'tab' | 'scripts' | 'project' | 'log' | 'inspect';
const subs = new Map<Event, Set<() => void>>();
export const on = (e: Event, fn: () => void) => { if (!subs.has(e)) subs.set(e, new Set()); subs.get(e)!.add(fn); };
export const emit = (e: Event) => subs.get(e)?.forEach((fn) => fn());

export const ed = {
  project: { name: 'Project', mainScene: '', viewport: { width: 560, height: 240 }, background: '#000000', input: {} } as ProjectConfig,
  projectName: '',
  files: [] as FileEntry[],
  scenes: [] as OpenScene[],
  current: null as OpenScene | null,
  tab: '2d' as Tab,
  /** A file shown in the inspector (asset preview) instead of the selected node; '' = show the node. */
  inspectFile: '',
  scripts: [] as OpenScript[],
  currentScript: null as OpenScript | null,
  logs: [] as { level: string; msg: string; at: Date }[],
};

export type Tab = '2d' | '3d' | 'script' | 'graph';

export function setTab(t: Tab) {
  if (ed.tab === t) return;
  ed.tab = t;
  emit('tab');
}

/** The view a scene opens in: 3D when its root is 3D, or it has 3D nodes and no 2D world (a HUD in a CanvasLayer is fine). */
function viewFor(root: Node): Tab {
  if (root instanceof Node3D) return '3d';
  let world2d = false;
  root.walk((n) => { if (n instanceof CanvasLayer) return false; if (n instanceof Node2D) world2d = true; });
  return has3D(root) && !world2d ? '3d' : '2d';
}

export function inspectFile(path: string) {
  ed.inspectFile = path;
  emit('inspect');
}

export function log(msg: string, level: 'info' | 'error' | 'ok' = 'info') {
  ed.logs.push({ level, msg, at: new Date() });
  if (ed.logs.length > 500) ed.logs.shift();
  emit('log');
}

export async function refreshFiles(): Promise<void> {
  ed.files = await api<FileEntry[]>('fs/list');
  emit('files');
}

export async function loadProject(): Promise<void> {
  const info = await api('project');
  ed.projectName = info.name;
  try { ed.project = { ...ed.project, ...JSON.parse((await api('fs/read', { path: 'res://project.json' })).text) }; }
  catch { log('project.json 이 없어서 기본 설정을 썼어요. 프로젝트 설정에서 저장하면 만들어져요.'); }
  document.title = `${ed.project.name || ed.projectName} - Engine`;
  emit('project');
  await refreshFiles();
}

export async function saveProject(): Promise<void> {
  await api('fs/write', { path: 'res://project.json', text: JSON.stringify(ed.project, null, 1) + '\n' });
  emit('project');
  await refreshFiles();
}

// ---------- scenes ----------

export function setCurrent(s: OpenScene | null) {
  ed.current = s;
  emit('scenes');
  emit('scene');
  emit('selection');
}

export function newScene(rootType = 'Node2D'): OpenScene {
  const s: OpenScene = { path: '', root: createNode(rootType), selected: null, dirty: true, undo: [], redo: [], view: null };
  s.selected = s.root;
  ed.scenes.push(s);
  if (ed.tab !== 'script') setTab(viewFor(s.root));
  setCurrent(s);
  return s;
}

export async function openScene(path: string): Promise<void> {
  const open = ed.scenes.find((s) => s.path === path);
  if (open) { setTab(viewFor(open.root)); return setCurrent(open); }
  const { text } = await api('fs/read', { path });
  const root = parseScene(text);
  const s: OpenScene = { path, root, selected: root, dirty: false, undo: [], redo: [], view: null, mtime: ed.files.find((f) => f.path === path)?.mtime };
  ed.scenes.push(s);
  setTab(viewFor(root));
  setCurrent(s);
}

export async function saveScene(s = ed.current, path = s?.path): Promise<boolean> {
  if (!s) return false;
  if (!path) return false;
  const r = await api('fs/write', { path, text: serializeScene(s.root) });
  s.path = path;
  s.dirty = false;
  s.mtime = r.mtime;
  emit('scenes');
  await refreshFiles();
  log(`저장함: ${path}`, 'ok');
  return true;
}

export function closeScene(s: OpenScene) {
  const i = ed.scenes.indexOf(s);
  ed.scenes.splice(i, 1);
  if (ed.current === s) setCurrent(ed.scenes[Math.min(i, ed.scenes.length - 1)] || null);
  else emit('scenes');
}

/** Re-read open scenes and scripts that changed on disk (an AI agent in a terminal, git pull), unless they have unsaved edits. */
export async function reloadChanged(): Promise<void> {
  await refreshFiles();
  const mt = (p: string) => ed.files.find((f) => f.path === p)?.mtime;
  for (const s of ed.scenes) {
    if (!s.path || mt(s.path) === s.mtime) continue;
    if (s.dirty) { log(`${s.path} 가 바깥에서 바뀌었지만, 저장 안 한 수정이 있어서 다시 읽지 않았어요.`, 'error'); continue; }
    try {
      const sel = s.selected?.path();
      s.root = parseScene((await api('fs/read', { path: s.path })).text);
      s.selected = (sel && s.root.find(sel.split('/').slice(1).join('/'))) || s.root;
      s.mtime = mt(s.path);
      s.undo = []; s.redo = [];
      log(`다시 읽음: ${s.path}`);
    } catch (e) { log(`${s.path}: ${(e as Error).message}`, 'error'); }
  }
  for (const sc of ed.scripts) {
    if (mt(sc.path) === sc.mtime || sc.text !== sc.saved) continue;
    sc.text = sc.saved = (await api('fs/read', { path: sc.path })).text;
    sc.mtime = mt(sc.path);
  }
  emit('scenes'); emit('scene'); emit('selection'); emit('scripts');
}

// ---------- undo / redo ----------

/** Run a command on the current scene and remember it. Commands with the same key within a moment merge (one undo per drag). */
export function exec(cmd: Command, s = ed.current) {
  if (!s) return;
  cmd.do();
  const last = s.undo[s.undo.length - 1];
  const now = Date.now();
  if (cmd.key && last && last.key === cmd.key && now - (last.at || 0) < 600) {
    const first = last.undo;
    s.undo[s.undo.length - 1] = { ...cmd, undo: first, at: now };
  } else s.undo.push({ ...cmd, at: now });
  if (s.undo.length > 300) s.undo.shift();
  s.redo = [];
  s.dirty = true;
  emit('scene');
  emit('scenes');
}

export function undo() {
  const s = ed.current; const c = s?.undo.pop();
  if (!s || !c) return;
  c.undo(); s.redo.push(c); s.dirty = true;
  emit('scene'); emit('selection'); emit('scenes');
}

export function redo() {
  const s = ed.current; const c = s?.redo.pop();
  if (!s || !c) return;
  c.do(); s.undo.push({ ...c, at: 0 }); s.dirty = true;
  emit('scene'); emit('selection'); emit('scenes');
}

export function select(n: Node | null) {
  if (!ed.current) return;
  ed.current.selected = n;
  if (ed.inspectFile) { ed.inspectFile = ''; emit('inspect'); }
  emit('selection');
}

// ---------- scene edits ----------

export function setProp(n: Node, name: string, value: unknown, merge = true) {
  const before = clone(n.props[name]);
  if (sameValue(before, value)) return;
  const after = clone(value);
  exec({ label: `${n.name}.${name}`, key: merge ? `${n.id}.${name}` : undefined, do: () => { n.props[name] = clone(after); }, undo: () => { n.props[name] = clone(before); } });
}

export function renameNode(n: Node, name: string) {
  const old = n.name;
  name = name.replace(/[/\\]/g, '').trim();
  if (!name || name === old) return;
  exec({ label: '이름 바꾸기', do: () => { n.name = n.parent ? n.parent.uniqueName(name, n) : name; }, undo: () => { n.name = old; } });
}

export function setScript(n: Node, path: string) {
  const old = n.script;
  exec({ label: '스크립트', do: () => { n.script = path; }, undo: () => { n.script = old; } });
}

export function addNode(parent: Node, child: Node, index = parent.children.length) {
  exec({ label: `${child.type} 추가`, do: () => { parent.addChild(child, index); select(child); }, undo: () => { parent.removeChild(child); select(parent); } });
}

export function deleteNode(n: Node) {
  const p = n.parent;
  if (!p) return;
  const i = p.children.indexOf(n);
  exec({ label: '삭제', do: () => { p.removeChild(n); select(p); }, undo: () => { p.addChild(n, i); select(n); } });
}

export function duplicateNode(n: Node) {
  if (!n.parent) return;
  const copy = dataToNode(nodeToData(n));
  addNode(n.parent, copy, n.parent.children.indexOf(n) + 1);
}

export function moveNode(n: Node, parent: Node, index: number) {
  if (n === parent || n.isAncestorOf(parent) || !n.parent) return;
  const oldParent = n.parent, oldIndex = oldParent.children.indexOf(n), oldName = n.name;
  if (oldParent === parent && oldIndex < index) index--;
  if (oldParent === parent && oldIndex === index) return;
  exec({
    label: '노드 옮기기',
    do: () => { parent.addChild(n, Math.min(index, parent.children.length)); },
    undo: () => { oldParent.addChild(n, oldIndex); n.name = oldName; },
  });
}

export { serializeScene };
