import type { Behavior, KindDef, Look, Params, Placement } from '../core/world';
import { renderAsset, typeHeader } from './assetview';
import { NAME_RULE, type Ed } from './state';
import { eachNode, removeNode, spotOf } from './tree';
import { checkInput, confirmButton, h, numberInput, row, selectInput, textInput, thumbnail } from './ui';

// Two panels: the 인스펙터 (the selected object, or the prefab / file picked in the 프로젝트 panel, like Unity)
// and the scene settings. Each can sit anywhere in the layout.

const PARAM_NAMES: Record<string, string> = {
  speed: '빠르기', distance: '거리', edges: '발판 끝에서 돌기', height: '높이', target: '대상 프리팹', range: '이 거리 안이면',
  by: '누가 닿으면', score: '점수', sound: '소리', strength: '힘', maxFall: '가장 빠른 낙하', power: '점프 힘',
  key: '키 (동작 이름)', axes: '방향', bottom: '아래도 막기', idle: '서 있을 때', walk: '걸을 때', air: '공중에서',
  text: '내용', align: '정렬', color: '색', scale: '크기 (배)', screen: '화면에 고정',
};

const CHOICE_NAMES: Record<string, string> = { left: '왼쪽', center: '가운데', right: '오른쪽', both: '네 방향', horizontal: '좌우만' };

/** Fill a panel: clear it and let one of the tab builders below add its rows. */
export function renderPanel(ed: Ed, root: HTMLElement, which: 'inspector' | 'scene'): void {
  const body = h('div', { class: 'ed-body' });
  root.replaceChildren(body);
  if (which === 'scene') return sceneTab(ed, body);
  const file = ed.inspecting;
  if (file?.type === 'prefab' && ed.kinds[file.name]) kindTab(ed, body, file.name);
  else if (file && file.type !== 'prefab') renderAsset(ed, body, file.type, file.name);
  else objectTab(ed, body);
}

// ---- 오브젝트: one node of the scene ----

function objectTab(ed: Ed, body: HTMLElement): void {
  const p = ed.selected;
  if (!p) {
    body.append(h('p', { class: 'ed-note', textContent: '맵이나 오브젝트 목록에서 오브젝트를 고르면 이름, 프리팹, 위치, 값이 여기에 나와요. 프로젝트 패널에서 파일을 고르면 그 파일이 나와요.' }));
    return;
  }
  const kind = ed.kinds[p.kind];
  const img = kind ? ed.game.assets.image(kind.image) : null;
  const parent = spotOf(ed.game.scene, p)?.parent;
  const kindOptions: [string, string][] = [['', '(빈 오브젝트: 묶기만 함)'], ...Object.keys(ed.kinds).map((n): [string, string] => [n, n])];
  body.append(
    h('div', { class: 'ed-inspect-type' }, '오브젝트'),
    h('div', { class: 'ed-card-head' }, thumbnail(img, kind?.frames), h('b', { textContent: p.name || p.kind || '빈 오브젝트' }),
      kind && h('button', { textContent: '프리팹 고치기', onclick: () => (ed.inspect('prefab', p.kind), ed.render()) })),
    row('이름', textInput(p.name, (v) => ed.change(() => setOrDelete(p, 'name', v.trim() || undefined)), '이름 없음'), '오브젝트 목록에서 알아보기 쉽게'),
    row('프리팹', selectInput(kindOptions, p.kind, (v) => ed.change(() => (p.kind = v))), '이 오브젝트를 어떤 프리팹으로 만들지'),
    ...(parent ? [h('p', { class: 'ed-note', textContent: `"${parent.name || parent.kind || '빈 오브젝트'}" 안에 있어요. 위치는 부모 기준이고, 부모가 움직이면 같이 움직여요.` })] : []),
    row(parent ? 'x (부모 기준)' : 'x (가로)', numberInput(p.x, (v) => ed.change(() => (p.x = v ?? 0)))),
    row(parent ? 'y (부모 기준)' : 'y (세로)', numberInput(p.y, (v) => ed.change(() => (p.y = v ?? 0)))),
    row('w (넓이)', numberInput(p.w as number | undefined, (v) => ed.change(() => setOrDelete(p, 'w', v)), '그림 크기'), '그림보다 크게 놓으면 그림이 반복돼요'),
    row('h (높이)', numberInput(p.h as number | undefined, (v) => ed.change(() => setOrDelete(p, 'h', v)), '그림 크기')),
  );
  if (kind) {
    const values = kindValues(ed, kind);
    if (Object.keys(values).length) {
      body.append(h('h3', { textContent: '이 오브젝트만 바꿀 값' }), h('p', { class: 'ed-note', textContent: '비워 두면 프리팹에 정한 값(흐린 글자)을 따라가요.' }));
      const choices = Object.assign({}, ...kind.blocks.map((b) => findBehavior(ed, b.type)?.choices)) as Record<string, string[]>;
      for (const [key, kindValue] of Object.entries(values)) {
        body.append(row(PARAM_NAMES[key] ?? key, overrideInput(ed, p, key, kindValue, choices[key]), key));
      }
    }
  }
  body.append(h('div', { class: 'ed-buttons' },
    h('button', { textContent: '복제 (Ctrl+D)', onclick: () => duplicate(ed) }),
    h('button', { class: 'ed-danger', textContent: '지우기 (Delete)', onclick: () => removeSelected(ed) })));
}

