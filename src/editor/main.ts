import './style.css';
import { ed, on, loadProject, saveScene, closeScene, setCurrent, undo, redo, newScene, openScene, saveProject, reloadChanged, log, deleteNode, duplicateNode, setTab, type Tab } from './state';
import { api } from './api';
import { h, clear, dialog, ask, confirmBox, contextMenu, toast, type MenuItem } from './ui';
import { createViewport, fitView, textures } from './viewport';
import { createSceneDock, addChildNode } from './docks/scene-tree';
import { createFileSystemDock } from './docks/filesystem';
import { createInspector } from './docks/inspector';
import { createScriptEditor, saveScript } from './script-editor';
import { createOutputPanel } from './panels/output';
import { createGitPanel } from './panels/git';
import { createGraphView } from './graph-view';

// ---------- scene saving and playing ----------

async function saveCurrent(saveAs = false): Promise<boolean> {
  const s = ed.current;
  if (!s) return false;
  let path = s.path;
  if (!path || saveAs) {
    const name = await ask('씬 저장', '파일 이름 (res:// 아래)', path ? path.slice(6) : `scenes/${s.root.name.toLowerCase()}.scene.json`);
    if (!name) return false;
    path = 'res://' + name.replace(/^res:\/\//, '').replace(/^\/+/, '');
    if (!path.endsWith('.scene.json')) path += '.scene.json';
  }
  await saveScene(s, path);
  if (!ed.project.mainScene) { ed.project.mainScene = path; await saveProject(); log(`메인 씬으로 정했어요: ${path}`); }
  return true;
}

let playWin: Window | null = null;
async function play(current: boolean) {
  // Godot saves before running; so do we, so the game sees what is on screen
  for (const s of ed.scenes) if (s.dirty && s.path) await saveScene(s);
  for (const sc of ed.scripts) if (sc.text !== sc.saved) await saveScript(sc);
  let scene = current ? ed.current?.path : ed.project.mainScene;
  if (current && ed.current && !ed.current.path) { if (!(await saveCurrent())) return; scene = ed.current.path; }
  if (!scene) { toast('메인 씬이 없어요. 프로젝트 설정에서 정하거나 씬을 저장해 주세요.', 'error'); return; }
  const { width, height } = ed.project.viewport;
  const s = Math.max(1, Math.floor(Math.min((screen.availWidth - 80) / width, (screen.availHeight - 120) / height, 3)));
  playWin?.close();
  playWin = window.open(`play.html?scene=${encodeURIComponent(scene)}`, 'engine-play', `width=${width * s},height=${height * s}`);
  log(`실행: ${scene}`);
}

function stop() { playWin?.close(); playWin = null; }

async function projectSettings() {
  const p = ed.project;
  const name = h('input', { type: 'text', value: p.name || '' });
  const scenes = ed.files.filter((f) => f.path.endsWith('.scene.json'));
  const main = h('select', null, h('option', { value: '' }, '(없음)'), scenes.map((f) => h('option', { value: f.path, selected: f.path === p.mainScene }, f.path.slice(6))));
  const w = h('input', { type: 'number', value: String(p.viewport.width), min: 16 });
  const hh = h('input', { type: 'number', value: String(p.viewport.height), min: 16 });
  const bg = h('input', { type: 'color', value: (p.background || '#000000').slice(0, 7) });
  const input = h('textarea', { rows: 5, value: JSON.stringify(p.input || {}, null, 1) });
  const ok = await dialog('프로젝트 설정', h('div', { class: 'form' },
    h('label', { class: 'field' }, '이름', name),
    h('label', { class: 'field' }, '메인 씬 (▶ 실행 때 시작)', main),
    h('div', { class: 'field' }, '게임 해상도 (픽셀)', h('div', { class: 'vec2' }, w, h('span', null, '×'), hh)),
    h('label', { class: 'field' }, '배경색', bg),
    h('label', { class: 'field' }, '입력 동작 (이름: [키 코드들])', input)), [{ label: '취소', value: false }, { label: '저장', value: true, primary: true }], { width: 440 });
  if (!ok) return;
  let inputMap = p.input;
  try { inputMap = JSON.parse(input.value || '{}'); } catch { toast('입력 동작 JSON 형식이 잘못돼서 그 부분은 그대로 뒀어요.', 'error'); }
  ed.project = { ...p, name: name.value, mainScene: main.value, viewport: { width: +w.value || 320, height: +hh.value || 180 }, background: bg.value, input: inputMap };
  await saveProject();
  toast('프로젝트 설정을 저장했어요');
}

async function exportWeb() {
  try { const r = await api('export/web'); toast('웹으로 내보냈어요'); log(`웹 내보내기: ${r.out}  (이 폴더를 웹 서버에 올리면 브라우저에서 실행돼요)`, 'ok'); }
  catch (e) { toast((e as Error).message, 'error'); }
}

/** Writes AGENTS.md (and CLAUDE.md pointing to it) into the project: a short engine guide that Claude Code or Codex read first,
 * so they don't spend tokens working out how the engine works. */
async function writeAgentsFile() {
  const exists = ed.files.some((f) => f.path === 'res://AGENTS.md');
  if (exists && !(await confirmBox('AI 안내 파일', 'AGENTS.md 가 이미 있어요. 엔진 최신 설명으로 덮어쓸까요?', '덮어쓰기'))) return;
  try { await api('project/agents'); await reloadChanged(); toast('AGENTS.md 를 만들었어요. 이 폴더에서 Claude Code나 Codex를 열면 먼저 읽어요.'); }
  catch (e) { toast((e as Error).message, 'error'); }
}

async function openSceneDialog() {
  const scenes = ed.files.filter((f) => f.path.endsWith('.scene.json'));
  if (!scenes.length) return toast('씬 파일이 없어요.');
  const sel = h('select', { size: Math.min(10, scenes.length + 1), class: 'wide' }, scenes.map((f, i) => h('option', { value: f.path, selected: i === 0 }, f.path.slice(6))));
  const ok = await dialog('씬 열기', sel, [{ label: '취소', value: false }, { label: '열기', value: true, primary: true }]);
  if (ok) await openScene(sel.value);
}

async function closeWithCheck(s = ed.current) {
  if (!s) return;
  if (s.dirty && !(await confirmBox('씬 닫기', `${s.path || '새 씬'} 에 저장 안 한 수정이 있어요. 그래도 닫을까요?`, '닫기'))) return;
  closeScene(s);
}

/** New scene with a root that fits the view you are in (Node3D in the 3D view, Node2D elsewhere). */
const newSceneHere = () => newScene(ed.tab === '3d' ? 'Node3D' : 'Node2D');

// ---------- layout ----------

function menuButton(label: string, items: () => MenuItem[]) {
  const b = h('button', { class: 'menu-btn' }, label);
  b.onclick = () => { const r = b.getBoundingClientRect(); contextMenu(r.left, r.bottom, items()); };
  return b;
}

function sceneTabs(): HTMLElement {
  const bar = h('div', { class: 'scene-tabs' });
  const render = () => {
    clear(bar);
    for (const s of ed.scenes)
      bar.append(h('div', { class: 'scene-tab' + (s === ed.current ? ' sel' : ''), title: s.path || '저장 안 한 새 씬', onclick: () => setCurrent(s),
        onauxclick: (e: MouseEvent) => { if (e.button === 1) closeWithCheck(s); } },
        (s.path ? s.path.split('/').pop()!.replace('.scene.json', '') : '[새 씬]') + (s.dirty ? '(*)' : ''),
        h('span', { class: 'close', onclick: (e: MouseEvent) => { e.stopPropagation(); closeWithCheck(s); } }, '✕')));
    bar.append(h('button', { class: 'tab-add', title: '새 씬', onclick: () => newSceneHere() }, '＋'));
  };
  on('scenes', render);
  render();
  return bar;
}

function bottomPanel(): HTMLElement {
  const panels: [string, () => HTMLElement][] = [['출력', createOutputPanel], ['버전 관리', createGitPanel]];
  const made = new Map<string, HTMLElement>();
  const body = h('div', { class: 'bottom-body' });
  const tabs = h('div', { class: 'bottom-tabs' });
  let open = localStorage.getItem('engine.bottom') ?? '출력';
  const render = () => {
    clear(tabs);
    for (const [name] of panels) tabs.append(h('button', { class: 'btab' + (open === name ? ' sel' : ''), onclick: () => { open = open === name ? '' : name; try { localStorage.setItem('engine.bottom', open); } catch { /* */ } render(); } }, name));
    for (const [name, make] of panels) {
      if (name === open && !made.has(name)) { made.set(name, make()); body.append(made.get(name)!); }
      made.get(name)?.toggleAttribute('hidden', name !== open);
    }
    document.body.classList.toggle('bottom-closed', !open);
  };
  render();
  return h('div', { class: 'bottom' }, h('div', { class: 'resizer-h', 'data-var': '--bottom-h' }), body, tabs);
}

/** Drag handles between docks; sizes live in CSS variables and are remembered. */
function setupResizers() {
  const root = document.documentElement;
  for (const v of ['--left-w', '--right-w', '--bottom-h', '--left-split']) { try { const x = localStorage.getItem('engine' + v); if (x) root.style.setProperty(v, x); } catch { /* */ } }
  document.addEventListener('mousedown', (e) => {
    const el = (e.target as HTMLElement).closest('[data-var]') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    const v = el.dataset.var!, start = parseFloat(getComputedStyle(root).getPropertyValue(v)), x0 = e.clientX, y0 = e.clientY;
    const move = (ev: MouseEvent) => {
      const d = v === '--left-w' ? ev.clientX - x0 : v === '--right-w' ? x0 - ev.clientX : v === '--bottom-h' ? y0 - ev.clientY : ev.clientY - y0;
      const val = Math.max(v === '--left-split' ? 80 : 120, start + d) + 'px';
      root.style.setProperty(v, val);
      try { localStorage.setItem('engine' + v, val); } catch { /* */ }
    };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  });
}

const TABS: [Tab, string][] = [['2d', '2D'], ['3d', '3D'], ['script', '스크립트'], ['graph', '연결']];

function build() {
  const app = document.getElementById('app')!;
  const tabButtons = TABS.map(([t, label]) => h('button', { class: 'main-tab', title: t === 'graph' ? '애셋과 코드가 어떻게 이어져 있는지 보기' : '', onclick: () => setTab(t) }, label));
  const projName = h('span', { class: 'proj-name' });
  const menubar = h('div', { class: 'menubar' },
    menuButton('씬', () => [
      { label: '새 씬', shortcut: 'Ctrl+N', action: newSceneHere },
      { label: '씬 열기…', shortcut: 'Ctrl+O', action: openSceneDialog },
      { label: '씬 저장', shortcut: 'Ctrl+S', action: () => saveCurrent(), disabled: !ed.current },
      { label: '다른 이름으로 저장…', shortcut: 'Ctrl+Shift+S', action: () => saveCurrent(true), disabled: !ed.current },
      { separator: true, label: '' },
      { label: '씬 닫기', shortcut: 'Ctrl+W', action: () => closeWithCheck(), disabled: !ed.current },
    ]),
    menuButton('편집', () => [
      { label: '실행 취소', shortcut: 'Ctrl+Z', action: undo, disabled: !ed.current?.undo.length },
      { label: '다시 실행', shortcut: 'Ctrl+Y', action: redo, disabled: !ed.current?.redo.length },
    ]),
    menuButton('프로젝트', () => [
      { label: '프로젝트 설정…', action: projectSettings },
      { label: '파일 다시 읽기', action: async () => { textures.invalidate(); await reloadChanged(); } },
      { label: 'AI 안내 파일 만들기 (AGENTS.md)', action: writeAgentsFile },
      { separator: true, label: '' },
      { label: '웹으로 내보내기', action: exportWeb },
    ]),
    menuButton('도움말', () => [
      { label: '단축키 보기', action: () => dialog('단축키', h('pre', { class: 'keys' }, [
        'F5  메인 씬 실행        F6  지금 씬 실행        F8  정지',
        'Ctrl+S  저장            Ctrl+Z / Ctrl+Y  실행 취소 / 다시',
        'Ctrl+A  자식 노드 추가  Ctrl+D  복제          Del  삭제',
        'F2  이름 바꾸기',
        '',
        '2D: 화살표 1픽셀 이동 (Shift: 8픽셀), 휠 확대, 가운데 버튼이나 Space+끌기로 화면 이동',
        '3D: Q 고르기  W 이동  E 회전  R 크기  F 고른 노드로 맞추기',
        '    오른쪽 끌기 회전, 가운데 또는 Shift+오른쪽 끌기 이동, 휠 확대',
      ].join('\n')), [{ label: '닫기', value: true, primary: true }], { width: 560 }) },
    ]),
    projName,
    h('div', { class: 'main-tabs' }, tabButtons),
    h('div', { class: 'play' },
      h('button', { class: 'play-btn', title: '메인 씬 실행 (F5)', onclick: () => play(false) }, '▶'),
      h('button', { class: 'play-btn', title: '지금 씬 실행 (F6)', onclick: () => play(true) }, '▷'),
      h('button', { class: 'play-btn', title: '정지 (F8)', onclick: stop }, '■')));
  const center2d = h('div', { class: 'center-view' }, sceneTabs(), createViewport());
  const holder3d = h('div', { class: 'center-view' }, sceneTabs());
  const centerScript = createScriptEditor();
  const centerGraph = createGraphView();
  const views: Record<Tab, HTMLElement> = { '2d': center2d, '3d': holder3d, script: centerScript, graph: centerGraph };
  const left = h('div', { class: 'left' }, createSceneDock(), h('div', { class: 'resizer-v', 'data-var': '--left-split' }), createFileSystemDock());
  app.append(menubar,
    h('div', { class: 'main' }, left, h('div', { class: 'resizer-w', 'data-var': '--left-w' }),
      h('div', { class: 'center' }, center2d, holder3d, centerScript, centerGraph),
      h('div', { class: 'resizer-w', 'data-var': '--right-w' }), h('div', { class: 'right' }, createInspector())),
    bottomPanel());
  let loading3d = false;
  const syncTab = () => {
    for (const [t, el] of Object.entries(views)) el.hidden = ed.tab !== t;
    tabButtons.forEach((b, i) => b.classList.toggle('sel', TABS[i][0] === ed.tab));
    // the 3D view brings in three.js, so it loads the first time it is needed
    if (ed.tab === '3d' && !loading3d) {
      loading3d = true;
      import('./viewport3d').then((m) => holder3d.append(m.createViewport3D())).catch((e) => log('3D 화면을 열지 못했어요: ' + e.message, 'error'));
    }
  };
  on('tab', syncTab); syncTab();
  on('project', () => { projName.textContent = ed.project.name || ed.projectName; });
  setupResizers();
}

function shortcuts() {
  addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).closest?.('.cm-editor');
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'F5') { e.preventDefault(); play(false); }
    else if (e.key === 'F6') { e.preventDefault(); play(true); }
    else if (e.key === 'F8') { e.preventDefault(); stop(); }
    else if (mod && k === 's') { e.preventDefault(); if (ed.tab === 'script') saveScript(); else saveCurrent(e.shiftKey); }
    else if (typing) return;
    else if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (mod && k === 'n') { e.preventDefault(); newSceneHere(); }
    else if (mod && k === 'o') { e.preventDefault(); openSceneDialog(); }
    else if (mod && k === 'w') { e.preventDefault(); closeWithCheck(); }
    else if (mod && k === 'a' && (ed.tab === '2d' || ed.tab === '3d')) { e.preventDefault(); addChildNode(); }
    else if (mod && k === 'd' && ed.current?.selected) { e.preventDefault(); duplicateNode(ed.current.selected); }
    else if (e.key === 'Delete' && (ed.tab === '2d' || ed.tab === '3d') && ed.current?.selected && ed.current.selected !== ed.current.root) deleteNode(ed.current.selected);
  });
  addEventListener('beforeunload', (e) => { if (ed.scenes.some((s) => s.dirty) || ed.scripts.some((s) => s.text !== s.saved)) e.preventDefault(); });
  // pick up changes made outside the editor (Claude Code or Codex in a terminal, git, another program) when coming back to the window
  addEventListener('focus', () => reloadChanged().catch(() => {}));
}

async function start() {
  build();
  shortcuts();
  try {
    await loadProject();
    if (ed.project.mainScene) await openScene(ed.project.mainScene).catch((e) => log(e.message, 'error'));
    setTimeout(fitView, 50);
    log(`프로젝트를 열었어요: ${ed.project.name || ed.projectName}`, 'ok');
  } catch (e) {
    log('에디터 서버에 연결하지 못했어요: ' + (e as Error).message, 'error');
  }
}

start();
