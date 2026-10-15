import { ed, on, refreshFiles, inspectFile, setTab } from '../state';
import { api, projectUrl } from '../api';
import { h, clear, contextMenu, ask, confirmBox, toast, fileIcon } from '../ui';
import { SCRIPT_TEMPLATE } from './inspector';
import { serializeScene, createNode } from '../../engine';
import { openFile } from '../open-file';
import { thumbnail, assetKind, KIND_ICON } from '../preview';

// The FileSystem dock: a tree (list) or the files of one folder as picture tiles (grid). Click a file to preview it in the inspector.

const closed = new Set<string>();
let selected = '';
let folder = 'res:/'; // the folder the grid shows
let grid = (() => { try { return localStorage.getItem('engine.fsgrid') === '1'; } catch { return false; } })();

const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/')) || 'res:/';
const dirOf = (p: string, isDir: boolean) => (isDir ? p : parentOf(p));
const isImage = (p: string) => /\.(png|jpe?g|gif|webp)$/i.test(p);

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
  const modeBtn = h('button', { class: 'icon-btn' });

  /** Click: select it and show the preview (folders open and close). */
  const pick = (path: string, dir: boolean) => {
    selected = path;
    if (dir) { if (closed.has(path)) closed.delete(path); else closed.add(path); }
    else inspectFile(path);
    render();
  };
  const dragStart = (path: string) => (e: DragEvent) => { e.dataTransfer!.setData('text/x-engine-path', path); e.dataTransfer!.effectAllowed = 'copy'; };

  const renderList = () => {
    const q = filter.value.trim().toLowerCase();
    tree.append(h('div', { class: 'row' + (selected === 'res:/' ? ' sel' : ''), onclick: () => { selected = 'res:/'; render(); },
      oncontextmenu: (e: MouseEvent) => menu(e, 'res:/', true) }, h('span', { class: 'icon' }, '📁'), h('span', { class: 'name' }, 'res://')));
    for (const f of ed.files) {
      const parts = f.path.slice(6).split('/');
      if (q) { if (f.dir || !f.path.toLowerCase().includes(q)) continue; }
      else if (parts.some((_, i) => i > 0 && closed.has('res://' + parts.slice(0, i).join('/')))) continue;
      const icon = f.dir ? (closed.has(f.path) ? '📁' : '📂') : isImage(f.path) ? h('img', { class: 'mini', src: projectUrl(f.path) + '?t=' + (f.mtime || 0) }) : fileIcon(f.path);
      tree.append(h('div', {
        class: 'row' + (selected === f.path ? ' sel' : ''), draggable: !f.dir, style: { paddingLeft: 4 + (q ? 1 : parts.length) * 12 + 'px' }, title: f.path,
        onclick: () => pick(f.path, f.dir), ondblclick: () => !f.dir && openFile(f.path),
        oncontextmenu: (e: MouseEvent) => menu(e, f.path, f.dir), ondragstart: dragStart(f.path),
      }, h('span', { class: 'icon' }, icon), h('span', { class: 'name' }, q ? f.path.slice(6) : parts[parts.length - 1])));
    }
  };

  const renderGrid = () => {
    const q = filter.value.trim().toLowerCase();
    if (folder !== 'res:/' && !ed.files.some((f) => f.dir && f.path === folder)) folder = 'res:/';
    // breadcrumb: res:// › scenes › ...
    const crumbs = h('div', { class: 'fs-crumbs' });
    const parts = folder === 'res:/' ? [] : folder.slice(6).split('/');
    const go = (p: string) => { folder = p; render(); };
    crumbs.append(h('span', { class: 'crumb', onclick: () => go('res:/') }, 'res://'));
    parts.forEach((p, i) => crumbs.append(h('span', { class: 'muted' }, '›'), h('span', { class: 'crumb', onclick: () => go('res://' + parts.slice(0, i + 1).join('/')) }, p)));
    if (q) clear(crumbs).append(h('span', { class: 'muted' }, `"${q}" 찾은 파일`));
    const items = (q ? ed.files.filter((f) => !f.dir && f.path.toLowerCase().includes(q)) : ed.files.filter((f) => parentOf(f.path) === folder))
      .sort((a, b) => Number(b.dir) - Number(a.dir) || a.path.localeCompare(b.path));
    const tiles = h('div', { class: 'fs-grid', oncontextmenu: (e: MouseEvent) => { if (e.target === tiles) menu(e, folder, true); } });
    if (folder !== 'res:/' && !q) tiles.append(h('div', { class: 'tile', title: '위 폴더로 (두 번 클릭)', ondblclick: () => go(parentOf(folder)) },
      h('div', { class: 'tile-pic' }, '⤴'), h('div', { class: 'tile-name' }, '..')));
    for (const f of items) {
      const name = f.path.split('/').pop()!;
      const pic = f.dir ? null : thumbnail(f.path, 72);
      tiles.append(h('div', {
        class: 'tile' + (selected === f.path ? ' sel' : ''), title: f.path, draggable: !f.dir,
        onclick: () => { selected = f.path; if (!f.dir) inspectFile(f.path); render(); },
        ondblclick: () => (f.dir ? go(f.path) : openFile(f.path)),
        oncontextmenu: (e: MouseEvent) => menu(e, f.path, f.dir), ondragstart: dragStart(f.path),
      }, h('div', { class: 'tile-pic' + (isImage(f.path) ? ' pixel' : '') }, f.dir ? '📁' : pic || KIND_ICON[assetKind(f.path)]), h('div', { class: 'tile-name' }, name)));
    }
    if (!items.length) tiles.append(h('div', { class: 'muted pad' }, q ? '찾은 파일이 없어요.' : '빈 폴더예요.'));
    tree.append(crumbs, tiles);
  };

  const render = () => {
    clear(tree);
    modeBtn.textContent = grid ? '☰' : '▦';
    modeBtn.title = grid ? '목록으로 보기' : '그림으로 보기';
    if (grid) renderGrid(); else renderList();
  };

  const menu = (e: MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    selected = path; render();
    const dir = dirOf(path, isDir);
    contextMenu(e.clientX, e.clientY, [
      ...(isDir ? [] : [{ label: '열기', action: () => openFile(path) }, { label: '연결 보기', action: () => { inspectFile(path); setTab('graph'); } }]),
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
        if (ed.inspectFile === path) inspectFile(to);
        await refreshFiles();
        toast('이름을 바꿨어요. 이 파일을 쓰는 곳은 "연결" 탭에서 확인해 주세요.');
      } },
      { label: '삭제', disabled: path === 'res:/', action: async () => {
        if (!(await confirmBox('삭제', `${path} 를 지울까요? 되돌릴 수 없어요 (Git에 커밋했다면 거기서 되살릴 수 있어요).`, '삭제'))) return;
        await api('fs/delete', { path });
        if (ed.inspectFile === path) inspectFile('');
        await refreshFiles();
      } },
    ]);
  };

  modeBtn.addEventListener('click', () => {
    grid = !grid;
    if (grid && selected) folder = dirOf(selected, ed.files.some((f) => f.dir && f.path === selected));
    try { localStorage.setItem('engine.fsgrid', grid ? '1' : '0'); } catch { /* storage off */ }
    render();
  });
  filter.addEventListener('input', render);
  on('files', render);
  // follow the file shown in the inspector (picked in the graph or elsewhere)
  on('inspect', () => {
    const p = ed.inspectFile;
    if (!p || p === selected || !ed.files.some((f) => f.path === p)) return;
    selected = p;
    folder = parentOf(p);
    for (let d = parentOf(p); d !== 'res:/'; d = parentOf(d)) closed.delete(d);
    render();
    tree.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  });
  render();
  return h('div', { class: 'dock' },
    h('div', { class: 'dock-title' }, '파일시스템'),
    h('div', { class: 'dock-tools' }, h('button', { class: 'icon-btn', title: '새로 고침', onclick: refreshFiles }, '⟳'), filter, modeBtn),
    h('div', { class: 'dock-body' }, tree));
}