/** Every value the kind's blocks use, as the kind sets it (or the block's usual value). */
function kindValues(ed: Ed, kind: KindDef): Params {
  const values: Params = {};
  for (const { type, ...v } of kind.blocks) Object.assign(values, findBehavior(ed, type)?.defaults, v);
  return values;
}

function overrideInput(ed: Ed, p: Placement, key: string, kindValue: unknown, choices?: string[]): HTMLElement {
  const set = (v: unknown) => ed.change(() => setOrDelete(p, key, v));
  const value = p[key];
  if (choices) {
    return selectInput([['', `프리팹대로 (${CHOICE_NAMES[String(kindValue)] ?? kindValue})`], ...choices.map((c): [string, string] => [c, CHOICE_NAMES[c] ?? c])],
      value === undefined ? '' : String(value), (v) => set(v || undefined));
  }
  if (key === 'color') {
    return h('span', { style: 'display:flex;gap:6px;flex:1' },
      colorInput(String(value ?? kindValue), set),
      h('button', { textContent: '프리팹대로', disabled: value === undefined, onclick: () => set(undefined) }));
  }
  if (key === 'text') {
    const area = h('textarea', { value: String(value ?? ''), rows: 2, placeholder: String(kindValue) });
    area.addEventListener('change', () => set(area.value === '' ? undefined : area.value));
    return area;
  }
  if (typeof kindValue === 'boolean') {
    return selectInput([['', `프리팹대로 (${kindValue ? '켬' : '끔'})`], ['true', '켬'], ['false', '끔']], value === undefined ? '' : String(value),
      (v) => set(v === '' ? undefined : v === 'true'));
  }
  if (typeof kindValue === 'number') return numberInput(value as number | undefined, set, String(kindValue));
  return textInput(value as string | undefined, (v) => set(v === '' ? undefined : v), String(kindValue));
}

/** Copy the selected node (with everything inside it) right after it, a little to the right. */
export function duplicate(ed: Ed): void {
  const p = ed.selected;
  const spot = p && spotOf(ed.game.scene, p);
  if (!p || !spot) return;
  const copy: Placement = { ...structuredClone(p), x: p.x + ed.grid * 2 };
  ed.change(() => spot.list.splice(spot.list.indexOf(p) + 1, 0, copy));
  ed.pick(copy);
  ed.render();
}

/** Delete the selected node and everything inside it. */
export function removeSelected(ed: Ed): void {
  const p = ed.selected;
  if (!p) return;
  ed.selected = null;
  ed.change(() => removeNode(ed.game.scene, p));
}

// ---- 프리팹: picture + blocks ----

function kindTab(ed: Ed, body: HTMLElement, name: string): void {
  const kind = ed.kinds[name];
  body.append(
    typeHeader('prefab', name, 'src/kinds.json'),
    h('div', { class: 'ed-buttons' },
      h('button', { textContent: ed.palette === name ? '놓는 중 (Esc: 그만)' : '맵을 클릭해서 놓기', onclick: () => ((ed.palette = ed.palette === name ? null : name), ed.render()) })),
  );
  const images = ed.game.assets.names().map((n): [string, string] => [n, n]);

  body.append(
    row('이름', textInput(name, (v) => renameKind(ed, name, v.trim())), '바꾸면 장면과 컴포넌트 값 속 이름도 같이 바뀌어요'),
    h('h3', { textContent: '그림' }),
    h('div', { class: 'ed-card-head' }, thumbnail(ed.game.assets.image(kind.image), kind.frames, 40),
      selectInput(images, kind.image, (v) => ed.change(() => (kind.image = v)))),
    row('장 수', numberInput(kind.frames, (v) => ed.change(() => setOrDelete(kind, 'frames', v)), '1'), '애니메이션 그림이면 가로로 몇 장 붙어 있는지'),
    row('1초에 몇 장', numberInput(kind.fps, (v) => ed.change(() => setOrDelete(kind, 'fps', v)), '8')),
  );

  body.append(h('h3', { textContent: '상황별 애니메이션' }));
  const anims = kind.animations ?? {};
  for (const [animName, look] of Object.entries(anims)) body.append(animationCard(ed, kind, animName, look, images));
  const newAnim = textInput('', (v) => {
    const n = v.trim();
    if (!n || anims[n]) return;
    ed.change(() => (kind.animations = { ...anims, [n]: { image: kind.image } }));
  }, '새 애니메이션 이름 (예: walk) 입력 후 Enter');
  body.append(newAnim);

  body.append(h('h3', { textContent: '컴포넌트 (위에서부터 차례로)' }));
  kind.blocks.forEach((block, i) => body.append(blockCard(ed, kind, i)));
  const options: [string, string][] = [['', '+ 컴포넌트 추가...'], ...ed.behaviors.map((b): [string, string] => [b.type, `${b.label ?? b.type} (${b.type})`])];
  body.append(selectInput(options, '', (type) => {
    if (!type) return;
    ed.change(() => kind.blocks.push({ type, ...findBehavior(ed, type)?.defaults }));
  }));

  let used = 0;
  for (const s of Object.values(ed.scenes)) eachNode(s.objects, (o) => o.kind === name && used++);
  body.append(h('div', { class: 'ed-buttons' }, confirmButton(`이 프리팹 지우기${used ? ` (놓인 ${used}개는 빈 오브젝트로)` : ''}`, () => {
    ed.inspecting = null;
    if (ed.palette === name) ed.palette = null;
    ed.change(() => {
      delete ed.kinds[name];
      // Nodes of this kind become empty nodes, so whatever sits inside them stays.
      for (const s of Object.values(ed.scenes)) eachNode(s.objects, (o) => o.kind === name && (o.kind = ''));
    });
  })));
}

