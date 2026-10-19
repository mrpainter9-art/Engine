import type { KindDef } from '../core/world';
import type { Ed } from './state';
import { NAME_RULE } from './state';
import { h, thumbnail } from './ui';

// The 프로젝트 panel: everything the game is made of, like Unity's Project window.
// Folders on the left (prefabs, pictures, sounds, scenes), files on the right.
// Drag a prefab or a picture onto the scene view to place it; click a prefab to place it with clicks.

type Folder = 'prefabs' | 'images' | 'sounds' | 'scenes';

const FOLDERS: [Folder, string][] = [['prefabs', '프리팹'], ['images', '그림'], ['sounds', '소리'], ['scenes', '장면']];

let folder: Folder = 'prefabs';
let search = '';
let picked: string | null = null; // a picture or sound clicked once (prefabs use ed.palette, scenes the open scene)

export function renderBrowser(ed: Ed, root: HTMLElement): void {
  const { game, kinds, scenes } = ed;
  const lists: Record<Folder, string[]> = {
    prefabs: Object.keys(kinds),
    images: game.assets.names(),
    sounds: game.sound.names(),
    scenes: Object.keys(scenes),
  };

  const folders = h('div', { class: 'ed-folders' }, ...FOLDERS.map(([id, label]) =>
    h('div', {
      class: `ed-folder ${folder === id ? 'ed-on' : ''}`,
      onclick: () => ((folder = id), (picked = null), ed.render()),
    }, h('span', { textContent: `▸ ${label}` }), h('small', { textContent: String(lists[id].length) }))));

  const searchBox = h('input', { type: 'search', placeholder: '이름으로 찾기', value: search, class: 'ed-search' });
  searchBox.addEventListener('input', () => {
    search = searchBox.value;
    renderGrid();
  });

  const grid = h('div', { class: 'ed-files' });
  const footer = h('div', { class: 'ed-browser-foot' });

  function renderGrid(): void {
    const q = search.trim().toLowerCase();
    const names = lists[folder].filter((n) => n.toLowerCase().includes(q));
    grid.replaceChildren(...names.map(tile));
    if (!names.length) grid.append(h('p', { class: 'ed-note', textContent: q ? '찾는 이름이 없어요.' : '아직 아무것도 없어요.' }));
    footer.replaceChildren(...foot());
  }

  function tile(name: string): HTMLElement {
    const on =
      folder === 'prefabs' ? ed.palette === name :
      folder === 'scenes' ? game.sceneName === name :
      picked === name;
    const el = h('div', { class: `ed-file ${on ? 'ed-on' : ''}`, title: hint(), draggable: folder === 'prefabs' || folder === 'images' },
      icon(name), h('span', { textContent: name }));
    el.onclick = () => click(name);
    el.ondblclick = () => {
      if (folder === 'prefabs') ((ed.kindName = name), ed.show('kind'), ed.render());
    };
    el.addEventListener('dragstart', (e) => {
      ed.dragging = { type: folder === 'prefabs' ? 'prefab' : 'image', name };
      e.dataTransfer?.setData('text/plain', name);
    });
    el.addEventListener('dragend', () => (ed.dragging = null));
    return el;
  }

  function icon(name: string): HTMLElement {
    if (folder === 'prefabs') {
      const def = kinds[name];
      return thumbnail(game.assets.image(def.image), def.frames, 36);
    }
    if (folder === 'images') return thumbnail(game.assets.image(name), 1, 36);
    return h('span', { class: 'ed-file-icon', textContent: folder === 'sounds' ? '♪' : '▦' });
  }

  function hint(): string {
    if (folder === 'prefabs') return '클릭: 맵을 클릭해서 놓기 · 끌기: 장면 보기에 놓기 · 두 번 클릭: 프리팹 고치기';
    if (folder === 'images') return '끌어서 장면 보기에 놓으면 이 그림으로 프리팹을 만들어 놓아요';
    if (folder === 'sounds') return '클릭: 들어 보기';
    return '클릭: 이 장면 열기';
  }

  function click(name: string): void {
    if (folder === 'prefabs') {
      ed.palette = ed.palette === name ? null : name;
      ed.kindName = name;
    } else if (folder === 'scenes') {
      ed.openScene(name);
    } else {
      picked = name;
      if (folder === 'sounds') game.sound.play(name);
    }
    ed.render();
  }

  /** The line under the files: what you can do in this folder. */
  function foot(): (Node | string)[] {
    if (folder === 'prefabs') {
      return [nameBox('새 프리팹 이름 + Enter', (name) => {
        if (!NAME_RULE.test(name) || kinds[name]) return ed.say('프리팹 이름은 영어, 숫자, -, _ 만 쓰고 겹치지 않게 해 주세요.');
        ed.change(() => (kinds[name] = { image: lists.images[0] ?? '', blocks: [] }));
        ed.palette = ed.kindName = name;
        ed.show('kind');
        ed.render();
      })];
    }
    if (folder === 'images') {
      if (!picked) return [h('span', { class: 'ed-note', textContent: '그림 파일은 assets 폴더에 넣으면 여기에 나와요.' })];
      const img = game.assets.image(picked);
      const image = picked;
      return [
        h('span', { textContent: `${picked} (${img?.width ?? 0}×${img?.height ?? 0})` }),
        h('button', { textContent: '이 그림으로 프리팹 만들기', onclick: () => {
          let name = '';
          ed.change(() => (name = prefabFor(kinds, image)));
          ed.kindName = name;
          ed.show('kind');
          ed.render();
        } }),
      ];
    }
    if (folder === 'sounds') return [h('span', { class: 'ed-note', textContent: '소리 파일은 assets/sounds 폴더에 넣으면 여기에 나와요. 클릭하면 들려요.' })];
    return [nameBox('새 장면 이름 + Enter', (name) => ed.newScene(name))];
  }

  renderGrid();
  root.replaceChildren(h('div', { class: 'ed-browser' }, folders, h('div', { class: 'ed-browser-main' }, searchBox, grid, footer)));
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
