import { prefabFor } from './browser';
import { TYPE_LABEL, typeIcon, type FileType } from './icons';
import type { Ed } from './state';
import { eachNode } from './tree';
import { h, thumbnail } from './ui';

// What the 인스펙터 shows for a picture, a sound or a scene picked in the 프로젝트 panel
// (prefabs use the full prefab editor in panels.ts).

/** The top of the 인스펙터: file type, name and where the file is. */
export function typeHeader(type: FileType, name: string, path: string): HTMLElement {
  return h('div', {},
    h('div', { class: 'ed-inspect-type' }, typeIcon(type, 14), TYPE_LABEL[type]),
    h('div', { class: 'ed-card-head' }, typeIcon(type, 28), h('b', { textContent: name })),
    h('p', { class: 'ed-note', textContent: path }));
}

export function renderAsset(ed: Ed, body: HTMLElement, type: 'image' | 'sound' | 'scene', name: string): void {
  if (type === 'image') imageView(ed, body, name);
  if (type === 'sound') soundView(ed, body, name);
  if (type === 'scene') sceneView(ed, body, name);
}

function imageView(ed: Ed, body: HTMLElement, name: string): void {
  const img = ed.game.assets.image(name);
  const users = Object.entries(ed.kinds)
    .filter(([, k]) => k.image === name || Object.values(k.animations ?? {}).some((a) => a.image === name))
    .map(([n]) => n);
  body.append(
    typeHeader('image', name, `assets/${name}`),
    h('div', { class: 'ed-preview' }, thumbnail(img, 1, 160)),
    info('크기', img ? `${img.width} × ${img.height} 픽셀` : '읽지 못함'),
    h('h3', { textContent: '이 그림을 쓰는 프리팹' }),
    users.length ? links(users, (n) => ed.inspect('prefab', n), ed) : h('p', { class: 'ed-note', textContent: '아직 없어요.' }),
    h('div', { class: 'ed-buttons' }, h('button', { textContent: '이 그림으로 프리팹 만들기', onclick: () => {
      let made = '';
      ed.change(() => (made = prefabFor(ed.kinds, name)));
      ed.inspect('prefab', made);
      ed.render();
    } })),
    h('p', { class: 'ed-note', textContent: '장면 보기로 끌어 놓아도 이 그림으로 프리팹을 만들어 놓아요.' }),
  );
}

function soundView(ed: Ed, body: HTMLElement, name: string): void {
  const users: string[] = [];
  for (const [n, k] of Object.entries(ed.kinds)) if (k.blocks.some((b) => b.sound === name)) users.push(`프리팹 ${n}`);
  for (const [n, s] of Object.entries(ed.scenes)) if (s.music === name) users.push(`장면 ${n} (배경 음악)`);
  body.append(
    typeHeader('sound', name, `assets/sounds/${name}`),
    info('길이', `${ed.game.sound.length(name).toFixed(2)}초`),
    h('div', { class: 'ed-buttons' }, h('button', { textContent: '▶ 들어 보기', onclick: () => ed.game.sound.play(name) })),
    h('h3', { textContent: '이 소리를 쓰는 곳' }),
    users.length ? h('p', { class: 'ed-note', textContent: users.join(', ') }) : h('p', { class: 'ed-note', textContent: '아직 없어요.' }),
  );
}

function sceneView(ed: Ed, body: HTMLElement, name: string): void {
  const s = ed.scenes[name];
  if (!s) return;
  let count = 0;
  eachNode(s.objects, () => count++);
  const open = ed.game.sceneName === name;
  body.append(
    typeHeader('scene', name, `src/scenes/${name}.json`),
    info('맵 크기', `${s.size?.width ?? ed.game.width} × ${s.size?.height ?? ed.game.height}`),
    info('오브젝트', `${count}개`),
    info('배경 음악', s.music || '없음'),
    info('다음 장면', s.next || '같은 장면 다시'),
    h('div', { class: 'ed-buttons' },
      h('button', { textContent: open ? '지금 열려 있어요' : '이 장면 열기', disabled: open, onclick: () => ed.openScene(name) })),
    h('p', { class: 'ed-note', textContent: '장면의 자세한 설정은 장면 패널에서 바꿔요.' }),
  );
}

function info(label: string, value: string): HTMLElement {
  return h('div', { class: 'ed-row' }, h('span', { textContent: label }), h('b', { textContent: value }));
}

function links(names: string[], onClick: (n: string) => void, ed: Ed): HTMLElement {
  return h('div', { class: 'ed-buttons' }, ...names.map((n) =>
    h('button', { onclick: () => (onClick(n), ed.render()) }, typeIcon('prefab', 12), ` ${n}`)));
}