function animationCard(ed: Ed, kind: KindDef, animName: string, look: Look, images: [string, string][]): HTMLElement {
  return h('div', { class: 'ed-card' },
    h('div', { class: 'ed-card-head' }, thumbnail(ed.game.assets.image(look.image), look.frames), h('b', { textContent: animName }),
      h('button', { textContent: '✕', title: '지우기', onclick: () => ed.change(() => delete kind.animations![animName]) })),
    row('그림', selectInput(images, look.image, (v) => ed.change(() => (look.image = v)))),
    row('장 수', numberInput(look.frames, (v) => ed.change(() => setOrDelete(look, 'frames', v)), '1')),
    row('1초에 몇 장', numberInput(look.fps, (v) => ed.change(() => setOrDelete(look, 'fps', v)), '8')),
  );
}

function blockCard(ed: Ed, kind: KindDef, i: number): HTMLElement {
  const block = kind.blocks[i];
  const behavior = findBehavior(ed, block.type);
  const move = (to: number) => ed.change(() => kind.blocks.splice(to, 0, ...kind.blocks.splice(i, 1)));
  const card = h('div', { class: 'ed-card' },
    h('div', { class: 'ed-card-head' },
      h('b', { textContent: behavior?.label ?? block.type }), h('small', { textContent: block.type }),
      h('button', { textContent: '↑', title: '위로', disabled: i === 0, onclick: () => move(i - 1) }),
      h('button', { textContent: '↓', title: '아래로', disabled: i === kind.blocks.length - 1, onclick: () => move(i + 1) }),
      h('button', { textContent: '✕', title: '빼기', onclick: () => ed.change(() => kind.blocks.splice(i, 1)) })),
  );
  if (!behavior) card.append(h('p', { class: 'ed-note', textContent: '이런 컴포넌트가 없어요. 이름을 확인해 주세요.' }));
  const values: Params = { ...behavior?.defaults, ...block };
  delete values.type;
  for (const [key, value] of Object.entries(values)) {
    card.append(row(PARAM_NAMES[key] ?? key, paramInput(ed, kind, behavior, key, value, (v) => ed.change(() => (block[key] = v))), key));
  }
  return card;
}

/** The right kind of box for a block value: tick box, number, or a list of sounds / kinds / animations. */
function paramInput(ed: Ed, kind: KindDef, behavior: Behavior | undefined, key: string, value: unknown, set: (v: unknown) => void): HTMLElement {
  if (typeof value === 'boolean') return checkInput(value, set);
  if (typeof value === 'number') return numberInput(value, (v) => set(v ?? 0));
  const str = String(value ?? '');
  const choices = behavior?.choices?.[key];
  if (choices) return selectInput(choices.map((c) => [c, c]), str, set);
  if (key === 'color') return colorInput(str || '#ffffff', set);
  if (key === 'sound') return selectInput([['', '(없음)'], ...ed.game.sound.names().map((n): [string, string] => [n, n])], str, set);
  if (key === 'target' || key === 'by') return selectInput(Object.keys(ed.kinds).map((n) => [n, n]), str, set);
  if (['idle', 'walk', 'air'].includes(key)) {
    return selectInput([['', '(기본 그림)'], ...Object.keys(kind.animations ?? {}).map((n): [string, string] => [n, n])], str, set);
  }
  return textInput(str, set);
}

