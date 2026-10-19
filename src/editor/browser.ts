import type { KindDef } from '../core/world';
import { TYPE_LABEL, typeIcon, type FileType } from './icons';
import type { Ed } from './state';
import { NAME_RULE } from './state';
import { h, thumbnail } from './ui';

// The 프로젝트 panel: the game's files, laid out like Windows Explorer.
// Folder tree on the left, the open folder on the right (details or thumbnails),
// a type filter and a search box on top. Click a file to see it in the 인스펙터,
// double-click to open it, drag a prefab or a picture onto the scene view to place it.

interface Item {
  type: FileType;
  name: string;
  /** Folder it sits in ('' = the project itself). For a folder: its own path. */
  folder: string;
  path: string;
  info: string;
  thumb?: { image: string; frames?: number };
}

type View = 'details' | 'thumbs';
type Sort = 'name' | 'type' | 'info';

const STORAGE = 'engine-editor-browser';
const FOLDER_HINT: Record<string, string> = {
  assets: '그림 파일 (png)', 'assets/sounds': '소리 파일 (wav, mp3, ogg)', prefabs: 'src/kinds.json 안의 프리팹', scenes: 'src/scenes 폴더의 장면 파일',
};

const state = load();
let search = '';
const open = new Set<string>(['', 'assets']); // folders unfolded in the tree

function load(): { folder: string; view: View; filter: FileType | ''; sort: Sort; desc: boolean } {
  const fallback = { folder: 'prefabs', view: 'thumbs' as View, filter: '' as const, sort: 'name' as Sort, desc: false };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE) ?? '{}') };
  } catch {
    return fallback;
  }
}

function remember(): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  } catch {
    /* fine without it */
  }
}

/** Every file the panel knows, each in its folder. */
function collect(ed: Ed): Item[] {
  const { game, kinds, scenes } = ed;
  const items: Item[] = [];
  const add = (type: FileType, name: string, path: string, info: string, thumb?: Item['thumb']) => {
    const i = path.lastIndexOf('/');
    items.push({ type, name, folder: i < 0 ? '' : path.slice(0, i), path, info, thumb });
  };
  for (const [name, k] of Object.entries(kinds)) add('prefab', name, `prefabs/${name}`, `컴포넌트 ${k.blocks.length}개`, k);
  for (const name of game.assets.names()) {
    const img = game.assets.image(name);
    add('image', name.split('/').pop()!, `assets/${name}`, img ? `${img.width}×${img.height}` : '', { image: name });
  }
  for (const name of game.sound.names()) add('sound', name.split('/').pop()!, `assets/sounds/${name}`, `${game.sound.length(name).toFixed(1)}초`);
  for (const [name, s] of Object.entries(scenes)) {
    add('scene', name, `scenes/${name}`, `${s.size?.width ?? game.width}×${s.size?.height ?? game.height}`);
  }
  return items;
}

/** The asset name the rest of the editor uses for an item (pictures and sounds can sit in sub-folders). */
function keyOf(item: Item): string {
  if (item.type === 'image') return item.path.slice('assets/'.length);
  if (item.type === 'sound') return item.path.slice('assets/sounds/'.length);
  return item.name;
}

/** Every folder: the four main ones plus any sub-folders the files sit in. */
function folders(items: Item[]): string[] {
  const all = new Set(['assets', 'assets/sounds', 'prefabs', 'scenes']);
  for (const i of items) for (let f = i.folder; f; f = f.slice(0, Math.max(0, f.lastIndexOf('/')))) all.add(f);
  return [...all].sort();
}

const parentOf = (f: string) => f.slice(0, Math.max(0, f.lastIndexOf('/')));
const baseName = (f: string) => f.split('/').pop() || '프로젝트';

