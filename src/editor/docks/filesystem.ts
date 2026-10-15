import { ed, on, refreshFiles, openScene } from '../state';
import { api } from '../api';
import { h, clear, contextMenu, ask, confirmBox, toast, fileIcon } from '../ui';
import { openScript } from '../script-editor';
import { SCRIPT_TEMPLATE } from './inspector';
import { serializeScene, createNode } from '../../engine';

const closed = new Set<string>();
let selected = '';

const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/')) || 'res:/';
const dirOf = (p: string, isDir: boolean) => (isDir ? p : parentOf(p));

export async function openFile(path: string) {
  if (path.endsWith('.scene.json')) await openScene(path);
  else if (/\.(js|json|md|txt|css)$/i.test(path)) await openScript(path);
  else toast('이 종류는 여기서 열 수 없어요. 이미지는 뷰포트로 끌어다 놓으면 Sprite2D가 돼요.');
}

async function newFile(kind: 'folder' | 'scene' | 'script', dir: string) {
  const base = dir === 'res:/' ? 'res://' : dir + '/';
  const name = await ask(kind === 'folder' ? '새 폴더' : kind === 'scene' ? '새 씬' : '새 스크립트', '이름', kind === 'folder' ? 'new_folder' : kind === 'scene' ? 'new.scene.json' : 'new_script.js');
  if (!name) return;
  const path = base + name;
  if (kind === 'folder') await api('fs/mkdir', { path });
  if (kind === 'scene') await api('fs/write', { path: path.endsWith('.scene.json') ? path : path + '.scene.json', text: serializeScene(createNode('Node2D', name.replace(/\.scene\.json$/, ''))) });
  if (kind === 'script') await api('fs/write', { path: path.endsWith('.js') ? path : path + '.js', text: SCRIPT_TEMPLATE(path, '') });
  await refreshFiles();
}

async function importFiles(dir: string) {
  const input = h('input', { type: 'file', multiple: true });
  input.onchange = async () => {
    for (const f of [...(input.files || [])]) {
      const b64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(f); });
      await api('fs/write', { path: (dir === 'res:/' ? 'res://' : dir + '/') + f.name, base64: b64 });
    }
    await refreshFiles();
    toast(`${input.files?.length}개 파일을 가져왔어요.`);
  };
  input.click();
}

export function createFileSystemDock(): HTMLElement {
  const filter = h('input', { type: 'search', placeholder: '파일 찾기', class: 'filter' });
  const tree = h('div', { class: 'tree' });

  const render = () => {
    clear(tree);
    const q = filter.value.trim().toLowerCase();
    const root = h('div', { class: 'row' + (selected === 'res:/' ? ' sel' : ''), onclick: () => { selected = 'res:/'; render(); },
      oncontextmenu: (e: MouseEvent) => menu(e, 'res:/', true) }, h('span', { class: 'icon' }, '📁'), h('span', { class: 'name' }, 'res://'));
    tree.append(root);
    for (const f of ed.files) {
      const parts = f.path.slice(6).split('/');
      const depth = parts.length;
      if (q) { if (f.dir || !f.path.toLowerCase().includes(q)) continue; }
      else {
        let hidden = false;
        for (let i = 1; i < parts.length; i++) if (closed.has('res://' + parts.slice(0, i).join('/'))) hidden = true;
        if (hidden) continue;
      }
      const el = h('div', {
        class: 'row' + (selected === f.path ? ' sel' : ''), draggable: !f.dir, style: { paddingLeft: 4 + (q ? 1 : depth) * 12 + 'px' }, title: f.path,
        onclick: () => { selected = f.path; if (f.dir) { if (closed.has(f.path)) closed.delete(f.path); else closed.add(f.path); } render(); },
        ondblclick: () => !f.dir && openFile(f.path),
        oncontextmenu: (e: MouseEvent) => menu(e, f.path, f.dir),
        ondragstart: (e: DragEvent) => { e.dataTransfer!.setData('text/x-engine-path', f.path); e.dataTransfer!.effectAllowed = 'copy'; },
      }, h('span', { class: 'icon' }, f.dir ? (closed.has(f.path) ? '📁' : '📂') : fileIcon(f.path)), h('span', { class: 'name' }, q ? f.path.slice(6) : parts[parts.length - 1]));
      tree.append(el);
    }
  };

  const menu = (e: MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    selected = path; render();
    const dir = dirOf(path, isDir);
    contextMenu(e.clientX, e.clientY, [
      ...(isDir ? [] : [{ label: '열기', action: () => openFile(path) }]),
      { label: '새 폴더…', action: () => newFile('folder', dir) },
      { label: '새 씬…', action: () => newFile('scene', dir) },
      { label: '새 스크립트…', action: () => newFile('script', dir) },
      { label: '파일 가져오기…', action: () => importFiles(dir) },
      { separator: true, label: '' },
      { label: '이름 바꾸기…', disabled: path === 'res:/', action: async () => {
        const name = await ask('이름 바꾸기', '새 이름', path.split('/').pop()!);
        if (!name) return;
        const to = parentOf(path) + '/' + name;
        await api('fs/rename', { from: path, to });
        for (const s of ed.scenes) if (s.path === path) s.path = to;
        for (const sc of ed.scripts) if (sc.path === path) sc.path = to;
        await refreshFiles();
        toast('이름을 바꿨어요. 이 파일을 쓰는 씬이 있으면 경로를 다시 골라 주세요.');
      } },
      { label: '삭제', disabled: path === 'res:/', action: async () => {
        if (!(await confirmBox('삭제', `${path} 를 지울까요? 되돌릴 수 없어요 (Git에 커밋했다면 거기서 되살릴 수 있어요).`, '삭제'))) return;
        await api('fs/delete', { path });
        await refreshFiles();
      } },
    ]);
  };

  filter.addEventListener('input', render);
  on('files', render);
  render();
  return h('div', { class: 'dock' },
    h('div', { class: 'dock-title' }, '파일시스템'),
    h('div', { class: 'dock-tools' }, h('button', { class: 'icon-btn', title: '새로 고침', onclick: refreshFiles }, '⟳'), filter),
    h('div', { class: 'dock-body' }, tree));
}