function renameKind(ed: Ed, from: string, to: string): void {
  if (to === from) return;
  if (!NAME_RULE.test(to) || ed.kinds[to]) return ed.say('이름은 영어, 숫자, -, _ 만 쓰고 다른 프리팹과 겹치지 않게 해 주세요.');
  ed.change(() => {
    // Rebuild the list so the kind keeps its place in kinds.json.
    const entries = Object.entries(ed.kinds).map(([k, v]): [string, KindDef] => [k === from ? to : k, v]);
    for (const k of Object.keys(ed.kinds)) delete ed.kinds[k];
    Object.assign(ed.kinds, Object.fromEntries(entries));
    for (const k of Object.values(ed.kinds)) for (const b of k.blocks) for (const key of ['target', 'by']) if (b[key] === from) b[key] = to;
    for (const s of Object.values(ed.scenes)) {
      eachNode(s.objects, (o) => o.kind === from && (o.kind = to));
      if (s.rules?.collect === from) s.rules.collect = to;
    }
  });
  ed.inspect('prefab', to);
  if (ed.palette === from) ed.palette = to;
  ed.render();
}

// ---- 장면: map size, colors, music, rules ----

function sceneTab(ed: Ed, body: HTMLElement): void {
  const { game } = ed;
  const s = game.scene;
  const sceneNames = Object.keys(ed.scenes).map((n): [string, string] => [n, n]);
  body.append(
    h('p', { class: 'ed-note', textContent: `지금 장면: ${game.sceneName} (src/scenes/${game.sceneName}.json)` }),
    row('맵 가로', numberInput(s.size?.width, (v) => ed.change(() => setSize(ed, 'width', v)), String(game.width))),
    row('맵 세로', numberInput(s.size?.height, (v) => ed.change(() => setSize(ed, 'height', v)), String(game.height))),
    row('하늘색', h('span', { style: 'display:flex;gap:6px;flex:1' },
      colorInput(s.background ?? '#7ec8e3', (v) => ed.change(() => (s.background = v))),
      h('button', { textContent: '기본색', onclick: () => ed.change(() => delete s.background) }))),
    row('배경 음악', selectInput([['', '(없음)'], ...game.sound.names().map((n): [string, string] => [n, n])], s.music ?? '',
      (v) => ed.change(() => setOrDelete(s, 'music', v || undefined)))),
    row('다음 장면', selectInput([['', '(같은 장면 다시)'], ...sceneNames], s.next ?? '', (v) => ed.change(() => setOrDelete(s, 'next', v || undefined))),
      '클리어(메뉴 장면은 스페이스) 다음에 갈 장면'),
    h('h3', { textContent: '규칙' }),
    row('규칙 있는 장면', checkInput(!!s.rules, (on) => ed.change(() => setOrDelete(s, 'rules', on ? { timeLimit: 60 } : undefined))),
      '끄면 메뉴 장면: 스페이스를 누르면 다음 장면으로'),
  );
  if (s.rules) {
    const rules = s.rules;
    body.append(
      row('모을 프리팹', selectInput([['', '(기본: coin)'], ...Object.keys(ed.kinds).map((n): [string, string] => [n, n])], String(rules.collect ?? ''),
        (v) => ed.change(() => setOrDelete(rules, 'collect', v || undefined)))),
      row('제한 시간(초)', numberInput(rules.timeLimit as number | undefined, (v) => ed.change(() => setOrDelete(rules, 'timeLimit', v)), '60'), '0이면 시간 제한 없음'),
      h('p', { class: 'ed-note', textContent: '문구와 소리는 src/modules/rules/rules.json의 값을 따라가요.' }),
    );
  }
  body.append(h('p', { class: 'ed-note', textContent: '화면 글자는 오브젝트예요. 프로젝트 패널의 text 프리팹을 장면 보기로 끌어 놓고, 인스펙터에서 내용을 바꿔요.' }));
}

// ---- helpers ----

function colorInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const input = h('input', { type: 'color', value });
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function setSize(ed: Ed, key: 'width' | 'height', v: number | undefined): void {
  const s = ed.game.scene;
  const size = { width: s.size?.width ?? ed.game.width, height: s.size?.height ?? ed.game.height, [key]: v ?? (key === 'width' ? ed.game.width : ed.game.height) };
  s.size = size;
}

/** Set a value, or remove it when empty so the usual value applies again. */
function setOrDelete(obj: object, key: string, value: unknown): void {
  const o = obj as Record<string, unknown>;
  if (value === undefined) delete o[key];
  else o[key] = value;
}

function findBehavior(ed: Ed, type: string): Behavior | undefined {
  return ed.behaviors.find((b) => b.type === type);
}