export function renderBrowser(ed: Ed, root: HTMLElement): void {
  const items = collect(ed);
  const allFolders = folders(items);
  if (state.folder && !allFolders.includes(state.folder)) state.folder = '';

  const go = (f: string) => {
    state.folder = f;
    for (let p = f; p; p = parentOf(p)) open.add(p);
    remember();
    ed.render();
  };

  // ---- left: folder tree ----
  const tree = h('div', { class: 'ed-folders' });
  const branch = (f: string, depth: number) => {
    const kids = allFolders.filter((c) => c && parentOf(c) === f);
    const toggle = h('span', { class: 'ed-fold', textContent: kids.length ? (open.has(f) ? '▾' : '▸') : '' });
    toggle.onclick = (e) => {
      e.stopPropagation();
      if (open.has(f)) open.delete(f);
      else open.add(f);
      ed.render();
    };
    tree.append(h('div', {
      class: `ed-folder ${state.folder === f ? 'ed-on' : ''}`,
      style: `padding-left:${4 + depth * 12}px`,
      title: FOLDER_HINT[f] ?? f,
      onclick: () => go(f),
    }, toggle, typeIcon('folder'), h('span', { textContent: baseName(f) })));
    if (open.has(f)) for (const k of kids) branch(k, depth + 1);
  };
  branch('', 0);

  // ---- top: path, filter, search, view ----
  const up = h('button', { textContent: '↑', title: '위 폴더로', disabled: !state.folder, onclick: () => go(parentOf(state.folder)) });
  const crumbs = h('div', { class: 'ed-crumbs' });
  const parts = state.folder ? state.folder.split('/') : [];
  crumbs.append(h('span', { class: 'ed-crumb', textContent: '프로젝트', onclick: () => go('') }));
  parts.forEach((part, i) => crumbs.append(' › ', h('span', { class: 'ed-crumb', textContent: part, onclick: () => go(parts.slice(0, i + 1).join('/')) })));
  const filter = h('select', { title: '이 형식만 보기 (아래 폴더까지 모두 찾아요)' },
    h('option', { value: '', textContent: '모든 형식' }),
    ...(['prefab', 'image', 'sound', 'scene'] as FileType[]).map((t) => h('option', { value: t, textContent: TYPE_LABEL[t], selected: state.filter === t })));
  filter.addEventListener('change', () => {
    state.filter = filter.value as FileType | '';
    remember();
    ed.render();
  });
  const searchBox = h('input', { type: 'search', placeholder: '이름으로 찾기', value: search, class: 'ed-search' });
  searchBox.addEventListener('input', () => {
    search = searchBox.value;
    renderFiles();
  });
  const viewButton = (view: View, text: string, title: string) =>
    h('button', { class: state.view === view ? 'ed-on' : '', textContent: text, title, onclick: () => ((state.view = view), remember(), ed.render()) });
  const toolbar = h('div', { class: 'ed-browser-bar' }, up, crumbs, filter, searchBox,
    viewButton('details', '☰', '자세히 보기'), viewButton('thumbs', '▦', '큰 아이콘 보기'));

  // ---- right: files ----
  const files = h('div', { class: 'ed-files-wrap' });
  const status = h('div', { class: 'ed-browser-foot' });

  function shown(): Item[] {
    const q = search.trim().toLowerCase();
    // Searching or filtering looks through every folder below this one, like Windows does.
    const deep = !!q || !!state.filter;
    const inside = (f: string) => (deep ? f === state.folder || f.startsWith(state.folder ? `${state.folder}/` : '') : f === state.folder);
    const list = items.filter((i) => inside(i.folder) && (!state.filter || i.type === state.filter) && i.name.toLowerCase().includes(q));
    const sub: Item[] = deep ? [] : allFolders.filter((f) => f && parentOf(f) === state.folder)
      .map((f) => ({ type: 'folder', name: baseName(f), folder: f, path: f, info: `${items.filter((i) => i.folder.startsWith(f)).length}개` }));
    const order = (a: Item, b: Item) => {
      const k = state.sort === 'type' ? TYPE_LABEL[a.type].localeCompare(TYPE_LABEL[b.type]) : state.sort === 'info' ? a.info.localeCompare(b.info, undefined, { numeric: true }) : 0;
      return (k || a.name.localeCompare(b.name)) * (state.desc ? -1 : 1);
    };
    return [...sub, ...list.sort(order)];
  }

  function renderFiles(): void {
    const list = shown();
    const deep = !!search.trim() || !!state.filter;
    files.replaceChildren(state.view === 'details' ? details(list, deep) : thumbs(list));
    if (!list.length) files.append(h('p', { class: 'ed-note', style: 'padding:0 10px', textContent: search ? '찾는 이름이 없어요.' : '이 폴더는 비어 있어요.' }));
    status.replaceChildren(h('span', { textContent: `항목 ${list.length}개` }), ...actions());
  }

  function details(list: Item[], deep: boolean): HTMLElement {
    const head = (sort: Sort, text: string) => h('th', {
      textContent: text + (state.sort === sort ? (state.desc ? ' ▼' : ' ▲') : ''),
      onclick: () => {
        state.desc = state.sort === sort ? !state.desc : false;
        state.sort = sort;
        remember();
        renderFiles();
      },
    });
    return h('table', { class: 'ed-details' },
      h('thead', {}, h('tr', {}, head('name', '이름'), head('type', '형식'), head('info', '정보'), deep ? h('th', { textContent: '위치' }) : null)),
      h('tbody', {}, ...list.map((item) => wire(item, h('tr', {},
        h('td', {}, h('span', { class: 'ed-name' }, typeIcon(item.type), item.name)),
        h('td', { textContent: TYPE_LABEL[item.type] }),
        h('td', { textContent: item.info }),
        deep ? h('td', { textContent: item.folder }) : null)))));
  }

  function thumbs(list: Item[]): HTMLElement {
    return h('div', { class: 'ed-thumbs' }, ...list.map((item) => {
      const pic = item.thumb ? h('span', { class: 'ed-thumb-box' },
        thumbnail(ed.game.assets.image(item.thumb.image), item.thumb.frames, 48), h('span', { class: 'ed-badge' }, typeIcon(item.type, 14))) : typeIcon(item.type, 48);
      return wire(item, h('div', { class: 'ed-file' }, pic, h('span', { textContent: item.name })));
    }));
  }

  /** Clicks, double-clicks and dragging, the same in both views. */
  function wire(item: Item, el: HTMLElement): HTMLElement {
    const key = keyOf(item);
    const picked = item.type !== 'folder' && ed.inspecting?.type === item.type && ed.inspecting.name === key;
    if (picked) el.classList.add('ed-on');
    el.title = tip(item);
    el.onclick = () => {
      if (item.type === 'folder') return;
      ed.inspect(item.type, key);
      ed.render();
    };
    el.ondblclick = () => {
      if (item.type === 'folder') return go(item.path);
      if (item.type === 'scene') return ed.openScene(key);
      if (item.type === 'sound') return ed.game.sound.play(key);
      if (item.type === 'prefab') {
        ed.palette = ed.palette === key ? null : key;
        ed.render();
      }
    };
    if (item.type === 'prefab' || item.type === 'image') {
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        ed.dragging = { type: item.type === 'prefab' ? 'prefab' : 'image', name: key };
        e.dataTransfer?.setData('text/plain', key);
      });
      el.addEventListener('dragend', () => (ed.dragging = null));
    }
    return el;
  }

  function tip(item: Item): string {
    if (item.type === 'folder') return `${FOLDER_HINT[item.path] ?? item.path}\n두 번 클릭: 열기`;
    const what = {
      prefab: '두 번 클릭: 맵을 클릭할 때마다 놓기 · 끌기: 장면 보기에 놓기',
      image: '끌어서 장면 보기에 놓으면 이 그림으로 프리팹을 만들어 놓아요',
      sound: '두 번 클릭: 들어 보기',
      scene: '두 번 클릭: 이 장면 열기',
    }[item.type];
    return `${item.path}\n클릭: 인스펙터에서 보기 · ${what}`;
  }

  /** Buttons for making things, where they belong. */
  function actions(): Node[] {
    if (state.folder === 'prefabs') {
      return [nameBox('새 프리팹 이름 + Enter', (name) => {
        if (!NAME_RULE.test(name) || ed.kinds[name]) return ed.say('프리팹 이름은 영어, 숫자, -, _ 만 쓰고 겹치지 않게 해 주세요.');
        ed.change(() => (ed.kinds[name] = { image: ed.game.assets.names()[0] ?? '', blocks: [] }));
        ed.inspect('prefab', name);
        ed.render();
      })];
    }
    if (state.folder === 'scenes') return [nameBox('새 장면 이름 + Enter', (name) => ed.newScene(name))];
    if (state.folder.startsWith('assets')) return [h('span', { class: 'ed-note', textContent: '이 폴더에 파일을 넣으면 다시 열 때 여기에 나와요.' })];
    return [];
  }

  renderFiles();
  root.replaceChildren(h('div', { class: 'ed-browser' }, toolbar, h('div', { class: 'ed-browser-body' }, tree, h('div', { class: 'ed-browser-main' }, files, status))));
}

function nameBox(placeholder: string, onEnter: (name: string) => void): HTMLInputElement {
  const box = h('input', { type: 'text', placeholder });
  box.addEventListener('change', () => onEnter(box.value.trim()));
  return box;
}

/** The prefab named after a picture, made (with no components yet) if it isn't there. Call inside ed.change. */
export function prefabFor(kinds: Record<string, KindDef>, image: string): string {
  const base = image.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'prefab';
  if (kinds[base]?.image === image) return base;
  let name = base;
  for (let i = 2; kinds[name]; i++) name = `${base}-${i}`;
  kinds[name] = { image, blocks: [] };
  return name;
}
